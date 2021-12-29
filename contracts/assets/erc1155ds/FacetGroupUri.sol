// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/utils/introspection/ERC165Storage.sol";
// import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
// import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "hardhat/console.sol";


import "../../access/PermitControlds.sol";
import "../../proxy/StubProxyRegistry.sol";

import "./BlueprintSuper1155.sol";

/** 
  @title Diamond facet for Super1155's Group and Uri functions.
  @author Tim Clancy
  @author Qazawat Zirak
  @author Rostislav Khlebnikov
  @author Nikita Elunin
  This contract is a logic contract for delegate calls from the ProxyStorage.
  The contract defines the logic of Groups and Uri's of Super1155 assets and
  the storage of ProxyStorage is updated based on KECCAK256 memory locations.

  For the purpose of standardization, a facet should be less than 15KiloBytes.

  22 Dec, 2021.
*/
contract FacetGroupUri is PermitControlds, ERC165Storage {
  using Address for address;
  using SafeERC20 for IERC20;

  /**
    An event that gets emitted when the metadata collection URI is changed.

    @param oldURI The old metadata URI.
    @param newURI The new metadata URI.
  */
  event ChangeURI(string indexed oldURI, string indexed newURI);

  /**
    An event that gets emitted when an item group is configured.

    @param manager The caller who configured the item group `_groupId`.
    @param groupId The groupId being configured.
    @param newGroup The new group configuration.
  */
  event ItemGroupConfigured(address indexed manager, uint256 groupId,
    BlueprintSuper1155.ItemGroupInput indexed newGroup);

  /**
    An event that gets emitted when the item collection is locked to further
    creation.

    @param locker The caller who locked the collection.
  */
  event CollectionLocked(address indexed locker);

  /**
    An event that gets emitted when a token ID has its on-chain metadata
    changed.

    @param changer The caller who triggered the metadata change.
    @param id The ID of the token which had its metadata changed.
    @param oldMetadata The old metadata of the token.
    @param newMetadata The new metadata of the token.
  */
  event MetadataChanged(address indexed changer, uint256 indexed id,
    string oldMetadata, string indexed newMetadata);

  /**
    An event that indicates we have set a permanent metadata URI for a token.

    @param _value The value of the permanent metadata URI.
    @param _id The token ID associated with the permanent metadata value.
  */
  event PermanentURI(string _value, uint256 indexed _id);

  /**
    An event that emmited when the contract URI is changed

    @param oldURI The old contract URI
    @param newURI The new contract URI
   */
  event ChangeContractURI(string indexed oldURI, string indexed newURI);

  /**
    An event that indicates we have set a permanent contract URI.

    @param _value The value of the permanent contract URI.
    @param _id The token ID associated with the permanent metadata value.
  */
  event PermanentContractURI(string _value, uint256 indexed _id);

  function initialize() public initializer {
    __Ownable_init_unchained();
  }

  /**
    This is a private helper function to replace the `hasItemRight` modifier
    that we use on some functions in order to inline this check during batch
    minting and burning.

    @param _id The ID of the item to check for the given `_right` on.
    @param _right The right that the caller is trying to exercise on `_id`.
    @return Whether or not the caller has a valid right on this item.
  */
  function _hasItemRight(uint256 _id, bytes32 _right) private view
    returns (bool) {

    uint256 groupId = _id  >> 128;
    if (_msgSender() == owner()) {
      return true;
    }
    if (hasRight(_msgSender(), UNIVERSAL, _right)) {
      return true;
    } 
    if (hasRight(_msgSender(), bytes32(groupId), _right)) {
      return true;
    }
    if (hasRight(_msgSender(), bytes32(_id), _right)) {
      return true;
    } 
    return false;
  }

  /**
    Return the item collection's metadata URI. This implementation returns the
    same URI for all tokens within the collection and relies on client-side
    ID substitution per https://eips.ethereum.org/EIPS/eip-1155#metadata. Per
    said specification, clients calling this function must replace the {id}
    substring with the actual token ID in hex, not prefixed by 0x, and padded
    to 64 characters in length.

    @return The metadata URI string of the item with ID `_itemId`.
  */
  function uri(uint256) external view returns (string memory) {
    
    BlueprintSuper1155.Super1155StateVariables storage b = BlueprintSuper1155.super1155StateVariables();

    return b.metadataURI;
  }

  /**
    Allow the item collection owner or an approved manager to update the
    metadata URI of this collection. This implementation relies on a single URI
    for all items within the collection, and as such does not emit the standard
    URI event. Instead, we emit our own event to reflect changes in the URI.

    @param _uri The new URI to update to.
  */
  function setURI(string calldata _uri) external virtual
    hasValidPermit(UNIVERSAL, BlueprintSuper1155.SET_URI) {

    BlueprintSuper1155.Super1155StateVariables storage b = BlueprintSuper1155.super1155StateVariables();

    require(!b.uriLocked,
      "Super1155: the collection URI has been permanently locked");
    string memory oldURI = b.metadataURI;
    b.metadataURI = _uri;
    emit ChangeURI(oldURI, _uri);
  }

  /**
    Allow approved manager to update the contract URI. At the end of update, we 
    emit our own event to reflect changes in the URI.

    @param _uri The new contract URI to update to.
  */
  function setContractUri(string calldata _uri) external virtual
    hasValidPermit(UNIVERSAL, BlueprintSuper1155.SET_URI) {

      BlueprintSuper1155.Super1155StateVariables storage b = BlueprintSuper1155.super1155StateVariables();

      require(!b.contractUriLocked,
        "Super1155: the contract URI has been permanently locked");
      string memory oldContractUri = b.contractURI;
      b.contractURI = _uri;
      emit ChangeContractURI(oldContractUri, _uri);
  }

  /**
    Set the on-chain metadata attached to a specific token ID so long as the
    collection as a whole or the token specifically has not had metadata
    editing frozen.

    @param _id The ID of the token to set the `_metadata` for.
    @param _metadata The metadata string to store on-chain.
  */
  function setMetadata(uint256 _id, string memory _metadata) external {

    require(_hasItemRight(_id, BlueprintSuper1155.SET_METADATA), "Super1155: you don't have rights to setMetadata");
    uint groupId = _id >> 128;

    BlueprintSuper1155.Super1155StateVariables storage b = BlueprintSuper1155.super1155StateVariables();

    require(!b.uriLocked && !b.metadataFrozen[_id] &&  !b.metadataFrozen[groupId],
      "Super1155: you cannot edit this metadata because it is frozen");
    string memory oldMetadata = b.metadata[_id];
    b.metadata[_id] = _metadata;
    emit MetadataChanged(_msgSender(), _id, oldMetadata, _metadata);
  }
  
  /**
    Allow the item collection owner or an associated manager to forever lock the
    metadata URI on the entire collection to future changes.
  */
  function lockURI() external
    hasValidPermit(UNIVERSAL, BlueprintSuper1155.LOCK_URI) {

    BlueprintSuper1155.Super1155StateVariables storage b = BlueprintSuper1155.super1155StateVariables();

    b.uriLocked = true;
    emit PermanentURI(b.metadataURI, 2 ** 256 - 1);
  }
  
  /** 
    Allow the associated manager to forever lock the contract URI to future 
    changes
  */
  function lockContractUri() external
    hasValidPermit(UNIVERSAL, BlueprintSuper1155.LOCK_URI) {

    BlueprintSuper1155.Super1155StateVariables storage b = BlueprintSuper1155.super1155StateVariables();

    b.contractUriLocked = true;
    emit PermanentContractURI(b.contractURI, 2 ** 256 - 1);   
  }

  /**
    Allow the item collection owner or an associated manager to forever lock the
    metadata URI on a group of items to future changes.

    @param _uri The value of the URI to lock for `groupId`.
    @param groupId The group ID to lock a metadata URI value into.
  */
  function lockGroupURI(string calldata _uri, uint256 groupId) external {

    require(_hasItemRight(groupId, BlueprintSuper1155.LOCK_ITEM_URI), "Super1155: you don't have rights to lock group URI");

    BlueprintSuper1155.Super1155StateVariables storage b = BlueprintSuper1155.super1155StateVariables();

    b.metadataFrozen[groupId] = true;
    emit PermanentURI(_uri, groupId);
  }

  /**
    Allow the item collection owner or an associated manager to forever lock
    this contract to further item minting.
  */
  function lock() external virtual hasValidPermit(UNIVERSAL, BlueprintSuper1155.LOCK_CREATION) {

    BlueprintSuper1155.Super1155StateVariables storage b = BlueprintSuper1155.super1155StateVariables();

    b.locked = true;
    emit CollectionLocked(_msgSender());
  }


  /**
    Allow the item collection owner or an associated manager to forever lock the
    metadata URI on an item to future changes.

    @param _uri The value of the URI to lock for `_id`.
    @param _id The token ID to lock a metadata URI value into.
  */
  function lockURI(string calldata _uri, uint256 _id) external {

    require(_hasItemRight(_id, BlueprintSuper1155.LOCK_ITEM_URI), "Super1155: you don't have rights to lock URI");

    BlueprintSuper1155.Super1155StateVariables storage b = BlueprintSuper1155.super1155StateVariables();

    b.metadataFrozen[_id] = true;
    emit PermanentURI(_uri, _id);
  }



  /**
    Create a new NFT item group or configure an existing one. NFTs within a
    group share a group ID in the upper 128-bits of their full item ID.
    Within a group NFTs can be distinguished for the purposes of serializing
    issue numbers.

    @param _groupId The ID of the item group to create or configure.
    @param _data The `ItemGroup` data input.
  */
  function configureGroup(uint256 _groupId, BlueprintSuper1155.ItemGroupInput calldata _data) external payable {
    
    require(_groupId != 0,
      "Super1155: group ID 0 is invalid");
    require(_hasItemRight(_groupId, BlueprintSuper1155.CONFIGURE_GROUP), "Super1155: you don't have rights to configure group");

    BlueprintSuper1155.Super1155StateVariables storage b = BlueprintSuper1155.super1155StateVariables();

    // If the collection is not locked, we may add a new item group.
    if (!b.itemGroups[_groupId].initialized) {
      require(!b.locked,
        "Super1155: the collection is locked so groups cannot be created");

      // Add actual item group.
      b.itemGroups[_groupId] = BlueprintSuper1155.ItemGroup({
        initialized: true,
        name: _data.name,
        supplyType: _data.supplyType,
        supplyData: _data.supplyData,
        itemType: _data.itemType,
        itemData: _data.itemData,
        burnType: _data.burnType,
        burnData: _data.burnData,
        circulatingSupply: 0,
        mintCount: 0,
        burnCount: 0,
        timeData: _data.timeData,
        transferData: _data.transferData,
        intrinsicData: _data.intrinsicData
      });

      b.itemGroups[_groupId].intrinsicData.prefund = 0;
      b.itemGroups[_groupId].intrinsicData.totalLocked = 0;

    // Edit an existing item group. The name may always be updated.
    } else {
      b.itemGroups[_groupId].name = _data.name;

      // A capped or time capped supply type may not change.
      // It may also not have its cap increased.
      if (b.itemGroups[_groupId].supplyType == BlueprintSuper1155.SupplyType.Capped) {
        require(_data.supplyType == BlueprintSuper1155.SupplyType.Capped,
          "Super1155: you may not uncap a capped supply type");
        require(_data.supplyData <= b.itemGroups[_groupId].supplyData,
          "Super1155: you may not increase the supply of a capped type");

      // The flexible, uncapped, timeRate and timePercent types may freely change.
      } else if (_data.supplyType == BlueprintSuper1155.SupplyType.TimeValue) {
        b.itemGroups[_groupId].supplyType = _data.supplyType;
        b.itemGroups[_groupId].timeData.timeStamp = block.timestamp;
        b.itemGroups[_groupId].timeData.timeInterval = _data.timeData.timeInterval;
        b.itemGroups[_groupId].timeData.timeRate = _data.timeData.timeRate;

      } else if (_data.supplyType == BlueprintSuper1155.SupplyType.TimePercent) {
        require(_data.timeData.timeCap >= _data.supplyData,
          "Super1155: you may not set the timeCap less than supplyData");
        b.itemGroups[_groupId].supplyType = _data.supplyType;
      } else {
        b.itemGroups[_groupId].supplyType = _data.supplyType;
      }

      // Item supply data may not be reduced below the circulating supply.
      require(_data.supplyData >= b.itemGroups[_groupId].circulatingSupply,
        "Super1155: you may not decrease supply below the circulating amount");
      b.itemGroups[_groupId].supplyData = _data.supplyData;

      // A nonfungible item may not change type.
      if (b.itemGroups[_groupId].itemType == BlueprintSuper1155.ItemType.Nonfungible) {
        require(_data.itemType == BlueprintSuper1155.ItemType.Nonfungible,
          "Super1155: you may not alter nonfungible items");

      // A semifungible item may not change type.
      } else if (b.itemGroups[_groupId].itemType == BlueprintSuper1155.ItemType.Semifungible) {
        require(_data.itemType == BlueprintSuper1155.ItemType.Semifungible,
          "Super1155: you may not alter nonfungible items");

      // A fungible item may change type if it is unique enough.
      } else if (b.itemGroups[_groupId].itemType == BlueprintSuper1155.ItemType.Fungible) {
        if (_data.itemType == BlueprintSuper1155.ItemType.Nonfungible) {
          require(b.itemGroups[_groupId].circulatingSupply <= 1,
            "Super1155: the fungible item is not unique enough to change");
          b.itemGroups[_groupId].itemType = BlueprintSuper1155.ItemType.Nonfungible;

        // We may also try for semifungible items with a high-enough cap.
        } else if (_data.itemType == BlueprintSuper1155.ItemType.Semifungible) {
          require(b.itemGroups[_groupId].circulatingSupply <= _data.itemData,
            "Super1155: the fungible item is not unique enough to change");
          b.itemGroups[_groupId].itemType = BlueprintSuper1155.ItemType.Semifungible;
          b.itemGroups[_groupId].itemData = _data.itemData;
        }
      }
      
      // Update transfer fee information.
      b.itemGroups[_groupId].transferData.transferTime = _data.transferData.transferTime;
      b.itemGroups[_groupId].transferData.transferFeeAmount = _data.transferData.transferFeeAmount;
      b.itemGroups[_groupId].transferData.transferType = _data.transferData.transferType;

      // Update intrinsic value information.
      if (b.itemGroups[_groupId].intrinsicData.intrinsic && b.itemGroups[_groupId].circulatingSupply == 0) {
        b.itemGroups[_groupId].intrinsicData.rate = _data.intrinsicData.rate;
        b.itemGroups[_groupId].intrinsicData.burnShare = _data.intrinsicData.burnShare;
      } else if (b.itemGroups[_groupId].intrinsicData.intrinsic){
        b.itemGroups[_groupId].intrinsicData.burnShare = _data.intrinsicData.burnShare;
      }
    }

    // Transfer prefund tokens or ether if any.
    if(_data.intrinsicData.intrinsicToken != address(0) && _data.intrinsicData.prefund > 0) { // Intrinsic token is ERC20
      b.itemGroups[_groupId].intrinsicData.prefund += _data.intrinsicData.prefund;
      b.itemGroups[_groupId].intrinsicData.totalLocked += _data.intrinsicData.prefund;
      IERC20(_data.intrinsicData.intrinsicToken).safeTransferFrom(_msgSender(), address(this), _data.intrinsicData.prefund);
    } else if (_data.intrinsicData.intrinsicToken == address(0) && msg.value > 0) { // Intrinsic token is in Ether
      b.itemGroups[_groupId].intrinsicData.prefund += msg.value;
      b.itemGroups[_groupId].intrinsicData.totalLocked += msg.value;
    }

    // Emit the configuration event.
    emit ItemGroupConfigured(_msgSender(), _groupId, _data);
  }
}