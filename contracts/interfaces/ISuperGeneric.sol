// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/**
  @title A generic interface for Super721 and Super1155 used in SuperStaking
  @author Qazawat Zirak
 */
interface ISuperGeneric is IERC165 {
    /// ERC1155 functions

    /**
        Mint a batch of tokens into existence and send them to the `_recipient`
        address. In order to mint an item, its item group must first have been
        created. Minting an item must obey both the fungibility and size cap of its
        group.

        @param _recipient The address to receive all NFTs within the newly-minted
        group.
        @param _ids The item IDs for the new items to create.
        @param _amounts The amount of each corresponding item ID to create.
        @param _data Any associated data to use on items minted in this transaction.
    */
    function mintBatch(
        address _recipient,
        uint256[] memory _ids,
        uint256[] memory _amounts,
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
        uint256[] memory _ids,
        uint256[] memory _amounts
    ) external;

    /// Balace of ERC1155
    function balanceOf(address _owner, uint256 _id)
        external
        view
        returns (uint256);

    /// ERC721 functions
    /**
        Returns overall amount of NFTs, which are owned by `_owner`.
        @param _owner address of NFTs owner.
     */
    function balanceOf(address _owner) external view returns (uint256);

    function balanceOfBatch(address[] calldata _owners, uint256[] calldata _ids)
        external
        view
        returns (uint256[] memory);

    function mintBatch(
        address _recipient,
        uint256[] calldata _ids,
        bytes memory _data
    ) external;

    function mintBatch(
        address _recipient,
        uint256 _amount,
        uint256 _poolId
    ) external;

    function burnBatch(address _burner, uint256[] memory _ids) external;

    function ownerOf(uint256 tokenId) external view returns (address);

    function totalSupply() external view returns (uint256);

    /**
     * @dev safeBatchTransferFrom is not included in Original Openzeppelin IERC721.
     */
    function safeBatchTransferFrom(
        address _from,
        address _to,
        uint256[] memory _ids,
        bytes memory _data
    ) external;
}
