// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;
import "../libraries/DFStorage.sol";

interface IMulticall {

    function staticCallBytes(DFStorage.Call[] memory calls) external virtual view returns (bytes[] memory data);

    function staticCallUint(DFStorage.Call[] memory calls) external virtual view returns (uint256 result);

}
