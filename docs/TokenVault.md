## `TokenVault`





### `onlyPanicOwner()`



a modifier which allows only `panicOwner` to call a function.


### `constructor(string _name, contract Token _token, address _panicOwner, address _panicDestination, uint256 _panicLimit)` (public)

Construct a new TokenVault by providing it a name and the token to disburse.

    @param _name The name of the TokenVault.
    @param _token The token to store and disburse.
    @param _panicOwner The address to grant emergency withdrawal powers to.
    @param _panicDestination The destination to withdraw to in emergency.
    @param _panicLimit A limit for the number of times `panic` can be called before tokens burn.



### `sendTokens(address[] _recipients, uint256[] _amounts)` (external)

Allows the TokenVault owner to send tokens out of the vault.

    @param _recipients The array of addresses to receive tokens.
    @param _amounts The array of amounts sent to each address in `_recipients`.



### `panic()` (external)

Allow the TokenVault's `panicOwner` to immediately send its contents to a
    predefined `panicDestination`. This can be used to circumvent the timelock
    in case of an emergency.




