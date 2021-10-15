// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "../base/Sweepable.sol";

/**
  @title A merkle distributor.
  @author Qazawat Zirak

  This contract replaces the traditional whitelists by using a merkle 
  tree, storing the root on-chain instead of all the addressses. The 
  merkle tree alongside the whitelist is kept off-chain for lookups and 
  creating proofs to validate a claim.
  This code is inspired by and modified from incredible work from RicMoo.
  https://github.com/ricmoo/ethers-airdrop/blob/master/AirDropToken.sol

  October 12th, 2021.
*/
contract SuperMerkleAccess is Sweepable {

  /// The public identifier for the right to set a root for a round.
  bytes32 public constant SET_ROUND_ROOT = keccak256("SET_ROUND_ROOT");

  /** 
    The base struct containing whitelist information.
    @param merkleRoot the proof stored on chain to verify against.
    @param startTime the start time of validity for the whitelist.
    @param endTime the end time of validity for the whitelist.
    @param rounds the number times the whitelsit has been set.

    A 0 value for startTime and endTime represent time indepedence.
  */ 
  struct Whitelist {
    bytes32 merkleRoot;
    uint256 startTime;
    uint256 endTime;
    uint256 rounds;
  }
  
  /// 'MerkleRootId' to 'Whitelist', each containing a merkleRoot.
  mapping (uint256 => Whitelist) public merkleRoots;

  /// Event emitted when a new round is set.
  event NewRound(uint256 indexed round, address indexed caller);

  /** 
    Set a new round for the whitelist.
    @param _whitelistId the whitelist id containg the merkleRoots.
    @param _merkleRoot the new merkleRoot for the round.
    @param _startTime the start time of the new round.
    @param _endTime the end time of the new round.
  */
  function setAccessRound(uint256 _whitelistId, bytes32 _merkleRoot, 
  uint256 _startTime, uint256 _endTime) external virtual 
  hasValidPermit(UNIVERSAL, SET_ROUND_ROOT) {

    merkleRoots[_whitelistId].merkleRoot = _merkleRoot;
    merkleRoots[_whitelistId].startTime = _startTime;
    merkleRoots[_whitelistId].endTime = _endTime;
    merkleRoots[_whitelistId].rounds += 1;
    emit NewRound(merkleRoots[_whitelistId].rounds += 1, msg.sender);
  }

  /**
    Inheritable generic function used as an standalone access control or
    to verify a claim against a targetted markleRoot on-chain.
    @param _merkleRootId the id of merkleRoot that is verified against. 
    @param _index index of the hashed node from off-chain list.
    @param _node the actual hashed node which needs to be verified. This
      is a hash of node. kecck256(abi.encodePacked(<parameters>))
    @param _merkleProof related merkle hashes from off-chain binary tree.

    '_merkleRootId' is a generic input parameter. It represents Id of
    the merkleRoot as a groupId if whitelist is airdrop or distributive.
   */
  function verify(uint256 _merkleRootId, uint256 _index, bytes32 _node, 
  bytes32[] calldata _merkleProof) public view returns(bool) {

    require(merkleRoots[_merkleRootId].merkleRoot != 0, 
      "Inactive.");
    require(merkleRoots[_merkleRootId].startTime == 0 || 
      block.timestamp > merkleRoots[_merkleRootId].startTime,
      "Early.");
    require(merkleRoots[_merkleRootId].endTime == 0 || 
      block.timestamp < merkleRoots[_merkleRootId].endTime , 
      "Late.");

    uint256 path = _index;
    for (uint256 i = 0; i < _merkleProof.length; i++) {
      if ((path & 0x01) == 1) {
          _node = keccak256(abi.encodePacked(_merkleProof[i], _node));
      } else {
          _node = keccak256(abi.encodePacked(_node, _merkleProof[i]));
      }
      path /= 2;
    }

    require(_node == merkleRoots[_merkleRootId].merkleRoot, 
      "Invalid Proof.");

    return true;
  }
}