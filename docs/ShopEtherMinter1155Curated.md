## `ShopEtherMinter1155Curated`






### `constructor(contract Fee1155 _item, contract FeeOwner _feeOwner)` (public)

Construct a new Shop by providing it a FeeOwner.

    @param _item The address of the Fee1155 item that will be minting sales.
    @param _feeOwner The address of the FeeOwner due a portion of Shop earnings.



### `getInventoryCount() → uint256` (external)

Returns the length of the inventory array.

    @return the length of the inventory array.



### `getBidderCount(uint256 groupId) → uint256` (external)

Returns the length of the bidder array on an item group.

    @return the length of the bidder array on an item group.



### `listItems(uint256[] _groupIds, uint256[] _prices)` (external)

Allows the Shop owner to list a new set of NFT items for sale.

    @param _groupIds The item group IDs to list for sale in this shop.
    @param _prices The corresponding purchase price to mint an item of each group.



### `removeItems(uint256[] _groupIds)` (external)

Allows the Shop owner to remove items from sale.

    @param _groupIds The group IDs currently listed in the shop to take off sale.



### `makeOffers(uint256[] _itemGroupIds)` (public)

Allows any user to place an offer to purchase an item group from this Shop.
    For this shop, users place an offer automatically at the price set by the
    Shop owner. This function takes a user's Ether into escrow for the offer.

    @param _itemGroupIds An array of (unique) item groups for a user to place an offer for.



### `cancelOffers(uint256[] _itemGroupIds)` (public)

Allows any user to cancel an offer for items from this Shop. This function
    returns a user's Ether if there is any in escrow for the item group.

    @param _itemGroupIds An array of (unique) item groups for a user to cancel an offer for.



### `acceptOffers(uint256[] _groupIds, address[] _bidders, uint256[] _itemIds, uint256[] _amounts)` (public)

Allows the Shop owner to accept any valid offer from a user. Once the Shop
    owner accepts the offer, the Ether is distributed according to fees and the
    item is minted to the user.

    @param _groupIds The item group IDs to process offers for.
    @param _bidders The specific bidder for each item group ID to accept.
    @param _itemIds The specific item ID within the group to mint for the bidder.
    @param _amounts The amount of specific item to mint for the bidder.




