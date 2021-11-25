// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestERC1155 is Ownable, ERC1155("https://assets.teenvogue.com/photos/5b6c7f450128e376b7a792eb/16:9/w_2560%2Cc_limit/GettyImages-513923329.jpg"){
    constructor(){}

    function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts, bytes calldata data) external onlyOwner{
        _mintBatch(to, ids, amounts, data);
    }

    function mint(address account, uint256 id, uint256 amount, bytes calldata data) external onlyOwner{
        _mint(account, id, amount, data);
    }
}