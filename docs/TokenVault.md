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



### `changePanicDetails(address _panicOwner, address _panicDestination)` (external)

Allows the owner of the TokenVault to update the `panicOwner` and
    `panicDestination` details governing its panic functionality.

    @param _panicOwner The new panic owner to set.
    @param _panicDestination The new emergency destination to send tokens to.



### `lock()` (external)

Allows the owner of the TokenVault to lock the vault to all future panic
    detail changes.



### `sendTokens(address[] _recipients, uint256[] _amounts)` (external)

Allows the TokenVault owner to send tokens out of the vault.

    @param _recipients The array of addresses to receive tokens.
    @param _amounts The array of amounts sent to each address in `_recipients`.



### `panic()` (external)

Allow the TokenVault's `panicOwner` to immediately send its contents to a
    predefined `panicDestination`. This can be used to circumvent the timelock
    in case of an emergency.




### `PanicDetailsChange(address panicOwner, address panicDestination)`

An event for tracking a change in panic details.



### `PanicDetailsLocked()`

An event for tracking a lock on alteration of panic details.



### `TokenSend(uint256 tokenAmount)`

An event for tracking a disbursement of tokens.



### `PanicTransfer(uint256 panicCounter, uint256 tokenAmount, address destination)`

An event for tracking a panic transfer of tokens.



### `PanicBurn(uint256 panicCounter, uint256 tokenAmount)`

An event for tracking a panic burn of tokens.



