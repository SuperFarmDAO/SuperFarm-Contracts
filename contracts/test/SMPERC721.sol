// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestERC721 is Ownable, ERC721("Test ERC721 Token","T721"){

  constructor () { }

  function mint(address to, uint256 tokenId) external onlyOwner{
    _safeMint(to, tokenId);
  }
}
