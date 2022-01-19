library Iterators {
    struct ActionIterator{
        uint256 type_i;
        uint256 target_i;
        uint256 args_i;
    }

    function increment(ActionIterator memory iterator)
        internal
        pure
        returns (ActionIterator memory)
    {
        iterator.type_i += 4;
        iterator.target_i += 20;
        iterator.args_i += 32;
        return iterator;
    }

    struct CircumstanceIterator{
        uint256 type_i;
        uint256 pointer;
    }
    
    function increment(CircumstanceIterator memory iterator) internal pure returns(CircumstanceIterator memory){
        iterator.type_i += 20+32;
        iterator.pointer += 32;
        return iterator;
    }
}
