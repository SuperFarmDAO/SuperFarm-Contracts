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
    * @param _registry  existing registry address
    * @param _personalSignPrefix  "\x19Ethereum Signed Message:\n"
    */
    constructor (address _registry, bytes memory _personalSignPrefix, address _tokenTransferProxy, address _platformFeeAddress, uint _minimumPlatformFee, address _protocolFeeAddress, uint _minimumProtocolFee) ExchangeCore(name, marketplaceVersion){
        registry = _registry;
        tokenTransferProxy = _tokenTransferProxy;
        fees.platformFeeAddress = _platformFeeAddress;
        fees.minimumPlatformFee = _minimumPlatformFee;
        if (_personalSignPrefix.length > 0) {
          personalSignPrefix = _personalSignPrefix;
        }
        fees.protocolFeeAddress = _protocolFeeAddress;
        fees.minimumProtocolFee = _minimumProtocolFee;
        setPermit(_msgSender(), UNIVERSAL, FEE_CONFIG, type(uint256).max);
    }

}