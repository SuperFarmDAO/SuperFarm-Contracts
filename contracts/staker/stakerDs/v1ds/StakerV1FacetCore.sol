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
contract StakerV1FacetCore is Sweepableds, ReentrancyGuard {
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
     * @param _developerAddress the additional developer's address.
     * @param _share the share in 1/1000th of a percent of each token emission sent
     *   to this new developer.
     */
    function addDeveloper(address _developerAddress, uint256 _share)
        external
        onlyOwner
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        require(b.canAlterDevelopers, "Devs locked.");
        b.developerAddresses.add(_developerAddress);
        b.developerShares[_developerAddress] = _share;
    }

    /**
     * Permanently forfeits owner ability to alter the state of StakerV2 developers.
     * Once called, this function is intended to give peace of mind to the StakerV2's
     * developers and community that the fee structure is now immutable.
     */
    function lockDevelopers() external onlyOwner {
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
        require(developerShare > 0, "0 shares.");
        require(_newShare <= developerShare, "Increase unsupported.");
        if (_newShare == 0) {
            b.developerAddresses.remove(msg.sender);
            delete b.developerShares[msg.sender];
        } else {
            if (_newDeveloperAddress != msg.sender) {
                require(
                    b.developerShares[_newDeveloperAddress] == 0 &&
                        _newDeveloperAddress != address(0),
                    "Invalid address"
                );
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
    ) external onlyOwner {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        if (_tokenSchedule.length > 0) {
            require(
                b.canAlterTokenEmissionSchedule,
                "This Staker has locked the alteration of token emissions."
            );
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
        require(
            b.tokenEmissionEventsCount > 0,
            "You must set the token emission schedule."
        );

        if (_pointSchedule.length > 0) {
            require(
                b.canAlterPointEmissionSchedule,
                "This Staker has locked the alteration of point emissions."
            );
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
        require(
            b.pointEmissionEventsCount > 0,
            "You must set the point emission schedule."
        );
    }

    /**
     * Permanently forfeits owner ability to alter the emission schedule.
     * Once called, this function is intended to give peace of mind to the StakerV2's
     * developers and community that the inflation rate is now immutable.
     */
    function lockTokenEmissions() external onlyOwner {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        b.canAlterTokenEmissionSchedule = false;
    }

    /**
     * Permanently forfeits owner ability to alter the emission schedule.
     * Once called, this function is intended to give peace of mind to the StakerV2's
     * developers and community that the inflation rate is now immutable.
     */
    function lockPointEmissions() external onlyOwner {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        b.canAlterPointEmissionSchedule = false;
    }

    /**
     * Allows the contract owner to add a new asset pool to the Staker or overwrite
     * an existing one.
     */
    function addPool(StakerBlueprint.AddPoolStruct memory _addPoolStruct)
        external
        onlyOwner
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        require(
            b.tokenEmissionEventsCount > 0 && b.pointEmissionEventsCount > 0,
            "0x1D"
        );
        require(_addPoolStruct.assetAddress != address(b.token), "0x2D");
        require(
            _addPoolStruct.tokenStrength > 0 &&
                _addPoolStruct.pointStrength > 0,
            "0x3D"
        );

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
        IERC20 _token = IERC20(_addPoolStruct.assetAddress);
        if (b.poolInfo[_token].assetAddress == address(0)) {
            b.poolTokens.push(_token);
            b.totalTokenStrength =
                b.totalTokenStrength +
                _addPoolStruct.tokenStrength;
            b.totalPointStrength =
                b.totalPointStrength +
                _addPoolStruct.pointStrength;

            b.poolInfo[_token].assetAddress = _addPoolStruct.assetAddress;
            b.poolInfo[_token].tokenStrength = _addPoolStruct.tokenStrength;
            b.poolInfo[_token].tokenBoostedDeposit = 0;
            b.poolInfo[_token].tokensPerShare = 0;
            b.poolInfo[_token].pointStrength = _addPoolStruct.pointStrength;
            b.poolInfo[_token].pointBoostedDeposit = 0;
            b.poolInfo[_token].pointsPerShare = 0;
            b.poolInfo[_token].lastRewardEvent = lastRewardEvent;
            b.poolInfo[_token].boostInfo = new uint256[](0);
            b.poolInfo[_token].typeOfAsset = StakerBlueprint
                .PoolAssetType
                .ERC20;
            b.poolInfo[_token].lockPeriod = _addPoolStruct.lockPeriod;
            b.poolInfo[_token].lockAmount = _addPoolStruct.lockAmount;
            b.poolInfo[_token].lockMultiplier = _addPoolStruct.lockMultiplier;
            b.poolInfo[_token].timeLockTypeOfBoost = _addPoolStruct
                .timeLockTypeOfBoost;
            b.poolInfo[_token].compoundTypeOfBoost = _addPoolStruct
                .compoundTypeOfBoost;
        } else {
            b.totalTokenStrength =
                (b.totalTokenStrength - b.poolInfo[_token].tokenStrength) +
                _addPoolStruct.tokenStrength;
            b.poolInfo[_token].tokenStrength = _addPoolStruct.tokenStrength;
            b.totalPointStrength =
                (b.totalPointStrength - b.poolInfo[_token].pointStrength) +
                _addPoolStruct.pointStrength;
            b.poolInfo[_token].pointStrength = _addPoolStruct.pointStrength;

            b.poolInfo[_token].lockPeriod = _addPoolStruct.lockPeriod;
            b.poolInfo[_token].lockAmount = _addPoolStruct.lockAmount;
            b.poolInfo[_token].lockMultiplier = _addPoolStruct.lockMultiplier;
            b.poolInfo[_token].timeLockTypeOfBoost = _addPoolStruct
                .timeLockTypeOfBoost;
            b.poolInfo[_token].compoundTypeOfBoost = _addPoolStruct
                .compoundTypeOfBoost;
        }
    }
}
