// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./TokenRecipient.sol";
import "../interfaces/IProxyRegistry.sol";

/**
  @title An ownable call-delegating proxy which can receive tokens and only make
    calls against contracts that have been approved by a `ProxyRegistry`.
  @author Protinam, Project Wyvern
  @author Tim Clancy

  This contract was originally developed by Project Wyvern
  (https://github.com/ProjectWyvern/) where it currently enjoys great success as
  a component of the primary exchange contract for OpenSea. It has been modified
  to support a more modern version of Solidity with associated best practices.
  The documentation has also been improved to provide more clarity.
*/
contract AuthenticatedProxy is Ownable, TokenRecipient {

  /// Whether or not this proxy is initialized. It may only be initialized once.
  bool public initialized = false;

  /// The associated `ProxyRegistry` contract with authentication information.
  address public registry;

  /// Whether or not access has been revoked.
  bool public revoked;

  /**
    An enumerable type for selecting the method by which we would like to
    perform a call in the `proxy` function.

    @param Call This call type specifies that we perform a direct call.
    @param DelegateCall This call type can be used to automatically transfer
      multiple assets owned by the proxy contract with one order.
  */
  enum CallType {
    Call,
    DelegateCall
  }

  /**
    An event fired when the proxy contract's access is revoked or unrevoked.

    @param revoked The status of the revocation call; true if access is
    revoked and false if access is unrevoked.
  */
  event Revoked(bool revoked);

  /**
    Initialize this authenticated proxy for its owner against a specified
    `ProxyRegistry`. The registry controls the eligible targets.

    @param _registry The registry to create this proxy against.
  */
  function initialize(address _registry) external {
    require(!initialized,
      "AuthenticatedProxy: this proxy may only be initialized once");
    initialized = true;
    registry = _registry;
  }

  /**
    Allow the owner of this proxy to set the revocation flag. This permits them
    to revoke access from the associated `ProxyRegistry` if needed.
  */
  function setRevoke(bool revoke) external onlyOwner {
    revoked = revoke;
    emit Revoked(revoke);
  }

  /**
    Trigger this proxy to call a specific address with the provided data. The
    proxy may perform a direct or a delegate call. This proxy can only be called
    by the owner, or on behalf of the owner by a caller authorized by the
    registry. Unless the user has revoked access to the registry, that is.

    @param _targets The target address to make the call to.
    @param _types The type of call to make: direct or delegated.
    @param _data The call data to send to `_target`.
    @return Whether or not the call succeeded.
  */
  function call(address[] memory _targets, CallType[] memory _types,uint[] memory calldataPointers, bytes calldata _data) public
    returns (bool[] memory) {
    require(_msgSender() == owner()
      || (!revoked && IProxyRegistry(registry).authorizedCallers(_msgSender())),
      "AuthenticatedProxy: not owner, not authorized by an unrevoked registry");
    bool[] memory results = new bool[](_targets.length);

    for (uint i = 0; i < _targets.length; i++) {
      // The call is authorized to be performed, now select a type and return.
      if (_types[i] == CallType.Call) {
        (bool success, ) = _targets[i].call(_data[calldataPointers[i]:calldataPointers[i+1]-1]);
        results[i] = success;
      } else if (_types[i] == CallType.DelegateCall) {
        (bool success, ) = _targets[i].delegatecall(_data[calldataPointers[i]:calldataPointers[i+1]-1]);
        results[i] = success;
      }
      results[i] = false;
    }
    
  }

  /**
    Trigger this proxy to call a specific address with the provided data and
    require success. Otherwise identical to `call()`.

    @param _target The target address to make the call to.
    @param _type The type of call to make: direct or delegated.
    @param _data The call data to send to `_target`.
  */
  function callAssert(address _target, CallType _type, bytes calldata _data)
    external {
      address[] memory targets;
      CallType[] memory types;
      uint[] memory pointers;
      targets[0] = _target;
      types[0] = _type;
      pointers[0] = 0;
      pointers[1] = _data.length;
    bool[] memory result = call(targets, types, pointers, _data);   
    require(result[0],
      "AuthenticatedProxy: the asserted call did not succeed");
  }
}
