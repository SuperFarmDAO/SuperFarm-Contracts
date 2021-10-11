// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "./ISuper1155.sol";

interface IMintShop {
    function addPool(
        DFStorage.PoolInput calldata _pool,
        uint256[] calldata _groupIds,
        uint256[] calldata _issueNumberOffsets,
        uint256[] calldata _caps,
        DFStorage.Price[][] memory _prices
    ) external;

    function _transferOwnership(address _owner) external;

    function addWhitelist(DFStorage.WhitelistInput memory _whitelist) external;

    function setItems(ISuper1155[] memory _items) external;
}
