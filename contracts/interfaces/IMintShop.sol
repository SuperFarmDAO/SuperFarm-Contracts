// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

interface IMintShop { 
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
}