// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

interface IMulticall {
    struct Call {
        address target;
        bytes callData;
    }

    function staticCallBytes(Call[] memory calls)
        external
        view
        returns (bytes[] memory);

    function staticCallUintSumm(Call[] memory calls)
        external
        view
        returns (uint256 result);

    function staticCallUint(Call[] memory calls)
        external
        view
        returns (uint256[] memory);
}
