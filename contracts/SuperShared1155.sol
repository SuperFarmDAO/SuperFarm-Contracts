// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/Address.sol";

import "./IHelper.sol";
import "./IPermitControl.sol";
import "./ISuper1155.sol";
import "./base/Named.sol";
import "./base/Sweepable.sol";

/**
  @title A contract for managing ownership of a shared ERC-1155 item collection.
  @author Tim Clancy

  This contract allows for multiple independent callers to create and manage
  NFTs within a single underlying item contract.

  October 10th, 2021.
*/
contract SuperShared1155 is Named, Sweepable {
  using Address for address;

  /// The public identifier for the right to manage the underlying item.
  /* bytes32 public constant MANAGE_ITEM = keccak256("MANAGE_ITEM"); */

  /// The address of the underlying item contract being shared.
  address public itemContract;

  /// The next group ID to use when creating an item.
  uint256 public nextGroupId;

  /// A mapping of group IDs to their owning addresses.
  mapping (uint256 => address) public groupOwners;

  /**
    This enumeration lists the various supply types that each item group may
    use. In general, the administrator of this collection or those permissioned
    to do so may move from a more-permissive supply type to a less-permissive.
    For example: an uncapped or flexible supply type may be converted to a
    capped supply type. A capped supply type may not be uncapped later, however.

    @param Capped There exists a fixed cap on the size of the item group. The
      cap is set by `supplyData`.
    @param Uncapped There is no cap on the size of the item group. The value of
      `supplyData` cannot be set below the current circulating supply but is
      otherwise ignored.
    @param Flexible There is a cap which can be raised or lowered (down to
      circulating supply) freely. The value of `supplyData` cannot be set below
      the current circulating supply and determines the cap.
  */
  enum SupplyType {
    Capped,
    Uncapped,
    Flexible
  }

  /**
    This enumeration lists the various item types that each item group may use.
    In general, these are static once chosen.

    @param Nonfungible The item group is truly nonfungible where each ID may be
      used only once. The value of `itemData` is ignored.
    @param Fungible The item group is truly fungible and collapses into a single
      ID. The value of `itemData` is ignored.
    @param Semifungible The item group may be broken up across multiple
      repeating token IDs. The value of `itemData` is the cap of any single
      token ID in the item group.
  */
  enum ItemType {
    Nonfungible,
    Fungible,
    Semifungible
  }

  /**
    This enumeration lists the various burn types that each item group may use.
    These are static once chosen.

    @param None The items in this group may not be burnt. The value of
      `burnData` is ignored.
    @param Burnable The items in this group may be burnt. The value of
      `burnData` is the maximum that may be burnt.
    @param Replenishable The items in this group, once burnt, may be reminted by
      the owner. The value of `burnData` is ignored.
  */
  enum BurnType {
    None,
    Burnable,
    Replenishable
  }

  /**
    This struct is a source of mapping-free input to the `configureGroup`
    function. It defines the settings for a particular item group.

    @param supplyData An optional integer used by some `supplyType` values.
    @param itemData An optional integer used by some `itemType` values.
    @param burnData An optional integer used by some `burnType` values.
    @param name A name for the item group.
    @param supplyType The supply type for this group of items.
    @param itemType The type of item represented by this item group.
    @param burnType The type of burning permitted by this item group.

  */
  struct ItemGroupInput {
    uint256 supplyData;
    uint256 itemData;
    uint256 burnData;
    SupplyType supplyType;
    ItemType itemType;
    BurnType burnType;
    string name;
  }

  /**
    Construct a new shared ERC-1155 item contract.

    @param _owner The address of the caller administering this shared contract.
    @param _name The name to assign to this contract.
    @param _super1155Helper The address of a helper contract containing bytecode
      for the new item contract that must be deployed.
    @param _collectionName The name being assigned to the underlying shared item
      contract.
    @param _uri The metadata URI being provided to the underlying item contract.
    @param _proxyRegistry The proxy registry contract address being provided to
      the underlying item contract.
  */
  constructor(
    address _owner,
    string memory _name,
    address _super1155Helper,
    string memory _collectionName,
    string memory _uri,
    address _proxyRegistry
  ) Named(_name) {

    // Do not perform a redundant ownership transfer if the deployer should
    // remain as the owner of the collection.
    if (_owner != owner()) {
      transferOwnership(_owner);
    }

    // Continue initialization.
    nextGroupId = 1;

    // Prepare bytecode for a new item contract.
    bytes memory bytecodeSuper1155 = abi.encodePacked(
      IHelper(_super1155Helper).getByteCode(),
      abi.encode(address(this), _collectionName, _uri, _proxyRegistry)
    );
    bytes32 salt = keccak256(
      abi.encodePacked(block.timestamp - 2, _msgSender())
    );

    // Deploy the new item contract.
    address _itemContract;
    assembly {
      _itemContract := create2(
        0,
        add(bytecodeSuper1155, 0x20),
        mload(bytecodeSuper1155),
        salt
      )
      if iszero(extcodesize(_itemContract)) {
        revert(0, 0)
      }
    }
    itemContract = _itemContract;

    // Permit the owner of this contract to directly manage the underlying item.
    IPermitControl(itemContract).setPermit(
      _owner,
      UNIVERSAL,
      MANAGER,
      type(uint256).max
    );
  }

  /**
    Return a version number for this contract's interface.
  */
  function version() external virtual override(Named, Sweepable) pure returns
    (uint256) {
    return 1;
  }

  /**
    Create a new NFT item group. NFTs within a group share a group ID in the
    upper 128-bits of their full item ID. Within a group, NFTs can be
    distinguished for the purposes of serializing issue numbers.

    @param _data The `ItemGroup` data input.
    @return The ID of the newly-created item group.
  */
  function createItemGroup(
    ItemGroupInput calldata _data
  ) external returns (uint256) {
    groupOwners[nextGroupId] = _msgSender();
    /* updateItemGroup(nextGroupId, _data); */

    // Increment the ID which will be used by the next item group created.
    nextGroupId += 1;
    // TODO: emit event for off-chain detection
    return (nextGroupId - 1);
  }

  /**
    Create or update an existing item group.

    @param _groupId The ID of the item group to create or configure.
    @param _data The `ItemGroup` data input.
  */
  /* function updateItemGroup(
    uint256 _groupId,
    ItemGroupInput calldata _data
  ) public {
    require(_groupId <= nextGroupId,
      "SuperShared::updateItemGroup::group ID must be within bounds");
    require(_msgSender() == groupOwners[_groupId],
      "SuperShared::updateItemGroup::you must be the owner of the group ID");
    ISuper1155(itemContract).configureGroup(_groupId, _data);
  } */
}
