pragma solidity ^0.8.8;

/**
    @title Library for operating marketplace entities.
    @author Rostislav Khlebnikov.
 */
library Entity {
    bytes32 private constant ACTIONS_TYPEHASH =
        keccak256("Actions(bytes types,bytes targets,bytes args)");

    bytes32 private constant ORDER_TYPEHASH =
        keccak256(
            "Order(address maker,Actions perform,address taker,Actions expect,uint256 end,uint256 start,uint256 saltbytes circumstances,bytes royalties)Actions(bytes types,bytes targets,bytes args)"
        );

    struct Order {
        address maker;
        Actions perform;
        address taker;
        Actions expect;
        uint256 start;
        uint256 end;
        uint256 salt;
        bytes circumstances;
        bytes royalties;
    }

    struct Actions {
        bytes types;
        bytes targets;
        bytes args;
    }

    struct State {
        uint256 length;
        uint256 current;
    }
    struct Fill {
        State state;
        mapping(uint256 => bool) actions;
    }

    function hash(Actions calldata actions) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    ACTIONS_TYPEHASH,
                    keccak256(actions.types),
                    keccak256(actions.targets),
                    keccak256(actions.args)
                )
            );
    }

    function hash(Order calldata order) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    ORDER_TYPEHASH,
                    order.maker,
                    hash(order.perform),
                    order.taker,
                    hash(order.expect),
                    order.start,
                    order.end,
                    order.salt,
                    keccak256(order.circumstances),
                    keccak256(order.royalties)
                )
            );
    }

    function isFull(State memory state) internal pure returns (bool) {
        return state.current >= state.length && state.length > 0;
    }
    // Idea: use calldata as trusted layout for Actions to come in and parse accordingly. ~63gas per read.
    // Idea: matching actions is to use evm memory stack layout as a hashtable of key for loading N actions from calldaata, and iterator will just increment until calldata isnt read fully. ~218 gas per match.
}
