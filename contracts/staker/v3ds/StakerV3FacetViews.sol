// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../../base/Sweepableds.sol";
import "../../interfaces/ISuperGeneric.sol";
// import "../../assets/erc721/interfaces/ISuper721.sol";

import "./StakerV3Blueprint.sol";

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
contract StakerV3FacetViews is
    Sweepableds,
    ReentrancyGuard,
    ERC1155Holder,
    IERC721Receiver
{
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;

    /**
     * Allows to get information about tokens staked in a booster for Items staker address.
     * @param _itemUserAddress the user address to check.
     * @param _boosterId the booster Id to check the tokens staked for.
     * @return a struct containing the information.
     */
    function getItemsUserInfo(address _itemUserAddress, uint256 _boosterId)
        external
        view
        returns (StakerV3Blueprint.GetItemUserInfo memory)
    {
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();

        uint256 length = b
            .itemUserInfo[_itemUserAddress]
            .tokenIds[_boosterId]
            .length();
        uint256[] memory _tokenIds = new uint256[](length);
        uint256[] memory _amounts = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            _tokenIds[i] = b
                .itemUserInfo[_itemUserAddress]
                .tokenIds[_boosterId]
                .at(i);
            _amounts[i] = b.itemUserInfo[_itemUserAddress].amounts[
                _tokenIds[i]
            ];
        }

        StakerV3Blueprint.GetItemUserInfo memory _userInfo = StakerV3Blueprint
            .GetItemUserInfo({
                boosterId: _boosterId,
                tokenIds: _tokenIds,
                amounts: _amounts,
                totalItems: b.itemUserInfo[_itemUserAddress].totalItems
            });
        return _userInfo;
    }

    /**
     * Allows to get information about all developers that will get % by stakers rewatds.
     * @return developers array of developers addresses.
     */
    function getDeveloperAddresses() external view returns (address[] memory) {
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();

        uint256 developerAddressLength = b.developerAddresses.length();
        address[] memory developers = new address[](developerAddressLength);
        for (uint256 i; i < developerAddressLength; i++) {
            developers[i] = b.developerAddresses.at(i);
        }
        return developers;
    }

    function getDeveloperShare(address developer)
        external
        view
        returns (uint256 share)
    {
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();
        share = b.developerShares[developer];
    }

    /**
     * Returns the length of the staking pool array.
     * @return the length of the staking pool array.
     */
    function getPoolCount() external view returns (uint256) {
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();

        return b.poolAssets.length;
    }

    /**
     * Returns the count of active boosters at staking.
     * @return the count of active boosters at staking.
     */
    function getBoostersCount() external view returns (uint256) {
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();

        return b.activeBoosters;
    }

    /**
     * Returns info about boost by id at staking.
     * @return _boostInfo info about boost by id at staking.
     */
    function getBoosterInfo(uint256 id)
        external
        view
        returns (StakerV3Blueprint.BoostInfo memory _boostInfo)
    {
        StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
            .stakerV3StateVariables();

        _boostInfo = b.boostInfo[id];
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
