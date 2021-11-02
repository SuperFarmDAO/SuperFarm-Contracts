/*
  Abstract over fees/royalty calculation, with the intent of easily supporting additional methods later.
  Separated into a library for convenience, all the functions are inlined.
*/

pragma solidity ^0.8.8;

/**
 * @title FeesCalculation
 * @author Qazawat Zirak
 */
library Fees {
    /* Inverse basis point. */
    uint public constant INVERSE_BASIS_POINT = 10000;

     /**
     * @dev Calculate royalty fees
     * @param _addresses group number to addresses, that will get royalty
     * @param _fees group number to the fees
     * @param _requiredAmount the base amount for the exchange to happen
     * @return platformFees - platform royalty fees, creatorFees - creator royalty fees, 
     *  feeRecipient - address of platform fee receiver, creatorAddress - address of creator fee receiver
     */
    function chargeFee(address[][] memory _addresses, uint[] memory _fees, uint _requiredAmount)
        internal pure returns(address[] memory, uint[] memory)
    {  
        require(_addresses.length == _fees.length, "Fees: price array and addresses map mismatch.");
        uint256 length;
        for (uint256 x = 0; x < _addresses.length; x++) {
            length += _addresses[x].length;
        }
        address[] memory addresses = new address[](length);
        uint256[] memory fees = new uint256[](length);
        uint index;
        for (uint i = 0; i < _fees.length; i++){
            for(uint j = 0; j < _addresses[i].length; j++){
                addresses[index] = _addresses[i][j];
                fees[index] = (_requiredAmount*_fees[i])/INVERSE_BASIS_POINT;
                index++;
            }
        } 
        return (addresses, fees);
    }

}