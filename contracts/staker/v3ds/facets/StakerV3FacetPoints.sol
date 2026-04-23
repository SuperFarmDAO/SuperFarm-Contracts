// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../../base/Sweepableds.sol";
import "../../../interfaces/ISuperGeneric.sol";

import "../StakerBlueprint.sol";

/**
 * @title An asset staking contract.
 * @author Tim Clancy
 * @author Qazawat Zirak
 * @author Nikita Elunin
 * This staking contract disburses tokens from its internal reservoir according
 * to a fixed emission schedule. Assets can be assigned varied staking weights.
 * It also supports Items staking for boosts on native ERC20 staking rewards.
 * The item staking supports Fungible, Non-Fungible and Semi-Fungible staking.
 * This code is inspired by and modified from Sushi's Master Chef contract.
 * https://github.com/sushiswap/sushiswap/blob/master/contracts/MasterChef.sol
 */
contract StakerV3FacetPoints is Sweepableds {
    /**
     * Uses the emission schedule to calculate the total amount of points
     * emitted between two specified timestamps.
     * @param _fromTime The time to begin calculating emissions from.
     * @param _toTime The time to calculate total emissions up to.
     */
    function getTotalEmittedPoints(uint256 _fromTime, uint256 _toTime)
        internal
        view
        returns (uint256)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        uint256 totalEmittedPoints;
        uint256 workingRate;
        uint256 workingTime = _fromTime;
        for (uint256 i; i < b.pointEmissionEventsCount; ) {
            uint256 emissionTime = b.pointEmissionEvents[i].timeStamp;
            uint256 emissionRate = b.pointEmissionEvents[i].rate;
            if (_toTime < emissionTime) {
                totalEmittedPoints += ((_toTime - workingTime) * workingRate);
                return totalEmittedPoints;
            } else if (workingTime < emissionTime) {
                totalEmittedPoints += ((emissionTime - workingTime) *
                    workingRate);
                workingTime = emissionTime;
            }
            workingRate = emissionRate;
            unchecked {
                ++i;
            }
        }
        totalEmittedPoints += ((_toTime - workingTime) * workingRate);
        return totalEmittedPoints;
    }

    /**
     * A function to easily see the amount of point rewards pending for a user on a
     * given pool. Returns the pending reward point amount.
     * @param _poolId The address of a particular staking pool asset to check for a
     *   pending reward.
     * @param _user The user address to check for a pending reward.
     * @return The pending reward token amount.
     */
    function getPendingPoints(uint256 _poolId, address _user)
        public
        view
        returns (uint256)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolInfo storage pool = b.poolInfoV3[_poolId];
        StakerBlueprint.UserInfo storage user = b.userInfoV3[_poolId][_user];
        uint256 pointsPerShare = pool.pointsPerShare;
        uint256 pointBoostedDeposit = pool.pointBoostedDeposit;

        if (block.timestamp > pool.lastRewardEvent && pointBoostedDeposit > 0) {
            uint256 totalEmittedPoints = getTotalEmittedPoints(
                pool.lastRewardEvent,
                block.timestamp
            );
            uint256 pointsReward = ((totalEmittedPoints * pool.pointStrength) /
                b.totalPointStrength) * 1e30;
            pointsPerShare += (pointsReward / pointBoostedDeposit);
        }

        return
            ((user.pointBoostedAmount * pointsPerShare) / 1e30) -
            user.pointPaid;
    }

    /**
     * Return the number of points that the user has available to spend.
     * @param _user The user whose available points we want to get.
     * @return The number of points that the user has available to spend.
     */
    function getAvailablePoints(address _user) public view returns (uint256) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        uint256 pendingTotal;
        for (uint256 i; i < b.poolAssets.length; ) {
            uint256 _pendingPoints = getPendingPoints(i, _user);
            pendingTotal += _pendingPoints;
            unchecked {
                ++i;
            }
        }
        return (b.userPoints[_user] + pendingTotal) - b.userSpentPoints[_user];
    }

    /**
     * Return the total number of points that the user has ever accrued.
     * @param _user The user whose total points we want to get.
     * @return The total number of points that the user has ever accrued.
     */
    function getTotalPoints(address _user) external view returns (uint256) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        uint256 pendingTotal;
        for (uint256 i; i < b.poolAssets.length; ) {
            uint256 _pendingPoints = getPendingPoints(i, _user);
            pendingTotal += _pendingPoints;
            unchecked {
                ++i;
            }
        }
        return b.userPoints[_user] + pendingTotal;
    }

    /**
     * Allows the owner of this Staker to grant or remove approval to an external
     * spender of the points that users accrue from staking resources.
     * @param _spender The external address allowed to spend user points.
     * @param _approval The updated user approval status.
     */
    function approvePointSpender(address _spender, bool _approval)
        external
        hasValidPermit(UNIVERSAL, StakerBlueprint.APPROVE_POINT_SPENDER)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        b.approvedPointSpenders[_spender] = _approval;
    }

    /**
     * Allows an approved spender of points to spend points on behalf of a user.
     * @param _user The user whose points are being spent.
     * @param _amount The amount of the user's points being spent.
     */
    function spendPoints(address _user, uint256 _amount) external {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        if (!b.approvedPointSpenders[msg.sender]) {
            revert StakerBlueprint.NotApprovedPointSpender();
        }
        if (getAvailablePoints(_user) < _amount) {
            revert StakerBlueprint.InvalidAmount();
        }
        b.userSpentPoints[_user] += _amount;
        emit StakerBlueprint.SpentPoints(msg.sender, _user, _amount);
    }
}
