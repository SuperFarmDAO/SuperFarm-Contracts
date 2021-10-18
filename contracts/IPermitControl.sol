// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

/**
  @title An interface for the `PermitControl` access control contract.
  @author Tim Clancy
  October 10th, 2021.
*/
interface IPermitControl {

  /// A special reserved constant for representing no rights.
  function ZERO_RIGHT () external view returns (bytes32);

  /// A special constant specifying the unique, universal-rights circumstance.
  function UNIVERSAL () external view returns (bytes32);
  
  /*
    A special constant specifying the unique manager right. This right allows an
    address to freely-manipulate the `managedRight` mapping.
  **/
  function MANAGER () external view returns (bytes32);

  /**
    Return a version number for this contract's interface.
  */
  function version () external view returns (uint256);

  /**
    Determine whether or not an address has some rights under the given
    circumstance, and if they do have the right, until when.
    @param _address The address to check for the specified `_right`.
    @param _circumstance The circumstance to check the specified `_right` for.
    @param _right The right to check for validity.
    @return The timestamp in seconds when the `_right` expires. If the timestamp
      is zero, we can assume that the user never had the right.
  */
  function hasRightUntil(
    address _address,
    bytes32 _circumstance,
    bytes32 _right
  ) external view returns (uint256);

   /**
    Determine whether or not an address has some rights under the given
    circumstance,
    @param _address The address to check for the specified `_right`.
    @param _circumstance The circumstance to check the specified `_right` for.
    @param _right The right to check for validity.
    @return true or false, whether user has rights and time is valid.
  */
  function hasRight(
    address _address,
    bytes32 _circumstance,
    bytes32 _right
  ) external view returns (bool);

  /**
    Set the permit to a specific address under some circumstances. A permit may
    only be set by the super-administrative contract owner or an address holding
    some delegated management permit.
    @param _address The address to assign the specified `_right` to.
    @param _circumstance The circumstance in which the `_right` is valid.
    @param _right The specific right to assign.
    @param _expirationTime The time when the `_right` expires for the provided
      `_circumstance`.
  */
  function setPermit(
    address _address,
    bytes32 _circumstance,
    bytes32 _right,
    uint256 _expirationTime
  ) external;

  /**
    Set the `_managerRight` whose `UNIVERSAL` holders may freely manage the
    specified `_managedRight`.
    @param _managedRight The right which is to have its manager set to
      `_managerRight`.
    @param _managerRight The right whose `UNIVERSAL` holders may manage
      `_managedRight`.
  */
  function setManagerRight(
    bytes32 _managedRight,
    bytes32 _managerRight
  ) external;

  /**
  * @dev Transfers ownership of the contract to a new account (`newOwner`).
  * Can only be called by the current owner.
  */
  function transferOwnership(address newOwner) external;
  
}