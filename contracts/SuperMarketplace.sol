// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "./base/marketplace/V1/Exchange.sol";

/**
 * @title SuperMarketplace
 * @author Rostislav Khlebnikov
 */
contract SuperMarketplace is Exchange {

    string public constant name = "Super Marketplace";
  
    string public constant marketplaceVersion = "1";

    /**
    * @param chainId id of the chain
    * @param _registries array of existing registry addresses
    * @param _personalSignPrefix  "\x19Ethereum Signed Message:\n"
    */
    constructor (uint chainId, address[] memory _registries, bytes memory _personalSignPrefix, address _exchangeToken, address _tokenTransferProxy, address _protocolFeeRecipient) {
        DOMAIN_SEPARATOR = hash(EIP712Domain({
            name              : name,
            version           : marketplaceVersion,
            chainId           : chainId,
            verifyingContract : address(this)
        }));
        registry = _registries[0];
        exchangeToken = _exchangeToken;
        tokenTransferProxy = _tokenTransferProxy;
        protocolFeeRecipient = _protocolFeeRecipient;
        for (uint index = 0; index < _registries.length; index++) {
          registries[_registries[index]] = true;
        }
        if (_personalSignPrefix.length > 0) {
          personalSignPrefix = _personalSignPrefix;
        }
    }

}