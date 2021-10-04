// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/ISuper1155.sol";
import "./interfaces/IMintShop.sol";
import "./libraries/DFStorage.sol";
import "./interfaces/IHelper.sol";

contract DropFactory is Ownable {
    string public version = "v0.1";
    uint256 MAX_INT = 2**256 - 1;
    address mintShopHelper;
    address super1155Helper;

    /**
     * @param owner Drop's owner.
     * @param mintShop1155 Address of MintShop contract.
     * @param super1155 Address of Super1155 contract.
     */
    struct Drop {
        address owner;
        address mintShop1155;
        address super1155;
    }
    /**
     * @param groupIds Array of groupId's of 1155 contract
     * @param issueNumberOffsets Array of groupId's of 1155 contract
     * @param caps Array of maximum values in pool.
     * @param Price Array of prices
     */
    struct PoolConfigurationData {
        uint256[] groupIds;
        uint256[] issueNumberOffsets;
        uint256[] caps;
        DFStorage.Price[][] prices;
    }

    Drop[] public drops;

    constructor(
        address _mintShopHelper,
        address _super1155Helper
    ) {
        mintShopHelper = _mintShopHelper;
        super1155Helper = _super1155Helper;
    }

    /**
     * @notice Create drop: deploy 2 new contracts: Super1155 and MintShop1155
     * @param _owner Address of drop's owner
     * @param _collectionName New collectin's name
     * @param _uri URI of new drop
     * @param _proxyRegistry Address of proxy registy contract
     * @param _globalPurchaseLimit Maximum quantity available for purchase.
     * @param _itemGroupInput Array of object of ItemGroupInput, description in {LibStorage}.
     * @param _poolInput Array of object of PoolInput, description in {LibStorage}.
     * @param _poolConfigurationData Array of object of ItemGroupInput, description above.


     * @return super1155 Returns 2 addresses, new Super1155 and MintShop1155 contracts.
     * @return mintShop Returns 2 addresses, new Super1155 and MintShop1155 contracts.

     */
    function createDrop(
        address _owner,
        string memory _collectionName,
        string memory _uri,
        address _proxyRegistry,
        address _paymentReceiver,
        uint256 _globalPurchaseLimit,
        DFStorage.ItemGroupInput[] memory _itemGroupInput,
        DFStorage.PoolInput[] memory _poolInput,
        PoolConfigurationData[] memory _poolConfigurationData
    )
        external
        returns (
            address super1155,
            address mintShop
        )
    {
        require(
            _itemGroupInput.length == _poolInput.length,
            "DropFactory: arrays of input parametres must be same length!"
        );
        require(
            _itemGroupInput.length == _poolConfigurationData.length,
            "DropFactory: arrays of input parametres must be same length!"
        );

        bytes memory super1155Bytecode = IHelper(super1155Helper).getByteCode();

        bytes memory bytecodeSuper1155 = abi.encodePacked(
            super1155Bytecode,
            abi.encode(_owner, _collectionName, _uri, _proxyRegistry)
        );

        bytes32 salt = keccak256(
            abi.encodePacked(block.timestamp - 2, msg.sender)
        );
        assembly {
            super1155 := create2(
                0,
                add(bytecodeSuper1155, 0x20),
                mload(bytecodeSuper1155),
                salt
            )
            if iszero(extcodesize(super1155)) {
                revert(0, 0)
            }
        }

        
        for (uint256 i = 0; i < _poolInput.length; i++) {
            ISuper1155(super1155).configureGroup(i + 1, _itemGroupInput[i]);
        }

        // ISuper1155(super1155)

        mintShop = createMintShop(
            _owner,
            address(super1155),
            _paymentReceiver,
            _globalPurchaseLimit,
            _poolInput,
            _poolConfigurationData
        );


        drops.push(
            Drop({
                owner: msg.sender,
                mintShop1155: address(mintShop),
                super1155: address(super1155)
            })
        );

        return (address(super1155), address(mintShop));
    }

    function createMintShop(
        address _owner,
        address super1155,
        address _paymentReceiver,
        uint256 _globalPurchaseLimit,
        DFStorage.PoolInput[] memory _poolInput,
        PoolConfigurationData[] memory _poolConfigurationData
    ) private returns (address mintShop) {

        bytes memory mintShopBytecode = IHelper(mintShopHelper).getByteCode();
        bytes memory bytecodeMintShop = abi.encodePacked(
            mintShopBytecode,
            abi.encode(
                _owner,
                ISuper1155(super1155),
                _paymentReceiver,
                _globalPurchaseLimit
            )
        );
        bytes32 salt = keccak256(abi.encodePacked(block.timestamp, msg.sender));
        assembly {
            mintShop := create2(
                0,
                add(bytecodeMintShop, 0x20),
                mload(bytecodeMintShop),
                salt
            )
            if iszero(extcodesize(mintShop)) {
                revert(0, 0)
            }
        }

        for (uint256 i = 0; i < _poolInput.length; i++) {
            IMintShop(mintShop).addPool(
                _poolInput[i],
                _poolConfigurationData[i].groupIds,
                _poolConfigurationData[i].issueNumberOffsets,
                _poolConfigurationData[i].caps,
                _poolConfigurationData[i].prices
            );
        }

        return mintShop;
    }

    /**
     * @notice Get all Drops from contract
     * @return Returns array of Drop structs.
     */
    function getDrops() external view returns (Drop[] memory) {
        return drops;
    }

    /**
     * @notice Get exact Drop struct.
     * @param _index Index in Drops[] array.
      
     * @return Returns Drop struct.
     */
    function getExactDrop(uint256 _index) external view returns (Drop memory) {
        return drops[_index];
    }
}
