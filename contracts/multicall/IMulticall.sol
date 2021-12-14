// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

interface IMulticall {


    struct Call {
        address target;
        bytes callData;
    }
    
    function staticCall(Call[] memory calls) external view returns (bytes[] memory data);
}
