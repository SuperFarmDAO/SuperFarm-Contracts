// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

/**
  @title A basic call-delegating proxy contract which is compliant with the
    current draft version of ERC-897.
  @author Facu Spagnuolo, OpenZeppelin
  @author Protinam, Project Wyvern
  @author Tim Clancy

  This contract was originally developed by OpenZeppelin, then used by
  Project Wyvern (https://github.com/ProjectWyvern/) where it currently enjoys
  great success as a component of the OpenSea exchange system. It has been
  modified to support a more modern version of Solidity with associated best
  practices. The documentation has also been improved to provide more clarity.

  July 19th, 2021.
*/
abstract contract DelegateProxy {

  /**
    The ERC-897 specification seeks to standardize a system of proxy types.

    @return proxyTypeId The type of this proxy. A return value of `1` indicates that this is
      a strictly-forwarding proxy pointed to an unchanging address. A return
      value of `2` indicates that this proxy is upgradeable. The implementation
      address may change at any time based on some arbitrary external logic.
  */
  function proxyType() external virtual pure returns (uint256 proxyTypeId);

  /**
    Return the current address where all calls to this proxy are delegated. If
    `proxyType()` returns `1`, ERC-897 dictates that this address MUST not
    change.

    @return The current address where calls to this proxy are delegated.
  */
  function implementation() public virtual view returns (address);

  /**
    This payable fallback function exists to automatically delegate all calls to
    this proxy to the contract specified from `implementation()`. Anything
    returned from the delegated call will also be returned here.
  */
  receive() external virtual payable {
    address target = implementation();
    require(target != address(0));

    // Perform the actual call delegation using Yul.
    assembly {
      let ptr := mload(0x40)
      calldatacopy(ptr, 0, calldatasize())
      let result := delegatecall(gas(), target, ptr, calldatasize(), 0, 0)
      let size := returndatasize()
      returndatacopy(ptr, 0, size)

      switch result
      case 0 { revert(ptr, size) }
      default { return(ptr, size) }
    }
  }
}
