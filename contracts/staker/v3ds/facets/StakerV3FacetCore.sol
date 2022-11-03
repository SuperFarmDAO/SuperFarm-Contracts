// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../../../base/Sweepableds.sol";
import "../../../interfaces/ISuperGeneric.sol";
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
contract StakerV3FacetCore is Sweepableds, ERC1155Holder, IERC721Receiver {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;

    /**
     * A function that needs to be called immediately after deployment.
     * Sets the owner of the newly deployed proxy.
     */
    function initialize(address _owner) external initializer {
        __Ownable_init_unchained();
        transferOwnership(_owner);
    }

    /**
     * Add a new developer to the StakerV2 or overwrite an existing one.
     * This operation requires that developer address addition is not locked.
     * @param _developerAddress The additional developer's address.
     * @param _share The share in 1/1_000th of a percent of each token emission sent
     *   to this new developer.
     */
    function addDeveloper(address _developerAddress, uint256 _share)
        external
        hasValidPermit(UNIVERSAL, StakerBlueprint.ADD_DEVELOPER)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        if (!b.canAlterDevelopers) {
            revert StakerBlueprint.CantAlterDevs();
        }
        b.developerAddresses.add(_developerAddress);
        b.developerShares[_developerAddress] = _share;
    }

    /**
     * Permanently forfeits owner ability to alter the state of StakerV2 developers.
     * Once called, this function is intended to give peace of mind to the StakerV2's
     * developers and community that the fee structure is now immutable.
     */
    function lockDevelopers()
        external
        hasValidPermit(UNIVERSAL, StakerBlueprint.LOCK_DEVELOPERS)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        b.canAlterDevelopers = false;
    }

    /**
     * A developer may at any time update their address or voluntarily reduce their
     * share of emissions by calling this function from their current address.
     * Note That updating a developer's share to zero effectively removes them.
     * @param _newDeveloperAddress An address to update this developer's address.
     * @param _newShare The new share in 1/1_000th of a percent of each token
     *   emission sent to this developer.
     */
    function updateDeveloper(address _newDeveloperAddress, uint256 _newShare)
        external
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        uint256 developerShare = b.developerShares[msg.sender];
        if (developerShare == 0) {
            revert StakerBlueprint.ZeroDevShare();
        }
        if (_newShare > developerShare) {
            revert StakerBlueprint.CantIncreaseDevShare();
        }
        if (_newShare == 0) {
            b.developerAddresses.remove(msg.sender);
            delete b.developerShares[msg.sender];
        } else {
            if (_newDeveloperAddress != msg.sender) {
                if (
                    b.developerShares[_newDeveloperAddress] != 0 ||
                    _newDeveloperAddress == address(0)
                ) {
                    revert StakerBlueprint.InvalidNewAddress();
                }
                delete b.developerShares[msg.sender];
                b.developerAddresses.remove(msg.sender);
                b.developerAddresses.add(_newDeveloperAddress);
                b.developerShares[_newDeveloperAddress] = _newShare;
            } else if (_newShare < developerShare) {
                b.developerShares[_newDeveloperAddress] = _newShare;
            }
        }
    }

    /**
     * Set new emission details to the StakerV2 or overwrite existing ones.
     * This operation requires that emission schedule alteration is not locked.
     * @param _tokenSchedule An array of EmissionPoints defining the token schedule.
     * @param _pointSchedule An array of EmissionPoints defining the point schedule.
     */
    function setEmissions(
        StakerBlueprint.EmissionPoint[] memory _tokenSchedule,
        StakerBlueprint.EmissionPoint[] memory _pointSchedule
    ) external hasValidPermit(UNIVERSAL, StakerBlueprint.SET_EMISSIONS) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        if (_tokenSchedule.length > 0) {
            if (!b.canAlterTokenEmissionSchedule) {
                revert StakerBlueprint.CantAlterTokenEmissionSchedule();
            }
            b.tokenEmissionEventsCount = _tokenSchedule.length;
            for (uint256 i; i < b.tokenEmissionEventsCount; ) {
                b.tokenEmissionEvents[i] = _tokenSchedule[i];
                if (
                    b.earliestTokenEmissionEvent > _tokenSchedule[i].timeStamp
                ) {
                    b.earliestTokenEmissionEvent = _tokenSchedule[i].timeStamp;
                }
                unchecked {
                    ++i;
                }
            }
        }
        if (b.tokenEmissionEventsCount == 0) {
            revert StakerBlueprint.ZeroTokenEmissionEvents();
        }

        if (_pointSchedule.length > 0) {
            if (!b.canAlterPointEmissionSchedule) {
                revert StakerBlueprint.CantAlterPointEmissionSchedule();
            }
            b.pointEmissionEventsCount = _pointSchedule.length;
            for (uint256 i; i < b.pointEmissionEventsCount; ) {
                b.pointEmissionEvents[i] = _pointSchedule[i];
                if (
                    b.earliestPointEmissionEvent > _pointSchedule[i].timeStamp
                ) {
                    b.earliestPointEmissionEvent = _pointSchedule[i].timeStamp;
                }
                unchecked {
                    ++i;
                }
            }
        }
        if (b.pointEmissionEventsCount == 0) {
            revert StakerBlueprint.ZeroPointEmissionEvents();
        }
    }

    /**
     * Permanently forfeits owner ability to alter the emission schedule.
     * Once called, this function is intended to give peace of mind to the StakerV2's
     * developers and community that the inflation rate is now immutable.
     */
    function lockTokenEmissions()
        external
        hasValidPermit(UNIVERSAL, StakerBlueprint.LOCK_TOKEN_EMISSIONS)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        b.canAlterTokenEmissionSchedule = false;
    }

    /**
     * Permanently forfeits owner ability to alter the emission schedule.
     * Once called, this function is intended to give peace of mind to the StakerV2's
     * developers and community that the inflation rate is now immutable.
     */
    function lockPointEmissions()
        external
        hasValidPermit(UNIVERSAL, StakerBlueprint.LOCK_POINT_EMISSIONS)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        b.canAlterPointEmissionSchedule = false;
    }

    /**
     * Create or edit boosters in batch with boost parameters
     * @param _ids Array of booster IDs.
     * @param _boostInfo Array of boostInfo.
     * Should not be reconfigured if it was made public for staking Items.
     */
    function configureBoostersBatch(
        uint256[] memory _ids,
        StakerBlueprint.BoostInfo[] memory _boostInfo
    ) external hasValidPermit(UNIVERSAL, StakerBlueprint.CONFIGURE_BOOSTERS) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        if (_boostInfo.length == 0) {
            revert StakerBlueprint.EmptyBoostInfoArray();
        }
        if (_ids.length != _boostInfo.length) {
            revert StakerBlueprint.InputLengthsMismatch();
        }

        for (uint256 i; i < _boostInfo.length; ) {
            if (_ids[i] == 0) {
                revert StakerBlueprint.BoosterIdZero();
            }
            if (
                (_boostInfo[i].multiplier == 0 &&
                    _boostInfo[i].amountRequired == 0) ||
                _boostInfo[i].contractRequired == address(0)
            ) {
                revert StakerBlueprint.InvalidConfBoostersInputs();
            }
            if (
                _boostInfo[i].typeOfAsset != StakerBlueprint.AssetType.ERC721 &&
                _boostInfo[i].typeOfAsset != StakerBlueprint.AssetType.ERC1155
            ) {
                revert StakerBlueprint.InvalidConfBoostersAssetType();
            }

            unchecked {
                if (
                    b.boostInfo[_ids[i]].multiplier == 0 &&
                    _boostInfo[i].multiplier != 0
                ) {
                    b.activeBoosters++;
                } else if (
                    b.boostInfo[_ids[i]].multiplier != 0 &&
                    _boostInfo[i].multiplier == 0
                ) {
                    b.activeBoosters--;
                }
            }

            // b.boostInfo[_ids[i]].historyOfMultipliers.push(
            //     _boostInfo[i].multiplier
            // );
            if (
                b.boostInfo[_ids[i]].multiplier != _boostInfo[i].multiplier ||
                b.boostInfo[_ids[i]].boostType != _boostInfo[i].boostType
            ) {
                if (
                    _boostInfo[i].boostType ==
                    StakerBlueprint.BoosterAssetType.Tokens
                ) {
                    b.boostInfo[_ids[i]].historyOfTokenMultipliers.push(
                        _boostInfo[i].multiplier
                    );
                    b.boostInfo[_ids[i]].historyOfPointMultipliers.push(0);
                } else if (
                    _boostInfo[i].boostType ==
                    StakerBlueprint.BoosterAssetType.Points
                ) {
                    b.boostInfo[_ids[i]].historyOfTokenMultipliers.push(0);
                    b.boostInfo[_ids[i]].historyOfPointMultipliers.push(
                        _boostInfo[i].multiplier
                    );
                } else {
                    b.boostInfo[_ids[i]].historyOfTokenMultipliers.push(
                        _boostInfo[i].multiplier
                    );
                    b.boostInfo[_ids[i]].historyOfPointMultipliers.push(
                        _boostInfo[i].multiplier
                    );
                }
                recalculateShares(_ids[i], _boostInfo[i].multiplier);
            }
            b.boostInfo[_ids[i]].multiplier = _boostInfo[i].multiplier;
            b.boostInfo[_ids[i]].amountRequired = _boostInfo[i].amountRequired;
            b.boostInfo[_ids[i]].groupRequired = _boostInfo[i].groupRequired;
            b.boostInfo[_ids[i]].contractRequired = _boostInfo[i]
                .contractRequired;
            b.boostInfo[_ids[i]].boostType = _boostInfo[i].boostType;
            b.boostInfo[_ids[i]].typeOfAsset = _boostInfo[i].typeOfAsset;
            unchecked {
                ++i;
            }
        }
    }

    /**
     * Allows the contract owner to add a new asset pool to the Staker or overwrite
     * an existing one.
     * @param _addPoolStruct Struct, which we use to create new pool
     */
    function addPool(StakerBlueprint.AddPoolStruct memory _addPoolStruct)
        external
        hasValidPermit(UNIVERSAL, StakerBlueprint.ADD_POOL)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        checkInputPoolOnValid(_addPoolStruct);

        if (
            address(b.poolInfoV3[_addPoolStruct.id].assetAddress) == address(0)
        ) {
            addNewPool(_addPoolStruct);
        } else {
            changeExistingPool(_addPoolStruct);
        }
    }

    /**
     * Update the pool corresponding to the specified token address.
     * @param _poolId the id of pool to update the corresponding pool for.
     */
    function updatePool(
        uint256 _poolId,
        uint256 _boosterId,
        uint256 newMul
    ) internal {
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
        b.tpsOnBoostUpdate[_boosterId][_poolId].push(pool.tokensPerShare);
        pool.pointsPerShare += (pointsReward / pool.pointBoostedDeposit);
        b.ppsOnBoostUpdate[_boosterId][_poolId].push(pool.pointsPerShare);
        pool.lastRewardEvent = block.timestamp;

        // recalculate
        uint256 unboosted = b.boosterAmount[_poolId][_boosterId];
        uint256 oldMul = b.boostInfo[_boosterId].multiplier;
        StakerBlueprint.BoostInfo storage booster = b.boostInfo[_boosterId];
        if (booster.boostType == StakerBlueprint.BoosterAssetType.Tokens) {
            pool.tokenBoostedDeposit =
                pool.tokenBoostedDeposit -
                (unboosted * oldMul) /
                10_000 +
                (unboosted * newMul) /
                10_000;
        } else if (
            booster.boostType == StakerBlueprint.BoosterAssetType.Points
        ) {
            pool.pointBoostedDeposit =
                pool.pointBoostedDeposit -
                (unboosted * oldMul) /
                10_000 +
                (unboosted * newMul) /
                10_000;
        } else {
            pool.tokenBoostedDeposit =
                pool.tokenBoostedDeposit -
                (unboosted * oldMul) /
                10_000 +
                (unboosted * newMul) /
                10_000;
            pool.pointBoostedDeposit =
                pool.pointBoostedDeposit -
                (unboosted * oldMul) /
                10_000 +
                (unboosted * newMul) /
                10_000;
        }
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
     * Private helper that handles recalculate total boosted amount
     * and tps of pools of certain booster in case of booster multiplier
     * have changed.
     * @param boosterId Id of booster multiplier of which was changed.
     * @param newMul New multiplier of 'boosterId'.
     */
    function recalculateShares(uint256 boosterId, uint256 newMul) internal {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        //uint256[] storage _boosterPools = b.boosterPools[_boosterId];

        for (uint256 j; j < b.boosterPools[boosterId].length(); ) {
            uint256 _poolId = b.boosterPools[boosterId].at(j);
            updatePool(_poolId, boosterId, newMul);
            unchecked {
                ++j;
            }
        }
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
     * Private helper function that checks 'addPool' input on valid.
     * @param _addPoolStruct Struct with info about pool which should
     * be added.
     */
    function checkInputPoolOnValid(
        StakerBlueprint.AddPoolStruct memory _addPoolStruct
    ) private view {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        if (
            b.tokenEmissionEventsCount == 0 || b.pointEmissionEventsCount == 0
        ) {
            revert StakerBlueprint.EmissionNotSet();
        }
        if (
            _addPoolStruct.typeOfAsset != StakerBlueprint.AssetType.ERC721 &&
            (_addPoolStruct.typeOfPool ==
                StakerBlueprint.PoolType.NoStakingTiedToNFT ||
                _addPoolStruct.typeOfPool ==
                StakerBlueprint.PoolType.StakingTiedToNFT)
        ) {
            revert StakerBlueprint.WrongTypeOfPoolForTypeOfAsset();
        }

        if (_addPoolStruct.typeOfAsset == StakerBlueprint.AssetType.ERC721) {
            if (
                !IERC721(_addPoolStruct.assetAddress).supportsInterface(
                    StakerBlueprint.INTERFACE_ERC721
                )
            ) {
                revert StakerBlueprint.InvalidAsset();
            }
        } else if (
            _addPoolStruct.typeOfAsset == StakerBlueprint.AssetType.ERC1155
        ) {
            if (
                !IERC1155(_addPoolStruct.assetAddress).supportsInterface(
                    StakerBlueprint.INTERFACE_ERC1155
                )
            ) {
                revert StakerBlueprint.InvalidAsset();
            }
        }

        if (
            _addPoolStruct.tokenStrength == 0 ||
            _addPoolStruct.pointStrength == 0
        ) {
            revert StakerBlueprint.ZeroStrength();
        }
        if (
            _addPoolStruct.groupId != 0 &&
            _addPoolStruct.typeOfAsset == StakerBlueprint.AssetType.ERC20
        ) {
            revert StakerBlueprint.InvalidGroupIdForERC20();
        }
    }

    /**
     * Private helper function that determines and returns last time when
     * rewards was calculated.
     */
    function determineLastRewardEvent() private view returns (uint256) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        uint256 lastTokenRewardTime = block.timestamp >
            b.earliestTokenEmissionEvent
            ? block.timestamp
            : b.earliestTokenEmissionEvent;
        uint256 lastPointRewardTime = block.timestamp >
            b.earliestPointEmissionEvent
            ? block.timestamp
            : b.earliestPointEmissionEvent;
        uint256 lastRewardEvent = lastTokenRewardTime > lastPointRewardTime
            ? lastTokenRewardTime
            : lastPointRewardTime;

        return lastRewardEvent;
    }

    /**
     * Private helper function that handles adds of the new pool.
     * @param _addPoolStruct Struct that contains info about new pool.
     */
    function addNewPool(StakerBlueprint.AddPoolStruct memory _addPoolStruct)
        private
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        uint256 lastRewardEvent = determineLastRewardEvent();

        b.poolAssets.push(_addPoolStruct.assetAddress);
        b.totalTokenStrength =
            b.totalTokenStrength +
            _addPoolStruct.tokenStrength;
        b.totalPointStrength =
            b.totalPointStrength +
            _addPoolStruct.pointStrength;

        b.poolInfoV3[_addPoolStruct.id].assetAddress = _addPoolStruct
            .assetAddress;
        b.poolInfoV3[_addPoolStruct.id].tokenStrength = _addPoolStruct
            .tokenStrength;
        b.poolInfoV3[_addPoolStruct.id].tokensPerShare = _addPoolStruct
            .tokensPerShare;
        b.poolInfoV3[_addPoolStruct.id].pointStrength = _addPoolStruct
            .pointStrength;
        b.poolInfoV3[_addPoolStruct.id].pointsPerShare = _addPoolStruct
            .pointsPerShare;

        if (
            _addPoolStruct.typeOfPool ==
            StakerBlueprint.PoolType.NoStakingTiedToHolder ||
            _addPoolStruct.typeOfPool ==
            StakerBlueprint.PoolType.NoStakingTiedToNFT
        ) {
            b.poolInfoV3[_addPoolStruct.id].tokenBoostedDeposit = ISuperGeneric(
                _addPoolStruct.assetAddress
            ).totalSupply();
            b.poolInfoV3[_addPoolStruct.id].pointBoostedDeposit = ISuperGeneric(
                _addPoolStruct.assetAddress
            ).totalSupply();
        } else {
            b.poolInfoV3[_addPoolStruct.id].tokenBoostedDeposit = 0;
            b.poolInfoV3[_addPoolStruct.id].pointBoostedDeposit = 0;
        }
        b.poolInfoV3[_addPoolStruct.id].groupId = _addPoolStruct.groupId;
        b.poolInfoV3[_addPoolStruct.id].lastRewardEvent = lastRewardEvent;
        b.poolInfoV3[_addPoolStruct.id].boostInfo = _addPoolStruct.boostInfo;
        for (uint256 i; i < _addPoolStruct.boostInfo.length; ) {
            b.boosterPools[_addPoolStruct.boostInfo[i]].add(_addPoolStruct.id);
            unchecked {
                ++i;
            }
        }
        b.poolInfoV3[_addPoolStruct.id].typeOfPool = _addPoolStruct.typeOfPool;
        b.poolInfoV3[_addPoolStruct.id].typeOfAsset = _addPoolStruct
            .typeOfAsset;
    }

    /**
     * Private helper function that handles changes of the existing pool.
     * @param _addPoolStruct Struct that contains info about changes of the pool.
     */
    function changeExistingPool(
        StakerBlueprint.AddPoolStruct memory _addPoolStruct
    ) private {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        b.totalTokenStrength =
            (b.totalTokenStrength -
                b.poolInfoV3[_addPoolStruct.id].tokenStrength) +
            _addPoolStruct.tokenStrength;
        b.poolInfoV3[_addPoolStruct.id].tokenStrength = _addPoolStruct
            .tokenStrength;
        b.totalPointStrength =
            (b.totalPointStrength -
                b.poolInfoV3[_addPoolStruct.id].pointStrength) +
            _addPoolStruct.pointStrength;
        b.poolInfoV3[_addPoolStruct.id].pointStrength = _addPoolStruct
            .pointStrength;

        for (uint256 i; i < _addPoolStruct.boostInfo.length; ) {
            if (
                !b.boosterPools[_addPoolStruct.boostInfo[i]].contains(
                    _addPoolStruct.id
                )
            ) {
                b.boosterPools[_addPoolStruct.boostInfo[i]].add(
                    _addPoolStruct.id
                );
                b.poolInfoV3[_addPoolStruct.id].boostInfo.push(
                    _addPoolStruct.boostInfo[i]
                );
            }
            unchecked {
                ++i;
            }
        }
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
