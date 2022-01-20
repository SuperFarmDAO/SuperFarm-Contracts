// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "./IMulticall.sol";

contract Multicall is IMulticall {
    uint256 MAX_UINT = type(uint256).max;

    constructor() {}

    function staticCallBytes(Call[] memory calls)
        external
        view
        virtual
        returns (bytes[] memory)
    {
        bytes[] memory output = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory res) = calls[i].target.staticcall(
                calls[i].callData
            );
            require(success, "Staticcall failed");
            output[i] = res;
        }
    }

    function staticCallUint(Call[] memory calls)
        external
        view
        virtual
        returns (uint256[] memory)
    {
        uint256[] memory output = new uint256[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory res) = calls[i].target.staticcall(
                calls[i].callData
            );
            require(success, "Staticcall failed");
            output[i] = bytesToUint256(32, res);
        }
    }

    function staticCallUintSumm(Call[] memory calls)
        external
        view
        virtual
        returns (uint256 summ)
    {
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory res) = calls[i].target.staticcall(
                calls[i].callData
            );
            require(success, "Staticcall failed");
            summ += bytesToUint256(32, res);
        }
    }

    function bytesToAddress(uint256 _offst, bytes memory _input)
        internal
        pure
        returns (address _output)
    {
        assembly {
            _output := mload(add(_input, _offst))
        }
    }

    function bytesToUint256(uint256 _offst, bytes memory _input)
        private
        pure
        returns (uint256 _output)
    {
        assembly {
            _output := mload(add(_input, _offst))
        }
    }
}
