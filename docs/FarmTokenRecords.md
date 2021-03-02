## `FarmTokenRecords`






### `createToken(string _name, string _ticker, uint256 _cap, address[] _directMintAddresses, uint256[] _directMintAmounts) → contract Token` (external)

Create a Token on behalf of the owner calling this function. The Token
    supports immediate minting at the time of creation to particular addresses.

    @param _name The name of the Token to create.
    @param _ticker The ticker symbol of the Token to create.
    @param _cap The supply cap of the Token.
    @param _directMintAddresses An array of addresses to mint directly to.
    @param _directMintAmounts An array of Token amounts to mint to keyed addresses.



### `addToken(address _tokenAddress)` (external)

Allow a user to add an existing Token contract to the registry.

    @param _tokenAddress The address of the Token contract to add for this user.



### `getTokenCount(address _user) → uint256` (external)

Get the number of entries in the Token records mapping for the given user.

    @return The number of Tokens added for a given address.




### `TokenCreated(address tokenAddress, address creator)`

An event for tracking the creation of a new Token.



