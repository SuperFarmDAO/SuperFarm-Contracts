// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

/** 
  This is a library that acts as an AppStorage mechanism. The library defines
  state variables in form of structs. It also defines the location of those
  variables in memory using a KECCAK256 to avoid memory collision. The state 
  is stored in Proxy contract, which does a delegate call to Facets.
*/
library AppStorage {

    // Diamond Struct
    struct DiamondVars {
        mapping(bytes4 => address) selectorToAddress;
    }

    // Facet Structs
    struct IndependentVars {
        address owner;
        mapping(address => bool) accessAddresses;
    }

    struct DependentVars  {
        uint256 addressesCount;
        mapping(address => uint256) balances;
    }

    // Get their Keccak location
    function diamondVars() internal pure returns(DiamondVars storage dv) {
        bytes32 storagePosition = keccak256("diamond.storage.DiamondVars");
        assembly {
            dv.slot := storagePosition
        }
    }

    function independentVars() internal pure returns(IndependentVars storage iv) {
        bytes32 storagePosition = keccak256("diamond.storage.IndependentVars");
        assembly {
            iv.slot := storagePosition
        }
    }

    function dependentVars() internal pure returns(DependentVars storage dv) {
        bytes32 storagePosition = keccak256("diamond.storage.DependentVars");
        assembly {
           dv.slot := storagePosition
        }
    }

}
