// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "./MerkleCore.sol";
import "../ISuper1155.sol";

/**
  @title A merkle tree based distributor.
  @author Qazawat Zirak

  This contract replaces the traditional whitelists for redeeming tokens
  by using a merkle tree, storing the root on-chain instead of all the 
  addressses. The merkle tree alongside the whitelist is kept off-chain 
  for lookups and creating proofs to validate a claim.
  This code is inspired by and modified from incredible work of RicMoo.
  https://github.com/ricmoo/ethers-airdrop/blob/master/AirDropToken.sol

  October 12th, 2021.
*/
contract SuperMerkleDistributor is MerkleCore {

  /// The public identifier for the right to set a root for a round.
  bytes32 public constant SET_DISTRIBUTION_ROUND = keccak256("SET_DISTRIBUTION_ROUND");

  /** 
    An enum representing the type of tokens to give out.
    @param Fungible non unique tokens.
    @param Nonfungible unique tokens.
    @param Semifungible semi unique tokens.
  */
  enum AssetType {
    Fungible,
    Nonfungible,
    Semifungible
  }

  /** 
    An enum representing the type of distributionlist.
    @param Distributive initial distribution of brand new collection.
    @param Airdrop late distribution of a collection, had its first purchase.
  */
  enum listType {
    Distributive, 
    Airdrop
  }

  /** 
    A struct containing information about the Distributionlist.
    @param merkleRoot the proof stored on chain to verify against.
    @param startTime the start time of validity for the Distributionlist.
    @param endTime the end time of validity for the Distributionlist.
    @param round the number times the Distributionlist has been set.
    @param token the token address to distribute tokens from.
    @param assetType the asset type of distribution.
    @param listType flag that specifies the type of distributionlist.
    @param redeemed 'round' to mod of 'index' from off-chain list
      to 'value' representing already redeemed addresses.
  */ 
  struct DistributionList {
    bytes32 merkleRoot;
    uint256 startTime;
    uint256 endTime;
    uint256 round;
    address token;
    AssetType assetType;
    listType listType;
    mapping(uint256 => mapping(uint256 => uint256)) redeemed;
  }

  /// MerkleRootId to 'DistributionList'
  mapping (uint256 => DistributionList) public distributionRoots;

  /// Event emitted when a redemption is successful.
  event Redeemed(uint256 indexed index, address indexed account, uint256 indexed amount);

  /** 
    Set a new round for the Distributionlist.
    @param _groupId the distributionlist id containg the merkleRoot.
    @param _merkleRoot the new merkleRoot for the round.
    @param _startTime the start time of the new round.
    @param _endTime the end time of the new round.
    @param _token the address of token to be disbursed.
    @param _assetType the type of token to be disbursed.
    @param _listType the type of distributionlist. Distributive/Airdrop.
  */
  function setDistributionRound(uint256 _groupId, bytes32 _merkleRoot, 
  uint256 _startTime, uint256 _endTime, address _token, 
  AssetType _assetType, listType _listType) public 
  hasValidPermit(UNIVERSAL, SET_DISTRIBUTION_ROUND) {

    distributionRoots[_groupId].merkleRoot = _merkleRoot;
    distributionRoots[_groupId].startTime = _startTime;
    distributionRoots[_groupId].endTime = _endTime;
    distributionRoots[_groupId].round += 1;
    distributionRoots[_groupId].token = _token;
    distributionRoots[_groupId].assetType = _assetType;
    distributionRoots[_groupId].listType = _listType;
  }
  
  /** 
    A function to check if the caller has already redeemed a claim.
    @param _groupId the id of the distributionlist having the merkleRoot.
    @param _index the index of the Node in the list off-chain.
    @return whether or not the address at that index has already redeemed.
  */
  function redeemed(uint256 _groupId, uint256 _index) public view returns (bool) {

      uint256 redeemedBlock = distributionRoots[_groupId].redeemed[distributionRoots[_groupId].round][_index / 256];
      uint256 redeemedMask = (uint256(1) << uint256(_index % 256));
      return ((redeemedBlock & redeemedMask) != 0);
  }

  /** 
    A function that is called when a caller intends to redeem tokens
    verified against a merkleRoot.
    @param _groupId the id of the distributionlist having the merkleRoot.
    @param _index index of the hashed node from off-chain list.
    @param _account account at that '_index'.
    @param _tokenId the id of the token to be claimed.
    @param _amount the amount of the tokens to be claimed.
    @param _merkleProof the list of related hashes from merkle tree.

    This function accepts redemption of Fungible, NonFungible and Semi
    fungible tokens.
  */
  function redeem(uint256 _groupId, uint256 _index, address _account, 
  uint256 _tokenId, uint256 _amount, bytes32[] calldata _merkleProof) 
  external {

    require(!redeemed(_groupId, _index), 
      "Already Redeemed.");

    // Mark as redeemed, for that round, for that '_account'
    distributionRoots[_groupId].redeemed[distributionRoots[_groupId].round][_index / 256] = 
      distributionRoots[_groupId].redeemed[distributionRoots[_groupId].round][_index / 256] | (uint256(1) << uint256(_index % 256));

    uint256 shiftedItemGroupId = _groupId << 128;
    uint256 tokenId;
    uint256 amount;
    bytes32 node;

    // Fungible Distribution and Airdrop both use tokenId = 1
    if (distributionRoots[_groupId].assetType == AssetType.Fungible) {
      tokenId = shiftedItemGroupId + 1;
      amount = _amount;
      node = keccak256(abi.encodePacked(_index, _account, _amount));

    // Non fungible Distribution uses '_index' as tokenId
    } else if (distributionRoots[_groupId].assetType == AssetType.Nonfungible) { 
      if (distributionRoots[_groupId].listType == listType.Distributive) {
        tokenId = shiftedItemGroupId + _index;
        node = keccak256(abi.encodePacked(_index, _account));

      // Non fungible Airdrop uses explicit tokenId
      } else {
        tokenId = _tokenId;
        node = keccak256(abi.encodePacked(_index, _account, _tokenId));
      }  
      amount = 1;

    // Semi fungible Distribution and Airdrop both use explicit tokenId
    } else {
      tokenId = _tokenId;
      amount = _amount;
      node = keccak256(abi.encodePacked(_index, _account, _tokenId, _amount));
    }

    // Notice that index is only included in the hash for the leaf nodes
    require(getRootHash(_index, node, _merkleProof) == 
      distributionRoots[_groupId].merkleRoot, 
      "Invalid Proof.");
  
    ISuper1155(distributionRoots[_groupId].token).mintBatch(_account, 
      _asSingletonArray(tokenId), _asSingletonArray(amount), "");

    emit Redeemed(_index, _account, amount);
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