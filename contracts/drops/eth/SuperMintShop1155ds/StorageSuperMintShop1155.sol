// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "./BlueprintSuperMintShop1155.sol";
import "../SuperDropFactoryds/ILinkProxy.sol";

/** 
  @title A diamond standard proxy storage for SuperMintShop1155
  @author Qazawat Zirak
  A proxy storage for a SuperMintShop1155. It is the main entry point for
  SuperMintShop1155 calls. Every call to proxy storage will be delegated to
  SuperMintShop1155 facet based on functionToFacet mapping. Storage updates 
  is done in the proxy storage using the BlueprintSuperMintShop1155 library.
*/
contract StorageSuperMintShop1155 {
    /** 
      Deploys a storage proxy for SuperMintShop1155 facets.
      @param _linkProxy the proxy contract which stores function to facet
        mapping. The key for this mapping is KECCAK256(Selector, ContractName).
      @param _paymentReceiver receiver of the payment.
      @param _globalPurchaseLimit threshold of purchase overall.
      @param _maxAllocation total allocated assets.
    */
    constructor(
        address _linkProxy,
        address _paymentReceiver,
        uint256 _globalPurchaseLimit,
        uint256 _maxAllocation
    ) {
        // Calculate the key for the function to facet mapping in the link proxy
        bytes4 selector = bytes4(keccak256(bytes("initialize()")));
        string memory baseContractName = "SuperMintShop1155";
        bytes32 linkProxyKey = keccak256(
            abi.encodePacked(selector, baseContractName)
        );

        // Do a delegate call to initialize the owner
        address initializerFacet = ILinkProxy(_linkProxy).links(linkProxyKey);
        require(
            initializerFacet != address(0),
            "StorageSuperMintShop1155: No facet found!"
        );
        initializerFacet.delegatecall(abi.encodeWithSignature("initialize()")); // At this point DF owns StorageSuperMintShop1155

        // If deployment is success, store constructor parameters
        BlueprintSuperMintShop1155.SuperMintShop1155StateVariables
            storage b = BlueprintSuperMintShop1155
                .superMintShop1155StateVariables();
        b.linkProxy = _linkProxy;
        b.paymentReceiver = _paymentReceiver;
        b.globalPurchaseLimit = _globalPurchaseLimit;
        b.maxAllocation = _maxAllocation;
    }

    fallback() external payable {
        // Load variables related to DiamondProxy from this contract's memory
        BlueprintSuperMintShop1155.SuperMintShop1155StateVariables
            storage b = BlueprintSuperMintShop1155
                .superMintShop1155StateVariables();

        // Get facet from function selector
        address linkProxy = b.linkProxy;
        string memory baseContractName = "SuperMintShop1155";
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
