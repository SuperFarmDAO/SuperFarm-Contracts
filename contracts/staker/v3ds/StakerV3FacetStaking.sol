// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../../base/Sweepableds.sol";
import "../../interfaces/ISuperGeneric.sol";
// import "../../assets/erc721/interfaces/ISuper721.sol";

import "./StakerV3Blueprint.sol";
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
contract StakerV3FacetStaking is
    Sweepableds,
    ReentrancyGuard,
    ERC1155Holder,
    IERC721Receiver
{
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
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();

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
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();

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
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();

        StakerV3Blueprint.PoolInfo memory pool = b.poolInfo[_poolId];
        StakerV3Blueprint.UserInfo memory user = b.userInfo[_poolId][_user];
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
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();

        StakerV3Blueprint.PoolInfo memory pool = b.poolInfo[_poolId];
        StakerV3Blueprint.UserInfo memory user = b.userInfo[_poolId][_user];
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
     * @return the number of points that the user has available to spend.
     */
    function getAvailablePoints(address _user) public view returns (uint256) {
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();

        //uint256 currentTotal = b.userPoints[_user];
        uint256 pendingTotal = 0;
        for (uint256 i; i < b.lastPoolId; i++) {
            uint256 _pendingPoints = getPendingPoints(i, _user);
            pendingTotal += _pendingPoints;
        }
        //uint256 spentTotal = b.userSpentPoints[_user];
        return (b.userPoints[_user] + pendingTotal) - b.userSpentPoints[_user];
    }

    /**
     * Return the total number of points that the user has ever accrued.
     * @return the total number of points that the user has ever accrued.
     */
    function getTotalPoints(address _user) external view returns (uint256) {
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();

        //uint256 concreteTotal = b.userPoints[_user];
        uint256 pendingTotal = 0;
        for (uint256 i; i < b.lastPoolId; i++) {
            uint256 _pendingPoints = getPendingPoints(i, _user);
            pendingTotal = pendingTotal + _pendingPoints;
        }
        return b.userPoints[_user] + pendingTotal;
    }

    // /**
    //  * Private function for the correct transfer of assets from the user
    //  *
    //  * @param _from address from which transfer shuold be made.
    //  * @param _to address of receiver of transfered amount.
    //  * @param _assetAddress address of asset that should be transfered.
    //  * @param _ids array of ids of asset that should be transfered.
    //  * @param _amounts array of amounts of items that should be transfered.
    //  * @return flag that indicates an succesful of transfer.
    //  */
    // function genericTransfer(
    //     address _from,
    //     address _to,
    //     address _assetAddress,
    //     uint256[] memory _ids,
    //     uint256[] memory _amounts
    // ) internal returns (bool) {
    //     bool isErc721 = ISuperGeneric(_assetAddress).supportsInterface(
    //         StakerV3Blueprint.INTERFACE_ERC721
    //     )
    //         ? true
    //         : false;

    //     if (isErc721) {
    //         for (uint256 i; i < _amounts.length; i++) {
    //             if (_amounts[i] != 1) {
    //                 return false;
    //             }
    //         }
    //         ISuperGeneric(_assetAddress).safeBatchTransferFrom(
    //             _from,
    //             _to,
    //             _ids,
    //             ""
    //         );
    //         return true;
    //     } else {
    //         ISuperGeneric(_assetAddress).safeBatchTransferFrom(
    //             _from,
    //             _to,
    //             _ids,
    //             _amounts,
    //             ""
    //         );
    //         return true;
    //     }
    // }

    /**
     * Update the pool corresponding to the specified token address.
     * @param _poolId the id of pool to update the corresponding pool for.
     */
    function updatePool(uint256 _poolId) internal {
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();

        StakerV3Blueprint.PoolInfo storage pool = b.poolInfo[_poolId];

        // unnecessary check ------------------------------------------
        // if (block.timestamp <= pool.lastRewardEvent) {
        //     return;
        // }

        // uint256 poolTokenSupply = ISuperGeneric(pool.assetAddress).balanceOf(
        //     address(this)
        // );
        if (pool.tokenBoostedDeposit == 0) {
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
        pool.tokensPerShare *= (tokensReward /
            b.poolInfo[_poolId].tokenBoostedDeposit);
        pool.pointsPerShare *= (pointsReward /
            b.poolInfo[_poolId].pointBoostedDeposit);
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
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();

        StakerV3Blueprint.PoolInfo storage _pool = b.poolInfo[_poolId];
        StakerV3Blueprint.UserInfo storage _user = b.userInfo[_poolId][
            msg.sender
        ];
        if (_user.amount > 0) {
            uint256 pendingTokens = ((_user.tokenBoostedAmount *
                _pool.tokensPerShare) / 1e12) - _user.tokenPaid;
            uint256 pendingPoints = ((_user.pointBoostedAmount *
                _pool.pointsPerShare) / 1e30) - _user.pointPaid;
            _user.tokenRewards += pendingTokens / 1000;
            _user.pointRewards += pendingPoints / 1000;
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

        (_user.tokenBoostedAmount, _user.pointBoostedAmount) = applyBoostsV2(
            _user.amount,
            _user.amount,
            _poolId
        );
        // _user.pointBoostedAmount = applyBoosts(_user.amount, _poolId, false);
        _pool.tokenBoostedDeposit += _user.tokenBoostedAmount;
        _pool.pointBoostedDeposit += _user.pointBoostedAmount;
        ////////???????????????????????????????????????????????????????
        _user.tokenPaid =
            (_user.tokenBoostedAmount * _pool.tokensPerShare) /
            1e12;
        _user.pointPaid =
            (_user.pointBoostedAmount * _pool.pointsPerShare) /
            1e30;
    }

    // /**
    //  * Private helper function that applies boosts on deposits for Item staking.
    //  * (amount * multiplier ) / 10000, where multiplier is in basis points.
    //  * (20 * 20000) / 10000 = 40 => 2x boost
    //  * @param _unboosted value that needs to have boosts applied to.
    //  * @param _poolId Id of the pool.
    //  * @param _isToken is true if '_unboosted' argument is of token type.
    //  * @return _boosted return value with applied boosts.
    //  */
    // function applyBoosts(
    //     uint256 _unboosted,
    //     uint256 _poolId,
    //     bool _isToken
    // ) internal view returns (uint256 _boosted) {
    //     StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
    //         .stakerV3StateVariables();

    //     StakerV3Blueprint.PoolInfo memory pool = b.poolInfo[_poolId];
    //     StakerV3Blueprint.ItemUserInfo storage staker = b.itemUserInfo[
    //         msg.sender
    //     ];

    //     if (_unboosted == 0) {
    //         return 0;
    //     } else if (pool.boostInfo.length == 0) {
    //         return _unboosted;
    //     } else if (staker.boosterIds.length() == 0) {
    //         return _unboosted;
    //     }

    //     _boosted = _unboosted;
    //     StakerV3Blueprint.BoostInfo memory booster;

    //     // Iterate through all the boosters that the pool supports
    //     for (uint256 i; i < pool.boostInfo.length; i++) {
    //         booster = b.boostInfo[pool.boostInfo[i]];
    //         if (staker.boosterIds.contains(pool.boostInfo[i])) {
    //             if (
    //                 booster.assetType ==
    //                 StakerV3Blueprint.BoosterAssetType.Tokens &&
    //                 _isToken
    //             ) {
    //                 _boosted += (_unboosted * booster.multiplier) / 10000;
    //             } else if (
    //                 booster.assetType ==
    //                 StakerV3Blueprint.BoosterAssetType.Points &&
    //                 !_isToken
    //             ) {
    //                 _boosted += (_unboosted * booster.multiplier) / 10000;
    //             } else if (
    //                 booster.assetType == StakerV3Blueprint.BoosterAssetType.Both
    //             ) {
    //                 _boosted += (_unboosted * booster.multiplier) / 10000;
    //             }
    //         }
    //     }
    // }

    /**
     * Private helper function that applies boosts on deposits for Item staking.
     * (amount * multiplier ) / 10000, where multiplier is in basis points.
     * (20 * 20000) / 10000 = 40 => 2x boost
     * @param _unboostedTokens value that needs to have boosts applied to.
     * @param _unboostedPoints is true if '_unboosted' argument is of token type.
     * @param _poolId Id of the pool.
     * @return _boostedTokens return number of tokens with applied boosts.
     * @return _boostedPoints return number of points with applied boost.
     */
    function applyBoostsV2(
        uint256 _unboostedTokens,
        uint256 _unboostedPoints,
        uint256 _poolId
    ) internal view returns (uint256 _boostedTokens, uint256 _boostedPoints) {
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();

        StakerV3Blueprint.PoolInfo memory pool = b.poolInfo[_poolId];
        StakerV3Blueprint.ItemUserInfo storage staker = b.itemUserInfo[
            msg.sender
        ];

        if (_unboostedTokens == 0 && _unboostedPoints == 0) {
            return (0, 0);
        } else if (pool.boostInfo.length == 0) {
            return (_unboostedTokens, _unboostedTokens);
        } else if (staker.boosterIds.length() == 0) {
            return (_unboostedTokens, _unboostedTokens);
        }

        _boostedTokens = _unboostedTokens;
        _boostedPoints = _unboostedPoints;

        // Iterate through all the boosters that the pool supports
        for (uint256 i; i < pool.boostInfo.length; i++) {
            if (staker.boosterIds.contains(pool.boostInfo[i])) {
                StakerV3Blueprint.BoostInfo memory booster = b.boostInfo[
                    pool.boostInfo[i]
                ];
                if (
                    booster.assetType ==
                    StakerV3Blueprint.BoosterAssetType.Tokens
                ) {
                    _boostedTokens +=
                        (_unboostedTokens * booster.multiplier) /
                        10000;
                } else if (
                    booster.assetType ==
                    StakerV3Blueprint.BoosterAssetType.Points
                ) {
                    _boostedPoints +=
                        (_unboostedPoints * booster.multiplier) /
                        10000;
                } else {
                    _boostedTokens +=
                        (_unboostedTokens * booster.multiplier) /
                        10000;
                    _boostedPoints +=
                        (_unboostedPoints * booster.multiplier) /
                        10000;
                }
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
        StakerV3Blueprint.StakedAsset memory _asset
    ) external {
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();

        StakerV3Blueprint.PoolAssetType typeOfAsset;

        StakerV3Blueprint.PoolInfo memory pool = b.poolInfo[_poolId];
        require(
            _asset.id.length == _asset.amounts.length,
            "StakerV3FacetStaking::deposit: mismatch of id and amounts arrays lentghs"
        );
        if (_boosterId > 0) {
            bool exists;
            for (uint256 i; i < pool.boostInfo.length; i++) {
                if (pool.boostInfo[i] == _boosterId) {
                    exists = true;
                    break;
                }
            }
            require(
                exists &&
                    eligible(
                        _asset.id,
                        _asset.amounts,
                        _asset.assetAddress,
                        _boosterId
                    ),
                "0x4Z"
            );

            typeOfAsset = b.boostInfo[_boosterId].typeOfAsset;

            StakerV3Blueprint.ItemUserInfo storage staker = b.itemUserInfo[
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
            require(pool.tokenStrength > 0 || pool.pointStrength > 0, "0x1E");
            require(
                _asset.assetAddress == pool.assetAddress,
                "StakerV3FacetStaking::deposit: you can't stake this asset in this pool."
            );
            typeOfAsset = pool.typeOfAsset;
            StakerV3Blueprint.UserInfo storage user = b.userInfo[_poolId][
                msg.sender
            ];
            uint256 amount;

            // do u need it???? no
            // require(
            //     _asset.IOUTokenId.length == 0,
            //     "Staker::deposit: ioutokenid length greater than 0"
            // );

            uint256 assetLength = _asset.amounts.length;
            uint256[] memory IOUTokenIdToMint = new uint256[](assetLength);
            uint256 IOUTokenCounter = b.nextIOUTokenId;
            uint256[] memory IOUTokenId;
            for (uint256 i; i < assetLength; i++) {
                amount += _asset.amounts[i];
                //ids.push(_asset.id[i]);
                // user.asset.amounts.push(_asset.amounts[i]);
                // user.asset.id.push(_asset.id[i]);
                // user.asset.IOUTokenId.push(IOUTokenCounter);
                b.IOUIdToStakedAsset[IOUTokenCounter].assetAddress = _asset
                    .assetAddress;
                b.IOUIdToStakedAsset[IOUTokenCounter].amounts.push(
                    _asset.amounts[i]
                );
                b.IOUIdToStakedAsset[IOUTokenCounter].id.push(_asset.id[i]);
                // b.IOUIdToStakedAsset[IOUTokenCounter].IOUTokenId = IOUTokenId;
                IOUTokenIdToMint[i] = IOUTokenCounter;
                IOUTokenCounter++;
            }

            b.nextIOUTokenId = IOUTokenCounter;

            //_asset.IOUTokenId = user.asset.IOUTokenId;
            ISuperGeneric(b.IOUTokenAddress).mintBatch(
                msg.sender,
                IOUTokenIdToMint,
                //user.asset.IOUTokenId,
                ""
            );
            // user.asset = _asset;
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
        // if (pool.typeOfAsset == StakerV3Blueprint.PoolAssetType.ERC20) {
        //     require(
        //         _asset.amounts.length == 1,
        //         "StakerV3FacetStaking::deposit: invalid length of amounts array"
        //     );
        //     IERC20(_asset.assetAddress).safeTransferFrom(
        //         msg.sender,
        //         address(this),
        //         _asset.amounts[0]
        //     );
        // } else
        if (typeOfAsset == StakerV3Blueprint.PoolAssetType.ERC721) {
            for (uint256 i; i < _asset.amounts.length; i++) {
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

        // require(
        //     genericTransfer(
        //         msg.sender,
        //         address(this),
        //         _asset.assetAddress,
        //         _asset.id,
        //         _asset.amounts
        //     ),
        //     "0x9E"
        // );
    }

    /**
     * Withdraw some particular assets from a particular pool on the Staker.
     * @param _poolId the id of pool, withdraw tokens from.
     * @param _asset asset user wants to withdraw
     */
    function withdraw(
        uint256 _poolId,
        StakerV3Blueprint.StakedAsset memory _asset,
        uint256 _boosterId
    ) external {
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();

        address assetAddress;
        uint256[] memory ids;
        uint256[] memory amounts;
        StakerV3Blueprint.PoolAssetType typeOfAsset;
        if (_boosterId > 0) {
            require(
                b.itemUserInfo[msg.sender].boosterIds.contains(_boosterId),
                "0x1G"
            );
            StakerV3Blueprint.ItemUserInfo storage staker = b.itemUserInfo[
                msg.sender
            ];

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
            StakerV3Blueprint.UserInfo storage user = b.userInfo[_poolId][
                msg.sender
            ];
            StakerV3Blueprint.PoolInfo storage pool = b.poolInfo[_poolId];
            uint256 amount;
            for (uint256 i; i < _asset.amounts.length; i++) {
                amount += _asset.amounts[i];
            }
            require(user.amount / 1000 >= amount, "0x1Z");

            // pool.token.safeTransfer(msg.sender, _amount);
            require(
                ISuperGeneric(b.IOUTokenAddress).balanceOf(msg.sender) > 0,
                "0x2E"
            );
            assetAddress = pool.assetAddress;

            ids = new uint256[](_asset.IOUTokenId.length);
            uint256[] memory _ids = new uint256[](_asset.IOUTokenId.length);
            uint256[] memory _amounts = new uint256[](_ids.length);
            for (uint256 i; i < _ids.length; i++) {
                require(
                    b.IOUIdToStakedAsset[_asset.IOUTokenId[i]].assetAddress ==
                        assetAddress,
                    "StakerV3FacetStaking::withdraw: IOUToken for different asset then pool."
                );
                require(
                    ISuperGeneric(b.IOUTokenAddress).ownerOf(
                        _asset.IOUTokenId[i]
                    ) == msg.sender,
                    "StakerV3FacetStaking::withdraw: you are not an owner of that IOUToken."
                );
                _ids[i] = b.IOUIdToStakedAsset[_asset.IOUTokenId[i]].id[0];
                _amounts[i] = b
                    .IOUIdToStakedAsset[_asset.IOUTokenId[i]]
                    .amounts[0];
            }
            ids = _ids;
            amounts = _amounts;
            typeOfAsset = pool.typeOfAsset;

            ISuperGeneric(b.IOUTokenAddress).burnBatch(
                msg.sender,
                _asset.IOUTokenId
            );
            updatePool(_poolId);
            updateDeposits(amount, _poolId, false);

            emit Withdraw(msg.sender, _poolId, amounts, ids, assetAddress);
            //delete user.asset;
        }

        // if (pool.typeOfAsset == StakerV3Blueprint.PoolAssetType.ERC20) {
        //     require(
        //         _asset.amounts.length == 1,
        //         "StakerV3FacetStaking::deposit: invalid length of amounts array"
        //     );
        //     IERC20(assetAddress).safeTransferFrom(
        //         address(this),
        //         msg.sender,
        //         _asset.amounts[0]
        //     );
        // } else
        if (typeOfAsset == StakerV3Blueprint.PoolAssetType.ERC721) {
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

        // require(
        //     genericTransfer(
        //         address(this),
        //         msg.sender,
        //         assetAddress,
        //         ids,
        //         amounts
        //     ),
        //     "0x9E"
        // );
    }

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

            StakerV3Blueprint.Sig memory sig;
            StakerV3Blueprint.Checkpoint memory _checkpoints;

            sig = StakerV3Blueprint.Sig({v: _v, r: _r, s: _s});
            _checkpoints = StakerV3Blueprint.Checkpoint({
                startTime: _startTime,
                endTime: _endTime,
                balance: _balance
            });
            _claim(_poolId, _hash, sig, _checkpoints);
        }
    }

    /**
     * Claim accumulated token and point rewards from the Staker.
     * @param _poolId The id of pool to claim rewards from.
     */
    function _claim(uint256 _poolId) internal {
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();

        StakerV3Blueprint.UserInfo storage user = b.userInfo[_poolId][
            msg.sender
        ];
        StakerV3Blueprint.PoolInfo storage pool = b.poolInfo[_poolId];
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
            _tokenRewards = user.tokenRewards + pendingTokens / 1000;
            _pointRewards = user.pointRewards + pendingPoints / 1000;
            IERC20(b.token).safeTransfer(msg.sender, _tokenRewards);
            b.userPoints[msg.sender] = b.userPoints[msg.sender] + _pointRewards;

            user.tokenPaid =
                ((user.tokenBoostedAmount * pool.tokensPerShare) / 1e12) /
                1000;
            user.pointPaid =
                ((user.pointBoostedAmount * pool.pointsPerShare) / 1e30) /
                1000;
        } else {
            IERC20(b.token).safeTransfer(msg.sender, user.tokenRewards);
        }
        user.tokenRewards = 0;
        user.pointRewards = 0;

        /////////////////////////???????????????????????????????????????
        emit Claim(msg.sender, _poolId, _tokenRewards, _pointRewards);
    }

    /**
     * Claim accumulated token and point rewards from the Staker.
     * @param _poolId The id of pool to claim rewards from.
     * @param _checkpoints Information about what time intervals to count rewards
     */
    function _claim(
        uint256 _poolId,
        bytes32 _hash,
        StakerV3Blueprint.Sig memory sig,
        StakerV3Blueprint.Checkpoint memory _checkpoints
    ) internal {
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();
        // require(
        //     _checkpoints.startTime.length == _checkpoints.endTime.length &&
        //         _checkpoints.startTime.length == _checkpoints.balance.length,
        //     "StakerV3FacetStaking::claim: mismatch of start time end time or balances arrays lengths."
        // );
        StakerV3Blueprint.UserInfo storage user = b.userInfo[_poolId][
            msg.sender
        ];
        StakerV3Blueprint.PoolInfo storage pool = b.poolInfo[_poolId];

        uint256 pendingTokens;
        uint256 pendingPoints;

        bytes32 messageDigest = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", _hash)
        );

        require(
            b.admin == ecrecover(messageDigest, sig.v, sig.r, sig.s),
            "0x1F"
        );

        bytes32 someShittyHash = keccak256(
            abi.encodePacked(
                _checkpoints.startTime,
                _checkpoints.endTime,
                _checkpoints.balance
            )
        );

        require(
            keccak256(
                abi.encodePacked(
                    _checkpoints.startTime,
                    _checkpoints.endTime,
                    _checkpoints.balance
                )
            ) == _hash,
            "0x2F"
        );

        require(!b.hashes[_hash], "0x3F");

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
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();

        StakerV3Blueprint.BoostInfo memory booster = b.boostInfo[_boosterId];
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
        hasValidPermit(UNIVERSAL, StakerV3Blueprint.APPROVE_POINT_SPENDER)
    {
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();

        b.approvedPointSpenders[_spender] = _approval;
    }

    /**
     * Allows an approved spender of points to spend points on behalf of a user.
     * @param _user The user whose points are being spent.
     * @param _amount The amount of the user's points being spent.
     */
    function spendPoints(address _user, uint256 _amount) external {
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();

        require(b.approvedPointSpenders[msg.sender], "0x3E");
        // uint256 _userPoints = getAvailablePoints(_user);
        require(getAvailablePoints(_user) >= _amount, "0x4E");
        b.userSpentPoints[_user] += _amount;
        emit SpentPoints(msg.sender, _user, _amount);
    }

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
