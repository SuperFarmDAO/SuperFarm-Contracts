// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/access/Ownable.sol";


contract MultiTransfer is Ownable {

    /// CHECK is it needed
    mapping(address => bytes) transferSigs;

    constructor (address _owner) {
        if (_owner != owner()) {
            transferOwnership(_owner);
        }
    }

    

    function fundsTransfer(address[] calldata _targets, bytes[] calldata _data) external returns (bool[] memory) {
        require(_targets.length == _data.length, "targets and data lengths must be the same length");
    
        bool[] memory results = new bool[](_targets.length);

        for (uint i = 0; i < _targets.length; i++) {
            (bool success,) = _targets[i].delegatecall(_data[i]);
            results[i] = success;
        }

        return results;
    }


}