// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
  @title A contract which may receive Ether and tokens.
  @author Protinam, Project Wyvern
  @author Tim Clancy

  This contract was originally developed by Project Wyvern
  (https://github.com/ProjectWyvern/) where it currently enjoys great success as
  a component of the exchange used by OpenSea. It has been modified to support a
  more modern version of Solidity with associated best practices. The
  documentation has also been improved to provide more clarity.
*/
contract TokenRecipient is Context {

  /**
    An event emitted when this contract receives Ether.

    @param sender The sender of the received Ether.
    @param amount The amount of Ether received.
  */
  event ReceivedEther(address indexed sender, uint256 amount);

  /**
    An event emitted when this contract receives ERC-20 tokens.

    @param from The sender of the tokens.
    @param value The amount of token received.
    @param token The address of the token received.
    @param extraData Any extra data associated with the transfer.
  */
  event ReceivedTokens(address indexed from, uint256 value,
    address indexed token, bytes extraData);

  /**
    Receive tokens from address `_from` and emit an event.

    @param _from The address from which tokens are transferred.
    @param _value The amount of tokens to transfer.
    @param _token The address of the tokens to receive.
    @param _extraData Any additional data with this token receipt to emit.
  */
  function receiveApproval(address _from, uint256 _value, address _token,
    bytes calldata _extraData) external {
    bool transferSuccess = IERC20(_token).transferFrom(_from, address(this),
      _value);
    require(transferSuccess,
      "TokenRecipient: failed to transfer tokens from ERC-20");
    emit ReceivedTokens(_from, _value, _token, _extraData);
  }

  /**
    Receive Ether and emit an event.
  */
  receive() external virtual payable {
    emit ReceivedEther(_msgSender(), msg.value);
  }
}
