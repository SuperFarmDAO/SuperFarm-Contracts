// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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
contract StakerV3FacetViews is Sweepableds {
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;

    /**
     * Allows to get information about tokens staked in a booster for Items staker address.
     * @param _itemUserAddress The user address to check.
     * @param _boosterId The booster Id to check the tokens staked for.
     * @return A struct containing the information.
     */
    function getItemsUserInfo(address _itemUserAddress, uint256 _boosterId)
        external
        view
        returns (StakerBlueprint.GetItemUserInfo memory)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        uint256 length = b
            .itemUserInfo[_itemUserAddress]
            .tokenIds[_boosterId]
            .length();
        uint256[] memory _tokenIds = new uint256[](length);
        uint256[] memory _amounts = new uint256[](length);
        for (uint256 i = 0; i < length; ) {
            _tokenIds[i] = b
                .itemUserInfo[_itemUserAddress]
                .tokenIds[_boosterId]
                .at(i);
            _amounts[i] = b.itemUserInfo[_itemUserAddress].amounts[
                _tokenIds[i]
            ];
            unchecked {
                ++i;
            }
        }

        StakerBlueprint.GetItemUserInfo memory _userInfo = StakerBlueprint
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
     * @return Developers array of developers addresses.
     */
    function getDeveloperAddresses() external view returns (address[] memory) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        uint256 developerAddressLength = b.developerAddresses.length();
        address[] memory developers = new address[](developerAddressLength);
        for (uint256 i; i < developerAddressLength; ) {
            developers[i] = b.developerAddresses.at(i);
            unchecked {
                ++i;
            }
        }
        return developers;
    }

    /**
     * Returns info about current developer share.
     * @param developer Address of developer whose share should be returned.
     */
    function getDeveloperShare(address developer)
        external
        view
        returns (uint256 share)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();
        share = b.developerShares[developer];
    }

    /**
     * Returns the length of the staking pool array.
     * @return The length of the staking pool array.
     */
    function getPoolCount() external view returns (uint256) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        return b.poolAssets.length;
    }

    /**
     * Returns info about pool by id at staking.
     * @return _poolInfo Info about pool by id at staking.
     */
    function getPoolInfo(uint256 id)
        external
        view
        returns (StakerBlueprint.PoolInfo memory _poolInfo)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        _poolInfo = b.poolInfoV3[id];
    }

    /**
     * Returns the count of active boosters at staking.
     * @return The count of active boosters at staking.
     */
    function getBoostersCount() external view returns (uint256) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        return b.activeBoosters;
    }

    /**
     * Returns info about boost by id at staking.
     * @return _boostInfo Info about boost by id at staking.
     */
    function getBoosterInfo(uint256 id)
        external
        view
        returns (StakerBlueprint.BoostInfo memory _boostInfo)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        _boostInfo = b.boostInfo[id];
    }
}
