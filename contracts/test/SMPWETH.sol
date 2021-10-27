// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestWETH is Ownable, ERC20("Test Wrapped Ether", "TWETH"){
    constructor(){
        _mint(msg.sender, 10_000*10^decimals());
    }

    function mint(address account, uint256 amount) external onlyOwner{
        _mint(account, amount);
    }
}