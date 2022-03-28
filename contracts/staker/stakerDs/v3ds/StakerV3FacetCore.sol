// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
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

    error CantAlterDevs();
    error ZeroDevShare();
    error CantIncreaseDevShare();
    error InvalidNewAddress();
    error CantAlterTokenEmissionSchedule();
    error CantAlterPointEmissionSchedule();
    error ZeroTokenEmissionEvents();
    error ZeroPointEmissionEvents();
    error EmptyBoostInfoArray();
    error InputLengthsMismatch();
    error BoosterIdZero();
    error InvalidConfBoostersInputs();
    error InvalidConfBoostersAssetType();
    error EmissionNotSet();
    error ZeroStrength();
    error InvalidAsset();
    error InvalidTypeOfAsset();

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
     * @param _developerAddress the additional developer's address.
     * @param _share the share in 1/1000th of a percent of each token emission sent
     *   to this new developer.
     */
    function addDeveloper(address _developerAddress, uint256 _share)
        external
        hasValidPermit(UNIVERSAL, StakerBlueprint.ADD_DEVELOPER)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        if (!b.canAlterDevelopers) {
            revert CantAlterDevs();
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
     * Note that updating a developer's share to zero effectively removes them.
     * @param _newDeveloperAddress an address to update this developer's address.
     * @param _newShare the new share in 1/1000th of a percent of each token
     *   emission sent to this developer.
     */
    function updateDeveloper(address _newDeveloperAddress, uint256 _newShare)
        external
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        uint256 developerShare = b.developerShares[msg.sender];
        if (developerShare == 0) {
            revert ZeroDevShare();
        }
        if (_newShare > developerShare) {
            revert CantIncreaseDevShare();
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
                    revert InvalidNewAddress();
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
     * @param _tokenSchedule an array of EmissionPoints defining the token schedule.
     * @param _pointSchedule an array of EmissionPoints defining the point schedule.
     */
    function setEmissions(
        StakerBlueprint.EmissionPoint[] memory _tokenSchedule,
        StakerBlueprint.EmissionPoint[] memory _pointSchedule
    ) external hasValidPermit(UNIVERSAL, StakerBlueprint.SET_EMISSIONS) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        if (_tokenSchedule.length > 0) {
            if (!b.canAlterTokenEmissionSchedule) {
                revert CantAlterTokenEmissionSchedule();
            }
            b.tokenEmissionEventsCount = _tokenSchedule.length;
            for (uint256 i; i < b.tokenEmissionEventsCount; i++) {
                b.tokenEmissionEvents[i] = _tokenSchedule[i];
                if (
                    b.earliestTokenEmissionEvent > _tokenSchedule[i].timeStamp
                ) {
                    b.earliestTokenEmissionEvent = _tokenSchedule[i].timeStamp;
                }
            }
        }
        if (b.tokenEmissionEventsCount == 0) {
            revert ZeroTokenEmissionEvents();
        }

        if (_pointSchedule.length > 0) {
            if (!b.canAlterPointEmissionSchedule) {
                revert CantAlterPointEmissionSchedule();
            }
            b.pointEmissionEventsCount = _pointSchedule.length;
            for (uint256 i; i < b.pointEmissionEventsCount; i++) {
                b.pointEmissionEvents[i] = _pointSchedule[i];
                if (
                    b.earliestPointEmissionEvent > _pointSchedule[i].timeStamp
                ) {
                    b.earliestPointEmissionEvent = _pointSchedule[i].timeStamp;
                }
            }
        }
        if (b.pointEmissionEventsCount == 0) {
            revert ZeroPointEmissionEvents();
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
     * @param _ids array of booster IDs.
     * @param _boostInfo array of boostInfo.
     * Should not be reconfigured if it was made public for staking Items.
     */
    function configureBoostersBatch(
        uint256[] memory _ids,
        StakerBlueprint.BoostInfo[] memory _boostInfo
    ) external hasValidPermit(UNIVERSAL, StakerBlueprint.CONFIGURE_BOOSTERS) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        if (_boostInfo.length == 0) {
            revert EmptyBoostInfoArray();
        }
        if (_ids.length != _boostInfo.length) {
            revert InputLengthsMismatch();
        }

        for (uint256 i; i < _boostInfo.length; i++) {
            if (_ids[i] == 0) {
                revert BoosterIdZero();
            }
            if (
                (_boostInfo[i].multiplier == 0 &&
                    _boostInfo[i].amountRequired == 0) ||
                _boostInfo[i].contractRequired == address(0)
            ) {
                revert InvalidConfBoostersInputs();
            }
            if (
                _boostInfo[i].typeOfAsset !=
                StakerBlueprint.PoolAssetType.ERC721 &&
                _boostInfo[i].typeOfAsset !=
                StakerBlueprint.PoolAssetType.ERC1155
            ) {
                revert InvalidConfBoostersAssetType();
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
            b.boostInfo[_ids[i]].multiplier = _boostInfo[i].multiplier;
            b.boostInfo[_ids[i]].amountRequired = _boostInfo[i].amountRequired;
            b.boostInfo[_ids[i]].groupRequired = _boostInfo[i].groupRequired;
            b.boostInfo[_ids[i]].contractRequired = _boostInfo[i]
                .contractRequired;
            b.boostInfo[_ids[i]].assetType = _boostInfo[i].assetType;
            b.boostInfo[_ids[i]].typeOfAsset = _boostInfo[i].typeOfAsset;
        }
    }

    /**
     * Allows the contract owner to add a new asset pool to the Staker or overwrite
     * an existing one.
     * @param _addPoolStruct struct, which we use to create new pool
     */
    function addPool(StakerBlueprint.AddPoolStruct memory _addPoolStruct)
        external
        hasValidPermit(UNIVERSAL, StakerBlueprint.ADD_POOL)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        if (
            b.tokenEmissionEventsCount == 0 || b.pointEmissionEventsCount == 0
        ) {
            revert EmissionNotSet();
        }

        if (_addPoolStruct.typeOfAsset == StakerBlueprint.PoolAssetType.ERC20) {
            revert InvalidTypeOfAsset();
        }

        if (
            _addPoolStruct.typeOfAsset == StakerBlueprint.PoolAssetType.ERC721
        ) {
            if (
                !IERC721(_addPoolStruct.assetAddress).supportsInterface(
                    StakerBlueprint.INTERFACE_ERC721
                )
            ) {
                revert InvalidAsset();
            }
        } else {
            if (
                !IERC1155(_addPoolStruct.assetAddress).supportsInterface(
                    StakerBlueprint.INTERFACE_ERC1155
                )
            ) {
                revert InvalidAsset();
            }
        }

        if (
            _addPoolStruct.tokenStrength == 0 ||
            _addPoolStruct.pointStrength == 0
        ) {
            revert ZeroStrength();
        }

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
        if (
            address(b.poolInfoV3[_addPoolStruct.id].assetAddress) == address(0)
        ) {
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
            b.poolInfoV3[_addPoolStruct.id].tokenBoostedDeposit = 0;
            b.poolInfoV3[_addPoolStruct.id].tokensPerShare = _addPoolStruct
                .tokensPerShare;
            b.poolInfoV3[_addPoolStruct.id].pointStrength = _addPoolStruct
                .pointStrength;
            b.poolInfoV3[_addPoolStruct.id].pointBoostedDeposit = 0;
            b.poolInfoV3[_addPoolStruct.id].pointsPerShare = _addPoolStruct
                .pointsPerShare;
            b.poolInfoV3[_addPoolStruct.id].lastRewardEvent = lastRewardEvent;
            b.poolInfoV3[_addPoolStruct.id].boostInfo = _addPoolStruct
                .boostInfo;
            b.poolInfoV3[_addPoolStruct.id].typeOfAsset = _addPoolStruct
                .typeOfAsset;
            b.poolInfoV3[_addPoolStruct.id].lockPeriod = _addPoolStruct
                .lockPeriod;
            b.poolInfoV3[_addPoolStruct.id].lockAmount = _addPoolStruct
                .lockAmount;
            b.poolInfoV3[_addPoolStruct.id].lockMultiplier = _addPoolStruct
                .lockMultiplier;
            b
                .poolInfoV3[_addPoolStruct.id]
                .compoundInterestTreshold = _addPoolStruct
                .compoundInterestTreshold;
            b
                .poolInfoV3[_addPoolStruct.id]
                .compoundInterestMultiplier = _addPoolStruct
                .compoundInterestMultiplier;
            b.poolInfoV3[_addPoolStruct.id].typeOfBoost = _addPoolStruct
                .typeOfBoost;
        } else {
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

            b.poolInfoV3[_addPoolStruct.id].lockPeriod = _addPoolStruct
                .lockPeriod;
            b.poolInfoV3[_addPoolStruct.id].lockAmount = _addPoolStruct
                .lockAmount;
            b.poolInfoV3[_addPoolStruct.id].lockMultiplier = _addPoolStruct
                .lockMultiplier;
            b
                .poolInfoV3[_addPoolStruct.id]
                .compoundInterestTreshold = _addPoolStruct
                .compoundInterestTreshold;
            b
                .poolInfoV3[_addPoolStruct.id]
                .compoundInterestMultiplier = _addPoolStruct
                .compoundInterestMultiplier;
            b.poolInfoV3[_addPoolStruct.id].typeOfBoost = _addPoolStruct
                .typeOfBoost;

            // Append boosters by avoid writing to storage directly in a loop to avoid costs
            uint256[] memory boosters = new uint256[](
                b.poolInfoV3[_addPoolStruct.id].boostInfo.length +
                    _addPoolStruct.boostInfo.length
            );
            for (
                uint256 i;
                i < b.poolInfoV3[_addPoolStruct.id].boostInfo.length;
                i++
            ) {
                boosters[i] = b.poolInfoV3[_addPoolStruct.id].boostInfo[i];
            }
            for (uint256 i; i < _addPoolStruct.boostInfo.length; i++) {
                boosters[
                    i + b.poolInfoV3[_addPoolStruct.id].boostInfo.length
                ] = _addPoolStruct.boostInfo[i];
            }
            b.poolInfoV3[_addPoolStruct.id].boostInfo = boosters; // Appended boosters
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
