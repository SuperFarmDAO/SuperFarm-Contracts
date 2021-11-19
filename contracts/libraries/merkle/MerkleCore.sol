// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "../../base/Sweepable.sol";

/**
  @title A merkle tree root finder.
  @author Qazawat Zirak

  This contract is meant for calculating a root hash from any given 
  valid index, valid node at that index, and valid merkle proofs.

  October 12th, 2021. 
*/
abstract contract MerkleCore is Sweepable {

  /**
    Calculate a root hash from given parameters.
    @param _index index of the hashed node from the list.
    @param _node the hashed node at that index.
    @param _merkleProof array of one required merkle hash per level.
    @return a root hash from given parameters.
   */
  function getRootHash(uint256 _index, bytes32 _node, 
  bytes32[] calldata _merkleProof) internal pure returns(bytes32) {

    uint256 path = _index;
    for (uint256 i = 0; i < _merkleProof.length; i++) {
      if ((path & 0x01) == 1) {
          _node = keccak256(abi.encodePacked(_merkleProof[i], _node));
      } else {
          _node = keccak256(abi.encodePacked(_node, _merkleProof[i]));
      }
      path /= 2;
    }
    return _node;
  }
}
