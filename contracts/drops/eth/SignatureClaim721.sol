// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

import "../../libraries/EIP712.sol";

/*
  It saves bytecode to revert on custom errors instead of using require
  statements. We are just declaring these errors for reverting with upon various
  conditions later in this contract.
*/
error CannotClaimMoreThanOnce();
error CannotClaimExpiredSignature();
error CannotClaimInvalidSignature();

/**
  @title A contract which accepts signatures from a trusted signer to claim an
    ERC-721 item.
  @author Tim Clancy
  @author Liam Clancy

  This token contract allows for the implementation of off-chain systems that
  permit whitelisted callers to claim items using entirely off-chain data.

  August 4th, 2022.
*/
contract SignatureClaim721 is
  EIP712, Ownable, ReentrancyGuard, ERC721Holder
{

  /**
    A constant hash of the claim operation's signature.

    @dev _claimant The address of the claimant for an item. This must be the
      address of the caller.
    @dev _expiry The expiry time after which this signature cannot execute.
  */
  bytes32 constant public CLAIM_TYPEHASH = keccak256(
    "mint(address _claimant,uint256 _expiry)"
  );

  /// The name of this contract.
  string public name;

  /// The address permitted to sign claim signatures.
  address public immutable signer;

  /// The address of the ERC-721 item to fulfill claims with.
  address public immutable item;

  /// The next ID to transfer for a fulfilled claim.
  uint256 public nextId;

  /// A mapping to track whether or not an address has already claimed.
  mapping ( address => bool ) public claimed;

  /**
    An event emitted when a caller claims an item.

    @param caller The caller who claimed the item.
    @param id The ID of the specific item within the ERC-721 `item` contract.
  */
  event Claimed (
    address indexed caller,
    uint256 id
  );

  /**
    Construct a new claim system by providing this contract with a permissioned
    claim signer and information about the item to fulfill claims with.

    @param _name The name of this contract used in EIP-712 domain separation.
    @param _signer The address permitted to sign claim signatures.
    @param _item The address of the ERC-721 contract defining claimable items.
    @param _firstId The ID of the first item to claim.
  */
  constructor (
    string memory _name,
    address _signer,
    address _item,
    uint256 _firstId
  ) EIP712(_name, "1") {
    name = _name;
    signer = _signer;
    item = _item;
    nextId = _firstId;
  }

  /**
    A private helper function to validate a signature supplied for item claims.
    This function constructs a digest and verifies that the signature signer was
    the authorized address we expect.

    @param _claimant The address of the claimant for the signed-for item. This
      must be the address of the caller.
    @param _expiry The expiry time after which this signature cannot execute.
    @param _v The recovery byte of the signature.
    @param _r Half of the ECDSA signature pair.
    @param _s Half of the ECDSA signature pair.
  */
  function validateClaim (
    address _claimant,
    uint256 _expiry,
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
            CLAIM_TYPEHASH,
            _claimant,
            _expiry
          )
        )
      )
    );

    // The claim is validated if it was signed by our authorized signer.
    return ecrecover(digest, _v, _r, _s) == signer;
  }

  /**
    Allow a caller to claim a new item if
      1. the claim is backed by a valid signature from the trusted `signer`.
      2. the signature is not expired.
      3. the caller has not already claimed an item.

    @param _expiry The expiry time after which this signature cannot execute.
    @param _v The recovery byte of the signature.
    @param _r Half of the ECDSA signature pair.
    @param _s Half of the ECDSA signature pair.
  */
  function mint (
    uint256 _expiry,
    uint8 _v,
    bytes32 _r,
    bytes32 _s
  ) external nonReentrant {

    // Validate that the user is not double-claiming.
    if (claimed[_msgSender()]) { revert CannotClaimMoreThanOnce(); }

    // Validate the expiration time.
    if (_expiry < block.timestamp) { revert CannotClaimExpiredSignature(); }

    // Validiate that the claim was provided by our trusted `signer`.
    bool validSignature = validateClaim(
      _msgSender(),
      _expiry,
      _v,
      _r,
      _s
    );
    if (!validSignature) {
      revert CannotClaimInvalidSignature();
    }

    // Transfer the item being claimed.
    IERC721 claimedItem = IERC721(item);
    claimedItem.safeTransferFrom(
      address(this),
      _msgSender(),
      nextId
    );

    // Record the caller as having claimed.
    claimed[_msgSender()] = true;

    // Emit an event.
    emit Claimed(
      _msgSender(),
      nextId
    );

    // Increment the next ID to claim.
    nextId += 1;
  }
}
