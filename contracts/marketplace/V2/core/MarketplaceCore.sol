pragma solidity ^0.8.8;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "../../../libraries/EIP712.sol";
import "../../../libraries/EIP1271.sol";
import "../fees/MarketplaceFees.sol";
import "./Data.sol";

/**
    @title MarketplaceCore contract of SuperMarketplace second version.
    @author Rostislav Khlebnikov.
 */
abstract contract MarketplaceCore is MarketplaceFees, ReentrancyGuard, EIP712 {
    /**  The public identifier for the right to set new items. */
    bytes32 public constant PROXY_CONFIG = keccak256("PROXY_CONFIG");

    /** Token transfer proxy address. */
    address public transferProxy;

    /** Storing state of the order: order hash => fill. */
    mapping(bytes32 => Data.Fill) fills;

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
        uint256 platformFee,
        string memory name,
        string memory version
    ) MarketplaceFees(platformFeeRecipient, platformFee) EIP712(name, version) {
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
