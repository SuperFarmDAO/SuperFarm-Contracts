// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "../StakerBlueprint.sol";

/**
 * @title A diamond standard proxy storage for StakerV2
 * @author Qazawat Zirak
 * A proxy storage for a StakerV2. It is the main entry point for
 * contract calls. Every call to proxy storage will be delegated to
 * StakerV2 contract address. Storage is reflected in this contract.
 */
contract StakerV2Proxy {
    /**
     * Construct a new StakerV2 proxy.
     * @param _implementation The address of the logic contract.
     * @param _owner The address of the administrator governing this contract.
     * @param _token The address of the disburse token.
     * @param _admin The admin for verification purposes.
     * @param _name The name of the Staker contract.
     */
    constructor(
        address _implementation,
        address _owner,
        address _token,
        address _admin,
        string memory _name,
        bytes4[] memory _selectors,
        address[] memory _addresses
    ) {
        require(
            _selectors.length == _addresses.length,
            "StakerV2Proxy::Constructor: mismatch of arrays lengths."
        );

        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        // Execute a delegate call for initialization
        (bool success, ) = _implementation.delegatecall(
            abi.encodeWithSignature("initialize(address)", _owner)
        );

        // Represents collective succuess
        require(success, "StakerV2Proxy::Constructor: Delegate call failed");

        // If deployment is success, store constructor parameters
        //b.IOUTokenAddress = _IOUTokenAddress;
        uint256 MAX_INT = 2**256 - 1;
        b.name = _name;
        b.token = _token;
        b.canAlterDevelopers = true;
        b.canAlterTokenEmissionSchedule = true;
        b.earliestTokenEmissionEvent = MAX_INT;
        b.canAlterPointEmissionSchedule = true;
        b.earliestPointEmissionEvent = MAX_INT;

        for (uint256 i = 0; i < _selectors.length; i++) {
            b.implementations[_selectors[i]] = _addresses[i];
        }
    }

    fallback() external payable {
        // Load variables related to DiamondProxy from this contract's memory
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        address _implementation = b.implementations[msg.sig];
        require(
            _implementation != address(0),
            "StakerV2Proxy::fallback: No implementation found"
        );

        // Execute external function from facet using delegatecall and return any value.
        assembly {
            // Copy function selector and any arguments
            calldatacopy(0, 0, calldatasize())
            // Execute function call using the facet
            let result := delegatecall(
                gas(),
                _implementation,
                0,
                calldatasize(),
                0,
                0
            )
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
