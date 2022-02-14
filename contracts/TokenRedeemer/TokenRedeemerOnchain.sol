// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "./V3/ClaimOnchain.sol";

/**
 * @title SuperMarketplace
 * @author Rostislav Khlebnikov
 */
contract SuperMarketplace is ClaimOnchain {

   
    constructor (address burnAddress) ClaimOnchain(burnAddress){
        setPermit(msg.sender, UNIVERSAL, CREATE_CONFIG, type(uint256).max);
    }

}