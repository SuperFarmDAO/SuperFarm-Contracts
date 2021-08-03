pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

contract BadERC1155Receiver is IERC1155Receiver {
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
            if (value == 2) { // arbitrary fail trigger for testing
                return bytes4('Fu');
            } else {
                return this.onERC1155Received.selector;
            }
        }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
        )
        external
        override
        returns(bytes4)
        {
            if (values[0] == 2) { // arbitrary fail trigger for testing
                return bytes4('Fu');
            } else {
                return this.onERC1155BatchReceived.selector;
            }
        }

    function supportsInterface(bytes4 interfaceId) external override view returns (bool) {
        return true;
    }
}