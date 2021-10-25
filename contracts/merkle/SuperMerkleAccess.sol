// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "./MerkleCore.sol";
import "./IMerkle.sol";

/**
  @title A merkle tree based access control.
  @author Qazawat Zirak

  This contract replaces the traditional whitelists for access control
  by using a merkle tree, storing the root on-chain instead of all the 
  addressses. The merkle tree alongside the whitelist is kept off-chain 
  for lookups and creating proofs to validate an access.
  This code is inspired by and modified from incredible work of RicMoo.
  https://github.com/ricmoo/ethers-airdrop/blob/master/AirDropToken.sol

  October 12th, 2021.
*/
abstract contract SuperMerkleAccess is MerkleCore {

  /// The public identifier for the right to set a root for a round.
  bytes32 public constant SET_ACCESS_ROUND = keccak256("SET_ACCESS_ROUND");

  /** 
    A struct containing information about the AccessList.
    @param merkleRoot the proof stored on chain to verify against.
    @param startTime the start time of validity for the accesslist.
    @param endTime the end time of validity for the accesslist.
    @param round the number times the accesslist has been set.
  */ 
  struct AccessList {
    bytes32 merkleRoot;
    uint256 startTime;
    uint256 endTime;
    uint256 round;
  }
  
  /// MerkleRootId to 'Accesslist', each containing a merkleRoot.
  mapping (uint256 => AccessList) public accessRoots;

  /** 
    Set a new round for the accesslist.
    @param _accesslistId the accesslist id containg the merkleRoot.
    @param _merkleRoot the new merkleRoot for the round.
    @param _startTime the start time of the new round.
    @param _endTime the end time of the new round.
  */
  function setAccessRound(uint256 _accesslistId, bytes32 _merkleRoot, 
  uint256 _startTime, uint256 _endTime) public virtual
  hasValidPermit(UNIVERSAL, SET_ACCESS_ROUND) {

    AccessList memory accesslist = AccessList({
      merkleRoot: _merkleRoot,
      startTime: _startTime,
      endTime: _endTime,
      round: accessRoots[_accesslistId].round + 1
    });
    accessRoots[_accesslistId] = accesslist;
  }

  /**
    Verify an access against a targetted markleRoot on-chain.
    @param _accesslistId the id of the accesslist containing the merkleRoot.
    @param _index index of the hashed node from off-chain list.
    @param _node the actual hashed node which needs to be verified.
    @param _merkleProof required merkle hashes from off-chain merkle tree.
   */
  function verify(uint256 _accesslistId, uint256 _index, bytes32 _node, 
  bytes32[] calldata _merkleProof) public view returns(bool) {

    require(accessRoots[_accesslistId].merkleRoot != 0, 
      "Inactive.");
    require(block.timestamp > accessRoots[_accesslistId].startTime,
      "Early.");
    require(block.timestamp < accessRoots[_accesslistId].endTime , 
      "Late.");
    require(getRootHash(_index, _node, _merkleProof) == 
      accessRoots[_accesslistId].merkleRoot, 
      "Invalid Proof.");

    return true;
  }
}