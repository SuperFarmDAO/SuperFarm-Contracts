pragma solidity ^0.8.8;

import "./MarketplaceFees.sol";

/**
    @title MarketplaceExecutor is a logic domain of Marketplace which handles funds transferring.
    @author Rostislav Khlebnikov.
 */
abstract contract MarketplaceExecutor is MarketplaceFees {
    /**  The public identifier for the right to set new items. */
    bytes32 public constant PROXY_CONFIG = keccak256("PROXY_CONFIG");

    /** Token transfer proxy address. */
    address public transferProxy;

    /**
        @dev Emmited when transfer proxy address is changed.
        @param oldTransferProxy previous address of a transfer proxy.
        @param newTransferProxy new address of a transfer proxy.
     */
    event transferProxyChanged(
        address oldTransferProxy,
        address newTransferProxy
    );

    constructor(
        address _transferProxy,
        address payable platformFeeRecipient,
        uint256 platformFee
    ) MarketplaceFees(platformFeeRecipient, platformFee) {
        transferProxy = _transferProxy;
    }

    /**
        @dev Changes transfer proxy address.
        @param newTransferProxy new address of a transfer proxy.
     */
    function changeTransferProxy(address newTransferProxy)
        external
        hasValidPermit(UNIVERSAL, PROXY_CONFIG)
    {
        require(
            newTransferProxy != address(0),
            "MarketplaceCore: transfer can not be address(0)"
        );
        address oldTransferProxy = transferProxy;
        transferProxy = newTransferProxy;
        emit transferProxyChanged(oldTransferProxy, newTransferProxy);
    }
}
