// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

// import "@openzeppelin/contracts/utils/Address.sol";
import "./IMulticall.sol";
// import "../libraries/DFStorage.sol";
import "hardhat/console.sol";


contract Multicall is IMulticall {
    uint256 MAX_UINT = type(uint256).max;

    constructor() {}

    function staticCallBytes(DFStorage.Call[] memory calls) external virtual view returns (bytes[] memory data) {
        data = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory res) = calls[i].target.staticcall(calls[i].callData);
            require(success, "staticCallBytes failed");
            data[i] = res;
        }
    }


    function staticCallUint(DFStorage.Call[] memory calls) external virtual view returns (uint256 result) {
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory res) = calls[i].target.staticcall(calls[i].callData);
            console.logBytes(res);
            console.logBool(success);
            require(success, "staticCallUint failed");
            result += bytesToUint256(32, res);
        }
    }


    function bytesToAddress(uint _offst, bytes memory _input) internal pure returns (address _output) {
        assembly {
            _output := mload(add(_input, _offst))
        }
    }

    function bytesToUint256(uint _offst, bytes memory _input) private pure returns (uint256 _output) {
        assembly {
            _output := mload(add(_input, _offst))
        }
    }
}