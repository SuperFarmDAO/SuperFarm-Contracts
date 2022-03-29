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

    error AssetArrayLengthsMismatch();
    error InvalidInfoStakeForBoost();
    error IncativePool();
    error InvalidAssetToStake();
    error NotStaked();
    error InvalidAmount();
    error IOUTokenFromDifferentPool();
    error NotAnOwnerOfIOUToken();
    error NotAnAdmin();
    error MismatchArgumentsAndHash();
    error HashUsed();
    error NotApprovedPointSpender();
    error InvalidAmountToLock();
    error TokensAlreadyLocked();
    error TokenLocked();

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

    /**
     * Return the number of points that the user has available to spend.
     * @param _user the user whose available points we want to get.
     * @return the number of points that the user has available to spend.
     */
    function getAvailablePoints(address _user) public view returns (uint256) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        uint256 pendingTotal;
        for (uint256 i; i < b.poolAssets.length; i++) {
            uint256 _pendingPoints = getPendingPoints(i, _user);
            pendingTotal += _pendingPoints;
        }
        return (b.userPoints[_user] + pendingTotal) - b.userSpentPoints[_user];
    }

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

        if (b.poolLocks[_poolId].length > b.lockIndex[_poolId]) {
            for (
                uint256 i = b.lockIndex[_poolId];
                i < b.poolLocks[_poolId].length;
                i++
            ) {
                if (
                    b.poolLocks[_poolId][i].lockedAt + pool.lockPeriod <
                    block.timestamp
                ) {
                    StakerBlueprint.UserInfo storage _user = b.userInfoV3[
                        _poolId
                    ][b.poolLocks[_poolId][i].lockedUser];
                    StakerBlueprint.ItemUserInfo storage staker = b
                        .itemUserInfo[b.poolLocks[_poolId][i].lockedUser];

                    ISuperGeneric(b.IOUTokenAddress).mintBatch(
                        b.poolLocks[_poolId][i].lockedUser,
                        staker.lockedItems[_poolId].lockedIOUIds,
                        ""
                    );
                    // clearing data for outdated locks
                    staker.lockedItems[_poolId].lockedIOUIds = new uint256[](0);
                    delete staker.lockedItems[_poolId].lockedAt;
                    // calculating rewards for staker that has unlock his tokens

                    tokensReward =
                        ((getTotalEmittedTokens(
                            pool.lastRewardEvent,
                            b.poolLocks[_poolId][i].lockedAt + pool.lockPeriod
                        ) * pool.tokenStrength) / b.totalTokenStrength) *
                        1e12;

                    pointsReward =
                        ((getTotalEmittedPoints(
                            pool.lastRewardEvent,
                            b.poolLocks[_poolId][i].lockedAt + pool.lockPeriod
                        ) * pool.pointStrength) / b.totalPointStrength) *
                        1e30;

                    pool.tokensPerShare += (tokensReward /
                        pool.tokenBoostedDeposit);
                    pool.pointsPerShare += (pointsReward /
                        pool.pointBoostedDeposit);
                    pool.lastRewardEvent =
                        b.poolLocks[_poolId][i].lockedAt +
                        pool.lockPeriod;

                    delete b.poolLocks[_poolId][i];
                    emit TokenUnlock(
                        b.poolLocks[_poolId][i].lockedUser,
                        _poolId
                    );
                    b.lockIndex[_poolId] = i + 1;
                    // = b.poolLocks[_poolId][
                    //     b.poolLocks[_poolId].length - 1
                    // ];
                    // b.poolLocks[_poolId].pop();

                    _user.tokenRewards +=
                        (_user.tokenBoostedAmount * (pool.tokensPerShare)) /
                        1e12 -
                        _user.tokenPaid;
                    _user.pointRewards +=
                        (_user.pointBoostedAmount * (pool.pointsPerShare)) /
                        1e30 -
                        _user.pointPaid;
                    b.totalTokenDisbursed +=
                        (_user.tokenBoostedAmount * (pool.tokensPerShare)) /
                        1e12 -
                        _user.tokenPaid;

                    // calculating totalStaked amount after unlock
                    pool.tokenBoostedDeposit -= _user.tokenBoostedAmount;
                    pool.pointBoostedDeposit -= _user.pointBoostedAmount;
                    (
                        _user.tokenBoostedAmount,
                        _user.pointBoostedAmount
                    ) = applyBoosts(_user.amount, _poolId);
                    pool.tokenBoostedDeposit += _user.tokenBoostedAmount;
                    pool.pointBoostedDeposit += _user.pointBoostedAmount;

                    _user.tokenPaid =
                        (_user.tokenBoostedAmount * (pool.tokensPerShare)) /
                        1e12;
                    _user.pointPaid =
                        (_user.pointBoostedAmount * (pool.pointsPerShare)) /
                        1e30;
                }
                // if (i == 0) {
                //     break;
                // }
            }
        }

        tokensReward =
            ((getTotalEmittedTokens(pool.lastRewardEvent, block.timestamp) *
                pool.tokenStrength) / b.totalTokenStrength) *
            1e12;

        pointsReward =
            ((getTotalEmittedPoints(pool.lastRewardEvent, block.timestamp) *
                pool.pointStrength) / b.totalPointStrength) *
            1e30;

        // Directly pay developers their corresponding share of tokens and points.
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

        // Update the pool rewards per share to pay users the amount remaining.
        pool.tokensPerShare += (tokensReward / pool.tokenBoostedDeposit);
        pool.pointsPerShare += (pointsReward / pool.pointBoostedDeposit);
        pool.lastRewardEvent = block.timestamp;
    }

    /**
     * Private helper function to update the deposits based on new shares.
     * @param _amount base amount of the new boosted amounts.
     * @param _poolId the pool id, the deposit of which is to be updated.
     * @param _isDeposit flag that represents the caller function. True is for deposit,
     *   false is for withdraw.
     */
    function updateDeposits(
        uint256 _amount,
        uint256 _poolId,
        bool _isDeposit
    ) private {
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
        if (_amount > 0) {
            if (_isDeposit) {
                _user.amount += _amount * 1000;
            } else {
                _user.amount -= _amount * 1000;
            }
        }

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
            if (pool.typeOfBoost == StakerBlueprint.BoosterAssetType.Tokens) {
                _boostedTokens += (_unboosted * pool.lockMultiplier) / 10000;
            } else if (
                pool.typeOfBoost == StakerBlueprint.BoosterAssetType.Points
            ) {
                _boostedPoints += (_unboosted * pool.lockMultiplier) / 10000;
            } else {
                _boostedTokens += (_unboosted * pool.lockMultiplier) / 10000;
                _boostedPoints += (_unboosted * pool.lockMultiplier) / 10000;
            }
        }
    }

    /**
     * Deposit some particular assets to a particular pool on the Staker.
     * @param _poolId the pool id.
     * @param _boosterId id of booster that you want to achieve.
     * @param _asset asset user wants to deposit
     */
    function deposit(
        uint256 _poolId,
        uint256 _boosterId,
        StakerBlueprint.StakedAsset memory _asset,
        bool isLocking
    ) external {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolAssetType typeOfAsset;

        StakerBlueprint.PoolInfo memory pool = b.poolInfoV3[_poolId];
        if (_asset.id.length != _asset.amounts.length) {
            revert AssetArrayLengthsMismatch();
        }
        if (_boosterId > 0) {
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
                revert InvalidInfoStakeForBoost();
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
            updateDeposits(0, _poolId, true);
            emit StakeItemBatch(msg.sender, _poolId, _boosterId);
        } else {
            if (pool.tokenStrength == 0) {
                revert IncativePool();
            }
            if (_asset.assetAddress != pool.assetAddress) {
                revert InvalidAssetToStake();
            }

            typeOfAsset = pool.typeOfAsset;
            uint256 amount;

            uint256[] memory IOUTokenIdsToMint = new uint256[](
                _asset.amounts.length
            );
            uint256 IOUTokenCounter = b.nextIOUTokenId;
            for (uint256 i; i < _asset.amounts.length; i++) {
                amount += _asset.amounts[i];
                b
                .IOUIdToStakedAsset[_poolId][IOUTokenCounter]
                    .assetAddress = _asset.assetAddress;
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

            if (isLocking) {
                StakerBlueprint.ItemUserInfo storage staker = b.itemUserInfo[
                    msg.sender
                ];
                if (amount != pool.lockAmount) {
                    revert InvalidAmountToLock();
                }
                if (staker.lockedItems[_poolId].lockedIOUIds.length != 0) {
                    revert TokensAlreadyLocked();
                }
                staker.lockedItems[_poolId].lockedAt = block.timestamp;
                staker.lockedItems[_poolId].lockedIOUIds = IOUTokenIdsToMint;
                // for (uint256 i; i < _asset.id.length; i++) {
                //     staker.lockedItems[_poolId].lockedAt = block.timestamp;
                //     staker.lockedItems[_poolId].lockedIOUId = IOUTokenIdsToMint;
                //     staker.lockedItems[_poolId].lockedIds.add(_asset.id[i]);
                //     staker.lockedItems[_poolId].lockedAmounts[i] = _asset
                //         .amount[i];
                // }
                b.poolLocks[_poolId].push(
                    StakerBlueprint.PoolLocks(block.timestamp, msg.sender)
                );
                emit TokenLock(msg.sender, _poolId, block.timestamp);
            } else {
                ISuperGeneric(b.IOUTokenAddress).mintBatch(
                    msg.sender,
                    IOUTokenIdsToMint,
                    ""
                );
            }
            updatePool(_poolId);
            updateDeposits(amount, _poolId, true);

            emit Deposit(
                msg.sender,
                _poolId,
                _asset.amounts,
                _asset.id,
                pool.assetAddress
            );
        }
        if (typeOfAsset == StakerBlueprint.PoolAssetType.ERC721) {
            for (uint256 i; i < _asset.amounts.length; i++) {
                // TODO: may be move this checks
                require(
                    _asset.amounts[i] == 1,
                    "StakerV3FacetStaking::deposit: invalid amount value."
                );
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
     * @param _asset asset user wants to withdraw
     */
    function withdraw(
        uint256 _poolId,
        StakerBlueprint.StakedAsset memory _asset,
        uint256 _boosterId
    ) external {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        address assetAddress;
        uint256[] memory ids;
        uint256[] memory amounts;
        StakerBlueprint.PoolAssetType typeOfAsset;

        StakerBlueprint.ItemUserInfo storage staker = b.itemUserInfo[
            msg.sender
        ];

        if (_boosterId > 0) {
            if (!b.itemUserInfo[msg.sender].boosterIds.contains(_boosterId)) {
                revert NotStaked();
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
            updateDeposits(0, _poolId, false);

            emit UnstakeItemBatch(msg.sender, _poolId, _boosterId);
        } else {
            // StakerBlueprint.UserInfo storage user = b.userInfoV3[_poolId][
            //     msg.sender
            // ];
            uint256 amount;
            for (uint256 i; i < _asset.amounts.length; i++) {
                amount += _asset.amounts[i];
            }
            if (b.userInfoV3[_poolId][msg.sender].amount / 1000 < amount) {
                revert InvalidAmount();
            }

            // if (ISuperGeneric(b.IOUTokenAddress).balanceOf(msg.sender) == 0) {

            // }
            // require(
            //     ISuperGeneric(b.IOUTokenAddress).balanceOf(msg.sender) > 0,
            //     "0x2E"
            // );
            assetAddress = b.poolInfoV3[_poolId].assetAddress;

            ids = new uint256[](_asset.IOUTokenId.length);
            uint256[] memory _ids = new uint256[](_asset.IOUTokenId.length);
            uint256[] memory _amounts = new uint256[](_ids.length);

            updatePool(_poolId);

            if (staker.lockedItems[_poolId].lockedIOUIds.length != 0) {
                uint256[] memory _lockedIOUIds = staker
                    .lockedItems[_poolId]
                    .lockedIOUIds;
                for (uint256 j; j < _lockedIOUIds.length; j++) {
                    for (uint256 i; i < _asset.IOUTokenId.length; i++) {
                        if (_asset.IOUTokenId[i] == _lockedIOUIds[j]) {
                            revert TokenLocked();
                        }
                    }
                }
            }
            for (uint256 i; i < _ids.length; i++) {
                // if (
                //     b
                //     .IOUIdToStakedAsset[_poolId][_asset.IOUTokenId[i]]
                //         .assetAddress != assetAddress
                // ) {
                //     revert IOUTokenFromDifferentPool();
                // }
                if (
                    ISuperGeneric(b.IOUTokenAddress).ownerOf(
                        _asset.IOUTokenId[i]
                    ) != msg.sender
                ) {
                    revert NotAnOwnerOfIOUToken();
                }
                if (
                    b
                        .IOUIdToStakedAsset[_poolId][_asset.IOUTokenId[i]]
                        .id
                        .length == 0
                ) {
                    revert IOUTokenFromDifferentPool();
                }
                _ids[i] = b
                .IOUIdToStakedAsset[_poolId][_asset.IOUTokenId[i]].id[0];
                _amounts[i] = b
                .IOUIdToStakedAsset[_poolId][_asset.IOUTokenId[i]].amounts[0];
            }
            ids = _ids;
            amounts = _amounts;
            typeOfAsset = b.poolInfoV3[_poolId].typeOfAsset;
            updateDeposits(amount, _poolId, false);
            ISuperGeneric(b.IOUTokenAddress).burnBatch(
                msg.sender,
                _asset.IOUTokenId
            );

            emit Withdraw(msg.sender, _poolId, amounts, ids, assetAddress);
        }

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
     * Claim accumulated token and point rewards from the Staker.
     * @param _poolId The id of pool to claim rewards from.
     * @param _data bytes with calldata for use by backend, casual users should send empty bytes array.
     */
    function claim(uint256 _poolId, bytes memory _data) external {
        if (_data.length == 0) {
            _claim(_poolId);
        } else {
            bytes32 _hash;
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
                    mstore(
                        add(_endTime, localCounter),
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
                    mstore(
                        add(_balance, localCounter),
                        mload(add(_data, counter))
                    )
                }
            }

            StakerBlueprint.Sig memory sig;
            StakerBlueprint.Checkpoint memory _checkpoints;

            sig.v = _v;
            sig.r = _r;
            sig.s = _s;
            _checkpoints.startTime = _startTime;
            _checkpoints.endTime = _endTime;
            _checkpoints.balance = _balance;
            _claim(_poolId, _hash, sig, _checkpoints);
        }
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

            (_tokenRewards, _pointRewards) = compoundCalc(
                _tokenRewards,
                _pointRewards,
                pool
            );
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
     * @param _checkpoints Information about what time intervals to count rewards
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
            revert NotAnAdmin();
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
            revert MismatchArgumentsAndHash();
        }

        if (b.hashes[_hash]) {
            revert HashUsed();
        }

        for (uint256 i; i < _checkpoints.startTime.length; i++) {
            pendingTokens += (
                ((_checkpoints.balance[i] * pool.tokensPerShare) / 1e12)
            );
            pendingPoints += (
                ((_checkpoints.balance[i] * pool.pointsPerShare) / 1e30)
            );
        }
        pendingTokens -= user.tokenPaid;
        pendingPoints -= user.pointPaid;
        b.totalTokenDisbursed = b.totalTokenDisbursed + pendingTokens;

        uint256 _tokenRewards = user.tokenRewards + pendingTokens;
        uint256 _pointRewards = user.pointRewards + pendingPoints;
        (_tokenRewards, _pointRewards) = compoundCalc(
            _tokenRewards,
            _pointRewards,
            pool
        );
        IERC20(b.token).safeTransfer(msg.sender, _tokenRewards);
        b.userPoints[msg.sender] = b.userPoints[msg.sender] + _pointRewards;
        user.tokenRewards = 0;
        user.pointRewards = 0;
        b.hashes[_hash] = true;
        user.tokenPaid += pendingTokens;
        user.pointPaid += pendingPoints;
        emit Claim(msg.sender, _poolId, _tokenRewards, _pointRewards);
    }

    /**
     * Private helper function for calculate rewards for compound interest
     * @param tokenRewards current token rewards that user should claim
     * @param pointRewards curent point rewards that user should claim
     * @return bossted amount of token and point rewards by compounding interest
     */
    function compoundCalc(
        uint256 tokenRewards,
        uint256 pointRewards,
        StakerBlueprint.PoolInfo memory pool
    ) private returns (uint256, uint256) {
        if (tokenRewards > pool.compoundInterestTreshold) {
            tokenRewards +=
                ((tokenRewards - pool.compoundInterestTreshold) *
                    pool.compoundInterestMultiplier) /
                10000;
        }
        if (pointRewards > pool.compoundInterestTreshold) {
            pointRewards +=
                ((pointRewards - pool.compoundInterestTreshold) *
                    pool.compoundInterestMultiplier) /
                10000;
        }
        return (tokenRewards, pointRewards);
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
            revert NotApprovedPointSpender();
        }
        if (getAvailablePoints(_user) < _amount) {
            revert InvalidAmount();
        }
        b.userSpentPoints[_user] += _amount;
        emit SpentPoints(msg.sender, _user, _amount);
    }

    // function onERC721Received(
    //     address operator,
    //     address from,
    //     uint256 tokenId,
    //     bytes calldata data
    // ) external override returns (bytes4) {
    //     return this.onERC721Received.selector;
    // }
}
