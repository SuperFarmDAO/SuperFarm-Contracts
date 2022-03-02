// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

/** 
  @title Blueprint library for Super721Lite.
  @author Qazawat Zirak
  This library acts as a blueprint for storage mechanim in the proxy contract.
  The library defines state variables in form of structs. It also defines the 
  storage location of the variables using KECCAK256 to avoid memory collision. 
  The state is stored in Proxy contract, which does a delegate call.

  15th Jan, 2022.
*/
library Super721LiteBlueprint {

    /// The public identifier for the right to set this contract's metadata URI.
    bytes32 public constant SET_URI = keccak256("SET_URI");

    /// The public identifier for the right to set this contract's proxy registry.
    bytes32 public constant SET_PROXY_REGISTRY = keccak256("SET_PROXY_REGISTRY");

    /// The public identifier for the right to mint items.
    bytes32 public constant MINT = keccak256("MINT");

    /// The public identifier for the right to set item metadata.
    bytes32 public constant SET_METADATA = keccak256("SET_METADATA");

    /// The public identifier for the right to lock the metadata URI.
    bytes32 public constant LOCK_URI = keccak256("LOCK_URI");

    /// The public identifier for the right to lock an item's metadata.
    bytes32 public constant LOCK_ITEM_URI = keccak256("LOCK_ITEM_URI");

    /// The public identifier for the right to disable item creation.
    bytes32 public constant LOCK_CREATION = keccak256("LOCK_CREATION");
    
    /// @dev Magic number for ERC721 interface.
    bytes4 public constant _INTERFACE_ID_ERC721 = 0x80ac58cd;

    /// @dev Magic number for ERC721 metadata interface.
    bytes4 public constant _INTERFACE_ID_ERC721_METADATA = 0x5b5e139f;

    /// @dev Magic number for ERC721 enumberable interface.
    bytes4 public constant _INTERFACE_ID_ERC721_ENUMERABLE = 0x780e9d63;

    /** 
      This struct defines the state variables for Super721Lite diamond Proxy.

      @param name The public name of this contract.
      @param symbol A symbol representing this collection of NFT's.
      @param metadataUri The ERC-721 URI for tracking item metadata, 
        supporting {id} substitution. For example: 
        https://token-cdn-domain/{id}.json. See the ERC-721 spec for
        more details: https://eips.ethereum.org/EIPS/eip-721#metadata.
      @param contractURI The URI for the storefront-level metadata of contract
      @param totalSupply The total supply cap of mints.
      @param mintIndex The current index of minting.
      @param batchSize The amount that can be minted one time.
      @param implementation The logic contract's address.
      @param proxyRegistryAddress A proxy registry address for supporting 
        automatic delegated approval.
      @param ownerships A mapping that keeps track of ownership for 
        each individual token.
      @param balances A mapping from address to total NFT's owned.
      @param operatorApprovals @dev This is a mapping from each address 
        to per-address operator approvals. Operators are those addresses 
        that have been approved to transfer tokens on behalf of the 
        approver. Transferring tokens includes the right to burn tokens.
      @param tokenApprovals Mapping from token ID to approved address
      @param metadataFrozen A mapping of token ID to a boolean representing 
        whether the item's metadata has been explicitly frozen via a call 
        to `lockURI(string calldata _uri, uint256 _id)`. Do note that it 
        is possible for an item's mapping here to be false while still 
        having frozen metadata if the item collection as a whole
        has had its `uriLocked` value set to true.
      @param metadata A public mapping of optional on-chain metadata for 
        each token ID. A token's on-chain metadata is unable to be changed 
        if the item's metadata URI has been permanently fixed or if the 
        collection's metadata URI as a whole has been frozen.
      @param uriLocked Whether or not the metadata URI has been locked to future changes.
      @param contractUriLocked Whether or not the metadata URI has been locked to future changes.
      @param locked Whether or not the item collection has been locked to all further minting.
    */
    struct Super721LiteStateVariables {
      string name;
      string symbol;
      string metadataUri;
      string contractURI;
      uint256 totalSupply;
      uint256 mintIndex;
      uint256 batchSize;
      address implementation;
      address proxyRegistryAddress;
      mapping (uint256 => address) ownerships;
      mapping(address => uint256) balances;
      mapping (address => mapping(address => bool)) operatorApprovals;
      mapping (uint256 => address) tokenApprovals;
      mapping (uint256 => bool) metadataFrozen;
      mapping (uint256 => string) metadata;
      bool uriLocked;  
      bool contractUriLocked;
      bool locked;
    }

    // Storage Locations
    function super721LiteStateVariables()
        internal
        pure
        returns (Super721LiteStateVariables storage _super721LiteStateVariables)
    {
        bytes32 storagePosition = keccak256("diamond.storage.StateVariables");
        assembly {
            _super721LiteStateVariables.slot := storagePosition
        }
    }
}