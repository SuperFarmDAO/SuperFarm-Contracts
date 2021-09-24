// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./base/Sweepable.sol";
import "./interfaces/ISuper1155.sol";
import "./interfaces/IStaker.sol";
import "./interfaces/IMintShop.sol";


import "./libraries/LibStorage.sol";

/**
  @title A Shop contract for selling NFTs via direct minting through particular
    pools with specific participation requirements.
  @author Tim Clancy
  @author Qazawat Zirak

  This launchpad contract sells new items by minting them into existence. It
  cannot be used to sell items that already exist.
*/
contract MintShop1155 is Sweepable, ReentrancyGuard, IMintShop {
  using SafeERC20 for IERC20;


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

  /// The public identifier for the right to manage whitelists.
  bytes32 public constant WHITELIST = keccak256("WHITELIST");

  /// The public identifier for the right to manage item pools.
  bytes32 public constant POOL = keccak256("POOL");

  /// @dev A mask for isolating an item's group ID.
  uint256 constant GROUP_MASK = uint256(type(uint128).max) << 128;

  /// The item collection contract that minted items are sold from.
  ISuper1155 public item;


  address public paymentReceiver;

  bool public paymentReceiverLocked;

 
  uint256 public globalPurchaseLimit;


  bool public globalPurchaseLimitLocked;

  /// A mapping of addresses to the number of items each has purchased globally.
  mapping (address => uint256) public globalPurchaseCounts;


  uint256 public nextWhitelistId = 1;


  mapping (uint256 => Whitelist) public whitelists;

  /// The next available ID to be assumed by the next pool added.
  uint256 public nextPoolId;

  /// A mapping of pool IDs to pools.
  mapping (uint256 => Pool) public pools;


  mapping (uint256 => uint256) public nextItemIssues;


  struct Pool {
    string name;
    uint256 startTime;
    uint256 endTime;
    uint256 purchaseLimit;
    uint256 singlePurchaseLimit;
    mapping (address => uint256) purchaseCounts;
    LibStorage.PoolRequirement requirement;
    uint256[] itemGroups;
    uint256 currentPoolVersion;
    mapping (bytes32 => uint256) itemCaps;
    mapping (bytes32 => uint256) itemMinted;
    mapping (bytes32 => uint256) itemPricesLength;
    mapping (bytes32 => mapping (uint256 => LibStorage.Price)) itemPrices;
  }

 
  struct WhitelistInput {
    uint256 expiryTime;
    bool isActive;
    address[] addresses;
  }


  struct Whitelist {
    uint256 expiryTime;
    bool isActive;
    uint256 currentWhitelistVersion;
    mapping (bytes32 => bool) addresses;
  }

 
  struct PoolItem {
    uint256 groupId;
    uint256 cap;
    uint256 minted;
    LibStorage.Price[] prices;
  }


  struct PoolOutput {
    string name;
    uint256 startTime;
    uint256 endTime;
    uint256 purchaseLimit;
    uint256 singlePurchaseLimit;
    LibStorage.PoolRequirement requirement;
    string itemMetadataUri;
    PoolItem[] items;
  }


  struct PoolAddressOutput {
    string name;
    uint256 startTime;
    uint256 endTime;
    uint256 purchaseLimit;
    uint256 singlePurchaseLimit;
    LibStorage.PoolRequirement requirement;
    string itemMetadataUri;
    PoolItem[] items;
    uint256 purchaseCount;
    bool whitelistStatus;
  }

  event PaymentReceiverUpdated(address indexed updater,
    address indexed oldPaymentReceiver, address indexed newPaymentReceiver);


  event PaymentReceiverLocked(address indexed locker);


  event GlobalPurchaseLimitUpdated(address indexed updater,
    uint256 indexed oldPurchaseLimit, uint256 indexed newPurchaseLimit);

  event GlobalPurchaseLimitLocked(address indexed locker);


  event WhitelistUpdated(address indexed updater, uint256 indexed whitelistId,
    address[] indexed addresses);


  event WhitelistAddition(address indexed adder, uint256 indexed whitelistId,
    address[] indexed addresses);


  event WhitelistRemoval(address indexed remover, uint256 indexed whitelistId,
    address[] indexed addresses);

 
  event WhitelistActiveUpdate(address indexed updater,
    uint256 indexed whitelistId, bool indexed isActive);


  event PoolUpdated(address indexed updater, uint256 poolId,
    LibStorage.PoolInput indexed pool, uint256[] groupIds, uint256[] caps,
    LibStorage.Price[][] indexed prices);

  event ItemPurchased(address indexed buyer, uint256 poolId,
    uint256[] indexed itemIds, uint256[] amounts);


  constructor(address _owner, ISuper1155 _item, address _paymentReceiver,
    uint256 _globalPurchaseLimit) {

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

  function initialize(address _owner, ISuper1155 _item, address _paymentReceiver,
    uint256 _globalPurchaseLimit) external override {

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


  function version() external virtual override pure returns (uint256) {
    return 1;
  }


  function updatePaymentReceiver(address _newPaymentReceiver) external
     {
    require(!paymentReceiverLocked,
      "MintShop1155: the payment receiver address is locked");
    address oldPaymentReceiver = paymentReceiver;
    paymentReceiver = _newPaymentReceiver;
    emit PaymentReceiverUpdated(_msgSender(), oldPaymentReceiver,
      _newPaymentReceiver);
  }

  function lockPaymentReceiver() external
     {
    paymentReceiverLocked = true;
    emit PaymentReceiverLocked(_msgSender());
  }

  function updateGlobalPurchaseLimit(uint256 _newGlobalPurchaseLimit) external
    /*hasValidPermit(UNIVERSAL, UPDATE_GLOBAL_LIMIT)*/ {
    require(!globalPurchaseLimitLocked,
      "MintShop1155: the global purchase limit is locked");
    uint256 oldGlobalPurchaseLimit = globalPurchaseLimit;
    globalPurchaseLimit = _newGlobalPurchaseLimit;
    emit GlobalPurchaseLimitUpdated(_msgSender(), oldGlobalPurchaseLimit,
      _newGlobalPurchaseLimit);
  }

  function lockGlobalPurchaseLimit() external
    /*hasValidPermit(UNIVERSAL, LOCK_GLOBAL_LIMIT)*/ {
    globalPurchaseLimitLocked = true;
    emit GlobalPurchaseLimitLocked(_msgSender());
  }

  function addWhitelist(WhitelistInput memory _whitelist) external
    /*hasValidPermit(UNIVERSAL, WHITELIST)*/ {
    updateWhitelist(nextWhitelistId, _whitelist);

    // Increment the ID which will be used by the next whitelist added.
    nextWhitelistId += 1;
  }

  function updateWhitelist(uint256 _id, WhitelistInput memory _whitelist)
    public /*hasValidPermit(UNIVERSAL, WHITELIST)*/ {
    uint256 newWhitelistVersion =
      whitelists[_id].currentWhitelistVersion + 1;

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


  function addToWhitelist(uint256 _id, address[] calldata _addresses) external
    /*hasValidPermit(UNIVERSAL, WHITELIST)*/ {
    uint256 whitelistVersion = whitelists[_id].currentWhitelistVersion;
    for (uint256 i = 0; i < _addresses.length; i++) {
      bytes32 addressKey = keccak256(abi.encode(whitelistVersion,
        _addresses[i]));
      whitelists[_id].addresses[addressKey] = true;
    }

    // Emit an event to track the addition of new addresses to the whitelist.
    emit WhitelistAddition(_msgSender(), _id, _addresses);
  }

  function removeFromWhitelist(uint256 _id, address[] calldata _addresses)
    external /*hasValidPermit(UNIVERSAL, WHITELIST) */{
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
    /*hasValidPermit(UNIVERSAL, WHITELIST) */{
    whitelists[_id].isActive = _isActive;

    // Emit an event to track whitelist activation status changes.
    emit WhitelistActiveUpdate(_msgSender(), _id, _isActive);
  }

  function getWhitelistStatus(address[] calldata _addresses,
  uint256[] calldata _ids) external view returns (bool[][] memory) {
    bool[][] memory whitelistStatus = new bool[][](_addresses.length);
    for (uint256 i = 0; i < _addresses.length; i++) {
      whitelistStatus[i] = new bool[](_ids.length);
      for (uint256 j = 0; j < _ids.length; j++) {
        uint256 id = _ids[j];
        uint256 whitelistVersion = whitelists[id].currentWhitelistVersion;
        bytes32 addressKey = keccak256(abi.encode(whitelistVersion, _addresses[i]));
        whitelistStatus[i][j] = whitelists[id].addresses[addressKey];
      }
    }
    return whitelistStatus;
  }

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
        LibStorage.Price[] memory itemPrices =
          new LibStorage.Price[](pools[id].itemPricesLength[itemKey]);
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
        itemMetadataUri: item.getThisMetadataUri(),
        items: poolItems
      });
    }

    // Return the pools.
    return poolOutputs;
  }

  function getPurchaseCounts(address[] calldata _purchasers, 
  uint256[] calldata _ids) external view returns (uint256[][] memory) {
    uint256[][] memory purchaseCounts = new uint256[][](_purchasers.length);
    for (uint256 i = 0; i < _purchasers.length; i++) {
      purchaseCounts[i] = new uint256[](_ids.length);
      for (uint256 j = 0; j < _ids.length; j++) {
        uint256 id = _ids[j];
        address purchaser = _purchasers[i];
        purchaseCounts[i][j] = pools[id].purchaseCounts[purchaser];
      }
    }
    return purchaseCounts;
  }

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
        LibStorage.Price[] memory itemPrices =
          new LibStorage.Price[](pools[id].itemPricesLength[itemKey]);
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
        itemMetadataUri: item.getThisMetadataUri(),
        items: poolItems,
        purchaseCount: pools[id].purchaseCounts[_address],
        whitelistStatus: whitelists[whitelistId].addresses[addressKey]
      });
    }

    // Return the pools.
    return poolOutputs;
  }


  function addPool(LibStorage.PoolInput calldata _pool, uint256[] calldata _groupIds,
    uint256[] calldata _issueNumberOffsets, uint256[] calldata _caps,
    LibStorage.Price[][] memory _prices) external override  {
    updatePool(nextPoolId, _pool, _groupIds, _issueNumberOffsets, _caps,
      _prices);

    // Increment the ID which will be used by the next pool added.
    nextPoolId += 1;
  }


  function _updatePoolHelper(uint256 _id,
    uint256[] calldata _groupIds, uint256[] calldata _issueNumberOffsets,
    uint256[] calldata _caps, LibStorage.Price[][] memory _prices) private {
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


  function updatePool(uint256 _id, LibStorage.PoolInput calldata _pool,
    uint256[] calldata _groupIds, uint256[] calldata _issueNumberOffsets,
    uint256[] calldata _caps, LibStorage.Price[][] memory _prices) public
     {
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
    pool.currentPoolVersion = pools[_id].currentPoolVersion + 1;
    pool.requirement = _pool.requirement;

    // Delegate work to a helper function to avoid stack-too-deep errors.
    _updatePoolHelper(_id, _groupIds, _issueNumberOffsets, _caps, _prices);

    // Emit an event indicating that a pool has been updated.
    emit PoolUpdated(_msgSender(), _id, _pool, _groupIds, _caps, _prices);
  }


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
      _amount + globalPurchaseCounts[_msgSender()];
    require(userGlobalPurchaseAmount <= globalPurchaseLimit,
      "MintShop1155: you may not purchase any more items from this shop");

    // Verify that the pool is respecting per-address pool purchase limits.
    uint256 userPoolPurchaseAmount =
      _amount + pools[_id].purchaseCounts[_msgSender()];
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
    uint256 newCirculatingTotal = pools[_id].itemMinted[itemKey] + _amount;
    require(newCirculatingTotal <= pools[_id].itemCaps[itemKey],
      "MintShop1155: there are not enough items available for you to purchase");

    // Verify that the user meets any requirements gating participation in this
    // pool. Verify that any possible ERC-20 requirements are met.
    LibStorage.PoolRequirement memory poolRequirement = pools[_id].requirement;
    if (poolRequirement.requiredType == LibStorage.AccessType.TokenRequired) {
      IERC20 requiredToken = IERC20(poolRequirement.requiredAsset);
      require(requiredToken.balanceOf(_msgSender())
        >= poolRequirement.requiredAmount,
        "MintShop1155: you do not have enough required token for this pool");

    // Verify that any possible ERC-1155 ownership requirements are met.
    } else if (poolRequirement.requiredType == LibStorage.AccessType.ItemRequired) {
      ISuper1155 requiredItem = ISuper1155(poolRequirement.requiredAsset);
      require(requiredItem.getTotalBalances(_msgSender())
        >= poolRequirement.requiredAmount,
        "MintShop1155: you do not have enough required item for this pool");

    // Verify that any possible Staker point threshold requirements are met.
    } else if (poolRequirement.requiredType == LibStorage.AccessType.PointRequired) {
      IStaker requiredStaker = IStaker(poolRequirement.requiredAsset);
      require(requiredStaker.getAvailablePoints(_msgSender())
        >= poolRequirement.requiredAmount,
        "MintShop1155: you do not have enough required points for this pool");
    }

    // Process payment for the user, checking to sell for Staker points.
    LibStorage.Price memory sellingPair = pools[_id].itemPrices[itemKey][_assetIndex];
    if (sellingPair.assetType == LibStorage.AssetType.Point) {
      IStaker(sellingPair.asset).spendPoints(_msgSender(),
        sellingPair.price * _amount);

    // Process payment for the user with a check to sell for Ether.
    } else if (sellingPair.assetType == LibStorage.AssetType.Ether) {
      uint256 etherPrice = sellingPair.price * _amount;
      require(msg.value >= etherPrice,
        "MintShop1155: you did not send enough Ether to complete the purchase");
      (bool success, ) = payable(paymentReceiver).call{ value: msg.value }("");
      require(success,
        "MintShop1155: payment receiver transfer failed");

    // Process payment for the user with a check to sell for an ERC-20 token.
    } else if (sellingPair.assetType == LibStorage.AssetType.Token) {
      IERC20 sellingAsset = IERC20(sellingPair.asset);
      uint256 tokenPrice = sellingPair.price * _amount;
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
        uint256 itemId = (shiftedGroupId + nextIssueNumber) + i;
        itemIds[i - 1] = itemId;
        amounts[i - 1] = 1;
      }
    }

    // Mint the items.
    item.mintBatch(_msgSender(), itemIds, amounts, "");

    // Update the tracker for available item issue numbers.
    nextItemIssues[_groupId] = nextIssueNumber + _amount;

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
