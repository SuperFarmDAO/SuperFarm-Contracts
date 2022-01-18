pragma solidity ^0.8.8;

import "./Iterator.sol";

/**
    @title Library for operating marketplace entities.
    @author Rostislav Khlebnikov.
 */
library Data {
    using IteratorLib for IteratorLib.Iterator;
    
    bytes32 private constant ACTIONS_TYPEHASH = keccak256(
            "Actions(bytes types,bytes targets,bytes args)"
        );

    bytes32 private constant ORDER_TYPEHASH = keccak256(
        "Order(address maker,Actions perform,address taker,Actions expect,uint256 end,uint256 start,uint256 salt,bytes fee)Actions(bytes types,bytes targets,bytes args)");

    struct Order {
        address maker;
        Actions perform;
        address taker;
        Actions expect;
        uint256 start;
        uint256 end;
        uint256 salt;
        bytes fee;
    }

    struct Actions {
        bytes types;
        bytes targets;
        bytes args;
    }

    struct Fill {
        bool open;
        mapping(uint256 => bool) parts;
    }

    function hash(Actions memory actions)  internal pure returns (bytes32){
        return keccak256(
            abi.encode(
                ACTIONS_TYPEHASH,
                keccak256(actions.types),
                keccak256(actions.targets),
                keccak256(actions.args)
            ));
    }

    function hash(Order memory order)  internal pure returns (bytes32){
        return keccak256(
            abi.encode(
                ORDER_TYPEHASH,
                order.maker,
                hash(order.perform),
                order.taker,
                hash(order.expect),
                order.start,
                order.end,
                order.salt,
                keccak256(order.fee)
            ));
    }    
    // Idea of matching actions is to use evm memory stack layout as a hashtable of key for loading N actions from calldaata, and iterator will just increment until calldata isnt read fully.
}
