
library IteratorLib{

    struct Iterator{
        uint256 type_i;
        uint256 target_i;
        uint256 selector_i;
    }
    //ITERATOR SHOULD BE BASED ON TYPE
    function increment(Iterator memory iterator) internal pure returns(Iterator memory){
        iterator.type_i += 4;
        iterator.target_i += 20;
        iterator.selector_i += 4;
        return iterator;
    }

    function void(Iterator memory iterator) internal pure returns(Iterator memory){
        iterator.type_i = 0;
        iterator.target_i = 0;
        iterator.selector_i = 0;
        return iterator;
    }
}
