// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

// import "../../../assets/erc1155ds/ISuper1155.sol";
import "./BlueprintSuperMintShop1155.sol";

/**
    @title Interface for interaction with MintShop contract.
 */
interface IMintShop {
    /**
    Allow the owner of the shop or an approved manager to add a new pool of
    items that users may purchase.
    @param _pool The PoolInput full of data defining the pool's operation.
    @param _groupIds The specific item group IDs to sell in this pool,
      keyed to the `_amounts` array.
    @param _issueNumberOffsets The offset for the next issue number minted for a
      particular item group in `_groupIds`. This is *important* to handle
      pre-minted or partially-minted item groups.
    @param _caps The maximum amount of each particular groupId that can be sold
      by this pool.
    @param _prices The asset address to price pairings to use for selling each
      item.
  */
    function addPool(
        BlueprintSuperMintShop1155.PoolInput calldata _pool,
        uint256[] calldata _groupIds,
        uint256[] calldata _issueNumberOffsets,
        uint256[] calldata _caps,
        BlueprintSuperMintShop1155.Price[][] memory _prices
    ) external;

    /**
        Adds new whiteList restriction for the pool by `_poolId`.
        @param _poolId id of the pool, where new white list is added.
        @param whitelist struct for creating a new whitelist.
   */
    function addWhiteList(
        uint256 _poolId,
        BlueprintSuperMintShop1155.WhiteListCreate[] calldata whitelist
    ) external;

    /**
        Allow the shop owner or an approved manager to set the array of items known to this shop.
        @param _items The array of Super1155 addresses.
    */
    function setItems(ISuper1155[] memory _items) external;

    /// The public identifier for the right to set new items.
    function SET_ITEMS() external view returns (bytes32);

    /// The public identifier for the right to manage item pools.
    function POOL() external view returns (bytes32);

    /// The public identifier for the right to manage whitelists.
    function WHITELIST() external view returns (bytes32);
}
