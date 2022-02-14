// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "./V3/ClaimOffchain.sol";

/**
 * @title SuperMarketplace
 * @author Rostislav Khlebnikov
 */
contract SuperMarketplace is ClaimOffchain {

    constructor (address burnAddress) ClaimOffchain(burnAddress){
        setPermit(msg.sender, UNIVERSAL, CREATE_CONFIG, type(uint256).max);
    }

}