// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./base/Sweepable.sol";
import "./ISuper1155.sol";

/**
  @title A merkle distributor.
  @author Qazawat Zirak

  This contract replaces the traditional approach to whitelists by using a 
  merkle tree, storing the root on-chain instead of all the addressses. The 
  merkle tree itself is kept off-chain for lookups and creating proofs to 
  validate a claim.

  October 12th, 2021.
*/
contract SuperDistributor is Sweepable {
  using EnumerableSet for EnumerableSet.UintSet;

  /// The public identifier for the right to set a root for a round.
  bytes32 public constant SET_ROUND_ROOT = keccak256("SET_ROUND_ROOT");

  /// The token address for which whitelists were created.
  address public immutable token;
  
  /// Collection of merkle roots represeting a different root for each round.
  mapping (uint256 => bytes32) public merkleRoots;

  /// Event for claiming through merkle validation.
  event Claimed(uint256 indexed index, address indexed account, uint256 indexed amount);
  
  /**
    Deploy a new SuperDistributor contract with an owner and token address.
    @param _owner the owner of SuperDistributor.
    @param _token the token which is to be distributed to whitelisted candidates.
  */
  constructor(address _owner, address _token) {

    if (_owner != owner()) {
      transferOwnership(_owner);
    }

    token = _token;
  }
  
  /**
    Create a new round for whitelisting by creating a new root for the round.
    @param _groupId the group Id of tokens for which whitelist is held.
    @param _merkleRoot the new calculated root for the round.
   */
  function setRoundRoot(uint256 _groupId, bytes32 _merkleRoot) external hasValidPermit(UNIVERSAL, SET_ROUND_ROOT) {

    merkleRoots[_groupId] = _merkleRoot;
  }

  /**
    Redeem tokens for which the caller is whitelisted.
    @param _groupId the group Id of tokens for which whitelist is held.
    @param _index the round of whitelisting.
    @param _account the external address belonging to whitelist.
    @param _amount the amount of tokens the caller has been whitelisted for.
    @param _merkleProof the external proof that should match the root on-chain.
   */
  function redeem(uint256 _groupId, uint256 _index, address _account, uint256 _amount, bytes32[] calldata _merkleProof) external { //overridden ?

    uint256 newTokenIdBase = _groupId << 128;
    uint256 newTokenId = newTokenIdBase + _index;

    // External provided data for redemption.
    bytes32 node = keccak256(abi.encodePacked(_index, _account, _amount));
    uint256 path = _index;
    
    // Create proof by traversing the tree up.
    for (uint16 i = 0; i < _merkleProof.length; i++) {
      if ((path & 0x01) == 1) {
          node = keccak256(abi.encodePacked(_merkleProof[i], node));
      } else {
          node = keccak256(abi.encodePacked(node, _merkleProof[i]));
      }
      path /= 2;
    }

    // Proof must match the merkle root on-chain.
    require(node == merkleRoots[_groupId], "Invalid Proof." );
    
    ISuper1155(token).mintBatch(_account, _asSingletonArray(newTokenId), _asSingletonArray(uint(1)), "");
    emit Claimed( _index, _account, _amount );
  }
  
  /**
    This private helper function converts a number into a single-element array.
    @param _element The element to convert to an array.
    @return The array containing the single `_element`.
  */
  function _asSingletonArray(uint256 _element) private pure returns (uint256[] memory) {

    uint256[] memory array = new uint256[](1);
    array[0] = _element;
    return array;
  }
}