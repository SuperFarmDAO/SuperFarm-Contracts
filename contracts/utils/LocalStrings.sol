pragma solidity ^0.8.7;

library Strings {
  // via https://github.com/oraclize/ethereum-api/blob/master/oraclizeAPI_0.5.sol
  function strConcat(string memory _a, string memory _b, string memory _c, string memory _d, string memory _e) internal pure returns (string memory) {
      bytes memory _ba = bytes(_a);
      bytes memory _bb = bytes(_b);
      bytes memory _bc = bytes(_c);
      bytes memory _bd = bytes(_d);
      bytes memory _be = bytes(_e);
      string memory abcde = new string(_ba.length + _bb.length + _bc.length + _bd.length + _be.length);
      bytes memory babcde = bytes(abcde);
      uint k = 0;
      for (uint i = 0; i < _ba.length; i++) babcde[k++] = _ba[i];
      for (uint i = 0; i < _bb.length; i++) babcde[k++] = _bb[i];
      for (uint i = 0; i < _bc.length; i++) babcde[k++] = _bc[i];
      for (uint i = 0; i < _bd.length; i++) babcde[k++] = _bd[i];
      for (uint i = 0; i < _be.length; i++) babcde[k++] = _be[i];
      return string(babcde);
    }

    function strConcat(string memory _a, string memory _b, string memory _c, string memory _d) internal pure returns (string memory) {
        return strConcat(_a, _b, _c, _d, "");
    }

    function strConcat(string memory _a, string memory _b, string memory _c) internal pure returns (string memory) {
        return strConcat(_a, _b, _c, "", "");
    }

    function strConcat(string memory _a, string memory _b) internal pure returns (string memory) {
        return strConcat(_a, _b, "", "", "");
    }

    function uint2str(uint _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len;
        j = _i;
        while (j != 0) {
            bstr[--k] = bytes1(uint8(48 + j % 10));
            j /= 10;
        }
        return string(bstr);
    }

    // this is struct for aligning function memory 
    struct Slice { 
        uint length;
        uint pointer;
    }

    function copyToMemory(uint _destination, uint _source, uint _length) private pure {
        // Copy word-length chunks while possible
        for(_length ; _length >= 32; _length -= 32) {
            assembly {
                mstore(_destination, mload(_source))
            }
            _destination += 32;
            _source += 32;
        }

        // Copy remaining bytes
        uint mask = 256 ** (32 - _length) - 1;
        assembly {
            let source := and(mload(_source), not(mask))
            let destination := and(mload(_destination), mask)
            mstore(_destination, or(destination, source))
        }
    }

    // make struct slice out of string
    function toSlice(string memory input) internal pure returns (Slice memory) {
        uint ptr;
        assembly {
            ptr := add(input, 0x20)
        }
        return Slice(bytes(input).length, ptr);
    }

    function findPointer(uint inputLength, uint inputPointer, uint toSearchLength, uint toSearchPointer) private pure returns (uint) {
        uint pointer = inputPointer;

        if (toSearchLength <= inputLength) {
            if (toSearchLength <= 32) {
                bytes32 mask = bytes32(~(2 ** (8 * (32 - toSearchLength)) - 1));

                bytes32 toSearchdata;
                assembly { toSearchdata := and(mload(toSearchPointer), mask) }

                uint end = inputPointer + inputLength - toSearchLength;
                bytes32 data;
                assembly { data := and(mload(pointer), mask) }

                while (data != toSearchdata) {
                    if (pointer >= end)
                        return inputPointer + inputLength;
                    pointer++;
                    assembly { data := and(mload(pointer), mask) }
                }
                return pointer;
            } else {
                // For long toSearchs, use hashing
                bytes32 hash;
                assembly { hash := keccak256(toSearchPointer, toSearchLength) }

                for (uint i = 0; i <= inputLength - toSearchLength; i++) {
                    bytes32 testHash;
                    assembly { testHash := keccak256(pointer, toSearchLength) }
                    if (hash == testHash)
                        return pointer;
                    pointer += 1;
                }
            }
        }
        return inputPointer + inputLength;
    }

    function afterMatch(Slice memory input, Slice memory toSearch) internal pure returns (Slice memory) {
        uint pointer = findPointer(input.length, input.pointer, toSearch.length, toSearch.pointer);
        input.length -= pointer - input.pointer;
        input.pointer = pointer +1; // escape token
        return input;
    }

    function beforeMatch(Slice memory input, Slice memory toSearch) internal pure returns (Slice memory token) {
        beforeMatch(input, toSearch, token);
    }

    function beforeMatch(Slice memory input, Slice memory toSearch, Slice memory token) internal pure returns (Slice memory) {
        uint pointer = findPointer(input.length, input.pointer, toSearch.length, toSearch.pointer);
        token.pointer = input.pointer;
        token.length = pointer - input.pointer;
        if (pointer == input.pointer + input.length) {
            // Not found
            input.length = 0;
        } else {
            input.length -= token.length + toSearch.length;
            input.pointer = pointer + toSearch.length;
        }
        return token;
    }

    function toString(Slice memory input) internal pure returns (string memory) {
        string memory result = new string(input.length);
        uint resultPointer;
        assembly { resultPointer := add(result, 32) }

        copyToMemory(resultPointer, input.pointer, input.length);
        return result;
    }
}
