## `Fee1155NFTLockable`






### `constructor(string _uri, contract FeeOwner _feeOwner, address _proxyRegistryAddress)` (public)

Construct a new ERC-1155 item with an associated FeeOwner fee.

    @param _uri The metadata URI to perform token ID substitution in.
    @param _feeOwner The address of a FeeOwner who receives earnings from this
                     item.



### `isApprovedForAll(address _owner, address _operator) → bool isOperator` (public)

An override to whitelist the OpenSea proxy contract to enable gas-free
    listings. This function returns true if `_operator` is approved to transfer
    items owned by `_owner`.

    @param _owner The owner of items to check for transfer ability.
    @param _operator The potential transferrer of `_owner`'s items.



### `setURI(string _uri)` (external)

Allow the item owner to update the metadata URI of this collection.

    @param _uri The new URI to update to.



### `lock()` (external)

Allow the item owner to forever lock this contract to further item minting.



### `createNFT(address recipient, uint256[] ids, uint256[] amounts, bytes data) → uint256` (external)

Create a new NFT item group of a specific size. NFTs within a group share a
    group ID in the upper 128-bits of their full item ID. Within a group NFTs
    can be distinguished for the purposes of serializing issue numbers.

    @param recipient The address to receive all NFTs within the newly-created group.
    @param ids The item IDs for the new items to create.
    @param amounts The amount of each corresponding item ID to create.
    @param data Any associated data to use on items minted in this transaction.




### `ItemGroupCreated(uint256 itemGroupId, uint256 itemGroupSize, address creator)`

An event for tracking the creation of an item group.



