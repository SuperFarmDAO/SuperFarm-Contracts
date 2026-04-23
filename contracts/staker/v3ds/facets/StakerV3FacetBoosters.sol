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
     * @param _poolId The pool id.
     * @param _boosterId Id of booster that you want to achieve.
     * @param _asset Asset that user wants to lock for booster.
     */
    function stakeItemsBatch(
        uint256 _poolId,
        uint256 _boosterId,
        StakerBlueprint.StakedAsset memory _asset
    ) external {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.UserInfo storage _user = b.userInfoV3[_poolId][
            msg.sender
        ];

        StakerBlueprint.AssetType typeOfAsset;

        StakerBlueprint.PoolInfo storage pool = b.poolInfoV3[_poolId];
        if (_asset.id.length != _asset.amounts.length) {
            revert StakerBlueprint.AssetArrayLengthsMismatch();
        }

        bool exists;
        for (uint256 i; i < pool.boostInfo.length; ) {
            if (pool.boostInfo[i] == _boosterId) {
                exists = true;
                break;
            }
            unchecked {
                ++i;
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

        if (staker.boosterIds.contains(_boosterId) == true) {
            revert StakerBlueprint.CantGetSameBoosterTwice();
        }

        staker.totalItems += _asset.id.length;
        for (uint256 i; i < _asset.id.length; ) {
            staker.tokenIds[_boosterId].add(_asset.id[i]);
            staker.amounts[_asset.id[i]] += _asset.amounts[i];
            unchecked {
                ++i;
            }
        }
        staker.boosterIds.add(_boosterId);

        staker.lastNumberOfBoosterUpdate[_boosterId] = b
        .tpsOnBoostUpdate[_poolId][_boosterId].length;

        b.totalItemStakes += _asset.id.length;
        updatePool(_poolId);
        updateDeposits(_poolId);
        b.boosterAmount[_poolId][_boosterId] += _user.amount;

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
        } else {
            ISuperGeneric(_asset.assetAddress).safeBatchTransferFrom(
                msg.sender,
                address(this),
                _asset.id,
                _asset.amounts,
                ""
            );
        }
        emit StakerBlueprint.StakeItemBatch(msg.sender, _poolId, _boosterId);
    }

    /**
     * Withdraw some particular assets from a particular pool on the Staker.
     * @param _poolId The id of pool, withdraw tokens from.
     * @param _boosterId The booster that accepted these Items.
     */
    function unstakeItemsBatch(uint256 _poolId, uint256 _boosterId) external {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        address assetAddress;
        uint256[] memory ids;
        uint256[] memory amounts;
        StakerBlueprint.AssetType typeOfAsset;

        StakerBlueprint.UserInfo storage _user = b.userInfoV3[_poolId][
            msg.sender
        ];
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
        for (uint256 i; i < _ids.length; ) {
            _ids[i] = staker.tokenIds[_boosterId].at(i);
            _amounts[i] = staker.amounts[_ids[i]];
            unchecked {
                ++i;
            }
        }
        assetAddress = b.boostInfo[_boosterId].contractRequired;
        typeOfAsset = b.boostInfo[_boosterId].typeOfAsset;
        ids = _ids;
        amounts = _amounts;

        staker.totalItems -= _ids.length;
        for (uint256 i; i < _ids.length; ) {
            staker.tokenIds[_boosterId].remove(_ids[i]);
            staker.amounts[_ids[i]] = 0;
            unchecked {
                ++i;
            }
        }
        // TODO: think about case of pools with rewardsTiedToNFT
        checkOnBoostersChanged(_user.amount, _poolId, msg.sender);
        b.boosterAmount[_poolId][_boosterId] -= _user.amount;
        staker.boosterIds.remove(_boosterId);
        b.totalItemStakes -= _ids.length;
        updatePool(_poolId);
        updateDeposits(_poolId);

        if (typeOfAsset == StakerBlueprint.AssetType.ERC721) {
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
        emit StakerBlueprint.UnstakeItemBatch(msg.sender, _poolId, _boosterId);
    }

    /**
     * Private helper function to check if Item staker is eligible for a booster.
     * @param _ids Ids of Items required for a booster.
     * @param _amounts Amount per token Id.
     * @param _contract External contract from which Items are required.
     * @param _boosterId The booster for which Items are being staked.
     * @return Return true if eligible.
     */
    function eligible(
        uint256[] memory _ids,
        uint256[] memory _amounts,
        address _contract,
        uint256 _boosterId
    ) private view returns (bool) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.BoostInfo storage booster = b.boostInfo[_boosterId];
        uint256 totalAmount = 0;

        for (uint256 i; i < _amounts.length; ) {
            totalAmount += _amounts[i];
            unchecked {
                ++i;
            }
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
            for (uint256 i; i < _ids.length; ) {
                if (_ids[i] >> 128 != booster.groupRequired) {
                    // Wrong group item
                    return false;
                }
                unchecked {
                    ++i;
                }
            }
        }
        return true;
    }

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
     * @param _poolId The pool id, the deposit of which is to be updated.
     */
    function updateDeposits(uint256 _poolId) internal {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolInfo storage _pool = b.poolInfoV3[_poolId];
        StakerBlueprint.UserInfo storage _user = b.userInfoV3[_poolId][
            msg.sender
        ];
        bool isTiedToHolder = _pool.typeOfPool ==
            StakerBlueprint.PoolType.StakingTiedToHolder ||
            _pool.typeOfPool == StakerBlueprint.PoolType.NoStakingTiedToHolder;

        uint256 accamulatedPendingTokens;
        uint256 pendingTokens;
        uint256 pendingPoints;

        if (isTiedToHolder) {
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

            (_user.tokenBoostedAmount, _user.pointBoostedAmount) = applyBoosts(
                _user.amount,
                _poolId,
                msg.sender
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
                nftRewards.accamulatedTokenRewards += pendingTokens;
                nftRewards.accamulatedPointRewards += pendingPoints;
                _pool.tokenBoostedDeposit -= nftRewards
                    .shareOfTokenBoostedDeposited;
                _pool.pointBoostedDeposit -= nftRewards
                    .shareOfPointBoostedDeposited;

                (
                    nftRewards.shareOfTokenBoostedDeposited,
                    nftRewards.shareOfPointBoostedDeposited
                ) = applyBoosts(1_000, _poolId, msg.sender);
                _pool.tokenBoostedDeposit += nftRewards
                    .shareOfTokenBoostedDeposited;
                _pool.pointBoostedDeposit += nftRewards
                    .shareOfPointBoostedDeposited;
                accamulatedPendingTokens += pendingTokens;

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
            b.totalTokenDisbursed += accamulatedPendingTokens;
        }
    }

    /**
     * Function that handles recalc of shares and rewards if
     * some of booster multipliers that applied to user's share
     * have changed.
     * @param _unboosted Unboosted amount of tokens that user have staked.
     * @param _poolId Id of the pool, in which we are checking.
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

                uint256 _tokenPaid;
                uint256 _pointPaid;
                for (
                    uint256 j = staker.lastNumberOfBoosterUpdate[
                        pool.boostInfo[i]
                    ];
                    j < b.tpsOnBoostUpdate[pool.boostInfo[i]][_poolId].length;

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
                    _tokenPaid += (
                        (b.tpsOnBoostUpdate[pool.boostInfo[i]][_poolId][j] *
                            (_unboosted *
                                changedMul -
                                booster.historyOfTokenMultipliers[j] *
                                _unboosted))
                    );

                    if (
                        j + 1 ==
                        b.tpsOnBoostUpdate[pool.boostInfo[i]][_poolId].length &&
                        booster.boostType !=
                        StakerBlueprint.BoosterAssetType.Tokens
                    ) {
                        changedMul = booster.multiplier;
                    }
                    _pointPaid += (
                        (b.ppsOnBoostUpdate[pool.boostInfo[i]][_poolId][j] *
                            (_unboosted *
                                changedMul -
                                booster.historyOfPointMultipliers[j] *
                                _unboosted))
                    );
                    unchecked {
                        ++j;
                    }
                }
                if (_tokenPaid > 0 || _pointPaid > 0) {
                    StakerBlueprint.UserInfo storage _user = b.userInfoV3[
                        _poolId
                    ][_staker];
                    _user.tokenPaid = _tokenPaid / 1e12 / 10_000;
                    _user.pointPaid = _pointPaid / 1e30 / 10_000;
                }
            }
            unchecked {
                ++i;
            }
        }
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
        address _staker
    ) internal view returns (uint256 _boostedTokens, uint256 _boostedPoints) {
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
}
