// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.8;

import "@openzeppelin/contracts/access/Ownable.sol";

import "../../assets/erc1155/interfaces/ISuper1155.sol";
import "../../interfaces/IMintShop.sol";
import "../../libraries/DFStorage.sol";
import "../../interfaces/IHelper.sol";
import "../../interfaces/IPermitControl.sol";


/**
  @title A Factory contract
  @author Nikita Elunin 

  The contract is designed to create drops on the ETH network. 
  The contract creates Super1155 and MintShop1155 contracts.
*/
contract DropFactory is Ownable {
    string public version = "v0.1";
    uint256 MAX_INT = type(uint256).max;
    address mintShopHelper;
    address super1155Helper;

    event DropCreated(address indexed creator, address mintShop, address super1155, uint256 time);

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

    struct MintShopCreateData {
        address _paymentReceiver;
        uint256 _globalPurchaseLimit;
        uint256 _maxAllocation;
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


    mapping (bytes => Drop) drops;

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
     * @param _contractURI URI of contrqct drop
     * @param _proxyRegistry Address of proxy registy contract
     * @param _mintShopCreateData Struct, which needs collets datat to create MintShop contract.
     * @param _itemGroupInput Array of object of ItemGroupInput, description in {DFStorage}.
     * @param _poolInput Array of object of PoolInput, description in {DFStorage}.
     * @param _poolConfigurationData Array of object of ItemGroupInput, description above.

     * @return super1155 Returns 2 addresses, new Super1155 and MintShop1155 contracts.
     * @return mintShop Returns 2 addresses, new Super1155 and MintShop1155 contracts.

     */
    function createDrop(
        address _owner,
        string memory _collectionName,
        string memory _uri,
        string memory _contractURI,
        address _proxyRegistry,
        MintShopCreateData memory _mintShopCreateData,
        DFStorage.ItemGroupInput[] memory _itemGroupInput,
        DFStorage.PoolInput[] memory _poolInput,
        PoolConfigurationData[] memory _poolConfigurationData,
        DFStorage.WhiteListCreate[][] memory _whiteListCreate,
        bytes memory salt
    )
        external
        returns (
            address super1155,
            address mintShop
        )
    {
        require(
            _poolConfigurationData.length == _poolConfigurationData.length,
            "DropFactory: arrays of input parametres must be same length!"
        );

        super1155 = createSuper1155(_collectionName, _uri, _proxyRegistry, _contractURI, _itemGroupInput);  

        mintShop = createMintShop(
            _owner,
            super1155,
            _mintShopCreateData,
            _poolInput,
            _poolConfigurationData,
            _whiteListCreate
        );

        Drop storage drop = drops[salt];
        drop.mintShop1155 = address(mintShop);
        drop.owner = msg.sender;
        drop.super1155 = address(super1155);

        emit DropCreated(msg.sender, address(mintShop), address(super1155), block.timestamp);
        return (address(super1155), address(mintShop));
    }


    function createSuper1155( 
        string memory _collectionName,
        string memory _uri,
        address _proxyRegistry,
        string memory _contractURI,
        DFStorage.ItemGroupInput[] memory _itemGroupInput
        ) private returns (address super1155) {
            
         bytes memory super1155Bytecode = IHelper(super1155Helper).getByteCode();

        bytes memory bytecodeSuper1155 = abi.encodePacked(
            super1155Bytecode,
            abi.encode(address(this), _collectionName, _uri, _contractURI, _proxyRegistry)
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
        IPermitControl(super1155).transferOwnership(address(this));
        
        for (uint256 i = 0; i < _itemGroupInput.length; i++) {
            ISuper1155(super1155).configureGroup(i + 1, _itemGroupInput[i]);
        }
        return (super1155);
    }

    function createMintShop(
        address _owner,
        address super1155,
        MintShopCreateData memory _mintShopCreateData,
        DFStorage.PoolInput[] memory _poolInput,
        PoolConfigurationData[] memory _poolConfigurationData,
        DFStorage.WhiteListCreate[][] memory _whiteListInput
    ) private returns (address mintShop) {

        bytes memory mintShopBytecode = IHelper(mintShopHelper).getByteCode();
        bytes memory bytecodeMintShop = abi.encodePacked(
            mintShopBytecode,
            abi.encode(
                address(this),
                _mintShopCreateData._paymentReceiver,
                _mintShopCreateData._globalPurchaseLimit,
                _mintShopCreateData._maxAllocation
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

        ISuper1155[] memory items = new ISuper1155[](1);
        items[0] = ISuper1155(super1155);


        grantPermitsMintShop1155(mintShop);

        IMintShop(mintShop).setItems(items);
        

        for (uint256 i = 0; i < _poolInput.length; i++) {
            IMintShop(mintShop).addPool(
                _poolInput[i],
                _poolConfigurationData[i].groupIds,
                _poolConfigurationData[i].issueNumberOffsets,
                _poolConfigurationData[i].caps,
                _poolConfigurationData[i].prices
            );
            IMintShop(mintShop).addWhiteList(i, _whiteListInput[i]);
        }

        bytes32 UNIVERSAL = IPermitControl(super1155).UNIVERSAL();

        bytes32 MINT = ISuper1155(super1155).MINT();
        IPermitControl(super1155).setPermit(mintShop, UNIVERSAL, MINT, MAX_INT);

        IPermitControl(mintShop).transferOwnership(_owner);
        IPermitControl(super1155).transferOwnership(_owner);

        return mintShop;
    }

    /**
     * @notice Update helpers addresses for contract.
     * @param _mintShopHelper Address of mintShopHelper
     * @param _super1155Helper Address of super1155Helper

     */
    function updateHelpersAddress(address _mintShopHelper, address _super1155Helper) external onlyOwner {
        mintShopHelper = _mintShopHelper;
        super1155Helper = _super1155Helper;
    }

    function grantPermitsMintShop1155(address mintShop) private {
        bytes32 UNIVERSAL = IPermitControl(mintShop).UNIVERSAL();
        bytes32 POOL = IMintShop(mintShop).POOL();
        bytes32 SET_ITEMS = IMintShop(mintShop).SET_ITEMS();
        bytes32 WHITELIST = IMintShop(mintShop).WHITELIST();

        IPermitControl(mintShop).setPermit(address(this), UNIVERSAL, SET_ITEMS, MAX_INT);
        IPermitControl(mintShop).setPermit(address(this), UNIVERSAL, POOL, MAX_INT);
        IPermitControl(mintShop).setPermit(address(this), UNIVERSAL, WHITELIST, MAX_INT);
    }



    /**
     * @notice Get exact Drop struct.
     * @param salt Bytes32 salt for getting drop object.
      
     * @return Returns Drop struct.
     */
    function getExactDrop(bytes calldata salt) external view returns (Drop memory) {
        return drops[salt];
    }
}
