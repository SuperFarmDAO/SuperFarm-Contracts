// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "./AppStorage.sol";

/** 
  A facet contract that defines the logic of some program. It does not
  store the state in itself but rather in the Proxy contract using 
  AppStorage.sol. This contract is the destination of a delegate call's 
  logic from Proxy contract.
*/
contract FacetIndependent {

    function addAccessAddresses(address _address) external { // de992a2a
        AppStorage.IndependentVars storage iv = AppStorage.independentVars();
        AppStorage.DependentVars storage dv = AppStorage.dependentVars();

        iv.accessAddresses[_address] = true;
        dv.addressesCount += 1;
    }

    function setOwner(address _address) external { // 13af4035
        AppStorage.IndependentVars storage dv = AppStorage.independentVars();
        dv.owner = _address;
    }

    function getOwner(bool dummy) external view returns(address) { // 893d20e8
        AppStorage.IndependentVars storage dv = AppStorage.independentVars();
        return dv.owner;
    }

    function getAccessAddresses(address _address) external view returns(bool) { // 893d20e8
        AppStorage.IndependentVars storage dv = AppStorage.independentVars();
        return dv.accessAddresses[_address];
    }
}
