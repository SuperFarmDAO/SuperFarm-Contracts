// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.8;

interface ISuper721IMXLock {

    function mintForLocked() external view returns(bool);

    function toggleMintFor() external;
}