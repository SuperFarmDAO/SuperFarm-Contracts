// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestExchangeToken is Ownable, ERC20("TestExchangeToken", "TET") {

    constructor(){
        _mint(msg.sender, 1000*10^decimals());
    }

    function mint(address account, uint256 amount) external onlyOwner{
        _mint(account, amount);
    }
}