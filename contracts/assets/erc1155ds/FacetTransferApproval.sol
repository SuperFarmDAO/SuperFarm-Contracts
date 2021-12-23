// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/utils/introspection/ERC165Storage.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "../../access/PermitControl.sol";
import "../../proxy/StubProxyRegistry.sol";


import "./Blueprint.sol";

/** 
  @title Diamond facet for Super1155's Transfer and Approval functions.
  @author Tim Clancy
  @author Qazawat Zirak
  @author Rostislav Khlebnikov
  @author Nikita Elunin
  This contract is a logic contract for delegate calls from the ProxyStorage.
  The contract defines the logic of Transfer/Approval of Super1155 assets and
  the storage of ProxyStorage is updated based on KECCAK256 memory locations.

  For the purpose of standardization, a facet should be less than 15KiloBytes.

  22 Dec, 2021.
*/
contract FacetTransferApproval is PermitControl, ERC165Storage, IERC1155, IERC1155MetadataURI {
  using Address for address;
  using SafeERC20 for IERC20;

  uint256 MAX_INT = type(uint256).max;

  /// The public identifier for the right to set this contract's metadata URI.
  bytes32 public constant SET_URI = keccak256("SET_URI");

  /// The public identifier for the right to set this contract's proxy registry.
  bytes32 public constant SET_PROXY_REGISTRY = keccak256("SET_PROXY_REGISTRY");

  /// The public identifier for the right to configure item groups.
  bytes32 public constant CONFIGURE_GROUP = keccak256("CONFIGURE_GROUP");

  /// The public identifier for the right to mint items.
  bytes32 public constant MINT  = keccak256("MINT");

  /// The public identifier for the right to burn items.
  bytes32 public constant BURN = keccak256("BURN");

  /// The public identifier for the right to set item metadata.
  bytes32 public constant SET_METADATA = keccak256("SET_METADATA");

  /// The public identifier for the right to lock the metadata URI.
  bytes32 public constant LOCK_URI = keccak256("LOCK_URI");

  /// The public identifier for the right to lock an item's metadata.
  bytes32 public constant LOCK_ITEM_URI = keccak256("LOCK_ITEM_URI");

  /// The public identifier for the right to disable item creation.
  bytes32 public constant LOCK_CREATION = keccak256("LOCK_CREATION");

  /// @dev Supply the magic number for the required ERC-1155 interface.
  bytes4 private constant INTERFACE_ERC1155 = 0xd9b67a26;

  /// @dev Supply the magic number for the required ERC-1155 metadata extension.
  bytes4 private constant INTERFACE_ERC1155_METADATA_URI = 0x0e89341c;

  /// @dev A mask for isolating an item's group ID.
  uint256 private constant GROUP_MASK = uint256(type(uint128).max) << 128;

  /**
    An event that gets emitted when the metadata collection URI is changed.

    @param oldURI The old metadata URI.
    @param newURI The new metadata URI.
  */
  event ChangeURI(string indexed oldURI, string indexed newURI);

  /**
    An event that gets emitted when the proxy registry address is changed.

    @param oldRegistry The old proxy registry address.
    @param newRegistry The new proxy registry address.
  */
  event ChangeProxyRegistry(address indexed oldRegistry,
    address indexed newRegistry);

  /**
    An event that gets emitted when an item group is configured.

    @param manager The caller who configured the item group `_groupId`.
    @param groupId The groupId being configured.
    @param newGroup The new group configuration.
  */
  event ItemGroupConfigured(address indexed manager, uint256 groupId,
    Blueprint.ItemGroupInput indexed newGroup);

  /**
    An event that gets emitted when the item collection is locked to further
    creation.

    @param locker The caller who locked the collection.
  */
  event CollectionLocked(address indexed locker);

  /**
    An event that gets emitted when a token ID has its on-chain metadata
    changed.

    @param changer The caller who triggered the metadata change.
    @param id The ID of the token which had its metadata changed.
    @param oldMetadata The old metadata of the token.
    @param newMetadata The new metadata of the token.
  */
  event MetadataChanged(address indexed changer, uint256 indexed id,
    string oldMetadata, string indexed newMetadata);

  /**
    An event that indicates we have set a permanent metadata URI for a token.

    @param _value The value of the permanent metadata URI.
    @param _id The token ID associated with the permanent metadata value.
  */
  event PermanentURI(string _value, uint256 indexed _id);

  /**
    An event that emmited when the contract URI is changed

    @param oldURI The old contract URI
    @param newURI The new contract URI
   */
  event ChangeContractURI(string indexed oldURI, string indexed newURI);

  /**
    An event that indicates we have set a permanent contract URI.

    @param _value The value of the permanent contract URI.
    @param _id The token ID associated with the permanent metadata value.
  */
  event PermanentContractURI(string _value, uint256 indexed _id);

  /**
    This is a private helper function to replace the `hasItemRight` modifier
    that we use on some functions in order to inline this check during batch
    minting and burning.

    @param _id The ID of the item to check for the given `_right` on.
    @param _right The right that the caller is trying to exercise on `_id`.
    @return Whether or not the caller has a valid right on this item.
  */
  function _hasItemRight(uint256 _id, bytes32 _right) private view
    returns (bool) {
    uint256 groupId = _id  >> 128;
    if (_msgSender() == owner()) {
      return true;
    }
    if (hasRight(_msgSender(), UNIVERSAL, _right)) {
      return true;
    } 
    if (hasRight(_msgSender(), bytes32(groupId), _right)) {
      return true;
    }
    if (hasRight(_msgSender(), bytes32(_id), _right)) {
      return true;
    } 
    return false;
  }

  /**
    An inheritable and configurable pre-transfer hook that can be overridden.
    It fires before any token transfer, including mints and burns.

    @param _operator The caller who triggers the token transfer.
    @param _from The address to transfer tokens from.
    @param _to The address to transfer tokens to.
    @param _ids The specific token IDs to transfer.
    @param _amounts The amounts of the specific `_ids` to transfer.
    @param _data Additional call data to send with this transfer.
  */
  function _beforeTokenTransfer(address _operator, address _from, address _to,
    uint256[] memory _ids, uint256[] memory _amounts, bytes memory _data)
    internal virtual {
  }
  /**
    The batch equivalent of `_doSafeTransferAcceptanceCheck()`.

    @param _operator The caller who triggers the token transfer.
    @param _from The address to transfer tokens from.
    @param _to The address to transfer tokens to.
    @param _ids The specific token IDs to transfer.
    @param _amounts The amounts of the specific `_ids` to transfer.
    @param _data Additional call data to send with this transfer.
  */

  function _doSafeBatchTransferAcceptanceCheck(address _operator, address _from,
    address _to, uint256[] memory _ids, uint256[] memory _amounts, bytes memory
    _data) private {
    if (_to.isContract()) {
      try IERC1155Receiver(_to).onERC1155BatchReceived(_operator, _from, _ids,
        _amounts, _data) returns (bytes4 response) {
        if (response != IERC1155Receiver(_to).onERC1155BatchReceived.selector) {
          revert("ERC1155: ERC1155Receiver rejected tokens");
        }
      } catch Error(string memory reason) {
        revert(reason);
      } catch {
        revert("ERC1155: transfer to non ERC1155Receiver implementer");
      }
    }
  }

  /**
    Transfer on behalf of a caller or one of their authorized token managers
    items from one address to another.

    @param _from The address to transfer tokens from.
    @param _to The address to transfer tokens to.
    @param _ids The specific token IDs to transfer.
    @param _amounts The amounts of the specific `_ids` to transfer.
    @param _data Additional call data to send with this transfer.
  */
  function safeBatchTransferFrom(address _from, address _to,
    uint256[] memory _ids, uint256[] memory _amounts, bytes memory _data)
    public virtual {

    Blueprint.Super1155StateVariables storage b = Blueprint.super1155StateVariables();

    require(_ids.length == _amounts.length,
      "ERC1155: ids and amounts length mismatch");
    require(_to != address(0),
      "ERC1155: transfer to the zero address");
    require(_from == _msgSender() || isApprovedForAll(_from, _msgSender()),
      "ERC1155: caller is not owner nor approved");

    // An array to keep track of paidGroups for PerTransfer transfer Type.
    uint256[] memory paidGroup;

    // Validate transfer and perform all batch token sends.
    _beforeTokenTransfer(_msgSender(), _from, _to, _ids, _amounts, _data);
    for (uint256 i = 0; i < _ids.length; ++i) {

      // Retrieve the item's group ID.
      uint256 groupId = (_ids[i] & GROUP_MASK) >> 128;
      uint256 ratioCut;

      // Check transfer type.
      if (b.itemGroups[groupId].transferData.transferType == Blueprint.TransferType.BoundToAddress) {
        revert("Bound to Address");
      } else if (b.itemGroups[groupId].transferData.transferType == Blueprint.TransferType.TemporaryTransfer) {
        require(block.timestamp <= b.itemGroups[groupId].transferData.transferTime, "Transfer time is over");
      }

      // Check transfer fee type.
      if (b.itemGroups[groupId].transferData.transferFeeType == Blueprint.TransferFeeType.PerTransfer) {
        bool paid;
        for (uint256 j = 0; i < paidGroup.length; j++) {
          if (paidGroup[j] == groupId) {
            paid = true;
            break;
          }
        }
        if (!paid) {
          uint256[] memory temp = paidGroup;
          paidGroup = new uint256[](temp.length + 1);
          for (uint256 j = 0; j < temp.length; j++) {
            paidGroup[j] = temp[j];
          }
          paidGroup[paidGroup.length - 1] = groupId;
          IERC20(b.itemGroups[groupId].transferData.transferToken).safeTransferFrom(_from, owner(), b.itemGroups[groupId].transferData.transferFeeAmount);
        }
      } else if (b.itemGroups[groupId].transferData.transferFeeType == Blueprint.TransferFeeType.PerItem) {
        if (b.itemGroups[groupId].itemType == Blueprint.ItemType.Fungible) {
          IERC20(b.itemGroups[groupId].transferData.transferToken).safeTransferFrom(_from, owner(), (b.itemGroups[groupId].transferData.transferFeeAmount * _amounts[i]) / 10000);
        }
        else {
          IERC20(b.itemGroups[groupId].transferData.transferToken).safeTransferFrom(_from, owner(), b.itemGroups[groupId].transferData.transferFeeAmount * _amounts[i]);
        }
      } else if (b.itemGroups[groupId].transferData.transferFeeType == Blueprint.TransferFeeType.RatioCut) {
        if (b.itemGroups[groupId].itemType == Blueprint.ItemType.Fungible) {
          ratioCut = (_amounts[i] * b.itemGroups[groupId].transferData.transferFeeAmount) / 10000;
        }
      }

      // Update all specially-tracked group-specific balances.
      require(b.balances[_ids[i]][_from] >= _amounts[i], "ERC1155: insufficient balance for transfer");
      b.balances[_ids[i]][_from] = b.balances[_ids[i]][_from] - _amounts[i];
      b.balances[_ids[i]][_to] = b.balances[_ids[i]][_to] + _amounts[i] - ratioCut;
      b.groupBalances[groupId][_from] = b.groupBalances[groupId][_from] - _amounts[i];
      b.groupBalances[groupId][_to] = b.groupBalances[groupId][_to] + _amounts[i] - ratioCut;
      b.totalBalances[_from] = b.totalBalances[_from] - _amounts[i];
      b.totalBalances[_to] = b.totalBalances[_to] + _amounts[i] - ratioCut;

      // Update RatioCut and RatioExtra fees.
      if (b.itemGroups[groupId].transferData.transferFeeType == Blueprint.TransferFeeType.RatioCut) {
          b.balances[_ids[i]][owner()] = b.balances[_ids[i]][owner()] + ratioCut;
          b.groupBalances[groupId][owner()] = b.groupBalances[groupId][owner()] + ratioCut;
          b.totalBalances[owner()] = b.totalBalances[owner()] + ratioCut;
      }
    }

    // Emit the transfer event and perform the safety check.
    emit TransferBatch(_msgSender(), _from, _to, _ids, _amounts);
    _doSafeBatchTransferAcceptanceCheck(_msgSender(), _from, _to, _ids,
      _amounts, _data);
  }

  /**
    This function returns true if `_operator` is approved to transfer items
    owned by `_owner`. This approval check features an override to explicitly
    whitelist any addresses delegated in the proxy registry.

    @param _owner The owner of items to check for transfer ability.
    @param _operator The potential transferrer of `_owner`'s items.
    @return Whether `_operator` may transfer items owned by `_owner`.
  */
  function isApprovedForAll(address _owner, address _operator) public
    view virtual returns (bool) {

    Blueprint.Super1155StateVariables storage b = Blueprint.super1155StateVariables();

    if (StubProxyRegistry(b.proxyRegistryAddress).proxies(_owner) == _operator) {
      return true;
    }

    // We did not find an explicit whitelist in the proxy registry.
    return b.operatorApprovals[_owner][_operator];
  }

  /**
    Enable or disable approval for a third party `_operator` address to manage
    (transfer or burn) all of the caller's tokens.

    @param _operator The address to grant management rights over all of the
      caller's tokens.
    @param _approved The status of the `_operator`'s approval for the caller.
  */
  function setApprovalForAll(address _operator, bool _approved) external
    virtual {

    Blueprint.Super1155StateVariables storage b = Blueprint.super1155StateVariables();

    require(_msgSender() != _operator,
      "ERC1155: setting approval status for self");
    b.operatorApprovals[_msgSender()][_operator] = _approved;
    emit ApprovalForAll(_msgSender(), _operator, _approved);
  }

  /**
    Transfer on behalf of a caller or one of their authorized token managers
    items from one address to another.

    @param _from The address to transfer tokens from.
    @param _to The address to transfer tokens to.
    @param _id The specific token ID to transfer.
    @param _amount The amount of the specific `_id` to transfer.
    @param _data Additional call data to send with this transfer.
  */
  function safeTransferFrom(address _from, address _to, uint256 _id,
    uint256 _amount, bytes calldata _data) external  virtual {
      safeBatchTransferFrom(_from, _to, _asSingletonArray(_id), _asSingletonArray(_amount), _data);
  }

  

  /**
    This private helper function converts a number into a single-element array.

    @param _element The element to convert to an array.
    @return The array containing the single `_element`.
  */
  function _asSingletonArray(uint256 _element) private pure
    returns (uint256[] memory) {
    uint256[] memory array = new uint256[](1);
    array[0] = _element;
    return array;
  }

  /**  Unsupported methods in this facet
  */
  function balanceOf(address account, uint256 id) external override view returns (uint256) {}

  function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids)
      external
      view
      returns (uint256[] memory) {}

  function uri(uint256 id) external view returns (string memory) {}
}