## `FarmShopRecords`






### `constructor(contract FeeOwner _feeOwner)` (public)

Construct a new registry of SuperFarm records with a specified platform fee owner.

    @param _feeOwner The address of the FeeOwner due a portion of all Shop earnings.



### `changePlatformFeeOwner(contract FeeOwner _feeOwner)` (external)

Allows the registry owner to update the platform FeeOwner to use upon Shop creation.

    @param _feeOwner The address of the FeeOwner to make the new platform fee owner.



### `createShop(string _name, contract Staker[] _stakers) → contract Shop1155` (external)

Create a Shop1155 on behalf of the owner calling this function. The Shop
    supports immediately registering attached Stakers if provided.

    @param _name The name of the Shop to create.
    @param _stakers An array of Stakers to attach to the new Shop.



### `getShopCount(address _user) → uint256` (external)

Get the number of entries in the Shop records mapping for the given user.

    @return The number of Shops added for a given address.




### `ShopCreated(address shopAddress, address creator)`

An event for tracking the creation of a new Shop.



