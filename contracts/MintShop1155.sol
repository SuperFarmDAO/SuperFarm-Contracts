// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./access/PermitControl.sol";
import "./Super1155.sol";
import "./Staker.sol";

/**
  @title A Shop contract for selling NFTs via direct minting through particular
    pools with specific participation requirements.
  @author Tim Clancy

  This launchpad contract sells new items by minting them into existence. It
  cannot be used to sell items that already exist.
*/
contract MintShop1155 is PermitControl, ReentrancyGuard {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  /// A version number for this Shop contract's interface.
  uint256 public version = 1;

  /// The public identifier for the right to set the payment receiver.
  bytes32 public constant SET_PAYMENT_RECEIVER
    = keccak256("SET_PAYMENT_RECEIVER");

  /// The public identifier for the right to lock the payment receiver.
  bytes32 public constant LOCK_PAYMENT_RECEIVER
    = keccak256("LOCK_PAYMENT_RECEIVER");

  /// The public identifier for the right to update the global purchase limit.
  bytes32 public constant UPDATE_GLOBAL_LIMIT
    = keccak256("UPDATE_GLOBAL_LIMIT");

  /// The public identifier for the right to lock the global purchase limit.
  bytes32 public constant LOCK_GLOBAL_LIMIT = keccak256("LOCK_GLOBAL_LIMIT");

  /// The public identifier for the right to sweep tokens.
  bytes32 public constant SWEEP = keccak256("SWEEP");

  /// The public identifier for the right to lock token sweeps.
  bytes32 public constant LOCK_SWEEP = keccak256("LOCK_SWEEP");

  /// The public identifier for the right to manage whitelists.
  bytes32 public constant WHITELIST = keccak256("WHITELIST");

  /// The public identifier for the right to manage item pools.
  bytes32 public constant POOL = keccak256("POOL");

  /// @dev A mask for isolating an item's group ID.
  uint256 constant GROUP_MASK = uint256(uint128(~0)) << 128;

  /// The item collection contract that minted items are sold from.
  Super1155 public item;

  /**
    The address where the payment from each item buyer is sent. Care must be
    taken that this address can actually take receipt of the Ether or ERC-20
    earnings.
  */
  address public paymentReceiver;

  /**
    A flag determining whether or not the `paymentReceiver` may be updated using
    the `updatePaymentReceiver` function.
  */
  bool public paymentReceiverLocked;

  /**
    A limit on the number of items that a particular address may purchase across
    any number of pools in this shop.
  */
  uint256 public globalPurchaseLimit;

  /**
    A flag determining whether or not the `globalPurchaseLimit` may be updated
    using the `updateGlobalPurchaseLimit` function.
  */
  bool public globalPurchaseLimitLocked;

  /// A mapping of addresses to the number of items each has purchased globally.
  mapping (address => uint256) public globalPurchaseCounts;

  /// A flag determining whether or not the `sweep` function may be used.
  bool public sweepLocked;

  /**
    The ID which should be taken by the next whitelist added. This value begins
    at one in order to reserve the zero-identifier for representing no whitelist
    at all, i.e. public.
  */
  uint256 public nextWhitelistId = 1;

  /**
    A mapping of whitelist IDs to specific Whitelist elements. Whitelists may be
    shared between pools via specifying their ID in a pool requirement.
  */
  mapping (uint256 => Whitelist) public whitelists;

  /// The next available ID to be assumed by the next pool added.
  uint256 public nextPoolId;

  /// A mapping of pool IDs to pools.
  mapping (uint256 => Pool) public pools;

  /**
    This mapping relates each item group ID to the next item ID within that
    group which should be issued, minus one.
  */
  mapping (uint256 => uint256) public nextItemIssues;

  /**
    This struct is a source of mapping-free input to the `addPool` function.

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
  }

  /**
    This struct tracks information about a single item pool in the Shop.

    @param name A name for the pool.
    @param startTime The timestamp when this pool begins allowing purchases.
    @param endTime The timestamp after which this pool disallows purchases.
    @param purchaseLimit The maximum number of items a single address may
      purchase from this pool.
    @param singlePurchaseLimit The maximum number of items a single address may
      purchase from this pool in a single transaction.
    @param purchaseCounts A mapping of addresses to the number of items each has
      purchased from this pool.
    @param requirement A PoolRequirement requisite for users who want to
      participate in this pool.
    @param itemGroups An array of all item groups currently present in this
      pool.
    @param currentPoolVersion A version number hashed with item group IDs before
           being used as keys to other mappings. This supports efficient
           invalidation of stale mappings.
    @param itemCaps A mapping of item group IDs to the maximum number this pool
      is allowed to mint.
    @param itemMinted A mapping of item group IDs to the number this pool has
      currently minted.
    @param itemPricesLength A mapping of item group IDs to the number of price
      assets available to purchase with.
    @param itemPrices A mapping of item group IDs to a mapping of available
      Price assets available to purchase with.
  */
  struct Pool {
    string name;
    uint256 startTime;
    uint256 endTime;
    uint256 purchaseLimit;
    uint256 singlePurchaseLimit;
    mapping (address => uint256) purchaseCounts;
    PoolRequirement requirement;
    uint256[] itemGroups;
    uint256 currentPoolVersion;
    mapping (bytes32 => uint256) itemCaps;
    mapping (bytes32 => uint256) itemMinted;
    mapping (bytes32 => uint256) itemPricesLength;
    mapping (bytes32 => mapping (uint256 => Price)) itemPrices;
  }

  /**
    This enumeration type specifies the different access rules that may be
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
    PointRequired
  }

  /**
    This struct tracks information about a prerequisite for a user to
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
    @param whitelistId The ID of an address whitelist to restrict participants
      in this pool. To participate, a purchaser must have their address present
      in the corresponding whitelist. Other requirements from `requiredType`
      also apply. An ID of 0 is a sentinel value for no whitelist required.
  */
  struct PoolRequirement {
    AccessType requiredType;
    address requiredAsset;
    uint256 requiredAmount;
    uint256 whitelistId;
  }

  /**
    This enumeration type specifies the different assets that may be used to
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
    This struct tracks information about a single asset with the associated
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
    This struct is a source of mapping-free input to the `addWhitelist`
    function.

    @param expiryTime A block timestamp after which this whitelist is
      automatically considered inactive, no matter the value of `isActive`.
    @param isActive Whether or not this whitelist is actively restricting
      purchases in blocks ocurring before `expiryTime`.
    @param addresses An array of addresses to whitelist for participation in a
      purchases guarded by a whitelist.
  */
  struct WhitelistInput {
    uint256 expiryTime;
    bool isActive;
    address[] addresses;
  }

  /**
    This struct tracks information about a single whitelist known to this shop.
    Whitelists may be shared across multiple different item pools.

    @param expiryTime A block timestamp after which this whitelist is
      automatically considered inactive, no matter the value of `isActive`.
    @param isActive Whether or not this whitelist is actively restricting
      purchases in blocks ocurring before `expiryTime`.
    @param currentWhitelistVersion A version number hashed with item group IDs
      before being used as keys to other mappings. This supports efficient
      invalidation of stale mappings to easily clear the whitelist.
    @param addresses A mapping of hashed addresses to a flag indicating whether
      this whitelist allows the address to participate in a purchase.
  */
  struct Whitelist {
    uint256 expiryTime;
    bool isActive;
    uint256 currentWhitelistVersion;
    mapping (bytes32 => bool) addresses;
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

    @param name A name for the pool.
    @param startTime The timestamp when this pool begins allowing purchases.
    @param endTime The timestamp after which this pool disallows purchases.
    @param purchaseLimit The maximum number of items a single address may
      purchase from this pool.
    @param singlePurchaseLimit The maximum number of items a single address may
      purchase from this pool in a single transaction.
    @param requirement A PoolRequirement requisite for users who want to
      participate in this pool.
    @param itemMetadataUri The metadata URI of the item collection being sold
      by this launchpad.
    @param items An array of PoolItems representing each item for sale in the
      pool.
  */
  struct PoolOutput {
    string name;
    uint256 startTime;
    uint256 endTime;
    uint256 purchaseLimit;
    uint256 singlePurchaseLimit;
    PoolRequirement requirement;
    string itemMetadataUri;
    PoolItem[] items;
  }

  /**
    This struct contains the information gleaned from the `getPool` and
    `getPools` functions; it represents a single pool's data. It also includes
    additional information relevant to a user's address lookup.

    @param name A name for the pool.
    @param startTime The timestamp when this pool begins allowing purchases.
    @param endTime The timestamp after which this pool disallows purchases.
    @param purchaseLimit The maximum number of items a single address may
      purchase from this pool.
    @param singlePurchaseLimit The maximum number of items a single address may
      purchase from this pool in a single transaction.
    @param requirement A PoolRequirement requisite for users who want to
      participate in this pool.
    @param itemMetadataUri The metadata URI of the item collection being sold by
      this launchpad.
    @param items An array of PoolItems representing each item for sale in the
      pool.
    @param purchaseCount The amount of items purchased from this pool by the
      specified address.
    @param whitelistStatus Whether or not the specified address is whitelisted
      for this pool.
  */
  struct PoolAddressOutput {
    string name;
    uint256 startTime;
    uint256 endTime;
    uint256 purchaseLimit;
    uint256 singlePurchaseLimit;
    PoolRequirement requirement;
    string itemMetadataUri;
    PoolItem[] items;
    uint256 purchaseCount;
    bool whitelistStatus;
  }

  /**
    An event to track an update to this shop's `paymentReceiver`.

    @param updater The calling address which updated the payment receiver.
    @param oldPaymentReceiver The address of the old payment receiver.
    @param newPaymentReceiver The address of the new payment receiver.
  */
  event PaymentReceiverUpdated(address indexed updater,
    address indexed oldPaymentReceiver, address indexed newPaymentReceiver);

  /**
    An event to track future changes to `paymentReceiver` being locked.

    @param locker The calling address which locked down the payment receiver.
  */
  event PaymentReceiverLocked(address indexed locker);

  /**
    An event to track an update to this shop's `globalPurchaseLimit`.

    @param updater The calling address which updated the purchase limit.
    @param oldPurchaseLimit The value of the old purchase limit.
    @param newPurchaseLimit The value of the new purchase limit.
  */
  event GlobalPurchaseLimitUpdated(address indexed updater,
    uint256 indexed oldPurchaseLimit, uint256 indexed newPurchaseLimit);

  /**
    An event to track future changes to `globalPurchaseLimit` being locked.

    @param locker The calling address which locked down the purchase limit.
  */
  event GlobalPurchaseLimitLocked(address indexed locker);

  /**
    An event to track a token sweep event.

    @param sweeper The calling address which triggered the sweeep.
    @param token The specific ERC-20 token being swept.
    @param amount The amount of the ERC-20 token being swept.
    @param recipient The recipient of the swept tokens.
  */
  event TokenSweep(address indexed sweeper, IERC20 indexed token,
    uint256 amount, address indexed recipient);

  /**
    An event to track future use of the `sweep` function being locked.

    @param locker The calling address which locked down sweeping.
  */
  event SweepLocked(address indexed locker);

  /**
    An event to track a specific whitelist being updated. When emitted this
    event indicates that a specific whitelist has had its settings completely
    replaced.

    @param updater The calling address which updated this whitelist.
    @param whitelistId The ID of the whitelist being updated.
    @param addresses The addresses that are now whitelisted with this update.
  */
  event WhitelistUpdated(address indexed updater, uint256 indexed whitelistId,
    address[] indexed addresses);

  /**
    An event to track the addition of addresses to a specific whitelist. When
    emitted this event indicates that a specific whitelist has had `addresses`
    added to it.

    @param adder The calling address which added to this whitelist.
    @param whitelistId The ID of the whitelist being added to.
    @param addresses The addresses that were added in this update.
  */
  event WhitelistAddition(address indexed adder, uint256 indexed whitelistId,
    address[] indexed addresses);

  /**
    An event to track the removal of addresses to a specific whitelist. When
    emitted this event indicates that a specific whitelist has had `addresses`
    removed from it.

    @param remover The calling address which removed from this whitelist.
    @param whitelistId The ID of the whitelist being removed from.
    @param addresses The addresses that were removed in this update.
  */
  event WhitelistRemoval(address indexed remover, uint256 indexed whitelistId,
    address[] indexed addresses);

  /**
    An event to track activating or deactivating a whitelist.

    @param updater The calling address which updated this whitelist.
    @param whitelistId The ID of the whitelist being removed from.
    @param isActive The flag for whitelist activation.
  */
  event WhitelistActiveUpdate(address indexed updater,
    uint256 indexed whitelistId, bool indexed isActive);

  /**
    An event to track an item pool's data being updated. When emitted this event
    indicates that a specific item pool's settings have been completely
    replaced.

    @param updater The calling address which updated this pool.
    @param poolId The ID of the pool being updated.
    @param pool The input data used to update the pool.
    @param groupIds The groupIds that are now on sale in the item pool.
    @param caps The caps, keyed to `groupIds`, of the maximum that each groupId
      may mint up to.
    @param prices The prices, keyed to `groupIds`, of the arrays for `Price`
      objects that each item group may be able be bought with.
  */
  event PoolUpdated(address indexed updater, uint256 poolId,
    PoolInput indexed pool, uint256[] groupIds, uint256[] caps,
    Price[][] indexed prices);

  /**
    An event to track the purchase of items from an item pool.

    @param buyer The address that bought the item from an item pool.
    @param poolId The ID of the item pool that the buyer bought from.
    @param itemIds The array of item IDs that were purchased by the user.
    @param amounts The keyed array of each amount of item purchased by `buyer`.
  */
  event ItemPurchased(address indexed buyer, uint256 poolId,
    uint256[] indexed itemIds, uint256[] amounts);

  /**
    Construct a new shop which can mint items upon purchase from various pools.

    @param _owner The address of the administrator governing this collection.
    @param _item The address of the Super1155 item collection contract that will
      be minting new items in sales.
    @param _paymentReceiver The address where shop earnings are sent.
    @param _globalPurchaseLimit A global limit on the number of items that a
      single address may purchase across all item pools in the shop.
  */
  constructor(address _owner, Super1155 _item, address _paymentReceiver,
    uint256 _globalPurchaseLimit) public {

    // Do not perform a redundant ownership transfer if the deployer should
    // remain as the owner of the collection.
    if (_owner != owner()) {
      transferOwnership(_owner);
    }

    // Continue initialization.
    item = _item;
    paymentReceiver = _paymentReceiver;
    globalPurchaseLimit = _globalPurchaseLimit;
  }

  /**
    Allow the shop owner or an approved manager to update the payment receiver
    address if it has not been locked.

    @param _newPaymentReceiver The address of the new payment receiver.
  */
  function updatePaymentReceiver(address _newPaymentReceiver) external
    hasValidPermit(UNIVERSAL, SET_PAYMENT_RECEIVER) {
    require(!paymentReceiverLocked,
      "MintShop1155: the payment receiver address is locked");
    address oldPaymentReceiver = paymentReceiver;
    paymentReceiver = _newPaymentReceiver;
    emit PaymentReceiverUpdated(_msgSender(), oldPaymentReceiver,
      _newPaymentReceiver);
  }

  /**
    Allow the shop owner or an approved manager to lock the payment receiver
    address against any future changes.
  */
  function lockPaymentReceiver() external
    hasValidPermit(UNIVERSAL, LOCK_PAYMENT_RECEIVER) {
    paymentReceiverLocked = true;
    emit PaymentReceiverLocked(_msgSender());
  }

  /**
    Allow the shop owner or an approved manager to update the global purchase
    limit if it has not been locked.

    @param _newGlobalPurchaseLimit The value of the new global purchase limit.
  */
  function updateGlobalPurchaseLimit(uint256 _newGlobalPurchaseLimit) external
    hasValidPermit(UNIVERSAL, UPDATE_GLOBAL_LIMIT) {
    require(!globalPurchaseLimitLocked,
      "MintShop1155: the global purchase limit is locked");
    uint256 oldGlobalPurchaseLimit = globalPurchaseLimit;
    globalPurchaseLimit = _newGlobalPurchaseLimit;
    emit GlobalPurchaseLimitUpdated(_msgSender(), oldGlobalPurchaseLimit,
      _newGlobalPurchaseLimit);
  }

  /**
    Allow the shop owner or an approved manager to lock the global purchase
    limit against any future changes.
  */
  function lockGlobalPurchaseLimit() external
    hasValidPermit(UNIVERSAL, LOCK_GLOBAL_LIMIT) {
    globalPurchaseLimitLocked = true;
    emit GlobalPurchaseLimitLocked(_msgSender());
  }

  /**
    Allow the owner or an approved manager to sweep all of a particular ERC-20
    token from the contract and send it to another address. This function exists
    to allow the shop owner to recover tokens that are otherwise sent directly
    to this contract and get stuck. Provided that sweeping is not locked, this
    is a useful tool to help buyers recover otherwise-lost funds.

    @param _token The token to sweep the balance from.
    @param _amount The amount of token to sweep.
    @param _address The address to send the swept tokens to.
  */
  function sweep(IERC20 _token, uint256 _amount, address _address) external
    hasValidPermit(UNIVERSAL, SWEEP) {
    require(!sweepLocked,
      "MintShop1155: the sweep function is locked");
    _token.safeTransferFrom(address(this), _address, _amount);
    emit TokenSweep(_msgSender(), _token, _amount, _address);
  }

  /**
    Allow the shop owner or an approved manager to lock the contract against any
    future token sweeps.
  */
  function lockSweep() external hasValidPermit(UNIVERSAL, LOCK_SWEEP) {
    sweepLocked = true;
    emit SweepLocked(_msgSender());
  }

  /**
    Allow the owner or an approved manager to add a new whitelist.

    @param _whitelist The WhitelistInput full of data defining the whitelist.
  */
  function addWhitelist(WhitelistInput memory _whitelist) external
    hasValidPermit(UNIVERSAL, WHITELIST) {
    updateWhitelist(nextWhitelistId, _whitelist);

    // Increment the ID which will be used by the next whitelist added.
    nextWhitelistId = nextWhitelistId.add(1);
  }

  /**
    Allow the owner or an approved manager to update a whitelist. This
    completely replaces the existing content for that whitelist.

    @param _id The whitelist ID to replace with the new whitelist.
    @param _whitelist The WhitelistInput full of data defining the whitelist.
  */
  function updateWhitelist(uint256 _id, WhitelistInput memory _whitelist)
    public hasValidPermit(UNIVERSAL, WHITELIST) {
    uint256 newWhitelistVersion =
      whitelists[_id].currentWhitelistVersion.add(1);

    // Immediately store some given information about this whitelist.
    Whitelist storage whitelist = whitelists[_id];
    whitelist.expiryTime = _whitelist.expiryTime;
    whitelist.isActive = _whitelist.isActive;
    whitelist.currentWhitelistVersion = newWhitelistVersion;

    // Invalidate the old mapping and store the new address participation flags.
    for (uint256 i = 0; i < _whitelist.addresses.length; i++) {
      bytes32 addressKey = keccak256(abi.encode(newWhitelistVersion,
        _whitelist.addresses[i]));
      whitelists[_id].addresses[addressKey] = true;
    }

    // Emit an event to track the new, replaced state of the whitelist.
    emit WhitelistUpdated(_msgSender(), _id, _whitelist.addresses);
  }

  /**
    Allow the owner or an approved manager to add specified addresses to an
    existing whitelist.

    @param _id The ID of the whitelist to add users to.
    @param _addresses The array of addresses to add.
  */
  function addToWhitelist(uint256 _id, address[] calldata _addresses) external
    hasValidPermit(UNIVERSAL, WHITELIST) {
    uint256 whitelistVersion = whitelists[_id].currentWhitelistVersion;
    for (uint256 i = 0; i < _addresses.length; i++) {
      bytes32 addressKey = keccak256(abi.encode(whitelistVersion,
        _addresses[i]));
      whitelists[_id].addresses[addressKey] = true;
    }

    // Emit an event to track the addition of new addresses to the whitelist.
    emit WhitelistAddition(_msgSender(), _id, _addresses);
  }

  /**
    Allow the owner or an approved manager to remove specified addresses from an
    existing whitelist.

    @param _id The ID of the whitelist to remove users from.
    @param _addresses The array of addresses to remove.
  */
  function removeFromWhitelist(uint256 _id, address[] calldata _addresses)
    external hasValidPermit(UNIVERSAL, WHITELIST) {
    uint256 whitelistVersion = whitelists[_id].currentWhitelistVersion;
    for (uint256 i = 0; i < _addresses.length; i++) {
      bytes32 addressKey = keccak256(abi.encode(whitelistVersion,
        _addresses[i]));
      whitelists[_id].addresses[addressKey] = false;
    }

    // Emit an event to track the removal of addresses from the whitelist.
    emit WhitelistRemoval(_msgSender(), _id, _addresses);
  }

  /**
    Allow the owner or an approved manager to manually set the active status of
    a specific whitelist.

    @param _id The ID of the whitelist to update the active flag for.
    @param _isActive The boolean flag to enable or disable the whitelist.
  */
  function setWhitelistActive(uint256 _id, bool _isActive) external
    hasValidPermit(UNIVERSAL, WHITELIST) {
    whitelists[_id].isActive = _isActive;

    // Emit an event to track whitelist activation status changes.
    emit WhitelistActiveUpdate(_msgSender(), _id, _isActive);
  }

  /**
    A function which allows the caller to retrieve whether or not addresses can
    participate in some given whitelists.

    @param _ids The IDs of the whitelists to check for `_addresses`.
    @param _addresses The addresses to check whitelist eligibility for.
  */
  function getWhitelistStatus(uint256[] calldata _ids,
    address[] calldata _addresses) external view returns (bool[][] memory) {
    bool[][] memory whitelistStatus;
    for (uint256 i = 0; i < _ids.length; i++) {
      uint256 id = _ids[i];
      uint256 whitelistVersion = whitelists[id].currentWhitelistVersion;
      for (uint256 j = 0; j < _addresses.length; j++) {
        bytes32 addressKey = keccak256(abi.encode(whitelistVersion,
          _addresses[j]));
        whitelistStatus[j][i] = whitelists[id].addresses[addressKey];
      }
    }
    return whitelistStatus;
  }

  /**
    A function which allows the caller to retrieve information about specific
    pools, the items for sale within, and the collection this shop uses.

    @param _ids An array of pool IDs to retrieve information about.
  */
  function getPools(uint256[] calldata _ids) external view
    returns (PoolOutput[] memory) {
    PoolOutput[] memory poolOutputs = new PoolOutput[](_ids.length);
    for (uint256 i = 0; i < _ids.length; i++) {
      uint256 id = _ids[i];

      // Process output for each pool.
      PoolItem[] memory poolItems = new PoolItem[](pools[id].itemGroups.length);
      for (uint256 j = 0; j < pools[id].itemGroups.length; j++) {
        uint256 itemGroupId = pools[id].itemGroups[j];
        bytes32 itemKey = keccak256(abi.encodePacked(
          pools[id].currentPoolVersion, itemGroupId));

        // Parse each price the item is sold at.
        Price[] memory itemPrices =
          new Price[](pools[id].itemPricesLength[itemKey]);
        for (uint256 k = 0; k < pools[id].itemPricesLength[itemKey]; k++) {
          itemPrices[k] = pools[id].itemPrices[itemKey][k];
        }

        // Track the item.
        poolItems[j] = PoolItem({
          groupId: itemGroupId,
          cap: pools[id].itemCaps[itemKey],
          minted: pools[id].itemMinted[itemKey],
          prices: itemPrices
        });
      }

      // Track the pool.
      poolOutputs[i] = PoolOutput({
        name: pools[id].name,
        startTime: pools[id].startTime,
        endTime: pools[id].endTime,
        purchaseLimit: pools[id].purchaseLimit,
        singlePurchaseLimit: pools[id].singlePurchaseLimit,
        requirement: pools[id].requirement,
        itemMetadataUri: item.metadataUri(),
        items: poolItems
      });
    }

    // Return the pools.
    return poolOutputs;
  }

  /**
    A function which allows the caller to retrieve the number of items specific
    addresses have purchased from specific pools.

    @param _ids The IDs of the pools to check for addresses in `purchasers`.
    @param _purchasers The addresses to check the purchase counts for.
  */
  function getPurchaseCounts(uint256[] calldata _ids,
    address[] calldata _purchasers) external view returns (uint256[][] memory) {
    uint256[][] memory purchaseCounts;
    for (uint256 i = 0; i < _ids.length; i++) {
      uint256 id = _ids[i];
      for (uint256 j = 0; j < _purchasers.length; j++) {
        address purchaser = _purchasers[j];
        purchaseCounts[j][i] = pools[id].purchaseCounts[purchaser];
      }
    }
    return purchaseCounts;
  }

  /**
    A function which allows the caller to retrieve information about specific
    pools, the items for sale within, and the collection this launchpad uses.
    A provided address differentiates this function from `getPools`; the added
    address enables this function to retrieve pool data as well as whitelisting
    and purchase count details for the provided address.

    @param _ids An array of pool IDs to retrieve information about.
    @param _address An address which enables this function to support additional
      relevant data lookups.
  */
  function getPoolsWithAddress(uint256[] calldata _ids, address _address)
    external view returns (PoolAddressOutput[] memory) {
    PoolAddressOutput[] memory poolOutputs =
      new PoolAddressOutput[](_ids.length);
    for (uint256 i = 0; i < _ids.length; i++) {
      uint256 id = _ids[i];

      // Process output for each pool.
      PoolItem[] memory poolItems = new PoolItem[](pools[id].itemGroups.length);
      for (uint256 j = 0; j < pools[id].itemGroups.length; j++) {
        uint256 itemGroupId = pools[id].itemGroups[j];
        bytes32 itemKey = keccak256(abi.encodePacked(
          pools[id].currentPoolVersion, itemGroupId));

        // Parse each price the item is sold at.
        Price[] memory itemPrices =
          new Price[](pools[id].itemPricesLength[itemKey]);
        for (uint256 k = 0; k < pools[id].itemPricesLength[itemKey]; k++) {
          itemPrices[k] = pools[id].itemPrices[itemKey][k];
        }

        // Track the item.
        poolItems[j] = PoolItem({
          groupId: itemGroupId,
          cap: pools[id].itemCaps[itemKey],
          minted: pools[id].itemMinted[itemKey],
          prices: itemPrices
        });
      }

      // Track the pool.
      uint256 whitelistId = pools[id].requirement.whitelistId;
      bytes32 addressKey = keccak256(
        abi.encode(whitelists[whitelistId].currentWhitelistVersion, _address));
      poolOutputs[i] = PoolAddressOutput({
        name: pools[id].name,
        startTime: pools[id].startTime,
        endTime: pools[id].endTime,
        purchaseLimit: pools[id].purchaseLimit,
        singlePurchaseLimit: pools[id].singlePurchaseLimit,
        requirement: pools[id].requirement,
        itemMetadataUri: item.metadataUri(),
        items: poolItems,
        purchaseCount: pools[id].purchaseCounts[_address],
        whitelistStatus: whitelists[whitelistId].addresses[addressKey]
      });
    }

    // Return the pools.
    return poolOutputs;
  }

  /**
    Allow the owner of the shop or an approved manager to add a new pool of
    items that users may purchase.

    @param _pool The PoolInput full of data defining the pool's operation.
    @param _groupIds The specific item group IDs to sell in this pool,
      keyed to the `_amounts` array.
    @param _issueNumberOffsets The offset for the next issue number minted for a
      particular item group in `_groupIds`. This is *important* to handle
      pre-minted or partially-minted item groups.
    @param _caps The maximum amount of each particular groupId that can be sold
      by this pool.
    @param _prices The asset address to price pairings to use for selling each
      item.
  */
  function addPool(PoolInput calldata _pool, uint256[] calldata _groupIds,
    uint256[] calldata _issueNumberOffsets, uint256[] calldata _caps,
    Price[][] memory _prices) external hasValidPermit(UNIVERSAL, POOL) {
    updatePool(nextPoolId, _pool, _groupIds, _issueNumberOffsets, _caps,
      _prices);

    // Increment the ID which will be used by the next pool added.
    nextPoolId = nextPoolId.add(1);
  }

  /**
    A private helper function for `updatePool` to prevent it from running too
    deep into the stack. This function will store the amount of each item group
    that this pool may mint.

    @param _id The ID of the pool to update.
    @param _groupIds The specific item group IDs to sell in this pool,
      keyed to the `_amounts` array.
    @param _issueNumberOffsets The offset for the next issue number minted for a
      particular item group in `_groupIds`. This is *important* to handle
      pre-minted or partially-minted item groups.
    @param _caps The maximum amount of each particular groupId that can be sold
      by this pool.
    @param _prices The asset address to price pairings to use for selling each
      item.
  */
  function _updatePoolHelper(uint256 _id,
    uint256[] calldata _groupIds, uint256[] calldata _issueNumberOffsets,
    uint256[] calldata _caps, Price[][] memory _prices) private {
    for (uint256 i = 0; i < _groupIds.length; i++) {
      require(_caps[i] > 0,
        "MintShop1155: cannot add an item group with no mintable amount");
      bytes32 itemKey = keccak256(abi.encode(
        pools[_id].currentPoolVersion, _groupIds[i]));
      pools[_id].itemCaps[itemKey] = _caps[i];

      // Pre-seed the next item issue IDs given the pool offsets.
      nextItemIssues[_groupIds[i]] = _issueNumberOffsets[i];

      // Store future purchase information for the item group.
      for (uint256 j = 0; j < _prices[i].length; j++) {
        pools[_id].itemPrices[itemKey][j] = _prices[i][j];
      }
      pools[_id].itemPricesLength[itemKey] = _prices[i].length;
    }
  }

  /**
    Allow the owner of the shop or an approved manager to update an existing
    pool of items.

    @param _id The ID of the pool to update.
    @param _pool The PoolInput full of data defining the pool's operation.
    @param _groupIds The specific item group IDs to sell in this pool,
      keyed to the `_amounts` array.
    @param _issueNumberOffsets The offset for the next issue number minted for a
      particular item group in `_groupIds`. This is *important* to handle
      pre-minted or partially-minted item groups.
    @param _caps The maximum amount of each particular groupId that can be sold
      by this pool.
    @param _prices The asset address to price pairings to use for selling each
      item.
  */
  function updatePool(uint256 _id, PoolInput calldata _pool,
    uint256[] calldata _groupIds, uint256[] calldata _issueNumberOffsets,
    uint256[] calldata _caps, Price[][] memory _prices) public
    hasValidPermit(UNIVERSAL, POOL) {
    require(_id <= nextPoolId,
      "MintShop1155: cannot update a non-existent pool");
    require(_pool.endTime >= _pool.startTime,
      "MintShop1155: cannot create a pool which ends before it starts");
    require(_groupIds.length > 0,
      "MintShop1155: must list at least one item group");
    require(_groupIds.length == _issueNumberOffsets.length,
      "MintShop1155: item groups length must equal issue offsets length");
    require(_groupIds.length == _caps.length,
      "MintShop1155: item groups length must equal caps length");
    require(_groupIds.length == _prices.length,
      "MintShop1155: item groups length must equal prices input length");

    // Immediately store some given information about this pool.
    Pool storage pool = pools[_id];
    pool.name = _pool.name;
    pool.startTime = _pool.startTime;
    pool.endTime = _pool.endTime;
    pool.purchaseLimit = _pool.purchaseLimit;
    pool.singlePurchaseLimit = _pool.singlePurchaseLimit;
    pool.itemGroups = _groupIds;
    pool.currentPoolVersion = pools[_id].currentPoolVersion.add(1);
    pool.requirement = _pool.requirement;

    // Delegate work to a helper function to avoid stack-too-deep errors.
    _updatePoolHelper(_id, _groupIds, _issueNumberOffsets, _caps, _prices);

    // Emit an event indicating that a pool has been updated.
    emit PoolUpdated(_msgSender(), _id, _pool, _groupIds, _caps, _prices);
  }

  /**
    Allow a buyer to purchase an item from a pool.

    @param _id The ID of the particular item pool that the user would like to
      purchase from.
    @param _groupId The item group ID that the user would like to purchase.
    @param _assetIndex The selection of supported payment asset `Price` that the
      buyer would like to make a purchase with.
    @param _amount The amount of item that the user would like to purchase.
  */
  function mintFromPool(uint256 _id, uint256 _groupId, uint256 _assetIndex,
    uint256 _amount) external nonReentrant payable {
    require(_amount > 0,
      "MintShop1155: must purchase at least one item");
    require(_id < nextPoolId,
      "MintShop1155: can only purchase items from an active pool");
    require(pools[_id].singlePurchaseLimit >= _amount,
      "MintShop1155: cannot exceed the per-transaction maximum");

    // Verify that the asset being used in the purchase is valid.
    bytes32 itemKey = keccak256(abi.encode(pools[_id].currentPoolVersion,
      _groupId));
    require(_assetIndex < pools[_id].itemPricesLength[itemKey],
      "MintShop1155: specified asset index is not valid");

    // Verify that the pool is running its sale.
    require(block.timestamp >= pools[_id].startTime
      && block.timestamp <= pools[_id].endTime,
      "MintShop1155: pool is not currently running its sale");

    // Verify that the pool is respecting per-address global purchase limits.
    uint256 userGlobalPurchaseAmount =
      _amount.add(globalPurchaseCounts[_msgSender()]);
    require(userGlobalPurchaseAmount <= globalPurchaseLimit,
      "MintShop1155: you may not purchase any more items from this shop");

    // Verify that the pool is respecting per-address pool purchase limits.
    uint256 userPoolPurchaseAmount =
      _amount.add(pools[_id].purchaseCounts[_msgSender()]);
    require(userPoolPurchaseAmount <= pools[_id].purchaseLimit,
      "MintShop1155: you may not purchase any more items from this pool");

    // Verify that the pool is either public, inactive, time-expired,
    // or the caller's address is whitelisted.
    {
      uint256 whitelistId = pools[_id].requirement.whitelistId;
      uint256 whitelistVersion =
        whitelists[whitelistId].currentWhitelistVersion;
      bytes32 addressKey = keccak256(abi.encode(whitelistVersion,
        _msgSender()));
      bool addressWhitelisted = whitelists[whitelistId].addresses[addressKey];
      require(whitelistId == 0
        || !whitelists[whitelistId].isActive
        || block.timestamp > whitelists[whitelistId].expiryTime
        || addressWhitelisted,
        "MintShop1155: you are not whitelisted on this pool");
    }

    // Verify that the pool is not depleted by the user's purchase.
    uint256 newCirculatingTotal = pools[_id].itemMinted[itemKey].add(_amount);
    require(newCirculatingTotal <= pools[_id].itemCaps[itemKey],
      "MintShop1155: there are not enough items available for you to purchase");

    // Verify that the user meets any requirements gating participation in this
    // pool. Verify that any possible ERC-20 requirements are met.
    PoolRequirement memory poolRequirement = pools[_id].requirement;
    if (poolRequirement.requiredType == AccessType.TokenRequired) {
      IERC20 requiredToken = IERC20(poolRequirement.requiredAsset);
      require(requiredToken.balanceOf(_msgSender())
        >= poolRequirement.requiredAmount,
        "MintShop1155: you do not have enough required token for this pool");

    // Verify that any possible ERC-1155 ownership requirements are met.
    } else if (poolRequirement.requiredType == AccessType.ItemRequired) {
      Super1155 requiredItem = Super1155(poolRequirement.requiredAsset);
      require(requiredItem.totalBalances(_msgSender())
        >= poolRequirement.requiredAmount,
        "MintShop1155: you do not have enough required item for this pool");

    // Verify that any possible Staker point threshold requirements are met.
    } else if (poolRequirement.requiredType == AccessType.PointRequired) {
      Staker requiredStaker = Staker(poolRequirement.requiredAsset);
      require(requiredStaker.getAvailablePoints(_msgSender())
        >= poolRequirement.requiredAmount,
        "MintShop1155: you do not have enough required points for this pool");
    }

    // Process payment for the user, checking to sell for Staker points.
    Price memory sellingPair = pools[_id].itemPrices[itemKey][_assetIndex];
    if (sellingPair.assetType == AssetType.Point) {
      Staker(sellingPair.asset).spendPoints(_msgSender(),
        sellingPair.price.mul(_amount));

    // Process payment for the user with a check to sell for Ether.
    } else if (sellingPair.assetType == AssetType.Ether) {
      uint256 etherPrice = sellingPair.price.mul(_amount);
      require(msg.value >= etherPrice,
        "MintShop1155: you did not send enough Ether to complete the purchase");
      (bool success, ) = payable(paymentReceiver).call{ value: msg.value }("");
      require(success,
        "MintShop1155: payment receiver transfer failed");

    // Process payment for the user with a check to sell for an ERC-20 token.
    } else if (sellingPair.assetType == AssetType.Token) {
      IERC20 sellingAsset = IERC20(sellingPair.asset);
      uint256 tokenPrice = sellingPair.price.mul(_amount);
      require(sellingAsset.balanceOf(_msgSender()) >= tokenPrice,
        "MintShop1155: you do not have enough token to complete the purchase");
      sellingAsset.safeTransferFrom(_msgSender(), paymentReceiver, tokenPrice);

    // Otherwise, error out because the payment type is unrecognized.
    } else {
      revert("MintShop1155: unrecognized asset type");
    }

    // If payment is successful, mint each of the user's purchased items.
    uint256[] memory itemIds = new uint256[](_amount);
    uint256[] memory amounts = new uint256[](_amount);
    uint256 nextIssueNumber = nextItemIssues[_groupId];
    {
      uint256 shiftedGroupId = _groupId << 128;
      for (uint256 i = 1; i <= _amount; i++) {
        uint256 itemId = shiftedGroupId.add(nextIssueNumber).add(i);
        itemIds[i - 1] = itemId;
        amounts[i - 1] = 1;
      }
    }

    // Mint the items.
    item.mintBatch(_msgSender(), itemIds, amounts, "");

    // Update the tracker for available item issue numbers.
    nextItemIssues[_groupId] = nextIssueNumber.add(_amount);

    // Update the count of circulating items from this pool.
    pools[_id].itemMinted[itemKey] = newCirculatingTotal;

    // Update the pool's count of items that a user has purchased.
    pools[_id].purchaseCounts[_msgSender()] = userPoolPurchaseAmount;

    // Update the global count of items that a user has purchased.
    globalPurchaseCounts[_msgSender()] = userGlobalPurchaseAmount;

    // Emit an event indicating a successful purchase.
    emit ItemPurchased(_msgSender(), _id, itemIds, amounts);
  }
}
