// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "../libraries/DFStorage.sol";


interface ISuper1155 {
  
    function metadataUri() external view returns (string memory);

    function totalBalances (address) external view returns (uint256);

    function mintBatch(
        address _recipient,
        uint256[] calldata _ids,
        uint256[] calldata _amounts,
        bytes calldata _data
    ) external;

    function configureGroup(uint256 _groupId, DFStorage.ItemGroupInput calldata _data)
    external;


    /// The public identifier for the right to mint items.

    function _transferOwnership(address _owner) external;

    function CONFIGURE_GROUP() external view returns (bytes32);
    function MINT() external view returns (bytes32);

}
