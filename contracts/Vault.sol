// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";



import "./ISuper1155.sol";
import "./ISuper721.sol";
import "./IToken.sol";
import "./base/Named.sol";

/**
  @title A vault for securely holding Ether, ERC-20 tokens, ERC-721 tokens, or
    ERC-1155 tokens.
  @author Tim Clancy

  A good use for this contract is to hold all of a caller's asset types securely
  behind a Compound Timelock governed by a Gnosis MultiSigWallet. Tokens may
  only leave the vault with multisignature permission and after passing through
  a mandatory timelock. The justification for the timelock is such that, if the
  multisignature wallet is ever compromised, the user will have two days to act
  in mitigating the potential damage from the attacker's `sentTokens` call. Such
  mitigation efforts may include calling `panic` from a separate, uncompromised
  and non-timelocked multisignature wallet, or finding some way to issue a new
  token entirely.
*/
contract Vault is Named, ReentrancyGuard {
  using SafeMath for uint256;

  /// The public identififer for the right to alter the `panicDestination`.
  bytes32 public constant SET_DESTINATION = keccak256("SET_DESTINATION");

  /// The public identififer for the right to lock `panicDestination` changes.
  bytes32 public constant LOCK = keccak256("LOCK");

  // The public identifier for the right to send assets from this vault.
  bytes32 public constant SEND = keccak256("SEND");

  /**
    The public identifier for the right to panic.

    When this vault panics, the contents of the vault to the address specified
    in `panicDestination`. The intention of this system is to support a series
    of cascading vaults secured by their own multisignature wallets. If, for
    instance, vault one is compromised via its attached multisignature wallet,
    vault two could intercede to save the tokens from vault one before the
    malicious token send clears the owning timelock.
  */
  bytes32 public constant PANIC = keccak256("PANIC");

  /**
    A blackhole burn address to transfer destroyed assets to. The approach to
    transfer all assets to this specific blackhole address instead of performing
    proper burns on them is an unfortunate necessity of some mainnet
    implementations of ERC-20, ERC-721, and ERC-1155 being unburnable either by
    choice or due to smart contract bugs.
  */
  address public constant DEADBEEF = 0x00000000000000000000000000000000DeaDBeef;

  /// An optional address where tokens may be immediately sent in a panic.
  address public panicDestination;

  /**
    A flag to determine whether or not this vault can alter its
    `panicDestination`.
  */
  bool public canAlterPanicDestination;

  /// A counter for the number of times this vault has panicked.
  uint256 public panicCounter;

  /**
    A counter to limit the number of times a vault can panic before burning the
    underlying assets. This limit is in place to protect against a situation
    where multiple dependent vaults linked in a circle are all compromised. In
    the event of such an attack, this still gives the original multisignature
    holders the chance to burn the tokens by repeatedly calling `panic` before
    the attacker can use `sendTokens` when using a Timelock solution.
  */
  uint256 public panicLimit;

  /**
    This enumeration lists the various asset types that this vault may hold and
    transfer.

    @param Ether The underlying Ether asset.
    @param ERC20 Any ERC-20 token.
    @param ERC721 Any ERC-721 token.
    @param ERC1155 Any ERC-1155 token.
  */
  enum AssetType {
    Ether,
    ERC20,
    ERC721,
    ERC1155
  }

  /**
    A struct representing data for a single asset transfer.

    @param recipient The recipient of this asset to be transfered.
    @param asset The relevant asset's smart contract address. This is optional
      for the Ether `assetType`.
    @param id The token ID, required for ERC-20 or ERC-1155 `assetType`s.
    @param amount The amount of this asset to be transferred.
    @param assetType The type of asset being transferred.
  */
  struct AssetTransferInput {
    address recipient;
    address asset;
    uint256 id;
    uint256 amount;
    AssetType assetType;
  }

  /**
    A struct representing data for a single panic asset transfer.

    @param asset The relevant asset's smart contract address. This is optional
      for the Ether `assetType`.
    @param id The token ID, required for ERC-20 or ERC-1155 `assetType`s.
    @param amount The amount of this asset to be transferred.
    @param assetType The type of asset being transferred.
  */
  struct PanicTransferInput {
    address asset;
    uint256 id;
    uint256 amount;
    AssetType assetType;
  }

  /**
    An event for tracking a change in panic details.

    @param timestamp The timestamp when this event was emitted.
    @param oldPanicDestination The old `panicDestination` address.
    @param newPanicDestination The new `panicDestination` address.
  */
  event PanicDestinationChanged (
    uint256 timestamp,
    address indexed oldPanicDestination,
    address indexed newPanicDestination
  );

  /**
    An event for tracking a lock on alteration of panic details.

    @param timestamp The timestamp when this event was emitted.
  */
  event PanicDestinationLocked (
    uint256 timestamp
  );

  /**
    An event for tracking assets being sent out of this vault. The `assets`,
    `ids`, `amounts`, and `destinations` arrays are all keyed to each other.

    @param timestamp The timestamp when this event was emitted.
    @param assetTransfers An array of data on all assets transfered.
  */
  event Send (
    uint256 timestamp,
    AssetTransferInput[] assetTransfers
  );

  /**
    An event for tracking a panic transfer of assets.

    @param timestamp The timestamp when this event was emitted.
    @param panicCount The number of times the vault has now panic transfered.
    @param destination The destination that the panic transfered assets to.
    @param panicAssets The assets to be transferred in this panic.
  */
  event PanicTransfer (
    uint256 timestamp,
    uint256 panicCount,
    address indexed destination,
    PanicTransferInput[] panicAssets
  );

  /**
    An event for tracking a panic burn of assets.

    @param timestamp The timestamp when this event was emitted.
    @param panicCount The number of times the vault has panic transfered.
    @param panicAssets The assets that were burnt in this panic.
  */
  event PanicBurn (
    uint256 timestamp,
    uint256 panicCount,
    PanicTransferInput[] panicAssets
  );

  /**
    Construct a new Vault.

    @param _owner The address of the administrator owning this Vault.
    @param _name The name of the Vault.
    @param _panicDestination The destination to withdraw to in an emergency.
    @param _panicLimit A limit for the number of times `panic` can be called
      before assets burn.
  */
  constructor (
    address _owner,
    string memory _name,
    address _panicDestination,
    uint256 _panicLimit
  ) Named(_name) {

    // Do not perform a redundant ownership transfer if the deployer should
    // remain as the owner of the collection.
    if (_owner != owner()) {
      transferOwnership(_owner);
    }

    // Continue initialization.
    panicLimit = _panicLimit;
    panicDestination = _panicDestination;
    panicCounter = 0;
    canAlterPanicDestination = true;
  }

  /**
    Return a version number for this contract's interface.
  */
  function version () external virtual override(Named) pure returns (uint256) {
    return 1;
  }

  /**
    Allows permissioned users to update the Vault's `panicDestination` details
    governing its panic functionality.

    @param _panicDestination The new emergency destination to send tokens to.
  */
  function setPanicDestination (
    address _panicDestination
  ) external nonReentrant hasValidPermit(UNIVERSAL, SET_DESTINATION) {
    require(canAlterPanicDestination,
      "Vault::setPanicDestination::vault panic change locked");
    address oldPanicDestination = panicDestination;
    panicDestination = _panicDestination;

    // Emit a panic destination change event.
    emit PanicDestinationChanged(block.timestamp, oldPanicDestination,
      panicDestination);
  }

  /**
    Allows permissioned Vault users to lock the Vault to all future panic
    destination changes.
  */
  function lock () external nonReentrant hasValidPermit(UNIVERSAL, LOCK) {
    canAlterPanicDestination = false;
    emit PanicDestinationLocked(block.timestamp);
  }

  /**
    Allows permissioned Vault users to send assets out of the Vault.

    @param _assetTransfers The array of asset transfer inputs detailing the
      assets to be transferred from this Vault.
  */
  function sendAssets (
    AssetTransferInput[] calldata _assetTransfers
  ) external nonReentrant hasValidPermit(UNIVERSAL, SEND) {

    // Attempt to process each requested asset transfer.
    for (uint256 i = 0; i < _assetTransfers.length; i++) {

      // Handle the transfer of Ether.
      if (_assetTransfers[i].assetType == AssetType.Ether) {
        (bool success, ) = payable(_assetTransfers[i].recipient).call{
          value: _assetTransfers[i].amount
        }("");
        require(success,
          "Vault::sendAssets::Ether transfer failed");

      // Handle the transfer of ERC-20 tokens.
      } else if (_assetTransfers[i].assetType == AssetType.ERC20) {
        IToken token = IToken(_assetTransfers[i].asset);
        token.transfer(_assetTransfers[i].recipient, _assetTransfers[i].amount);

      // Handle the transfer of ERC-721 tokens.
      } else if (_assetTransfers[i].assetType == AssetType.ERC721) {
        ISuper721 token = ISuper721(_assetTransfers[i].asset);
        token.safeTransferFrom(address(this), _assetTransfers[i].recipient,
          _assetTransfers[i].id, "");

      // Handle the transfer of ERC-1155 tokens.
      } else if (_assetTransfers[i].assetType == AssetType.ERC1155) {
        ISuper1155 token = ISuper1155(_assetTransfers[i].asset);
        token.safeTransferFrom(address(this), _assetTransfers[i].recipient,
          _assetTransfers[i].id, _assetTransfers[i].amount, "");
      }
    }

    // Emit the completed send event.
    emit Send(block.timestamp, _assetTransfers);
  }

  /**
    Allows permissioned Vault users to immediately send its contents to a
    predefined `panicDestination`. This can be used to circumvent a Timelock
    in case of an emergency. If a panic limit is reached, all assets are burnt.

    @param _panicAssets The assets to panic over.
  */
  function panic (
    PanicTransferInput[] calldata _panicAssets
  ) external nonReentrant hasValidPermit(UNIVERSAL, PANIC) {
    address panicRecipient;

    // If the panic limit is reached, destroy the assets.
    if (panicCounter >= panicLimit) {
      panicRecipient = DEADBEEF;

    // Otherwise, drain the vault to the panic destination.
    } else {
      panicRecipient = panicDestination;
      panicCounter = panicCounter.add(1);
    }

    // Complete this panic by the transfer or destruction of assets.
    for (uint256 i = 0; i < _panicAssets.length; i++) {

      // Handle the transfer of Ether.
      if (_panicAssets[i].assetType == AssetType.Ether) {
        (bool success, ) = payable(panicRecipient).call{
          value: _panicAssets[i].amount
        }("");
        require(success,
          "Vault::panic::Ether transfer failed");

      // Handle the transfer of ERC-20 tokens.
      } else if (_panicAssets[i].assetType == AssetType.ERC20) {
        IToken token = IToken(_panicAssets[i].asset);
        token.transfer(panicRecipient, _panicAssets[i].amount);

      // Handle the transfer of ERC-721 tokens.
      } else if (_panicAssets[i].assetType == AssetType.ERC721) {
        ISuper721 token = ISuper721(_panicAssets[i].asset);
        token.safeTransferFrom(address(this), panicRecipient,
          _panicAssets[i].id, "");

      // Handle the transfer of ERC-1155 tokens.
      } else if (_panicAssets[i].assetType == AssetType.ERC1155) {
        ISuper1155 token = ISuper1155(_panicAssets[i].asset);
        token.safeTransferFrom(address(this), panicRecipient,
          _panicAssets[i].id, _panicAssets[i].amount, "");
      }
    }

    // Emit the correct event.
    if (panicCounter >= panicLimit) {
      emit PanicBurn(block.timestamp, panicCounter, _panicAssets);
    } else {
      emit PanicTransfer(block.timestamp, panicCounter, panicDestination,
        _panicAssets);
    }
  }

  function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external view returns (bytes4) {
    return this.onERC721Received.selector;
  }

  function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    )
        external view
        returns(bytes4) {
          return this.onERC1155Received.selector;
        }

   function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    )
        external view
        returns(bytes4) {
          return this.onERC1155BatchReceived.selector;
        }
}
