pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

// When response is a selector
contract MockERC721Receiver1 is IERC721Receiver {
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

// When response is not a selector
contract MockERC721Receiver2 is IERC721Receiver {
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
                return "test";
            }
        }
}

