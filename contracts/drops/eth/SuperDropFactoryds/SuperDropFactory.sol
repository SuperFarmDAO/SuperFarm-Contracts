// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/access/Ownable.sol";

import "../../../assets/erc1155/diamond/ISuper1155.sol";
import "../../../assets/erc1155/diamond/StorageSuper1155.sol";
import "../../../assets/erc1155/diamond/BlueprintSuper1155.sol";
import "../SuperMintShop1155ds/IMintShop.sol";
import "../SuperMintShop1155ds/StorageSuperMintShop1155.sol";
import "../SuperMintShop1155ds/BlueprintSuperMintShop1155.sol";
import "../../../interfaces/IPermitControl.sol";
import "./BlueprintSuperDropFactory.sol";

/**
  @title A Drops Factory contract.
  @author Nikita Elunin 
  @author Qazawat Zirak
  The contract is designed to create drops on the ETH network. Each drop
  includes a pair of super1155 and superMintShop1155 contracts.
*/
contract SuperDropFactory is Ownable {
    /// A public variable to keep track of drop factory version.
    string public version = "v0.1";

    /// A proxy contract's address, that has all selector-facet addresses.
    address public linkProxy;

    /// A private variable to store max value of uint256.
    uint256 MAX_INT = type(uint256).max;

    /// A mapping that keeps track of drops.
    mapping(bytes => BlueprintSuperDropFactory.Drop) drops;

    /**
    An event to track an update to this shop's `globalPurchaseLimit`.
    @param creator the creator of the drop.
    @param mintShop the address of the SuperMintShop1155.
    @param super1155 the address of newly deployed collection.
    @param time the time of drop.
  */
    event DropCreated(
        address indexed creator,
        address mintShop,
        address super1155,
        uint256 time
    );

    /**
    Deploy a new Drop Factory.
    @param _linkProxy the address of authenticated proxy.
  */
    constructor(address _dropFactoryOwner, address _linkProxy) {
        _transferOwnership(_dropFactoryOwner);

        linkProxy = _linkProxy;
    }

    /**
    @notice Create drop: deploy 2 new contracts: Super1155 and MintShop1155
    @param _owner Address of drop's owner
    @param _collectionName New collectin's name
    @param _uri URI of new drop
    @param _contractURI URI of contrqct drop
    @param _proxyRegistry Address of proxy registy contract
    @param _mintShopCreateData Struct, which needs collets datat to create MintShop contract.
    @param _itemGroupInput Array of object of ItemGroupInput, description in {DFStorage}.
    @param _poolInput Array of object of PoolInput, description in {DFStorage}.
    @param _poolConfigurationData Array of object of ItemGroupInput, description above.
    @return super1155 Returns 2 addresses, new Super1155 and MintShop1155 contracts.
    @return superMintShop1155 Returns 2 addresses, new Super1155 and MintShop1155 contracts.
   */
    function createDrop(
        address _owner,
        string memory _collectionName,
        string memory _uri,
        string memory _contractURI,
        address _proxyRegistry,
        BlueprintSuperDropFactory.MintShopCreateData memory _mintShopCreateData,
        BlueprintSuper1155.ItemGroupInput[] memory _itemGroupInput,
        BlueprintSuperMintShop1155.PoolInput[] memory _poolInput,
        BlueprintSuperDropFactory.PoolConfigurationData[]
            memory _poolConfigurationData,
        BlueprintSuperMintShop1155.WhiteListCreate[][] memory _whiteListCreate,
        bytes memory salt
    ) external returns (address super1155, address superMintShop1155) {
        // Deploy sub-contracts
        super1155 = createSuper1155(
            _collectionName,
            _uri,
            _proxyRegistry,
            _contractURI,
            _itemGroupInput
        );
        superMintShop1155 = createMintShop(
            _owner,
            super1155,
            _mintShopCreateData,
            _poolInput,
            _poolConfigurationData,
            _whiteListCreate
        );

        // Store the Drop information
        BlueprintSuperDropFactory.Drop memory drop = BlueprintSuperDropFactory
            .Drop({
                owner: msg.sender,
                super1155: super1155,
                superMintShop1155: superMintShop1155
            });
        drops[salt] = drop;

        emit DropCreated(
            msg.sender,
            address(superMintShop1155),
            address(super1155),
            block.timestamp
        );
        return (address(super1155), address(superMintShop1155));
    }

    /** 
      Private helper function to avoid stake too deep.
    */
    function createSuper1155(
        string memory _collectionName,
        string memory _uri,
        address _proxyRegistry,
        string memory _contractURI,
        BlueprintSuper1155.ItemGroupInput[] memory _itemGroupInput
    ) private returns (address super1155) {
        // Deploy Super1155
        super1155 = address(
            new StorageSuper1155(
                linkProxy,
                _collectionName,
                _uri,
                _contractURI,
                _proxyRegistry
            )
        );

        // Configure the groups
        for (uint256 i = 0; i < _itemGroupInput.length; i++) {
            ISuper1155(super1155).configureGroup(i + 1, _itemGroupInput[i]);
        }

        return (super1155);
    }

    /** 
      Private helper function to avoid stake too deep.
    */
    function createMintShop(
        address _owner,
        address super1155,
        BlueprintSuperDropFactory.MintShopCreateData memory _mintShopCreateData,
        BlueprintSuperMintShop1155.PoolInput[] memory _poolInput,
        BlueprintSuperDropFactory.PoolConfigurationData[]
            memory _poolConfigurationData,
        BlueprintSuperMintShop1155.WhiteListCreate[][] memory _whiteListInput
    ) private returns (address mintShop) {
        // Deploy SuperMintShop1155
        mintShop = address(
            new StorageSuperMintShop1155(
                linkProxy,
                _mintShopCreateData.paymentReceiver,
                _mintShopCreateData.globalPurchaseLimit,
                _mintShopCreateData.maxAllocation
            )
        );

        // Set SuperMintShop1155 items
        ISuper1155[] memory items = new ISuper1155[](1);
        items[0] = ISuper1155(super1155);
        IMintShop(mintShop).setItems(items);

        // Add pool and whitelist
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

        // Give SuperMintShop1155 permit for MINT in the Super1155 contract
        bytes32 UNIVERSAL = IPermitControl(super1155).UNIVERSAL();
        IPermitControl(super1155).setPermit(
            mintShop,
            UNIVERSAL,
            BlueprintSuper1155.MINT,
            MAX_INT
        );

        // Renounce Ownerships to their rightful owner
        IPermitControl(mintShop).transferOwnership(_owner);
        IPermitControl(super1155).transferOwnership(_owner);

        return mintShop;
    }

    /** 
      A function runnable only by the admin to change the linkProxy address.
      @param _linkProxy new proxy address.
    */
    function updateLinkProxy(address _linkProxy) public onlyOwner {
        linkProxy = _linkProxy;
    }

    /**
     * @notice Get exact Drop struct.
     * @param salt Bytes32 salt for getting drop object.
      
     * @return Returns Drop struct.
     */
    function getExactDrop(bytes memory salt)
        external
        view
        returns (BlueprintSuperDropFactory.Drop memory)
    {
        return drops[salt];
    }
}
