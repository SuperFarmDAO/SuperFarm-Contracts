// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "./Super1155.sol";
import "./IHelper.sol";

contract Super1155Helper is IHelper {
  constructor() {
  }

  function getByteCode() external override pure returns (bytes memory) {
    return type(Super1155).creationCode;
  }
}
