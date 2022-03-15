// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestERC721 is Ownable, ERC721("Test ERC721 Token", "T721") {
    constructor() {}

    function mint(address to, uint256 tokenId) external onlyOwner {
        _safeMint(to, tokenId);
    }

    function mintBatch(
        address _recipient,
        uint256[] calldata _ids,
        bytes memory _data
    ) external onlyOwner {
        require(
            _recipient != address(0),
            "SMPERC721::mintBatch: mint to the zero address"
        );
        for (uint256 i; i < _ids.length; i++) {
            _safeMint(_recipient, _ids[i]);
        }
    }

    function burnBatch(address _burner, uint256[] memory _ids)
        external
        onlyOwner
    {
        require(
            _burner != address(0),
            "SMPERC721::mintBatch: mint to the zero address"
        );
        for (uint256 i; i < _ids.length; i++) {
            _burn(_ids[i]);
        }
    }
}
