// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "./AppStorage.sol";

/** 
  Main entry point to the standard. This contract is visible to the outside world.
  Every call is delegated to a facet using a mapping (selector of call data to 
  facet address). State is stored in this contract and memory locations are assigned
  based of KECCAK256 of a struct.
*/
contract DiamondProxy {

    constructor(bytes4[] memory _selectors, address[] memory _addresses) {
        // Single-Cut Diamond (Add unchangeable, non-upgradeable Facets)
        // Load variables related to DiamondProxy from this contract's memory
        AppStorage.DiamondVars storage dv = AppStorage.diamondVars();
        for(uint256 i = 0; i < _selectors.length; i++){
            // Add the selectors to corresponding Facets
            dv.selectorToAddress[_selectors[i]] = _addresses[i]; 
        }
    }

    // Just a test function in the Proxy.
    function getOwner() external view returns(address) { // 893d20e8
        AppStorage.IndependentVars storage dv = AppStorage.independentVars();
        return dv.owner;
    }

    fallback() external {
        // Load variables related to DiamondProxy from this contract's memory
        AppStorage.DiamondVars storage dv = AppStorage.diamondVars();
        // Get facet from function selector
        address facet = dv.selectorToAddress[msg.sig];
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
