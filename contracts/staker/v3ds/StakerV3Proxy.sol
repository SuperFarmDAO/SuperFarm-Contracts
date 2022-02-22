// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "./StakerV3Blueprint.sol";
import "hardhat/console.sol";

/** 
  @title A diamond standard proxy storage for StakerV3
  @author Qazawat Zirak
  A proxy storage for a StakerV3. It is the main entry point for
  contract calls. Every call to proxy storage will be delegated to
  StakerV3 contract address. Storage is reflected in this contract.
*/
contract StakerV3Proxy {

  /** 
    Construct a new Super721Lite item collection proxy.
    @param _implementation The address of the logic contract.
    @param _owner The address of the administrator governing this contract.
    @param _token The address of the disburse token.
    @param _admin The admin for verification purposes.
    @param _IOUTokenAddress IOUTokenAddress
  */
  constructor(address _implementation, address _owner, address _token, address _admin, address _IOUTokenAddress, 
  bytes4[] memory _selectors, address[] memory _addresses) {

    require(_selectors.length == _addresses.length);

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();
    
     // Execute a delegate call for initialization
    (bool success,) = _implementation.delegatecall(abi.encodeWithSignature("initialize(address)", _owner));

    // Represents collective succuess
    require(success, "Delegate call failed");

    // If deployment is success, store constructor parameters
    b.IOUTokenAddress = _IOUTokenAddress;
    b.admin = _admin;
    b.token = _token;
    b.canAlterDevelopers = true;
    b.canAlterTokenEmissionSchedule = true;
    b.canAlterPointEmissionSchedule = true;
    b.earliestTokenEmissionEvent = 2**256 - 1;
    b.earliestPointEmissionEvent = 2**256 - 1;

    for (uint256 i = 0; i < _selectors.length; i++) {
        b.implementations[_selectors[i]] = _addresses[i];
    }
  }

  fallback() external {

    // Load variables related to DiamondProxy from this contract's memory
    StakerV3Blueprint.StakerV3StateVariables
    storage b = StakerV3Blueprint.stakerV3StateVariables();

    address _implementation = b.implementations[msg.sig];
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