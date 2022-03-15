// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../base/Sweepableds.sol";
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
contract TestStakerV3FacetViews is
    Sweepableds,
    ReentrancyGuard,
    ERC1155Holder,
    IERC721Receiver
{
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    /**
     * Allows to get information about tokens staked in a booster for Items staker address.
     * @param _itemUserAddress the user address to check.
     * @param _boosterId the booster Id to check the tokens staked for.
     * @return a struct containing the information.
     */
    function getItemsUserInfo(address _itemUserAddress, uint256 _boosterId)
        external
        view
        returns (bytes memory)
    {
        return msg.data;
    }

    function getDeveloperAddresses() external view returns (bytes memory) {
        return msg.data;
    }

    function getDeveloperShare(address developer)
        external
        view
        returns (bytes memory)
    {
        return msg.data;
    }

    function getBoostersCount() external view returns (bytes memory) {
        return msg.data;
    }

    function getBoosterInfo(uint256 id) external view returns (bytes memory) {
        return msg.data;
    }

    /**
     * Returns the length of the staking pool array.
     * @return the length of the staking pool array.
     */
    function getPoolCount() external view returns (bytes memory) {
        return msg.data;
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
