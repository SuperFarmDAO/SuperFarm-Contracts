pragma solidity ^0.8.8;

import "../proxy/OwnableMutableDelegateProxy.sol";

/**
 * @title ProxyRegistry Interface
 * @author Rostislav Khlebnikov
 */
interface IProxyRegistry {

    function delegateProxyImplementation() external view returns (address);

    function proxies(address owner) external view returns (address);

    function authorizedCallers(address caller) external view returns (bool);

}