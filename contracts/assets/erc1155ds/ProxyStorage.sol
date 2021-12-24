// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "./Blueprint.sol";

/** 
  A proxy storage for a Super1155 collection. It is the main entry point for
  SuperMintShop1155 calls. Every call to proxy storage will be delegated to
  Super1155 facet based on selectorToFacet mapping. Storage updates for the
  collection is done in the proxy storage using the Blueprint library.
*/
contract ProxyStorage {

    constructor(bytes4[] memory _selectors, address[] memory _addresses) {

        // Single-Cut Diamond (Add unchangeable, non-upgradeable Facets)
        // Load variables related to DiamondProxy from this contract's memory
        Blueprint.Super1155StateVariables storage b = Blueprint.super1155StateVariables();
        for(uint256 i = 0; i < _selectors.length; i++){
            // Add the selectors to corresponding Facets
            b.selectorToFacet[_selectors[i]] = _addresses[i]; 
        }
    }

    fallback() external {

        // Load variables related to DiamondProxy from this contract's memory
        Blueprint.Super1155StateVariables storage b = Blueprint.super1155StateVariables();
        // Get facet from function selector
        address facet = b.selectorToFacet[msg.sig];
        require(facet != address(0));
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
                case 0  {
                    revert(0, returndatasize())
                }
                default {
                    return (0, returndatasize())
                }
            }
        }
}