// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.8;

import "../SuperMintShop1155.sol";
import "../../../interfaces/IHelper.sol";

contract MintShopHelper is IHelper {
   constructor() {}

   function getByteCode() external override pure returns (bytes memory) {
       return type(MintShop1155).creationCode;
   }
}
