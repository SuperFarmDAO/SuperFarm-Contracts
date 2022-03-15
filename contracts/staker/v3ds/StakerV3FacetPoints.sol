// // SPDX-License-Identifier: GPL-3.0
// pragma solidity ^0.8.7;

// import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
// import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
// import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
// import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

// import "../../base/Sweepableds.sol";
// import "../../interfaces/ISuperGeneric.sol";
// // import "../../assets/erc721/interfaces/ISuper721.sol";

// import "./StakerV3Blueprint.sol";

// /**
//  * @title An asset staking contract.
//  * @author Tim Clancy
//  * @author Qazawat Zirak
//  * @author Nikita Elunin
//  * This staking contract disburses tokens from its internal reservoir according
//  * to a fixed emission schedule. Assets can be assigned varied staking weights.
//  * It also supports Items staking for boosts on native ERC20 staking rewards.
//  * The item staking supports Fungible, Non-Fungible and Semi-Fungible staking.
//  * This code is inspired by and modified from Sushi's Master Chef contract.
//  * https://github.com/sushiswap/sushiswap/blob/master/contracts/MasterChef.sol
//  */
// contract StakerV3FacetPoints is
//     Sweepableds,
//     ReentrancyGuard,
//     ERC1155Holder,
//     IERC721Receiver
// {
//     using SafeERC20 for IERC20;
//     using EnumerableSet for EnumerableSet.UintSet;
//     using EnumerableSet for EnumerableSet.AddressSet;

//     /// An event for tracking when a user has spent points.
//     event SpentPoints(
//         address indexed source,
//         address indexed user,
//         uint256 amount
//     );

//     /**
//      * Return the number of points that the user has available to spend.
//      * @return the number of points that the user has available to spend.
//      */
//     function getAvailablePoints(address _user) public view returns (uint256) {
//         StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
//             .stakerV3StateVariables();

//         //uint256 currentTotal = b.userPoints[_user];
//         uint256 pendingTotal = 0;
//         for (uint256 i; i < b.lastPoolId; i++) {
//             uint256 _pendingPoints = getPendingPoints(i, _user);
//             pendingTotal += _pendingPoints;
//         }
//         //uint256 spentTotal = b.userSpentPoints[_user];
//         return (b.userPoints[_user] + pendingTotal) - b.userSpentPoints[_user];
//     }

//     /**
//      * Allows the owner of this Staker to grant or remove approval to an external
//      * spender of the points that users accrue from staking resources.
//      * @param _spender The external address allowed to spend user points.
//      * @param _approval The updated user approval status.
//      */
//     function approvePointSpender(address _spender, bool _approval)
//         external
//         hasValidPermit(UNIVERSAL, StakerV3Blueprint.APPROVE_POINT_SPENDER)
//     {
//         StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
//             .stakerV3StateVariables();

//         b.approvedPointSpenders[_spender] = _approval;
//     }

//     /**
//      * Allows an approved spender of points to spend points on behalf of a user.
//      * @param _user The user whose points are being spent.
//      * @param _amount The amount of the user's points being spent.
//      */
//     function spendPoints(address _user, uint256 _amount) external {
//         StakerV3Blueprint.StakerV3StateVariables storage b = StakerV3Blueprint
//             .stakerV3StateVariables();

//         require(b.approvedPointSpenders[msg.sender], "0x3E");
//         // uint256 _userPoints = getAvailablePoints(_user);
//         require(getAvailablePoints(_user) >= _amount, "0x4E");
//         b.userSpentPoints[_user] += _amount;
//         emit SpentPoints(msg.sender, _user, _amount);
//     }
// }
