// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "./core/MarketplaceCore.sol";

/**
 * @title SuperMarketplace version 2.
 * @author Rostislav Khlebnikov
 */
contract SuperMarketplaceV2 is MarketplaceCore {
    string public constant name = "Super Marketplace";

    /**
        @param transferProxy  existing token transfer proxy  address.
        @param platformFeeRecipient  address of a platform fee recipient.
        @param platformFee platform fee amount in percents, e.g. 2% = 200.
     */
    constructor(
        address transferProxy,
        address payable platformFeeRecipient,
        uint256 platformFee
    )
        MarketplaceCore(
            transferProxy,
            platformFeeRecipient,
            platformFee,
            name,
            string(abi.encodePacked(version()))
        )
    {
        setPermit(_msgSender(), UNIVERSAL, FEE_CONFIG, type(uint256).max);
    }

    function version() public pure override returns (uint256) {
        return 2;
    }

    /**
        @dev Invalidates order.
        @param order Order to cancel.
     */
    function cancelOrder(Entity.Order calldata order) internal {
        require(
            _msgSender() == order.maker,
            "Marketplace: you can not cancel this order."
        );
        _cancelOrder(order);
    }

    /**
        @dev Validates orders and executes actions. One of the order makers has to be msg.sender.
        @param signature signature of one of the orders.
     */
    function exchange(
        Entity.Order calldata first,
        Entity.Order calldata second,
        bytes calldata signature
    ) external nonReentrant {
        require(
            signature.length == 65,
            "Marketplace: invalid ECDSA signature length."
        );
        _exchange(first, second, signature);
    }
}
