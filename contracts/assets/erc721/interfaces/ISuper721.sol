// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

/**
    @title Super721 interface 
    Interface for interacting with Super721 contract
 */
interface ISuper721 {

    /**
        Returns amount of NFTs, which are owned by `_owner` in some group `_id`.
        @param _owner address of NFTs owner.
        @param _id group id of collection.
     */
    function balanceOfGroup(address _owner, uint256 _id) external view returns (uint256);

    /**
        Returns overall amount of NFTs, which are owned by `_owner`.
        @param _owner address of NFTs owner.
     */
    function balanceOf(address _owner) external view returns (uint256);

    function balanceOfBatch(address[] calldata _owners, uint256[] calldata _ids)
        external
        view
        returns (uint256[] memory);

    function mintBatch(address _recipient, uint256[] calldata _ids, bytes memory _data) external; 

    function safeBatchTransferFrom(address _from, address _to, uint256[] memory _ids, bytes memory _data) external;

    function transferOwnership(address newOwner) external;

}
