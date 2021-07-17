// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/Context.sol";

import "../access/PermitControl.sol";

/**
  @title A contract with a name.
  @author Tim Clancy

  This basic contract has a name which can be edited by those with permission.
*/
contract Named is PermitControl {

  /// The public name of this contract.
  string public name;

  /// The public identifier for the right to edit this contract's name.
  bytes32 public constant UPDATE_NAME = keccak256("UPDATE_NAME");

  /**
    An event emitted when the name of this contract is updated.

    @param updater The address which updated this contract's name.
    @param oldName The old name of this contract.
    @param newName The new name of this contract.
  */
  event NameUpdated(address indexed updater, string indexed oldName, string indexed newName);

  /**
    Construct a new contract with a specified name.

    @param _name The name to assign to this contract.
  */
  constructor(string memory _name) public {
    name = _name;
    emit NameUpdated(_msgSender(), "", _name);
  }

  /**
    Allow those with permission to set the name of this contract to `_name`.

    @param _name The new name of this contract.
  */
  function setName(string calldata _name) external virtual hasValidPermit(UNIVERSAL, UPDATE_NAME) {
    emit NameUpdated(_msgSender(), name, _name);
    name = _name;
  }
}
