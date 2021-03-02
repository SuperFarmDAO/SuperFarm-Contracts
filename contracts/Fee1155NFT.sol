// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./FeeOwner.sol";

/**
  @title An OpenSea delegate proxy contract which we include for whitelisting.
  @author OpenSea
*/
contract OwnableDelegateProxy { }

/**
  @title An OpenSea proxy registry contract which we include for whitelisting.
  @author OpenSea
*/
contract ProxyRegistry {
  mapping(address => OwnableDelegateProxy) public proxies;
}

/**
  @title An ERC-1155 item creation contract which specifies an associated
         FeeOwner who receives royalties from sales of created items.
  @author Tim Clancy

  The fee set by the FeeOwner on this Item is honored by Shop contracts.
  In addition to the inherited OpenZeppelin dependency, this uses ideas from
  the original ERC-1155 reference implementation.
*/
contract Fee1155NFT is ERC1155, Ownable {
  using SafeMath for uint256;

  /// A version number for this fee-bearing 1155 item contract's interface.
  uint256 public version = 1;

  /// The ERC-1155 URI for looking up item metadata using {id} substitution.
  string public metadataUri;

  /// A user-specified FeeOwner to receive a portion of item sale earnings.
  FeeOwner public feeOwner;

  /// Specifically whitelist an OpenSea proxy registry address.
  address public proxyRegistryAddress;

  /// A counter to enforce unique IDs for each item group minted.
  uint256 public nextItemGroupId;

  /// This mapping tracks the number of unique items within each item group.
  mapping (uint256 => uint256) public itemGroupSizes;

  /// An event for tracking the creation of an item group.
  event ItemGroupCreated(uint256 itemGroupId, uint256 itemGroupSize,
    address indexed creator);

  /**
    Construct a new ERC-1155 item with an associated FeeOwner fee.

    @param _uri The metadata URI to perform token ID substitution in.
    @param _feeOwner The address of a FeeOwner who receives earnings from this
                     item.
  */
  constructor(string memory _uri, FeeOwner _feeOwner, address _proxyRegistryAddress) public ERC1155(_uri) {
    metadataUri = _uri;
    feeOwner = _feeOwner;
    proxyRegistryAddress = _proxyRegistryAddress;
    nextItemGroupId = 0;
  }

  /**
    An override to whitelist the OpenSea proxy contract to enable gas-free
    listings. This function returns true if `_operator` is approved to transfer
    items owned by `_owner`.

    @param _owner The owner of items to check for transfer ability.
    @param _operator The potential transferrer of `_owner`'s items.
  */
  function isApprovedForAll(address _owner, address _operator) public view override returns (bool isOperator) {
    ProxyRegistry proxyRegistry = ProxyRegistry(proxyRegistryAddress);
    if (address(proxyRegistry.proxies(_owner)) == _operator) {
      return true;
    }
    return ERC1155.isApprovedForAll(_owner, _operator);
  }

  /**
    Allow the item owner to update the metadata URI of this collection.

    @param _uri The new URI to update to.
  */
  function setURI(string calldata _uri) external onlyOwner {
    metadataUri = _uri;
  }

  /**
    Create a new NFT item group of a specific size. NFTs within a group share a
    group ID in the upper 128-bits of their full item ID. Within a group NFTs
    can be distinguished for the purposes of serializing issue numbers.

    @param recipient The address to receive all NFTs within the newly-created group.
    @param groupSize The number of individual NFTs to create within the group.
    @param data Any associated data to use on items minted in this transaction.
  */
  function createNFT(address recipient, uint256 groupSize, bytes calldata data) external onlyOwner returns (uint256) {
    require(groupSize > 0,
      "You cannot create an empty item group.");

    // Create an item group of requested size using the next available ID.
    uint256 shiftedGroupId = nextItemGroupId << 128;
    itemGroupSizes[shiftedGroupId] = groupSize;

    // Record the supply cap of each item being created in the group.
    uint256[] memory itemIds = new uint256[](groupSize);
    uint256[] memory amounts = new uint256[](groupSize);
    for (uint256 i = 1; i <= groupSize; i++) {
      itemIds[i - 1] = shiftedGroupId.add(i);
      amounts[i - 1] = 1;
    }

    // Mint the entire batch of items.
    _mintBatch(recipient, itemIds, amounts, data);

    // Increment our next item group ID and return our created item group ID.
    nextItemGroupId = nextItemGroupId.add(1);
    emit ItemGroupCreated(shiftedGroupId, groupSize, msg.sender);
    return shiftedGroupId;
  }
}
