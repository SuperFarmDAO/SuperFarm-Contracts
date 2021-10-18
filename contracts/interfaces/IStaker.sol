// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.8;

interface IStaker {
    function spendPoints(address _user, uint256 _amount) external;

    function getAvailablePoints(address _user) external view returns (uint256);
}
