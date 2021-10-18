// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.8;

// import "./ISuper1155.sol";
import "../Super1155.sol";
import "../interfaces/IHelper.sol";

contract Super1155Helper is IHelper {
   constructor() {}

   function getByteCode() external override pure returns (bytes memory) {
       return type(Super1155).creationCode;
   }
}
