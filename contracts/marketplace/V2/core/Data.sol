pragma solidity ^0.8.8;

import "./Iterator.sol";

/**
    @title Library for operating marketplace entities.
    @author Rostislav Khlebnikov.
 */
library Data {
    using IteratorLib for IteratorLib.Iterator;
    
    struct Order {
        address maker;
        Actions perform;
        address taker;
        Actions expect;
        uint256 end;
        uint256 start;
        uint256 salt;
    }

    struct Actions {
        bytes types;
        bytes targets;
        bytes selectors;
    }

    struct Fill {
        bool open;
        mapping(uint256 => bool) parts;
    }

    
    // Idea of matching actions is to use evm memory stack layout as a hashtable of key for loading N actions from calldaata, and iterator will just increment until calldata isnt read fully.
}
