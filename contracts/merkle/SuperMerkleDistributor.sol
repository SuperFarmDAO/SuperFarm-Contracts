// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "../base/Sweepable.sol";
import "../ISuper1155.sol";

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
contract SuperMerkleDistributor is Sweepable {

  /// The public identifier for the right to set a root for a round.
  bytes32 public constant SET_ROUND_ROOT = keccak256("SET_ROUND_ROOT");


  
  /// 'MerkleRootId' to 'Whitelist', each containing a merkleRoot.
  mapping (uint256 => Whitelist) public merkleRoots;

  /** 
    An enum representing the type of token to distribute.
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
    An enum representing  the type of whitelist.
    @param Distributive initial early distribution of brand new collection.
    @param Airdrop distribution meant when the collection had its first
      purchase.
  */
  enum WhitelistType {
    Distributive, 
    Airdrop
  }

  /** 
    The base struct containing whitelist information.
    @param merkleRoot the proof stored on chain to verify against.
    @param startTime the start time of validity for the whitelist.
    @param endTime the end time of validity for the whitelist.
    @param rounds the number times the whitelsit has been set.
    @param token the token address to distribute tokens from.
    @param assetType the asset type of distribution.
    @param whitelistType flag that specifies the type of whitelist.
      Distributive whitelist is meant for early accessors of a brand
      new collection. Airdrop is meant for mid access.
    @param redeemed mapping of which address has already claimed.

    A 0 value for startTime and endTime represent time indepedence.
  */ 
  struct Whitelist {
    bytes32 merkleRoot;
    uint256 startTime;
    uint256 endTime;
    uint256 rounds;
    address token;
    AssetType assetType;
    WhitelistType whitelistType;
    mapping(uint256 => uint256) redeemed;
  }

  /// Event emitted when a new round is set.
  event NewRound(uint256 indexed round, address indexed caller, uint256 indexed time);

  /// Event emitted when a redemption is successful.
  event Redeemed(uint256 indexed index, address indexed account, uint256 indexed amount);

  /**
    Deploy a new instance of SuperMerkleDistributor.
    @param _owner the owner of this contract.
   */
  constructor(address _owner) {

    if (_owner != owner()) {
      transferOwnership(_owner);
    }
  }

  // GroupId must be generic as simple ID. MintShop1155 might use whitelist id instead of GroupId if token must be ignored.
  function setNewRoot(uint256 _groupId, bytes32 _merkleRoot, uint256 _startTime, uint256 _endTime, address _token, AssetType _assetType, WhitelistType _whitelistType) public hasValidPermit(UNIVERSAL, SET_ROUND_ROOT) {

    uint256 version = merkleRoots[_groupId].rounds;
    delete merkleRoots[_groupId]; // does not reset mapping TODO mapping needs to be reset

    merkleRoots[_groupId].merkleRoot = _merkleRoot;
    merkleRoots[_groupId].startTime = _startTime;
    merkleRoots[_groupId].endTime = _endTime;
    merkleRoots[_groupId].rounds = version;
    merkleRoots[_groupId].token = _token;
    merkleRoots[_groupId].assetType = _assetType;
    merkleRoots[_groupId].whitelistType = _whitelistType;
  }
  
  /** 
    A function to check if the caller has already redeemed a claim.
    @param _groupId the id of the whitelist having the merkleRoot.
    @param _index the index of the Node in the list off-chain.
  */
  function redeemed(uint256 _groupId, uint256 _index) public view returns (bool) {
      uint256 redeemedBlock = merkleRoots[_groupId].redeemed[_index / 256];
      uint256 redeemedMask = (uint256(1) << uint256(_index % 256));
      return ((redeemedBlock & redeemedMask) != 0);
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
  function verify(uint256 _merkleRootId, uint256 _index, bytes32 _node, bytes32[] calldata _merkleProof) internal view returns(bool) {

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

  /** 
    A function that is called when a caller intends to redeem tokens
    verified against a merkleRoot.
    @param _groupId the id of the whitelist having the merkleRoot.
    @param _index index of the hashed node from off-chain list.
    @param _account account that at the '_index'.
    @param _tokenId the id of the token to be claimed.
    @param _amount the amount of the token to be claimed.
    @param _merkleProof the list of related hashes from merkle tree.

    This function accepts redemption of Fungible, NonFungible and Semi
    fungible tokens.
  */
  function redeem(uint256 _groupId, uint256 _index, address _account, uint256 _tokenId, uint256 _amount, bytes32[] calldata _merkleProof) external {

    require(!redeemed(_groupId, _index), 
      "Already Redeemed.");

    merkleRoots[_groupId].redeemed[_index / 256] = 
      merkleRoots[_groupId].redeemed[_index / 256] | (uint256(1) << uint256(_index % 256));

    uint256 shiftedItemGroupId = _groupId << 128;
    uint256 tokenId;
    uint256 amount;
    bytes32 node;

    // Fungible Distribution and Airdrop both use tokenId = 1
    if (merkleRoots[_groupId].assetType == AssetType.Fungible) {
      tokenId = shiftedItemGroupId + 1;
      amount = _amount;
      node = keccak256(abi.encodePacked(_index, _account, _amount));

    // Non fungible Distribution uses '_index' as tokenId
    } else if (merkleRoots[_groupId].assetType == AssetType.Nonfungible) { 
      if (merkleRoots[_groupId].whitelistType == WhitelistType.Distributive) {
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

    verify(_groupId, _index, node, _merkleProof);
  
    ISuper1155(merkleRoots[_groupId].token).mintBatch(_account, _asSingletonArray(tokenId), _asSingletonArray(amount), "");
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