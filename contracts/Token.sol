// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Capped.sol";

import "./base/Sweepable.sol";

/**
  @title A mintable, unpausable ERC-20 token with voting functionality and
    administative permissions based on `PermitControl`.
  @author Tim Clancy
  @author Liam Clancy

  This contract is used when deploying SuperFarm ERC-20 tokens. The token has a
  fixed supply cap and governance functions ultimately copied and modified from
  Compound. It can optionally be created with public transfers paused.

  September 2nd, 2021.
*/
contract Token is Sweepable, ERC20Capped {
  using SafeMath for uint256;

  /// The public identifier for the right to mint tokens.
  bytes32 public constant MINT = keccak256("MINT");

  /// The public identifier for the right to unlock token transfers.
  bytes32 public constant UNLOCK_TRANSFERS = keccak256("UNLOCK_TRANSFERS");

  /// The EIP-712 typehash for the contract's domain.
  bytes32 public constant DOMAIN_TYPEHASH = keccak256(
    "EIP712Domain(string name,uint256 chainId,address verifyingContract)");

  /// The EIP-712 typehash for the delegation struct used by the contract.
  bytes32 public constant DELEGATION_TYPEHASH = keccak256(
    "Delegation(address delegatee,uint256 nonce,uint256 expiry)");

  /// A flag for whether or not token transfers are enabled.
  bool public transfersUnlocked;

  /// A mapping to record delegates for each address.
  mapping( address => address ) public delegates;

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
  mapping( address => mapping( uint32 => Checkpoint )) public checkpoints;

  /// A mapping to record the number of `Checkpoint`s for each address.
  mapping( address => uint32 ) public numCheckpoints;

  /// A mapping to record per-caller states for signing / validating signatures.
  mapping( address => uint256 ) public nonces;

  /**
    An event emitted when an address changes its delegate.

    @param delegator The delegating caller updating its targeted delegate.
    @param fromDelegate The old delegate for the caller `delegator`.
    @param toDelegate The new delegate for the caller `delegator`.
  */
  event DelegateChanged(
    address indexed delegator,
    address indexed fromDelegate,
    address indexed toDelegate
  );

  /**
    An event emitted when the vote balance of a delegated address changes.

    @param delegate The address being delegated votes to.
    @param previousBalance The previous number of votes delegated to `delegate`.
    @param newBalance The new number of votes delegated to `delegate`.
  */
  event DelegateVotesChanged(
    address indexed delegate,
    uint256 previousBalance,
    uint256 newBalance
  );

  /**
    An event emitted when transfers are enabled for this token.

    @param unlocker The caller that unlocked transfers.
  */
  event TransfersUnlocked(
    address indexed unlocker
  );

  /**
    Construct a new Token by providing it a name, ticker, and supply cap.

    @param _owner The address of the administrator governing this portal.
    @param _name The name of the new Token.
    @param _ticker The ticker symbol of the new Token.
    @param _cap The supply cap of the new Token.
    @param _transfersUnlocked Whether or not transfers of this Token are
      immediately unlocked or not.
  */
  constructor(
    address _owner,
    string memory _name,
    string memory _ticker,
    uint256 _cap,
    bool _transfersUnlocked
  ) ERC20(_name, _ticker) ERC20Capped(_cap) {

    // Do not perform a redundant ownership transfer if the deployer should
    // remain as the owner of this contract.
    if (_owner != owner()) {
      transferOwnership(_owner);
    }

    // If transfers begin unlocked, emit an event as such.
    transfersUnlocked = _transfersUnlocked;
    if (_transfersUnlocked) {
      emit TransfersUnlocked(_msgSender());
    }
  }

  /**
    Return a version number for this contract's interface.
  */
  function version() external virtual override(Sweepable) pure returns
    (uint256) {
    return 1;
  }

  /**
    Get the current votes balance for the address `_account`.

    @param _account The address to get the votes balance of.
    @return The number of current votes for `_account`.
  */
  function getCurrentVotes(
    address _account
  ) external view returns (uint256) {
    uint32 nCheckpoints = numCheckpoints[_account];
    return nCheckpoints > 0 ? checkpoints[_account][nCheckpoints - 1].votes : 0;
  }

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
  ) external view returns (uint256) {
    require(_blockNumber < block.number,
      "The specified block is not yet finalized.");

    uint32 nCheckpoints = numCheckpoints[_account];
    if (nCheckpoints == 0) {
      return 0;
    }

    // First check the most recent balance.
    if (checkpoints[_account][nCheckpoints - 1].fromBlock <= _blockNumber) {
      return checkpoints[_account][nCheckpoints - 1].votes;
    }

    // Then check the implicit zero balance.
    if (checkpoints[_account][0].fromBlock > _blockNumber) {
      return 0;
    }

    // Perform checks on each block.
    uint32 lower = 0;
    uint32 upper = nCheckpoints - 1;
    while (upper > lower) {
      uint32 center = upper - (upper - lower) / 2;
      Checkpoint memory cp = checkpoints[_account][center];
      if (cp.fromBlock == _blockNumber) {
        return cp.votes;
      } else if (cp.fromBlock < _blockNumber) {
        lower = center;
      } else {
        upper = center - 1;
      }
    }
    return checkpoints[_account][lower].votes;
  }

  /**
    A function to safely limit a number to less than 2^32.

    @param _n the number to limit.
    @param _errorMessage the error message to revert with should `_n` be too
      large.
    @return The number `_n` limited to 32 bits.
  */
  function safe32(
    uint _n,
    string memory _errorMessage
  ) internal pure returns (uint32) {
    require(_n < 2**32, _errorMessage);
    return uint32(_n);
  }

  /**
    A function to return the ID of the contract's particular network or chain.

    @return The ID of the contract's network or chain.
  */
  function getChainId() internal pure returns (uint) {
    uint256 chainId;
    assembly { chainId := chainid() }
    return chainId;
  }

  /**
    Allows users to transfer tokens to a recipient, moving delegated votes with
    the transfer.

    @param _recipient The address to transfer tokens to.
    @param _amount The amount of tokens to send to `_recipient`.
  */
  function transfer(
    address _recipient,
    uint256 _amount
  ) public override returns (bool) {
    require(transfersUnlocked,
      "Token::transfer::token transfers are locked");
    _transfer(_msgSender(), _recipient, _amount);
    _moveDelegates(delegates[_msgSender()], delegates[_recipient], _amount);
    return true;
  }

  /**
    Allow an approved user to unlock transfers of this token.
  */
  function unlockTransfers() external
    hasValidPermit(UNIVERSAL, UNLOCK_TRANSFERS) {
    transfersUnlocked = true;
    emit TransfersUnlocked(_msgSender());
  }

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
  ) external hasValidPermit(UNIVERSAL, MINT) {
    _mint(_to, _amount);
    _moveDelegates(address(0), delegates[_to], _amount);
  }

  /**
    Allow the caller to burn some `_amount` of their Tokens.

    @param _amount The amount of tokens that the caller will try to burn.
  */
  function burn(
    uint256 _amount
  ) public virtual {
    _burn(_msgSender(), _amount);
  }

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
  ) public virtual {
    require(_amount >= allowance(_account, _msgSender()),
      "ERC20: burn amount exceeds allowance");
    uint256 decreasedAllowance = allowance(_account, _msgSender()).sub(_amount);
    _approve(_account, _msgSender(), decreasedAllowance);
    _burn(_account, _amount);
  }

  /**
    An internal function to write a checkpoint of modified vote amounts.
    This function is guaranteed to add at most one checkpoint per block.

    @param _delegatee The address whose vote count is changed.
    @param _nCheckpoints The number of checkpoints by address `_delegatee`.
    @param _oldVotes The prior vote count of address `_delegatee`.
    @param _newVotes The new vote count of address `_delegatee`.
  */
  function _writeCheckpoint(
    address _delegatee,
    uint32 _nCheckpoints,
    uint256 _oldVotes,
    uint256 _newVotes
  ) internal {
    uint32 blockNumber = safe32(block.number, "Block number exceeds 32 bits.");

    if (_nCheckpoints > 0
      && checkpoints[_delegatee][_nCheckpoints - 1].fromBlock == blockNumber) {
      checkpoints[_delegatee][_nCheckpoints - 1].votes = _newVotes;
    } else {
      checkpoints[_delegatee][_nCheckpoints] = Checkpoint(blockNumber,
        _newVotes);
      numCheckpoints[_delegatee] = _nCheckpoints + 1;
    }

    // Emit the delegate vote change event.
    emit DelegateVotesChanged(_delegatee, _oldVotes, _newVotes);
  }

  /**
    An internal function to move delegated vote amounts between addresses.

    @param _srcRep the previous representative who received delegated votes.
    @param _dstRep the new representative to receive these delegated votes.
    @param _amount the amount of delegated votes to move between
      representatives.
  */
  function _moveDelegates(
    address _srcRep,
    address _dstRep,
    uint256 _amount
  ) internal {
    if (_srcRep != _dstRep && _amount > 0) {

      // Decrease the number of votes delegated to the previous representative.
      if (_srcRep != address(0)) {
        uint32 srcRepNum = numCheckpoints[_srcRep];
        uint256 srcRepOld = srcRepNum > 0 ? checkpoints[_srcRep][srcRepNum - 1].votes : 0;
        uint256 srcRepNew = srcRepOld.sub(_amount);
        _writeCheckpoint(_srcRep, srcRepNum, srcRepOld, srcRepNew);
      }

      // Increase the number of votes delegated to the new representative.
      if (_dstRep != address(0)) {
        uint32 dstRepNum = numCheckpoints[_dstRep];
        uint256 dstRepOld = dstRepNum > 0 ? checkpoints[_dstRep][dstRepNum - 1].votes : 0;
        uint256 dstRepNew = dstRepOld.add(_amount);
        _writeCheckpoint(_dstRep, dstRepNum, dstRepOld, dstRepNew);
      }
    }
  }

  /**
    An internal function to actually perform the delegation of votes.

    @param _delegator The address delegating to `_delegatee`.
    @param _delegatee The address receiving delegated votes.
  */
  function _delegate(
    address _delegator,
    address _delegatee
  ) internal {
    address currentDelegate = delegates[_delegator];
    uint256 delegatorBalance = balanceOf(_delegator);
    delegates[_delegator] = _delegatee;
    _moveDelegates(currentDelegate, _delegatee, delegatorBalance);
    emit DelegateChanged(_delegator, currentDelegate, _delegatee);
  }

  /**
    Delegate votes from the caller to `_delegatee`.

    @param _delegatee The address to delegate votes to.
  */
  function delegate(
    address _delegatee
  ) external {
    return _delegate(_msgSender(), _delegatee);
  }

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
  ) external {
    bytes32 domainSeparator = keccak256(
      abi.encode(
        DOMAIN_TYPEHASH,
        keccak256(bytes(name())),
        getChainId(),
        address(this)));

    bytes32 structHash = keccak256(
      abi.encode(
        DELEGATION_TYPEHASH,
        _delegatee,
        _nonce,
        _expiry));

    bytes32 digest = keccak256(
      abi.encodePacked(
        "\x19\x01",
        domainSeparator,
        structHash));

    // Recover and verify the signatory.
    address signatory = ecrecover(digest, _v, _r, _s);
    require(signatory != address(0),
      "Token::delegateBySig::invalid signature");
    require(_nonce == nonces[signatory]++,
      "Token::delegateBySig::invalid nonce");
    require(block.timestamp <= _expiry,
      "Token::delegateBySig::signature expired");
    return _delegate(signatory, _delegatee);
  }
}
