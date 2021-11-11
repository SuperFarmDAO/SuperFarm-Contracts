pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IProxyRegistry.sol";

contract TokenTransferProxy {

    /* Authentication registry. */
    IProxyRegistry public registry;

    /**
        @param _registry address of the proxy registry
     */
    constructor (address _registry){
        registry = IProxyRegistry(_registry);
    }

    /**
     * Call ERC20 `transferFrom`
     *
     * @dev Authenticated contract only
     * @param token ERC20 token address
     * @param from From address
     * @param to To address
     * @param amount Transfer amount
     */
    function transferFrom(address token, address from, address to, uint amount)
        public
        returns (bool)
    {   
        require(registry.authorizedCallers(msg.sender));
        return IERC20(token).transferFrom(from, to, amount);
    }

}