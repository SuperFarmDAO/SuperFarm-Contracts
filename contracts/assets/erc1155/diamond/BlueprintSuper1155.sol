// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

/** 
  @title Blueprint library for Super1155.
  @author Qazawat Zirak
  This library acts as a blueprint for storage mechanim in the proxy contract.
  The library defines state variables in form of structs. It also defines the 
  storage location of the variables using KECCAK256 to avoid memory collision. 
  The state is stored in Proxy contract, which does a delegate call to Facets.
  22 Dec, 2021.
*/
library BlueprintSuper1155 {
    /// The max value of 256 bits.
    uint256 constant MAX_INT = type(uint256).max;

    /// The public identifier for the right to set this contract's metadata URI.
    bytes32 public constant SET_URI = keccak256("SET_URI");

    /// The public identifier for the right to set this contract's proxy registry.
    bytes32 public constant SET_PROXY_REGISTRY =
        keccak256("SET_PROXY_REGISTRY");

    /// The public identifier for the right to configure item groups.
    bytes32 public constant CONFIGURE_GROUP = keccak256("CONFIGURE_GROUP");

    /// The public identifier for the right to mint items.
    bytes32 public constant MINT = keccak256("MINT");

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
    @param name the public name of this contract.
    @param metadataURI the ERC-1155 URI for tracking item metadata, 
      supporting {id} substitution. For example: 
      https://token-cdn-domain/{id}.json. See the ERC-1155 spec for
      more details: https://eips.ethereum.org/EIPS/eip-1155#metadata.
    @param contractURI the URI for the storefront-level metadata of contract.
    @param proxyRegistryAddress a proxy registry address for supporting 
      automatic delegated approval.
    @param linkProxy a proxy address which keeps track of all function to
      facet addresses.
    @param balances a mapping from each token ID to per-address balances.
    @param groupBalances a mapping from each group ID to per-address balances.
    @param totalBalances a mapping from each address to a collection-wide balance.
    @param operatorApprovals This is a mapping from each address to 
      per-address operator approvals. Operators are those addresses 
      that have been approved to transfer tokens on behalf of the 
      approver. Transferring tokens includes the right to burn tokens.
    @param itemGroups a mapping of data for each item group.
    @param circulatingSupply a mapping of circulating supplies 
      for each individual token.
    @param mintCount a mapping of the number of times each individual 
      token has been minted.
    @param burnCount a mapping of the number of times each individual 
      token has been burnt.
    @param metadataFrozen a mapping of token ID to a boolean representing 
      whether the item's metadata has been explicitly frozen via a call to 
      `lockURI(string calldata _uri, uint256 _id)`. Do note that it is 
      possible for an item's mapping here to be false while still having 
      frozen metadata if the item collection as a whole has had its 
      `uriLocked` value set to true.
    @param metaData A public mapping of optional on-chain metadata for 
      each token ID. A token's on-chain metadata is unable to be changed 
      if the item's metadata URI has been permanently fixed or if the 
      collection's metadata URI as a whole has been frozen.
    @param uriLocked whether or not the metadata URI has been locked 
      to future changes.
    @param contractUriLocked whether or not the contract URI has been 
      locked to future changes.
    @param locked whether or not the item collection has been locked 
      to all further minting.
  */
    struct Super1155StateVariables {
        string name;
        string metadataURI;
        string contractURI;
        address proxyRegistryAddress;
        address linkProxy;
        mapping(uint256 => mapping(address => uint256)) balances;
        mapping(uint256 => mapping(address => uint256)) groupBalances;
        mapping(address => uint256) totalBalances;
        mapping(address => mapping(address => bool)) operatorApprovals;
        mapping(uint256 => ItemGroup) itemGroups;
        mapping(uint256 => uint256) circulatingSupply;
        mapping(uint256 => uint256) mintCount;
        mapping(uint256 => uint256) burnCount;
        mapping(uint256 => bool) metadataFrozen;
        mapping(uint256 => string) metadata;
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
    @param TimeValue There is a fixed cap which increases unboundly based on
      time interval.
    @param TimePercent There is a fixed cap that does not increase. A percentage
      of this fixed cap is released based on time interval.
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
    /** 
    This struct keeps time data related to mints based on time.
    @param timeStamp the start of minting.
    @param timeInterval the time interval between mints.
    @param timeRate the amount of mint at interval.
    @param timeCap the max cap that is considered for TimePercent supplyType.
  */
    struct ItemGroupTimeData {
        uint256 timeStamp;
        uint256 timeInterval;
        uint256 timeRate;
        uint256 timeCap;
    }
    /** 
    This struct keeps data about transfer properties of items in a group.
    @param transferTime deadline of allowable transfer.
    @param transferFeeAmount the amount of fee in basis points.
    @param transferToken the transfer fee token.
    @param transferType the type of transfer.
    @param transferFeeType the fee type of transfer.
  */
    struct ItemGroupTransferData {
        uint256 transferTime;
        uint256 transferFeeAmount;
        address transferToken;
        TransferType transferType;
        TransferFeeType transferFeeType;
    }

    /** 
    This struct keeps track of information on intrinsic value of tokens.
    @param rate the intrinsic rate per token.
    @param burnShare the intrinsic share returned to owner on burn.
    @param prefund the amount prefunded for intrinsic mints at the time of
      configuring groups.
    @param totalLocked the total amount of intrinsic value locked in a group.
    @param intrinsicToken the intrinsic type of token.
    @param intrinsic is the group intrinsic or not.
  */
    struct ItemGroupIntrinsicData {
        uint256 rate;
        uint256 burnShare;
        uint256 prefund;
        uint256 totalLocked;
        address intrinsicToken;
        bool intrinsic;
    }

    /**
    This enum keeps information on the ability to be transfered of a group of items.
    @param Transferable items of this group are transferable.
    @param TemporaryTransfer items of this group are transferable before some time.
    @param BountToAddress items of this group are bound to holders.
  */
    enum TransferType {
        Transferable,
        TemporaryTransfer,
        BoundToAddress
    }

    /** 
    This enum keeps track of the type of fee of transfer method.
    @param None no charges for tranfser.
    @param PerTransfer charged per group once.
    @param PerItem charged per item based on amount specified for that group. Note
      that fungible items PerItem is the same as PerTransfer.
    @param RatioCut charge fee itself is a portion of total transfer for that ID.
      Note this method is only true for fungible items.
  */
    enum TransferFeeType {
        None,
        PerTransfer,
        PerItem,
        RatioCut
    }

    // Storage Locations
    function super1155StateVariables()
        internal
        pure
        returns (Super1155StateVariables storage _super1155StateVariables)
    {
        bytes32 storagePosition = keccak256("diamond.storage.StateVariables");
        assembly {
            _super1155StateVariables.slot := storagePosition
        }
    }
}
