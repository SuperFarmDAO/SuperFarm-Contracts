// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

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
contract StakerV3FacetBoosters is Sweepableds {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;

    /**
     * Deposit some particular assets to a particular pool on the Staker.
     * @param _poolId the pool id.
     * @param _boosterId id of booster that you want to achieve.
     * @param _asset asset user wants to lock for booster.
     */
    function stakeItemsBatch(
        uint256 _poolId,
        uint256 _boosterId,
        StakerBlueprint.StakedAsset memory _asset
    ) external {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolAssetType typeOfAsset;

        StakerBlueprint.PoolInfo memory pool = b.poolInfoV3[_poolId];
        if (_asset.id.length != _asset.amounts.length) {
            revert StakerBlueprint.AssetArrayLengthsMismatch();
        }

        bool exists;
        for (uint256 i; i < pool.boostInfo.length; i++) {
            if (pool.boostInfo[i] == _boosterId) {
                exists = true;
                break;
            }
        }
        if (
            !exists ||
            !eligible(
                _asset.id,
                _asset.amounts,
                _asset.assetAddress,
                _boosterId
            )
        ) {
            revert StakerBlueprint.InvalidInfoStakeForBoost();
        }

        typeOfAsset = b.boostInfo[_boosterId].typeOfAsset;

        StakerBlueprint.ItemUserInfo storage staker = b.itemUserInfo[
            msg.sender
        ];
        staker.totalItems += _asset.id.length;
        for (uint256 i; i < _asset.id.length; i++) {
            staker.tokenIds[_boosterId].add(_asset.id[i]);
            staker.amounts[_asset.id[i]] += _asset.amounts[i];
        }
        staker.boosterIds.add(_boosterId);

        b.totalItemStakes += _asset.id.length;
        updatePool(_poolId);
        updateDeposits(_poolId);
        emit StakerBlueprint.StakeItemBatch(msg.sender, _poolId, _boosterId);

        if (typeOfAsset == StakerBlueprint.PoolAssetType.ERC721) {
            for (uint256 i; i < _asset.amounts.length; i++) {
                if (_asset.amounts[i] != 1) {
                    revert StakerBlueprint.InvalidERC721Amount();
                }
            }
            ISuperGeneric(_asset.assetAddress).safeBatchTransferFrom(
                msg.sender,
                address(this),
                _asset.id,
                ""
            );
        } else {
            ISuperGeneric(_asset.assetAddress).safeBatchTransferFrom(
                msg.sender,
                address(this),
                _asset.id,
                _asset.amounts,
                ""
            );
        }
    }

    /**
     * Withdraw some particular assets from a particular pool on the Staker.
     * @param _poolId the id of pool, withdraw tokens from.
     * @param _boosterId the booster that accepted these Items.
     */
    function unstakeItemsBatch(uint256 _poolId, uint256 _boosterId) external {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        address assetAddress;
        uint256[] memory ids;
        uint256[] memory amounts;
        StakerBlueprint.PoolAssetType typeOfAsset;

        StakerBlueprint.ItemUserInfo storage staker = b.itemUserInfo[
            msg.sender
        ];

        if (!b.itemUserInfo[msg.sender].boosterIds.contains(_boosterId)) {
            revert StakerBlueprint.NotStaked();
        }

        uint256[] memory _ids = new uint256[](
            staker.tokenIds[_boosterId].length()
        );
        uint256[] memory _amounts = new uint256[](_ids.length);
        for (uint256 i; i < _ids.length; i++) {
            _ids[i] = staker.tokenIds[_boosterId].at(i);
            _amounts[i] = staker.amounts[_ids[i]];
        }
        assetAddress = b.boostInfo[_boosterId].contractRequired;
        typeOfAsset = b.boostInfo[_boosterId].typeOfAsset;
        ids = _ids;
        amounts = _amounts;

        staker.totalItems -= _ids.length;
        for (uint256 i; i < _ids.length; i++) {
            staker.tokenIds[_boosterId].remove(_ids[i]);
            staker.amounts[_ids[i]] = 0;
        }
        staker.boosterIds.remove(_boosterId);

        b.totalItemStakes -= _ids.length;
        updatePool(_poolId);
        updateDeposits(_poolId);

        emit StakerBlueprint.UnstakeItemBatch(msg.sender, _poolId, _boosterId);

        if (typeOfAsset == StakerBlueprint.PoolAssetType.ERC721) {
            ISuperGeneric(assetAddress).safeBatchTransferFrom(
                address(this),
                msg.sender,
                ids,
                ""
            );
        } else {
            ISuperGeneric(assetAddress).safeBatchTransferFrom(
                address(this),
                msg.sender,
                ids,
                amounts,
                ""
            );
        }
    }

    /**
     * Private helper function to check if Item staker is eligible for a booster.
     * @param _ids ids of Items required for a booster.
     * @param _amounts amount per token Id.
     * @param _contract external contract from which Items are required.
     * @param _boosterId the booster for which Items are being staked.
     * @return return true if eligible.
     */
    function eligible(
        uint256[] memory _ids,
        uint256[] memory _amounts,
        address _contract,
        uint256 _boosterId
    ) private view returns (bool) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.BoostInfo memory booster = b.boostInfo[_boosterId];
        uint256 totalAmount = 0;

        for (uint256 i; i < _amounts.length; i++) {
            totalAmount += _amounts[i];
        }
        if (booster.multiplier == 0) {
            // Inactive
            return false;
        } else if (_contract != booster.contractRequired) {
            // Different conatract
            return false;
        } else if (totalAmount < booster.amountRequired) {
            // Insufficient amount
            return false;
        } else if (booster.groupRequired > 0) {
            for (uint256 i; i < _ids.length; i++) {
                if (_ids[i] >> 128 != booster.groupRequired) {
                    // Wrong group item
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * Uses the emission schedule to calculate the total amount of staking reward
     * token that was emitted between two specified timestamps.
     * @param _fromTime the time to begin calculating emissions from.
     * @param _toTime the time to calculate total emissions up to.
     */
    function getTotalEmittedTokens(uint256 _fromTime, uint256 _toTime)
        internal
        view
        returns (uint256)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        uint256 totalEmittedTokens;
        uint256 workingRate;
        uint256 workingTime = _fromTime;
        for (uint256 i; i < b.tokenEmissionEventsCount; i++) {
            uint256 emissionTime = b.tokenEmissionEvents[i].timeStamp;
            uint256 emissionRate = b.tokenEmissionEvents[i].rate;
            if (_toTime < emissionTime) {
                totalEmittedTokens += ((_toTime - workingTime) * workingRate);
                return totalEmittedTokens;
            } else if (workingTime < emissionTime) {
                totalEmittedTokens += ((emissionTime - workingTime) *
                    workingRate);
                workingTime = emissionTime;
            }
            workingRate = emissionRate;
        }
        totalEmittedTokens += ((_toTime - workingTime) * workingRate);
        return totalEmittedTokens;
    }

    /**
     * Uses the emission schedule to calculate the total amount of points
     * emitted between two specified timestamps.
     * @param _fromTime the time to begin calculating emissions from.
     * @param _toTime the time to calculate total emissions up to.
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
        for (uint256 i; i < b.pointEmissionEventsCount; i++) {
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
        }
        totalEmittedPoints += ((_toTime - workingTime) * workingRate);
        return totalEmittedPoints;
    }

    /**
     * Update the pool corresponding to the specified token address.
     * @param _poolId the id of pool to update the corresponding pool for.
     */
    function updatePool(uint256 _poolId) internal {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolInfo storage pool = b.poolInfoV3[_poolId];

        if (pool.tokenBoostedDeposit == 0) {
            pool.lastRewardEvent = block.timestamp;
            return;
        }

        // Calculate token and point rewards for this pool.
        uint256 tokensReward;
        uint256 pointsReward;

        tokensReward =
            ((getTotalEmittedTokens(pool.lastRewardEvent, block.timestamp) *
                pool.tokenStrength) / b.totalTokenStrength) *
            1e12;
        pointsReward =
            ((getTotalEmittedPoints(pool.lastRewardEvent, block.timestamp) *
                pool.pointStrength) / b.totalPointStrength) *
            1e30;

        // Directly pay developers their corresponding share of tokens and points.
        (tokensReward, pointsReward) = sendDeveloperShares(
            tokensReward,
            pointsReward
        );

        // Update the pool rewards per share to pay users the amount remaining.
        pool.tokensPerShare += (tokensReward / pool.tokenBoostedDeposit);
        pool.pointsPerShare += (pointsReward / pool.pointBoostedDeposit);
        pool.lastRewardEvent = block.timestamp;
    }

    /**
     * Private helper function to send developers shares
     * @param tokensReward amount of tokens that available as rewards.
     * @param pointsReward amount of points that available as rewards.
     */
    function sendDeveloperShares(uint256 tokensReward, uint256 pointsReward)
        internal
        returns (uint256, uint256)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();
        for (uint256 i; i < b.developerAddresses.length(); i++) {
            address developer = b.developerAddresses.at(i);
            uint256 share = b.developerShares[developer];
            uint256 devTokens = (tokensReward * share) / 100000;
            tokensReward -= devTokens;
            uint256 devPoints = (pointsReward * share) / 100000;
            pointsReward -= devPoints;
            IERC20(b.token).safeTransfer(developer, devTokens / 1e12);
            b.userPoints[developer] += (devPoints / 1e30);
        }
        return (tokensReward, pointsReward);
    }

    /**
     * Private helper function to update the deposits based on new shares.
     * @param _poolId the pool id, the deposit of which is to be updated.
     */
    function updateDeposits(uint256 _poolId) internal {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolInfo storage _pool = b.poolInfoV3[_poolId];
        StakerBlueprint.UserInfo storage _user = b.userInfoV3[_poolId][
            msg.sender
        ];

        if (_user.amount > 0) {
            uint256 pendingTokens = ((_user.tokenBoostedAmount *
                _pool.tokensPerShare) / 1e12) - _user.tokenPaid;
            uint256 pendingPoints = ((_user.pointBoostedAmount *
                _pool.pointsPerShare) / 1e30) - _user.pointPaid;
            _user.tokenRewards += pendingTokens;
            _user.pointRewards += pendingPoints;
            b.totalTokenDisbursed += pendingTokens;
            _pool.tokenBoostedDeposit -= _user.tokenBoostedAmount;
            _pool.pointBoostedDeposit -= _user.pointBoostedAmount;
        }
        // if (_amount > 0) {
        //     if (_isDeposit) {
        //         _user.amount += _amount * 1000;
        //     } else {
        //         _user.amount -= _amount * 1000;
        //     }
        // }

        (_user.tokenBoostedAmount, _user.pointBoostedAmount) = applyBoosts(
            _user.amount,
            _poolId
        );
        _pool.tokenBoostedDeposit += _user.tokenBoostedAmount;
        _pool.pointBoostedDeposit += _user.pointBoostedAmount;

        _user.tokenPaid =
            (_user.tokenBoostedAmount * _pool.tokensPerShare) /
            1e12;
        _user.pointPaid =
            (_user.pointBoostedAmount * _pool.pointsPerShare) /
            1e30;
    }

    /**
     * Private helper function that applies boosts on deposits for Item staking.
     * (amount * multiplier ) / 10000, where multiplier is in basis points.
     * (20 * 20000) / 10000 = 40 => 2x boost
     * @param _unboosted value that needs to have boosts applied to.
     * @param _poolId Id of the pool.
     * @return _boostedTokens return tokens with applied boosts.
     * @return _boostedPoints return points with applied boosts.
     */
    function applyBoosts(uint256 _unboosted, uint256 _poolId)
        internal
        view
        returns (uint256 _boostedTokens, uint256 _boostedPoints)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolInfo memory pool = b.poolInfoV3[_poolId];
        StakerBlueprint.ItemUserInfo storage staker = b.itemUserInfo[
            msg.sender
        ];

        if (_unboosted == 0) {
            return (0, 0);
        } else if (staker.lockedItems[_poolId].lockedIOUIds.length == 0) {
            if (pool.boostInfo.length == 0) {
                return (_unboosted, _unboosted);
            } else if (staker.boosterIds.length() == 0) {
                return (_unboosted, _unboosted);
            }
        }

        _boostedTokens = _unboosted;
        _boostedPoints = _unboosted;

        // Iterate through all the boosters that the pool supports
        for (uint256 i; i < pool.boostInfo.length; i++) {
            if (staker.boosterIds.contains(pool.boostInfo[i])) {
                StakerBlueprint.BoostInfo memory booster = b.boostInfo[
                    pool.boostInfo[i]
                ];
                if (
                    booster.assetType == StakerBlueprint.BoosterAssetType.Tokens
                ) {
                    _boostedTokens += (_unboosted * booster.multiplier) / 10000;
                } else if (
                    booster.assetType == StakerBlueprint.BoosterAssetType.Points
                ) {
                    _boostedPoints += (_unboosted * booster.multiplier) / 10000;
                } else {
                    _boostedTokens += (_unboosted * booster.multiplier) / 10000;
                    _boostedPoints += (_unboosted * booster.multiplier) / 10000;
                }
            }
        }

        // apply boost for time lock
        if (staker.lockedItems[_poolId].lockedIOUIds.length != 0) {
            if (
                pool.timeLockTypeOfBoost ==
                StakerBlueprint.BoosterAssetType.Tokens
            ) {
                _boostedTokens += (_unboosted * pool.lockMultiplier) / 10000;
            } else if (
                pool.timeLockTypeOfBoost ==
                StakerBlueprint.BoosterAssetType.Points
            ) {
                _boostedPoints += (_unboosted * pool.lockMultiplier) / 10000;
            } else {
                _boostedTokens += (_unboosted * pool.lockMultiplier) / 10000;
                _boostedPoints += (_unboosted * pool.lockMultiplier) / 10000;
            }
        }
    }
}
