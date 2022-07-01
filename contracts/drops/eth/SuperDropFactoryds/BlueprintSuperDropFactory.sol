// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "../SuperMintShop1155ds/BlueprintSuperMintShop1155.sol";

/** 
  @title Blueprint library for SuperMintShop.
  @author Qazawat Zirak
  This library acts as a blueprint for storage mechanim in the proxy contract.
  The library defines state variables in form of structs. It also defines the 
  storage location of the variables using KECCAK256 to avoid memory collision. 
  The state is stored in Proxy contract, which does a delegate call to Facets.
  22 Dec, 2021.
*/
library BlueprintSuperDropFactory {
    /**
    @param owner Drop's owner.
    @param mintShop1155 Address of MintShop contract.
    @param super1155 Address of Super1155 contract.
  */
    struct Drop {
        address owner;
        address superMintShop1155;
        address super1155;
    }

    /**
    This structure is used at the moment of MintShop deployng by DropFactory contract.
  */
    struct MintShopCreateData {
        address paymentReceiver;
        uint256 globalPurchaseLimit;
        uint256 maxAllocation;
    }

    /**
    @param groupIds Array of groupId's of 1155 contract
    @param issueNumberOffsets Array of groupId's of 1155 contract
    @param caps Array of maximum values in pool.
    @param Price Array of prices
  */
    struct PoolConfigurationData {
        uint256[] groupIds;
        uint256[] issueNumberOffsets;
        uint256[] caps;
        BlueprintSuperMintShop1155.Price[][] prices;
    }
}
