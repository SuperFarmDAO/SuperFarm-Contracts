## `Token`






### `constructor(string _name, string _ticker, uint256 _cap)` (public)

Construct a new Token by providing it a name, ticker, and supply cap.

    @param _name The name of the new Token.
    @param _ticker The ticker symbol of the new Token.
    @param _cap The supply cap of the new Token.



### `burn(uint256 amount)` (public)



Destroys `amount` tokens from the caller.

See {ERC20-_burn}.

### `burnFrom(address account, uint256 amount)` (public)



Destroys `amount` tokens from `account`, deducting from the caller's
allowance.

See {ERC20-_burn} and {ERC20-allowance}.

Requirements:

- the caller must have allowance for ``accounts``'s tokens of at least
`amount`.

### `mint(address _to, uint256 _amount)` (external)

Allows Token creator to mint `_amount` of this Token to the address `_to`.
    New tokens of this Token cannot be minted if it would exceed the supply cap.
    Users are delegated votes when they are minted Token.

    @param _to the address to mint Tokens to.
    @param _amount the amount of new Token to mint.



### `transfer(address recipient, uint256 amount) → bool` (public)

Allows users to transfer tokens to a recipient, moving delegated votes with
    the transfer.

    @param recipient The address to transfer tokens to.
    @param amount The amount of tokens to send to `recipient`.



### `delegates(address delegator) → address` (external)

Return the address delegated to by `delegator`.

    @return The address delegated to by `delegator`.



### `delegate(address delegatee)` (external)

Delegate votes from `msg.sender` to `delegatee`.

    @param delegatee The address to delegate votes to.



### `delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s)` (external)

Delegate votes from signatory to `delegatee`.

    @param delegatee The address to delegate votes to.
    @param nonce The contract state required for signature matching.
    @param expiry The time at which to expire the signature.
    @param v The recovery byte of the signature.
    @param r Half of the ECDSA signature pair.
    @param s Half of the ECDSA signature pair.



### `getCurrentVotes(address account) → uint256` (external)

Get the current votes balance for the address `account`.

    @param account The address to get the votes balance of.
    @return The number of current votes for `account`.



### `getPriorVotes(address account, uint256 blockNumber) → uint256` (external)

Determine the prior number of votes for an address as of a block number.

    @dev The block number must be a finalized block or else this function will revert to prevent misinformation.
    @param account The address to check.
    @param blockNumber The block number to get the vote balance at.
    @return The number of votes the account had as of the given block.



### `_delegate(address delegator, address delegatee)` (internal)

An internal function to actually perform the delegation of votes.

    @param delegator The address delegating to `delegatee`.
    @param delegatee The address receiving delegated votes.



### `_moveDelegates(address srcRep, address dstRep, uint256 amount)` (internal)

An internal function to move delegated vote amounts between addresses.

    @param srcRep the previous representative who received delegated votes.
    @param dstRep the new representative to receive these delegated votes.
    @param amount the amount of delegated votes to move between representatives.



### `_writeCheckpoint(address delegatee, uint32 nCheckpoints, uint256 oldVotes, uint256 newVotes)` (internal)

An internal function to write a checkpoint of modified vote amounts.
    This function is guaranteed to add at most one checkpoint per block.

    @param delegatee The address whose vote count is changed.
    @param nCheckpoints The number of checkpoints by address `delegatee`.
    @param oldVotes The prior vote count of address `delegatee`.
    @param newVotes The new vote count of address `delegatee`.



### `safe32(uint256 n, string errorMessage) → uint32` (internal)

A function to safely limit a number to less than 2^32.

    @param n the number to limit.
    @param errorMessage the error message to revert with should `n` be too large.
    @return The number `n` limited to 32 bits.



### `getChainId() → uint256` (internal)

A function to return the ID of the contract's particular network or chain.

    @return The ID of the contract's network or chain.




### `DelegateChanged(address delegator, address fromDelegate, address toDelegate)`

An event emitted when an address changes its delegate.



### `DelegateVotesChanged(address delegate, uint256 previousBalance, uint256 newBalance)`

An event emitted when the vote balance of a delegated address changes.



