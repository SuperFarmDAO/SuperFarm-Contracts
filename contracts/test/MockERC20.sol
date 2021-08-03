//SPDX-License-Identifier: mit
pragma solidity >= 0.6.2 < 0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockERC20 is ERC20, Ownable {
  string private TOKEN_NAME;
  string private TOKEN_SYMBOL;

  constructor(string memory tokenName, string memory tokenSymbol, uint256 initialSupply) ERC20(TOKEN_NAME, TOKEN_SYMBOL) {
     TOKEN_NAME = tokenName;
     TOKEN_SYMBOL = tokenSymbol;
    _mint(msg.sender, initialSupply);
  }

  function mint(address to, uint256 amount) public onlyOwner() {
    _mint(to, amount);
  }

  function burn(address from, uint256 amount) public onlyOwner() {
    _burn(from, amount);
  }
}