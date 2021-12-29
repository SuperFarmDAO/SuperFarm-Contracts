// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "../../../assets/erc1155ds/ISuper1155.sol";

/** 
  @title Blueprint library for SuperMintShop.
  @author Qazawat Zirak
  This library acts as a blueprint for storage mechanim in the proxy contract.
  The library defines state variables in form of structs. It also defines the 
  storage location of the variables using KECCAK256 to avoid memory collision. 
  The state is stored in Proxy contract, which does a delegate call to Facets.

  22 Dec, 2021.
*/
library BlueprintSuperMintShop1155 {

  /// The public identifier for the right to set the payment receiver.
  bytes32 public constant SET_PAYMENT_RECEIVER = keccak256("SET_PAYMENT_RECEIVER");

  /// The public identifier for the right to lock the payment receiver.
  bytes32 public constant LOCK_PAYMENT_RECEIVER = keccak256("LOCK_PAYMENT_RECEIVER");

  /// The public identifier for the right to update the global purchase limit.
  bytes32 public constant UPDATE_GLOBAL_LIMIT = keccak256("UPDATE_GLOBAL_LIMIT");

  /// The public identifier for the right to lock the global purchase limit.
  bytes32 public constant LOCK_GLOBAL_LIMIT = keccak256("LOCK_GLOBAL_LIMIT");

  /// The public identifier for the right to manage whitelists.
  bytes32 public constant WHITELIST = keccak256("WHITELIST");

  /// The public identifier for the right to manage item pools.
  bytes32 public constant POOL = keccak256("POOL");

  /// The public identifier for the right to set new items.
  bytes32 public constant SET_ITEMS = keccak256("SET_ITEMS");

  /// @dev A mask for isolating an item's group ID.
  uint256 constant GROUP_MASK = uint256(type(uint128).max) << 128;

  /** 
    This struct defines the state variables for Super1155 diamond proxy.
  */
  struct SuperMintShop1155StateVariables {
    uint256 maxAllocation;
    uint256 nextPoolId;
    uint256 globalPurchaseLimit;
    ISuper1155[] items;
    address linkProxy;
    address paymentReceiver;
    bool paymentReceiverLocked;
    bool globalPurchaseLimitLocked;
    mapping (address => uint256) globalPurchaseCounts;
    mapping(uint256 => Pool) pools;
    mapping(bytes32 => uint256) nextItemIssues;
    mapping (bytes4 => address) selectorToFacet;

  }

  /**
    This struct tracks information about a single item pool in the Shop.
    @param currentPoolVersion A version number hashed with item group IDs before
      being used as keys to other mappings. This supports efficient
      invalidation of stale mappings.
    @param config configuration  struct PoolInput.
    @param purchaseCounts A mapping of addresses to the number of items each has
      purchased from this pool.
    @param itemCaps A mapping of item group IDs to the maximum number this pool
      is allowed to mint.
    @param itemMinted A mapping of item group IDs to the number this pool has
      currently minted.
    @param itemPrices A mapping of item group IDs to a mapping of available
      Price assets available to purchase with.
    @param itemGroups An array of all item groups currently present in this
      pool.
  */
  struct Pool {
    uint256 currentPoolVersion;
    PoolInput config;
    mapping (address => uint256) purchaseCounts;
    mapping (bytes32 => uint256) itemCaps;
    mapping (bytes32 => uint256) itemMinted;
    mapping (bytes32 => uint256) itemPricesLength;
    mapping (bytes32 => mapping (uint256 => Price)) itemPrices;
    uint256[] itemGroups;
    Whitelist[] whiteLists;
  }

  /**
    This struct tracks information about a single whitelist known to this shop.
    Whitelists may be shared across multiple different item pools.
    @param id Id of the whiteList.
    @param minted Mapping, which is needed to keep track of whether a user bought an nft or not.
  */
  struct Whitelist {
    uint256 id;
    mapping (address => bool) minted;
  }

  /**
    This struct tracks information about a single item being sold in a pool.
    @param groupId The group ID of the specific NFT in the collection being sold
      by a pool.
    @param cap The maximum number of items that this shop may mint for the
      specified `groupId`.
    @param minted The number of items that a pool has currently minted of the
      specified `groupId`.
    @param prices The `Price` options that may be used to purchase this item
      from its pool. A buyer may fulfill the purchase with any price option.
  */
  struct PoolItem {
    uint256 groupId;
    uint256 cap;
    uint256 minted;
    Price[] prices;
  }

  /**
    This struct contains the information gleaned from the `getPool` and
      `getPools` functions; it represents a single pool's data.
    @param config configuration struct PoolInput
    @param itemMetadataUri The metadata URI of the item collection being sold
      by this launchpad.
    @param items An array of PoolItems representing each item for sale in the
      pool.
  */
  struct PoolOutput {
    PoolInput config;
    string itemMetadataUri;
    PoolItem[] items;
  }

  /**
    @notice This struct is a source of mapping-free input to the `addPool` function.

    @param name A name for the pool.
    @param startTime The timestamp when this pool begins allowing purchases.
    @param endTime The timestamp after which this pool disallows purchases.
    @param purchaseLimit The maximum number of items a single address may
      purchase from this pool.
    @param singlePurchaseLimit The maximum number of items a single address may
      purchase from this pool in a single transaction.
    @param requirement A PoolRequirement requisite for users who want to
      participate in this pool.
  */
  struct PoolInput {
    string name;
    uint256 startTime;
    uint256 endTime;
    uint256 purchaseLimit;
    uint256 singlePurchaseLimit;
    PoolRequirement requirement;
    address collection;
  }

  /**
    @notice This enumeration type specifies the different access rules that may be
      applied to pools in this shop. Access to a pool may be restricted based on
      the buyer's holdings of either tokens or items.

    @param Public This specifies a pool which requires no special asset holdings
      to buy from.
    @param TokenRequired This specifies a pool which requires the buyer to hold
      some amount of ERC-20 tokens to buy from.
    @param ItemRequired This specifies a pool which requires the buyer to hold
      some amount of an ERC-1155 item to buy from.
    @param PointRequired This specifies a pool which requires the buyer to hold
      some amount of points in a Staker to buy from.
  */
  enum AccessType {
    Public,
    TokenRequired,
    ItemRequired,
    PointRequired,
    ItemRequired721
  }

  /**
    @notice This struct tracks information about a prerequisite for a user to
      participate in a pool.

    @param requiredType The `AccessType` being applied to gate buyers from
      participating in this pool. See `requiredAsset` for how additional data
      can apply to the access type.
    @param requiredAsset Some more specific information about the asset to
      require. If the `requiredType` is `TokenRequired`, we use this address to
      find the ERC-20 token that we should be specifically requiring holdings
      of. If the `requiredType` is `ItemRequired`, we use this address to find
      the item contract that we should be specifically requiring holdings of. If
      the `requiredType` is `PointRequired`, we treat this address as the
      address of a Staker contract. Do note that in order for this to work, the
      Staker must have approved this shop as a point spender.
    @param requiredAmount The amount of the specified `requiredAsset` required
      for the buyer to purchase from this pool.
    @param requiredId The ID of an address whitelist to restrict participants
      in this pool. To participate, a purchaser must have their address present
      in the corresponding whitelist. Other requirements from `requiredType`
      also apply. An ID of 0 is a sentinel value for no whitelist required.
  */
  struct PoolRequirement {
    AccessType requiredType;
    address[] requiredAsset;
    uint256 requiredAmount;
    uint256[] requiredId;
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
    @notice This struct tracks information about a single asset with the associated
      price that an item is being sold in the shop for. It also includes an
      `asset` field which is used to convey optional additional data about the
      asset being used to purchase with.

    @param assetType The `AssetType` type of the asset being used to buy.
    @param asset Some more specific information about the asset to charge in.
      If the `assetType` is Point, we use this address to find the specific
      Staker whose points are used as the currency.
      If the `assetType` is Ether, we ignore this field.
      If the `assetType` is Token, we use this address to find the
      ERC-20 token that we should be specifically charging with.
    @param price The amount of the specified `assetType` and `asset` to charge.
  */
  struct Price {
    AssetType assetType;
    address asset;
    uint256 price;
  }

  /**
  This structure is used at the moment of NFT purchase.
    @param whiteListId Id of a whiteList.
    @param index Element index in the original array
    @param allowance The quantity is available to the user for purchase.
    @param node Base hash of the element.
    @param merkleProof Proof that the user is on the whitelist.
  */
  struct WhiteListInput {
    uint256 whiteListId;
    uint256 index; 
    uint256 allowance;
    bytes32 node; 
    bytes32[] merkleProof;
  }

  /**
    This structure is used at the moment of NFT purchase.
    @param _accesslistId Id of a whiteList.
    @param _merkleRoot Hash root of merkle tree.
    @param _startTime The start date of the whitelist
    @param _endTime The end date of the whitelist
    @param _price The price that applies to the whitelist
    @param _token Token with which the purchase will be made
  */
  struct WhiteListCreate {
    uint256 _accesslistId;
    bytes32 _merkleRoot;
    uint256 _startTime; 
    uint256 _endTime; 
    uint256 _price; 
    address _token;
  }

  // Storage Locations
  function superMintShop1155StateVariables() internal pure returns(SuperMintShop1155StateVariables storage _superMintShop1155StateVariables) {
    bytes32 storagePosition = keccak256("diamond.storage.StateVariables");
    assembly {
        _superMintShop1155StateVariables.slot := storagePosition
    }
  }
}