// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

/**
    @title Super721 interface 
    Interface for interacting with Super721 contract
 */
interface IStaker {
    function updateOnIouTransfer(
        uint256 _poolId,
        uint256 _tokenId,
        address _from,
        address _to
    ) external;
}
