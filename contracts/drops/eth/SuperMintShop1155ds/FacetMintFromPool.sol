// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../../libraries/merkle/SuperMerkleAccessds.sol";
import "../../../assets/erc721/interfaces/ISuper721.sol";
import "../../../interfaces/IStaker.sol";

import "./BlueprintSuperMintShop1155.sol";

import "hardhat/console.sol";

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
contract FacetMintFromPool is SuperMerkleAccessds, ReentrancyGuard {
  using SafeERC20 for IERC20;

  /**
    An event to track the purchase of items from an item pool.

    @param buyer The address that bought the item from an item pool.
    @param poolId The ID of the item pool that the buyer bought from.
    @param itemIds The array of item IDs that were purchased by the user.
    @param amounts The keyed array of each amount of item purchased by `buyer`.
  */
  event ItemPurchased(address indexed buyer, uint256 poolId,
  uint256[] indexed itemIds, uint256[] amounts);

  function initialize() public initializer {
    __Ownable_init_unchained();
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
    uint256 _amount, uint256 _itemIndex, BlueprintSuperMintShop1155.WhiteListInput calldata _whiteList) external nonReentrant payable {
    require(_amount > 0,
      "0x0B");

    BlueprintSuperMintShop1155.SuperMintShop1155StateVariables storage b = BlueprintSuperMintShop1155.superMintShop1155StateVariables();

    require(_id < b.nextPoolId && b.pools[_id].config.singlePurchaseLimit >= _amount,
      "0x1B");

    bool whiteListed;
    if (b.pools[_id].whiteLists.length != 0)
    {
        bytes32 root = keccak256(abi.encodePacked(_whiteList.index, _msgSender(), _whiteList.allowance));
        whiteListed = super.verify(_whiteList.whiteListId, _whiteList.index, root, _whiteList.merkleProof) &&
                                root == _whiteList.node &&
                                !b.pools[_id].whiteLists[_whiteList.whiteListId].minted[_msgSender()];
    }

    require(block.timestamp >= b.pools[_id].config.startTime && block.timestamp <= b.pools[_id].config.endTime || whiteListed, "0x4B");

    bytes32 itemKey = keccak256(abi.encodePacked(b.pools[_id].config.collection, 
       b.pools[_id].currentPoolVersion, _groupId));
    require(_assetIndex < b.pools[_id].itemPricesLength[itemKey],
      "0x3B");

    // Verify that the pool is running its sale.
    

    // Verify that the pool is respecting per-address global purchase limits.
    uint256 userGlobalPurchaseAmount =
        _amount + b.globalPurchaseCounts[_msgSender()];
    

    if (b.globalPurchaseLimit != 0) {
      require(userGlobalPurchaseAmount <= b.globalPurchaseLimit,
        "0x5B");

      // Verify that the pool is respecting per-address pool purchase limits. 
    }
    uint256 userPoolPurchaseAmount =
        _amount + b.pools[_id].purchaseCounts[_msgSender()];

    // Verify that the pool is not depleted by the user's purchase.
    uint256 newCirculatingTotal = b.pools[_id].itemMinted[itemKey] + _amount;
    require(newCirculatingTotal <= b.pools[_id].itemCaps[itemKey],
      "0x7B");

    {
       uint256 result;
       for (uint256 i = 0; i < b.nextPoolId; i++) {
        for (uint256 j = 0; j < b.pools[i].itemGroups.length; j++) {
        result += b.pools[i].itemMinted[itemKey];
      }
    }
    require(b.maxAllocation >= result + _amount, "0x0D");

    }

    require(checkRequirments(_id), "0x8B");

    sellingHelper(_id, itemKey, _assetIndex, _amount, whiteListed, _whiteList.whiteListId);

    
    mintingHelper(_itemIndex, _groupId, _id, itemKey, _amount, newCirculatingTotal, userPoolPurchaseAmount, userGlobalPurchaseAmount);

    // Emit an event indicating a successful purchase.
  }

    function sellingHelper(uint256 _id, bytes32 itemKey, uint256 _assetIndex, uint256 _amount, bool _whiteListPrice, uint256 _accesListId) private {

    BlueprintSuperMintShop1155.SuperMintShop1155StateVariables storage b = BlueprintSuperMintShop1155.superMintShop1155StateVariables();

    // Process payment for the user, checking to sell for Staker points.
    if (_whiteListPrice) {
      SuperMerkleAccessds.AccessList storage accessList = SuperMerkleAccessds.accessRoots[_accesListId];
      uint256 price = accessList.price * _amount;
      if (accessList.token == address(0)) {
        require(msg.value >= price,
          "0x9B");
        (bool success, ) = payable(b.paymentReceiver).call{ value: msg.value }("");
        require(success,
          "0x0C");
        b.pools[_id].whiteLists[_accesListId].minted[_msgSender()] = true;
      } else {
        require(IERC20(accessList.token).balanceOf(_msgSender()) >= price,
          "0x1C");
        IERC20(accessList.token).safeTransferFrom(_msgSender(), b.paymentReceiver, price);
        b.pools[_id].whiteLists[_accesListId].minted[_msgSender()] = true;
      }
    } else {
      BlueprintSuperMintShop1155.Price storage sellingPair = b.pools[_id].itemPrices[itemKey][_assetIndex];
      if (sellingPair.assetType == BlueprintSuperMintShop1155.AssetType.Point) {
        IStaker(sellingPair.asset).spendPoints(_msgSender(),
          sellingPair.price * _amount);

      // Process payment for the user with a check to sell for Ether.
      } else if (sellingPair.assetType == BlueprintSuperMintShop1155.AssetType.Ether) {
        uint256 etherPrice = sellingPair.price * _amount;
        require(msg.value >= etherPrice,
          "0x9B");
        (bool success, ) = payable(b.paymentReceiver).call{ value: msg.value }("");
        require(success,
          "0x0C");

      // Process payment for the user with a check to sell for an ERC-20 token.
      } else if (sellingPair.assetType == BlueprintSuperMintShop1155.AssetType.Token) {
        uint256 tokenPrice = sellingPair.price * _amount;
        require(IERC20(sellingPair.asset).balanceOf(_msgSender()) >= tokenPrice,
          "0x1C");
        IERC20(sellingPair.asset).safeTransferFrom(_msgSender(), b.paymentReceiver, tokenPrice);

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

    BlueprintSuperMintShop1155.SuperMintShop1155StateVariables storage b = BlueprintSuperMintShop1155.superMintShop1155StateVariables();

    // Verify that the user meets any requirements gating participation in this
    // pool. Verify that any possible ERC-20 requirements are met.
    uint256 amount;
    
    BlueprintSuperMintShop1155.PoolRequirement memory poolRequirement = b.pools[_id].config.requirement;
    if (poolRequirement.requiredType == BlueprintSuperMintShop1155.AccessType.TokenRequired) {
      // bytes data 
      for (uint256 i = 0; i < poolRequirement.requiredAsset.length; i++) {
        amount += IERC20(poolRequirement.requiredAsset[i]).balanceOf(_msgSender());
      }
      return amount >= poolRequirement.requiredAmount;
      // Verify that any possible Staker point threshold requirements are met.
    } else if (poolRequirement.requiredType == BlueprintSuperMintShop1155.AccessType.PointRequired) {
        // IStaker requiredStaker = IStaker(poolRequirement.requiredAsset[0]);
       return IStaker(poolRequirement.requiredAsset[0]).getAvailablePoints(_msgSender())
          >= poolRequirement.requiredAmount;
    }

    // Verify that any possible ERC-1155 ownership requirements are met.
    if (poolRequirement.requiredId.length == 0) {
      if (poolRequirement.requiredType == BlueprintSuperMintShop1155.AccessType.ItemRequired) {
        for (uint256 i = 0; i < poolRequirement.requiredAsset.length; i++) {
            amount += ISuper1155(poolRequirement.requiredAsset[i]).totalBalances(_msgSender());
        }
        return amount >= poolRequirement.requiredAmount;
      }    
      else if (poolRequirement.requiredType == BlueprintSuperMintShop1155.AccessType.ItemRequired721) {
        for (uint256 i = 0; i < poolRequirement.requiredAsset.length; i++) {
            amount += ISuper721(poolRequirement.requiredAsset[i]).balanceOf(_msgSender());
        }
        // IERC721 requiredItem = IERC721(poolRequirement.requiredAsset[0]);
        return amount >= poolRequirement.requiredAmount;
      } 
    } else {
      if (poolRequirement.requiredType == BlueprintSuperMintShop1155.AccessType.ItemRequired) {
        // ISuper1155 requiredItem = ISuper1155(poolRequirement.requiredAsset[0]);
        for (uint256 i = 0; i < poolRequirement.requiredAsset.length; i++) {
          for (uint256 j = 0; j < poolRequirement.requiredAsset.length; j++) {
            amount += ISuper1155(poolRequirement.requiredAsset[i]).balanceOf(_msgSender(), poolRequirement.requiredId[j]);
          }
        }
        return amount >= poolRequirement.requiredAmount;
      }    
      else if (poolRequirement.requiredType == BlueprintSuperMintShop1155.AccessType.ItemRequired721) {
        for (uint256 i = 0; i < poolRequirement.requiredAsset.length; i++) {
            for (uint256 j = 0; j < poolRequirement.requiredAsset.length; j++) {
              amount += ISuper721(poolRequirement.requiredAsset[i]).balanceOfGroup(_msgSender(), poolRequirement.requiredId[j]);
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
  function mintingHelper(uint256 _itemIndex, uint256 _groupId, uint256 _id, bytes32 _itemKey, uint256 _amount, uint256 _newCirculatingTotal, uint256 _userPoolPurchaseAmount, uint256 _userGlobalPurchaseAmount) private {

    BlueprintSuperMintShop1155.SuperMintShop1155StateVariables storage b = BlueprintSuperMintShop1155.superMintShop1155StateVariables();

    // If payment is successful, mint each of the user's purchased items.
    uint256[] memory itemIds = new uint256[](_amount);
    uint256[] memory amounts = new uint256[](_amount);
    bytes32 key = keccak256(abi.encodePacked(b.pools[_id].config.collection, 
       b.pools[_id].currentPoolVersion, _groupId));
    uint256 nextIssueNumber = b.nextItemIssues[key];
    {
      uint256 shiftedGroupId = _groupId << 128;

      for (uint256 i = 1; i <= _amount; i++) {
        uint256 itemId = (shiftedGroupId + nextIssueNumber) + i;
        itemIds[i - 1] = itemId;
        amounts[i - 1] = 1;
      }
    }
     // Update the tracker for available item issue numbers.
    b.nextItemIssues[key] = nextIssueNumber + _amount;

    // Update the count of circulating items from this pool.
    b.pools[_id].itemMinted[_itemKey] = _newCirculatingTotal;

    // Update the pool's count of items that a user has purchased.
    b.pools[_id].purchaseCounts[_msgSender()] = _userPoolPurchaseAmount;

    // Update the global count of items that a user has purchased.
    b.globalPurchaseCounts[_msgSender()] = _userGlobalPurchaseAmount;

    // Mint the items.
    b.items[_itemIndex].mintBatch(_msgSender(), itemIds, amounts, "");

    emit ItemPurchased(_msgSender(), _id, itemIds, amounts);
  } 
}