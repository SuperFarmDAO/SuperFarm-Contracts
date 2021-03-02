## `FarmItemRecords`






### `constructor(address _proxyRegistryAddress)` (public)

Construct a new item registry with a specific OpenSea proxy address.

    @param _proxyRegistryAddress An OpenSea proxy registry address.



### `createItem(string _uri, uint256 _royaltyFee, uint256[] _initialSupply, uint256[] _maximumSupply, address[] _recipients, bytes _data) → contract Fee1155` (external)

Create a Fee1155 on behalf of the owner calling this function. The Fee1155
    immediately mints a single-item collection.

    @param _uri The item group's metadata URI.
    @param _royaltyFee The creator's fee to apply to the created item.
    @param _initialSupply An array of per-item initial supplies which should be
                          minted immediately.
    @param _maximumSupply An array of per-item maximum supplies.
    @param _recipients An array of addresses which will receive the initial
                       supply minted for each corresponding item.
    @param _data Any associated data to use if items are minted this transaction.



### `addItem(address _itemAddress)` (external)

Allow a user to add an existing Item contract to the registry.

    @param _itemAddress The address of the Item contract to add for this user.



### `getItemCount(address _user) → uint256` (external)

Get the number of entries in the Item records mapping for the given user.

    @return The number of Items added for a given address.




### `ItemCreated(address itemAddress, address creator)`

An event for tracking the creation of a new Item.



