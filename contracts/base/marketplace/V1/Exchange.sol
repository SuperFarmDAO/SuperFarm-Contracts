pragma solidity ^0.8.8;

import "./ExchangeCore.sol";

/**
 * @title modified WyvernExchangeV2 contract
 * @author Project Wyvern Developers
 * @author Rostislav Khlebnikov
 */
contract Exchange is ExchangeCore {

    /**
     * @dev Change the minimum maker fee paid to the protocol
     * @param newMinimumMakerProtocolFee New fee to set in basis points
     */
    function changeMinimumMakerProtocolFee(uint newMinimumMakerProtocolFee)
        external
        hasValidPermit(UNIVERSAL, SET_FEES)
    {
        minimumMakerProtocolFee = newMinimumMakerProtocolFee;
    }

    /**
     * @dev Change the minimum taker fee paid to the protocol
     * @param newMinimumTakerProtocolFee New fee to set in basis points
     */
    function changeMinimumTakerProtocolFee(uint newMinimumTakerProtocolFee)
        external
        hasValidPermit(UNIVERSAL, SET_FEES)
    {
        minimumTakerProtocolFee = newMinimumTakerProtocolFee;
    }

    /**
     * @dev Change the protocol fee recipient
     * @param newProtocolFeeRecipient New protocol fee recipient address
     */
    function changeProtocolFeeRecipient(address newProtocolFeeRecipient)
        external
        hasValidPermit(UNIVERSAL, SET_FEES)
    {
        protocolFeeRecipient = newProtocolFeeRecipient;
    }

    /**
     * @dev Call calculateFinalPrice 
     */
    function calculateFinalPrice(Sales.Side side, Sales.SaleKind saleKind, uint basePrice, uint extra, uint listingTime, uint expirationTime, uint endingPrice)
        external view
        returns (uint)
    {
        return Sales.calculateFinalPrice(side, saleKind, basePrice, extra, listingTime, expirationTime, endingPrice);
    }

    /**
     * @dev Call hashOrder
     */
    function hashOrder(Order calldata order)
        external pure
        returns (bytes32)
    {
        return _hashOrder(order);
    }

    /**
     * @dev Call hashToSign
     */
    function hashToSign(Order calldata order) external pure returns (bytes32)
    { 
        return _hashToSign(order);
    }

    /**
     * @dev Call validateOrderParameters
     */
    function validateOrderParameters(Order calldata order)
        external view
        returns (bool)
    {
        return _validateOrderParameters(order);
    }

    /**
     * @dev Call validateOrder
     */
    function validateOrder(Order calldata order, Sig calldata sig)
        external view
        returns (bool)
    {
        return _validateOrder(_hashToSign(order), order,sig);
    }

    /**
     * @dev Call approveOrder
     */
    function approveOrder_(Order calldata order, bool orderbookInclusionDesired)
        external
    {
        return _approveOrder(order, orderbookInclusionDesired);
    }

    /**
     * @dev Call cancelOrder
     */
    function cancelOrder_(Order calldata order, Sig calldata sig)
        external
    {
        return _cancelOrder(order, sig);
    }

    /**
     * @dev Call calculateCurrentPrice
     */
    function calculateCurrentPrice(Order calldata order)
        external view
        returns (uint)
    {
        return _calculateCurrentPrice(order);
    }

    /**
     * @dev Call ordersCanMatch
     */
    function ordersCanMatch(Order calldata buy, Order calldata sell)
        external view
        returns (bool)
    {
        return _ordersCanMatch(buy, sell);
    }

    /**
     * @dev Return whether or not two orders' calldata specifications can match
     * @param buyCalldata Buy-side order calldata
     * @param buyReplacementPattern Buy-side order calldata replacement mask
     * @param sellCalldata Sell-side order calldata
     * @param sellReplacementPattern Sell-side order calldata replacement mask
     * @return Whether the orders' calldata can be matched
     */
    function orderCalldataCanMatch(bytes memory buyCalldata, bytes calldata buyReplacementPattern, bytes memory sellCalldata, bytes calldata sellReplacementPattern)
        external pure
        returns (bool)
    {
        if (buyReplacementPattern.length > 0) {
          ArrayUtils.guardedArrayReplace(buyCalldata, sellCalldata, buyReplacementPattern);
        }
        if (sellReplacementPattern.length > 0) {
          ArrayUtils.guardedArrayReplace(sellCalldata, buyCalldata, sellReplacementPattern);
        }
        return ArrayUtils.arrayEq(buyCalldata, sellCalldata);
    }

    /**
     * @dev Call calculateMatchPrice 
     */
    function calculateMatchPrice(Order calldata buy, Order calldata sell)
        external view
        returns (uint)
    {
       return _calculateMatchPrice(buy, sell);
    }

    /**
     * @dev Call atomicMatch
     */
    function atomicMatch_(
        Order calldata buy,
        Sig calldata buySig,
        Order calldata sell,
        Sig calldata sellSig,
        bytes32 metadata,
        Order[] calldata toInvalidate,
        Sig[] calldata sigs
        )
        external payable
        nonReentrant
    {

        return _atomicMatch(buy, buySig, sell, sellSig, metadata, toInvalidate, sigs);
    }

}