// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../interfaces/ISuperGeneric.sol";
// import "../../assets/erc721/interfaces/ISuper721.sol";

import "../staker/v3ds/StakerV3Blueprint.sol";
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
contract TestStakerV3FacetCore {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    /**
     * A function that needs to be called immediately after deployment.
     * Sets the owner of the newly deployed proxy.
     */
    function initialize(address _owner) external returns (bytes memory) {
        return msg.data;
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
        returns (bytes memory)
    {
        return msg.data;
    }

    /**
     * Permanently forfeits owner ability to alter the state of StakerV2 developers.
     * Once called, this function is intended to give peace of mind to the StakerV2's
     * developers and community that the fee structure is now immutable.
     */
    function lockDevelopers() external returns (bytes memory) {
        return msg.data;
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
        returns (bytes memory)
    {
        return msg.data;
    }

    /**
     * Set new emission details to the StakerV2 or overwrite existing ones.
     * This operation requires that emission schedule alteration is not locked.
     * @param _tokenSchedule an array of EmissionPoints defining the token schedule.
     * @param _pointSchedule an array of EmissionPoints defining the point schedule.
     */
    function setEmissions(
        StakerV3Blueprint.EmissionPoint[] memory _tokenSchedule,
        StakerV3Blueprint.EmissionPoint[] memory _pointSchedule
    ) external returns (bytes memory) {
        return msg.data;
    }

    /**
     * Permanently forfeits owner ability to alter the emission schedule.
     * Once called, this function is intended to give peace of mind to the StakerV2's
     * developers and community that the inflation rate is now immutable.
     */
    function lockTokenEmissions() external returns (bytes memory) {
        return msg.data;
    }

    /**
     * Permanently forfeits owner ability to alter the emission schedule.
     * Once called, this function is intended to give peace of mind to the StakerV2's
     * developers and community that the inflation rate is now immutable.
     */
    function lockPointEmissions() external returns (bytes memory) {
        return msg.data;
    }

    /**
     * Create or edit boosters in batch with boost parameters
     * @param _ids array of booster IDs.
     * @param _boostInfo array of boostInfo.
     * Should not be reconfigured if it was made public for staking Items.
     */
    function configureBoostersBatch(
        uint256[] memory _ids,
        StakerV3Blueprint.BoostInfo[] memory _boostInfo
    ) external returns (bytes memory) {
        return msg.data;
    }

    /**
     * Allows the contract owner to add a new asset pool to the Staker or overwrite
     * an existing one.
     * @param _addPoolStruct struct, which we use to create new pool
     */
    function addPool(StakerV3Blueprint.AddPoolStruct memory _addPoolStruct)
        external
        returns (bytes memory)
    {
        return msg.data;
    }

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes memory) {
        return msg.data;
    }
}
