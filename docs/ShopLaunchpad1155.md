## `ShopLaunchpad1155`





### `onlyOriginalOwner()`



a modifier which allows only `originalOwner` to call a function.


### `constructor(contract Fee1155NFTLockable _item, contract FeeOwner _feeOwner, contract Staker[] _stakers, uint256 _purchaseLimit)` (public)

Construct a new Shop by providing it a FeeOwner.

    @param _item The address of the Fee1155NFTLockable item that will be minting sales.
    @param _feeOwner The address of the FeeOwner due a portion of Shop earnings.
    @param _stakers The addresses of any Stakers to permit spending points from.
    @param _purchaseLimit A limit on the number of items that a single address may purchase.



### `ownershipClawback()` (external)

A function which allows the original owner of the item contract to revoke
    ownership from the launchpad.



### `lockOwnership()` (external)

A function which allows the original owner of this contract to lock all
    future ownership clawbacks.



### `addPool(struct ShopLaunchpad1155.PoolInput pool, uint256[] _groupIds, uint256[] _amounts, struct ShopLaunchpad1155.PricePair[][] _pricePairs)` (external)

Allow the owner of the Shop to add a new pool of items to purchase.

    @param pool The PoolInput full of data defining the pool's operation.
    @param _groupIds The specific Fee1155 item group IDs to sell in this pool, keyed to `_amounts`.
    @param _amounts The maximum amount of each particular groupId that can be sold by this pool.
    @param _pricePairs The asset address to price pairings to use for selling
                       each item.



### `updatePool(uint256 poolId, struct ShopLaunchpad1155.PoolInput pool, uint256[] _groupIds, uint256[] _amounts, struct ShopLaunchpad1155.PricePair[][] _pricePairs)` (public)

Allow the owner of the Shop to update an existing pool of items.

    @param poolId The ID of the pool to update.
    @param pool The PoolInput full of data defining the pool's operation.
    @param _groupIds The specific Fee1155 item group IDs to sell in this pool, keyed to `_amounts`.
    @param _amounts The maximum amount of each particular groupId that can be sold by this pool.
    @param _pricePairs The asset address to price pairings to use for selling
                       each item.



### `mintFromPool(uint256 poolId, uint256 groupId, uint256 assetId, uint256 amount)` (external)

Allow a user to purchase an item from a pool.

    @param poolId The ID of the particular pool that the user would like to purchase from.
    @param groupId The item group ID that the user would like to purchase.
    @param assetId The type of payment asset that the user would like to purchase with.
    @param amount The amount of item that the user would like to purchase.




