// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

library Utils {

    // this is struct for aligning function memory 
    struct Slice { 
        uint length;
        uint pointer;
    }

  function Concat(string memory _a, string memory _b, string memory _c, string memory _d, string memory _e)
        internal pure
        returns (string memory)
    {
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

    function Concat(string memory _a, string memory _b, string memory _c, string memory _d)
        internal pure
        returns (string memory)
    {
        return Concat(_a, _b, _c, _d, "");
    }

    function Concat(string memory _a, string memory _b, string memory _c)
        internal pure
        returns (string memory)
    {
        return Concat(_a, _b, _c, "", "");
    }

    function Concat(string memory _a, string memory _b)
        internal pure
        returns (string memory)
    {
        return Concat(_a, _b, "", "", "");
    }

    function uint2str(uint _i)
        internal pure
        returns (string memory _uintAsString)
    {
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

    function copyToMemory(uint _destination, uint _source, uint _length)
        private pure
    {
        // Copy word-length chunks while possible
        for(_length ; _length >= 32; _length -= 32) {
            assembly {
                mstore(_destination, mload(_source))
            }
            _destination += 32;
            _source += 32;
        }

        // Copy remaining bytes
        if(_length >0){
            uint mask = 256 ** (32 - _length) - 1;
            assembly {
                let source := and(mload(_source), not(mask))
                let destination := and(mload(_destination), mask)
                mstore(_destination, or(destination, source))
            }
        }
    }

    // make struct slice out of string
    function toSlice(string memory input)
        internal pure
        returns (Slice memory)
    {
        uint ptr;
        assembly {
            ptr := add(input, 0x20)
        }
        return Slice(bytes(input).length, ptr);
    }

    function findPointer(uint inputLength, uint inputPointer, uint toSearchLength, uint toSearchPointer)
        private pure
        returns (uint)
    {
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

    function afterMatch(Slice memory input, Slice memory toSearch)
        internal pure
        returns (Slice memory)
    {
        uint pointer = findPointer(input.length, input.pointer, toSearch.length, toSearch.pointer);
        input.length -= pointer - input.pointer + 1; // escape void space
        input.pointer = pointer +1; // escape token
        return input;
    }

    function beforeMatch(Slice memory input, Slice memory toSearch)
        internal pure
        returns (Slice memory token)
    {
        beforeMatch(input, toSearch, token);
    }

    function beforeMatch(Slice memory input, Slice memory toSearch, Slice memory token)
        internal pure
        returns (Slice memory)
    {
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

    function toString(Slice memory input)
        internal pure
        returns (string memory)
    {
        string memory result = new string(input.length);
        uint resultPointer;
        assembly { resultPointer := add(result, 32) }

        copyToMemory(resultPointer, input.pointer, input.length);
        return result;
    }

    function split(bytes calldata blob)
        internal
        pure
        returns (uint256, bytes memory)
    {
        int256 index = indexOf(blob, ":", 0);
        require(index >= 0, "Separator must exist");
        // Trim the { and } from the parameters
        uint256 tokenID = toUint(blob[1:uint256(index) - 1]);
        uint256 blueprintLength = blob.length - uint256(index) - 3;
        if (blueprintLength == 0) {
            return (tokenID, bytes(""));
        }
        bytes calldata blueprint = blob[uint256(index) + 2:blob.length - 1];
        return (tokenID, blueprint);
    }

    /**
     * Index Of
     *
     * Locates and returns the position of a character within a string starting
     * from a defined offset
     *
     * @param _base When being used for a data type this is the extended object
     *              otherwise this is the string acting as the haystack to be
     *              searched
     * @param _value The needle to search for, at present this is currently
     *               limited to one character
     * @param _offset The starting point to start searching from which can start
     *                from 0, but must not exceed the length of the string
     * @return int The position of the needle starting from 0 and returning -1
     *             in the case of no matches found
     */
    function indexOf(
        bytes memory _base,
        string memory _value,
        uint256 _offset
    ) internal pure returns (int256) {
        bytes memory _valueBytes = bytes(_value);

        assert(_valueBytes.length == 1);

        for (uint256 i = _offset; i < _base.length; i++) {
            if (_base[i] == _valueBytes[0]) {
                return int256(i);
            }
        }

        return -1;
    }

    function toUint(bytes memory b) internal pure returns (uint256) {
        uint256 result = 0;
        for (uint256 i = 0; i < b.length; i++) {
            uint256 val = uint256(uint8(b[i]));
            if (val >= 48 && val <= 57) {
                result = result * 10 + (val - 48);
            }
        }
        return result;
    }

    function interpolate(string memory source, uint value) internal pure returns (string memory result){
        Slice memory slice1 = toSlice(source);
        Slice memory slice2 = toSlice(source);
        string memory tokenFirst = "{";
        string memory tokenLast = "}";
        Slice memory firstSlice = toSlice(tokenFirst);
        Slice memory secondSlice = toSlice(tokenLast);
        firstSlice = beforeMatch(slice1, firstSlice);
        secondSlice = afterMatch(slice2, secondSlice);
        string memory first = toString(firstSlice);
        string memory second = toString(secondSlice);
        result = Concat(first, uint2str(value), second);
        return result;
    }
}

/**
 * @title ArrayUtils
 * @author Project Wyvern Developers
 */
library ArrayUtils {

    /**
     * Replace bytes in an array with bytes in another array, guarded by a bitmask
     * Efficiency of this function is a bit unpredictable because of the EVM's word-specific model (arrays under 32 bytes will be slower)
     * 
     * @dev Mask must be the size of the byte array. A nonzero byte means the byte array can be changed.
     * @param array The original array
     * @param desired The target array
     * @param mask The mask specifying which bits can be changed
     */
    function guardedArrayReplace(bytes memory array, bytes memory desired, bytes memory mask)
        internal pure
    {
        require(array.length == desired.length, "Ux02");
        require(array.length == mask.length, "Ux03");

        uint words = array.length / 0x20;
        uint index = words * 0x20;
        assert(index / 0x20 == words);
        uint i;

        for (i = 0; i < words; i++) {
            /* Conceptually: array[i] = (!mask[i] && array[i]) || (mask[i] && desired[i]), bitwise in word chunks. */
            assembly {
                let commonIndex := mul(0x20, add(1, i))
                let maskValue := mload(add(mask, commonIndex))
                mstore(add(array, commonIndex), or(and(not(maskValue), mload(add(array, commonIndex))), and(maskValue, mload(add(desired, commonIndex)))))
            }
        }

        /* Deal with the last section of the byte array. */
        if (words > 0) {
            /* This overlaps with bytes already set but is still more efficient than iterating through each of the remaining bytes individually. */
            i = words;
            assembly {
                let commonIndex := mul(0x20, add(1, i))
                let maskValue := mload(add(mask, commonIndex))
                mstore(add(array, commonIndex), or(and(not(maskValue), mload(add(array, commonIndex))), and(maskValue, mload(add(desired, commonIndex)))))
            }
        } else {
            /* If the byte array is shorter than a word, we must unfortunately do the whole thing bytewise.
               (bounds checks could still probably be optimized away in assembly, but this is a rare case) */
            for (i = index; i < array.length; i++) {
                array[i] = ((mask[i] ^ 0xff) & array[i]) | (mask[i] & desired[i]);
            }
        }
    }

    /**
     * Test if two arrays are equal
     * Source: https://github.com/GNSPS/solidity-bytes-utils/blob/master/contracts/BytesLib.sol
     * 
     * @dev Arrays must be of equal length, otherwise will return false
     * @param a First array
     * @param b Second array
     * @return Whether or not all bytes in the arrays are equal
     */
    function arrayEq(bytes memory a, bytes memory b)
        internal pure
        returns (bool)
    {
        bool success = true;

        assembly {
            let length := mload(a)

            // if lengths don't match the arrays are not equal
            switch eq(length, mload(b))
            case 1 {
                // cb is a circuit breaker in the for loop since there's
                //  no said feature for inline assembly loops
                // cb = 1 - don't breaker
                // cb = 0 - break
                let cb := 1

                let mc := add(a, 0x20)
                let end := add(mc, length)

                for {
                    let cc := add(b, 0x20)
                // the next line is the loop condition:
                // while(uint(mc < end) + cb == 2)
                } eq(add(lt(mc, end), cb), 2) {
                    mc := add(mc, 0x20)
                    cc := add(cc, 0x20)
                } {
                    // if any of these checks fails then arrays are not equal
                    if iszero(eq(mload(mc), mload(cc))) {
                        // unsuccess:
                        success := 0
                        cb := 0
                    }
                }
            }
            default {
                // unsuccess:
                success := 0
            }
        }

        return success;
    }

    /**
     * Unsafe write byte array into a memory location
     *
     * @param index Memory location
     * @param source Byte array to write
     * @return End memory index
     */
    function unsafeWriteBytes(uint index, bytes memory source)
        internal pure
        returns (uint)
    {
        if (source.length > 0) {
            assembly {
                let length := mload(source)
                let end := add(source, add(0x20, length))
                let arrIndex := add(source, 0x20)
                let tempIndex := index
                for { } eq(lt(arrIndex, end), 1) {
                    arrIndex := add(arrIndex, 0x20)
                    tempIndex := add(tempIndex, 0x20)
                } {
                    mstore(tempIndex, mload(arrIndex))
                }
                index := add(index, length)
            }
        }
        return index;
    }

    /**
     * Unsafe write address array into a memory location
     *
     * @param index Memory location
     * @param source Address array to write
     * @return End memory index
     */
    function unsafeWriteUintArray(uint index, uint[] memory source)
        internal pure
        returns (uint)
    {   
        for (uint i = 0; i < source.length; i++){
            uint conv = uint(uint160(source[i])) << 0x60;
            assembly {
                mstore(index, conv)
                index := add(index, 0x14)
            }
        }
        return index;
    }

    /**
     * Unsafe write address nested array into a memory location
     *
     * @param index Memory location
     * @param source Address nested array to write
     * @return End memory index
     */
    function unsafeWriteAddressMap(uint index, address[][] memory source)
        internal pure
        returns (uint)
    {   
        for (uint i = 0; i < source.length; i++){
            for (uint j = 0; j < source[i].length; j++){
                uint conv = uint(uint160(source[i][j])) << 0x60;
                assembly {
                    mstore(index, conv)
                    index := add(index, 0x14)
                }
            }
        }
        return index;
    }

    /**
     * Unsafe write address into a memory location
     *
     * @param index Memory location
     * @param source Address to write
     * @return End memory index
     */
    function unsafeWriteAddress(uint index, address source)
        internal pure
        returns (uint)
    {
        uint conv = uint(uint160(source)) << 0x60;
        assembly {
            mstore(index, conv)
            index := add(index, 0x14)
        }
        return index;
    }

    /**
     * Unsafe write uint into a memory location
     *
     * @param index Memory location
     * @param source uint to write
     * @return End memory index
     */
    function unsafeWriteUint(uint index, uint source)
        internal pure
        returns (uint)
    {
        assembly {
            mstore(index, source)
            index := add(index, 0x20)
        }
        return index;
    }

    /**
     * Unsafe write uint8 into a memory location
     *
     * @param index Memory location
     * @param source uint8 to write
     * @return End memory index
     */
    function unsafeWriteUint8(uint index, uint8 source)
        internal pure
        returns (uint)
    {
        assembly {
            mstore8(index, source)
            index := add(index, 0x1)
        }
        return index;
    }

}