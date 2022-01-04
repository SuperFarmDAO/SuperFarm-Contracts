// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.8;

/**
    Interface for interacting with contract inheriting from SuperMerkleAccess contract 
 */
interface IMerkle {

    /** 
    Set a new round for the accesslist.
    @param _accesslistId the accesslist id containg the merkleRoot.
    @param _merkleRoot the new merkleRoot for the round.
    @param _startTime the start time of the new round.
    @param _endTime the end time of the new round.
    @param _price the access price.
    @param _token the token address for access price.
  */
   function setAccessRound(uint256 _accesslistId, bytes32 _merkleRoot, 
  uint256 _startTime, uint256 _endTime, uint256 _price, address _token) external;

}
