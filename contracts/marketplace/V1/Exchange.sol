pragma solidity ^0.8.8;

import "./ExchangeCore.sol";

/**
 * @title modified WyvernExchangeV2 contract
 * @author Project Wyvern Developers
 * @author Rostislav Khlebnikov
 */
abstract contract Exchange is ExchangeCore {

    /**
     * @dev Change the minimum amount of fees
     * @param _newFees New fee to set
     */
    function changeMarketplaceFees(Fees calldata _newFees)
        external
        hasValidPermit(UNIVERSAL, FEE_CONFIG)
    {
        fees.minimumProtocolFee = _newFees.minimumProtocolFee;
        fees.minimumPlatformFee = _newFees.minimumPlatformFee;
        fees.platformFeeAddress = _newFees.platformFeeAddress;
        fees.protocolFeeAddress = _newFees.protocolFeeAddress;
    }

    /**
     * @dev Change the minimum taker fee paid to the protocol
     * @param newMinimumProtocolFee New fee to set in basis points
     */
    function changeMinimumProtocolFee(uint newMinimumProtocolFee)
        external
        hasValidPermit(UNIVERSAL, FEE_CONFIG)
    {
        fees.minimumProtocolFee = newMinimumProtocolFee;
    }

    /**
     * @dev Change the minimum taker fee paid to the platform
     * @param newMinimumPlatformFee New fee to set in basis points
     */
    function changeMinimumPlatformFee(uint newMinimumPlatformFee)
        external
        hasValidPermit(UNIVERSAL, FEE_CONFIG)
    {
        fees.minimumPlatformFee = newMinimumPlatformFee;
    }

    /**
     * @dev Change the address of platform for protocol fees
     * @param newProtocolFeeAddress New fee address
     */
    function changeProtocolFeeAddress(address newProtocolFeeAddress)
        external
        hasValidPermit(UNIVERSAL, FEE_CONFIG)
    {
        fees.protocolFeeAddress = newProtocolFeeAddress;
    }

    /**
     * @dev Change the address of platform for royalty fees
     * @param newPlatformFeeAddress New fee address
     */
    function changePlatformFeeAddress(address newPlatformFeeAddress)
        external
        hasValidPermit(UNIVERSAL, FEE_CONFIG)
    {
        fees.platformFeeAddress = newPlatformFeeAddress;
    }

    function getFees() external view returns(Fees memory){
        return fees;
    }

    /**
     * @dev Call calculateFinalPrice 
     */
    function calculateFinalPrice(Sales.SaleKind saleKind, uint basePrice, uint[] calldata extra, uint listingTime)
        external view
        returns (uint)
    {
        return Sales.calculateFinalPrice(saleKind, basePrice, extra, listingTime);
    }

    /**
     * @dev Call hashOrder
     */
    function hashOrder(Order calldata order)
        external pure
        returns (bytes32)
    {
        return _hash(order);
    }

    /**
     * @dev Call hashToSign
     */
    function hashToSign(Order calldata order) external view returns (bytes32)
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
    function validateOrderAthentication(Order calldata order, Sig calldata sig)
        external view
        returns (bool)
    {
        return authenticateOrder(_hashToSign(order), order.outline.maker, sig);
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
    function cancelOrder_(Order calldata order,Sig calldata sig)
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
    function ordersMatch(Order calldata buy, Order calldata sell)
        external pure
        returns (bool)
    {
        return _ordersMatch(buy, sell);
    }

    /**
     * @dev Return whether or not two orders' calldata specifications can match
     * @param buyCalldata Buy-side order calldata
     * @param buyReplacementPattern Buy-side order calldata replacement mask
     * @param sellCalldata Sell-side order calldata
     * @param sellReplacementPattern Sell-side order calldata replacement mask
     * @return Whether the orders' calldata can be matched
     */
    function orderCalldataCanMatch(bytes calldata buyCalldata, bytes calldata buyReplacementPattern, bytes calldata sellCalldata, bytes calldata sellReplacementPattern)
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
        Sig calldata sigBuy,
        Order calldata sell,
        Sig calldata sigSell,
        Order[] calldata toInvalidate,
        Sig[] calldata sigs
        )
        external payable
        nonReentrant
    {
        return _atomicMatch(buy, sigBuy, sell, sigSell, toInvalidate, sigs);
    }

}