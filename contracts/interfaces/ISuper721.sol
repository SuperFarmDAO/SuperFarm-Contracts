// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

interface ISuper721 { 
    function balanceOfBatch(address[] calldata _owners, uint256[] calldata _ids)
    external view returns (uint256[] memory);
    function safeBatchTransferFrom(address _from, address _to,
    uint256[] memory _ids, bytes memory _data) external; 
}