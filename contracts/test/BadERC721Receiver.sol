pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract BadERC721Receiver is IERC721Receiver {
    constructor() {
	}

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
        )
        external
        override
        returns(bytes4)
        {
            if (tokenId == 0x03e700000000000000000000000000000000) { // arbitrary fail trigger for testing
                return bytes4('Fu');
            } else {
                return this.onERC721Received.selector;
            }
        }
}
