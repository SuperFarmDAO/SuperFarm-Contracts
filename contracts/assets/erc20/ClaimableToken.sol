// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "../../libraries/EIP712.sol";
import "./Token.sol";

/**
  @title A version of the Token contract which may be claimed via signatures
  that were produced off-chain. This token is intended to be issued as part of a
  claimable airdrop.
  @author Tim Clancy
  @author Rostislav Khlebnikov

  This token contract was developed at a time when airdrops based on off-chain
  activity like OpenSea trading volume were very popular.

  February 4th, 2022.
*/
contract ClaimableToken is Token, EIP712 {

  /// A constant hash of the mint operation's signature.
  bytes32 constant public MINT_TYPEHASH = keccak256(
    "mint(address _to,uint256 _amount)"
  );

  /// The address permitted to sign claim signatures.
  address public immutable signer;

  /// The total amount of this token that may be claimed across all claimants.
  uint256 public immutable claimableCap;

  /// The time when claiming this token begins.
  uint256 public claimBegins;

  /// The time when claiming this token ends.
  uint256 public claimEnds;

  /// A mapping for whether or not a given address has claimed their tokens.
  mapping ( address => bool ) public claimed;

  /// Track the amount of this token that has been claimed by claimants.
  uint256 public claimedAmount = 0;

  /**
    An event emitted when a claimant claims tokens.

    @param timestamp The timestamp of the claim.
    @param claimant The caller who claimed tokens.
    @param amount The amount of tokens claimed.
  */
  event Claimed (
    uint256 timestamp,
    address indexed claimant,
    uint256 amount
  );

  /**
    Construct a new ClaimableToken by providing it a name, ticker, supply cap,
    permissioned claim signer, claimbale supply cap, and the times at which
    claiming begins and ends.

    @param _name The name of the new ClaimableToken.
    @param _ticker The ticker symbol of the new ClaimableToken.
    @param _cap The supply cap of the new ClaimableToken.
    @param _signer The address permitted to sign claim signatures.
    @param _claimableCap The cap on the total amount of token for claims.
    @param _claimBegins The time at which claims for this token begin.
    @param _claimEnds The time at which claims for this token end.
  */
  constructor (
    string memory _name,
    string memory _ticker,
    uint256 _cap,
    address _signer,
    uint256 _claimableCap,
    uint256 _claimBegins,
    uint256 _claimEnds
  ) Token(_name, _ticker, _cap) EIP712(_name, "1") {
    signer = _signer;
    claimableCap = _claimableCap;
    claimBegins = _claimBegins;
    claimEnds = _claimEnds;
  }

  /**
    A private helper function to validate a signature supplied for token claims.
    This function constructs a digest and verifies that the signature signer was
    the authorized address we expect.

    @param _claimant The claimant attempting to claim tokens.
    @param _amount The amount of tokens the claimant is trying to claim.
    @param _v The recovery byte of the signature.
    @param _r Half of the ECDSA signature pair.
    @param _s Half of the ECDSA signature pair.
  */
  function validClaim (
    address _claimant,
    uint256 _amount,
    uint8 _v,
    bytes32 _r,
    bytes32 _s
  ) private view returns (bool) {
    bytes32 digest = keccak256(
      abi.encodePacked(
        "\x19\x01",
        DOMAIN_SEPARATOR,
        keccak256(
          abi.encode(
            MINT_TYPEHASH,
            _claimant,
            _amount
          )
        )
      )
    );

    // The claim is validated if it was signed by our authorized signer.
    return ecrecover(digest, _v, _r, _s) == signer;
  }

  /**
    Allow a caller to claim any of their available tokens if
      1. the claiming period is active
      2. the caller has not already claimed tokens
      3. the claim would not exceed the claim cap
      4. the claim is backed by a valid signature that has been pre-supplied
         with a mint `_amount` by `signer`.

    @param _amount The amount of tokens that the caller is trying to claim.
    @param _v The recovery byte of the signature.
    @param _r Half of the ECDSA signature pair.
    @param _s Half of the ECDSA signature pair.
  */
  function claim (uint256 _amount, uint8 _v, bytes32 _r, bytes32 _s) external {
    require(block.timestamp >= claimBegins && block.timestamp < claimEnds,
      "0");
    require(!claimed[_msgSender()],
      "1");
    require(claimedAmount + _amount <= claimableCap,
      "2");
    require(validClaim(_msgSender(), _amount, _v, _r, _s),
      "3");

    // Flag the caller as having claimed.
    claimed[_msgSender()] = true;

    // Mint tokens to the caller.
    _mint(_msgSender(), _amount);

    // Update our amount of claimed tokens.
    claimedAmount += _amount;

    // Emit an event.
    emit Claimed(block.timestamp, _msgSender(), _amount);
  }
}
