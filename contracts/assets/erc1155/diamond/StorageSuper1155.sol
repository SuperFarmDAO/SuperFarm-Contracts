// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "./BlueprintSuper1155.sol";
import "../../../diamonds/drops/eth/SuperDropFactoryds/ILinkProxy.sol";

/** 
  @title A diamond standard proxy storage for Super1155
  @author Qazawat Zirak
  A proxy storage for a Super1155 collection. It is the main entry point for
  Super1155 contract calls. Every call to proxy storage will be delegated to
  Super1155 facet based on functionToFacet mapping. Storage updates for the
  collection is done in the proxy storage using the BlueprintSuper1155 library.
*/
contract StorageSuper1155 {
    /** 
      Deploys a storage proxy for Super1155 facets.
      @param _linkProxy the proxy contract which stores function to facet
        mapping. The key for this mapping is KECCAK256(Selector, ContractName).
      @param _name the name to assign to this item collection contract.
      @param _metadataURI the metadata URI to perform later token ID substitution with.
      @param _contractURI the contract URI.
      @param _proxyRegistryAddress the address of a proxy registry contract.
    */
    constructor(
        address _linkProxy,
        string memory _name,
        string memory _metadataURI,
        string memory _contractURI,
        address _proxyRegistryAddress
    ) {
        // Calculate the key for the function to facet mapping in the link proxy
        bytes4 selector = bytes4(keccak256(bytes("initialize()")));
        string memory baseContractName = "Super1155";
        bytes32 linkProxyKey = keccak256(
            abi.encodePacked(selector, baseContractName)
        ); // Relevant facet

        // Do a delegate call to initialize the owner
        address initializerFacet = ILinkProxy(_linkProxy).links(linkProxyKey);
        require(
            initializerFacet != address(0),
            "StorageSuper1155: No facet found!"
        );
        initializerFacet.delegatecall(abi.encodeWithSignature("initialize()")); // At this point DF owns StorageSuper1155

        // If deployment is success, store constructor parameters
        BlueprintSuper1155.Super1155StateVariables
            storage b = BlueprintSuper1155.super1155StateVariables();
        b.linkProxy = _linkProxy;
        b.name = _name;
        b.metadataURI = _metadataURI;
        b.contractURI = _contractURI;
        b.proxyRegistryAddress = _proxyRegistryAddress;
    }

    fallback() external {
        // Load variables related to DiamondProxy from this contract's memory
        BlueprintSuper1155.Super1155StateVariables
            storage b = BlueprintSuper1155.super1155StateVariables();

        // Get facet from function selector
        address linkProxy = b.linkProxy;
        string memory baseContractName = "Super1155";
        bytes32 linkProxyKey = keccak256(
            abi.encodePacked(msg.sig, baseContractName)
        ); // Relevant facet
        address facet = ILinkProxy(linkProxy).links(linkProxyKey);

        require(facet != address(0), "No facet to address mapping");

        // Execute external function from facet using delegatecall and return any value.
        assembly {
            // Copy function selector and any arguments
            calldatacopy(0, 0, calldatasize())
            // Execute function call using the facet
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
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
