// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.8;

/// @title interface for interacting with IMX lock contract
interface ISuper721IMXLock {

    /// Returns whether or not the mintFor is disabled
    function mintForLocked() external view returns(bool);

    /** 
        Toggling control for the mintFor function ability to mint based on
        mintForLocked variable.
    */
    function toggleMintFor() external;
}