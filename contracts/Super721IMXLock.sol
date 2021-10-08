// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "./access/PermitControl.sol";

/**
  @title An ERC-721IMX item collections global lock contract.
  @author Qazawat Zirak
  This contract serves as a global lock for the mintFor function for all 
  deployed 721IMX instances. This prevents bad L2 minting if keys were
  compromised.
*/
contract Super721IMXLock is PermitControl {

  /// The public identifier for the right to execute the toggleMintFor fucntion.
  bytes32 public constant TOGGLE_MINT_FOR = keccak256("TOGGLE_MINT_FOR");

  /// Whether or not the mintFor is disabled
  bool public mintForLocked;

  /**
    An event that gets emitted when the mintForLocked variable is set to true.
    @param locker The caller who locked the collection.
  */
  event MintForLocked(address indexed locker, uint256 timestamp, bool oldValue, bool newValue);

  /**
    An event that gets emitted when the mintForLocked variable is set to false.
    @param locker The caller who locked the collection.
  */
  event MintForUnlocked(address indexed locker, uint256 timestamp, bool oldValue, bool newValue);

  /**
    Construct a new ERC-721 item collections global lock.
    @param _owner The address of the owner of this contract.
  */
  constructor(address _owner) {
    if (_owner != owner()) {
      transferOwnership(_owner);
    }
  }

  /** 
    Toggling control for the mintFor function ability to mint based on
    mintForLocked variable.
  */
  function toggleMintFor() external hasValidPermit(UNIVERSAL, TOGGLE_MINT_FOR) {
    bool oldValue = mintForLocked;
    if (mintForLocked) {
      mintForLocked = false;
      emit MintForUnlocked(msg.sender, block.timestamp, oldValue, mintForLocked);
    } else {
      mintForLocked = true;
      emit MintForLocked(msg.sender, block.timestamp, oldValue, mintForLocked);
    }
  }
}