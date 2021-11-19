// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Storage.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "../../utils/Utils.sol";
import "../../access/PermitControl.sol";
import "../../proxy/StubProxyRegistry.sol";
import "./Super721IMXLock.sol";

/**
  @title An ERC-721 item creation contract.
  @author Tim Clancy
  @author 0xthrpw
  @author Qazawat Zirak
  This contract represents the NFTs within a single collection. It allows for a
  designated collection owner address to manage the creation of NFTs within this
  collection. The collection owner grants approval to or removes approval from
  other addresses governing their ability to mint NFTs from this collection.
  This contract is forked from the inherited OpenZeppelin dependency, and uses
  ideas inherited from the Super721 reference implementation.
  August 4th, 2021.
*/
contract Super721IMX is PermitControl, ERC165Storage, IERC721 {
  using Address for address;
  using Strings for string;
  using EnumerableSet for EnumerableSet.UintSet;
  using EnumerableMap for EnumerableMap.UintToAddressMap;

  /// The public identifier for the right to set this contract's metadata URI.
  bytes32 public constant SET_URI = keccak256("SET_URI");

  /// The public identifier for the right to set this contract's proxy registry.
  bytes32 public constant SET_PROXY_REGISTRY = keccak256("SET_PROXY_REGISTRY");

  /// The public identifier for the right to configure item groups.
  bytes32 public constant CONFIGURE_GROUP = keccak256("CONFIGURE_GROUP");

  /// The public identifier for the right to mint items.
  bytes32 public constant MINT = keccak256("MINT");

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

  /*
   *     bytes4(keccak256('balanceOf(address)')) == 0x70a08231
   *     bytes4(keccak256('ownerOf(uint256)')) == 0x6352211e
   *     bytes4(keccak256('approve(address,uint256)')) == 0x095ea7b3
   *     bytes4(keccak256('getApproved(uint256)')) == 0x081812fc
   *     bytes4(keccak256('setApprovalForAll(address,bool)')) == 0xa22cb465
   *     bytes4(keccak256('isApprovedForAll(address,address)')) == 0xe985e9c5
   *     bytes4(keccak256('transferFrom(address,address,uint256)')) == 0x23b872dd
   *     bytes4(keccak256('safeTransferFrom(address,address,uint256)')) == 0x42842e0e
   *     bytes4(keccak256('safeTransferFrom(address,address,uint256,bytes)')) == 0xb88d4fde
   *
   *     => 0x70a08231 ^ 0x6352211e ^ 0x095ea7b3 ^ 0x081812fc ^
   *        0xa22cb465 ^ 0xe985e9c ^ 0x23b872dd ^ 0x42842e0e ^ 0xb88d4fde == 0x80ac58cd
   */
  bytes4 private constant _INTERFACE_ID_ERC721 = 0x80ac58cd;

  /*
   *     bytes4(keccak256('name()')) == 0x06fdde03
   *     bytes4(keccak256('symbol()')) == 0x95d89b41
   *     bytes4(keccak256('tokenURI(uint256)')) == 0xc87b56dd
   *
   *     => 0x06fdde03 ^ 0x95d89b41 ^ 0xc87b56dd == 0x5b5e139f
   */
  bytes4 private constant _INTERFACE_ID_ERC721_METADATA = 0x5b5e139f;

  /*
   *     bytes4(keccak256('totalSupply()')) == 0x18160ddd
   *     bytes4(keccak256('tokenOfOwnerByIndex(address,uint256)')) == 0x2f745c59
   *     bytes4(keccak256('tokenByIndex(uint256)')) == 0x4f6ccce7
   *
   *     => 0x18160ddd ^ 0x2f745c59 ^ 0x4f6ccce7 == 0x780e9d63
   */
  bytes4 private constant _INTERFACE_ID_ERC721_ENUMERABLE = 0x780e9d63;
  /// @dev Supply the magic number for the required ERC-721 interface.

  /// @dev A mask for isolating an item's group ID.
  uint256 private constant GROUP_MASK = uint256(type(uint128).max) << 128;

  /// The public name of this contract.
  string public name;

  string public symbol;

  /**
    The ERC-721 URI for tracking item metadata, supporting {id} substitution.
    For example: https://token-cdn-domain/{id}.json. See the ERC-721 spec for
    more details: https://eips.ethereum.org/EIPS/eip-721#metadata.
  */
  string public metadataUri;

  /// The URI for the storefront-level metadata of contract
  string public contractURI;

  /// A proxy registry address for supporting automatic delegated approval.
  address public proxyRegistryAddress;

  /// The address of the IMX core contract for L2 minting.
  address public imxCoreAddress;

  /// The address of the global lock for all 721IMX instances.
  address public super721IMXLock;

  /// @dev A mapping from each token ID to per-address balances.
  mapping (uint256 => mapping(address => uint256)) public balances;

  /// A mapping from each group ID to per-address balances.
  mapping (uint256 => mapping(address => uint256)) public groupBalances;

  /// A mapping from each address to a collection-wide balance.
  mapping(address => uint256) public totalBalances;

  // Mapping from holder address to their (enumerable) set of owned tokens
  mapping (address => EnumerableSet.UintSet) private _holderTokens;

  // Enumerable mapping from token ids to their owners
  EnumerableMap.UintToAddressMap private _tokenOwners;
  /**
    @dev This is a mapping from each address to per-address operator approvals.
    Operators are those addresses that have been approved to transfer tokens on
    behalf of the approver. Transferring tokens includes the right to burn
    tokens.
  */
  mapping (address => mapping(address => bool)) private operatorApprovals;

  // Mapping from token ID to approved address
  mapping (uint256 => address) private _tokenApprovals;

  /**
    This enumeration lists the various supply types that each item group may
    use. In general, the administrator of this collection or those permissioned
    to do so may move from a more-permissive supply type to a less-permissive.
    For example: an uncapped or flexible supply type may be converted to a
    capped supply type. A capped supply type may not be uncapped later, however.
    @param Capped There exists a fixed cap on the size of the item group. The
      cap is set by `supplyData`.
    @param Uncapped There is no cap on the size of the item group. The value of
      `supplyData` cannot be set below the current circulating supply but is
      otherwise ignored.
    @param Flexible There is a cap which can be raised or lowered (down to
      circulating supply) freely. The value of `supplyData` cannot be set below
      the current circulating supply and determines the cap.
  */
  enum SupplyType {
    Capped,
    Uncapped,
    Flexible
  }

  /**
    This enumeration lists the various burn types that each item group may use.
    These are static once chosen.
    @param None The items in this group may not be burnt. The value of
      `burnData` is ignored.
    @param Burnable The items in this group may be burnt. The value of
      `burnData` is the maximum that may be burnt.
    @param Replenishable The items in this group, once burnt, may be reminted by
      the owner. The value of `burnData` is ignored.
  */
  enum BurnType {
    None,
    Burnable,
    Replenishable
  }

  /**
    This struct is a source of mapping-free input to the `configureGroup`
    function. It defines the settings for a particular item group.
    @param name A name for the item group.
    @param supplyType The supply type for this group of items.
    @param supplyData An optional integer used by some `supplyType` values.
    @param burnType The type of burning permitted by this item group.
    @param burnData An optional integer used by some `burnType` values.
  */
  struct ItemGroupInput {
    string name;
    SupplyType supplyType;
    uint256 supplyData;
    BurnType burnType;
    uint256 burnData;
  }

  /**
    This struct defines the settings for a particular item group and is tracked
    in storage.
    @param initialized Whether or not this `ItemGroup` has been initialized.
    @param name A name for the item group.
    @param supplyType The supply type for this group of items.
    @param supplyData An optional integer used by some `supplyType` values.
    @param burnType The type of burning permitted by this item group.
    @param burnData An optional integer used by some `burnType` values.
    @param circulatingSupply The number of individual items within this group in
      circulation.
    @param mintCount The number of times items in this group have been minted.
    @param burnCount The number of times items in this group have been burnt.
  */
  struct ItemGroup {
    bool initialized;
    string name;
    SupplyType supplyType;
    uint256 supplyData;
    BurnType burnType;
    uint256 burnData;
    uint256 circulatingSupply;
    uint256 mintCount;
    uint256 burnCount;
  }

  /// A mapping of data for each item group.
  mapping (uint256 => ItemGroup) public itemGroups;

  /// A mapping of circulating supplies for each individual token.
  mapping (uint256 => uint256) public circulatingSupply;

  /// A mapping of the number of times each individual token has been minted.
  mapping (uint256 => uint256) public mintCount;

  /// A mapping of the number of times each individual token has been burnt.
  mapping (uint256 => uint256) public burnCount;

  /**
    A mapping of token ID to a boolean representing whether the item's metadata
    has been explicitly frozen via a call to `lockURI(string calldata _uri,
    uint256 _id)`. Do note that it is possible for an item's mapping here to be
    false while still having frozen metadata if the item collection as a whole
    has had its `uriLocked` value set to true.
  */
  mapping (uint256 => bool) public metadataFrozen;

  /**
    A public mapping of optional on-chain metadata for each token ID. A token's
    on-chain metadata is unable to be changed if the item's metadata URI has
    been permanently fixed or if the collection's metadata URI as a whole has
    been frozen.
  */
  mapping (uint256 => string) public blueprints;

  /// Whether or not the metadata URI has been locked to future changes.
  bool public uriLocked;

  /// Whether or not the metadata URI has been locked to future changes.
  bool public contractUriLocked;

  /// Whether or not the item collection has been locked to all further minting.
  bool public locked;

  /**
    An event that gets emitted when the metadata collection URI is changed.
    @param oldURI The old metadata URI.
    @param newURI The new metadata URI.
  */
  event ChangeURI(string indexed oldURI, string indexed newURI);

  /**
    An event that gets emitted when the contract URI is changed.
    @param oldURI The old metadata URI.
    @param newURI The new metadata URI.
  */
  event ChangeContractURI(string indexed oldURI, string indexed newURI);

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
    ItemGroupInput indexed newGroup);

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
    An event that indicates we have set a permanent contract URI.
    @param _value The value of the permanent contract URI.
    @param _id The token ID associated with the permanent contract value.
  */
  event PermanentContractURI(string _value, uint256 indexed _id);

  /**
    A modifier which allows only the super-administrative owner or addresses
    with a specified valid right to perform a call on some specific item. Rights
    can be applied to the universal circumstance, the item-group-level
    circumstance, or to the circumstance of the item ID itself.
    @param _id The item ID on which we check for the validity of the specified
      `right`.
    @param _right The right to validate for the calling address. It must be
      non-expired and exist within the specified `_itemId`.
  */
  modifier hasItemRight(uint256 _id, bytes32 _right) {
    uint256 groupId = (_id & GROUP_MASK) >> 128;
    if (_msgSender() == owner()) {
      _;
    } else if (hasRight(_msgSender(), UNIVERSAL, _right)) {
      _;
    } else if (hasRight(_msgSender(), bytes32(groupId), _right)) {
      _;
    } else if (hasRight(_msgSender(), bytes32(_id), _right)) {
      _;
    } else {
      revert("Super721::hasItemRight: _msgSender does not have the right to perform that action");
    }
  }

  /**
    Construct a new ERC-721 item collection.
    @param _owner The address of the administrator governing this collection.
    @param _name The name to assign to this item collection contract.
    @param _metadataURI The metadata URI to perform later token ID substitution with.
    @param _contractURI The contract URI. 
    @param _proxyRegistryAddress The address of a proxy registry contract.
    @param _imxCoreAddress The address of the IMX core contract for L2 minting.
  */
  constructor(address _owner, string memory _name, string memory _symbol, string memory _metadataURI,
    string memory _contractURI, address _proxyRegistryAddress, address _imxCoreAddress, address _super721IMXLock) {

    // Do not perform a redundant ownership transfer if the deployer should
    // remain as the owner of the collection.
    if (_owner != owner()) {
      transferOwnership(_owner);
    }

    // Register 721 interfaces
    _registerInterface(_INTERFACE_ID_ERC721);
    _registerInterface(_INTERFACE_ID_ERC721_METADATA);
    _registerInterface(_INTERFACE_ID_ERC721_ENUMERABLE);

    // Continue initialization.
    name = _name;
    symbol = _symbol;
    metadataUri = _metadataURI;
    contractURI = _contractURI;
    proxyRegistryAddress = _proxyRegistryAddress;
    imxCoreAddress = _imxCoreAddress;
    super721IMXLock = _super721IMXLock;
  }
  /**
  */
  function ownerOf(uint256 tokenId) public view override returns (address) {
      return _tokenOwners.get(tokenId, "Super721::ownerOf: owner query for nonexistent token");
  }

  /**
   * @dev See {IERC721-approve}.
   */
  function approve(address to, uint256 tokenId) public virtual override {
      address owner = ownerOf(tokenId);
      require(to != owner, "Super721::approve: approval to current owner");

      require(_msgSender() == owner || isApprovedForAll(owner, _msgSender()),
          "Super721::approve: approve caller is not owner nor approved for all"
      );

      _tokenApprovals[tokenId] = to;
      emit Approval(ownerOf(tokenId), to, tokenId);
  }
  /**
    Return a version number for this contract's interface.
  */
  function version() external virtual pure override returns (uint256) {
    return 1;
  }

  /**
    Return the item collection's metadata URI. This implementation returns the
    same URI for all tokens within the collection and relies on client-side
    ID substitution per https://eips.ethereum.org/EIPS/eip-721#metadata. Per
    said specification, clients calling this function must replace the {id}
    substring with the actual token ID in hex, not prefixed by 0x, and padded
    to 64 characters in length.
    @return The metadata URI string of the item with ID `_itemId`.
  */
  function tokenURI(uint256 id) external view returns (string memory) {
    Strings.Slice memory slice1 = metadataUri.toSlice();
    Strings.Slice memory slice2 = metadataUri.toSlice();
    string memory tokenFirst = "{";
    string memory tokenLast = "}";
    Strings.Slice memory firstSlice = tokenFirst.toSlice();
    Strings.Slice memory secondSlice = tokenLast.toSlice();
    firstSlice = Strings.beforeMatch(slice1, firstSlice);
    secondSlice = Strings.afterMatch(slice2, secondSlice);
    string memory first = Strings.toString(firstSlice);
    string memory second = Strings.toString(secondSlice);
    string memory result = string(abi.encodePacked(first, Strings.uint2str(id), second));
    return result;
  }

  /**
    Allow the item collection owner or an approved manager to update the
    metadata URI of this collection. This implementation relies on a single URI
    for all items within the collection, and as such does not emit the standard
    URI event. Instead, we emit our own event to reflect changes in the URI.
    @param _uri The new URI to update to.
  */
  function setURI(string calldata _uri) external virtual
    hasValidPermit(UNIVERSAL, SET_URI) {
    require(!uriLocked,
      "Super721::setURI: the collection URI has been permanently locked");
    string memory oldURI = metadataUri;
    metadataUri = _uri;
    emit ChangeURI(oldURI, _uri);
  }

  /**
    Allow approved manager to update the contract URI. At the end of update, we 
    emit our own event to reflect changes in the URI.

    @param _uri The new contract URI to update to.
   */
  function setContractURI(string calldata _uri) external virtual
    hasValidPermit(UNIVERSAL, SET_URI) {
      require(!contractUriLocked,
        "Super721::setContractURI: the contract URI has been permanently locked");
      string memory oldContractUri = contractURI;
      contractURI = _uri;
      emit ChangeContractURI(oldContractUri, _uri);
  }
  // TODO: change all require messages

  /**
    Allow the item collection owner or an approved manager to update the proxy
    registry address handling delegated approval.
    @param _proxyRegistryAddress The address of the new proxy registry to
      update to.
  */
  function setProxyRegistry(address _proxyRegistryAddress) external virtual
    hasValidPermit(UNIVERSAL, SET_PROXY_REGISTRY) {
    address oldRegistry = proxyRegistryAddress;
    proxyRegistryAddress = _proxyRegistryAddress;
    emit ChangeProxyRegistry(oldRegistry, _proxyRegistryAddress);
  }

  /**
    Retrieve the balance of a particular token `_id` for a particular address
    `_owner`.
    @param _owner The owner to check for this token balance.
    @param _id The ID of the token to check for a balance.
    @return The amount of token `_id` owned by `_owner`.
  */

  function balanceOfGroup(address _owner, uint256 _id) public view virtual
  returns (uint256) {
    require(_owner != address(0),
      "Super721::balanceOf: balance query for the zero address");
    return balances[_id][_owner];
  }

  function balanceOf(address _owner) public override view virtual
  returns (uint256) {
    require(_owner != address(0),
      "Super721::balanceOf: balance query for the zero address");
    return totalBalances[_owner];
  }

  /**
    Retrieve in a single call the balances of some mulitple particular token
    `_ids` held by corresponding `_owners`.
    @param _owners The owners to check for token balances.
    @param _ids The IDs of tokens to check for balances.
    @return the amount of each token owned by each owner.
  */
  function balanceOfBatch(address[] calldata _owners, uint256[] calldata _ids)
    external view virtual returns (uint256[] memory) {
    require(_owners.length == _ids.length,
      "Super721::balanceOfBatch: accounts and ids length mismatch");

    // Populate and return an array of balances.
    uint256[] memory batchBalances = new uint256[](_owners.length);
    for (uint256 i = 0; i < _owners.length; ++i) {
      batchBalances[i] = balanceOfGroup(_owners[i], _ids[i]);
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
  function isApprovedForAll(address _owner, address _operator) public override
    view virtual returns (bool) {
    StubProxyRegistry proxyRegistry = StubProxyRegistry(proxyRegistryAddress);
    if (address(proxyRegistry.proxies(_owner)) == _operator) {
      return true;
    }

    // We did not find an explicit whitelist in the proxy registry.
    return operatorApprovals[_owner][_operator];
  }

  /**
    Enable or disable approval for a third party `_operator` address to manage
    (transfer or burn) all of the caller's tokens.
    @param _operator The address to grant management rights over all of the
      caller's tokens.
    @param _approved The status of the `_operator`'s approval for the caller.
  */
  function setApprovalForAll(address _operator, bool _approved) external
    override virtual {
    require(_msgSender() != _operator,
      "Super721::balanceOf: setting approval status for self");
    operatorApprovals[_msgSender()][_operator] = _approved;
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
    ERC-721 dictates that any contract which wishes to receive ERC-721 tokens
    must explicitly designate itself as such. This function checks for such
    designation to prevent undesirable token transfers.
    @param _operator The caller who triggers the token transfer.
    @param _from The address to transfer tokens from.
    @param _to The address to transfer tokens to.
    @param _id The specific token ID to transfer.
    @param _data Additional call data to send with this transfer.
  */
  function _doSafeTransferAcceptanceCheck(address _operator, address _from,
    address _to, uint256 _id, bytes memory _data) private {
    if (_to.isContract()) {
      try IERC721Receiver(_to).onERC721Received(_operator, _from, _id,
        _data) returns (bytes4 response) {
        if (response != IERC721Receiver(_to).onERC721Received.selector) {
          revert("Super721::_doSafeTransferAcceptanceCheck: ERC721Receiver rejected tokens");
        }
      } catch Error(string memory reason) {
        revert(reason);
      } catch {
        revert("Super721::_doSafeTransferAcceptanceCheck: transfer to non ERC721Receiver implementer");
      }
    }
  }

  /**
    Transfer on behalf of a caller or one of their authorized token managers
    items from one address to another.
    @param _from The address to transfer tokens from.
    @param _to The address to transfer tokens to.
    @param _id The specific token ID to transfer.
    @param _data Additional call data to send with this transfer.
  */

  /**
   * @dev See {IERC721-safeTransferFrom}.
   */
  function safeTransferFrom(address from, address to, uint256 tokenId) public virtual override {
      _safeTransferFrom(from, to, tokenId, bytes(""));
  }

  function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data)
  public virtual override {
      _safeTransferFrom(from, to, tokenId, data);
  }

  function _safeTransferFrom(address _from, address _to, uint256 _id,
    bytes memory _data) internal  virtual {
    require(_to != address(0),
      "Super721::_safeTransferFrom : transfer to the zero address");
    require(_from == _msgSender() || isApprovedForAll(_from, _msgSender()),
      "Super721::_safeTransferFrom : caller is not owner nor approved");

    // Validate transfer safety and send tokens away.
    address operator = _msgSender();
    _beforeTokenTransfer(operator, _from, _to, _asSingletonArray(_id),
    _asSingletonArray(1), _data);

    // Retrieve the item's group ID.
    uint256 shiftedGroupId = (_id & GROUP_MASK);
    uint256 groupId = shiftedGroupId >> 128;

    // Update all specially-tracked group-specific balances.
    require(balances[_id][_from] >= 1, "Super721::_safeTransferFrom: insufficient balance for transfer");
    balances[_id][_from] = balances[_id][_from] - 1;
    balances[_id][_to] = balances[_id][_to] + 1;
    groupBalances[groupId][_from] = groupBalances[groupId][_from] - 1;
    groupBalances[groupId][_to] = groupBalances[groupId][_to] + 1;
    totalBalances[_from] = totalBalances[_from] - 1;
    totalBalances[_to] = totalBalances[_to] + 1;

    _holderTokens[_from].remove(_id);
    _holderTokens[_to].add(_id);

    _tokenOwners.set(_id, _to);

    // Emit the transfer event and perform the safety check.
    emit Transfer(_from, _to, _id);
    _doSafeTransferAcceptanceCheck(operator, _from, _to, _id, _data);
  }

  /**
    Transfer on behalf of a caller or one of their authorized token managers
    items from one address to another.
    @param _from The address to transfer tokens from.
    @param _to The address to transfer tokens to.
    @param _ids The specific token IDs to transfer.
    @param _data Additional call data to send with this transfer.
  */

  function safeBatchTransferFrom(address _from, address _to,
    uint256[] memory _ids, bytes memory _data)
    external virtual {
    require(_to != address(0),
      "Super721::safeBatchTransferFrom: transfer to the zero address");
    require(_from == _msgSender() || isApprovedForAll(_from, _msgSender()),
      "Super721::safeBatchTransferFrom: caller is not owner nor approved");

    // Validate transfer and perform all batch token sends.
    _beforeTokenTransfer(_msgSender(), _from, _to, _ids, _asSingletonArray(1), _data);
    for (uint256 i = 0; i < _ids.length; ++i) {

      // Retrieve the item's group ID.
      uint256 groupId = (_ids[i] & GROUP_MASK) >> 128;

      // Update all specially-tracked group-specific balances.
      require(balances[_ids[i]][_from] >= 1, "Super721::safeBatchTransferFrom: insufficient balance for transfer");
      balances[_ids[i]][_from] = balances[_ids[i]][_from] - 1;
      balances[_ids[i]][_to] = balances[_ids[i]][_to] + 1;
      groupBalances[groupId][_from] = groupBalances[groupId][_from] - 1;
      groupBalances[groupId][_to] = groupBalances[groupId][_to] + 1;
      totalBalances[_from] = totalBalances[_from] - 1;
      totalBalances[_to] = totalBalances[_to] + 1;

      // Emit the transfer event and perform the safety check.
      emit Transfer(_from, _to, _ids[i]);
      _doSafeTransferAcceptanceCheck(_msgSender(), _from, _to, _ids[i], _data);
    }
  }

  /**
    Create a new NFT item group or configure an existing one. NFTs within a
    group share a group ID in the upper 128-bits of their full item ID.
    Within a group NFTs can be distinguished for the purposes of serializing
    issue numbers.
    @param _groupId The ID of the item group to create or configure.
    @param _data The `ItemGroup` data input.
  */
  function configureGroup(uint256 _groupId, ItemGroupInput memory _data)
    external virtual hasItemRight(_groupId, CONFIGURE_GROUP) {
    require(_groupId != 0,
      "Super721::configureGroup: group ID 0 is invalid");

    // If the collection is not locked, we may add a new item group.
    if (!itemGroups[_groupId].initialized) {
      require(!locked,
        "Super721::configureGroup: the collection is locked so groups cannot be created");
      itemGroups[_groupId] = ItemGroup({
        initialized: true,
        name: _data.name,
        supplyType: _data.supplyType,
        supplyData: _data.supplyData,
        burnType: _data.burnType,
        burnData: _data.burnData,
        circulatingSupply: 0,
        mintCount: 0,
        burnCount: 0
      });

    // Edit an existing item group. The name may always be updated.
    } else {
      itemGroups[_groupId].name = _data.name;

      // A capped supply type may not change.
      // It may also not have its cap increased.
      if (itemGroups[_groupId].supplyType == SupplyType.Capped) {
        require(_data.supplyType == SupplyType.Capped,
          "Super721::configureGroup: you may not uncap a capped supply type");
        require(_data.supplyData <= itemGroups[_groupId].supplyData,
          "Super721::configureGroup: you may not increase the supply of a capped type");

      // The flexible and uncapped types may freely change.
      } else {
        itemGroups[_groupId].supplyType = _data.supplyType;
      }

      // Item supply data may not be reduced below the circulating supply.
      require(_data.supplyData >= itemGroups[_groupId].circulatingSupply,
        "Super721::configureGroup: you may not decrease supply below the circulating amount");
      itemGroups[_groupId].supplyData = _data.supplyData;
      // do we want burnType to be updateable?
    }

    // Emit the configuration event.
    emit ItemGroupConfigured(_msgSender(), _groupId, _data);
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
    uint256 groupId = (_id & GROUP_MASK) >> 128;
    if (_msgSender() == owner()) {
      return true;
    } else if (hasRight(_msgSender(), UNIVERSAL, _right)) {
      return true;
    } else if (hasRight(_msgSender(), bytes32(groupId), _right)) {
      return true;
    } else if (hasRight(_msgSender(), bytes32(_id), _right)) {
      return true;
    } else {
      return false;
    }
  }

  /**
    This is a private helper function to verify, according to all of our various
    minting and burning rules, whether it would be valid to mint a particular
    item `_id`.
    @param _id The ID of the item to check for minting validity.
    @return The ID of the item that should be minted.
  */
  function _mintChecker(uint256 _id) private view returns (uint256) {

    // Retrieve the item's group ID.
    uint256 shiftedGroupId = (_id & GROUP_MASK);
    uint256 groupId = shiftedGroupId >> 128;
    require(itemGroups[groupId].initialized,
      "Super721::_mintChecker: you cannot mint a non-existent item group");

    // If false, owned by address (or NULL_ADDRESS i.e, was burnable)
    // If true, never minted, (or was removed i.e, was replenishable)
    require(!_tokenOwners.contains(_id),
      "Super721::_mintChecker: token already exists");

    // If we can replenish burnt items, then only our currently-circulating
    // supply matters. Otherwise, historic mints are what determine the cap.
    uint256 currentGroupSupply = itemGroups[groupId].mintCount;
    uint256 currentItemSupply = mintCount[_id];
    if (itemGroups[groupId].burnType == BurnType.Replenishable) {
      currentGroupSupply = itemGroups[groupId].circulatingSupply;
      currentItemSupply = circulatingSupply[_id];
    }

    // If we are subject to a cap on group size, ensure we don't exceed it.
    if (itemGroups[groupId].supplyType != SupplyType.Uncapped) {
      require(currentGroupSupply + 1 <= itemGroups[groupId].supplyData,
        "Super721::_mintChecker: you cannot mint a group beyond its cap");
    }

    return _id;
  }

  /**
    Mint a batch of tokens into existence and send them to the `_recipient`
    address. In order to mint an item, its item group must first have been
    created. Minting an item must obey both the fungibility and size cap of its
    group.
    @param _recipient The address to receive all NFTs within the newly-minted
      group.
    @param _ids The item IDs for the new items to create.
    @param _data Any associated data to use on items minted in this transaction.
  */

  function mintBatch(address _recipient, uint256[] memory _ids,
    bytes memory _data)
    public virtual {
    require(_recipient != address(0));

    // Validate and perform the mint.
    address operator = _msgSender();
    _beforeTokenTransfer(operator, address(0), _recipient, _ids, _asSingletonArray(1),
      _data);

    // Loop through each of the batched IDs to update storage of special
    // balances and circulation balances.
    for (uint256 i = 0; i < _ids.length; i++) {
      require(_hasItemRight(_ids[i], MINT),
        "Super721::mintBatch: you do not have the right to mint that item");

      // Retrieve the group ID from the given item `_id` and check mint.
      uint256 shiftedGroupId = (_ids[i] & GROUP_MASK);
      uint256 groupId = shiftedGroupId >> 128;
      uint256 mintedItemId = _mintChecker(_ids[i]);

      // Update storage of special balances and circulating values.
      balances[mintedItemId][_recipient] = balances[mintedItemId][_recipient] + 1;
      groupBalances[groupId][_recipient] = groupBalances[groupId][_recipient] + 1;
      totalBalances[_recipient] = totalBalances[_recipient] + 1;
      mintCount[mintedItemId] = mintCount[mintedItemId] + 1;
      circulatingSupply[mintedItemId] = circulatingSupply[mintedItemId] + 1;
      itemGroups[groupId].mintCount = itemGroups[groupId].mintCount + 1;
      itemGroups[groupId].circulatingSupply =
        itemGroups[groupId].circulatingSupply + 1;

      //_holderTokens[address(0)].remove(_ids[i]);
      _holderTokens[_recipient].add(_ids[i]);

      _tokenOwners.set(_ids[i], _recipient);
      
      // Emit event and handle the safety check.
      emit Transfer(address(0), _recipient, _ids[i]);
      _doSafeTransferAcceptanceCheck(operator, address(0), _recipient, _ids[i], _data);
    }
  }

  /**
    The special, IMX-privileged minting function for centralized L2 support.
  */
  function mintFor(address _to, uint256 quantity, bytes calldata _blueprint) external {
    require(!Super721IMXLock(super721IMXLock).mintForLocked());
    require(_msgSender() == imxCoreAddress);
    require(quantity == 1);
    (uint256 id, string memory metadata )= split(_blueprint);
    blueprints[id] = metadata;
    uint256[] memory ids = _asSingletonArray(id);
    mintBatch(_to, ids, _blueprint);
  }

    function split(bytes calldata blob)
        internal
        pure
        returns (uint256, string memory)
    {
        int256 index = indexOf(blob, ":", 0);
        require(index >= 0, "Separator must exist");
        // Trim the { and } from the parameters
        uint256 tokenID = toUint(blob[1:uint256(index) - 1]);
        uint256 blueprintLength = blob.length - uint256(index) - 3;
        if (blueprintLength == 0) {
            return (tokenID, string(""));
        }
        string calldata blueprint = string(blob[uint256(index) + 2:blob.length - 1]);
        return (tokenID, blueprint);
    }

    function indexOf(
        bytes memory _base,
        string memory _value,
        uint256 _offset
    ) internal pure returns (int256) {
        bytes memory _valueBytes = bytes(_value);

        assert(_valueBytes.length == 1);

        for (uint256 i = _offset; i < _base.length; i++) {
            if (_base[i] == _valueBytes[0]) {
                return int256(i);
            }
        }

        return -1;
    }
    
    function toUint(bytes memory b) internal pure returns (uint256) {
        uint256 result = 0;
        for (uint256 i = 0; i < b.length; i++) {
            uint256 val = uint256(uint8(b[i]));
            if (val >= 48 && val <= 57) {
                result = result * 10 + (val - 48);
            }
        }
        return result;
    }
  /**
    This is a private helper function to verify, according to all of our various
    minting and burning rules, whether it would be valid to burn some `_amount`
    of a particular item `_id`.
    @param _id The ID of the item to check for burning validity.
    @return The ID of the item that should have `_amount` burnt for it.
  */
  function _burnChecker(uint256 _id) private view
    returns (uint256) {

    // Retrieve the item's group ID.
    uint256 shiftedGroupId = (_id & GROUP_MASK);
    uint256 groupId = shiftedGroupId >> 128;
    require(itemGroups[groupId].initialized,
      "Super721::_burnChecker: you cannot burn a non-existent item group");

    // If the item group is non-burnable, then revert.
    if (itemGroups[groupId].burnType == BurnType.None) {
      revert("Super721::_burnChecker: you cannot burn a non-burnable item group");
    }

    // If we can burn items, then we must verify that we do not exceed the cap.
    else if (itemGroups[groupId].burnType == BurnType.Burnable) {
      require(itemGroups[groupId].burnCount + 1
        <= itemGroups[groupId].burnData,
        "Super721::_burnChecker you may not exceed the burn limit on this item group");
    }

    // If the item is replenishable, then ignore checks

    uint256 burntItemId = _id;

    return burntItemId;
  }

  /**
    This function allows an address to destroy some of its items.
    @param _burner The address whose item is burning.
    @param _id The item ID to burn.
    @param _amount The amount of the corresponding item ID to burn.
  */
  // function burn(address _burner, uint256 _id, uint256 _amount)
  //   external virtual hasItemRight(_id, BURN) {
  //   require(_burner != address(0),
  //     "Super721::burn: burn from the zero address");
  //
  //   // Retrieve the group ID from the given item `_id` and check burn validity.
  //   uint256 shiftedGroupId = (_id & GROUP_MASK);
  //   uint256 groupId = shiftedGroupId >> 128;
  //   uint256 burntItemId = _burnChecker(_id, _amount);
  //
  //   // Validate and perform the burn.
  //   address operator = _msgSender();
  //   _beforeTokenTransfer(operator, _burner, address(0),
  //     _asSingletonArray(burntItemId), _asSingletonArray(_amount), "");
  //
  //   // Update storage of special balances and circulating values.
  //   balances[burntItemId][_burner] = balances[burntItemId][_burner]
  //     .sub(_amount,
  //     "Super721::burn: burn amount exceeds balance");
  //   groupBalances[groupId][_burner] = groupBalances[groupId][_burner]
  //     .sub(_amount);
  //   totalBalances[_burner] = totalBalances[_burner].sub(_amount);
  //   burnCount[burntItemId] = burnCount[burntItemId].add(_amount);
  //   circulatingSupply[burntItemId] = circulatingSupply[burntItemId]
  //     .sub(_amount);
  //   itemGroups[groupId].burnCount = itemGroups[groupId].burnCount.add(_amount);
  //   itemGroups[groupId].circulatingSupply =
  //     itemGroups[groupId].circulatingSupply.sub(_amount);
  //
  //   // Emit the burn event.
  //   emit Transfer(operator, address(0), _id);
  // }

  /**
    This function allows an address to destroy multiple different items in a
    single call.
    @param _burner The address whose items are burning.
    @param _ids The item IDs to burn.
  */
  function burnBatch(address _burner, uint256[] memory _ids) external virtual {
    require(_burner != address(0));

    // Validate and perform the burn.
    address operator = _msgSender();
    _beforeTokenTransfer(operator, _burner, address(0), _ids, _asSingletonArray(1), "");

    // Loop through each of the batched IDs to update storage of special
    // balances and circulation balances.
    for (uint i = 0; i < _ids.length; i++) {
      require(_hasItemRight(_ids[i], BURN),
        "Super721::burnBatch: you do not have the right to burn that item");

      // Retrieve the group ID from the given item `_id` and check burn.
      uint256 shiftedGroupId = (_ids[i] & GROUP_MASK);
      uint256 groupId = shiftedGroupId >> 128;
      uint256 burntItemId = _burnChecker(_ids[i]);

      // Update storage of special balances and circulating values.
      require(balances[burntItemId][_burner] >= 1, "Super721::burn: burn amount exceeds balance");
      balances[burntItemId][_burner] = balances[burntItemId][_burner] - 1;
      groupBalances[groupId][_burner] = groupBalances[groupId][_burner] - 1;
      totalBalances[_burner] = totalBalances[_burner] - 1;
      burnCount[burntItemId] = burnCount[burntItemId] + 1;
      circulatingSupply[burntItemId] = circulatingSupply[burntItemId] - 1;
      itemGroups[groupId].burnCount = itemGroups[groupId].burnCount + 1;
      itemGroups[groupId].circulatingSupply =
        itemGroups[groupId].circulatingSupply - 1;

      _holderTokens[_burner].remove(_ids[i]);
      _holderTokens[address(0)].add(_ids[i]);

      // If burnType is None, burnChecker will revert that
      if(itemGroups[groupId].burnType == BurnType.Burnable)
        _tokenOwners.set(_ids[i], address(0));
      else
        _tokenOwners.remove(_ids[i]);

      // Emit the burn event.
      emit Transfer(operator, address(0), _ids[i]);
    }
  }

  /**
    Set the on-chain metadata attached to a specific token ID so long as the
    collection as a whole or the token specifically has not had metadata
    editing frozen.
    @param _id The ID of the token to set the `_metadata` for.
    @param _metadata The metadata string to store on-chain.
  */
  function setMetadata(uint256 _id, string memory _metadata)
    external hasItemRight(_id, SET_METADATA) {
    uint groupId = _id >> 128;
    require(!uriLocked && !metadataFrozen[_id] &&  !metadataFrozen[groupId]);
    string memory oldMetadata = blueprints[_id];
    blueprints[_id] = _metadata;
    emit MetadataChanged(_msgSender(), _id, oldMetadata, _metadata);
  }

  /**
    Allow the item collection owner or an associated manager to forever lock the
    metadata URI on the entire collection to future changes.
  */
  function lockURI() external
    hasValidPermit(UNIVERSAL, LOCK_URI) {
    uriLocked = true;
    emit PermanentURI(metadataUri, 2 ** 256 - 1);
  }

  /**
    Allow the associated manager to forever lock the contract URI to future 
    changes
   */
  function lockContractUri() external
    hasValidPermit(UNIVERSAL, LOCK_URI) {
    contractUriLocked = true;
    emit PermanentContractURI(contractURI, 2 ** 256 - 1);   
  }

  /**
    Allow the item collection owner or an associated manager to forever lock the
    metadata URI on an item to future changes.
    @param _uri The value of the URI to lock for `_id`.
    @param _id The token ID to lock a metadata URI value into.
  */
  function lockItemURI(string calldata _uri, uint256 _id) external
    hasItemRight(_id, LOCK_ITEM_URI) {
    metadataFrozen[_id] = true;
    emit PermanentURI(_uri, _id);
  }

  /**
    Allow the item collection owner or an associated manager to forever lock the
    metadata URI on a group of items to future changes.

    @param _uri The value of the URI to lock for `groupId`.
    @param groupId The group ID to lock a metadata URI value into.
  */
  function lockGroupURI(string calldata _uri, uint256 groupId) external
    hasItemRight(groupId, LOCK_ITEM_URI) {
    metadataFrozen[groupId] = true;
    emit PermanentURI(_uri, groupId);
  }

  /**
    Allow the item collection owner or an associated manager to forever lock
    this contract to further item minting.
  */
  function lock() external virtual hasValidPermit(UNIVERSAL, LOCK_CREATION) {
    locked = true;
    emit CollectionLocked(_msgSender());
  }

  function getApproved(uint256 tokenId) public view override returns (address) {
      require(_tokenOwners.contains(tokenId), "Super721::getApproved: approved query for nonexistent token");

      return _tokenApprovals[tokenId];
  }

  function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
      require(_tokenOwners.contains(tokenId), "Super721::getApproved: operator query for nonexistent token");
      address owner = ownerOf(tokenId);
      return (spender == owner || _tokenApprovals[tokenId] == spender || isApprovedForAll(owner, spender));
  }
  /**
   * @dev See {IERC721-transferFrom}.
   */
  function transferFrom(address from, address to, uint256 tokenId) public virtual override {
      // //solhint-disable-next-line max-line-length
      require(_isApprovedOrOwner(_msgSender(), tokenId), "Super721::transferForm: transfer caller is not owner nor approved");
      safeTransferFrom(from, to, tokenId);
      //
      // require(ownerOf(tokenId) == from, "Super721::transferForm: transfer of token that is not own");
      // require(to != address(0), "Super721::transferForm: transfer to the zero address");
      //
      // _beforeTokenTransfer(_msgSender(), from, to, _asSingletonArray(tokenId), _asSingletonArray(1), "");
      //
      // // Clear approvals from the previous owner
      // //_approve(address(0), tokenId);
      // _tokenApprovals[tokenId] = address(0);
      // emit Approval(ownerOf(tokenId), address(0), tokenId);
      //
      // _holderTokens[from].remove(tokenId);
      // _holderTokens[to].add(tokenId);
      //
      // _tokenOwners.set(tokenId, to);
      //
      // emit Transfer(from, to, tokenId);
  }

  /**
   * @dev See {IERC721Enumerable-tokenOfOwnerByIndex}.
   */
  function tokenOfOwnerByIndex(address owner, uint256 index) public view returns (uint256) {
      return _holderTokens[owner].at(index);
  }

  /**
   * @dev See {IERC721Enumerable-totalSupply}.
   */
  function totalSupply() public view returns (uint256) {
      // _tokenOwners are indexed by tokenIds, so .length() returns the number of tokenIds
      return _tokenOwners.length();
  }

  /**
   * @dev See {IERC721Enumerable-tokenByIndex}.
   */
  function tokenByIndex(uint256 index) public view returns (uint256) {
      (uint256 tokenId, ) = _tokenOwners.at(index);
      return tokenId;
  }

}