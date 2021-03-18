// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC1155/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./FeeOwner.sol";
import "./Fee1155NFTLockable.sol";
import "./Staker.sol";

/**
  @title A Shop contract for selling NFTs via direct minting through particular
         pools with specific participation requirements.
  @author Tim Clancy
*/
contract ShopLaunchpad1155 is ERC1155Holder, Ownable, ReentrancyGuard {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  /// A version number for this Shop contract's interface.
  uint256 public version = 1;

  /// @dev A mask for isolating an item's group ID.
  uint256 constant GROUP_MASK = uint256(uint128(~0)) << 128;

  /// A user-specified Fee1155 contract to support selling items from.
  Fee1155NFTLockable public item;

  /// A user-specified FeeOwner to receive a portion of Shop earnings.
  FeeOwner public feeOwner;

  /// A user-specified Staker contract to spend user points on.
  Staker[] public stakers;

  /// A limit on the number of items that a particular address may purchase.
  uint256 public purchaseLimit;

  /// The address of the orignal owner of the item contract.
  address public originalOwner;

  /// Whether ownership is locked to disable clawback.
  bool public ownershipLocked;

  /// A mapping of addresses to the number of items they've purchased.
  mapping (address => uint256) public purchaseCounts;

  /// A mapping of item group IDs to their next available issue number minus one.
  mapping (uint256 => uint256) public nextItemIssues;

  /// The next available ID to be assumed by the next pool added.
  uint256 public nextPoolId;

  /// A mapping of pool IDs to pools.
  mapping (uint256 => Pool) public pools;

  /**
    This struct is a source of mapping-free input to the `addPool` function.

    @param name A name for the pool.
    @param startBlock The first block where this pool begins allowing purchases.
    @param endBlock The final block where this pool allows purchases.
    @param requirement A PoolRequirement requisite for users who want to participate in this pool.
  */
  struct PoolInput {
    string name;
    uint256 startBlock;
    uint256 endBlock;
    PoolRequirement requirement;
  }

  /**
    This struct tracks information about a single item pool in the Shop.

    @param name A name for the pool.
    @param startBlock The first block where this pool begins allowing purchases.
    @param endBlock The final block where this pool allows purchases.
    @param itemCaps A mapping of item group IDs to the maximum number this pool is allowed to mint.
    @param itemMinted A mapping of item group IDs to the number this pool has currently minted.
    @param pricesLength A mapping of item group IDs to the number of price assets available to purchase with.
    @param itemPrices A mapping of item group IDs to a mapping of available PricePair assets available to purchase with.
    @param requirement A PoolRequirement requisite for users who want to participate in this pool.
  */
  struct Pool {
    string name;
    uint256 startBlock;
    uint256 endBlock;
    mapping (uint256 => uint256) itemCaps;
    mapping (uint256 => uint256) itemMinted;
    mapping (uint256 => uint256) pricesLength;
    mapping (uint256 => mapping (uint256 => PricePair)) itemPrices;
    PoolRequirement requirement;
  }

  /**
    This struct tracks information about a single asset with associated price
    that an item is being sold in the shop for.

    @param assetType A sentinel value for the specific type of asset being used.
                     0 = non-transferrable points from a Staker; see `asset`.
                     1 = Ether.
                     2 = an ERC-20 token, see `asset`.
    @param asset Some more specific information about the asset to charge in.
                 If the `assetType` is 0, we convert the given address to an
                 integer index for finding a specific Staker from `stakers`.
                 If the `assetType` is 1, we ignore this field.
                 If the `assetType` is 2, we use this address to find the ERC-20
                 token that we should be specifically charging with.
    @param price The amount of the specified `assetType` and `asset` to charge.
  */
  struct PricePair {
    uint256 assetType;
    address asset;
    uint256 price;
  }

  /**
    This struct tracks information about a prerequisite for a user to
    participate in a pool.

    @param requiredType
      A sentinel value for the specific type of asset being required.
        0 = a public pool.
        1 = an ERC-20 token, see `requiredAsset`.
        2 = an NFT item, see `requiredAsset`.
    @param requiredAsset
      Some more specific information about the asset to require.
        If the `requiredType` is 1, we use this address to find the ERC-20
        token that we should be specifically requiring holdings of.
        If the `requiredType` is 2, we use this address to find the item
        contract that we should be specifically requiring holdings of.
    @param requiredAmount The amount of the specified `requiredAsset` required.
  */
  struct PoolRequirement {
    uint256 requiredType;
    address requiredAsset;
    uint256 requiredAmount;
  }

  /// @dev a modifier which allows only `originalOwner` to call a function.
  modifier onlyOriginalOwner() {
    require(originalOwner == _msgSender(),
      "You are not the original owner of this contract.");
    _;
  }

  /**
    Construct a new Shop by providing it a FeeOwner.

    @param _item The address of the Fee1155NFTLockable item that will be minting sales.
    @param _feeOwner The address of the FeeOwner due a portion of Shop earnings.
    @param _stakers The addresses of any Stakers to permit spending points from.
    @param _purchaseLimit A limit on the number of items that a single address may purchase.
  */
  constructor(Fee1155NFTLockable _item, FeeOwner _feeOwner, Staker[] memory _stakers, uint256 _purchaseLimit) public {
    item = _item;
    feeOwner = _feeOwner;
    stakers = _stakers;
    purchaseLimit = _purchaseLimit;

    originalOwner = item.owner();
    ownershipLocked = false;
  }

  /**
    A function which allows the original owner of the item contract to revoke
    ownership from the launchpad.
  */
  function ownershipClawback() external onlyOriginalOwner {
    require(!ownershipLocked,
      "Ownership transfers have been locked.");
    item.transferOwnership(originalOwner);
  }

  /**
    A function which allows the original owner of this contract to lock all
    future ownership clawbacks.
  */
  function lockOwnership() external onlyOriginalOwner {
    ownershipLocked = true;
  }

  /**
    Allow the owner of the Shop to add a new pool of items to purchase.

    @param pool The PoolInput full of data defining the pool's operation.
    @param _groupIds The specific Fee1155 item group IDs to sell in this pool, keyed to `_amounts`.
    @param _amounts The maximum amount of each particular groupId that can be sold by this pool.
    @param _pricePairs The asset address to price pairings to use for selling
                       each item.
  */
  function addPool(PoolInput calldata pool, uint256[] calldata _groupIds, uint256[] calldata _amounts, PricePair[][] memory _pricePairs) external onlyOwner {
    updatePool(nextPoolId, pool, _groupIds, _amounts, _pricePairs);

    // Increment the ID which will be used by the next pool added.
    nextPoolId = nextPoolId.add(1);
  }

  /**
    Allow the owner of the Shop to update an existing pool of items.

    @param poolId The ID of the pool to update.
    @param pool The PoolInput full of data defining the pool's operation.
    @param _groupIds The specific Fee1155 item group IDs to sell in this pool, keyed to `_amounts`.
    @param _amounts The maximum amount of each particular groupId that can be sold by this pool.
    @param _pricePairs The asset address to price pairings to use for selling
                       each item.
  */
  function updatePool(uint256 poolId, PoolInput calldata pool, uint256[] calldata _groupIds, uint256[] calldata _amounts, PricePair[][] memory _pricePairs) public onlyOwner {
    require(poolId <= nextPoolId,
      "You cannot update a non-existent pool.");
    require(pool.endBlock >= pool.startBlock,
      "You cannot create a pool which ends before it starts.");
    require(_groupIds.length > 0,
      "You must list at least one item group.");
    require(_groupIds.length == _amounts.length,
      "Item groups length cannot be mismatched with mintable amounts length.");

    // Immediately store some given information about this pool.
    pools[poolId] = Pool({
      name: pool.name,
      startBlock: pool.startBlock,
      endBlock: pool.endBlock,
      requirement: pool.requirement
    });

    // Store the amount of each item group that this pool may mint.
    for (uint256 i = 0; i < _groupIds.length; i++) {
      require(_amounts[i] > 0,
        "You cannot add an item with no mintable amount.");
      pools[poolId].itemCaps[ _groupIds[i]] = _amounts[i];

      // Store future purchase information for the item group.
      for (uint256 j = 0; j < _pricePairs.length; j++) {
        pools[poolId].itemPrices[ _groupIds[i]][j] = _pricePairs[i][j];
      }
      pools[poolId].pricesLength[ _groupIds[i]] = _pricePairs[i].length;
    }
  }

  /**
    Allow a user to purchase an item from a pool.

    @param poolId The ID of the particular pool that the user would like to purchase from.
    @param groupId The item group ID that the user would like to purchase.
    @param assetId The type of payment asset that the user would like to purchase with.
    @param amount The amount of item that the user would like to purchase.
  */
  function mintFromPool(uint256 poolId, uint256 groupId, uint256 assetId, uint256 amount) external nonReentrant payable {
    require(amount > 0,
      "You must purchase at least one item.");
    require(poolId < nextPoolId,
      "You can only purchase items from an active pool.");
    require(assetId < pools[poolId].pricesLength[groupId],
      "Your specified asset ID is not valid.");

    // Verify that the pool is still running its sale.
    require(block.number >= pools[poolId].startBlock && block.number <= pools[poolId].endBlock,
      "This pool is not currently running its sale.");

    // Verify that the pool is respecting address purchase limits.
    uint256 userPurchaseAmount = amount.add(purchaseCounts[msg.sender]);
    require(userPurchaseAmount <= purchaseLimit,
      "You may not purchase any more items from this sale.");

    // Verify that the pool is not depleted by the user's purchase.
    uint256 newCirculatingTotal = pools[poolId].itemMinted[groupId].add(amount);
    require(newCirculatingTotal <= pools[poolId].itemCaps[groupId],
      "There are not enough items available for you to purchase.");

    // Verify that the user meets any requirements gating participation in this pool.
    PoolRequirement memory poolRequirement = pools[poolId].requirement;
    if (poolRequirement.requiredType == 1) {
      IERC20 requiredToken = IERC20(poolRequirement.requiredAsset);
      require(requiredToken.balanceOf(msg.sender) >= poolRequirement.requiredAmount,
        "You do not have enough required token to participate in this pool.");
    }

    // TODO: supporting item gate requirement requires upgrading the Fee1155 contract.
    // else if (poolRequirement.requiredType == 2) {
    //   Fee1155 requiredItem = Fee1155(poolRequirement.requiredAsset);
    //   require(requiredItem.balanceOf(msg.sender) >= poolRequirement.requiredAmount,
    //     "You do not have enough required item to participate in this pool.");
    // }

    // Process payment for the user.
    // If the sentinel value for the point asset type is found, sell for points.
    // This involves converting the asset from an address to a Staker index.
    PricePair memory sellingPair = pools[poolId].itemPrices[groupId][assetId];
    if (sellingPair.assetType == 0) {
      uint256 stakerIndex = uint256(sellingPair.asset);
      stakers[stakerIndex].spendPoints(msg.sender, sellingPair.price.mul(amount));

    // If the sentinel value for the Ether asset type is found, sell for Ether.
    } else if (sellingPair.assetType == 1) {
      uint256 etherPrice = sellingPair.price.mul(amount);
      require(msg.value >= etherPrice,
        "You did not send enough Ether to complete this purchase.");
      (bool success, ) = payable(owner()).call{ value: msg.value }("");
      require(success, "Shop owner transfer failed.");

    // Otherwise, attempt to sell for an ERC20 token.
    } else {
      IERC20 sellingAsset = IERC20(sellingPair.asset);
      uint256 tokenPrice = sellingPair.price.mul(amount);
      require(sellingAsset.balanceOf(msg.sender) >= tokenPrice,
        "You do not have enough token to complete this purchase.");
      sellingAsset.safeTransferFrom(msg.sender, owner(), tokenPrice);
    }

    // If payment is successful, mint each of the user's purchased items.
    uint256 shiftedGroupId = groupId << 128;
    uint256 nextIssueNumber = nextItemIssues[groupId];
    uint256[] memory itemIds = new uint256[](amount);
    uint256[] memory amounts = new uint256[](amount);
    for (uint256 i = 1; i <= amount; i++) {
      uint256 itemId = shiftedGroupId.add(nextIssueNumber).add(i);
      itemIds[i - 1] = itemId;
      amounts[i - 1] = 1;
    }

    // Mint the items.
    item.createNFT(msg.sender, itemIds, amounts, "");

    // Update the tracker for available item issue numbers.
    nextItemIssues[groupId] = nextIssueNumber.add(amount);

    // Update the count of circulating items from this pool.
    pools[poolId].itemMinted[groupId] = newCirculatingTotal;

    // Update the count of items that a user has purchased.
    purchaseCounts[msg.sender] = userPurchaseAmount;
  }
}
