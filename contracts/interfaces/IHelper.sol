// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.8;

// import "../assets/erc1155/interfaces/ISuper1155.sol";

interface IHelper {
   function getByteCode() external pure returns (bytes memory);

   // function getCode(address addr) external pure returns (bytes memory);
}
