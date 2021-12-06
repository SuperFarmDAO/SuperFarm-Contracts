// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.8;

/// @title interface for interacting with Staker contract.
interface IStaker {

    /**
        Allows an approved spender of points to spend points on behalf of a user.
        @param _user The user whose points are being spent.
        @param _amount The amount of the user's points being spent.
    */
    function spendPoints(address _user, uint256 _amount) external;

    /**
        Return the number of points that the user has available to spend.
        @return the number of points that the user has available to spend.
    */
    function getAvailablePoints(address _user) external view returns (uint256);
}
