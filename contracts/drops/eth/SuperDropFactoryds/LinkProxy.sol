// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
  @title Link proxy contract
  @author Qazawat Zirak
  This contract stores function to facet addresses.
*/
contract LinkProxy is Ownable {

  // Hash of Selector 4 bytes and Contract Name
  mapping (bytes32 => address) public links;

  function registerLink(bytes32 selector, address facet) external onlyOwner {
    links[selector] = facet;
  }
}
