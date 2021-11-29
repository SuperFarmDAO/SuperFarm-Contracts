// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "./AppStorage.sol";

/** 
  A facet contract that defines the logic of some program. It does not
  store the state in itself but rather in the Proxy contract using 
  AppStorage.sol. This contract is the destination of a delegate call's 
  logic from Proxy contract.
*/
contract FacetDependent {
    function increaseBalance() external { // d003d23e
        AppStorage.DependentVars storage dv = AppStorage.dependentVars();
        dv.balances[msg.sender] += 1;
    }

    function setOwnerB(address _address) external { // 6f73ce0d
        AppStorage.IndependentVars storage dv = AppStorage.independentVars();
        dv.owner = _address;
    }

    function getBalanceByAddress(address _address) external view returns(uint256) { //136d6a39
        AppStorage.DependentVars storage dv = AppStorage.dependentVars();
        return dv.balances[_address];

    }

    function getOwner() external view returns(address) { // 893d20e8
        AppStorage.IndependentVars storage dv = AppStorage.independentVars();
        return dv.owner;
    }
}
