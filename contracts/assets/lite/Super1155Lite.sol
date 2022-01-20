// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/introspection/ERC165Storage.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "../../access/PermitControlds.sol";
import "../../proxy/StubProxyRegistry.sol";
import "./Super1155LiteBlueprint.sol";
/**
  @title  A lite ERC-1155 item creation contract.
  @author Tim Clancy
  @author Qazawat Zirak
  @author Rostislav Khlebnikov
  @author Nikita Elunin

  This contract represents the NFTs within a single collection. It allows for a
  designated collection owner address to manage the creation of NFTs within this
  collection. The collection owner grants approval to or removes approval from
  other addresses governing their ability to mint NFTs from this collection.

  This contract is forked from the inherited OpenZeppelin dependency, and uses
  ideas from the original ERC-1155 reference implementation.

  January 15th, 2022.
*/
contract Super1155Lite is 
PermitControlds, ERC165Storage, IERC1155, IERC1155MetadataURI {

  using Address for address;

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
    A function that needs to be called immediately after deployment.
    Sets the owner of the newly deployed proxy.
  */
  function initialize() public initializer {
      __Ownable_init_unchained();
  }

  /**
    Returns the version number for this contract's interface.
  */
  function version() external pure 
  virtual override  returns (uint256) {

    return 1;
  }

  /**
    Return the item collection's metadata URI. This implementation returns the
    same URI for all tokens within the collection and relies on client-side
    ID substitution per https://eips.ethereum.org/EIPS/eip-1155#metadata. Per
    said specification, clients calling this function must replace the {id}
    substring with the actual token ID in hex, not prefixed by 0x, and padded
    to 64 characters in length.

    @return The metadata URI string of the item with ID `_itemId`.
  */
  function uri(uint256) external view 
  returns (string memory) {

    Super1155LiteBlueprint.Super1155LiteStateVariables
      storage b = Super1155LiteBlueprint.super1155LiteStateVariables();

    return b.metadataUri;
  }

  /**
    Allow the item collection owner or an approved manager to update the
    metadata URI of this collection. This implementation relies on a single URI
    for all items within the collection, and as such does not emit the standard
    URI event. Instead, we emit our own event to reflect changes in the URI.

    @param _uri The new URI to update to.
  */
  function setURI(string calldata _uri) external 
  virtual hasValidPermit(UNIVERSAL, Super1155LiteBlueprint.SET_URI) {

    Super1155LiteBlueprint.Super1155LiteStateVariables
      storage b = Super1155LiteBlueprint.super1155LiteStateVariables();

    require(!b.uriLocked,
      "Super1155: the collection URI has been permanently locked");
    string memory oldURI = b.metadataUri;
    b.metadataUri = _uri;
    emit ChangeURI(oldURI, _uri);
  }

  /**
    Allow approved manager to update the contract URI. At the end of update, we 
    emit our own event to reflect changes in the URI.

    @param _uri The new contract URI to update to.
  */
  function setContractUri(string calldata _uri) external 
  virtual hasValidPermit(UNIVERSAL, Super1155LiteBlueprint.SET_URI) {

    Super1155LiteBlueprint.Super1155LiteStateVariables
      storage b = Super1155LiteBlueprint.super1155LiteStateVariables();

    require(!b.contractUriLocked,
      "Super1155: the contract URI has been permanently locked");
    string memory oldContractUri = b.contractURI;
    b.contractURI = _uri;
    emit ChangeContractURI(oldContractUri, _uri);
  }

  /**
    Allow the item collection owner or an approved manager to update the proxy
    registry address handling delegated approval.

    @param _proxyRegistryAddress The address of the new proxy registry to
      update to.
  */
  function setProxyRegistry(address _proxyRegistryAddress) external 
  virtual hasValidPermit(UNIVERSAL, Super1155LiteBlueprint.SET_PROXY_REGISTRY) {

    Super1155LiteBlueprint.Super1155LiteStateVariables
      storage b = Super1155LiteBlueprint.super1155LiteStateVariables();

    address oldRegistry = b.proxyRegistryAddress;
    b.proxyRegistryAddress = _proxyRegistryAddress;
    emit ChangeProxyRegistry(oldRegistry, _proxyRegistryAddress);
  }

  /**
    Retrieve the balance of a particular token `_id` for a particular address
    `_owner`.

    @param _owner The owner to check for this token balance.
    @param _id The ID of the token to check for a balance.
    @return The amount of token `_id` owned by `_owner`.
  */
  function balanceOf(address _owner, uint256 _id) public view 
  virtual returns (uint256) {

    Super1155LiteBlueprint.Super1155LiteStateVariables
      storage b = Super1155LiteBlueprint.super1155LiteStateVariables();

    require(_owner != address(0),
      "ERC1155: balance query for the zero address");
    return b.balances[_id][_owner];
  }

  /**
    Retrieve in a single call the balances of some mulitple particular token
    `_ids` held by corresponding `_owners`.

    @param _owners The owners to check for token balances.
    @param _ids The IDs of tokens to check for balances.
    @return the amount of each token owned by each owner.
  */
  function balanceOfBatch(address[] calldata _owners, 
  uint256[] calldata _ids) external view 
  virtual returns (uint256[] memory) {

    require(_owners.length == _ids.length,
      "ERC1155: accounts and ids length mismatch");

    // Populate and return an array of balances.
    uint256[] memory batchBalances = new uint256[](_owners.length);
    for (uint256 i = 0; i < _owners.length; ++i) {
      batchBalances[i] = balanceOf(_owners[i], _ids[i]);
    }
    return batchBalances;
  }

  /**
    This function returns true if `_operator` is approved to transfer items
    owned by `_owner`. This approval check features an override to explicitly
    whitelist any addresses delegated in the proxy registry.

    @param _owner The owner of items to check for transfer ability.
    @param _operator The potential transferrer of `_owner`'s items.
    @return Whether `_operator` may transfer items owned by `_owner`.
  */
  function isApprovedForAll(address _owner, address _operator) public view 
  virtual returns (bool) {

    Super1155LiteBlueprint.Super1155LiteStateVariables
      storage b = Super1155LiteBlueprint.super1155LiteStateVariables();

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

    Super1155LiteBlueprint.Super1155LiteStateVariables
      storage b = Super1155LiteBlueprint.super1155LiteStateVariables();

    require(_msgSender() != _operator,
      "ERC1155: setting approval status for self");
    b.operatorApprovals[_msgSender()][_operator] = _approved;
    emit ApprovalForAll(_msgSender(), _operator, _approved);
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
    ERC-1155 dictates that any contract which wishes to receive ERC-1155 tokens
    must explicitly designate itself as such. This function checks for such
    designation to prevent undesirable token transfers.

    @param _operator The caller who triggers the token transfer.
    @param _from The address to transfer tokens from.
    @param _to The address to transfer tokens to.
    @param _id The specific token ID to transfer.
    @param _amount The amount of the specific `_id` to transfer.
    @param _data Additional call data to send with this transfer.
  */
  function _doSafeTransferAcceptanceCheck(address _operator, address _from,
  address _to, uint256 _id, uint256 _amount, bytes calldata _data) private {

    if (_to.isContract()) {
      try IERC1155Receiver(_to).onERC1155Received(_operator, _from, _id,
        _amount, _data) returns (bytes4 response) {
        if (response != IERC1155Receiver(_to).onERC1155Received.selector) {
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
  uint256[] memory _ids, uint256[] memory _amounts, bytes memory _data) public 
  virtual {

    Super1155LiteBlueprint.Super1155LiteStateVariables
      storage b = Super1155LiteBlueprint.super1155LiteStateVariables();
      
    require(_ids.length == _amounts.length,
      "ERC1155: ids and amounts length mismatch");
    require(_to != address(0),
      "ERC1155: transfer to the zero address");
    require(_from == _msgSender() || isApprovedForAll(_from, _msgSender()),
      "ERC1155: caller is not owner nor approved");

    // Validate transfer and perform all batch token sends.
    _beforeTokenTransfer(_msgSender(), _from, _to, _ids, _amounts, _data);
    for (uint256 i = 0; i < _ids.length; ++i) {

      // Update all specially-tracked balances.
      require(b.balances[_ids[i]][_from] >= _amounts[i], 
        "ERC1155: insufficient balance for transfer");
      b.balances[_ids[i]][_from] = b.balances[_ids[i]][_from] - _amounts[i];
      b.balances[_ids[i]][_to] = b.balances[_ids[i]][_to] + _amounts[i];
      b.totalBalances[_from] = b.totalBalances[_from] - _amounts[i];
      b.totalBalances[_to] = b.totalBalances[_to] + _amounts[i];
    }

    // Emit the transfer event and perform the safety check.
    emit TransferBatch(_msgSender(), _from, _to, _ids, _amounts);
    _doSafeBatchTransferAcceptanceCheck(_msgSender(), _from, _to, _ids,
      _amounts, _data);
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
  uint256 _amount, bytes calldata _data) external  
  virtual {

    safeBatchTransferFrom(_from, _to, _asSingletonArray(_id), 
      _asSingletonArray(_amount), _data);
  }

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

    if (_msgSender() == owner()) {
      return true;
    }
    if (hasRight(_msgSender(), UNIVERSAL, _right)) {
      return true;
    } 
    if (hasRight(_msgSender(), bytes32(_id), _right)) {
      return true;
    } 
    return false;
  }

  /**
    Mint a batch of tokens into existence and send them to the `_recipient`
    address.

    @param _recipient The address to receive all NFTs.
    @param _ids The item IDs for the new items to create.
    @param _amounts The amount of each corresponding item ID to create.
    @param _data Any associated data to use on items minted in this transaction.
  */
  function mintBatch(address _recipient, uint256[] calldata _ids,
  uint256[] calldata _amounts, bytes calldata _data)
  external virtual hasValidPermit(UNIVERSAL, Super1155LiteBlueprint.MINT) {

    Super1155LiteBlueprint.Super1155LiteStateVariables
      storage b = Super1155LiteBlueprint.super1155LiteStateVariables();

    require(_recipient != address(0),
      "ERC1155: mint to the zero address");
    require(_ids.length == _amounts.length,
      "ERC1155: ids and amounts length mismatch");

    // Validate and perform the mint.
    address operator = _msgSender();
    _beforeTokenTransfer(operator, address(0), _recipient, 
    _ids, _amounts, _data);

    // Loop through each of the batched IDs to update balances.
    for (uint256 i = 0; i < _ids.length; i++) {
      require(_hasItemRight(_ids[i], Super1155LiteBlueprint.MINT),
        "Super1155: you do not have the right to mint that item");

      // Update storage of special balances and circulating values.
      b.balances[_ids[i]][_recipient] = b.balances[_ids[i]][_recipient] + _amounts[i];
      b.totalBalances[_recipient] = b.totalBalances[_recipient] + _amounts[i];
      b.circulatingSupply[_ids[i]] = b.circulatingSupply[_ids[i]] + _amounts[i];
    }

    // Emit event and handle the safety check.
    emit TransferBatch(operator, address(0), _recipient, _ids, _amounts);
    _doSafeBatchTransferAcceptanceCheck(operator, address(0), _recipient, _ids,
      _amounts, _data);
  }

  /**
    Set the on-chain metadata attached to a specific token ID so long as the
    collection as a whole or the token specifically has not had metadata
    editing frozen.

    @param _id The ID of the token to set the `_metadata` for.
    @param _metadata The metadata string to store on-chain.
  */
  function setMetadata(uint256 _id, string memory _metadata) external {

    Super1155LiteBlueprint.Super1155LiteStateVariables
      storage b = Super1155LiteBlueprint.super1155LiteStateVariables();

    require(_hasItemRight(_id, Super1155LiteBlueprint.SET_METADATA), 
      "Super1155: you don't have rights to setMetadata");
    require(!b.uriLocked && !b.metadataFrozen[_id],
      "Super1155: you cannot edit this metadata because it is frozen");
    string memory oldMetadata = b.metadata[_id];
    b.metadata[_id] = _metadata;
    emit MetadataChanged(_msgSender(), _id, oldMetadata, _metadata);
  }

  /**
    Allow the item collection owner or an associated manager to forever lock the
    metadata URI on the entire collection to future changes.
  */
  function lockURI() external
  hasValidPermit(UNIVERSAL, Super1155LiteBlueprint.LOCK_URI) {

    Super1155LiteBlueprint.Super1155LiteStateVariables
      storage b = Super1155LiteBlueprint.super1155LiteStateVariables();

    b.uriLocked = true;
    emit PermanentURI(b.metadataUri, 2 ** 256 - 1);
  }

  
  /** 
    Allow the associated manager to forever lock the contract URI to future 
    changes
  */
  function lockContractUri() external
  hasValidPermit(UNIVERSAL, Super1155LiteBlueprint.LOCK_URI) {

    Super1155LiteBlueprint.Super1155LiteStateVariables
      storage b = Super1155LiteBlueprint.super1155LiteStateVariables();

    b.contractUriLocked = true;
    emit PermanentContractURI(b.contractURI, 2 ** 256 - 1);   
  }

  /**
    Allow the item collection owner or an associated manager to forever lock the
    metadata URI on an item to future changes.

    @param _uri The value of the URI to lock for `_id`.
    @param _id The token ID to lock a metadata URI value into.
  */
  function lockURI(string calldata _uri, uint256 _id) external {

    Super1155LiteBlueprint.Super1155LiteStateVariables
      storage b = Super1155LiteBlueprint.super1155LiteStateVariables();
    
    require(_hasItemRight(_id, Super1155LiteBlueprint.LOCK_ITEM_URI), 
      "Super1155: you don't have rights to lock URI");
    b.metadataFrozen[_id] = true;
    emit PermanentURI(_uri, _id);
  }

  /**
    Allow the item collection owner or an associated manager to forever lock
    this contract to further item minting.
  */
  function lock() external 
  virtual hasValidPermit(UNIVERSAL, Super1155LiteBlueprint.LOCK_CREATION) {

    Super1155LiteBlueprint.Super1155LiteStateVariables
      storage b = Super1155LiteBlueprint.super1155LiteStateVariables();

    b.locked = true;
    emit CollectionLocked(_msgSender());
  }
}