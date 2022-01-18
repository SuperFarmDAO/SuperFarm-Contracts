// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "../../proxy/ProxyRegistry.sol";

/**
  @title A fully-implemented proxy registry contract.
  @author Protinam, Project Wyvern
  @author Tim Clancy
  @author Rostislav Khlebnikov

  This contract was originally developed by Project Wyvern
  (https://github.com/ProjectWyvern/) where it currently enjoys great success as
  the primary exchange contract for OpenSea. It has been modified to support a
  more modern version of Solidity with associated best practices. The
  documentation has also been improved to provide more clarity.
*/
contract SuperProxyRegistry is ProxyRegistry {

  /// The public name of this registry.
  string public constant name = "Super Proxy Registry";

  /**
    A flag to debounce whether or not the initial authorized caller has been
    set.
  */
  bool public initialCallerSet = false;

  /**
    Call ProxyRegistryConstructor
   */
  constructor () ProxyRegistry(){}

  /**
    Allow the owner of this registry to grant immediate authorization to a
    single address for calling proxies in this registry. This is to avoid
    waiting for the `DELAY_PERIOD` otherwise specified for further caller
    additions.

    @param _initial The initial caller authorized to operate in this registry.
  */
  function grantInitialAuthentication(address _initial) external onlyOwner {
    require(!initialCallerSet,
      "WyvernProxyRegistry: the initial caller has already been specified");
    initialCallerSet = true;
    authorizedCallers[_initial] = true;
  }
}
