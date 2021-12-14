// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/Address.sol";
import "./IMulticall.sol";
import "hardhat/console.sol";


contract Multicall is IMulticall {

    constructor() {}

    function staticCall(Call[] memory calls) external view returns (bytes[] memory data) {
        data = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            data[i] = Address.functionStaticCall(calls[i].target, calls[i].callData);
            console.logBytes(data[i]);
        }
    }
}