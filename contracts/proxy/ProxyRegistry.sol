// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./OwnableMutableDelegateProxy.sol";

/**
  @title A proxy registry contract.
  @author Protinam, Project Wyvern
  @author Tim Clancy

  This contract was originally developed by Project Wyvern
  (https://github.com/ProjectWyvern/) where it currently enjoys great success as
  a component of the primary exchange contract for OpenSea. It has been modified
  to support a more modern version of Solidity with associated best practices.
  The documentation has also been improved to provide more clarity.
*/
contract ProxyRegistry is Ownable {

  /**
    Each `OwnableDelegateProxy` contract ultimately dictates its implementation
    details elsewhere, to `delegateProxyImplementation`.
  */
  address public delegateProxyImplementation;

  /**
    This mapping relates an addresses to its own personal `OwnableDelegateProxy`
    which allow it to proxy functionality to the various callers contained in
    `authorizedCallers`.
  */
  mapping(address => OwnableMutableDelegateProxy) public proxies;

  /**
    This mapping relates addresses which are pending access to the registry to
    the timestamp where they began the `startGrantAuthentication` process.
  */
  mapping(address => uint256) public pendingCallers;

  /**
    This mapping relates an address to a boolean specifying whether or not it is
    allowed to call the `OwnableDelegateProxy` for any given address in the
    `proxies` mapping.
  */
  mapping(address => bool) public authorizedCallers;

  /**
    A delay period which must elapse before adding an authenticated contract to
    the registry, thus allowing it to call the `OwnableDelegateProxy` for an
    address in the `proxies` mapping.

    This `ProxyRegistry` contract was designed with the intent to be owned by a
    DAO, so this delay mitigates a particular class of attack against an owning
    DAO. If at any point the value of assets accessible to the
    `OwnableDelegateProxy` contracts exceeded the cost of gaining control of the
    DAO, a malicious but rational attacker could spend (potentially
    considerable) resources to then have access to all `OwnableDelegateProxy`
    contracts via a malicious contract upgrade. This delay period renders this
    attack ineffective by granting time for addresses to remove assets from
    compromised `OwnableDelegateProxy` contracts.
  */
  uint256 public DELAY_PERIOD = 2 weeks;

  /**
    Allow the `ProxyRegistry` owner to begin the process of enabling access to
    the registry for the unauthenticated address `_unauthenticated`. Once the
    grant authentication process has begun, it is subject to the `DELAY_PERIOD`
    before the authentication process may conclude. Once concluded, the new
    address `_unauthenticated` will have access to the registry.

    This `ProxyRegistry` contract was designed with the intent to be owned by a
    DAO, so this function serves as an important timelock in the governance
    process.

    @param _unauthenticated The new address to grant access to the registry.
  */
  function startGrantAuthentication(address _unauthenticated) external
    onlyOwner {
    require(!authorizedCallers[_unauthenticated],
      "ProxyRegistry: this address is already an authorized caller");
    require(pendingCallers[_unauthenticated] == 0,
      "ProxyRegistry: this address is already pending authentication");
    pendingCallers[_unauthenticated] = block.timestamp;
  }

  /**
    Allow the `ProxyRegistry` owner to end the process of enabling access to the
    registry for the unauthenticated address `_unauthenticated`. If the required
    `DELAY_PERIOD` has passed, then the new address `_unauthenticated` will have
    access to the registry.

    @param _unauthenticated The new address to grant access to the registry.
  */
  function endGrantAuthentication(address _unauthenticated) external onlyOwner {
    require(!authorizedCallers[_unauthenticated],
      "ProxyRegistry: this address is already an authorized caller");
    require(pendingCallers[_unauthenticated] != 0,
      "ProxyRegistry: this address has not yet started authentication");
    require((pendingCallers[_unauthenticated] + DELAY_PERIOD) < block.timestamp,
      "ProxyRegistry: this address has not yet cleared the timelock");
    pendingCallers[_unauthenticated] = 0;
    authorizedCallers[_unauthenticated] = true;
  }

  /**
    Allow the owner of the `ProxyRegistry` to immediately revoke authorization
    to call proxies from the specified address.

    @param _caller The address to revoke authentication from.
  */
  function revokeAuthentication(address _caller) external onlyOwner {
    authorizedCallers[_caller] = false;
  }

  /**
    Enables an address to register its own proxy contract with this registry.

    @return The new `OwnableMutableDelegateProxy` contract with its
      `delegateProxyImplementation` implementation.
  */
  function registerProxy() external returns (OwnableMutableDelegateProxy) {
    require(address(proxies[_msgSender()]) == address(0),
      "ProxyRegistry: you have already registered a proxy");

    // Construct the new `OwnableDelegateProxy` with this registry's initial
    // implementation and call said implementation's "initialize" function.
    OwnableMutableDelegateProxy proxy = new OwnableMutableDelegateProxy(
      _msgSender(), delegateProxyImplementation,
      abi.encodeWithSignature("initialize(address,address)", _msgSender(),
        address(this)));
    proxies[_msgSender()] = proxy;
    return proxy;
  }
}
