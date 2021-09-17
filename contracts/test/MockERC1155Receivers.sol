// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

// Response is Selector
contract MockERC1155Receiver1 is IERC1155Receiver {
    constructor() {
	}

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
        )
        external
        override
        returns(bytes4)
        {//0x0000000000000000000000000000000100000000000000000000000000000001 // id of the token transfered from Super1155
            if (id == 0x03e700000000000000000000000000000000) { // arbitrary fail trigger for testing
                return bytes4('Fu');
            } else {
                return this.onERC1155Received.selector;
            }
        }

        // Assuming there is only one token in the ids
        function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external override returns (bytes4) {
        //0x0000000000000000000000000000000100000000000000000000000000000001 // id of the token transfered from Super1155
            if (ids[0] == 0x03e700000000000000000000000000000000) { // arbitrary fail trigger for testing
                return bytes4('Fu');
            } else {
                return this.onERC1155BatchReceived.selector;
            }

    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IERC165).interfaceId;
    }
}

// Response is not a selector
contract MockERC1155Receiver2 is IERC1155Receiver {
    constructor() {
	}

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
        )
        external
        override
        returns(bytes4)
        {
            if (id == 0x03e700000000000000000000000000000000) { // arbitrary fail trigger for testing
                return bytes4('Fu');
            } else {
                return "test";
            }
        }

        // Assuming there is only one token in the ids
        function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external override returns (bytes4) {
            if (ids[0] == 0x03e700000000000000000000000000000000) { // arbitrary fail trigger for testing
                return bytes4('Fu');
            } else {
                return "test";
            }
    }

    function supportsInterface(bytes4 interfaceId) public override view virtual  returns (bool) {
        return interfaceId == type(IERC165).interfaceId;
    }
}

// Response is an error
contract MockERC1155Receiver3 {
    constructor() {
	}

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
        )
        external
        pure

        {
 
        }

        // Assuming there is only one token in the ids
        function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external  returns (bytes4) {
            if (ids[0] == 0x03e700000000000000000000000000000000) { // arbitrary fail trigger for testing
                return bytes4('Fu');
            } else {
                return "test";
            }
    }

    function supportsInterface(bytes4 interfaceId) public  view virtual  returns (bool) {
        return interfaceId == type(IERC165).interfaceId;
    }
}
