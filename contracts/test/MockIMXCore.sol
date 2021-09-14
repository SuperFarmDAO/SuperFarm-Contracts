pragma solidity 0.7.6;

import '../Super721IMX.sol';

/**
    This contract pretends to be the IMX core, which calls the
    mintFor function in the IMX721.sol.
 */
contract MockIMXCore {
    Super721IMX instance;
    constructor(){
    }

    function mintFor(address _to, uint256 _id, bytes calldata _blueprint) public {
        instance.mintFor(_to, _id, _blueprint);
    }

    function setSuper721Address(address _instance) public
    {
        instance = Super721IMX(_instance);
    }

}