// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.8;



interface IMerkle {
   function setAccessRound(uint256 _accesslistId, bytes32 _merkleRoot, 
  uint256 _startTime, uint256 _endTime) external;

//   function accessRoots() external view returns (memory AccessList);
}
