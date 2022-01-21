// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "./Super721LiteBlueprint.sol";
import "hardhat/console.sol";

/** 
  @title A diamond standard proxy storage for Super721Lite
  @author Qazawat Zirak
  A proxy storage for a lite collection. It is the main entry point for
  contract calls. Every call to proxy storage will be delegated to lite
  contract address. Storage is reflected in this contract.
*/
contract Super721LiteProxy {

  /** 
    Construct a new Super721Lite item collection proxy.

    @param _implementation The address of the logic contract.
    @param _owner The address of the administrator governing this collection.
    @param _name The name to assign to this item collection contract.
    @param _symbol The string that represents the entire collection symbol.
    @param _totalSupply The supply cap of this contract.
    @param _batchSize The amount that can be minted one time.
    @param _metadataURI The metadata URI to perform later token ID substitution with.
    @param _contractURI The contract URI.
    @param _proxyRegistryAddress The address of a proxy registry contract.
  */
  constructor(address _implementation, address _owner, string memory _name, string memory _symbol,
  uint256 _totalSupply, uint256 _batchSize, string memory _metadataURI,
  string memory _contractURI, address _proxyRegistryAddress) {

    Super721LiteBlueprint.Super721LiteStateVariables
      storage b = Super721LiteBlueprint.super721LiteStateVariables();
    
    // Execute all the delegate calls
    bool resultant = true;
    (bool success,) = _implementation.delegatecall(abi.encodeWithSignature("initialize()")); // Deployer owns
    resultant = success && resultant;
    (success,) = _implementation.delegatecall(abi.encodeWithSignature("registerInterface(bytes4)", Super721LiteBlueprint._INTERFACE_ID_ERC721)); 
    resultant = success && resultant;
    (success,) = _implementation.delegatecall(abi.encodeWithSignature("registerInterface(bytes4)", Super721LiteBlueprint._INTERFACE_ID_ERC721_METADATA)); 
    resultant = success && resultant;
    (success,) = _implementation.delegatecall(abi.encodeWithSignature("registerInterface(bytes4)", Super721LiteBlueprint._INTERFACE_ID_ERC721_ENUMERABLE)); 
    resultant = success && resultant;
    (success,) = _implementation.delegatecall(abi.encodeWithSignature("transferOwnership(address)", _owner)); // Owner owns
    resultant = success && resultant;

    // Represents collective succuess
    require(resultant, "Delegate call failed");

    // If deployment is success, store constructor parameters
    b.name = _name;
    b.symbol = _symbol;
    b.totalSupply = _totalSupply;
    b.batchSize = _batchSize;
    b.metadataUri = _metadataURI;
    b.contractURI = _contractURI;
    b.implementation = _implementation;
    b.proxyRegistryAddress = _proxyRegistryAddress;
  }

  fallback() external {

      // Load variables related to DiamondProxy from this contract's memory
      Super721LiteBlueprint.Super721LiteStateVariables
        storage b = Super721LiteBlueprint.super721LiteStateVariables();

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