/*
  Abstract over fixed-price sales and Dutch auctions, with the intent of easily supporting additional methods of sale later.
  Separated into a library for convenience, all the functions are inlined.
*/

pragma solidity ^0.8.8;

/**
 * @title SaleKindInterface
 * @author Project Wyvern Developers
 */
library Sales {

    /**
     * Side: buy or sell.
     */
    enum Side { Buy, Sell }

    /**
     * Currently supported kinds of sale: fixed price, Dutch auction, DecreasingPrice. 
     * English auctions cannot be supported without stronger escrow guarantees.
     * Future interesting options: Vickrey auction, nonlinear Dutch auctions.
     */
    // enum SaleKind { FixedPrice, DutchAuction, DecreasingPrice }

    enum SaleKind {
        SaleFixedPrice,
        SaleDecreasingPrice,
        Auction,
        Offer
    }

    /**
     * @dev Check whether the parameters of a sale are valid
     * @param saleKind Kind of sale
     * @param expirationTime Order expiration time
     * @return Whether the parameters were valid
     */
    function validateParameters(SaleKind saleKind, uint expirationTime)
        pure
        internal
        returns (bool)
    {
        /* Auctions must have a set expiration date. */
        return (saleKind == SaleKind.SaleFixedPrice || saleKind == SaleKind.SaleDecreasingPrice || saleKind == SaleKind.Auction || saleKind == SaleKind.Offer ||  expirationTime > 0);
    }

    /**
     * @dev Return whether or not an order can be settled
     * @dev Precondition: parameters have passed validateParameters
     * @param listingTime Order listing time
     * @param expirationTime Order expiration time
     */
    function canSettleOrder(uint listingTime, uint expirationTime)
        view
        internal
        returns (bool)
    {
        return (listingTime < block.timestamp) && (expirationTime == 0 || block.timestamp < expirationTime);
    }

    /**
     * @dev Calculate the settlement price of an order
     * @dev Precondition: parameters have passed validateParameters.
     * @param side Order side
     * @param saleKind Method of sale
     * @param basePrice Order base price
     * @param extra Order extra price data
     * @param listingTime Order listing time
     * @param expirationTime Order expiration time
     */
    function calculateFinalPrice(Side side, SaleKind saleKind, uint basePrice, uint extra, uint listingTime, uint expirationTime)
        view
        internal
        returns (uint finalPrice)
    {
        if (saleKind == SaleKind.Offer || saleKind == SaleKind.SaleFixedPrice || saleKind == SaleKind.Auction ) {
            return basePrice;
        } else if (saleKind == SaleKind.SaleDecreasingPrice) {
            //lowering price by 1sec
            uint decreasedPrice = 60 * ((basePrice - extra) / (expirationTime - listingTime));
            uint res = ((block.timestamp - listingTime) / 60) * decreasedPrice;
            if (basePrice - res <= extra) return extra;
            return basePrice - res;
        }
    }

}