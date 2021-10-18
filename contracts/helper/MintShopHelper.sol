// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.8;

// import "./ISuper1155.sol";
import "../MintShop1155.sol";
import "../interfaces/IHelper.sol";

contract MintShopHelper is IHelper {
   constructor() {}

   function getByteCode() external override pure returns (bytes memory) {
       return type(MintShop1155).creationCode;
   }
}
