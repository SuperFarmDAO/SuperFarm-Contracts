// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../../../base/Sweepableds.sol";
// import "../../assets/erc721/interfaces/ISuper721.sol";

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
contract StakerV1FacetStaking is Sweepableds, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;

    /// Event for depositing NonFungible assets.
    event Deposit(address indexed user, IERC20 indexed token, uint256 amount);

    /// Event for withdrawing NonFungible assets.
    event Withdraw(address indexed user, IERC20 indexed token, uint256 amount);

    /// Event for claiming rewards from Fungible assets.
    event Claim(
        address indexed user,
        IERC20 indexed token,
        uint256 tokenRewards,
        uint256 pointRewards
    );

    /// Event for staking non fungible items for boosters.
    event StakeItemBatch(
        address indexed user,
        uint256 indexed _poolId,
        uint256 boosterId
    );

    /// Event for unstaking non fungible items from boosters.
    event UnstakeItemBatch(
        address indexed user,
        uint256 indexed _poolId,
        uint256 boosterId
    );

    /// An event for tracking when a user has spent points.
    event SpentPoints(
        address indexed source,
        address indexed user,
        uint256 amount
    );

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
        require(
            _toTime >= _fromTime,
            "Tokens cannot be emitted from a higher timestsamp to a lower timestamp."
        );
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
        if (workingTime < _toTime) {
            totalEmittedTokens += ((_toTime - workingTime) * workingRate);
        }
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
        require(
            _toTime >= _fromTime,
            "Points cannot be emitted from a higher timestsamp to a lower timestamp."
        );
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
        if (workingTime < _toTime) {
            totalEmittedPoints += ((_toTime - workingTime) * workingRate);
        }
        return totalEmittedPoints;
    }

    /**
     * A function to easily see the amount of token rewards pending for a user on a
     * given pool. Returns the pending reward token amount.
     * @param _token The address of a particular staking pool asset to check for a
     * pending reward.
     * @param _user The user address to check for a pending reward.
     * @return the pending reward token amount.
     */
    function getPendingTokens(IERC20 _token, address _user)
        public
        view
        returns (uint256)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolInfo memory pool = b.poolInfo[_token];
        StakerBlueprint.UserInfo memory user = b.userInfo[_token][_user];
        uint256 tokensPerShare = pool.tokensPerShare;
        uint256 poolTokenSupply = IERC20(pool.assetAddress).balanceOf(
            address(this)
        );

        if (block.timestamp > pool.lastRewardEvent && poolTokenSupply > 0) {
            uint256 totalEmittedTokens = getTotalEmittedTokens(
                pool.lastRewardEvent,
                block.timestamp
            );
            uint256 tokensReward = ((totalEmittedTokens * pool.tokenStrength) /
                b.totalTokenStrength) * 1e12;
            tokensPerShare += (tokensReward / poolTokenSupply);
        }

        return ((user.amount * tokensPerShare) / 1e12) - user.tokenPaid;
    }

    /**
     * A function to easily see the amount of point rewards pending for a user on a
     * given pool. Returns the pending reward point amount.
     *
     * @param _token The address of a particular staking pool asset to check for a
     * pending reward.
     * @param _user The user address to check for a pending reward.
     * @return the pending reward token amount.
     */
    function getPendingPoints(IERC20 _token, address _user)
        public
        view
        returns (uint256)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolInfo memory pool = b.poolInfo[_token];
        StakerBlueprint.UserInfo memory user = b.userInfo[_token][_user];
        uint256 pointsPerShare = pool.pointsPerShare;
        uint256 poolTokenSupply = IERC20(pool.assetAddress).balanceOf(
            address(this)
        );

        if (block.timestamp > pool.lastRewardEvent && poolTokenSupply > 0) {
            uint256 totalEmittedPoints = getTotalEmittedPoints(
                pool.lastRewardEvent,
                block.timestamp
            );
            uint256 pointsReward = ((totalEmittedPoints * pool.pointStrength) /
                b.totalPointStrength) * 1e30;
            pointsPerShare += (pointsReward / poolTokenSupply);
        }

        return ((user.amount * pointsPerShare) / 1e30) - user.pointPaid;
    }

    /**
     * Return the number of points that the user has available to spend.
     * @return the number of points that the user has available to spend.
     */
    function getAvailablePoints(address _user) public view returns (uint256) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        //uint256 currentTotal = b.userPoints[_user];
        uint256 pendingTotal = 0;
        for (uint256 i; i < b.poolAssets.length; i++) {
            IERC20 poolToken = b.poolTokens[i];
            uint256 _pendingPoints = getPendingPoints(poolToken, _user);
            pendingTotal = pendingTotal + _pendingPoints;
        }
        //uint256 spentTotal = b.userSpentPoints[_user];
        return (b.userPoints[_user] + pendingTotal) - b.userSpentPoints[_user];
    }

    /**
     * Return the total number of points that the user has ever accrued.
     * @return the total number of points that the user has ever accrued.
     */
    function getTotalPoints(address _user) external view returns (uint256) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        //uint256 concreteTotal = b.userPoints[_user];
        uint256 pendingTotal = 0;
        for (uint256 i; i < b.poolAssets.length; i++) {
            IERC20 poolToken = b.poolTokens[i];
            uint256 _pendingPoints = getPendingPoints(poolToken, _user);
            pendingTotal = pendingTotal + _pendingPoints;
        }
        return b.userPoints[_user] + pendingTotal;
    }

    /**
     * Update the pool corresponding to the specified token address.
     */
    function updatePool(IERC20 _token) internal {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolInfo storage pool = b.poolInfo[_token];
        if (block.timestamp <= pool.lastRewardEvent) {
            return;
        }

        uint256 poolTokenSupply = IERC20(pool.assetAddress).balanceOf(
            address(this)
        );
        if (poolTokenSupply == 0) {
            pool.lastRewardEvent = block.timestamp;
            return;
        }

        // Calculate token and point rewards for this pool.
        uint256 totalEmittedTokens = getTotalEmittedTokens(
            pool.lastRewardEvent,
            block.timestamp
        );
        uint256 tokensReward = ((totalEmittedTokens * pool.tokenStrength) /
            b.totalTokenStrength) * 1e12;

        uint256 totalEmittedPoints = getTotalEmittedPoints(
            pool.lastRewardEvent,
            block.timestamp
        );
        uint256 pointsReward = ((totalEmittedPoints * pool.pointStrength) /
            b.totalPointStrength) * 1e30;

        // Directly pay developers their corresponding share of tokens and points.
        uint256 developerAddressLength = b.developerAddresses.length();
        for (uint256 i; i < developerAddressLength; i++) {
            address developer = b.developerAddresses.at(i);
            uint256 share = b.developerShares[developer];
            uint256 devTokens = (tokensReward * share) / 100000;
            tokensReward -= devTokens;
            uint256 devPoints = (pointsReward * share) / 100000;
            pointsReward -= devPoints;
            IERC20(b.token).safeTransfer(developer, devTokens / 1e12);
            b.userPoints[developer] += (devPoints / 1e30);
        }

        // Update the pool rewards per share to pay users the amount remaining.
        pool.tokensPerShare += (tokensReward / poolTokenSupply);
        pool.pointsPerShare += (pointsReward / poolTokenSupply);
        pool.lastRewardEvent = block.timestamp;
    }

    /**
     * Deposit some particular assets to a particular pool on the Staker.
     * @param _token The asset to stake into its corresponding pool.
     * @param _amount The amount of the provided asset to stake.
     */
    function deposit(IERC20 _token, uint256 _amount) external {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolInfo memory pool = b.poolInfo[_token];
        require(
            pool.tokenStrength > 0 || pool.pointStrength > 0,
            "You cannot deposit assets into an inactive pool."
        );

        StakerBlueprint.UserInfo storage user = b.userInfo[_token][msg.sender];
        updatePool(_token);

        if (user.amount > 0) {
            uint256 pendingTokens = ((user.amount * pool.tokensPerShare) /
                1e12) - user.tokenPaid;
            user.tokenRewards += pendingTokens;
            b.totalTokenDisbursed += pendingTokens;
            uint256 pendingPoints = ((user.amount * pool.pointsPerShare) /
                1e30) - user.pointPaid;
            user.pointRewards += pendingPoints;
        }
        IERC20(pool.assetAddress).safeTransferFrom(
            address(msg.sender),
            address(this),
            _amount
        );
        user.amount = user.amount + _amount;
        user.tokenPaid = (user.amount * pool.tokensPerShare) / 1e12;
        user.pointPaid = (user.amount * pool.pointsPerShare) / 1e30;
        emit Deposit(msg.sender, _token, _amount);
    }

    /**
     * Withdraw some particular assets from a particular pool on the Staker.
     * @param _token The asset to withdraw from its corresponding staking pool.
     * @param _amount The amount of the provided asset to withdraw.
     */
    function withdraw(IERC20 _token, uint256 _amount) external {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.UserInfo storage user = b.userInfo[_token][msg.sender];
        require(
            user.amount >= _amount,
            "You cannot withdraw that much of the specified token; you are not owed it."
        );
        StakerBlueprint.PoolInfo storage pool = b.poolInfo[_token];
        updatePool(_token);

        uint256 pendingTokens = ((user.amount * pool.tokensPerShare) / 1e12) -
            user.tokenPaid;
        user.tokenRewards += pendingTokens;
        b.totalTokenDisbursed += pendingTokens;
        uint256 pendingPoints = ((user.amount * pool.pointsPerShare) / 1e30) -
            user.pointPaid;
        user.pointRewards += pendingPoints;
        user.amount = user.amount - _amount;
        user.tokenPaid = (user.amount * pool.tokensPerShare) / 1e12;
        user.pointPaid = (user.amount * pool.pointsPerShare) / 1e30;
        IERC20(pool.assetAddress).safeTransfer(address(msg.sender), _amount);
        emit Withdraw(msg.sender, _token, _amount);
    }

    /**
     * Claim accumulated token and point rewards from the Staker.
     * @param _token The asset to claim rewards from.
     */
    function claim(IERC20 _token) external {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.UserInfo storage user = b.userInfo[_token][msg.sender];
        StakerBlueprint.PoolInfo storage pool = b.poolInfo[_token];
        uint256 pendingTokens;
        uint256 pendingPoints;

        updatePool(_token);
        if (user.amount > 0) {
            pendingTokens =
                ((user.amount * pool.tokensPerShare) / 1e12) -
                user.tokenPaid;
            pendingPoints =
                ((user.amount * pool.pointsPerShare) / 1e30) -
                user.pointPaid;
            b.totalTokenDisbursed += pendingTokens;
        }
        uint256 _tokenRewards = user.tokenRewards + pendingTokens;
        uint256 _pointRewards = user.pointRewards + pendingPoints;
        b.userPoints[msg.sender] += _pointRewards;
        user.tokenRewards = 0;
        user.pointRewards = 0;

        user.tokenPaid = (user.amount * pool.tokensPerShare) / 1e12;
        user.pointPaid = (user.amount * pool.pointsPerShare) / 1e30;
        IERC20(b.token).safeTransferFrom(
            address(this),
            msg.sender,
            _tokenRewards
        );
        emit Claim(msg.sender, IERC20(b.token), _tokenRewards, _pointRewards);
    }

    /**
     * Allows the owner of this Staker to grant or remove approval to an external
     * spender of the points that users accrue from staking resources.
     * @param _spender The external address allowed to spend user points.
     * @param _approval The updated user approval status.
     */
    function approvePointSpender(address _spender, bool _approval)
        external
        onlyOwner
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

        require(
            b.approvedPointSpenders[msg.sender],
            "You are not permitted to spend user points."
        );
        require(
            getAvailablePoints(_user) >= _amount,
            "The user does not have enough points to spend the requested amount."
        );

        b.userSpentPoints[_user] += _amount;
        emit SpentPoints(msg.sender, _user, _amount);
    }
}
