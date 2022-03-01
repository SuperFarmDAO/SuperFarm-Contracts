// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../../base/Sweepable.sol";
import "../../../assets/erc1155/interfaces/ISuper1155.sol";
import "../../../assets/erc721/interfaces/ISuper721.sol";
import "../../../interfaces/IStaker.sol";
import "../../../libraries/merkle/SuperMerkleAccess.sol";
import "../../../libraries/DFStorage.sol";

/**
  @title A Shop contract for selling NFTs via direct minting through particular
    pools with specific participation requirements.
  @author Tim Clancy
  @author Qazawat Zirak
  @author Rostislav Khlebnikov
  @author Nikita Elunin


  This launchpad contract sells new items by minting them into existence. It
  cannot be used to sell items that already exist.
*/
abstract contract MintShop1155 is
    Sweepable,
    ReentrancyGuard,
    SuperMerkleAccess
{
    using SafeERC20 for IERC20;

    /// The public identifier for the right to set the payment receiver.
    bytes32 public constant SET_PAYMENT_RECEIVER =
        keccak256("SET_PAYMENT_RECEIVER");

    /// The public identifier for the right to lock the payment receiver.
    bytes32 public constant LOCK_PAYMENT_RECEIVER =
        keccak256("LOCK_PAYMENT_RECEIVER");

    /// The public identifier for the right to update the global purchase limit.
    bytes32 public constant UPDATE_GLOBAL_LIMIT =
        keccak256("UPDATE_GLOBAL_LIMIT");

    /// The public identifier for the right to lock the global purchase limit.
    bytes32 public constant LOCK_GLOBAL_LIMIT = keccak256("LOCK_GLOBAL_LIMIT");

    /// The public identifier for the right to manage whitelists.
    bytes32 public constant WHITELIST = keccak256("WHITELIST");

    /// The public identifier for the right to manage item pools.
    bytes32 public constant POOL = keccak256("POOL");

    /// @dev A mask for isolating an item's group ID.
    uint256 constant GROUP_MASK = uint256(type(uint128).max) << 128;

    /// The maximum amount that can be minted through all collections.
    uint256 public immutable maxAllocation;

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
    mapping(address => uint256) public globalPurchaseCounts;

    /// The next available ID to be assumed by the next pool added.
    uint256 public nextPoolId;

    /// A mapping of pool IDs to pools.
    mapping(uint256 => Pool) public pools;

    /**
    This mapping relates each item group ID to the next item ID within that
    group which should be issued, minus one.
  */
    mapping(bytes32 => uint256) public nextItemIssues;

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
        Config config;
        mapping(address => uint256) purchaseCounts;
        mapping(bytes32 => uint256) itemCaps;
        mapping(bytes32 => uint256) itemMinted;
        mapping(bytes32 => uint256) itemPricesLength;
        mapping(bytes32 => mapping(uint256 => DFStorage.Price)) itemPrices;
        uint256[] itemGroups;
        Whitelist[] whiteLists;
    }

    struct Config {
        string name;
        uint256 startTime;
        uint256 endTime;
        uint256 purchaseLimit;
        uint256 singlePurchaseLimit;
        address collection;
        PoolRequirement requirement;
    }

    struct Config2 {
        uint256 startTime;
        uint256 endTime;
        uint256 totalCap;
        uint256 callerCap;
        uint256 transactionCap;
        uint256 startingPrice;
        uint256 endingPrice;
        uint256 tickDuration;
        uint256 tickAmount;
    }

    struct PoolRequirement {
        AccessType requiredType;
        address[] requiredAsset;
        uint256 requiredAmount;
        uint256[] requiredId;
    }

    enum AccessType {
        Public,
        TokenRequired,
        ItemRequired,
        PointRequired,
        ItemRequired721
    }

    /**
    This struct tracks information about a single whitelist known to this shop.
    Whitelists may be shared across multiple different item pools.
    @param id Id of the whiteList.
    @param minted Mapping, which is needed to keep track of whether a user bought an nft or not.
  */
    struct Whitelist {
        uint256 id;
        mapping(address => bool) minted;
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
        DFStorage.Price[] prices;
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
        Config config;
        string itemMetadataUri;
        PoolItem[] items;
    }

    /**
    An event to track an update to this shop's `paymentReceiver`.

    @param updater The calling address which updated the payment receiver.
    @param oldPaymentReceiver The address of the old payment receiver.
    @param newPaymentReceiver The address of the new payment receiver.
  */
    event PaymentReceiverUpdated(
        address indexed updater,
        address indexed oldPaymentReceiver,
        address indexed newPaymentReceiver
    );

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
    event GlobalPurchaseLimitUpdated(
        address indexed updater,
        uint256 indexed oldPurchaseLimit,
        uint256 indexed newPurchaseLimit
    );

    /**
    An event to track future changes to `globalPurchaseLimit` being locked.

    @param locker The calling address which locked down the purchase limit.
  */
    event GlobalPurchaseLimitLocked(address indexed locker);

    /**
    An event to track a specific whitelist being updated. When emitted this
    event indicates that a specific whitelist has had its settings completely
    replaced.

    @param updater The calling address which updated this whitelist.
    @param whitelistId The ID of the whitelist being updated.
    @param timestamp Timestamp of whiteList update.
  */
    event WhitelistUpdated(
        address indexed updater,
        uint256 whitelistId,
        uint256 timestamp
    );

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
    event PoolUpdated(
        address indexed updater,
        uint256 poolId,
        Config indexed pool,
        uint256[] groupIds,
        uint256[] caps,
        DFStorage.Price[][] indexed prices
    );

    /**
    An event to track the purchase of items from an item pool.

    @param buyer The address that bought the item from an item pool.
    @param poolId The ID of the item pool that the buyer bought from.
    @param itemIds The array of item IDs that were purchased by the user.
    @param amounts The keyed array of each amount of item purchased by `buyer`.
  */
    event ItemPurchased(
        address indexed buyer,
        uint256 poolId,
        uint256[] indexed itemIds,
        uint256[] amounts
    );

    /**
    Construct a new shop which can mint items upon purchase from various pools.

    @param _paymentReceiver The address where shop earnings are sent.
    @param _globalPurchaseLimit A global limit on the number of items that a
      single address may purchase across all item pools in the shop.
  */
    constructor(
        address _owner,
        address _paymentReceiver,
        uint256 _globalPurchaseLimit,
        uint256 _maxAllocation
    ) {
        if (_owner != owner()) {
            transferOwnership(_owner);
        }
        // Initialization.
        paymentReceiver = _paymentReceiver;
        globalPurchaseLimit = _globalPurchaseLimit;
        maxAllocation = _maxAllocation;
    }

    /**
    Allow the shop owner or an approved manager to update the payment receiver
    address if it has not been locked.

    @param _newPaymentReceiver The address of the new payment receiver.
  */
    function updatePaymentReceiver(address _newPaymentReceiver)
        external
        hasValidPermit(UNIVERSAL, SET_PAYMENT_RECEIVER)
    {
        require(!paymentReceiverLocked, "XXX");
        emit PaymentReceiverUpdated(
            msg.sender,
            paymentReceiver,
            _newPaymentReceiver
        );
        // address oldPaymentReceiver = paymentReceiver;
        paymentReceiver = _newPaymentReceiver;
    }

    /**
    Allow the shop owner or an approved manager to lock the payment receiver
    address against any future changes.
  */
    function lockPaymentReceiver()
        external
        hasValidPermit(UNIVERSAL, LOCK_PAYMENT_RECEIVER)
    {
        paymentReceiverLocked = true;
        emit PaymentReceiverLocked(msg.sender);
    }

    /**
    Allow the shop owner or an approved manager to update the global purchase
    limit if it has not been locked.

    @param _newGlobalPurchaseLimit The value of the new global purchase limit.
  */
    function updateGlobalPurchaseLimit(uint256 _newGlobalPurchaseLimit)
        external
        hasValidPermit(UNIVERSAL, UPDATE_GLOBAL_LIMIT)
    {
        require(!globalPurchaseLimitLocked, "0x0A");
        emit GlobalPurchaseLimitUpdated(
            msg.sender,
            globalPurchaseLimit,
            _newGlobalPurchaseLimit
        );
        globalPurchaseLimit = _newGlobalPurchaseLimit;
    }

    /**
    Allow the shop owner or an approved manager to lock the global purchase
    limit against any future changes.
  */
    function lockGlobalPurchaseLimit()
        external
        hasValidPermit(UNIVERSAL, LOCK_GLOBAL_LIMIT)
    {
        globalPurchaseLimitLocked = true;
        emit GlobalPurchaseLimitLocked(msg.sender);
    }

    /**
    Adds new whiteList restriction for the pool by `_poolId`.
    @param _poolId id of the pool, where new white list is added.
    @param whitelist struct for creating a new whitelist.
   */
    function addWhiteList(
        uint256 _poolId,
        DFStorage.WhiteListCreate[] calldata whitelist
    ) external hasValidPermit(UNIVERSAL, WHITELIST) {
        for (uint256 i = 0; i < whitelist.length; i++) {
            super.setAccessRound(
                whitelist[i]._accesslistId,
                whitelist[i]._merkleRoot,
                whitelist[i]._startTime,
                whitelist[i]._endTime,
                whitelist[i]._price,
                whitelist[i]._token
            );
            pools[_poolId].whiteLists.push();
            uint256 newIndex = pools[_poolId].whiteLists.length - 1;
            pools[_poolId].whiteLists[newIndex].id = whitelist[i]._accesslistId;
            emit WhitelistUpdated(
                msg.sender,
                whitelist[i]._accesslistId,
                block.timestamp
            );
        }
    }

    /**
    A function which allows the caller to retrieve the number of items specific
    addresses have purchased from specific pools.

    @param _ids The IDs of the pools to check for addresses in `purchasers`.
    @param _purchasers The addresses to check the purchase counts for.
  */
    function getPurchaseCounts(
        address[] calldata _purchasers,
        uint256[] calldata _ids
    ) external view returns (uint256[][] memory) {
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
    function addPool(
        Config calldata _pool,
        uint256[] calldata _groupIds,
        uint256[] calldata _issueNumberOffsets,
        uint256[] calldata _caps,
        DFStorage.Price[][] calldata _prices
    ) external hasValidPermit(UNIVERSAL, POOL) {
        updatePool(
            nextPoolId,
            _pool,
            _groupIds,
            _issueNumberOffsets,
            _caps,
            _prices
        );

        // Increment the ID which will be used by the next pool added.
        nextPoolId += 1;
    }

    /**
    Allow the owner of the shop or an approved manager to update an existing
    pool of items.

    @param _id The ID of the pool to update.
    @param _config The PoolInput full of data defining the pool's operation.
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
    function updatePool(
        uint256 _id,
        Config calldata _config,
        uint256[] calldata _groupIds,
        uint256[] calldata _issueNumberOffsets,
        uint256[] calldata _caps,
        DFStorage.Price[][] memory _prices
    ) public hasValidPermit(UNIVERSAL, POOL) {
        require(
            _id <= nextPoolId &&
                _config.endTime >= _config.startTime &&
                _groupIds.length > 0,
            "0x1A"
        );
        require(
            _groupIds.length == _caps.length &&
                _caps.length == _prices.length &&
                _issueNumberOffsets.length == _prices.length,
            "0x4A"
        );

        // Immediately store some given information about this pool.
        Pool storage pool = pools[_id];
        pool.config = _config;
        pool.itemGroups = _groupIds;
        pool.currentPoolVersion = pools[_id].currentPoolVersion + 1;

        // Delegate work to a helper function to avoid stack-too-deep errors.
        _updatePoolHelper(_id, _groupIds, _issueNumberOffsets, _caps, _prices);

        // Emit an event indicating that a pool has been updated.
        emit PoolUpdated(msg.sender, _id, _config, _groupIds, _caps, _prices);
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
    function _updatePoolHelper(
        uint256 _id,
        uint256[] calldata _groupIds,
        uint256[] calldata _issueNumberOffsets,
        uint256[] calldata _caps,
        DFStorage.Price[][] memory _prices
    ) private {
        for (uint256 i = 0; i < _groupIds.length; i++) {
            require(_caps[i] > 0, "0x5A");
            bytes32 itemKey = keccak256(
                abi.encodePacked(
                    pools[_id].config.collection,
                    pools[_id].currentPoolVersion,
                    _groupIds[i]
                )
            );
            pools[_id].itemCaps[itemKey] = _caps[i];

            // Pre-seed the next item issue IDs given the pool offsets.
            // We generate a key from collection address and groupId.
            // bytes32 key = keccak256(
            //     abi.encodePacked(pools[_id].config.collection, _groupIds[i])
            // );
            nextItemIssues[itemKey] = _issueNumberOffsets[i];

            // Store future purchase information for the item group.
            for (uint256 j = 0; j < _prices[i].length; j++) {
                pools[_id].itemPrices[itemKey][j] = _prices[i][j];
            }
            pools[_id].itemPricesLength[itemKey] = _prices[i].length;
        }
    }

    function updatePoolConfig(uint256 _id, Config calldata _config)
        external
        hasValidPermit(UNIVERSAL, POOL)
    {
        require(
            _id <= nextPoolId && _config.endTime >= _config.startTime,
            "0x1A"
        );
        pools[_id].config = _config;
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
    function mintFromPool(
        uint256 _id,
        uint256 _groupId,
        uint256 _assetIndex,
        uint256 _amount,
        DFStorage.WhiteListInput calldata _whiteList
    ) external payable nonReentrant {
        require(_amount > 0, "0x0B");
        require(
            _id < nextPoolId &&
                pools[_id].config.singlePurchaseLimit >= _amount,
            "0x1B"
        );

        bool whiteListed;
        if (pools[_id].whiteLists.length != 0) {
           
            whiteListed =
                super.verify(
                    _whiteList.whiteListId,
                    _whiteList.index,
                    _whiteList.node,
                    _whiteList.merkleProof
                ) &&
                !pools[_id].whiteLists[_whiteList.whiteListId].minted[
                    msg.sender
                ];
        }

        require(
            (block.timestamp >= pools[_id].config.startTime &&
                block.timestamp <= pools[_id].config.endTime) || whiteListed,
            "0x4B"
        );

        bytes32 itemKey = keccak256(
            abi.encodePacked(
                pools[_id].config.collection,
                pools[_id].currentPoolVersion,
                _groupId
            )
        );
        require(_assetIndex < pools[_id].itemPricesLength[itemKey], "0x3B");

        // Verify that the pool is running its sale.

        // Verify that the pool is respecting per-address global purchase limits.
        uint256 userGlobalPurchaseAmount = _amount +
            globalPurchaseCounts[msg.sender];

        if (globalPurchaseLimit != 0) {
            require(userGlobalPurchaseAmount <= globalPurchaseLimit, "0x5B");

            // Verify that the pool is respecting per-address pool purchase limits.
        }
        uint256 userPoolPurchaseAmount = _amount +
            pools[_id].purchaseCounts[msg.sender];

        // Verify that the pool is not depleted by the user's purchase.
        uint256 newCirculatingTotal = pools[_id].itemMinted[itemKey] + _amount;
        require(newCirculatingTotal <= pools[_id].itemCaps[itemKey], "0x7B");

        {
            uint256 result;
            for (uint256 i = 0; i < nextPoolId; i++) {
                for (uint256 j = 0; j < pools[i].itemGroups.length; j++) {
                    result += pools[i].itemMinted[itemKey];
                }
            }
            require(maxAllocation >= result + _amount, "0x0D");
        }

        require(checkRequirments(_id), "0x8B");

        sellingHelper(
            _id,
            itemKey,
            _assetIndex,
            _amount,
            whiteListed,
            _whiteList.whiteListId
        );

        mintingHelper(
            _groupId,
            _id,
            itemKey,
            _amount,
            newCirculatingTotal,
            userPoolPurchaseAmount,
            userGlobalPurchaseAmount
        );

        // Emit an event indicating a successful purchase.
    }

    function isEligible(
        DFStorage.WhiteListInput calldata _whiteList,
        uint256 _id
    ) public view returns (bool) {
        return
            ((
                super.verify(
                    _whiteList.whiteListId,
                    _whiteList.index,
                    keccak256(
                        abi.encodePacked(
                            _whiteList.index,
                            msg.sender,
                            _whiteList.allowance
                        )
                    ),
                    _whiteList.merkleProof
                )
            ) &&
                !pools[_id].whiteLists[_whiteList.whiteListId].minted[
                    msg.sender
                ]) ||
            (block.timestamp >= pools[_id].config.startTime &&
                block.timestamp <= pools[_id].config.endTime);
    }

    function sellingHelper(
        uint256 _id,
        bytes32 itemKey,
        uint256 _assetIndex,
        uint256 _amount,
        bool _whiteListPrice,
        uint256 _accesListId
    ) private {
        // Process payment for the user, checking to sell for Staker points.
        if (_whiteListPrice) {
            SuperMerkleAccess.AccessList storage accessList = SuperMerkleAccess
                .accessRoots[_accesListId];
            uint256 price = accessList.price * _amount;
            if (accessList.token == address(0)) {
                require(msg.value >= price, "0x9B");
                (bool success, ) = payable(paymentReceiver).call{
                    value: msg.value
                }("");
                require(success, "0x0C");
                pools[_id].whiteLists[_accesListId].minted[msg.sender] = true;
            } else {
                require(
                    IERC20(accessList.token).balanceOf(msg.sender) >= price,
                    "0x1C"
                );
                IERC20(accessList.token).safeTransferFrom(
                    msg.sender,
                    paymentReceiver,
                    price
                );
                pools[_id].whiteLists[_accesListId].minted[msg.sender] = true;
            }
        } else {
            DFStorage.Price storage sellingPair = pools[_id].itemPrices[
                itemKey
            ][_assetIndex];
            if (sellingPair.assetType == DFStorage.AssetType.Point) {
                IStaker(sellingPair.asset).spendPoints(
                    msg.sender,
                    sellingPair.price * _amount
                );

                // Process payment for the user with a check to sell for Ether.
            } else if (sellingPair.assetType == DFStorage.AssetType.Ether) {
                uint256 etherPrice = sellingPair.price * _amount;
                require(msg.value >= etherPrice, "0x9B");
                (bool success, ) = payable(paymentReceiver).call{
                    value: msg.value
                }("");
                require(success, "0x0C");

                // Process payment for the user with a check to sell for an ERC-20 token.
            } else if (sellingPair.assetType == DFStorage.AssetType.Token) {
                uint256 tokenPrice = sellingPair.price * _amount;
                require(
                    IERC20(sellingPair.asset).balanceOf(msg.sender) >=
                        tokenPrice,
                    "0x1C"
                );
                IERC20(sellingPair.asset).safeTransferFrom(
                    msg.sender,
                    paymentReceiver,
                    tokenPrice
                );

                // Otherwise, error out because the payment type is unrecognized.
            } else {
                revert("0x0");
            }
        }
    }

    /**
     * Private function to avoid a stack-too-deep error.
     */
    function checkRequirments(uint256 _id) private view returns (bool) {
        // Verify that the user meets any requirements gating participation in this
        // pool. Verify that any possible ERC-20 requirements are met.
        uint256 amount;

        PoolRequirement memory poolRequirement = pools[_id]
            .config
            .requirement;
        if (
            poolRequirement.requiredType == AccessType.TokenRequired
        ) {
            // bytes data
            for (uint256 i = 0; i < poolRequirement.requiredAsset.length; i++) {
                amount += IERC20(poolRequirement.requiredAsset[i]).balanceOf(
                    msg.sender
                );
            }
            return amount >= poolRequirement.requiredAmount;
            // Verify that any possible Staker point threshold requirements are met.
        } else if (
            poolRequirement.requiredType == AccessType.PointRequired
        ) {
            // IStaker requiredStaker = IStaker(poolRequirement.requiredAsset[0]);
            return
                IStaker(poolRequirement.requiredAsset[0]).getAvailablePoints(
                    msg.sender
                ) >= poolRequirement.requiredAmount;
        }

        // Verify that any possible ERC-1155 ownership requirements are met.
        if (poolRequirement.requiredId.length == 0) {
            if (
                poolRequirement.requiredType == AccessType.ItemRequired
            ) {
                for (
                    uint256 i = 0;
                    i < poolRequirement.requiredAsset.length;
                    i++
                ) {
                    amount += ISuper1155(poolRequirement.requiredAsset[i])
                        .totalBalances(msg.sender);
                }
                return amount >= poolRequirement.requiredAmount;
            } else if (
                poolRequirement.requiredType == AccessType.ItemRequired721
            ) {
                for (
                    uint256 i = 0;
                    i < poolRequirement.requiredAsset.length;
                    i++
                ) {
                    amount += ISuper721(poolRequirement.requiredAsset[i])
                        .balanceOf(msg.sender);
                }
                // IERC721 requiredItem = IERC721(poolRequirement.requiredAsset[0]);
                return amount >= poolRequirement.requiredAmount;
            }
        } else {
            if (
                poolRequirement.requiredType == AccessType.ItemRequired
            ) {
                // ISuper1155 requiredItem = ISuper1155(poolRequirement.requiredAsset[0]);
                for (
                    uint256 i = 0;
                    i < poolRequirement.requiredAsset.length;
                    i++
                ) {
                    for (
                        uint256 j = 0;
                        j < poolRequirement.requiredAsset.length;
                        j++
                    ) {
                        amount += ISuper1155(poolRequirement.requiredAsset[i])
                            .balanceOf(
                                msg.sender,
                                poolRequirement.requiredId[j]
                            );
                    }
                }
                return amount >= poolRequirement.requiredAmount;
            } else if (
                poolRequirement.requiredType == AccessType.ItemRequired721
            ) {
                for (
                    uint256 i = 0;
                    i < poolRequirement.requiredAsset.length;
                    i++
                ) {
                    for (
                        uint256 j = 0;
                        j < poolRequirement.requiredAsset.length;
                        j++
                    ) {
                        amount += ISuper721(poolRequirement.requiredAsset[i])
                            .balanceOfGroup(
                                msg.sender,
                                poolRequirement.requiredId[j]
                            );
                    }
                }
                return amount >= poolRequirement.requiredAmount;
            }
        }
        return true;
    }

    /**
     * Private function to avoid a stack-too-deep error.
     */
    function mintingHelper(
        uint256 _groupId,
        uint256 _id,
        bytes32 _itemKey,
        uint256 _amount,
        uint256 _newCirculatingTotal,
        uint256 _userPoolPurchaseAmount,
        uint256 _userGlobalPurchaseAmount
    ) private {
        // If payment is successful, mint each of the user's purchased items.
        uint256[] memory itemIds = new uint256[](_amount);
        uint256[] memory amounts = new uint256[](_amount);
        // bytes32 key = keccak256(
        //     abi.encodePacked(
        //         pools[_id].config.collection,
        //         pools[_id].currentPoolVersion,
        //         _groupId
        //     )
        // );
        uint256 nextIssueNumber = nextItemIssues[_itemKey];
        {
            uint256 shiftedGroupId = _groupId << 128;

            for (uint256 i = 1; i <= _amount; i++) {
                uint256 itemId = (shiftedGroupId + nextIssueNumber) + i;
                itemIds[i - 1] = itemId;
                amounts[i - 1] = 1;
            }
        }
        // Update the tracker for available item issue numbers.
        nextItemIssues[_itemKey] = nextIssueNumber + _amount;

        // Update the count of circulating items from this pool.
        pools[_id].itemMinted[_itemKey] = _newCirculatingTotal;

        // Update the pool's count of items that a user has purchased.
        pools[_id].purchaseCounts[msg.sender] = _userPoolPurchaseAmount;

        // Update the global count of items that a user has purchased.
        globalPurchaseCounts[msg.sender] = _userGlobalPurchaseAmount;

        ISuper1155(pools[_id].config.collection).mintBatch(msg.sender, itemIds, amounts, "");

        // Mint the items.
        // items[_itemIndex].mintBatch(msg.sender, itemIds, amounts, "");

        emit ItemPurchased(msg.sender, _id, itemIds, amounts);
    }
}
