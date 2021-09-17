// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";


import "./MintShop1155.sol";
import "./interfaces/IMintShop.sol";


contract DropFactory is Ownable, IMintShop, ISuper1155 {
    string public version;
    uint256 MAX_INT = 2**256 - 1;

    struct Drop {
        address owner;
        address mintShop1155;
        address super1155;
    }

    struct PoolConfigurationData {
        uint256[] groupIds;
        uint256[] issueNumberOffsets;
        uint256[] caps;
        Price[][] prices;
    }

    Drop[] public drops;

    constructor(string memory _version) {
        version = _version;
    }

    function createDrop(
        address _owner,
        string memory _collectionName,
        string memory _uri,
        address _proxyRegistry,
        address _paymentReceiver,
        uint256 _globalPurchaseLimit,
        ItemGroupInput[] memory _itemGroupInput,
        PoolInput[] calldata _poolInput,
        PoolConfigurationData[] memory _poolConfigurationData
    ) external returns (address, address) {
        require(
            _itemGroupInput.length == _poolInput.length,
            "DropFactory: arrays of input parametres must be same length!"
        );
        require(
            _itemGroupInput.length == _poolConfigurationData.length,
            "DropFactory: arrays of input parametres must be same length!"
        );
        Super1155 super1155 = new Super1155(
            _owner,
            _collectionName,
            _uri,
            _proxyRegistry
        );


        for (uint256 i = 0; i < _poolInput.length; i++) {
            super1155.configureGroup(i, _itemGroupInput[i]);
        }

        MintShop1155 mintShop = new MintShop1155(
            _owner,
            super1155,
            _paymentReceiver,
            _globalPurchaseLimit
        );

        mintShop.setPermit(msg.sender, mintShop.UNIVERSAL(),  mintShop.MANAGER(), MAX_INT);

        for (uint256 i = 0; i < _poolInput.length; i++) {
            mintShop.addPool(
                _poolInput[i],
                _poolConfigurationData[i].groupIds,
                _poolConfigurationData[i].issueNumberOffsets,
                _poolConfigurationData[i].caps,
                _poolConfigurationData[i].prices
            );
        }
        
        drops.push(
            Drop({
                owner: msg.sender,
                mintShop1155: address(mintShop),
                super1155: address(super1155)
            })
        );

        return (address(super1155), address(mintShop));
    }

    function getDrops() external view returns (Drop[] memory) {
        return drops;
    }

    function getLastDrop() external view returns (uint256) {
        return drops.length - 1;
    }
}
