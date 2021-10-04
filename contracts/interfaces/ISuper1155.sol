// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "../libraries/DFStorage.sol";


interface ISuper1155 {
  
    function getThisMetadataUri() external view returns (string memory);

    function mintBatch(
        address _recipient,
        uint256[] calldata _ids,
        uint256[] calldata _amounts,
        bytes calldata _data
    ) external;

    function getTotalBalances(address _recepient)
        external
        view
        returns (uint256);

    function configureGroup(uint256 _groupId, DFStorage.ItemGroupInput calldata _data)
    external;
}
