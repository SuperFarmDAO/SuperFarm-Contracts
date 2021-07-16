// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/**
  @title An advanced permission-management contract.
  @author Tim Clancy

  This contract allows for a contract owner to delegate specific rights to
  external addresses. Additionally, these rights can be gated behind certain
  sets of circumstances and granted expiration times. This is useful for some
  more finely-grained access control in contracts.

  The owner of this contract is always a fully-permissioned super-administrator.
*/
abstract contract PermitControl is Context, Ownable {
  using SafeMath for uint256;
  using Address for address;

  /// A special reserved constant for representing no rights.
  bytes32 public constant ZERO_RIGHT = hex"00000000000000000000000000000000";

  /// A special constant specifying the unique, universal-rights circumstance.
  bytes32 public constant UNIVERSAL = hex"FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";

  /*
    A special constant specifying the unique manager right. This right allows an
    address to freely-manipulate the `managedRights` mapping.
  **/
  bytes32 public constant MANAGER = hex"FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";

  /**
    A mapping of per-address permissions to the circumstances, represented as
    an additional layer of generic bytes32 data, under which the addresses have
    various permits. A permit in this sense is represented by a per-circumstance
    mapping which couples some right, represented as a generic bytes32, to an
    expiration time wherein the right may no longer be exercised. An expiration
    time of 0 indicates that there is in fact no permit for the specified
    address to exercise the specified right under the specified circumstance.

    @dev Universal rights MUST be stored under the 0xFFFFFFFFFFFFFFFFFFFFFFFF...
    max-integer circumstance. Perpetual rights may be given an expiry time of
    max-integer.
  */
  mapping (address => mapping (bytes32 => mapping (bytes32 => uint256))) public permissions;

  /**
    An additional mapping of managed rights to manager rights. This mapping
    represents the administrator relationship that various rights have with one
    another. An address with a manager right may freely set permits for that
    manager right's managed rights. Each right may be managed by only one other
    right.
  */
  mapping (bytes32 => bytes32) public managedRights;

  /**
    An event emitted when an address has a permit updated. This event captures,
    through its various parameter combinations, the cases of granting a permit,
    updating the expiration time of a permit, or revoking a permit.
  */
  event PermitUpdated(address indexed updator, address indexed updatee, bytes32 circumstance, bytes32 indexed role, uint256 expirationTime);

  /**
    An event emitted when a management relationship in `managedRights` is
    updated. This event captures adding and revoking management permissions via
    observing the update history of the `managedRights` array.
  */
  event ManagementUpdated(address indexed manager, bytes32 indexed managedRight, bytes32 indexed managerRight);

  /**
    Determine whether or not an address has some rights under the given
    circumstance, and if they do have the right, until when.
  */
  function hasRightUntil(address _address, bytes32 _circumstance, bytes32 _right) public view returns (uint256) {
    return permissions[_address][_circumstance][_right];
  }

  /**
    Set the permit to a specific address under some circumstances. A permit may
    only be set by the super-administrative contract owner or an address holding
    some delegated management permit.
  */
  function setPermit(address _address, bytes32 _circumstance, bytes32 _right, uint256 _expirationTime) external virtual {
    require(_right != ZERO_RIGHT,
      "PermitControl: you may not grant the zero right");
    require(_msgSender() == owner() || hasRightUntil(_msgSender(), UNIVERSAL, managedRights[_right]) > 0,
      "PermitControl: sender does not have the right to set");
    permissions[_address][_circumstance][_right] = _expirationTime;
    emit PermitUpdated(_msgSender(), _address, _circumstance, _right, _expirationTime);
  }

  /**
    Set the `_managerRight` whose `UNIVERSAL` holders may freely manage the
    specified `_managedRight`.
  */
  function setManagerRight(bytes32 _managedRight, bytes32 _managerRight) external virtual {
    require(_managedRight != ZERO_RIGHT,
      "PermitControl: you may not specify a manager for the zero right");
    require(_msgSender() == owner() || hasRightUntil(_msgSender(), UNIVERSAL, MANAGER) > 0,
      "PermitControl: sender is not a manager");
    managedRights[_managedRight] = _managerRight;
    emit ManagementUpdated(_msgSender(), _managedRight, _managerRight);
  }
}
