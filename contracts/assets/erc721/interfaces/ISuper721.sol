// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;


interface ISuper721 {

    function balanceOfGroup(address _owner, uint256 _id) external view returns (uint256);

    function balanceOf(address _owner) external view returns (uint256);
}
