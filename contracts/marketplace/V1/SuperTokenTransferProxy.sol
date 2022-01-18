pragma solidity ^0.8.8;

import "../../proxy/TokenTransferProxy.sol";

/**
    @title Contract, which will transfer erc20 tokens on users behalf
    @author Rostislav Khlebnikov
 */
contract SuperTokenTransferProxy is TokenTransferProxy {

    string public name = "Super Token Transfer Proxy";

    /**
        call TokenTrasferProxy constructor
     */
    constructor (address registryAddr)TokenTransferProxy(registryAddr){}
}