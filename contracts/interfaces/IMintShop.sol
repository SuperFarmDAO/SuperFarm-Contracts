// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "./ISuper1155.sol";

interface IMintShop {
    function addPool(
        LibStorage.PoolInput calldata _pool,
        uint256[] calldata _groupIds,
        uint256[] calldata _issueNumberOffsets,
        uint256[] calldata _caps,
        LibStorage.Price[][] memory _prices
    ) external;

    function initialize(
        address _owner,
        ISuper1155 _item,
        address _paymentReceiver,
        uint256 _globalPurchaseLimit
    ) external;
}
