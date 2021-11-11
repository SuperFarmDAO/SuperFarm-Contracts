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
        return (saleKind == SaleKind.SaleFixedPrice || saleKind == SaleKind.SaleDecreasingPrice || saleKind == SaleKind.Offer || (saleKind == SaleKind.Auction && expirationTime > 0));
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
     * @param saleKind Method of sale
     * @param basePrice Order base price
     * @param extra Order extra price and time data
     * @param listingTime Order listing time
     */
    function calculateFinalPrice(SaleKind saleKind, uint basePrice, uint[] memory extra, uint listingTime)
        view
        internal
        returns (uint finalPrice)
    {
        if (saleKind == SaleKind.SaleDecreasingPrice) {
            if(block.timestamp <= listingTime) {
                return basePrice;
            }
            if(block.timestamp >= extra[1]) {
                return extra[0];
            }
            uint res = (basePrice - extra[0])*((extra[1] - block.timestamp) / 60)/((extra[1] - listingTime)/60); // priceMaxRange * minutesPassed / totalListingMinutes
            return extra[0] + res;
        } else {
            return basePrice;
        }
    }

}