pragma solidity ^0.8.8;

import "../../../access/PermitControl.sol";

/**
    @title MarketplaceFees is a logic domain of Marketplace which handles
    @author Rostislav Khlebnikov.
 */
abstract contract MarketplaceFees is PermitControl {
    /**  The public identifier for the right to set new items. */
    bytes32 internal constant FEE_CONFIG = keccak256("FEE_CONFIG");

    /** Address of a platform fee recipient. */
    address payable public platformFeeRecipient;

    /** Plarform fee amount in percents, e.g. 2% = 200. */
    uint256 public platformFee;

    /**
        Emmited when platform fee amount is changed.
        @param oldPlatformFee previous amount of platform fees.
        @param newPlatformFee new amount of platform fees.
     */
    event platformFeeChanged(uint256 oldPlatformFee, uint256 newPlatformFee);
    /**
        Emmited when platform fee recipient address is changed.
        @param oldPlatformFeeRecipient previous recipient address of platform fees.
        @param newPlatformFeeRecipient new recipient address of platform fees.
     */
    event platformFeeRecipientChanged(
        address oldPlatformFeeRecipient,
        address newPlatformFeeRecipient
    );

    constructor(address payable _platformFeeRecipient, uint256 _platformFee) {
        require(
            _platformFeeRecipient != address(0),
            "MarketplaceFees: recipient can not be address(0)"
        );
        platformFeeRecipient = _platformFeeRecipient;
        platformFee = _platformFee;
    }

    /**
        @dev Changes amount of fees for the platform
        @param newPlatformFee new amount of fees in percent, e.g. 2% = 200.
     */
    function changePlatformFee(uint256 newPlatformFee)
        external
        hasValidPermit(UNIVERSAL, FEE_CONFIG)
    {
        uint256 oldPlatformFee = platformFee;
        platformFee = newPlatformFee;
        emit platformFeeChanged(oldPlatformFee, newPlatformFee);
    }

    /**
        @dev Changes amount of fees for the platform
        @param newPlatformFeeRecipient new recipient address.
     */
    function changePlatformFeeRecipient(address payable newPlatformFeeRecipient)
        external
        hasValidPermit(UNIVERSAL, FEE_CONFIG)
    {
        require(
            newPlatformFeeRecipient != address(0),
            "MarketplaceFees: recipient can not be address(0)"
        );
        address oldPlatformFeeRecipient = platformFeeRecipient;
        platformFeeRecipient = newPlatformFeeRecipient;
        emit platformFeeRecipientChanged(
            oldPlatformFeeRecipient,
            newPlatformFeeRecipient
        );
    }
}
