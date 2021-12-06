// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.8;

/**
    Interface for retrieving bytecode from huge contracts.
 */
interface IHelper {

    /**
        Returns creation bytecode of the contract.
     */
   function getByteCode() external pure returns (bytes memory);

}
