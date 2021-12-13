// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "./V1/Exchange.sol";

/**
 * @title SuperMarketplace
 * @author Rostislav Khlebnikov
 */
contract SuperMarketplace is Exchange {

    string public constant name = "Super Marketplace";
  
    string public constant marketplaceVersion = "1";

    /**
    * @param _registries array of existing registry addresses
    * @param _personalSignPrefix  "\x19Ethereum Signed Message:\n"
    */
    constructor (address[] memory _registries, bytes memory _personalSignPrefix, address _tokenTransferProxy, address _platformFeeAddress, uint _minimumPlatformFee) ExchangeCore(name, marketplaceVersion){
        registry = _registries[0];
        tokenTransferProxy = _tokenTransferProxy;
        platformFeeAddress = _platformFeeAddress;
        minimumPlatformFee = _minimumPlatformFee;
        for (uint index = 0; index < _registries.length; index++) {
          registries[_registries[index]] = true;
        }
        if (_personalSignPrefix.length > 0) {
          personalSignPrefix = _personalSignPrefix;
        }
    }

}