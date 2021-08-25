// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./OwnableDelegateProxy.sol";

/**
  @title A call-delegating immutable forwarding-only proxy.
  @author Protinam, Project Wyvern
  @author Tim Clancy

  This contract was originally developed by Project Wyvern
  (https://github.com/ProjectWyvern/) where it currently enjoys great success as
  a component of the primary exchange contract for OpenSea. It has been modified
  to support a more modern version of Solidity with associated best practices.
  The documentation has also been improved to provide more clarity.
*/
contract OwnableImmutableDelegateProxy is OwnableDelegateProxy {

  /// The ERC-897 proxy type: this proxy is immutable.
  uint256 public override constant proxyType = 1;

  /**
    Construct this delegate proxy with an owner, initial target, and an initial
    call sent to the target.

    @param _owner The address which should own this proxy.
    @param _target The initial target of this proxy.
    @param _data The initial call to delegate to `_target`.
  */
  constructor (address _owner, address _target, bytes memory _data)
    OwnableDelegateProxy(_owner, _target, _data) { }
}
