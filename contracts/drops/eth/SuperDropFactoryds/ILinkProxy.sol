// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

/**
    @title Interface for interaction with LinkProxy contract.
 */
interface ILinkProxy {
    function links(bytes32) external returns (address);
}
