// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20("MockERC20", "M20"){
    constructor() {
        _mint(msg.sender, 10000000 * 10 ** 18); //Initial Supply
    }
}