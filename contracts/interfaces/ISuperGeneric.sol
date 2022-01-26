// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/**
  @title A generic interface for Super721 and Super1155 used in SuperStaking
  @author Qazawat Zirak
 */
interface ISuperGeneric is IERC165 {
    /** 
     * @dev safeBatchTransferFrom is not included in Original Openzeppelin IERC721.
    */
    function safeBatchTransferFrom(
        address _from, 
        address _to,
        uint256[] memory _ids, 
        bytes memory _data
    ) external;

    function safeBatchTransferFrom(
        address _from, 
        address _to,
        uint256[] memory _ids, 
        uint256[] memory _amounts, 
        bytes memory _data
    ) external;

    function burnBatch(
        address _burner,
        uint256[] memory _ids
    ) external;

   function burnBatch(
        address _burner,
        uint256[] memory _ids,
        uint256[] memory _amounts
    ) external;

    /// Balance of ERC721
    function balanceOf(address _owner) external view returns (uint256);

    /// Balace of ERC1155
    function balanceOf (address _owner, uint256 _id) external view returns (uint256);
}