// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

/** 
  @title Blueprint library for Superfarm Drop.
  @author Qazawat Zirak
  This library acts as a blueprint for storage mechanim in the proxy contract.
  The library defines state variables in form of structs. It also defines the 
  storage location of the variables using KECCAK256 to avoid memory collision. 
  The state is stored in Proxy contract, which does a delegate call to Facets.

  22 Dec, 2021.
*/
library Blueprint {

    /// The max value of 256 bits.
    uint256 constant MAX_INT = type(uint256).max;

    /// The public identifier for the right to set this contract's metadata URI.
    bytes32 public constant SET_URI = keccak256("SET_URI");

    /// The public identifier for the right to set this contract's proxy registry.
    bytes32 public constant SET_PROXY_REGISTRY = keccak256("SET_PROXY_REGISTRY");

    /// The public identifier for the right to configure item groups.
    bytes32 public constant CONFIGURE_GROUP = keccak256("CONFIGURE_GROUP");

    /// The public identifier for the right to mint items.
    bytes32 public constant MINT  = keccak256("MINT");

    /// The public identifier for the right to burn items.
    bytes32 public constant BURN = keccak256("BURN");

    /// The public identifier for the right to set item metadata.
    bytes32 public constant SET_METADATA = keccak256("SET_METADATA");

    /// The public identifier for the right to lock the metadata URI.
    bytes32 public constant LOCK_URI = keccak256("LOCK_URI");

    /// The public identifier for the right to lock an item's metadata.
    bytes32 public constant LOCK_ITEM_URI = keccak256("LOCK_ITEM_URI");

    /// The public identifier for the right to disable item creation.
    bytes32 public constant LOCK_CREATION = keccak256("LOCK_CREATION");

    /// @dev Supply the magic number for the required ERC-1155 interface.
    bytes4 public constant INTERFACE_ERC1155 = 0xd9b67a26;

    /// @dev Supply the magic number for the required ERC-1155 metadata extension.
    bytes4 public constant INTERFACE_ERC1155_METADATA_URI = 0x0e89341c;

    /// @dev A mask for isolating an item's group ID.
    uint256 public constant GROUP_MASK = uint256(type(uint128).max) << 128;

    /** 
      This struct defines the state variables for Super1155 diamond proxy.
    */
    struct Super1155StateVariables {
        string name;
        string metadataUri;
        string contractURI;
        address proxyRegistryAddress;
        mapping (uint256 => mapping(address => uint256)) balances;
        mapping (uint256 => mapping(address => uint256)) groupBalances;
        mapping(address => uint256) totalBalances;
        mapping (address => mapping(address => bool)) operatorApprovals;
        mapping (uint256 => ItemGroup) itemGroups;
        mapping (uint256 => uint256) circulatingSupply;
        mapping (uint256 => uint256) mintCount;
        mapping (uint256 => uint256) burnCount;
        mapping (uint256 => bool) metadataFrozen;
        mapping (uint256 => string) metadata;
        mapping (bytes4 => address) selectorToFacet;
        bool uriLocked;
        bool contractUriLocked;
        bool locked;
    }

    /**
      This struct defines the settings for a particular item group and is tracked
      in storage.

      @param initialized Whether or not this `ItemGroup` has been initialized.
      @param name A name for the item group.
      @param supplyType The supply type for this group of items.
      @param supplyData An optional integer used by some `supplyType` values.
      @param itemType The type of item represented by this item group.
      @param itemData An optional integer used by some `itemType` values.
      @param burnType The type of burning permitted by this item group.
      @param burnData An optional integer used by some `burnType` values.
      @param circulatingSupply The number of individual items within this group in
        circulation.
      @param mintCount The number of times items in this group have been minted.
      @param burnCount The number of times items in this group have been burnt.
    */
    struct ItemGroup {
        uint256 burnData;
        uint256 circulatingSupply;
        uint256 mintCount;
        uint256 burnCount;
        uint256 supplyData;
        uint256 itemData;
        ItemGroupTimeData timeData;
        ItemGroupTransferData transferData;
        ItemGroupIntrinsicData intrinsicData;
        SupplyType supplyType;
        ItemType itemType;
        BurnType burnType;
        bool initialized;
        string name;
    }

    /**
      @notice This enumeration type specifies the different assets that may be used to
        complete purchases from this mint shop.

      @param Point This specifies that the asset being used to complete
        this purchase is non-transferrable points from a `Staker` contract.
      @param Ether This specifies that the asset being used to complete
        this purchase is native Ether currency.
      @param Token This specifies that the asset being used to complete
        this purchase is an ERC-20 token.
    */
    enum AssetType {
        Point,
        Ether,
        Token
    }

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
        Flexible,
        TimeValue,
        TimePercent
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
        ItemGroupTimeData timeData;
        ItemGroupTransferData transferData;
        ItemGroupIntrinsicData intrinsicData;
        SupplyType supplyType;
        ItemType itemType;
        BurnType burnType;
        string name;
    }

    struct ItemGroupTimeData {
        uint256 timeStamp;
        uint256 timeInterval;
        uint256 timeRate;
        uint256 timeCap;
    }

    struct ItemGroupTransferData {
        uint256 transferTime;
        uint256 transferFeeAmount;
        address transferToken;
        TransferType transferType;
        TransferFeeType transferFeeType;
    }

    struct ItemGroupIntrinsicData {
        uint256 rate;
        uint256 burnShare;
        uint256 prefund;
        uint256 totalLocked;
        address intrinsicToken;
        bool intrinsic;
    }

    enum TransferType {
        Transferable,
        TemporaryTransfer,
        BoundToAddress
    }

    enum TransferFeeType {
        None,
        PerTransfer,
        PerItem,
        RatioCut
    }

    // Storage Locations
    function super1155StateVariables() internal pure returns(Super1155StateVariables storage _super1155StateVariables) {
        bytes32 storagePosition = keccak256("diamond.storage.StateVariables");
        assembly {
            _super1155StateVariables.slot := storagePosition
        }
    }
}