// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.7.6;
pragma abicoder v2;

/**
  @title An interface for the `Token` ERC-20 contract.
  @author Liam Clancy
  @author Tim Clancy

  September 2nd, 2021.
*/
interface IToken {

  /// The public identifier for the right to mint tokens.
  function MINT () external view returns (bytes32);

  /// The public identifier for the right to unlock token transfers.
  function UNLOCK_TRANSFERS () external view returns (bytes32);

  /// The EIP-712 typehash for the contract's domain.
  function DOMAIN_TYPEHASH () external view returns (bytes32);

  /// The EIP-712 typehash for the delegation struct used by the contract.
  function DELEGATION_TYPEHASH () external view returns (bytes32);

  /// A flag for whether or not token transfers are enabled.
  function transfersUnlocked () external view returns (bool);

  /// A mapping to record delegates for each address.
  function delegates (address) external view returns (address);

  /**
    A checkpoint structure to count some number of votes from a given block.

    @param fromBlock The block to begin counting votes from.
    @param votes The number of votes counted from block `fromBlock`.
  */
  struct Checkpoint {
    uint32 fromBlock;
    uint256 votes;
  }

  /// A mapping to record indexed `Checkpoint` votes for each address.
  function checkpoints (address, uint32) external view returns (Checkpoint memory);

  /// A mapping to record the number of `Checkpoint`s for each address.
  function numCheckpoints (address) external view returns (uint32);

  /// A mapping to record per-caller states for signing / validating signatures.
  function nonce (address) external view returns (uint256);

  /**
    Return a version number for this contract's interface.
  */
  function version () external pure returns (uint256);

  /**
    Get the current votes balance for the address `_account`.

    @param _account The address to get the votes balance of.
    @return The number of current votes for `_account`.
  */
  function getCurrentVotes(
    address _account
  ) external view returns (uint256);

  /**
    Determine the prior number of votes for an address as of a block number. The
    block number must be a finalized block or this function will revert to
    prevent misinformation.

    @param _account The address to check.
    @param _blockNumber The block number to get the vote balance at.
    @return The number of votes `_account` had as of the given block.
  */
  function getPriorVotes(
    address _account,
    uint _blockNumber
  ) external view returns (uint256);

  /**
    Allows users to transfer tokens to a recipient, moving delegated votes with
    the transfer.

    @param _recipient The address to transfer tokens to.
    @param _amount The amount of tokens to send to `_recipient`.
  */
  function transfer(
    address _recipient,
    uint256 _amount
  ) external returns (bool);

  /**
    Allow an approved user to unlock transfers of this token.
  */
  function unlockTransfers() external;

  /**
    Allows Token creator to mint `_amount` of this Token to the address `_to`.
    New tokens of this Token cannot be minted if it would exceed the supply cap.
    Users are delegated votes when they are minted Token.

    @param _to the address to mint Tokens to.
    @param _amount the amount of new Token to mint.
  */
  function mint(
    address _to,
    uint256 _amount
  ) external;

  /**
    Allow the caller to burn some `_amount` of their Tokens.

    @param _amount The amount of tokens that the caller will try to burn.
  */
  function burn(
    uint256 _amount
  ) external;

  /**
    Allow the caller to burn some `_amount` of Tokens from `_account`. The
    caller can only burn these tokens if they have been granted an allowance by
    `_account`.

    @param _account The account to burn tokens from.
    @param _amount The amount of tokens to burn.
  */
  function burnFrom(
    address _account,
    uint256 _amount
  ) external;

  /**
    Delegate votes from the caller to `_delegatee`.

    @param _delegatee The address to delegate votes to.
  */
  function delegate(
    address _delegatee
  ) external;

  /**
    Delegate votes by signature from the caller to `_delegatee`.

    @param _delegatee The address to delegate votes to.
    @param _nonce The contract state required for signature matching.
    @param _expiry The time at which to expire the signature.
    @param _v The recovery byte of the signature.
    @param _r Half of the ECDSA signature pair.
    @param _s Half of the ECDSA signature pair.
  */
  function delegateBySig(
    address _delegatee,
    uint _nonce,
    uint _expiry,
    uint8 _v,
    bytes32 _r,
    bytes32 _s
  ) external;
}
