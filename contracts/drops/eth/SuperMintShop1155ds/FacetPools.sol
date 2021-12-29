// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../../libraries/merkle/SuperMerkleAccessds.sol";
import "../../../assets/erc721/interfaces/ISuper721.sol";
import "../../../interfaces/IStaker.sol";

import "./BlueprintSuperMintShop1155.sol";

/** 
  @title Diamond facet for Super1155's Transfer and Approval functions.
  @author Tim Clancy
  @author Qazawat Zirak
  @author Rostislav Khlebnikov
  @author Nikita Elunin
  This contract is a logic contract for delegate calls from the ProxyStorage.
  The contract defines the logic of Transfer/Approval of Super1155 assets and
  the storage of ProxyStorage is updated based on KECCAK256 memory locations.

  For the purpose of standardization, a facet should be less than 15KiloBytes.

  22 Dec, 2021.
*/
contract FacetPools is SuperMerkleAccessds {
  using SafeERC20 for IERC20;

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
    An event to track a specific whitelist being updated. When emitted this
    event indicates that a specific whitelist has had its settings completely
    replaced.

    @param updater The calling address which updated this whitelist.
    @param whitelistId The ID of the whitelist being updated.
    @param timestamp Timestamp of whiteList update.
  */
  event WhitelistUpdated(address indexed updater, uint256 whitelistId,
    uint256 timestamp);

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
    BlueprintSuperMintShop1155.PoolInput indexed pool, uint256[] groupIds, uint256[] caps,
    BlueprintSuperMintShop1155.Price[][] indexed prices);

   /**
    Allow the shop owner or an approved manager to update the payment receiver
    address if it has not been locked.

    @param _newPaymentReceiver The address of the new payment receiver.
  */
  function updatePaymentReceiver(address _newPaymentReceiver) external
    hasValidPermit(UNIVERSAL, BlueprintSuperMintShop1155.SET_PAYMENT_RECEIVER) {

    BlueprintSuperMintShop1155.SuperMintShop1155StateVariables storage b = BlueprintSuperMintShop1155.superMintShop1155StateVariables();

    require(!b.paymentReceiverLocked, "XXX"
      );
    emit PaymentReceiverUpdated(_msgSender(), b.paymentReceiver,
      _newPaymentReceiver);
    // address oldPaymentReceiver = paymentReceiver;
    b.paymentReceiver = _newPaymentReceiver;
   
  }


   /**
    Allow the shop owner or an approved manager to set the array of items known to this shop.
    @param _items The array of Super1155 addresses.
  */
  function setItems(ISuper1155[] calldata _items) external hasValidPermit(UNIVERSAL, BlueprintSuperMintShop1155.SET_ITEMS) {

    BlueprintSuperMintShop1155.SuperMintShop1155StateVariables storage b = BlueprintSuperMintShop1155.superMintShop1155StateVariables();

    b.items = _items;
  }

  /**
    Allow the shop owner or an approved manager to lock the payment receiver
    address against any future changes.
  */
  function lockPaymentReceiver() external
    hasValidPermit(UNIVERSAL, BlueprintSuperMintShop1155.LOCK_PAYMENT_RECEIVER) {

    BlueprintSuperMintShop1155.SuperMintShop1155StateVariables storage b = BlueprintSuperMintShop1155.superMintShop1155StateVariables();

    b.paymentReceiverLocked = true;
    emit PaymentReceiverLocked(_msgSender());
  }

  /**
    Allow the shop owner or an approved manager to update the global purchase
    limit if it has not been locked.

    @param _newGlobalPurchaseLimit The value of the new global purchase limit.
  */
  function updateGlobalPurchaseLimit(uint256 _newGlobalPurchaseLimit) external
    hasValidPermit(UNIVERSAL, BlueprintSuperMintShop1155.UPDATE_GLOBAL_LIMIT) {

    BlueprintSuperMintShop1155.SuperMintShop1155StateVariables storage b = BlueprintSuperMintShop1155.superMintShop1155StateVariables();

    require(!b.globalPurchaseLimitLocked,
      "0x0A");
    emit GlobalPurchaseLimitUpdated(_msgSender(), b.globalPurchaseLimit,
      _newGlobalPurchaseLimit);
    b.globalPurchaseLimit = _newGlobalPurchaseLimit;

  }

  /**
    Allow the shop owner or an approved manager to lock the global purchase
    limit against any future changes.
  */
  function lockGlobalPurchaseLimit() external
    hasValidPermit(UNIVERSAL, BlueprintSuperMintShop1155.LOCK_GLOBAL_LIMIT) {

    BlueprintSuperMintShop1155.SuperMintShop1155StateVariables storage b = BlueprintSuperMintShop1155.superMintShop1155StateVariables();

    b.globalPurchaseLimitLocked = true;
    emit GlobalPurchaseLimitLocked(_msgSender());
  }

  /**
    Adds new whiteList restriction for the pool by `_poolId`.
    @param _poolId id of the pool, where new white list is added.
    @param whitelist struct for creating a new whitelist.
   */
  function addWhiteList(uint256 _poolId, BlueprintSuperMintShop1155.WhiteListCreate[] calldata whitelist) external hasValidPermit(UNIVERSAL, BlueprintSuperMintShop1155.WHITELIST) {

    BlueprintSuperMintShop1155.SuperMintShop1155StateVariables storage b = BlueprintSuperMintShop1155.superMintShop1155StateVariables();

    for (uint256 i = 0; i < whitelist.length; i++) {
      super.setAccessRound(whitelist[i]._accesslistId, whitelist[i]._merkleRoot, whitelist[i]._startTime, whitelist[i]._endTime, whitelist[i]._price, whitelist[i]._token);
      b.pools[_poolId].whiteLists.push();
      uint256 newIndex = b.pools[_poolId].whiteLists.length - 1;
      b.pools[_poolId].whiteLists[newIndex].id = whitelist[i]._accesslistId;
      emit WhitelistUpdated(_msgSender(), whitelist[i]._accesslistId, block.timestamp);
    }
  }


  /**
    A function which allows the caller to retrieve information about specific
    pools, the items for sale within, and the collection this shop uses.

    @param _ids An array of pool IDs to retrieve information about.
  */
  function getPools(uint256[] calldata _ids, uint256 _itemIndex) external view
    returns (BlueprintSuperMintShop1155.PoolOutput[] memory) {

            BlueprintSuperMintShop1155.SuperMintShop1155StateVariables storage b = BlueprintSuperMintShop1155.superMintShop1155StateVariables();

    BlueprintSuperMintShop1155.PoolOutput[] memory poolOutputs = new BlueprintSuperMintShop1155.PoolOutput[](_ids.length);
    for (uint256 i = 0; i < _ids.length; i++) {
      uint256 id = _ids[i];

      // Process output for each pool.
      BlueprintSuperMintShop1155.PoolItem[] memory poolItems = new BlueprintSuperMintShop1155.PoolItem[](b.pools[id].itemGroups.length);
      for (uint256 j = 0; j < b.pools[id].itemGroups.length; j++) {
        uint256 itemGroupId = b.pools[id].itemGroups[j];
        bytes32 itemKey = keccak256(abi.encodePacked(b.pools[id].config.collection,
          b.pools[id].currentPoolVersion, itemGroupId));

        // Parse each price the item is sold at.
        BlueprintSuperMintShop1155.Price[] memory itemPrices =
          new BlueprintSuperMintShop1155.Price[](b.pools[id].itemPricesLength[itemKey]);
        for (uint256 k = 0; k < b.pools[id].itemPricesLength[itemKey]; k++) {
          itemPrices[k] = b.pools[id].itemPrices[itemKey][k];
        }

        // Track the item.
        poolItems[j] = BlueprintSuperMintShop1155.PoolItem({
          groupId: itemGroupId,
          cap: b.pools[id].itemCaps[itemKey],
          minted: b.pools[id].itemMinted[itemKey],
          prices: itemPrices
        });
      }

      // Track the pool.
      poolOutputs[i] = BlueprintSuperMintShop1155.PoolOutput({
        config: b.pools[id].config,
        itemMetadataUri: b.items[_itemIndex].metadataUri(),
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
  function getPurchaseCounts(address[] calldata _purchasers, 
  uint256[] calldata _ids) external view returns (uint256[][] memory) {

    BlueprintSuperMintShop1155.SuperMintShop1155StateVariables storage b = BlueprintSuperMintShop1155.superMintShop1155StateVariables();

    uint256[][] memory purchaseCounts = new uint256[][](_purchasers.length);
    for (uint256 i = 0; i < _purchasers.length; i++) {
      purchaseCounts[i] = new uint256[](_ids.length);
      for (uint256 j = 0; j < _ids.length; j++) {
        uint256 id = _ids[j];
        address purchaser = _purchasers[i];
        purchaseCounts[i][j] = b.pools[id].purchaseCounts[purchaser];
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
  function addPool(BlueprintSuperMintShop1155.PoolInput calldata _pool, uint256[] calldata _groupIds,
    uint256[] calldata _issueNumberOffsets, uint256[] calldata _caps,
    BlueprintSuperMintShop1155.Price[][] calldata _prices) external hasValidPermit(UNIVERSAL, BlueprintSuperMintShop1155.POOL) {

            BlueprintSuperMintShop1155.SuperMintShop1155StateVariables storage b = BlueprintSuperMintShop1155.superMintShop1155StateVariables();

    updatePool(b.nextPoolId, _pool, _groupIds, _issueNumberOffsets, _caps,
      _prices);

    // Increment the ID which will be used by the next pool added.
    b.nextPoolId += 1;
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
  function updatePool(uint256 _id, BlueprintSuperMintShop1155.PoolInput calldata _config,
    uint256[] calldata _groupIds, uint256[] calldata _issueNumberOffsets,
    uint256[] calldata _caps, BlueprintSuperMintShop1155.Price[][] memory _prices) public
    hasValidPermit(UNIVERSAL, BlueprintSuperMintShop1155.POOL) {

    BlueprintSuperMintShop1155.SuperMintShop1155StateVariables storage b = BlueprintSuperMintShop1155.superMintShop1155StateVariables();

    require(_id <= b.nextPoolId && _config.endTime >= _config.startTime && _groupIds.length > 0,
      "0x1A");
    require(_groupIds.length == _caps.length && _caps.length == _prices.length && _issueNumberOffsets.length == _prices.length,
      "0x4A");

    // Immediately store some given information about this pool.
    // BlueprintSuperMintShop1155.Pool storage pool = b.pools[_id];
    b.pools[_id].config = _config;
    b.pools[_id].itemGroups = _groupIds;
    b.pools[_id].currentPoolVersion = b.pools[_id].currentPoolVersion + 1;

    // Delegate work to a helper function to avoid stack-too-deep errors.
    _updatePoolHelper(_id, _groupIds, _issueNumberOffsets, _caps, _prices);

    // Emit an event indicating that a pool has been updated.
    emit PoolUpdated(_msgSender(), _id, _config, _groupIds, _caps, _prices);
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
    uint256[] calldata _caps, BlueprintSuperMintShop1155.Price[][] memory _prices) private {

    BlueprintSuperMintShop1155.SuperMintShop1155StateVariables storage b = BlueprintSuperMintShop1155.superMintShop1155StateVariables();

    for (uint256 i = 0; i < _groupIds.length; i++) {
      require(_caps[i] > 0,
        "0x5A");
      bytes32 itemKey = keccak256(abi.encodePacked(b.pools[_id].config.collection, b.pools[_id].currentPoolVersion, _groupIds[i]));
      b.pools[_id].itemCaps[itemKey] = _caps[i];
      
      // Pre-seed the next item issue IDs given the pool offsets.
      // We generate a key from collection address and groupId.
      bytes32 key = keccak256(abi.encodePacked(b.pools[_id].config.collection, _groupIds[i]));
      b.nextItemIssues[key] = _issueNumberOffsets[i];

      // Store future purchase information for the item group.
      for (uint256 j = 0; j < _prices[i].length; j++) {
        b.pools[_id].itemPrices[itemKey][j] = _prices[i][j];
      }
      b.pools[_id].itemPricesLength[itemKey] = _prices[i].length;
    }
  }

  function updatePoolConfig(uint256 _id, BlueprintSuperMintShop1155.PoolInput calldata _config) external hasValidPermit(UNIVERSAL, BlueprintSuperMintShop1155.POOL){

          BlueprintSuperMintShop1155.SuperMintShop1155StateVariables storage b = BlueprintSuperMintShop1155.superMintShop1155StateVariables();

    require(_id <= b.nextPoolId && _config.endTime >= _config.startTime,
      "0x1A");
    b.pools[_id].config = _config;
  }

    function isEligible(BlueprintSuperMintShop1155.WhiteListInput calldata _whiteList, uint256 _id) public view returns (bool) {

            BlueprintSuperMintShop1155.SuperMintShop1155StateVariables storage b = BlueprintSuperMintShop1155.superMintShop1155StateVariables();

    return  (super.verify(_whiteList.whiteListId, _whiteList.index, keccak256(abi.encodePacked(_whiteList.index, _msgSender(), _whiteList.allowance)), _whiteList.merkleProof)) && 
                    !b.pools[_id].whiteLists[_whiteList.whiteListId].minted[_msgSender()] || 
                    (block.timestamp >= b.pools[_id].config.startTime && block.timestamp <= b.pools[_id].config.endTime);
  }
}