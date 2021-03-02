## `ShopEtherMinter1155`






### `constructor(contract Fee1155 _item, contract FeeOwner _feeOwner)` (public)

Construct a new Shop by providing it a FeeOwner.

    @param _item The address of the Fee1155 item that will be minting sales.
    @param _feeOwner The address of the FeeOwner due a portion of Shop earnings.



### `getInventoryCount() → uint256` (external)

Returns the length of the inventory array.

    @return the length of the inventory array.



### `listItems(uint256[] _groupIds, uint256[] _prices)` (external)

Allows the Shop owner to list a new set of NFT items for sale.

    @param _groupIds The item group IDs to list for sale in this shop.
    @param _prices The corresponding purchase price to mint an item of each group.



### `removeItems(uint256[] _groupIds)` (external)

Allows the Shop owner to remove items from sale.

    @param _groupIds The group IDs currently listed in the shop to take off sale.



### `purchaseItems(uint256[] _itemIds)` (public)

Allows any user to purchase items from this Shop. Users supply specfic item
    IDs within the groups listed for sale and supply the corresponding amount of
    Ether to cover the purchase prices.

    @param _itemIds The specific item IDs to purchase from this shop.




