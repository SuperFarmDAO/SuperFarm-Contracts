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
contract StakerV1FacetViews is Sweepableds, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;

    /**
     * Allows to get information about all developers that will get % by stakers rewatds.
     * @return developers array of developers addresses.
     */
    function getDeveloperAddresses() external view returns (address[] memory) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

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
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();
        share = b.developerShares[developer];
    }

    /**
     * Returns the length of the staking pool array.
     * @return the length of the staking pool array.
     */
    function getPoolCount() external view returns (uint256) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        return b.poolTokens.length;
    }

    /**
     * Returns the amount of token that has not been disbursed by the Staker yet.
     * @return the amount of token that has not been disbursed by the Staker yet.
     */
    function getRemainingToken() external view returns (uint256) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        return IERC20(b.token).balanceOf(address(this));
    }

    /**
     * Return the total number of points that the user has ever spent.
     * @return the total number of points that the user has ever spent.
     */
    function getSpentPoints(address _user) external view returns (uint256) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        return b.userSpentPoints[_user];
    }

    /**
     * Returns the length of the developer address array.
     * @return the length of the developer address array.
     */
    function getDeveloperCount() external view returns (uint256) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        return b.developerAddresses.length();
    }
}
