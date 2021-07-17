// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./ProxyRegistry.sol";

/**
  @title A fully-implemented proxy registry contract.
  @author Protinam, Project Wyvern
  @author Tim Clancy

  This contract was originally developed by Project Wyvern
  (https://github.com/ProjectWyvern/) where it currently enjoys great success as
  the primary exchange contract for OpenSea. It has been modified to support a
  more modern version of Solidity with associated best practices. The
  documentation has also been improved to provide more clarity.
*/
contract WyvernProxyRegistry is ProxyRegistry {

  /// The public name of this registry.
  string public constant name = "Project Wyvern Proxy Registry";

  /// A flag to debounce whether or not the initial authorized caller has been
  /// set.
  bool public initialCallerSet = false;

  /**
    Construct this registry by specifying the initial implementation of all
    `OwnableDelegateProxy` contracts that are registered by users. This registry
    will use `AuthenticatedProxy` as its initial implementation.
  */
  constructor() public {
    delegateProxyImplementation = new AuthenticatedProxy();
  }

  /**
    Allow the owner of this registry to grant immediate authorization to a single
    address for calling proxies in this registry. This is to avoid waiting for the
    `DELAY_PERIOD` otherwise specified for further caller additions.

    @param _initialCaller The initial caller authorized to operate against this
      registry.
  */
  function grantInitialAuthentication(address _initialCaller) external onlyOwner {
    require(!initialCallerSet,
      "WyvernProxyRegistry: the initial caller has already been specified");
    initialCallerSet = true;
    authorizedCallers[_initialCaller] = true;
  }
}
