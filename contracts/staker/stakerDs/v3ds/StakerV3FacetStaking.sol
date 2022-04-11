// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../../../base/Sweepableds.sol";
import "../../../interfaces/ISuperGeneric.sol";

import "../StakerBlueprint.sol";
import "hardhat/console.sol";

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
contract StakerV3FacetStaking is Sweepableds {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;

    /// Event for depositing NonFungible assets.
    event Deposit(
        address indexed user,
        uint256 indexed _poolId,
        uint256[] amount,
        uint256[] itemIds,
        address collection
    );

    /// Event for withdrawing NonFungible assets.
    event Withdraw(
        address indexed user,
        uint256 indexed _poolId,
        uint256[] amount,
        uint256[] itemIds,
        address collection
    );

    /// Event for claiming rewards from Fungible assets.
    event Claim(
        address indexed user,
        uint256 indexed _poolId,
        uint256 tokenRewards,
        uint256 pointRewards
    );

    /// An event for tracking when a user has spent points.
    event SpentPoints(
        address indexed source,
        address indexed user,
        uint256 amount
    );

    /// An event for tracking when user locking tokens on pool
    event TokenLock(
        address indexed user,
        uint256 indexed poolId,
        uint256 lockedAt
    );

    /// An event for tracking when user locking tokens on pool
    event TokenUnlock(address indexed user, uint256 indexed poolId);

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
     * A function to easily see the amount of token rewards pending for a user on a
     * given pool. Returns the pending reward token amount.
     * @param _poolId The id of a particular staking pool asset to check for a
     *   pending reward.
     * @param _user the user address to check for a pending reward.
     * @return the pending reward token amount.
     */
    function getPendingTokens(uint256 _poolId, address _user)
        public
        view
        returns (uint256)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolInfo memory pool = b.poolInfoV3[_poolId];
        StakerBlueprint.UserInfo memory user = b.userInfoV3[_poolId][_user];
        uint256 tokensPerShare = pool.tokensPerShare;
        uint256 tokenBoostedDeposit = pool.tokenBoostedDeposit;

        if (block.timestamp > pool.lastRewardEvent && tokenBoostedDeposit > 0) {
            uint256 totalEmittedTokens = getTotalEmittedTokens(
                pool.lastRewardEvent,
                block.timestamp
            );
            uint256 tokensReward = ((totalEmittedTokens * pool.tokenStrength) /
                b.totalTokenStrength) * 1e12;
            tokensPerShare += (tokensReward / tokenBoostedDeposit);
        }

        return
            ((user.tokenBoostedAmount * tokensPerShare) / 1e12) -
            user.tokenPaid;
    }

    /**
     * A function to easily see the amount of point rewards pending for a user on a
     * given pool. Returns the pending reward point amount.
     * @param _poolId The address of a particular staking pool asset to check for a
     *   pending reward.
     * @param _user The user address to check for a pending reward.
     * @return the pending reward token amount.
     */
    function getPendingPoints(uint256 _poolId, address _user)
        public
        view
        returns (uint256)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolInfo memory pool = b.poolInfoV3[_poolId];
        StakerBlueprint.UserInfo memory user = b.userInfoV3[_poolId][_user];
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

    // /**
    //  * Return the number of points that the user has available to spend.
    //  * @param _user the user whose available points we want to get.
    //  * @return the number of points that the user has available to spend.
    //  */
    // function getAvailablePoints(address _user) public view returns (uint256) {
    //     StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
    //         .stakerStateVariables();

    //     uint256 pendingTotal;
    //     for (uint256 i; i < b.poolAssets.length; i++) {
    //         uint256 _pendingPoints = getPendingPoints(i, _user);
    //         pendingTotal += _pendingPoints;
    //     }
    //     return (b.userPoints[_user] + pendingTotal) - b.userSpentPoints[_user];
    // }

    /**
     * Return the total number of points that the user has ever accrued.
     * @param _user the user whose total points we want to get.
     * @return the total number of points that the user has ever accrued.
     */
    function getTotalPoints(address _user) external view returns (uint256) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        uint256 pendingTotal;
        for (uint256 i; i < b.poolAssets.length; i++) {
            uint256 _pendingPoints = getPendingPoints(i, _user);
            pendingTotal += _pendingPoints;
        }
        return b.userPoints[_user] + pendingTotal;
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

        // if (b.poolLocks[_poolId].length > b.lockIndex[_poolId]) {
        //     tokenUnlocks(_poolId);
        // }

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

    // /**
    //  * Private helper function that unlocks tokens and unboost amounts
    //  * @param _poolId id of pool at which we are unlocking tokens.
    //  */
    // function tokenUnlocks(uint256 _poolId) private {
    //     StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
    //         .stakerStateVariables();
    //     StakerBlueprint.PoolInfo storage pool = b.poolInfoV3[_poolId];
    //     uint256 tokensReward;
    //     uint256 pointsReward;
    //     for (
    //         uint256 i = b.lockIndex[_poolId];
    //         i < b.poolLocks[_poolId].length;
    //         i++
    //     ) {
    //         if (
    //             b.poolLocks[_poolId][i].lockedAt + pool.lockPeriod <
    //             block.timestamp
    //         ) {
    //             StakerBlueprint.UserInfo storage _user = b.userInfoV3[_poolId][
    //                 b.poolLocks[_poolId][i].lockedUser
    //             ];
    //             StakerBlueprint.ItemUserInfo storage staker = b.itemUserInfo[
    //                 b.poolLocks[_poolId][i].lockedUser
    //             ];

    //             ISuperGeneric(b.IOUTokenAddress).mintBatch(
    //                 b.poolLocks[_poolId][i].lockedUser,
    //                 staker.lockedItems[_poolId].lockedIOUIds,
    //                 ""
    //             );
    //             // clearing data for outdated locks
    //             staker.lockedItems[_poolId].lockedIOUIds = new uint256[](0);
    //             delete staker.lockedItems[_poolId].lockedAt;
    //             // calculating rewards for staker that has unlock his tokens

    //             tokensReward =
    //                 ((getTotalEmittedTokens(
    //                     pool.lastRewardEvent,
    //                     b.poolLocks[_poolId][i].lockedAt + pool.lockPeriod
    //                 ) * pool.tokenStrength) / b.totalTokenStrength) *
    //                 1e12;
    //             pointsReward =
    //                 ((getTotalEmittedPoints(
    //                     pool.lastRewardEvent,
    //                     b.poolLocks[_poolId][i].lockedAt + pool.lockPeriod
    //                 ) * pool.pointStrength) / b.totalPointStrength) *
    //                 1e30;

    //             (tokensReward, pointsReward) = sendDeveloperShares(
    //                 tokensReward,
    //                 pointsReward
    //             );

    //             pool.tokensPerShare += (tokensReward /
    //                 pool.tokenBoostedDeposit);
    //             pool.pointsPerShare += (pointsReward /
    //                 pool.pointBoostedDeposit);
    //             pool.lastRewardEvent =
    //                 b.poolLocks[_poolId][i].lockedAt +
    //                 pool.lockPeriod;

    //             delete b.poolLocks[_poolId][i];
    //             emit TokenUnlock(b.poolLocks[_poolId][i].lockedUser, _poolId);
    //             b.lockIndex[_poolId] = i + 1;

    //             _user.tokenRewards +=
    //                 (_user.tokenBoostedAmount * (pool.tokensPerShare)) /
    //                 1e12 -
    //                 _user.tokenPaid;
    //             _user.pointRewards +=
    //                 (_user.pointBoostedAmount * (pool.pointsPerShare)) /
    //                 1e30 -
    //                 _user.pointPaid;
    //             b.totalTokenDisbursed +=
    //                 (_user.tokenBoostedAmount * (pool.tokensPerShare)) /
    //                 1e12 -
    //                 _user.tokenPaid;

    //             // calculating totalStaked amount after unlock
    //             pool.tokenBoostedDeposit -= _user.tokenBoostedAmount;
    //             pool.pointBoostedDeposit -= _user.pointBoostedAmount;
    //             (
    //                 _user.tokenBoostedAmount,
    //                 _user.pointBoostedAmount
    //             ) = applyBoosts(_user.amount, _poolId);
    //             pool.tokenBoostedDeposit += _user.tokenBoostedAmount;
    //             pool.pointBoostedDeposit += _user.pointBoostedAmount;

    //             _user.tokenPaid =
    //                 (_user.tokenBoostedAmount * (pool.tokensPerShare)) /
    //                 1e12;
    //             _user.pointPaid =
    //                 (_user.pointBoostedAmount * (pool.pointsPerShare)) /
    //                 1e30;
    //         } else {
    //             break;
    //         }
    //     }
    // }

    /**
     * Private helper function to update the deposits based on new shares.
     * @param _ids base amount of the new boosted amounts.
     * @param _poolId the pool id, the deposit of which is to be updated.
     * @param _isDeposit flag that represents the caller function. True is for deposit,
     *   false is for withdraw.
     */
    function updateDeposits(
        uint256[] memory _ids,
        uint256 _poolId,
        bool _isDeposit
    ) internal {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolInfo storage _pool = b.poolInfoV3[_poolId];
        StakerBlueprint.UserInfo storage _user = b.userInfoV3[_poolId][
            msg.sender // ???????????
        ];
        bool isTiedToHolder = _pool.typeOfPool ==
            StakerBlueprint.PoolType.StakingTiedToHolder ||
            _pool.typeOfPool == StakerBlueprint.PoolType.NoStakingTiedToHolder;

        if (_user.amount > 0) {
            uint256 accamulatedPendingTokens;
            uint256 pendingTokens;
            uint256 pendingPoints;

            if (isTiedToHolder) {
                pendingTokens =
                    ((_user.tokenBoostedAmount * _pool.tokensPerShare) / 1e12) -
                    _user.tokenPaid;
                pendingPoints =
                    ((_user.pointBoostedAmount * _pool.pointsPerShare) / 1e30) -
                    _user.pointPaid;
                _user.tokenRewards += pendingTokens;
                _user.pointRewards += pendingPoints;
                accamulatedPendingTokens += pendingTokens;
            } else {
                for (uint256 i; i < _ids.length; i++) {
                    StakerBlueprint.RewardsTiedToNFT memory nftRewards = b
                        .NFTRewards[_poolId][_ids[i]];
                    pendingTokens =
                        ((nftRewards.shareOfTokenBoostedDeposited *
                            _pool.tokensPerShare) / 1e12) -
                        nftRewards.tokenPaid;
                    pendingPoints =
                        ((nftRewards.shareOfPointBoostedDeposited *
                            _pool.pointsPerShare) / 1e30) -
                        nftRewards.pointPaid;
                    nftRewards.accamulatedTokenRewards += pendingTokens;
                    nftRewards.accamulatedPointRewards += pendingPoints;

                    (
                        nftRewards.shareOfTokenBoostedDeposited,
                        nftRewards.shareOfPointBoostedDeposited
                    ) = applyBoosts(1000, _poolId);
                    accamulatedPendingTokens += pendingTokens;
                }
            }
            b.totalTokenDisbursed += accamulatedPendingTokens;
            _pool.tokenBoostedDeposit -= _user.tokenBoostedAmount;
            _pool.pointBoostedDeposit -= _user.pointBoostedAmount;
        }

        if (_isDeposit) {
            _user.amount += _ids.length * 1000;
        } else {
            _user.amount -= _ids.length * 1000;
        }

        (_user.tokenBoostedAmount, _user.pointBoostedAmount) = applyBoosts(
            _user.amount,
            _poolId
        );
        _pool.tokenBoostedDeposit += _user.tokenBoostedAmount;
        _pool.pointBoostedDeposit += _user.pointBoostedAmount;
        // _pool.tokenBoostedDeposit += IERC721(_pool.assetAddress).totalSupply();
        // _pool.pointBoostedDeposit += _user.pointBoostedAmount;

        if (isTiedToHolder) {
            _user.tokenPaid =
                (_user.tokenBoostedAmount * _pool.tokensPerShare) /
                1e12;
            _user.pointPaid =
                (_user.pointBoostedAmount * _pool.pointsPerShare) /
                1e30;
        } else {
            for (uint256 i; i < _ids.length; i++) {
                b.NFTRewards[_poolId][_ids[i]].tokenPaid =
                    (b
                    .NFTRewards[_poolId][_ids[i]].shareOfTokenBoostedDeposited *
                        _pool.tokensPerShare) /
                    1e12;
                b.NFTRewards[_poolId][_ids[i]].pointPaid =
                    (b
                    .NFTRewards[_poolId][_ids[i]].shareOfPointBoostedDeposited *
                        _pool.pointsPerShare) /
                    1e30;
            }
            // TODO: remove loops with division by number of nfts and add logic in claim functions
        }
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

        // if (_unboosted == 0) {
        //     return (0, 0);
        // } else if (staker.lockedItems[_poolId].lockedIOUIds.length == 0) {
        //     if (pool.boostInfo.length == 0) {
        //         return (_unboosted, _unboosted);
        //     } else if (staker.boosterIds.length() == 0) {
        //         return (_unboosted, _unboosted);
        //     }
        // }

        if (_unboosted == 0) {
            return (0, 0);
        }
        if (pool.boostInfo.length == 0) {
            return (_unboosted, _unboosted);
        }
        if (staker.boosterIds.length() == 0) {
            return (_unboosted, _unboosted);
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
        // if (staker.lockedItems[_poolId].lockedIOUIds.length != 0) {
        //     if (
        //         pool.timeLockTypeOfBoost ==
        //         StakerBlueprint.BoosterAssetType.Tokens
        //     ) {
        //         _boostedTokens += (_unboosted * pool.lockMultiplier) / 10000;
        //     } else if (
        //         pool.timeLockTypeOfBoost ==
        //         StakerBlueprint.BoosterAssetType.Points
        //     ) {
        //         _boostedPoints += (_unboosted * pool.lockMultiplier) / 10000;
        //     } else {
        //         _boostedTokens += (_unboosted * pool.lockMultiplier) / 10000;
        //         _boostedPoints += (_unboosted * pool.lockMultiplier) / 10000;
        //     }
        // }
    }

    /**
     * Deposit some particular assets to a particular pool on the Staker.
     * When asset for stake in the pool is ERC20, you should set input _asset's amounts
     * with length equal to 1(same for id length).
     * @param _poolId the pool id.
     * @param _asset asset user wants to deposit
     */
    function deposit(
        uint256 _poolId,
        StakerBlueprint.StakedAsset memory _asset,
        bool isLocking
    ) external {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolAssetType typeOfAsset;

        StakerBlueprint.PoolInfo memory pool = b.poolInfoV3[_poolId];

        if (
            pool.typeOfPool != StakerBlueprint.PoolType.StakingTiedToHolder &&
            pool.typeOfPool != StakerBlueprint.PoolType.StakingTiedToNFT
        ) {
            revert StakerBlueprint.InvalidTypeOfPool();
        }
        if (_asset.id.length != _asset.amounts.length) {
            revert StakerBlueprint.AssetArrayLengthsMismatch();
        }

        if (pool.tokenStrength == 0) {
            revert StakerBlueprint.InactivePool();
        }
        if (_asset.assetAddress != pool.assetAddress) {
            revert StakerBlueprint.InvalidAssetToStake();
        }
        if (pool.groupId > 0) {
            for (uint256 i; i < _asset.id.length; i++) {
                if (_asset.id[i] >> 128 != pool.groupId) {
                    // Wrong group item
                    revert StakerBlueprint.InvalidGroupIdForStake();
                }
            }
        }

        typeOfAsset = pool.typeOfAsset;
        uint256 amount;

        uint256[] memory IOUTokenIdsToMint = new uint256[](
            _asset.amounts.length
        );
        uint256 IOUTokenCounter = b.nextIOUTokenId;
        if (
            typeOfAsset == StakerBlueprint.PoolAssetType.ERC20 &&
            _asset.amounts.length != 1
        ) {
            revert StakerBlueprint.InvalidERC20DepositInputs();
        }
        for (uint256 i; i < _asset.amounts.length; i++) {
            amount += _asset.amounts[i];
            b.IOUIdToStakedAsset[_poolId][IOUTokenCounter].assetAddress = _asset
                .assetAddress;
            b.IOUIdToStakedAsset[_poolId][IOUTokenCounter].amounts.push(
                _asset.amounts[i]
            );
            b.IOUIdToStakedAsset[_poolId][IOUTokenCounter].id.push(
                _asset.id[i]
            );
            IOUTokenIdsToMint[i] = IOUTokenCounter;
            IOUTokenCounter++;
        }

        b.nextIOUTokenId = IOUTokenCounter;

        // if (isLocking) {
        //     StakerBlueprint.ItemUserInfo storage staker = b.itemUserInfo[
        //         msg.sender
        //     ];
        //     if (amount != pool.lockAmount) {
        //         revert StakerBlueprint.InvalidAmountToLock();
        //     }
        //     if (staker.lockedItems[_poolId].lockedIOUIds.length != 0) {
        //         revert StakerBlueprint.TokensAlreadyLocked();
        //     }
        //     staker.lockedItems[_poolId].lockedAt = block.timestamp;
        //     staker.lockedItems[_poolId].lockedIOUIds = IOUTokenIdsToMint;
        //     b.poolLocks[_poolId].push(
        //         StakerBlueprint.PoolLocks(block.timestamp, msg.sender)
        //     );
        //     emit TokenLock(msg.sender, _poolId, block.timestamp);
        // } else {
        //     ISuperGeneric(b.IOUTokenAddress).mintBatch(
        //         msg.sender,
        //         IOUTokenIdsToMint,
        //         ""
        //     );
        // }
        ISuperGeneric(b.IOUTokenAddress).mintBatch(
            msg.sender,
            IOUTokenIdsToMint,
            ""
        );
        updatePool(_poolId);
        updateDeposits(_asset.id, _poolId, true);

        emit Deposit(
            msg.sender,
            _poolId,
            _asset.amounts,
            _asset.id,
            pool.assetAddress
        );

        if (typeOfAsset == StakerBlueprint.PoolAssetType.ERC721) {
            for (uint256 i; i < _asset.amounts.length; i++) {
                // TODO: may be move this checks
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
        } else if (typeOfAsset == StakerBlueprint.PoolAssetType.ERC1155) {
            ISuperGeneric(_asset.assetAddress).safeBatchTransferFrom(
                msg.sender,
                address(this),
                _asset.id,
                _asset.amounts,
                ""
            );
        } else {
            IERC20(pool.assetAddress).safeTransferFrom(
                address(msg.sender),
                address(this),
                amount
            );
        }
    }

    /**
     * Withdraw some particular assets from a particular pool on the Staker.
     * @param _poolId the id of pool, withdraw tokens from.
     * @param IOUTokenIds array of IOU token ids bonded to which you want to withdraw.
     */
    function withdraw(uint256 _poolId, uint256[] calldata IOUTokenIds)
        external
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        if (
            b.poolInfoV3[_poolId].typeOfPool !=
            StakerBlueprint.PoolType.StakingTiedToHolder &&
            b.poolInfoV3[_poolId].typeOfPool !=
            StakerBlueprint.PoolType.StakingTiedToNFT
        ) {
            revert StakerBlueprint.InvalidTypeOfPool();
        }

        address assetAddress;
        StakerBlueprint.PoolAssetType typeOfAsset;

        // StakerBlueprint.ItemUserInfo storage staker = b.itemUserInfo[
        //     msg.sender
        // ];

        uint256 amount;
        // for (uint256 i; i < _asset.amounts.length; i++) {
        //     amount += _asset.amounts[i];
        // }
        // if (b.userInfoV3[_poolId][msg.sender].amount / 1000 < amount) {
        //     revert StakerBlueprint.InvalidAmount();
        // }

        assetAddress = b.poolInfoV3[_poolId].assetAddress;

        uint256[] memory amounts = new uint256[](IOUTokenIds.length);
        uint256[] memory ids = new uint256[](IOUTokenIds.length);

        updatePool(_poolId);

        // if (staker.lockedItems[_poolId].lockedIOUIds.length != 0) {
        //     uint256[] memory _lockedIOUIds = staker
        //         .lockedItems[_poolId]
        //         .lockedIOUIds;
        //     for (uint256 j; j < _lockedIOUIds.length; j++) {
        //         for (uint256 i; i < _asset.IOUTokenId.length; i++) {
        //             if (_asset.IOUTokenId[i] == _lockedIOUIds[j]) {
        //                 revert StakerBlueprint.TokenLocked();
        //             }
        //         }
        //     }
        // }
        for (uint256 i; i < amounts.length; i++) {
            if (
                ISuperGeneric(b.IOUTokenAddress).ownerOf(IOUTokenIds[i]) !=
                msg.sender
            ) {
                revert StakerBlueprint.NotAnOwnerOfIOUToken();
            }
            if (b.IOUIdToStakedAsset[_poolId][IOUTokenIds[i]].id.length == 0) {
                revert StakerBlueprint.IOUTokenFromDifferentPool();
            }
            ids[i] = b.IOUIdToStakedAsset[_poolId][IOUTokenIds[i]].id[0];
            amounts[i] = b.IOUIdToStakedAsset[_poolId][IOUTokenIds[i]].amounts[
                0
            ];
            amount += amounts[i];
        }
        typeOfAsset = b.poolInfoV3[_poolId].typeOfAsset;
        // TODO: IOU tokens should change shares at staking when transfered.
        updateDeposits(ids, _poolId, false);
        ISuperGeneric(b.IOUTokenAddress).burnBatch(msg.sender, IOUTokenIds);

        emit Withdraw(msg.sender, _poolId, amounts, ids, assetAddress);

        if (typeOfAsset == StakerBlueprint.PoolAssetType.ERC721) {
            ISuperGeneric(assetAddress).safeBatchTransferFrom(
                address(this),
                msg.sender,
                ids,
                ""
            );
        } else if (typeOfAsset == StakerBlueprint.PoolAssetType.ERC1155) {
            ISuperGeneric(assetAddress).safeBatchTransferFrom(
                address(this),
                msg.sender,
                ids,
                amounts,
                ""
            );
        } else {
            IERC20(assetAddress).safeTransfer(msg.sender, amount);
        }
    }

    /**
     * Claim accumulated token and point rewards from the Staker.
     * @param _poolId The id of pool to claim rewards from.
     * @param _data bytes with calldata for use by backend, casual users should send empty bytes array.
     */
    function claim(uint256 _poolId, bytes memory _data) external {
        if (_data.length == 0) {
            _claim(_poolId);
        } else {
            bytes32 _hash;
            StakerBlueprint.Sig memory _sig;
            StakerBlueprint.Checkpoint memory _checkpoints;

            (_hash, _sig, _checkpoints) = serializeClaimData(_data);
            _claim(_poolId, _hash, _sig, _checkpoints);
        }
    }

    /** Private helper function that serialize input data for claim with checkpoints.
     * @param _data bytes32 data that contains checkpoints and signature.
     * @return _hash data hash.
     * @return _sig struct that contains v,r and s parts of signature.
     * @return _checkpoints struct that contains info about balance of user at certain amounts of time.
     */
    function serializeClaimData(bytes memory _data)
        private
        pure
        returns (
            bytes32 _hash,
            StakerBlueprint.Sig memory _sig,
            StakerBlueprint.Checkpoint memory _checkpoints
        )
    {
        uint8 _v;
        bytes32 _r;
        bytes32 _s;
        uint256 checkpointsLength;

        assembly {
            _hash := mload(add(_data, 32))
            _v := mload(add(_data, 64))
            _r := mload(add(_data, 96))
            _s := mload(add(_data, 128))
            checkpointsLength := mload(add(_data, 160))
        }

        uint256[] memory _startTime = new uint256[](checkpointsLength);
        uint256[] memory _endTime = new uint256[](checkpointsLength);
        uint256[] memory _balance = new uint256[](checkpointsLength);
        uint256 oldCounter = 192;
        uint256 counter = oldCounter;
        for (
            counter;
            counter < 32 * checkpointsLength + oldCounter;
            counter += 32
        ) {
            uint256 localCounter = counter - oldCounter + 32;
            assembly {
                mstore(
                    add(_startTime, localCounter),
                    mload(add(_data, counter))
                )
            }
        }
        oldCounter = counter;
        for (
            counter;
            counter < 32 * checkpointsLength + oldCounter;
            counter += 32
        ) {
            uint256 localCounter = counter - oldCounter + 32;
            assembly {
                mstore(add(_endTime, localCounter), mload(add(_data, counter)))
            }
        }

        oldCounter = counter;
        for (
            counter;
            counter < 32 * checkpointsLength + oldCounter;
            counter += 32
        ) {
            uint256 localCounter = counter - oldCounter + 32;
            assembly {
                mstore(add(_balance, localCounter), mload(add(_data, counter)))
            }
        }

        _sig.v = _v;
        _sig.r = _r;
        _sig.s = _s;
        _checkpoints.startTime = _startTime;
        _checkpoints.endTime = _endTime;
        _checkpoints.balance = _balance;
    }

    /**
     * Claim accumulated token and point rewards from the Staker.
     * @param _poolId The id of pool to claim rewards from.
     */
    function _claim(uint256 _poolId) internal {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.UserInfo storage user = b.userInfoV3[_poolId][
            msg.sender
        ];
        StakerBlueprint.PoolInfo storage pool = b.poolInfoV3[_poolId];
        uint256 pendingTokens;
        uint256 pendingPoints;
        uint256 _tokenRewards;
        uint256 _pointRewards;

        updatePool(_poolId);
        if (user.amount > 0) {
            pendingTokens =
                ((user.tokenBoostedAmount * pool.tokensPerShare) / 1e12) -
                user.tokenPaid;
            pendingPoints =
                ((user.pointBoostedAmount * pool.pointsPerShare) / 1e30) -
                user.pointPaid;
            b.totalTokenDisbursed = b.totalTokenDisbursed + pendingTokens;
            _tokenRewards = user.tokenRewards + pendingTokens;
            _pointRewards = user.pointRewards + pendingPoints;

            // (_tokenRewards, _pointRewards) = compoundCalc(
            //     _tokenRewards,
            //     _pointRewards,
            //     pool
            // );
            IERC20(b.token).safeTransfer(msg.sender, _tokenRewards);
            b.userPoints[msg.sender] = b.userPoints[msg.sender] + _pointRewards;

            user.tokenPaid = ((user.tokenBoostedAmount * pool.tokensPerShare) /
                1e12);
            user.pointPaid = ((user.pointBoostedAmount * pool.pointsPerShare) /
                1e30);
        } else {
            IERC20(b.token).safeTransfer(msg.sender, user.tokenRewards);
        }
        user.tokenRewards = 0;
        user.pointRewards = 0;

        emit Claim(msg.sender, _poolId, _tokenRewards, _pointRewards);
    }

    /**
     * Claim accumulated token and point rewards from the Staker.
     * @param _poolId The id of pool to claim rewards from.
     * @param _sig structure that contains v,r,s parameters of signature.
     * @param _checkpoints structure that contains info about balance of user at certain periods.
     */
    function _claim(
        uint256 _poolId,
        bytes32 _hash,
        StakerBlueprint.Sig memory _sig,
        StakerBlueprint.Checkpoint memory _checkpoints
    ) internal {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.UserInfo storage user = b.userInfoV3[_poolId][
            msg.sender
        ];
        StakerBlueprint.PoolInfo storage pool = b.poolInfoV3[_poolId];

        uint256 pendingTokens;
        uint256 pendingPoints;

        bytes32 messageDigest = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", _hash)
        );

        if (b.admin != ecrecover(messageDigest, _sig.v, _sig.r, _sig.s)) {
            revert StakerBlueprint.NotAnAdmin();
        }

        if (
            keccak256(
                abi.encodePacked(
                    keccak256(abi.encodePacked(_checkpoints.startTime)),
                    keccak256(abi.encodePacked(_checkpoints.endTime)),
                    keccak256(abi.encodePacked(_checkpoints.balance))
                )
            ) != _hash
        ) {
            revert StakerBlueprint.MismatchArgumentsAndHash();
        }

        if (b.hashes[_hash]) {
            revert StakerBlueprint.HashUsed();
        }

        for (uint256 i; i < _checkpoints.startTime.length; i++) {
            pendingTokens += (
                ((_checkpoints.balance[i] * pool.tokensPerShare) / 1e12)
            );
            pendingPoints += (
                ((_checkpoints.balance[i] * pool.pointsPerShare) / 1e30)
            );

            // TODO: user.tokenPaid maybe should calculate here.
        }
        pendingTokens -= user.tokenPaid;
        pendingPoints -= user.pointPaid;
        b.totalTokenDisbursed = b.totalTokenDisbursed + pendingTokens;

        uint256 _tokenRewards = user.tokenRewards + pendingTokens;
        uint256 _pointRewards = user.pointRewards + pendingPoints;
        // (_tokenRewards, _pointRewards) = compoundCalc(
        //     _tokenRewards,
        //     _pointRewards,
        //     pool
        // );
        IERC20(b.token).safeTransfer(msg.sender, _tokenRewards);
        b.userPoints[msg.sender] += _pointRewards;
        user.tokenRewards = 0;
        user.pointRewards = 0;
        b.hashes[_hash] = true;
        user.tokenPaid += pendingTokens;
        user.pointPaid += pendingPoints;
        emit Claim(msg.sender, _poolId, _tokenRewards, _pointRewards);
    }

    // /**
    //  * Private helper function for calculate rewards for compound interest
    //  * @param tokenRewards current token rewards that user should claim
    //  * @param pointRewards curent point rewards that user should claim
    //  * @return bossted amount of token and point rewards by compounding interest
    //  */
    // function compoundCalc(
    //     uint256 tokenRewards,
    //     uint256 pointRewards,
    //     StakerBlueprint.PoolInfo storage pool
    // ) private view returns (uint256, uint256) {
    //     if (tokenRewards > pool.compoundInterestThreshold) {
    //         if (
    //             pool.compoundTypeOfBoost ==
    //             StakerBlueprint.BoosterAssetType.Tokens ||
    //             pool.compoundTypeOfBoost ==
    //             StakerBlueprint.BoosterAssetType.Both
    //         ) {
    //             tokenRewards +=
    //                 ((tokenRewards - pool.compoundInterestThreshold) *
    //                     pool.compoundInterestMultiplier) /
    //                 10000;
    //         }
    //     }
    //     if (pointRewards > pool.compoundInterestThreshold) {
    //         if (
    //             pool.compoundTypeOfBoost ==
    //             StakerBlueprint.BoosterAssetType.Points ||
    //             pool.compoundTypeOfBoost ==
    //             StakerBlueprint.BoosterAssetType.Both
    //         ) {
    //             pointRewards +=
    //                 ((pointRewards - pool.compoundInterestThreshold) *
    //                     pool.compoundInterestMultiplier) /
    //                 10000;
    //         }
    //     }
    //     return (tokenRewards, pointRewards);
    // }
}
