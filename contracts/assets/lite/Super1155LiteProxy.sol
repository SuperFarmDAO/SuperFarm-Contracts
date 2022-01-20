// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "./Super1155LiteBlueprint.sol";

/** 
  @title A diamond standard proxy storage for Super1155Lite
  @author Qazawat Zirak
  A proxy storage for a lite collection. It is the main entry point for
  contract calls. Every call to proxy storage will be delegated to lite
  contract address. Storage is reflected in this contract.
*/
contract Super1155LiteProxy {

  /** 
    Construct a new Super1155Lite item collection proxy.

    @param _implementation The address of the logic contract.
    @param _owner The address of the administrator governing this collection.
    @param _name The name to assign to this item collection contract.
    @param _metadataURI The metadata URI to perform later token ID substitution with.
    @param _contractURI The contract URI.
    @param _proxyRegistryAddress The address of a proxy registry contract.
  */
  constructor(address _implementation, address _owner, string memory _name,
  string memory _metadataURI, string memory _contractURI, address _proxyRegistryAddress) {

    Super1155LiteBlueprint.Super1155LiteStateVariables
      storage b = Super1155LiteBlueprint.super1155LiteStateVariables();
    
    // At this point, deployer owns this contract
    bool resultant = true;
    (bool success,) = _implementation.delegatecall(abi.encodeWithSignature("initialize()")); 
    resultant = success && resultant;
    (success,) = _implementation.delegatecall(abi.encodeWithSignature("transferOwnership(address)", _owner)); 
    resultant = success && resultant;
    (success,) = _implementation.delegatecall(abi.encodeWithSignature("_registerInterface(bytes4)", Super1155LiteBlueprint.INTERFACE_ERC1155));
    resultant = success && resultant;
    (success,) = _implementation.delegatecall(abi.encodeWithSignature("_registerInterface(bytes4)", Super1155LiteBlueprint.INTERFACE_ERC1155_METADATA_URI)); 
    resultant = success && resultant;
        
    require(resultant, "Delegate call failed");

    // If deployment is success, store constructor parameters
    b.implementation = _implementation;
    b.name = _name;
    b.metadataUri = _metadataURI;
    b.contractURI = _contractURI;
    b.proxyRegistryAddress = _proxyRegistryAddress;
  }

  fallback() external {

    // Load variables related to DiamondProxy from this contract's memory
    Super1155LiteBlueprint.Super1155LiteStateVariables
      storage b = Super1155LiteBlueprint.super1155LiteStateVariables();

    address _implementation = b.implementation;
    require(_implementation != address(0), "No implementation found");

    // Execute external function from facet using delegatecall and return any value.
    assembly {
        // Copy function selector and any arguments
        calldatacopy(0, 0, calldatasize())
        // Execute function call using the facet
        let result := delegatecall(gas(), _implementation, 0, calldatasize(), 0, 0)
        // Get any return value
        returndatacopy(0, 0, returndatasize())
        // Return any return value or error back to the caller
        switch result
        case 0 {
            revert(0, returndatasize())
        }
        default {
            return(0, returndatasize())
        }
    }
  }
}