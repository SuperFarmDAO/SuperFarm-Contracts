const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { ethers } = require('hardhat');
const Web3 = require('web3');

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const DATA = "0x02";


let snapshotId;
let currentTime;

///////////////////////////////////////////////////////////
// SEE https://hardhat.org/tutorial/testing-contracts.html
// FOR HELP WRITING TESTS
// USE https://github.com/gnosis/mock-contract FOR HELP
// WITH MOCK CONTRACT
///////////////////////////////////////////////////////////

// Start test block
describe('===Super1155===', function () {
    let deployer, owner, proxyRegistryOwner, signer1;
    let setUriRight,
        setProxyRegistryRight,
        setConfigureGroupRight,
        mintRight,
        burnRight,
        setMetadataRight,
        lockUriRight,
        lockItemUriRight,
        lockCreationRight;
    let UNIVERSAL;
    let super1155;
    let proxyRegistry;
    let omdProxy;
    const originalUri = "://ipfs/uri/{id}";
    const contractUri1155 = "://ipfs/uri/{id}";
    let itemGroupId = ethers.BigNumber.from(1);
    let shiftedItemGroupId = itemGroupId.shl(128);
    let itemGroupId2 = ethers.BigNumber.from(2);
    let shiftedItemGroupId2 = itemGroupId2.shl(128);

    // Keccak256 of "version()" in Super1155.sol
    // Must return true when delegateCall is called from OwnableDelegateProxy
    let selector = "0x54fd4d50fce680dbc2593d9e893064bfa880e5642d0036394e1a1849f7fc0749"

    before(async function () {
        this.Super1155 = await ethers.getContractFactory("Super1155");
        this.ProxyRegistry = await ethers.getContractFactory("ProxyRegistry");
        this.OMDProxy = await ethers.getContractFactory("OwnableMutableDelegateProxy");
    });

    beforeEach(async function () {
        [deployer, owner, proxyRegistryOwner, signer1] = await ethers.getSigners();

        proxyRegistry = await this.ProxyRegistry.deploy();
        await proxyRegistry.deployed();
        await proxyRegistry.transferOwnership(proxyRegistryOwner.address);

        super1155 = await this.Super1155.deploy(
            owner.address,
            "Super1155",
            originalUri,
            contractUri1155,
            proxyRegistry.address
        );
        await super1155.deployed();
        // await super1155.transferOwnership(owner.address);
        omdProxy = await this.OMDProxy.deploy(owner.address, super1155.address, selector);
        await omdProxy.deployed();

        setUriRight = await super1155.SET_URI();
        setProxyRegistryRight = await super1155.SET_PROXY_REGISTRY();
        setConfigureGroupRight = await super1155.CONFIGURE_GROUP();
        mintRight = await super1155.MINT();
        burnRight = await super1155.BURN();
        setMetadataRight = await super1155.SET_METADATA();
        lockUriRight = await super1155.LOCK_URI();
        lockItemUriRight = await super1155.LOCK_ITEM_URI();
        lockCreationRight = await super1155.LOCK_CREATION();
        UNIVERSAL = await super1155.UNIVERSAL();
    });

    beforeEach(async function() {
        currentTime = await (await ethers.provider.getBlock()).timestamp;
        snapshotId = await network.provider.send("evm_snapshot");
    });

    afterEach(async function() {
        await network.provider.send("evm_revert", [snapshotId]);
    });

    // Test cases

    //////////////////////////////
    //       Constructor
    //////////////////////////////
    describe("Constructor", function () {
        it('should initialize values as expected', async function () {
            expect(await super1155.owner()).to.equal(owner.address);
            expect(await super1155.name()).to.equal('Super1155');
            expect(await super1155.metadataUri()).to.equal(originalUri);
            expect(await super1155.proxyRegistryAddress()).to.equal(proxyRegistry.address);
        });

        it('should deploy a new instance where deployer is the owner', async function () {
            super1155 = await this.Super1155.deploy(
                deployer.address,
                "Super1155",
                originalUri,
                contractUri1155,
                proxyRegistry.address
            );
            
            await super1155.deployed();

            expect(await super1155.owner()).to.equal(deployer.address);
            expect(await super1155.name()).to.equal('Super1155');
            expect(await super1155.metadataUri()).to.equal(originalUri);
            expect(await super1155.proxyRegistryAddress()).to.equal(proxyRegistry.address);
        });
    });

    describe("version", function () {
        it('should return the correct version', async function(){
            expect(await super1155.version()).to.equal(1)
        });
    });

    describe("uri", function () {
        it('should return the metadataUri', async function () {
            expect(await super1155.uri(1)).to.equal(originalUri);
        });
    });

    describe("setURI", function () {
        it('Reverts: no valid permit', async function () {
            await expect(
                super1155.setURI("://ipfs/newuri/{id}")
            ).to.be.revertedWith('P1');
            expect(await super1155.uri(1)).to.equal(originalUri);
        });

        it('Reverts: collection has been locked', async function () {
            await super1155.connect(owner)["lockURI()"]();
            await expect(
                super1155.connect(owner).setURI("://ipfs/newuri/{id}")
            ).to.be.revertedWith('CollectionURIHasBeenLocked');

            expect(await super1155.uri(1)).to.equal(originalUri);
        });

        it('should set the metadataUri when there is a valid permit', async function () {
            await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setUriRight,
                ethers.constants.MaxUint256
            );
            await super1155.setURI("://ipfs/newuri/{id}");
            expect(await super1155.uri(1)).to.equal("://ipfs/newuri/{id}");
            expect(await super1155.uriLocked()).to.equal(false);
        });
    });

    describe("setProxyRegistry", function() {
        it('Reverts: no valid permit', async function () {
            await expect(
                super1155.setProxyRegistry(proxyRegistry.address)
            ).to.be.revertedWith('P1');
        });

        it('should set ProxyRegistry when there is permission', async function(){
            await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setProxyRegistryRight,
                ethers.constants.MaxUint256
            )
            await super1155.connect(deployer).setProxyRegistry(owner.address);
            expect(await super1155.proxyRegistryAddress()).to.be.equal(owner.address);
        });
    })

    describe("setApprovalForAll, isApprovedForAll", function () {
        it('Reverts: setting approval status for self', async () => {
            await expect(
                super1155.connect(deployer).setApprovalForAll(deployer.address, true)
            ).to.be.revertedWith('SettingApprovalStatusForSelf');
        });

        it('uses operatorApprovals except when the operator is registered in the proxyRegistry', async () => {
            expect(await super1155.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
            await super1155.setApprovalForAll(signer1.address, true);
            expect(await super1155.isApprovedForAll(deployer.address, signer1.address)).to.equal(true);
            await super1155.setApprovalForAll(signer1.address, false);
            expect(await super1155.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
        });

        it('returns true when proxyRegistry.proxies(_owner) == operator', async () => {
            let MockProxyRegistry = await ethers.getContractFactory("MockProxyRegistry");
            let mockProxyRegistry = await MockProxyRegistry.deploy();
            await mockProxyRegistry.deployed();
            await super1155.connect(owner).setProxyRegistry(mockProxyRegistry.address);

            expect(await super1155.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
            expect(await mockProxyRegistry.proxies(deployer.address)).to.equal(NULL_ADDRESS);

            await mockProxyRegistry.connect(deployer).setProxy(deployer.address, signer1.address);
            expect(await mockProxyRegistry.proxies(deployer.address)).to.equal(signer1.address);
            expect(await super1155.isApprovedForAll(deployer.address, signer1.address)).to.equal(true);

            await mockProxyRegistry.connect(deployer).setProxy(deployer.address, NULL_ADDRESS);
            expect(await mockProxyRegistry.proxies(deployer.address)).to.equal(NULL_ADDRESS);
            expect(await super1155.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
        });
    });

    describe("safeTransferFrom, safeBatchTransferFrom", function () {
        beforeEach(async function(){
            // Create Itemsgroup ID = 1
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'PEPSI',
                    supplyType: 0,
                    supplyData: 10,
                    itemType: 1,
                    itemData: 0,
                    burnType: 1,
                    burnData: 6
                });
            
            // Create Itemsgroup ID = 2
            await super1155.connect(owner).configureGroup(itemGroupId2, {
                name: 'COLA',
                    supplyType: 0,
                    supplyData: 15,
                    itemType: 1,
                    itemData: 0,
                    burnType: 2,
                    burnData: 5
                });

            // Mint fungible item
            await super1155.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId], ["7"], DATA);
            await super1155.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId2], ["7"], DATA);
        });

        it('Reverts: transfer to Zero address', async () => {
            await expect(
                super1155.connect(signer1).safeTransferFrom(deployer.address, NULL_ADDRESS, shiftedItemGroupId.add(1), "5", DATA)
            ).to.be.revertedWith('TransferToTheZeroAddress');

        });

        it('Reverts: transfer not approved', async () => {
            await expect(
                super1155.connect(signer1).safeTransferFrom(deployer.address, owner.address, shiftedItemGroupId.add(1), "5", DATA)
            ).to.be.revertedWith('CallerIsNotOwnerOrApproved');
        });

        it('Reverts: transfer has insufficient balance', async () => {
            // Approve the transfer
            await super1155.connect(deployer).setApprovalForAll(signer1.address, true);

            await expect(
                super1155.connect(signer1).safeTransferFrom(deployer.address, owner.address, shiftedItemGroupId.add(1), "8", DATA)
            ).to.be.revertedWith('InsufficientBalanceForTransfer');
        });

        it('Reverts: transferAcceptanceCheck on a contract with no ERC1155Receiver', async () => {
            // Approve the transfer
            await super1155.connect(deployer).setApprovalForAll(signer1.address, true);

            // Try transfering to a contract with no ERC1155Receiver
            await expect(
                super1155.connect(signer1).safeTransferFrom(deployer.address, proxyRegistry.address, shiftedItemGroupId.add(1), "1", DATA)
            ).to.be.revertedWith("ERC1155: transfer to non ERC1155Receiver implementer");
        });

        it('Reverts: transferAcceptanceCheck on a contract with ERC1155Receiver but response is not a selector', async () => {
            // Approve the transfer
            await super1155.connect(deployer).setApprovalForAll(signer1.address, true);

            // Create a contract with IERC1155Receiver
            let MockERC1155Receiver2 = await ethers.getContractFactory("MockERC1155Receiver2");
            let mockERC1155Receiver2 = await MockERC1155Receiver2.deploy();
            await mockERC1155Receiver2.deployed();

            // Try transfering to a contract with reponse as a selector
            await expect(
                super1155.connect(signer1).safeTransferFrom(deployer.address, mockERC1155Receiver2.address, shiftedItemGroupId.add(1), "1", DATA)
            ).to.be.revertedWith("ERC1155: ERC1155Receiver rejected tokens");
        });

        it('should do transferAcceptanceCheck on a contract with ERC1155Receiver and response is a selector', async () => {
            // Approve the transfer
            await super1155.connect(deployer).setApprovalForAll(signer1.address, true);

            // Create a contract with IERC1155Receiver
            let MockERC1155Receiver1 = await ethers.getContractFactory("MockERC1155Receiver1");
            let mockERC1155Receiver1 = await MockERC1155Receiver1.deploy();
            await mockERC1155Receiver1.deployed();

            // Try transfering to a contract with reponse as a selector
            await super1155.connect(signer1).safeTransferFrom(deployer.address, mockERC1155Receiver1.address, shiftedItemGroupId.add(1), "1", DATA);
            await expect(
                await super1155.connect(owner).balanceOf(mockERC1155Receiver1.address, shiftedItemGroupId.add(1))
            ).to.be.equal("1");
        });
        
        it('should transfer specified amount to specified address', async () => {
            // Approve the transfer
            await super1155.connect(deployer).setApprovalForAll(signer1.address, true);

            await expect(
                await super1155.connect(owner).balanceOf(owner.address, shiftedItemGroupId.add(1))
            ).to.be.equal("0");

            await super1155.connect(signer1).safeTransferFrom(deployer.address, owner.address, shiftedItemGroupId.add(1), "1", DATA)
          
            await expect(
                await super1155.connect(owner).balanceOf(owner.address, shiftedItemGroupId.add(1))
            ).to.be.equal("1");
        });

        it('Reverts: transferBatch ids and amounts length mismatch', async () => {
            await expect(
                super1155.connect(signer1).safeBatchTransferFrom(deployer.address, owner.address, [shiftedItemGroupId.add(1), shiftedItemGroupId2.add(1)], ["5", "5", "5"], DATA)
            ).to.be.revertedWith('IdsAndAmountsLengthsMismatch');
        });

        it('Reverts: transferBatch to Zero address', async () => {
            await expect(
                super1155.connect(signer1).safeBatchTransferFrom(deployer.address, NULL_ADDRESS, [shiftedItemGroupId.add(1), shiftedItemGroupId2.add(1)], ["5", "5"], DATA)
            ).to.be.revertedWith('TransferToTheZeroAddress');
        });

        it('Reverts: transferBatch not approved', async () => {
            await expect(
                super1155.connect(signer1).safeBatchTransferFrom(deployer.address, owner.address, [shiftedItemGroupId.add(1), shiftedItemGroupId2.add(1)], ["5", "5"], DATA)
            ).to.be.revertedWith('CallerIsNotOwnerOrApproved');
        });

        it('Reverts: transferBatch has insufficient balance', async () => {
            // Approve the transfer
            await super1155.connect(deployer).setApprovalForAll(signer1.address, true);

            await expect(
                super1155.connect(signer1).safeBatchTransferFrom(deployer.address, owner.address, [shiftedItemGroupId.add(1), shiftedItemGroupId2.add(1)], ["8", "8"], DATA)
            ).to.be.revertedWith('InsufficientBalanceForTransfer');
        });

        it('Reverts: batchTransferAcceptanceCheck on a contract with no ERC1155Receiver', async () => {
            // Approve the transfer
            await super1155.connect(deployer).setApprovalForAll(signer1.address, true);

            // Try transfering to a contract with no ERC1155Receiver
            await expect(
                super1155.connect(signer1).safeBatchTransferFrom(deployer.address, proxyRegistry.address, [shiftedItemGroupId.add(1)], ["1"], DATA)
            ).to.be.revertedWith("ERC1155: transfer to non ERC1155Receiver implementer");
        });

        it('Reverts: batchTransferAcceptanceCheck on a contract with ERC1155Receiver but response is not a selector', async () => {
            // Approve the transfer
            await super1155.connect(deployer).setApprovalForAll(signer1.address, true);

            // Create a contract with IERC1155Receiver
            let MockERC1155Receiver2 = await ethers.getContractFactory("MockERC1155Receiver2");
            let mockERC1155Receiver2 = await MockERC1155Receiver2.deploy();
            await mockERC1155Receiver2.deployed();

            // Try transfering to a contract with reponse as a selector
            await expect(
                super1155.connect(signer1).safeBatchTransferFrom(deployer.address, mockERC1155Receiver2.address, [shiftedItemGroupId.add(1)], ["1"], DATA)
            ).to.be.revertedWith("ERC1155: ERC1155Receiver rejected tokens");
        });

       it('should do batchTransferAcceptanceCheck on a contract with ERC1155Receiver and response is a selector', async () => {
            // Approve the transfer
            await super1155.connect(deployer).setApprovalForAll(signer1.address, true);

            // Create a contract with IERC1155Receiver
            let MockERC1155Receiver1 = await ethers.getContractFactory("MockERC1155Receiver1");
            let mockERC1155Receiver1 = await MockERC1155Receiver1.deploy();
            await mockERC1155Receiver1.deployed();

            // Try transfering to a contract with reponse as a selector
            await super1155.connect(signer1).safeBatchTransferFrom(deployer.address, mockERC1155Receiver1.address, [shiftedItemGroupId.add(1)], ["1"], DATA);
            await expect(
                await super1155.connect(owner).balanceOf(mockERC1155Receiver1.address, shiftedItemGroupId.add(1))
            ).to.be.equal("1");
        });
        
        it('should transferBatch specified amount to specified address', async () => {
            // Approve the transfer
            await super1155.connect(deployer).setApprovalForAll(signer1.address, true);

            await expect(
                await super1155.connect(owner).balanceOf(owner.address, shiftedItemGroupId.add(1))
            ).to.be.equal("0");

            await super1155.connect(signer1).safeBatchTransferFrom(deployer.address, owner.address, [shiftedItemGroupId.add(1), shiftedItemGroupId2.add(1)], ["1", "1"], DATA)
          
            await expect(
                await super1155.connect(owner).balanceOf(owner.address, shiftedItemGroupId.add(1))
            ).to.be.equal("1");
        });
    });

    describe("configureGroup & balanceOf", function() {
        it('Reverts: groupId is 0', async () => {
            await expect(
                super1155.connect(owner).configureGroup(0, {
                    name: 'KFC',
                    supplyType: 0,
                    supplyData: 20000,
                    itemType: 0,
                    itemData: 0,
                    burnType: 1,
                    burnData: 20000
                })
            ).to.be.revertedWith('GroupIDOIsInvalid');
        });

        it('Reverts: sender does not have the right', async () => {
            await expect(
                super1155.connect(signer1).configureGroup(itemGroupId, {
                    name: 'KFC',
                    supplyType: 0,
                    supplyData: 20000,
                    itemType: 0,
                    itemData: 0,
                    burnType: 1,
                    burnData: 20000
                })
            ).to.be.revertedWith('DoNotHaveRigthsToConfigureGroup');
        });

        it('Reverts: collection is locked', async function(){
            await super1155.connect(owner).lock();

            await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setConfigureGroupRight,
                ethers.constants.MaxUint256
            );

            await expect(
                super1155.connect(deployer).configureGroup(itemGroupId, {
                name: 'KFC',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            })).to.be.revertedWith('CollectionIsLockedGroupsCanNotBeCreated');
        });

        it('should create a group with UNIVERSAL right', async () => {
            await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setConfigureGroupRight,
                ethers.constants.MaxUint256
            );

            await super1155.connect(deployer).configureGroup(itemGroupId, {
                name: 'KFC',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });

            await expect(
                await (await super1155.connect(owner).itemGroups(itemGroupId)).name
                ).to.be.equal("KFC");
                
        });

        it('should create a group with GROUP right for specific GROUP circumstance', async () => {
            // spicificGroup is the circumstance
            let specificGroup = "0x0000000000000000000000000000000000000000000000000000000000000002";
            await super1155.connect(owner).setPermit(
                deployer.address,
                specificGroup,
                setConfigureGroupRight,
                ethers.constants.MaxUint256
            );

            await super1155.connect(deployer).configureGroup(specificGroup, {
                name: 'BURGERKING',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });
            
            await expect(
                await (await super1155.connect(owner).itemGroups(specificGroup)).name
                ).to.be.equal("BURGERKING");
        });

        it('tests the editability of a group with multiple reverts handling', async () => {
            // The test goes from Less Restrictive to More Restrictive supplyType, itemType and burnType
            await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setConfigureGroupRight,
                ethers.constants.MaxUint256
            );

            // Create base editable group
            // Flexible, Fungible, Replenishable
            await super1155.connect(deployer).configureGroup(itemGroupId, {
                name: 'KFC',
                supplyType: 2,
                supplyData: 20000,
                itemType: 1,
                itemData: 0,
                burnType: 2,
                burnData: 0
            });

            await expect(
                await (await super1155.connect(owner).itemGroups(itemGroupId)).name
                ).to.be.equal("KFC");
            
            // (From) Flexible, Fungible, Replenishable (To) Flexible, Fungible, Replenishable (Changes) name
            super1155.connect(deployer).configureGroup(itemGroupId, {
                name: 'KFCv2',
                supplyType: 2,
                supplyData: 20000,
                itemType: 1,
                itemData: 0,
                burnType: 2,
                burnData: 8
            });

            await expect(
                await (await super1155.connect(owner).itemGroups(itemGroupId)).name
                ).to.be.equal("KFCv2");

            // Mint some Fungible tokens to deployer, TokenID = 1
            // Fungible items are coerced into the single group ID + index one slot.
            await super1155.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId], ["10"], DATA);
            await expect(
                await super1155.balanceOf(deployer.address, shiftedItemGroupId.add(1))
                ).to.be.equal("10");

            await expect(
                super1155.connect(deployer).configureGroup(itemGroupId, {
                    name: 'KFCv3',
                    supplyType: 0,
                    supplyData: 9,
                    itemType: 1,
                    itemData: 0,
                    burnType: 0,
                    burnData: 0
            })).to.be.revertedWith('CanNotDecreaseSupplyBelowCirculatingAmount');

            // (From) Flexible, Fungible, Replenishable (To) Flexible, Fungible, Replenishable (Changes) supplyData
            super1155.connect(deployer).configureGroup(itemGroupId, {
                name: 'KFCv3',
                supplyType: 2,
                supplyData: 15000,
                itemType: 1,
                itemData: 0,
                burnType: 2,
                burnData: 0
            });

            await expect(
                await (await super1155.connect(owner).itemGroups(itemGroupId)).name
                ).to.be.equal("KFCv3");

            // (From) Flexible, Fungible, Replenishable (To) Uncapped, Fungible, Replenishable (Changes) supplyType
            super1155.connect(deployer).configureGroup(itemGroupId, {
                name: 'KFCv4',
                supplyType: 1,
                supplyData: 15000,
                itemType: 1,
                itemData: 0,
                burnType: 2,
                burnData: 0
            });

            await expect(
                await (await super1155.connect(owner).itemGroups(itemGroupId)).name
                ).to.be.equal("KFCv4");

            // (From) Uncapped, Fungible, Replenishable (To) Capped, Fungible, Replenishable (Changes) supplyType
            super1155.connect(deployer).configureGroup(itemGroupId, {
                name: 'KFCv5',
                supplyType: 0,
                supplyData: 15000,
                itemType: 1,
                itemData: 0,
                burnType: 2,
                burnData: 0
            });

            await expect(
                await (await super1155.connect(owner).itemGroups(itemGroupId)).name
                ).to.be.equal("KFCv5");

            // Can't edit uncap to cap again
            await expect(super1155.connect(deployer).configureGroup(itemGroupId, {
                name: 'KFCv6',
                supplyType: 1,
                supplyData: 15000,
                itemType: 1,
                itemData: 0,
                burnType: 2,
                burnData: 0
            })).to.be.revertedWith('CanNotUncapCappedSupplyType');

            await expect(super1155.connect(deployer).configureGroup(itemGroupId, {
                name: 'KFCv6',
                supplyType: 0,
                supplyData: 20000,
                itemType: 1,
                itemData: 0,
                burnType: 2,
                burnData: 0
            })).to.be.revertedWith("CanNotIncreaseSupplyOfCappedType");

            // (From) Capped, Fungible, Replenishable (To) Capped, Fungible, Burnable (Changes) burnType, burnData
            super1155.connect(deployer).configureGroup(itemGroupId, {
                name: 'KFCv6',
                supplyType: 0,
                supplyData: 15000,
                itemType: 1,
                itemData: 0,
                burnType: 1,
                burnData: 5
            });

            await expect(
                await (await super1155.connect(owner).itemGroups(itemGroupId)).name
                ).to.be.equal("KFCv6");

            // Burn some tokens
            await super1155.connect(owner).burn(deployer.address, shiftedItemGroupId.add(1), "8");

            await expect(
                await super1155.balanceOf(deployer.address, shiftedItemGroupId.add(1))
                ).to.be.equal("2");

            // To be non-fungible, item must be unique
            await expect(
                super1155.connect(deployer).configureGroup(itemGroupId, {
                name: 'KFCv7',
                supplyType: 0,
                supplyData: 2,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 5
            })).to.be.revertedWith('FungibleItemIsNotUniqueEnoughToChange');

            await expect(
                super1155.connect(deployer).configureGroup(itemGroupId, {
                name: 'KFCv7',
                supplyType: 0,
                supplyData: 1,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 5
            })).to.be.revertedWith('CanNotDecreaseSupplyBelowCirculatingAmount');

            super1155.connect(owner).burn(deployer.address, shiftedItemGroupId, "1");

            // (From) Capped, Fungible, Burnable (To) Capped, NonFungible, Burnable (Changes) itemType
            super1155.connect(deployer).configureGroup(itemGroupId, {
                name: 'KFCv7',
                supplyType: 0,
                supplyData: 2,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 5
            });

            await expect(
                await (await super1155.connect(owner).itemGroups(itemGroupId)).name
                ).to.be.equal("KFCv7");

            // Can't change a non-fungible to fungible again
            await expect(super1155.connect(deployer).configureGroup(itemGroupId, {
                name: 'KFCv8',
                supplyType: 0,
                supplyData: 1,
                itemType: 1,
                itemData: 0,
                burnType: 1,
                burnData: 0
            })).to.be.revertedWith('CanNotAlterNonFungibleItems');

            // Check for semi-fungible
            // Create Capped, Fungible, Burnable (Changes) itemType
            super1155.connect(deployer).configureGroup(itemGroupId2, {
                name: 'MCDONALD',
                supplyType: 0,
                supplyData: 2,
                itemType: 1,
                itemData: 0,
                burnType: 1,
                burnData: 5
            });

            await expect(
                await (await super1155.connect(owner).itemGroups(itemGroupId2)).name
                ).to.be.equal("MCDONALD");

            // Mint some tokens to deployer, TokenID = 0
            await super1155.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId2], ["2"], DATA);

            await expect(
                super1155.connect(deployer).configureGroup(itemGroupId2, {
                name: 'MCDONALDv2',
                supplyType: 0,
                supplyData: 2,
                itemType: 2,
                itemData: 0,
                burnType: 1,
                burnData: 5
            })).to.be.revertedWith('SemifungibleItemIsNotUniqueEnoughToChange');

            // Burn to make the fungible item unique
            await super1155.connect(owner).burn(deployer.address, shiftedItemGroupId2, "1");

            // Change from fungible to semi-fungible
            await super1155.connect(deployer).configureGroup(itemGroupId2, {
                name: 'MCDONALDv2',
                supplyType: 0,
                supplyData: 2,
                itemType: 2,
                itemData: 1,
                burnType: 1,
                burnData: 5
            })

            await expect(
                await (await super1155.connect(owner).itemGroups(itemGroupId2)).name
                ).to.be.equal("MCDONALDv2");

            // Can't change semi-fungible item to fungible again
            await expect(
                super1155.connect(deployer).configureGroup(itemGroupId2, {
                name: 'MCDONALDv3',
                supplyType: 0,
                supplyData: 2,
                itemType: 1,
                itemData: 0,
                burnType: 1,
                burnData: 5
            })).to.be.revertedWith('CanNotAlterSemifungibleItems');
        });

        it('should configure a new non-fungible group and edit it to another non-fungible group', async function () {
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'NONFUNGIBLE',
                supplyType: 1,
                supplyData: 1,
                itemType: 0,
                itemData: 0,
                burnType: 0,
                burnData: 0
            });

            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'NONFUNGIBLE',
                supplyType: 1,
                supplyData: 1,
                itemType: 0,
                itemData: 0,
                burnType: 0,
                burnData: 0
            });
         });

         it('should configure a new semi-fungible group and edit it to another semi-fungible group', async function () {
            await super1155.connect(owner).configureGroup(itemGroupId2, {
                name: 'SEMIFUNGIBLE',
                supplyType: 0,
                supplyData: 1,
                itemType: 2,
                itemData: 0,
                burnType: 0,
                burnData: 0
            });

            await super1155.connect(owner).configureGroup(itemGroupId2, {
                name: 'SEMIFUNGIBLEv2',
                supplyType: 0,
                supplyData: 1,
                itemType: 2,
                itemData: 0,
                burnType: 0,
                burnData: 0
            });
         });

         it('should configure a new fungible group and edit it to a non existing type', async function () {
            await super1155.connect(owner).configureGroup(itemGroupId2, {
                name: 'FUNGIBLE',
                supplyType: 0,
                supplyData: 1,
                itemType: 1,
                itemData: 0,
                burnType: 0,
                burnData: 0
            });

            await super1155.connect(owner).configureGroup(itemGroupId2, {
                name: 'FUNGIBLEv2',
                supplyType: 0,
                supplyData: 1,
                itemType: 2,
                itemData: 0,
                burnType: 0,
                burnData: 0
            });
         });

        it('Reverts: balance of Zero address', async function () {
            await expect(
                super1155.balanceOf(NULL_ADDRESS, 0)
                ).to.be.revertedWith('BalanceQueryForZeroAddress');
         });

        it('should get the correct balance of a token relating to an address', async function () {
            await expect(await super1155.balanceOf(deployer.address, 0)).to.be.equal(0);
         });
    })

    describe("balanceOfBatch", function () {
        it('Reverts: ids and amounts length mismatch', async function () {
            // Check if the minted balances are correct
            await expect(
                super1155.connect(owner).balanceOfBatch([deployer.address, deployer.address, deployer.address], [shiftedItemGroupId.add(1), shiftedItemGroupId2.add(1)])
            ).to.be.revertedWith('AccountsAndLendgthMismatch');

        });
       it('should return an array of balances mapped to addresses', async function () {
            // Create Itemsgroup ID = 1
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'PEPSI',
                    supplyType: 1,
                    supplyData: 10,
                    itemType: 1,
                    itemData: 0,
                    burnType: 1,
                    burnData: 5
                });
            
            // Create Itemsgroup ID = 2
            await super1155.connect(owner).configureGroup(itemGroupId2, {
                name: 'COLA',
                    supplyType: 0,
                    supplyData: 15,
                    itemType: 1,
                    itemData: 0,
                    burnType: 2,
                    burnData: 5
                });

            // Mint items in batch
            await super1155.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId, shiftedItemGroupId2], ["5", "5"], DATA);

            // Check if the minted balances are correct
            let balances = await super1155.connect(owner).balanceOfBatch([deployer.address, deployer.address], [shiftedItemGroupId.add(1), shiftedItemGroupId2.add(1)]);
            expect(balances[0]).to.be.equal("5");
            expect(balances[1]).to.be.equal("5");
        }); 
    });

    describe("mintBatch, mintChecker", function () {
        beforeEach(async function(){
             // Create Itemsgroup ID = 1
             await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'PEPSI',
                    supplyType: 1,
                    supplyData: 10,
                    itemType: 1,
                    itemData: 0,
                    burnType: 1,
                    burnData: 5
                });
            
            // Create Itemsgroup ID = 2
            await super1155.connect(owner).configureGroup(itemGroupId2, {
                name: 'COLA',
                    supplyType: 0,
                    supplyData: 15,
                    itemType: 1,
                    itemData: 0,
                    burnType: 2,
                    burnData: 5
                });

            // Create Itemsgroup Non Fungible ID = 3
            await super1155.connect(owner).configureGroup(itemGroupId2.add(1), {
                name: 'MIRANDA',
                    supplyType: 1,
                    supplyData: 1,
                    itemType: 0,
                    itemData: 1,
                    burnType: 2,
                    burnData: 0
                });

            // Create Itemsgroup Semi Fungible ID = 4
            await super1155.connect(owner).configureGroup(itemGroupId2.add(2), {
                name: 'SEVENUP',
                    supplyType: 1,
                    supplyData: 1,
                    itemType: 2,
                    itemData: 0,
                    burnType: 2,
                    burnData: 0
                });
        });

        it('Reverts: mint to Zero address', async function () {
            // Mint to zero address
            await expect(
                super1155.connect(deployer).mintBatch(NULL_ADDRESS, [shiftedItemGroupId, shiftedItemGroupId2], ["5", "5"], DATA)
            ).to.be.revertedWith('MintToZeroAddress');
        });

        it('Reverts: ids and amounts length mismatch', async function () {
            // Mint with ids and amounts mismatch
            await expect(
                super1155.connect(deployer).mintBatch(deployer.address, [shiftedItemGroupId, shiftedItemGroupId2], ["5", "5", "5"], DATA)
            ).to.be.revertedWith('MintIdsAndAmountsLengthsMismatch');
        });

        it('Reverts: no valid permit', async function () {
            // Mint without permit
            await expect(
                super1155.connect(deployer).mintBatch(deployer.address, [shiftedItemGroupId, shiftedItemGroupId2], ["5", "5"], DATA)
            ).to.be.revertedWith('MintDoNotHaveRigthToMintThatItem');
        });

        it('Reverts: mint to non-existent itemsgroup', async function () {
            // Set Permit for minting
            await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );

            // MintChecker to non-existent group ID = 5
            let nonExistentGroup = shiftedItemGroupId.mul(5);
            await expect(
                super1155.connect(deployer).mintBatch(deployer.address, [nonExistentGroup, shiftedItemGroupId2], ["1", "1"], DATA)
            ).to.be.revertedWith('CanNotMintNonExistentItemGroup');
        });

        it('Reverts: minting beyond cap', async function () {
            // Set Permit for minting
            await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );

            // MintChecker to a group beyond its cap
            await expect(
                super1155.connect(deployer).mintBatch(deployer.address, [shiftedItemGroupId, shiftedItemGroupId2], ["10", "16"], DATA)
            ).to.be.revertedWith('CanNotMintGroupBeyongItsCap');
        });

        it('Reverts: minting more than one non-fungible item', async function () {
            // Set Permit for minting
            await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );

            // MintChecker to a non fungible group more than 1 amount
            let group3Item = (shiftedItemGroupId.mul(3)).add(2); // GroupID = 3, ItemID = 2
            await expect(
                super1155.connect(deployer).mintBatch(deployer.address, [group3Item], ["2"], DATA)
            ).to.be.revertedWith('CanNotMintMoreThanSingleNonfungibleItem');
        });

        it('Reverts: minting more than alloted semi-fungible items', async function () {
            // Set Permit for minting
            await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );

            // MintChecker to a semi fungible group more than 1 amount
            let group4Item = (shiftedItemGroupId.mul(4)).add(2); // GroupID = 3, ItemID = 2
            await expect(
                super1155.connect(deployer).mintBatch(deployer.address, [group4Item], ["2"], DATA)
            ).to.be.revertedWith('CanNotMintMoreThanAllotedSemifungibleItems');
        });

        it('should mint tokens in batch to an address', async function () {
            // Set Permit for minting
            await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );

            // Mint fungible group. Fungible items are coerced into the single group ID + index one slot.
            await super1155.connect(deployer).mintBatch(deployer.address, [shiftedItemGroupId], ["2"], DATA);

            // Check if the fungible items are minted at index 1 of the group
            await expect(
                await (await super1155.connect(owner).balanceOf(deployer.address, shiftedItemGroupId.add(1).toString()))
                ).to.be.equal("2");
        });

        it('should mint semi fungible tokens in batch to an address', async function () {
            // Create Itemsgroup Semi Fungible
            await super1155.connect(owner).configureGroup(itemGroupId2.add(3), {
                name: 'SEVENUP',
                    supplyType: 1,
                    supplyData: 1,
                    itemType: 2,
                    itemData: 1,
                    burnType: 2,
                    burnData: 0
                });

            // Set Permit for minting
            await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );

            let shiftedItemGroupId5 = shiftedItemGroupId.mul(5);

            // Mint semi fungible group.
            await super1155.connect(deployer).mintBatch(deployer.address, [shiftedItemGroupId5], ["1"], DATA);

            // Check if the fungible items are minted at index 1 of the group
            await expect(
                await (await super1155.connect(owner).balanceOf(deployer.address, shiftedItemGroupId5.toString()))
                ).to.be.equal("1");
        });
    });

    describe("burn, burnBatch, burnChecker", function () {
        let shiftedItemGroupId3, shiftedItemGroupId4;
        beforeEach(async function(){
            // Create Itemsgroup ID = 1
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'PEPSI',
                    supplyType: 0,
                    supplyData: 10,
                    itemType: 1,
                    itemData: 0,
                    burnType: 1,
                    burnData: 6
                });
            
            // Create Itemsgroup ID = 2
            await super1155.connect(owner).configureGroup(itemGroupId2, {
                name: 'COLA',
                    supplyType: 0,
                    supplyData: 15,
                    itemType: 1,
                    itemData: 0,
                    burnType: 2,
                    burnData: 5
                });

            // Create Itemsgroup ID = 3
            await super1155.connect(owner).configureGroup(itemGroupId2.add(1), {
                name: 'MIRANDA',
                    supplyType: 0,
                    supplyData: 10,
                    itemType: 1,
                    itemData: 0,
                    burnType: 1,
                    burnData: 6
                });
            
            // Create Itemsgroup ID = 4
            await super1155.connect(owner).configureGroup(itemGroupId2.add(2), {
                name: 'SEVENUP',
                    supplyType: 0,
                    supplyData: 15,
                    itemType: 1,
                    itemData: 0,
                    burnType: 2,
                    burnData: 5
                });

            // Create the leftShifted itemgroup ID
            shiftedItemGroupId3 = shiftedItemGroupId.mul(3);
            shiftedItemGroupId4 = shiftedItemGroupId.mul(4);

            // Mint fungible item
            await super1155.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId], ["5"], DATA);
            await super1155.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId2], ["5"], DATA);
            await super1155.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId3], ["5"], DATA);
            await super1155.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId4], ["5"], DATA);
        });

        it('Reverts: burn has no valid permit', async function () {
            await expect(
                super1155.connect(deployer).burn(deployer.address, shiftedItemGroupId.add(1), "5")
            ).to.be.revertedWith('DoNotHaveRigthToBurn');
        });

        it('Reverts: burn from Zero address', async function () {
            // Burn from Zero address
            await expect(
                super1155.connect(owner).burn(NULL_ADDRESS, shiftedItemGroupId.add(1), "5")
                ).to.be.revertedWith('BurnFromTheZeroAddress');
        });

        it('Reverts: burn from non-existent itemgroup', async function () {
            // BurnChecker from non-existent group ID = 5
            let nonExistentGroup = shiftedItemGroupId.mul(5);
            await expect(
                super1155.connect(owner).burn(deployer.address, nonExistentGroup, "10")
                ).to.be.revertedWith('CanNotBurnNonExistentItemGroup');
        });

        it('Reverts: burn limit exceeded on itemgroup', async function () {
            // BurnChecker more than the burn limit
            await expect(
                super1155.connect(owner).burn(deployer.address, shiftedItemGroupId.add(1), "7")
                ).to.be.revertedWith('MayNotExceedTheBurnLimitOnThisItemGroup');

        });

        it('Reverts: burn amount is more than the holder balance', async function () {
            // Burn more than the balance of holder
            await expect(
                super1155.connect(owner).burn(deployer.address, shiftedItemGroupId.add(1), "6")
                ).to.be.revertedWith('BurnAmountExceedBalance');
        });

        it('should burn tokens individually based on UNIVERSAL, GROUP and ITEM circumstances (Modifier)', async function () {
            // Burn 1 amount successfully 
            super1155.connect(owner).burn(deployer.address, shiftedItemGroupId.add(1), "1");
            await expect(
                await super1155.connect(owner).balanceOf(deployer.address, shiftedItemGroupId.add(1))
            ).to.be.equal("4");

            // Set Permit for burning based on group circumstance
            let groupCirumstance = "0x0000000000000000000000000000000000000000000000000000000000000001"
            await super1155.connect(owner).setPermit(
                deployer.address,
                groupCirumstance,
                burnRight,
                ethers.constants.MaxUint256
            );
          
            await super1155.connect(deployer).burn(deployer.address, shiftedItemGroupId, "1");
            let balance = await super1155.connect(owner).balanceOf(deployer.address, shiftedItemGroupId.add(1));
            expect(balance).to.be.equal("3");

            // Set Permit for burning based on item circumstance
            let itemCirumstance = "0x0000000000000000000000000000000100000000000000000000000000000001"
            await super1155.connect(owner).setPermit(
                deployer.address,
                itemCirumstance,
                burnRight,
                ethers.constants.MaxUint256
            );

            await super1155.connect(deployer).burn(deployer.address, shiftedItemGroupId, "1");
            balance = await super1155.connect(owner).balanceOf(deployer.address, shiftedItemGroupId.add(1));
            expect(balance).to.be.equal("2");
        });

        it('should burn a non fungible token individually', async function () {
        // Edit Itemsgroup ID = 4
        await super1155.connect(owner).configureGroup(itemGroupId2.add(3), {
            name: 'MONSTER',
                supplyType: 1,
                supplyData: 1,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 1
            });

            let shiftedItemGroupId5 = shiftedItemGroupId.mul(5);

            // Mint 1 non fungible item
            await super1155.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId5], ["1"], DATA);

            await super1155.connect(owner).burn(deployer.address, shiftedItemGroupId5, "1");
        });

        it('Reverts: burnBatch from Zero address', async function () {
            // BurnBatch from Zero address
            await expect(
                super1155.connect(owner).burnBatch(NULL_ADDRESS, [shiftedItemGroupId3, shiftedItemGroupId4], ["5", "5"])
                ).to.be.revertedWith('BurnFromTheZeroAddress');
        });

        it('Reverts: burnBatch ids and amounts length mismatch', async function () {
            // BurnBatch with id and amount length mismatch
            await expect(
                super1155.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId3, shiftedItemGroupId4], ["5", "5", "5"])
                ).to.be.revertedWith('BurnIdsAndAmountsLengthsMismatch');
        });

        it('Reverts: burnBatch has no valid permit', async function () {
            // BurnBatch without permission
            await expect(
                super1155.connect(deployer).burnBatch(deployer.address, [shiftedItemGroupId3, shiftedItemGroupId4], ["5", "5"])
                ).to.be.revertedWith('DoNotHaveTheRigthToBurnThatItem');
        });

        it('Reverts: burnBatch from non-existent itemgroups', async function () {
            // BurnChecker from non-existent group ID = 5
            let nonExistentGroup = shiftedItemGroupId.mul(5);
            await expect(
                super1155.connect(owner).burnBatch(deployer.address, [nonExistentGroup, shiftedItemGroupId4], ["5", "5"])
                ).to.be.revertedWith('CanNotBurnNonExistentItemGroup');
        });

        it('Reverts: burnBatch a non-burnable item group', async function () {
            // Edit Itemsgroup ID = 4
            await super1155.connect(owner).configureGroup(itemGroupId2.add(3), {
                name: 'MONSTER',
                    supplyType: 1,
                    supplyData: 1,
                    itemType: 0,
                    itemData: 0,
                    burnType: 0,
                    burnData: 1
                });
    
                let shiftedItemGroupId5 = shiftedItemGroupId.mul(5);
    
                // Mint 1 non fungible item
                await super1155.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId5], ["1"], DATA);
    
                await expect(
                    super1155.connect(owner).burn(deployer.address, shiftedItemGroupId5, "1")
                ).to.be.revertedWith("Super1155: you cannot burn a non-burnable item group");
            });

        it('Reverts: burnBatch limit exceeded the itemgroup burn limit', async function () {
            // BurnChecker more than the burn limit
            await expect(
                super1155.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId3, shiftedItemGroupId4], ["7", "6"])
                ).to.be.revertedWith('MayNotExceedTheBurnLimitOnThisItemGroup');
        });

        it('Reverts: burnBatch amount is more than holder balance', async function () {
            // Burn more than the balances of holders
            await expect(
                super1155.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId3, shiftedItemGroupId4], ["6", "5"])
                ).to.be.revertedWith('BurnAmountExceedBalance');
        });

        it('should burnBatch tokens in batch based on UNIVERSAL, GROUP and ITEM circumstances (Function)', async function () {
            // Burn 1 amount from each address successfully 
            await super1155.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId3, shiftedItemGroupId4], ["1", "1"]);
            let balancesBatch = await super1155.connect(owner).balanceOfBatch([deployer.address, deployer.address], [shiftedItemGroupId3.add(1), shiftedItemGroupId4.add(1)]);
            expect(balancesBatch[0]).to.be.equal("4");
            expect(balancesBatch[1]).to.be.equal("4");

            // Set Permit for burning based on group circumstance
            let groupCirumstance = "0x0000000000000000000000000000000000000000000000000000000000000003"
            await super1155.connect(owner).setPermit(
                deployer.address,
                groupCirumstance,
                burnRight,
                ethers.constants.MaxUint256
            );
          
            await super1155.connect(deployer).burnBatch(deployer.address, [shiftedItemGroupId3], ["1"]);
            balancesBatch = await super1155.connect(owner).balanceOfBatch([deployer.address, deployer.address], [shiftedItemGroupId3.add(1), shiftedItemGroupId4.add(1)]);
            expect(balancesBatch[0]).to.be.equal("3");
            expect(balancesBatch[1]).to.be.equal("4");

            // Set Permit for burning based on item circumstance
            let itemCirumstance = "0x0000000000000000000000000000000400000000000000000000000000000001"
            await super1155.connect(owner).setPermit(
                deployer.address,
                itemCirumstance,
                burnRight,
                ethers.constants.MaxUint256
            );

            await super1155.connect(deployer).burnBatch(deployer.address, [shiftedItemGroupId4.add(1)], ["1"]);
            balancesBatch = await super1155.connect(owner).balanceOfBatch([deployer.address, deployer.address], [shiftedItemGroupId3.add(1), shiftedItemGroupId4.add(1)]);
            expect(balancesBatch[0]).to.be.equal("3");
            expect(balancesBatch[1]).to.be.equal("3");
        });
    });

    describe("setMetadata", function () {
        it('should set the metadata', async function () {
            // Set permit for configuring group
            await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setConfigureGroupRight,
                ethers.constants.MaxUint256
            );

             // Set permit for setting metadata
             await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setMetadataRight,
                ethers.constants.MaxUint256
            );

             // Set permit for locking an item
             await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                lockItemUriRight,
                ethers.constants.MaxUint256
            );
  
            // Create an ItemsGroup
            await super1155.connect(deployer).configureGroup(itemGroupId, {
                name: 'YOKITOKI',
                supplyType: 1,
                supplyData: 20000,
                itemType: 1,
                itemData: 0,
                burnType: 1,
                burnData: 2000
            });

            // Check if group has been created
            await expect(
                await (await super1155.connect(deployer).itemGroups(itemGroupId)).name
                ).to.be.equal("YOKITOKI");

            // Set metadata
            await super1155.connect(deployer).setMetadata(shiftedItemGroupId, DATA);

            // LockURI using overloaded method
            await super1155.connect(deployer)["lockURI(string,uint256)"](DATA, shiftedItemGroupId);

            // Check if metadata can be set again
            await expect(
                super1155.connect(deployer).setMetadata(shiftedItemGroupId, DATA)
                ).to.be.revertedWith('CanNotEditFrozenMetadata');            
        });
    });

    describe("lockURI", function () {
        it('Reverts: no valid permit', async function () {
            await expect(
                super1155["lockURI()"]()
            ).to.be.revertedWith('P1');
            expect(await super1155.uri(1)).to.equal(originalUri);
        });

        it('should set the metadataUri and lock it when there is a valid permit', async function () {
            // Set permit for locking
            await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                lockUriRight,
                ethers.constants.MaxUint256
            );
            await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setUriRight,
                ethers.constants.MaxUint256
            );
            await super1155.connect(deployer).setURI("://ipfs/lockeduri/{id}");
            await super1155.connect(deployer)["lockURI()"]();
            expect(await super1155.uri(1)).to.equal("://ipfs/lockeduri/{id}");
            expect(await super1155.uriLocked()).to.equal(true);
        });
    });

    describe("lock", function () {
        it('should lock the contract', async function () {
            // Lock the Contract
            await super1155.connect(owner).lock();

            // Check if group can be created
            await expect(super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'SUBWAY',
                supplyType: 0,
                supplyData: 2,
                itemType: 1,
                itemData: 0,
                burnType: 1,
                burnData: 5
            })).to.be.revertedWith('CollectionIsLockedGroupsCanNotBeCreated');
        });
    });

    describe("Synergy between (BurnTypes) <==> (burnBatch, mintBatch)", function () {
        // *Reminting means, minting to the token index which was burned
        // BurnType(0) = None,          | can be minted | can not be burned | can not be reminted*
        // BurnType(1) = Burnable,      | can be minted | can be burned     | can not be reminted*
        // BurnType(2) = Replenishable, | can be minted | can be burned     | can be reminted*
        it('should test BurnType=None group. can be minted | can not be burned | can not be reminted', async () => {
            // Create group
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 1,
                itemType: 0,
                itemData: 0,
                burnType: 0,
                burnData: 0
            });

            // Mint to the group. Group supplyData is full now
            await super1155.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId],
                [1],
                ethers.utils.id('a')
            );

            // Can not mint more beyond supply cap
            await expect(
                super1155.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId.add(1)],
                [1],
                ethers.utils.id('a')
            )).to.be.revertedWith('CanNotMintGroupBeyongItsCap');

            // Burning must fail regardless of whatever itemType it is
            await expect(
                super1155.connect(owner).burnBatch(
                    await signer1.address, [shiftedItemGroupId], [1])
            ).to.be.revertedWith("Super1155: you cannot burn a non-burnable item group");
        });

        it('should test BurnType=Burnable NFT group. can be minted | can be burned | can not be reminted', async () => {
            // Create group
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 3,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 2
            });

            // Mint to the group
            await super1155.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId],
                [1],
                ethers.utils.id('a')
            );

            // Mint to the group again
            await super1155.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId.add(1)],
                [1],
                ethers.utils.id('a')
            );

            // Check circulating supply, mintcount, burncount
            let group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("2"); // Circulation
            expect(group.mintCount).to.be.equal("2"); // Mints
            expect(group.burnCount).to.be.equal("0"); // Burns

            // Burn one item
            await super1155.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId], [1]);

            // Check circulating supply, mintcount, burncount
            group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("1"); // Circulation
            expect(group.mintCount).to.be.equal("2"); // Mints
            expect(group.burnCount).to.be.equal("1"); // Burns

            // Try reminting the same token ID and it must fail
            await expect(
                super1155.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId],
                    [1],
                    ethers.utils.id('a'))
                ).to.be.revertedWith('CanNotMintMoreThanSingleNonfungibleItem');
        });

        it('should test BurnType=Burnable FT group. can be minted | can be burned | can not be reminted', async () => {
            // Create group
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'FT',
                supplyType: 0,
                supplyData: 3,
                itemType: 1,
                itemData: 0,
                burnType: 1,
                burnData: 2
            });

            // Mint to the group. FT coerced to index = 1
            await super1155.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId],
                [1],
                ethers.utils.id('a')
            );

            // Mint to the group again
            await super1155.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId.add(1)],
                [1],
                ethers.utils.id('a')
            );

            // Check circulating supply, mintcount, burncount
            let group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("2"); // Circulation
            expect(group.mintCount).to.be.equal("2"); // Mints
            expect(group.burnCount).to.be.equal("0"); // Burns

            // Burn one item
            await super1155.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId.add(1)], [1]);

            // Check circulating supply, mintcount, burncount
            group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("1"); // Circulation
            expect(group.mintCount).to.be.equal("2"); // Mints
            expect(group.burnCount).to.be.equal("1"); // Burns

            // Try reminting the same token ID and it must pass within limits of supplyData
            await super1155.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId.add(1)],
                    [1],
                    ethers.utils.id('a'));

            // Try reminting again the same token ID and it must fail since it breaches supplyData
            await expect(
                super1155.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId.add(1)],
                    [1],
                    ethers.utils.id('a'))
                ).to.be.revertedWith('CanNotMintGroupBeyongItsCap');
        });

        it('should test BurnType=Burnable SFT group. can be minted | can be burned | can not be reminted', async () => {
            // Create group
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'SFT',
                supplyType: 0,
                supplyData: 5,
                itemType: 2,
                itemData: 2,
                burnType: 1,
                burnData: 3
            });

            // Mint to the group
            await super1155.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId],
                [1],
                ethers.utils.id('a')
            );

            // Mint to the group again
            await super1155.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId.add(1)],
                [2],
                ethers.utils.id('a')
            );

            // Can not mint more beyond supply cap
            await expect(
                super1155.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId.add(2)],
                    [3],
                    ethers.utils.id('a')
            )).to.be.revertedWith('CanNotMintGroupBeyongItsCap');

            // Can not mint more beyond itemData
            await expect(
                super1155.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId.add(1)],
                    [1],
                    ethers.utils.id('a')
            )).to.be.revertedWith('CanNotMintMoreThanAllotedSemifungibleItems');

            // Check circulating supply, mintcount, burncount
            let group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("3"); // Circulation
            expect(group.mintCount).to.be.equal("3"); // Mints
            expect(group.burnCount).to.be.equal("0"); // Burns

            // Burn one item
            await super1155.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId], [1]);

            // Check circulating supply, mintcount, burncount
            group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("2"); // Circulation
            expect(group.mintCount).to.be.equal("3"); // Mints
            expect(group.burnCount).to.be.equal("1"); // Burns

            // Try reminting the same token ID and it must pass
            // This passes because index 0, has still an itemData of 2
            // This does not remint, but mints the second amount
            await super1155.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId],
                    [1],
                    ethers.utils.id('a'));

            // Check circulating supply, mintcount, burncount
            group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("3"); // Circulation
            expect(group.mintCount).to.be.equal("4"); // Mints
            expect(group.burnCount).to.be.equal("1"); // Burns

            // Burn one item
            await super1155.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId], [1]);

            // Check circulating supply, mintcount, burncount
            group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("2"); // Circulation
            expect(group.mintCount).to.be.equal("4"); // Mints
            expect(group.burnCount).to.be.equal("2"); // Burns

            // Try reminting again, and it must fail
            // Fails because itemData limit has reached
            await expect(
                super1155.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId],
                    [1],
                    ethers.utils.id('a'))
            ).to.be.revertedWith('CanNotMintMoreThanAllotedSemifungibleItems');

            // Burn one item but from next item
            await super1155.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId.add(1)], [1]);

             // Check circulating supply, mintcount, burncount
             group = await super1155.itemGroups(itemGroupId);
             expect(group.circulatingSupply).to.be.equal("1"); // Circulation
             expect(group.mintCount).to.be.equal("4"); // Mints
             expect(group.burnCount).to.be.equal("3"); // Burns

            // Must revert because the itemData limit has been reached because of historic mints
            // Means burned amount can not be reminted
            await expect(
            super1155.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId.add(1)],
                [1],
                ethers.utils.id('a'))
            ).to.be.revertedWith('CanNotMintMoreThanAllotedSemifungibleItems');
        });
        
        it('should test BurnType=Replenishable NFT group. can be minted | can be burned | can be reminted', async () => {
            // Create group
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 3,
                itemType: 0,
                itemData: 0,
                burnType: 2,
                burnData: 2
            });

            // Mint to the group
            await super1155.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId],
                [1],
                ethers.utils.id('a')
            );

            // Mint to the group again
            await super1155.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId.add(1)],
                [1],
                ethers.utils.id('a')
            );

            // Check circulating supply, mintcount, burncount
            let group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("2"); // Circulation
            expect(group.mintCount).to.be.equal("2"); // Mints
            expect(group.burnCount).to.be.equal("0"); // Burns

            // Burn one item
            await super1155.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId], [1]);

            // Check circulating supply, mintcount, burncount
            group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("1"); // Circulation
            expect(group.mintCount).to.be.equal("2"); // Mints
            expect(group.burnCount).to.be.equal("1"); // Burns

            // Try reminting the same token ID and it must pass
            await super1155.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId],
                    [1],
                    ethers.utils.id('a'));

            // Try reminting the same token ID and it must fail
            await expect(
                super1155.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId],
                    [1],
                    ethers.utils.id('a'))
            ).to.be.revertedWith('CanNotMintMoreThanSingleNonfungibleItem');
        });

        it('should test BurnType=Replenishable FT group. can be minted | can be burned | can be reminted', async () => {
            // Create group
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'FT',
                supplyType: 0,
                supplyData: 3,
                itemType: 1,
                itemData: 0,
                burnType: 2,
                burnData: 2
            });

            // Mint to the group. FT coerced to index = 1
            await super1155.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId],
                [1],
                ethers.utils.id('a')
            );

            // Mint to the group again
            await super1155.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId.add(1)],
                [1],
                ethers.utils.id('a')
            );

            // Check circulating supply, mintcount, burncount
            let group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("2"); // Circulation
            expect(group.mintCount).to.be.equal("2"); // Mints
            expect(group.burnCount).to.be.equal("0"); // Burns

            // Burn one item
            await super1155.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId.add(1)], [1]);

            // Check circulating supply, mintcount, burncount
            group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("1"); // Circulation
            expect(group.mintCount).to.be.equal("2"); // Mints
            expect(group.burnCount).to.be.equal("1"); // Burns

            // Try reminting the same token ID and it must pass within limits of supplyData
            await super1155.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId.add(1)],
                [1],
                ethers.utils.id('a'));

            // Check circulating supply, mintcount, burncount
            group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("2"); // Circulation
            expect(group.mintCount).to.be.equal("3"); // Mints
            expect(group.burnCount).to.be.equal("1"); // Burns

            // Try reminting the same token ID and it must pass within limits of supplyData
            await super1155.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId.add(1)],
                [1],
                ethers.utils.id('a'));

            // Check circulating supply, mintcount, burncount
            group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("3"); // Circulation
            expect(group.mintCount).to.be.equal("4"); // Mints
            expect(group.burnCount).to.be.equal("1"); // Burns

            // Try reminting again the same token ID and it must fail since it breaches supplyData
            await expect(
                super1155.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId.add(1)],
                    [1],
                    ethers.utils.id('a'))
                ).to.be.revertedWith('CanNotMintGroupBeyongItsCap');

            // Burn one item
            await super1155.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId.add(1)], [1]);

            // Check circulating supply, mintcount, burncount
            group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("2"); // Circulation
            expect(group.mintCount).to.be.equal("4"); // Mints
            expect(group.burnCount).to.be.equal("2"); // Burns

            // Try reminting the same token ID and it must pass within limits of supplyData
            await super1155.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId.add(1)],
                [1],
                ethers.utils.id('a'));

            // Try reminting again the same token ID and it must fail since it breaches supplyData
            await expect(
                super1155.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId.add(1)],
                    [1],
                    ethers.utils.id('a'))
                ).to.be.revertedWith('CanNotMintGroupBeyongItsCap');
        });

        it('should test BurnType=Replenishable SFT group. can be minted | can be burned | can be reminted', async () => {
            // Create group
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'SFT',
                supplyType: 0,
                supplyData: 5,
                itemType: 2,
                itemData: 2,
                burnType: 2,
                burnData: 3
            });

            // Mint to the group
            await super1155.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId],
                [1],
                ethers.utils.id('a')
            );

            // Mint to the group again
            await super1155.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId.add(1)],
                [2],
                ethers.utils.id('a')
            );

            // Can not mint more beyond supply cap
            await expect(
                super1155.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId.add(2)],
                    [3],
                    ethers.utils.id('a')
            )).to.be.revertedWith('CanNotMintGroupBeyongItsCap');

            // Can not mint more beyond itemData
            await expect(
                super1155.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId.add(1)],
                    [1],
                    ethers.utils.id('a')
            )).to.be.revertedWith('CanNotMintMoreThanAllotedSemifungibleItems');

            // Check circulating supply, mintcount, burncount
            let group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("3"); // Circulation
            expect(group.mintCount).to.be.equal("3"); // Mints
            expect(group.burnCount).to.be.equal("0"); // Burns

            // Burn one item
            await super1155.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId], [1]);

            // Check circulating supply, mintcount, burncount
            group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("2"); // Circulation
            expect(group.mintCount).to.be.equal("3"); // Mints
            expect(group.burnCount).to.be.equal("1"); // Burns

            // Try reminting the same token ID and it must pass
            await super1155.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId],
                    [1],
                    ethers.utils.id('a'));

            // Check circulating supply, mintcount, burncount
            group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("3"); // Circulation
            expect(group.mintCount).to.be.equal("4"); // Mints
            expect(group.burnCount).to.be.equal("1"); // Burns

            // Burn one item
            await super1155.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId], [1]);

            // Check circulating supply, mintcount, burncount
            group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("2"); // Circulation
            expect(group.mintCount).to.be.equal("4"); // Mints
            expect(group.burnCount).to.be.equal("2"); // Burns

            // Try reminting again, and it must pass
            await super1155.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId],
                    [1],
                    ethers.utils.id('a'))

            // Check circulating supply, mintcount, burncount
            group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("3"); // Circulation
            expect(group.mintCount).to.be.equal("5"); // Mints
            expect(group.burnCount).to.be.equal("2"); // Burns

            // Try reminting again, and it must pass
            await super1155.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId],
                [1],
                ethers.utils.id('a'))

            // Check circulating supply, mintcount, burncount
            group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("4"); // Circulation
            expect(group.mintCount).to.be.equal("6"); // Mints
            expect(group.burnCount).to.be.equal("2"); // Burns

            // Fails because itemData limit has reached
            await expect(
                super1155.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId],
                    [1],
                    ethers.utils.id('a'))
            ).to.be.revertedWith('CanNotMintMoreThanAllotedSemifungibleItems');

            // Burn one item but from next item
            await super1155.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId.add(1)], [1]);

            // Check circulating supply, mintcount, burncount
            group = await super1155.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("3"); // Circulation
            expect(group.mintCount).to.be.equal("6"); // Mints
            expect(group.burnCount).to.be.equal("3"); // Burns

            // It must pass because of replenishability
            await super1155.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId.add(1)],
                [1],
                ethers.utils.id('a'))

            // Must revert because the itemData limit has been reached
            await expect(
            super1155.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId.add(1)],
                [1],
                ethers.utils.id('a'))
            ).to.be.revertedWith('CanNotMintMoreThanAllotedSemifungibleItems');
        });
    });
    
});