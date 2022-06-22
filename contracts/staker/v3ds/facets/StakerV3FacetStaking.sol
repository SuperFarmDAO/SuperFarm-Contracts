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
     * @param _fromTime The time to begin calculating emissions from.
     * @param _toTime The time to calculate total emissions up to.
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
        for (uint256 i; i < b.tokenEmissionEventsCount; ) {
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
            unchecked {
                ++i;
            }
        }
        totalEmittedTokens += ((_toTime - workingTime) * workingRate);
        return totalEmittedTokens;
    }

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
     * A function to easily see the amount of token rewards pending for a user on a
     * given pool. Returns the pending reward token amount.
     * @param _poolId The id of a particular staking pool asset to check for a
     *   pending reward.
     * @param _user The user address to check for a pending reward.
     * @return The pending reward token amount.
     */
    function getPendingTokens(uint256 _poolId, address _user)
        public
        view
        returns (uint256)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolInfo storage pool = b.poolInfoV3[_poolId];
        StakerBlueprint.UserInfo storage user = b.userInfoV3[_poolId][_user];
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
     * @return The pending reward token amount.
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

    /**
     * Update the pool corresponding to the specified token address.
     * @param _poolId The id of pool to update the corresponding pool for.
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
     * @param tokensReward Amount of tokens that available as rewards.
     * @param pointsReward Amount of points that available as rewards.
     */
    function sendDeveloperShares(uint256 tokensReward, uint256 pointsReward)
        internal
        returns (uint256, uint256)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();
        for (uint256 i; i < b.developerAddresses.length(); ) {
            address developer = b.developerAddresses.at(i);
            uint256 share = b.developerShares[developer];
            uint256 devTokens = (tokensReward * share) / 100_000;
            tokensReward -= devTokens;
            uint256 devPoints = (pointsReward * share) / 100_000;
            pointsReward -= devPoints;
            // TODO: think about not perform the transfer in 'updatePool' function
            //          but store developers rewards in mapping.
            IERC20(b.token).safeTransfer(developer, devTokens / 1e12);
            b.userPoints[developer] += (devPoints / 1e30);
            unchecked {
                ++i;
            }
        }
        return (tokensReward, pointsReward);
    }

    /**
     * Private helper function to update the deposits based on new shares.
     * @param _ids Array of token ids that was deposited.
     * @param _ids Array of amounts of tokens that was deposited.
     * @param _poolId Id of the pool, in which we are operating.
     * @param _isDeposit Flag that represents the caller function. True is for deposit,
     *   false is for withdraw.
     */
    function updateDeposits(
        uint256[] memory _ids,
        uint256 _amount,
        uint256 _poolId,
        bool _isDeposit,
        address _staker
    ) internal {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolInfo storage _pool = b.poolInfoV3[_poolId];
        StakerBlueprint.UserInfo storage _user = b.userInfoV3[_poolId][_staker];

        uint256 accamulatedPendingTokens;
        uint256 pendingTokens;
        uint256 pendingPoints;

        // check if booster was changed
        // TODO: think about case in pools with RewardsTiedToNFT
        checkOnBoostersChanged(_user.amount, _poolId, _staker);

        // isTiedToHolder
        if (
            _pool.typeOfPool == StakerBlueprint.PoolType.StakingTiedToHolder ||
            _pool.typeOfPool == StakerBlueprint.PoolType.NoStakingTiedToHolder
        ) {
            if (_user.amount > 0) {
                pendingTokens =
                    ((_user.tokenBoostedAmount * _pool.tokensPerShare) / 1e12) -
                    _user.tokenPaid;
                pendingPoints =
                    ((_user.pointBoostedAmount * _pool.pointsPerShare) / 1e30) -
                    _user.pointPaid;
                _user.tokenRewards += pendingTokens;
                _user.pointRewards += pendingPoints;
                accamulatedPendingTokens += pendingTokens;
                _pool.tokenBoostedDeposit -= _user.tokenBoostedAmount;
                _pool.pointBoostedDeposit -= _user.pointBoostedAmount;
            }

            // Preventing stack too deep.
            {
                // Extra multiplier for ERC721 and ERC1155 to make calculations
                // more accurate.
                uint256 nftMul = 1_000;
                if (_pool.typeOfAsset == StakerBlueprint.AssetType.ERC20) {
                    nftMul = 1;
                }
                if (_isDeposit) {
                    _user.amount += _amount * nftMul;
                } else {
                    _user.amount -= _amount * nftMul;
                }
            }

            (_user.tokenBoostedAmount, _user.pointBoostedAmount) = applyBoosts(
                _user.amount,
                _poolId,
                _staker,
                _isDeposit,
                _ids.length
            );
            _pool.tokenBoostedDeposit += _user.tokenBoostedAmount;
            _pool.pointBoostedDeposit += _user.pointBoostedAmount;

            _user.tokenPaid =
                (_user.tokenBoostedAmount * _pool.tokensPerShare) /
                1e12;
            _user.pointPaid =
                (_user.pointBoostedAmount * _pool.pointsPerShare) /
                1e30;
        } else {
            // TODO: think about to remove loops with whole users rewards divisioned
            // by number of nfts and add logic in claim functions
            uint256 length = _ids.length;
            for (uint256 i; i < length; ) {
                _user.asset.id.push(_ids[i]);
                StakerBlueprint.RewardsTiedToNFT storage nftRewards = b
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
                _pool.tokenBoostedDeposit -= nftRewards
                    .shareOfTokenBoostedDeposited;
                _pool.pointBoostedDeposit -= nftRewards
                    .shareOfPointBoostedDeposited;

                (
                    nftRewards.shareOfTokenBoostedDeposited,
                    nftRewards.shareOfPointBoostedDeposited
                ) = applyBoosts(1_000, _poolId, _staker, _isDeposit, 1);
                if (_isDeposit) {
                    _pool.tokenBoostedDeposit += nftRewards
                        .shareOfTokenBoostedDeposited;
                    _pool.pointBoostedDeposit += nftRewards
                        .shareOfPointBoostedDeposited;
                    accamulatedPendingTokens += pendingTokens;
                } else {
                    delete nftRewards.shareOfTokenBoostedDeposited;
                    delete nftRewards.shareOfPointBoostedDeposited;
                }

                nftRewards.tokenPaid =
                    (nftRewards.shareOfTokenBoostedDeposited *
                        _pool.tokensPerShare) /
                    1e12;
                nftRewards.pointPaid =
                    (nftRewards.shareOfPointBoostedDeposited *
                        _pool.pointsPerShare) /
                    1e30;
                unchecked {
                    ++i;
                }
            }
        }
        b.totalTokenDisbursed += accamulatedPendingTokens;
    }

    /**
     * Function that executes when IOU token is transerring and recalculate
     * shares on staker of previus and new owners of token.
     * @param _poolId Id of the pool that IOU token links to.
     * @param _tokenId The ID of the token being transferred.
     * @param _from The address to transfer the token from.
     * @param _to The address to transfer the token to.
     */
    function updateOnIouTransfer(
        uint256 _poolId,
        uint256 _tokenId,
        address _from,
        address _to
    ) external {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        uint256[] memory id = new uint256[](1);
        id[0] = b.IOUIdToStakedAsset[_poolId][_tokenId].id[0];
        uint256 totalAmount;
        for (
            uint256 i;
            i < b.IOUIdToStakedAsset[_poolId][_tokenId].amounts.length;

        ) {
            totalAmount += b.IOUIdToStakedAsset[_poolId][_tokenId].amounts[i];
            unchecked {
                ++i;
            }
        }
        updatePool(_poolId);
        updateDeposits(id, totalAmount, _poolId, false, _from);
        updateDeposits(id, totalAmount, _poolId, true, _to);
    }

    /**
     * Private helper function that applies boosts on deposits for Item staking.
     * (amount * multiplier ) / 10_000, where multiplier is in basis points.
     * (20 * 20_000) / 10_000 = 40 => 2x boost
     * @param _unboosted Value that needs to have boosts applied to.
     * @param _poolId Id of the pool.
     * @return _boostedTokens Return tokens with applied boosts.
     * @return _boostedPoints Return points with applied boosts.
     */
    function applyBoosts(
        uint256 _unboosted,
        uint256 _poolId,
        address _staker,
        bool isDeposit,
        uint256 _changedValue
    ) internal returns (uint256 _boostedTokens, uint256 _boostedPoints) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolInfo storage pool = b.poolInfoV3[_poolId];
        StakerBlueprint.ItemUserInfo storage staker = b.itemUserInfo[_staker];

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
        for (uint256 i; i < pool.boostInfo.length; ) {
            if (staker.boosterIds.contains(pool.boostInfo[i])) {
                StakerBlueprint.BoostInfo storage booster = b.boostInfo[
                    pool.boostInfo[i]
                ];

                // Calculate boosted amount of certain boost for handle booster change cases.
                // Also preventing stack too deep.
                {
                    // Extra multiplier for ERC721 and ERC1155 tokens to make calculations
                    // more accurate.
                    uint256 nftMul = 1_000;
                    if (pool.typeOfAsset == StakerBlueprint.AssetType.ERC20) {
                        nftMul = 1;
                    }
                    if (isDeposit) {
                        b.boosterAmount[_poolId][pool.boostInfo[i]] +=
                            _changedValue *
                            nftMul;
                    } else {
                        b.boosterAmount[_poolId][pool.boostInfo[i]] -=
                            _changedValue *
                            nftMul;
                    }
                }
                if (
                    booster.boostType == StakerBlueprint.BoosterAssetType.Tokens
                ) {
                    _boostedTokens +=
                        (_unboosted * booster.multiplier) /
                        10_000;
                } else if (
                    booster.boostType == StakerBlueprint.BoosterAssetType.Points
                ) {
                    _boostedPoints +=
                        (_unboosted * booster.multiplier) /
                        10_000;
                } else {
                    _boostedTokens +=
                        (_unboosted * booster.multiplier) /
                        10_000;
                    _boostedPoints +=
                        (_unboosted * booster.multiplier) /
                        10_000;
                }
            }
            unchecked {
                ++i;
            }
        }
    }

    /**
     * Function that handles recalc of shares and rewards if
     * some of booster multipliers that applied to user's share
     * have changed.
     * @param _unboosted Unboosted amount of tokens that user have staked.
     * @param _poolId Id of the pool.
     * @param _staker Address of user which staked tokens.
     */
    function checkOnBoostersChanged(
        uint256 _unboosted,
        uint256 _poolId,
        address _staker
    ) internal {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolInfo storage pool = b.poolInfoV3[_poolId];
        StakerBlueprint.ItemUserInfo storage staker = b.itemUserInfo[_staker];

        if (_unboosted == 0) {
            return;
        }
        if (pool.boostInfo.length == 0) {
            return;
        }
        if (staker.boosterIds.length() == 0) {
            return;
        }

        for (uint256 i; i < pool.boostInfo.length; ) {
            if (staker.boosterIds.contains(pool.boostInfo[i])) {
                StakerBlueprint.BoostInfo storage booster = b.boostInfo[
                    pool.boostInfo[i]
                ];

                uint256 _tokenMissed;
                uint256 _tokenGained;
                uint256 _pointMissed;
                uint256 _pointGained;
                for (
                    uint256 j = staker.lastNumberOfBoosterUpdate[
                        pool.boostInfo[i]
                    ];
                    j < b.tpsOnBoostUpdate[pool.boostInfo[i]][_poolId].length;
                    j++
                ) {
                    uint256 changedMul;
                    if (
                        j + 1 ==
                        b.tpsOnBoostUpdate[pool.boostInfo[i]][_poolId].length
                    ) {
                        changedMul = booster.multiplier;
                    } else {
                        changedMul = booster.historyOfTokenMultipliers[j + 1];
                    }

                    if (
                        j + 1 ==
                        b.tpsOnBoostUpdate[pool.boostInfo[i]][_poolId].length &&
                        booster.boostType ==
                        StakerBlueprint.BoosterAssetType.Points
                    ) {
                        changedMul = 0;
                    }
                    if (changedMul > booster.historyOfTokenMultipliers[j]) {
                        _tokenMissed += (
                            (b.tpsOnBoostUpdate[pool.boostInfo[i]][_poolId][j] *
                                ((_unboosted *
                                    (changedMul -
                                        booster.historyOfTokenMultipliers[j])) /
                                    10_000))
                        );
                    } else {
                        _tokenGained += (
                            (b.tpsOnBoostUpdate[pool.boostInfo[i]][_poolId][j] *
                                ((_unboosted *
                                    (booster.historyOfTokenMultipliers[j] -
                                        changedMul)) / 10_000))
                        );
                    }

                    if (
                        j + 1 ==
                        b.tpsOnBoostUpdate[pool.boostInfo[i]][_poolId].length &&
                        booster.boostType !=
                        StakerBlueprint.BoosterAssetType.Tokens
                    ) {
                        changedMul = booster.multiplier;
                    }
                    if (changedMul > booster.historyOfTokenMultipliers[j]) {
                        _pointMissed += (
                            (b.ppsOnBoostUpdate[pool.boostInfo[i]][_poolId][j] *
                                ((_unboosted *
                                    (changedMul -
                                        booster.historyOfPointMultipliers[j])) /
                                    10_000))
                        );
                    } else {
                        _pointGained += (
                            (b.ppsOnBoostUpdate[pool.boostInfo[i]][_poolId][j] *
                                ((_unboosted *
                                    (booster.historyOfPointMultipliers[j] -
                                        changedMul)) / 10_000))
                        );
                    }
                }

                staker.lastNumberOfBoosterUpdate[pool.boostInfo[i]] = b
                .tpsOnBoostUpdate[pool.boostInfo[i]][_poolId].length;
                StakerBlueprint.UserInfo storage _user = b.userInfoV3[_poolId][
                    _staker
                ];

                if (_tokenMissed > _tokenGained) {
                    _user.tokenPaid += (_tokenMissed - _tokenGained) / 1e12;
                } else {
                    if (_tokenGained / 1e12 < _user.tokenPaid) {
                        _user.tokenPaid -= _tokenGained / 1e12;
                    }
                }
                if (_pointMissed > _pointGained) {
                    _user.pointPaid += (_pointMissed - _pointGained) / 1e30;
                } else {
                    if (_pointGained / 1e30 < _user.pointPaid) {
                        _user.pointPaid -= _pointGained / 1e30;
                    }
                }
            }
            unchecked {
                ++i;
            }
        }

        (
            b.userInfoV3[_poolId][_staker].tokenBoostedAmount,
            b.userInfoV3[_poolId][_staker].pointBoostedAmount
        ) = applyBoosts(_unboosted, _poolId, _staker, false, 0);
    }

    /**
     * Deposit some particular assets to a particular pool on the Staker.
     * When asset for stake in the pool is ERC20, you should set input _asset's amounts
     * with length equal to 1(same for id length).
     * @param _poolId The pool id.
     * @param _asset Asset user wants to deposit
     */
    function deposit(
        uint256 _poolId,
        StakerBlueprint.StakedAsset memory _asset,
        bool isLocking
    ) external {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.AssetType typeOfAsset;

        StakerBlueprint.PoolInfo storage pool = b.poolInfoV3[_poolId];

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
            for (uint256 i; i < _asset.id.length; ) {
                if (_asset.id[i] >> 128 != pool.groupId) {
                    revert StakerBlueprint.InvalidGroupIdForStake();
                }
                unchecked {
                    ++i;
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
            typeOfAsset == StakerBlueprint.AssetType.ERC20 &&
            _asset.amounts.length != 1
        ) {
            revert StakerBlueprint.InvalidERC20DepositInputs();
        }
        for (uint256 i; i < _asset.amounts.length; ) {
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
            unchecked {
                ++IOUTokenCounter;
                ++i;
            }
        }

        b.nextIOUTokenId = IOUTokenCounter;

        ISuperGeneric(b.IOUTokenAddress).mintBatch(
            msg.sender,
            IOUTokenIdsToMint,
            ""
        );
        updatePool(_poolId);
        updateDeposits(_asset.id, amount, _poolId, true, msg.sender);

        if (typeOfAsset == StakerBlueprint.AssetType.ERC721) {
            for (uint256 i; i < _asset.amounts.length; ) {
                if (_asset.amounts[i] != 1) {
                    revert StakerBlueprint.InvalidERC721Amount();
                }
                unchecked {
                    ++i;
                }
            }
            ISuperGeneric(_asset.assetAddress).safeBatchTransferFrom(
                msg.sender,
                address(this),
                _asset.id,
                ""
            );
        } else if (typeOfAsset == StakerBlueprint.AssetType.ERC1155) {
            ISuperGeneric(_asset.assetAddress).safeBatchTransferFrom(
                msg.sender,
                address(this),
                _asset.id,
                _asset.amounts,
                ""
            );
        } else {
            IERC20(pool.assetAddress).safeTransferFrom(
                msg.sender,
                address(this),
                amount
            );
        }

        emit Deposit(
            msg.sender,
            _poolId,
            _asset.amounts,
            _asset.id,
            pool.assetAddress
        );
    }

    /**
     * Withdraw some particular assets from a particular pool on the Staker.
     * @param _poolId The id of pool, withdraw tokens from.
     * @param IOUTokenIds Array of IOU token ids bonded to which you want to withdraw.
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
        StakerBlueprint.AssetType typeOfAsset;

        uint256 amount;

        assetAddress = b.poolInfoV3[_poolId].assetAddress;

        uint256[] memory amounts = new uint256[](IOUTokenIds.length);
        uint256[] memory ids = new uint256[](IOUTokenIds.length);

        updatePool(_poolId);

        for (uint256 i; i < amounts.length; ) {
            if (
                ISuperGeneric(b.IOUTokenAddress).ownerOf(IOUTokenIds[i]) !=
                msg.sender
            ) {
                revert StakerBlueprint.NotAnOwnerOfIOUToken();
            }
            // TODO: try to redesign the 'IOUIdToStakedAsset' mapping by erase
            //      unneceassary key '_poolID', and maybe erase 'poolId' from input
            //      of 'withdraw' function if we gonna withdraw via IOU tokens.
            if (b.IOUIdToStakedAsset[_poolId][IOUTokenIds[i]].id.length == 0) {
                revert StakerBlueprint.IOUTokenFromDifferentPool();
            }
            ids[i] = b.IOUIdToStakedAsset[_poolId][IOUTokenIds[i]].id[0];
            amounts[i] = b.IOUIdToStakedAsset[_poolId][IOUTokenIds[i]].amounts[
                0
            ];
            unchecked {
                amount += amounts[i];
                ++i;
            }
        }
        typeOfAsset = b.poolInfoV3[_poolId].typeOfAsset;

        updateDeposits(ids, amount, _poolId, false, msg.sender);
        ISuperGeneric(b.IOUTokenAddress).burnBatch(msg.sender, IOUTokenIds);

        if (typeOfAsset == StakerBlueprint.AssetType.ERC721) {
            ISuperGeneric(assetAddress).safeBatchTransferFrom(
                address(this),
                msg.sender,
                ids,
                ""
            );
        } else if (typeOfAsset == StakerBlueprint.AssetType.ERC1155) {
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
        emit Withdraw(msg.sender, _poolId, amounts, ids, assetAddress);
    }

    /**
     * Claim accumulated token and point rewards from the Staker.
     * @param _poolId The id of pool to claim rewards from.
     * @param _data Bytes with calldata for use by backend, casual users should send empty bytes array.
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
     * @param _data Bytes32 data that contains checkpoints and signature.
     * @return _hash Data hash.
     * @return _sig Struct that contains v,r and s parts of signature.
     * @return _checkpoints Struct that contains info about balance of user at certain amounts of time.
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
        uint256[] memory _tokensBalance = new uint256[](checkpointsLength);
        uint256[] memory _pointsBalance = new uint256[](checkpointsLength);
        uint256[] memory _tps = new uint256[](checkpointsLength);
        uint256[] memory _pps = new uint256[](checkpointsLength);
        uint256 oldPointer = 192;

        oldPointer = parseCheckpointsArray(
            _data,
            oldPointer,
            checkpointsLength,
            _startTime
        );
        oldPointer = parseCheckpointsArray(
            _data,
            oldPointer,
            checkpointsLength,
            _endTime
        );
        oldPointer = parseCheckpointsArray(
            _data,
            oldPointer,
            checkpointsLength,
            _tokensBalance
        );
        oldPointer = parseCheckpointsArray(
            _data,
            oldPointer,
            checkpointsLength,
            _pointsBalance
        );
        oldPointer = parseCheckpointsArray(
            _data,
            oldPointer,
            checkpointsLength,
            _tps
        );
        oldPointer = parseCheckpointsArray(
            _data,
            oldPointer,
            checkpointsLength,
            _pps
        );

        _sig.v = _v;
        _sig.r = _r;
        _sig.s = _s;
        _checkpoints.startTime = _startTime;
        _checkpoints.endTime = _endTime;
        _checkpoints.tokensBalance = _tokensBalance;
        _checkpoints.pointsBalance = _pointsBalance;
        _checkpoints.tokensPerShare = _tps;
        _checkpoints.pointsPerShare = _pps;
    }

    /**
     * Helper function that parsing input data and store in memory array with known
     * length
     * @param data Input bytes array that should be parsed.
     * @param pointer Pointer to start byte of 'data; for parse.
     * @param arrayLength Known length of array.
     * @param output Pointer to memory slot where we should store the array.
     */
    function parseCheckpointsArray(
        bytes memory data,
        uint256 pointer,
        uint256 arrayLength,
        uint256[] memory output
    ) internal pure returns (uint256) {
        uint256 oldPointer = pointer;
        for (pointer; pointer < 32 * arrayLength + oldPointer; pointer += 32) {
            uint256 localPointer = pointer - oldPointer + 32;
            assembly {
                mstore(add(output, localPointer), mload(add(data, pointer)))
            }
        }
        return pointer;
    }

    /**
     * Claim accumulated token and point rewards from the Staker.
     * @param _poolId The id of pool to claim rewards from.
     */
    function _claim(uint256 _poolId) internal {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.UserInfo storage _user = b.userInfoV3[_poolId][
            msg.sender
        ];
        StakerBlueprint.PoolInfo storage _pool = b.poolInfoV3[_poolId];
        uint256 pendingTokens;
        uint256 pendingPoints;
        uint256 _tokenRewards;
        uint256 _pointRewards;
        uint256 accamulatedPendingTokens;
        uint256 accamulatedPendingPoints;

        checkOnBoostersChanged(_user.amount, _poolId, msg.sender);
        updatePool(_poolId);
        bool isTiedToHolder = _pool.typeOfPool ==
            StakerBlueprint.PoolType.StakingTiedToHolder ||
            _pool.typeOfPool == StakerBlueprint.PoolType.NoStakingTiedToHolder;
        if (isTiedToHolder) {
            if (_user.amount > 0) {
                pendingTokens =
                    ((_user.tokenBoostedAmount * _pool.tokensPerShare) / 1e12) -
                    _user.tokenPaid;
                pendingPoints =
                    ((_user.pointBoostedAmount * _pool.pointsPerShare) / 1e30) -
                    _user.pointPaid;
                _tokenRewards = _user.tokenRewards + pendingTokens;
                _pointRewards = _user.pointRewards + pendingPoints;
                accamulatedPendingTokens += pendingTokens;
                IERC20(b.token).safeTransfer(msg.sender, _tokenRewards);
                b.userPoints[msg.sender] =
                    b.userPoints[msg.sender] +
                    _pointRewards;

                _user.tokenPaid =
                    (_user.tokenBoostedAmount * _pool.tokensPerShare) /
                    1e12;
                _user.pointPaid =
                    (_user.pointBoostedAmount * _pool.pointsPerShare) /
                    1e30;
            } else {
                IERC20(b.token).safeTransfer(msg.sender, _user.tokenRewards);
            }
            _user.tokenRewards = 0;
            _user.pointRewards = 0;
        } else {
            // TODO: think about to remove loops with whole users rewards divisioned
            // by number of nfts and add logic in claim functions
            for (uint256 i; i < _user.asset.id.length; ) {
                _user.asset.id.push(_user.asset.id[i]);
                StakerBlueprint.RewardsTiedToNFT storage nftRewards = b
                    .NFTRewards[_poolId][_user.asset.id[i]];
                pendingTokens =
                    ((nftRewards.shareOfTokenBoostedDeposited *
                        _pool.tokensPerShare) / 1e12) -
                    nftRewards.tokenPaid;
                pendingPoints =
                    ((nftRewards.shareOfPointBoostedDeposited *
                        _pool.pointsPerShare) / 1e30) -
                    nftRewards.pointPaid;
                _tokenRewards =
                    nftRewards.accamulatedTokenRewards +
                    pendingTokens;
                _pointRewards =
                    nftRewards.accamulatedPointRewards +
                    pendingPoints;
                accamulatedPendingTokens += _tokenRewards;
                accamulatedPendingPoints += _pointRewards;

                nftRewards.tokenPaid =
                    (nftRewards.shareOfTokenBoostedDeposited *
                        _pool.tokensPerShare) /
                    1e12;
                nftRewards.pointPaid =
                    (nftRewards.shareOfPointBoostedDeposited *
                        _pool.pointsPerShare) /
                    1e30;

                nftRewards.accamulatedTokenRewards = 0;
                nftRewards.accamulatedPointRewards = 0;
                unchecked {
                    ++i;
                }
            }
            IERC20(b.token).safeTransfer(msg.sender, accamulatedPendingTokens);
            b.userPoints[msg.sender] =
                b.userPoints[msg.sender] +
                accamulatedPendingPoints;
        }
        b.totalTokenDisbursed += accamulatedPendingTokens;
        emit Claim(
            msg.sender,
            _poolId,
            accamulatedPendingTokens,
            accamulatedPendingPoints
        );
    }

    /**
     * Claim accumulated token and point rewards from the Staker.
     * @param _poolId The id of pool to claim rewards from.
     * @param _sig Structure that contains v,r,s parameters of signature.
     * @param _checkpoints Structure that contains info about balance of user at certain periods.
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
        // StakerBlueprint.PoolInfo storage pool = b.poolInfoV3[_poolId];

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
                    keccak256(abi.encodePacked(_checkpoints.tokensBalance)),
                    keccak256(abi.encodePacked(_checkpoints.pointsBalance)),
                    keccak256(abi.encodePacked(_checkpoints.tokensPerShare)),
                    keccak256(abi.encodePacked(_checkpoints.pointsPerShare))
                )
            ) != _hash
        ) {
            revert StakerBlueprint.MismatchArgumentsAndHash();
        }

        if (b.hashes[_hash]) {
            revert StakerBlueprint.HashUsed();
        }

        for (uint256 i; i < _checkpoints.startTime.length; ) {
            pendingTokens +=
                (
                    ((_checkpoints.tokensBalance[i] *
                        _checkpoints.tokensPerShare[i]) / 1e12)
                ) -
                user.tokenPaid;
            pendingPoints +=
                (
                    ((_checkpoints.pointsBalance[i] *
                        _checkpoints.pointsPerShare[i]) / 1e30)
                ) -
                user.pointPaid;
            if (i + 1 != _checkpoints.startTime.length) {
                user.tokenPaid = ((_checkpoints.tokensBalance[i + 1] *
                    _checkpoints.tokensPerShare[i]) / 1e12);
                user.pointPaid = ((_checkpoints.pointsBalance[i + 1] *
                    _checkpoints.pointsPerShare[i]) / 1e30);
            } else {
                user.tokenPaid = ((_checkpoints.tokensBalance[i] *
                    _checkpoints.tokensPerShare[i]) / 1e12);
                user.pointPaid = ((_checkpoints.pointsBalance[i] *
                    _checkpoints.pointsPerShare[i]) / 1e30);
            }
            unchecked {
                ++i;
            }
        }
        b.totalTokenDisbursed = b.totalTokenDisbursed + pendingTokens;
        uint256 _tokenRewards = user.tokenRewards + pendingTokens;
        uint256 _pointRewards = user.pointRewards + pendingPoints;

        IERC20(b.token).safeTransfer(msg.sender, _tokenRewards);
        b.userPoints[msg.sender] += _pointRewards;
        user.tokenRewards = 0;
        user.pointRewards = 0;
        b.hashes[_hash] = true;
        emit Claim(msg.sender, _poolId, _tokenRewards, _pointRewards);
    }
}
