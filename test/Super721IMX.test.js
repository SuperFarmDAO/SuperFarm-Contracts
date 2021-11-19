const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { ethers } = require('hardhat');
const Web3 = require('web3');

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const DECIMALS = 2;

const AMT = 150

///////////////////////////////////////////////////////////
// SEE https://hardhat.org/tutorial/testing-contracts.html
// FOR HELP WRITING TESTS
// USE https://github.com/gnosis/mock-contract FOR HELP
// WITH MOCK CONTRACT
///////////////////////////////////////////////////////////

// Start test block
describe('===Super721IMX===', function () {
    let deployer, owner, signer1, signer2, signer3;
    let setUriRight,
        lockUriRight,
        lockItemUriRight,
        mintRight,
        setMetadataRight,
        lockCreationRight,
        setProxyRegistryRight,
        setConfigureGroupRight;
    let UNIVERSAL;
    let super721IMX;
    let proxyRegistry;
    let mockIMXCore;
    let super721IMXLock;
    const originalUri = "://ipfs/uri/";
    let itemGroupId = ethers.BigNumber.from(1);
    let shiftedItemGroupId = itemGroupId.shl(128);
    let itemGroupId2 = ethers.BigNumber.from(2);
    let shiftedItemGroupId2 = itemGroupId2.shl(128);

    before(async function () {
        this.Super721IMX = await ethers.getContractFactory("Super721IMX");
        this.ProxyRegistry = await ethers.getContractFactory("MockProxyRegistry");
        this.MockIMXCore = await ethers.getContractFactory("MockIMXCore");
        this.Super721IMXLock = await ethers.getContractFactory("Super721IMXLock");
    });

    beforeEach(async function () {
        [deployer, owner, signer1, signer2, signer3] = await ethers.getSigners();

        proxyRegistry = await this.ProxyRegistry.deploy();
        await proxyRegistry.deployed();

        mockIMXCore = await this.MockIMXCore.deploy();
        await mockIMXCore.deployed();

        super721IMXLock = await this.Super721IMXLock.deploy(owner.address);
        await super721IMXLock.deployed()

        super721IMX = await this.Super721IMX.deploy(
            owner.address,
            "Super721IMX",
            "SIMX721",
            originalUri,
            originalUri,
            proxyRegistry.address,
            mockIMXCore.address,
            super721IMXLock.address
        );
        await super721IMX.deployed();
        
        setUriRight = await super721IMX.SET_URI();
        lockUriRight = await super721IMX.LOCK_URI();
        lockItemUriRight = await super721IMX.LOCK_ITEM_URI();
        mintRight = await super721IMX.MINT();
        setProxyRegistryRight = await super721IMX.SET_PROXY_REGISTRY();
        setMetadataRight = await super721IMX.SET_METADATA();
        lockCreationRight = await super721IMX.LOCK_CREATION();
        setConfigureGroupRight = await super721IMX.CONFIGURE_GROUP();
        UNIVERSAL = await super721IMX.UNIVERSAL();
    });

    // Test cases

    //////////////////////////////
    //       Constructor
    //////////////////////////////
    describe("Constructor", function () {
        it('initialized values as expected', async function () {
            expect(await super721IMX.owner()).to.equal(owner.address);
            expect(await super721IMX.name()).to.equal('Super721IMX');
            expect(await super721IMX.metadataUri()).to.equal(originalUri);
            expect(await super721IMX.proxyRegistryAddress()).to.equal(proxyRegistry.address);
            expect(await super721IMX.imxCoreAddress()).to.equal(mockIMXCore.address);
        });

        it('should initialize a new instance succesfully where deployer is the owner', async function () {
            let super721IMXv2 = await this.Super721IMX.deploy(
                deployer.address,
                "Super721IMX",
                "SIMX721",
                originalUri,
                originalUri,
                proxyRegistry.address,
                mockIMXCore.address,
                super721IMXLock.address
            );
            expect(await super721IMXv2.owner()).to.equal(deployer.address);
            expect(await super721IMXv2.name()).to.equal('Super721IMX');
            expect(await super721IMXv2.metadataUri()).to.equal(originalUri);
            expect(await super721IMXv2.proxyRegistryAddress()).to.equal(proxyRegistry.address);
            expect(await super721IMXv2.imxCoreAddress()).to.equal(mockIMXCore.address);
        });
    });

    describe("uri", function () {
        it('returns the metadataUri', async function () {
            expect(await super721IMX.metadataUri()).to.equal(originalUri);
        });
    });

    describe("setURI", function () {
        it('reverts when there is not a valid permit for sender', async function () {
            await expect(
                super721IMX.setURI("://ipfs/newuri/{id}")
            ).to.be.revertedWith('P1');
            expect(await super721IMX.contractURI()).to.equal(originalUri);
        });

        it('reverts when the collection has been locked', async function () {
            await super721IMX.connect(owner).lockURI();

            console.log(await super721IMX.uriLocked());

            await expect(
                super721IMX.connect(owner).setURI("://ipfs/newuri/")
            ).to.be.revertedWith("Ix05");

            expect(await super721IMX.contractURI()).to.equal('://ipfs/uri/');
        });

        it('sets the metadataUri when there is a valid permit', async function () {
            await super721IMX.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setUriRight,
                ethers.constants.MaxUint256
            );
            await super721IMX.connect(deployer).setURI("://ipfs/newuri/");
            expect(await super721IMX.metadataUri()).to.equal("://ipfs/newuri/");
            expect(await super721IMX.uriLocked()).to.equal(false);
        });
    });

    describe("lockURI", function () {
        it('reverts when there is not a valid permit for sender', async function () {
            await expect(
                super721IMX.lockURI()
            ).to.be.revertedWith('P1');
            expect(await super721IMX.metadataUri()).to.equal(originalUri);
        });

        it('sets the metadataUri and locks it when there is a valid permit', async function () {
            await super721IMX.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setUriRight,
                ethers.constants.MaxUint256
            );

            await super721IMX.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                lockUriRight,
                ethers.constants.MaxUint256
            );
            await super721IMX.connect(deployer).setURI("://ipfs/lockeduri/{id}");
            await super721IMX.connect(deployer).lockURI();
            expect(await super721IMX.metadataUri()).to.equal("://ipfs/lockeduri/{id}");
            expect(await super721IMX.uriLocked()).to.equal(true);
        });
    });

    describe("lockItemGroupURI", function () {
        it('reverts when there is not a valid permit for sender', async function () {
            expect(await super721IMX.metadataFrozen(1)).to.equal(false);
            await expect(
                super721IMX.lockItemURI("://ipfs/lockeduri/{id}", 1)
            ).to.be.revertedWith('Ix01');
            expect(await super721IMX.metadataFrozen(1)).to.equal(false);
        });

        it('sets the metadataUri and locks it when there is a valid permit', async function () {
            await super721IMX.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                lockItemUriRight,
                ethers.constants.MaxUint256
            );
            expect(await super721IMX.metadataFrozen(1)).to.equal(false);
            await super721IMX.lockItemURI("://ipfs/lockeduri/", 1);
            expect(await super721IMX.metadataFrozen(1)).to.equal(true);
            expect(await super721IMX.metadataUri()).to.equal("://ipfs/uri/");
            expect(await super721IMX.uriLocked()).to.equal(false);
        });
    });

    describe("setProxyRegistry", function () {
        it('Reverts: no setProxyRegistry permissions', async () => {
            await expect(
                super721IMX.setProxyRegistry(signer1.address)
            ).to.be.revertedWith("P1");
        });

        it('allows setProxyRegistry when permissions', async () => {
            let currentBlockNumber = await ethers.provider.getBlockNumber();
            let block = await ethers.provider.getBlock(currentBlockNumber);
            let expiration = block.timestamp + 10000;

            await super721IMX.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setProxyRegistryRight,
                expiration
            );
            expect(await super721IMX.proxyRegistryAddress()).to.equal(proxyRegistry.address);
            await super721IMX.setProxyRegistry(signer1.address);
            expect(await super721IMX.proxyRegistryAddress()).to.equal(signer1.address);
        });
    });

    describe("balanceOfGroup", function () {
        it('Reverts: querying balance of address(0)', async () => {
            await expect(
                super721IMX.balanceOfGroup(NULL_ADDRESS, 1)
            ).to.be.revertedWith("Ix07");
        });

        it('returns the balanceOfGroup other addresses', async () => {
            expect(await super721IMX.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(0);

            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });
            await super721IMX.connect(owner).mintBatch(
                signer1.address,
                [shiftedItemGroupId],
                ethers.utils.id('a')
            );

            expect(await super721IMX.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721IMX.balanceOfGroup(signer2.address, shiftedItemGroupId)).to.equal(0);
        });
    });

    describe("lock", function () {
        it('Reverts: permit is not valid unless owner is sender', async () => {
            await expect(
                super721IMX.lock()
            ).to.be.revertedWith("P1");

            expect(await super721IMX.locked()).to.equal(false);
            await super721IMX.connect(owner).lock();
            expect(await super721IMX.locked()).to.equal(true);
        });

        it('sets locked to true when the permit is valid', async () => {
            let currentBlockNumber = await ethers.provider.getBlockNumber();
            let block = await ethers.provider.getBlock(currentBlockNumber);
            let expiration = block.timestamp + 10000;

            await super721IMX.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                lockCreationRight,
                expiration
            );

            expect(await super721IMX.locked()).to.equal(false);
            await super721IMX.lock();
            expect(await super721IMX.locked()).to.equal(true);
        });
    });

    describe("isApprovedForAll", function () {
        it('Reverts: setting approval status for self', async () => {
            await expect(
                super721IMX.setApprovalForAll(deployer.address, true)
            ).to.be.revertedWith("Ix09");
        });

        it('uses operatorApprovals except when the operator is registered in the proxyRegistry', async () => {
            expect(await super721IMX.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
            await super721IMX.setApprovalForAll(signer1.address, true);
            expect(await super721IMX.isApprovedForAll(deployer.address, signer1.address)).to.equal(true);
            await super721IMX.setApprovalForAll(signer1.address, false);
            expect(await super721IMX.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
        });

        it('returns true when proxyRegistry.proxies(_owner) == operator', async () => {
            expect(await super721IMX.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
            expect(await proxyRegistry.proxies(deployer.address)).to.equal(NULL_ADDRESS);
            await proxyRegistry.connect(deployer).setProxy(deployer.address, signer1.address);
            expect(await proxyRegistry.proxies(deployer.address)).to.equal(signer1.address);
            expect(await super721IMX.isApprovedForAll(deployer.address, signer1.address)).to.equal(true);
            await proxyRegistry.connect(deployer).setProxy(deployer.address, NULL_ADDRESS);
            expect(await proxyRegistry.proxies(deployer.address)).to.equal(NULL_ADDRESS);
            expect(await super721IMX.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
        });
    });

    describe("safeBatchTransferFrom", function () {
        it('Reverts: when ERC721Receiver does not return onERC721Received.selector', async () => {
            let itemGroupIdTransferException = ethers.BigNumber.from(999);
            let shiftedItemGroupIdTransferException = itemGroupIdTransferException.shl(128);

            await super721IMX.connect(owner).configureGroup(itemGroupIdTransferException, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });

            await super721IMX.connect(owner).mintBatch(
                signer1.address,
                [shiftedItemGroupIdTransferException],
                ethers.utils.id('a')
            );

            expect(await super721IMX.balanceOfGroup(signer1.address, shiftedItemGroupIdTransferException)).to.equal(1);

            // Transfer to Non-ERC721 receiver implementor
            await expect(
                super721IMX.connect(signer1).safeBatchTransferFrom(
                    signer1.address,
                    proxyRegistry.address,
                    [shiftedItemGroupIdTransferException],
                    ethers.utils.id(''))
            ).to.be.revertedWith("Ix10");

            let MockERC721Receiver1 = await ethers.getContractFactory("MockERC721Receiver1");
            let mockERC721Receiver1 = await MockERC721Receiver1.deploy();
            await mockERC721Receiver1.deployed();

            await expect(
                super721IMX.connect(signer1).safeBatchTransferFrom(
                    signer1.address,
                    mockERC721Receiver1.address,
                    [shiftedItemGroupIdTransferException],
                    ethers.utils.id(''))
            ).to.be.revertedWith("Ix09");

            expect(await super721IMX.balanceOfGroup(signer1.address, shiftedItemGroupIdTransferException)).to.equal(1);

            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT2',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });

            await super721IMX.connect(owner).mintBatch(
                signer1.address,
                [shiftedItemGroupId],
                ethers.utils.id('a')
            );
            expect(await super721IMX.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721IMX.balanceOfGroup(mockERC721Receiver1.address, shiftedItemGroupId)).to.equal(0);
            await super721IMX.connect(signer1).safeBatchTransferFrom(
                signer1.address,
                mockERC721Receiver1.address,
                [shiftedItemGroupId],
                ethers.utils.id('b')
            );

            expect(await super721IMX.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(0);
            expect(await super721IMX.balanceOfGroup(mockERC721Receiver1.address, shiftedItemGroupId)).to.equal(1);
        });
        it('Reverts: when insufficient balance for transfer', async () => {
            let MockERC721Receiver1 = await ethers.getContractFactory("MockERC721Receiver1");
            let mockERC721Receiver1 = await MockERC721Receiver1.deploy();
            await mockERC721Receiver1.deployed();

            // trigger fail with arbitrary fail value ([2])
            await expect(
                super721IMX.connect(signer1).safeBatchTransferFrom(
                    signer1.address,
                    mockERC721Receiver1.address,
                    [2],
                    ethers.utils.id('b'))
            ).to.be.revertedWith("Ix16");
        });
        it('Reverts: transfer to the 0 address', async () => {
            await expect(
                super721IMX.safeBatchTransferFrom(signer1.address, NULL_ADDRESS, [1], ethers.utils.id('a'))
            ).to.be.revertedWith("Ix14");
        });
        it('Reverts: caller is not owner nor approved', async () => {
            // not owner or approved
            await expect(
                super721IMX.connect(signer3).safeBatchTransferFrom(signer1.address, super721IMX.address, [1], ethers.utils.id('a'))
            ).to.be.revertedWith("Ix15");
        });
        it('transfers in batches, safely', async () => {
            let MockERC721Receiver1 = await ethers.getContractFactory("MockERC721Receiver1");
            let mockERC721Receiver1 = await MockERC721Receiver1.deploy();
            await mockERC721Receiver1.deployed();

            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT1',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });

            // configure group2 and mint both
            await super721IMX.connect(owner).configureGroup(itemGroupId2, {
                name: 'NFT2',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1, // what if 0/none? Update: 0 is unburnable
                burnData: 100
            });

            await expect(
                super721IMX.connect(owner).burnBatch(signer1.address, [shiftedItemGroupId2])
            ).to.be.revertedWith("Ix33");

            // MINT
            await super721IMX.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId, shiftedItemGroupId2], ethers.utils.id('a'));

            expect(await super721IMX.balanceOfGroup(deployer.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721IMX.groupBalances(itemGroupId, deployer.address)).to.equal(1);
            expect(await super721IMX.balanceOfGroup(deployer.address, shiftedItemGroupId2)).to.equal(1);
            expect(await super721IMX.groupBalances(itemGroupId2, deployer.address)).to.equal(1);
            expect(await super721IMX.totalBalances(deployer.address)).to.equal(2);

            // caller is owner
            await super721IMX.safeBatchTransferFrom(
                deployer.address,
                signer2.address,
                [shiftedItemGroupId, shiftedItemGroupId2],
                ethers.utils.id('a')
            );

            expect(await super721IMX.balanceOfGroup(deployer.address, itemGroupId)).to.equal(0);
            expect(await super721IMX.groupBalances(shiftedItemGroupId, deployer.address)).to.equal(0);
            expect(await super721IMX.balanceOfGroup(deployer.address, shiftedItemGroupId2)).to.equal(0);
            expect(await super721IMX.groupBalances(itemGroupId2, deployer.address)).to.equal(0);
            expect(await super721IMX.totalBalances(deployer.address)).to.equal(0);

            expect(await super721IMX.balanceOfGroup(signer2.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721IMX.groupBalances(itemGroupId, signer2.address)).to.equal(1);
            expect(await super721IMX.balanceOfGroup(signer2.address, shiftedItemGroupId2)).to.equal(1);
            expect(await super721IMX.groupBalances(itemGroupId2, signer2.address)).to.equal(1);
            expect(await super721IMX.totalBalances(signer2.address)).to.equal(2);

            // configure group3
            let itemGroupId3 = itemGroupId.mul(3);
            await super721IMX.connect(owner).configureGroup(itemGroupId3, {
                name: 'NFT3',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });
            let shiftedItemGroupId3 = shiftedItemGroupId.mul(3);
            await super721IMX.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId3], ethers.utils.id('a'));

            // caller is approved
            await super721IMX.setApprovalForAll(signer1.address, true);
            await super721IMX.connect(signer1).safeBatchTransferFrom(
                deployer.address,
                signer3.address,
                [shiftedItemGroupId3],
                ethers.utils.id('a')
            );
            expect(await super721IMX.balanceOfGroup(deployer.address, shiftedItemGroupId3)).to.equal(0);
            expect(await super721IMX.groupBalances(itemGroupId3, deployer.address)).to.equal(0);
            expect(await super721IMX.totalBalances(deployer.address)).to.equal(0);
            expect(await super721IMX.balanceOfGroup(signer3.address, shiftedItemGroupId3)).to.equal(1);
            expect(await super721IMX.groupBalances(itemGroupId3, signer3.address)).to.equal(1);
            expect(await super721IMX.totalBalances(signer3.address)).to.equal(1);

            // to address is a contract
            await super721IMX.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId3.add(1)], ethers.utils.id('a'));
            await super721IMX.safeBatchTransferFrom(
                deployer.address,
                mockERC721Receiver1.address,
                [shiftedItemGroupId3.add(1)],
                ethers.utils.id('a')
            );
            expect(await super721IMX.balanceOfGroup(deployer.address, shiftedItemGroupId3.add(1))).to.equal(0);
            expect(await super721IMX.groupBalances(itemGroupId3, deployer.address)).to.equal(0);
            expect(await super721IMX.totalBalances(deployer.address)).to.equal(0);
            expect(await super721IMX.balanceOfGroup(mockERC721Receiver1.address, shiftedItemGroupId3.add(1))).to.equal(1);
            expect(await super721IMX.groupBalances(itemGroupId3, mockERC721Receiver1.address)).to.equal(1);
            expect(await super721IMX.totalBalances(mockERC721Receiver1.address)).to.equal(1);
        });
    });

    describe("safeTransferFrom, transferFrom", function () {
        it('Reverts: when ERC721Receiver does not return onERC721Received.selector', async () => {
            let itemGroupIdTransferException = ethers.BigNumber.from(999);
            let shiftedItemGroupIdTransferException = itemGroupIdTransferException.shl(128);

            // Response is a selector
            let MockERC721Receiver1 = await ethers.getContractFactory("MockERC721Receiver1");
            let mockERC721Receiver1 = await MockERC721Receiver1.deploy();
            await mockERC721Receiver1.deployed();

            await super721IMX.connect(owner).configureGroup(itemGroupIdTransferException, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });

            await super721IMX.connect(owner).mintBatch(
                signer1.address,
                [shiftedItemGroupIdTransferException],
                ethers.utils.id('a')
            );

            expect(await super721IMX.balanceOfGroup(signer1.address, shiftedItemGroupIdTransferException)).to.equal(1);

            // Using the Overloaded variant which is without the bytes32 as parameter
            await expect(
                super721IMX.connect(signer1)["safeTransferFrom(address,address,uint256)"](
                    signer1.address,
                    mockERC721Receiver1.address,
                    shiftedItemGroupIdTransferException)
            ).to.be.revertedWith("Ix09");

            // Using the Overloaded variant which is without the bytes32 as parameter
            await expect(
                super721IMX.connect(signer1)["safeTransferFrom(address,address,uint256)"](
                    signer1.address,
                    proxyRegistry.address,
                    shiftedItemGroupIdTransferException)
            ).to.be.revertedWith("Ix10");

            expect(await super721IMX.balanceOfGroup(signer1.address, shiftedItemGroupIdTransferException)).to.equal(1);
        });
        it('Reverts: transfer to the 0 address', async () => {
            await expect(
                super721IMX["safeTransferFrom(address,address,uint256)"](signer1.address, NULL_ADDRESS, 1)
            ).to.be.revertedWith("Ix11");
        });
        it('Reverts: call is not owner nor approved', async () => {
            // not owner
            await expect(
                super721IMX["safeTransferFrom(address,address,uint256)"](signer1.address, super721IMX.address, 1)
            ).to.be.revertedWith("Ix12");

            // not approved
            await expect(
                super721IMX.connect(signer3)["safeTransferFrom(address,address,uint256)"](signer1.address, super721IMX.address, 1)
            ).to.be.revertedWith("Ix12");
        });
        it('should safeTransferFrom', async () => {
            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });

            // configure group2 and mint both
            await super721IMX.connect(owner).configureGroup(itemGroupId2, {
                name: 'NFT2',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });

            await expect(
                super721IMX.connect(owner).burnBatch(signer1.address, [shiftedItemGroupId2])
            ).to.be.revertedWith("Ix33");

            // MINT
            await super721IMX.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId, shiftedItemGroupId2], ethers.utils.id('a'));

            expect(await super721IMX.balanceOfGroup(deployer.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721IMX.groupBalances(itemGroupId, deployer.address)).to.equal(1);
            expect(await super721IMX.totalBalances(deployer.address)).to.equal(2);
            expect(await super721IMX.balanceOfGroup(deployer.address, shiftedItemGroupId2)).to.equal(1);
            expect(await super721IMX.groupBalances(itemGroupId2, deployer.address)).to.equal(1);
            expect(await super721IMX.totalBalances(deployer.address)).to.equal(2);

            // caller is owner
            await super721IMX["safeTransferFrom(address,address,uint256,bytes)"](
                deployer.address,
                signer2.address,
                shiftedItemGroupId,
                ethers.utils.id('a')
            );

            expect(await super721IMX.balanceOfGroup(deployer.address, shiftedItemGroupId)).to.equal(0);
            expect(await super721IMX.groupBalances(itemGroupId, deployer.address)).to.equal(0);
            expect(await super721IMX.totalBalances(deployer.address)).to.equal(1);

            expect(await super721IMX.balanceOfGroup(signer2.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721IMX.groupBalances(itemGroupId, signer2.address)).to.equal(1);
            expect(await super721IMX.totalBalances(signer2.address)).to.equal(1);

            // caller is approved
            await super721IMX.setApprovalForAll(signer1.address, true);
            await super721IMX.connect(signer1)["safeTransferFrom(address,address,uint256,bytes)"](
                deployer.address,
                signer3.address,
                shiftedItemGroupId2,
                ethers.utils.id('a')
            );
            expect(await super721IMX.balanceOfGroup(deployer.address, shiftedItemGroupId2)).to.equal(0);
            expect(await super721IMX.groupBalances(itemGroupId2, deployer.address)).to.equal(0);
            expect(await super721IMX.totalBalances(deployer.address)).to.equal(0);
            expect(await super721IMX.balanceOfGroup(signer3.address, shiftedItemGroupId2)).to.equal(1);
            expect(await super721IMX.groupBalances(itemGroupId2, signer3.address)).to.equal(1);
            expect(await super721IMX.totalBalances(signer3.address)).to.equal(1);

            // to address is a contract
            let itemGroupId3 = itemGroupId.mul(3);
            let shiftedItemGroupId3 = shiftedItemGroupId.mul(3);

            // a contract
            let DummyContract = await ethers.getContractFactory("MockERC721Receiver1");
            let dummyContract = await DummyContract.deploy();
            await dummyContract.deployed();

            // configure group3
            await super721IMX.connect(owner).configureGroup(itemGroupId3, {
                name: 'NFT3',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });
            await super721IMX.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId3], ethers.utils.id('a'));
            await super721IMX["safeTransferFrom(address,address,uint256,bytes)"](
                deployer.address,
                dummyContract.address,
                shiftedItemGroupId3,
                ethers.utils.id('a')
            );
            expect(await super721IMX.balanceOfGroup(deployer.address, shiftedItemGroupId3)).to.equal(0);
            expect(await super721IMX.groupBalances(itemGroupId3, deployer.address)).to.equal(0);
            expect(await super721IMX.totalBalances(deployer.address)).to.equal(0);
            expect(await super721IMX.balanceOfGroup(dummyContract.address, shiftedItemGroupId3)).to.equal(1);
            expect(await super721IMX.groupBalances(itemGroupId3, dummyContract.address)).to.equal(1);
            expect(await super721IMX.totalBalances(dummyContract.address)).to.equal(1);
        });

        it('should transferFrom', async () => {
            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });

            await super721IMX.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId], ethers.utils.id('a'));

            expect(await super721IMX.balanceOfGroup(deployer.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721IMX.groupBalances(itemGroupId, deployer.address)).to.equal(1);
            expect(await super721IMX.totalBalances(deployer.address)).to.equal(1);

            await expect(
                super721IMX.connect(signer1).transferFrom(
                    deployer.address,
                    signer2.address,
                    shiftedItemGroupId,
            )).to.be.revertedWith("Ix36");

            await expect(
                super721IMX.transferFrom(
                    deployer.address,
                    signer2.address,
                    shiftedItemGroupId2,
            )).to.be.revertedWith("Ix35");

            await super721IMX.transferFrom(
                deployer.address,
                signer2.address,
                shiftedItemGroupId,
            );

            expect(await super721IMX.balanceOfGroup(deployer.address, shiftedItemGroupId)).to.equal(0);
            expect(await super721IMX.groupBalances(itemGroupId, deployer.address)).to.equal(0);
            expect(await super721IMX.totalBalances(deployer.address)).to.equal(0);

            expect(await super721IMX.balanceOfGroup(signer2.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721IMX.groupBalances(itemGroupId, signer2.address)).to.equal(1);
            expect(await super721IMX.totalBalances(signer2.address)).to.equal(1);
        });
    });

    describe("burnBatch", function () {
        it('Reverts: no right', async () => {
            await expect(
                super721IMX.burnBatch(signer1.address, [1])
            ).to.be.revertedWith("Ix32");
        });
        it('Reverts: non-existent group', async () => {
            await expect(
                super721IMX.connect(owner).burnBatch(signer1.address, [1])
            ).to.be.revertedWith("Ix29");
        });
        it('Reverts: burn limit exceeded', async () => {
            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 0
            });

            await expect(
                super721IMX.connect(owner).burnBatch(signer1.address, [shiftedItemGroupId])
            ).to.be.revertedWith("Ix31");
        });
        it('Reverts: burn zero address', async () => {
            await expect(
                super721IMX.connect(owner).burnBatch(NULL_ADDRESS, [shiftedItemGroupId])
            ).to.be.revertedWith("Super721::burnBatch: burn from the zero address");
        });
        it('Reverts: item is not burnable', async () => {
            await super721IMX.connect(owner).configureGroup(itemGroupId2, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 20000,
                burnType: 0, //non burnable item group
                burnData: 0
            });

            await super721IMX.connect(owner).mintBatch(
                signer1.address, [shiftedItemGroupId2], ethers.utils.id('a')
            );

            // Try burning a non burnable token
            await expect(
                super721IMX.connect(owner).burnBatch(signer1.address, [shiftedItemGroupId2])
            ).to.be.revertedWith("Ix30");
        });
        it('burns in batches replenishable items', async () => {
            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 1,
                burnType: 2, //replenishable item group
                burnData: 1
            });

            await super721IMX.connect(owner).mintBatch(
                signer1.address, [shiftedItemGroupId], ethers.utils.id('a')
            );

            expect(await super721IMX.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721IMX.groupBalances(itemGroupId, signer1.address)).to.equal(1);
            expect(await super721IMX.totalBalances(signer1.address)).to.equal(1);
            expect(await super721IMX.circulatingSupply(shiftedItemGroupId)).to.equal(1);
            expect(await super721IMX.burnCount(shiftedItemGroupId)).to.equal(0);

            // Try burning a replenishable token
            await super721IMX.connect(owner).burnBatch(signer1.address, [shiftedItemGroupId]);

            expect(await super721IMX.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(0);
            expect(await super721IMX.groupBalances(itemGroupId, signer1.address)).to.equal(0);
            expect(await super721IMX.totalBalances(signer1.address)).to.equal(0);
            expect(await super721IMX.circulatingSupply(shiftedItemGroupId)).to.equal(0);
            expect(await super721IMX.burnCount(shiftedItemGroupId)).to.equal(1);

            await super721IMX.connect(owner).mintBatch(
                signer1.address, [shiftedItemGroupId], ethers.utils.id('a')
            );

            expect(await super721IMX.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721IMX.groupBalances(itemGroupId, signer1.address)).to.equal(1);
            expect(await super721IMX.totalBalances(signer1.address)).to.equal(1);
            expect(await super721IMX.circulatingSupply(shiftedItemGroupId)).to.equal(1);
            expect(await super721IMX.burnCount(shiftedItemGroupId)).to.equal(1);
        });
        it('burns in batches', async () => {
            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });

            // configure group2
            await super721IMX.connect(owner).configureGroup(itemGroupId2, {
                name: 'NFT2',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });

            await expect(
                super721IMX.connect(owner).burnBatch(signer1.address, [shiftedItemGroupId, shiftedItemGroupId2])
            ).to.be.revertedWith("Ix33");

            // MINT
            await super721IMX.connect(owner).mintBatch(
                signer1.address, [shiftedItemGroupId, shiftedItemGroupId2], ethers.utils.id('a')
            );

            expect(await super721IMX.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721IMX.groupBalances(itemGroupId, signer1.address)).to.equal(1);
            expect(await super721IMX.totalBalances(signer1.address)).to.equal(2);
            expect(await super721IMX.circulatingSupply(shiftedItemGroupId)).to.equal(1);
            expect(await super721IMX.burnCount(shiftedItemGroupId)).to.equal(0);
            let genericTokensGroup = await super721IMX.itemGroups(itemGroupId);
            expect(genericTokensGroup[6]).to.equal(1); // circulatingSupply;
            expect(genericTokensGroup[8]).to.equal(0); // burnCount;

            expect(await super721IMX.balanceOfGroup(signer1.address, shiftedItemGroupId2)).to.equal(1);
            expect(await super721IMX.groupBalances(itemGroupId2, signer1.address)).to.equal(1);
            expect(await super721IMX.totalBalances(signer1.address)).to.equal(2);
            expect(await super721IMX.circulatingSupply(shiftedItemGroupId2)).to.equal(1);
            expect(await super721IMX.burnCount(shiftedItemGroupId2)).to.equal(0);
            let NFTTokenGroup = await super721IMX.itemGroups(itemGroupId2);
            expect(NFTTokenGroup[6]).to.equal(1); // circulatingSupply;
            expect(NFTTokenGroup[8]).to.equal(0); // burnCount;

            // BURN
            await super721IMX.connect(owner).burnBatch(
                signer1.address,
                [shiftedItemGroupId, shiftedItemGroupId2],
            );

            expect(await super721IMX.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(0);
            expect(await super721IMX.groupBalances(itemGroupId, signer1.address)).to.equal(0);
            expect(await super721IMX.totalBalances(signer1.address)).to.equal(0);
            genericTokensGroup = await super721IMX.itemGroups(itemGroupId);
            expect(genericTokensGroup[6]).to.equal(0); // circulatingSupply;
            expect(genericTokensGroup[8]).to.equal(1); // burnCount;
            expect(await super721IMX.circulatingSupply(shiftedItemGroupId)).to.equal(0);
            expect(await super721IMX.burnCount(shiftedItemGroupId)).to.equal(1);

            expect(await super721IMX.balanceOfGroup(signer1.address, shiftedItemGroupId2)).to.equal(0);
            expect(await super721IMX.groupBalances(itemGroupId2, signer1.address)).to.equal(0);
            expect(await super721IMX.totalBalances(signer1.address)).to.equal(0);
            expect(await super721IMX.circulatingSupply(shiftedItemGroupId2)).to.equal(0);
            expect(await super721IMX.burnCount(shiftedItemGroupId2)).to.equal(1);
            NFTTokenGroup = await super721IMX.itemGroups(itemGroupId2);
            expect(NFTTokenGroup[6]).to.equal(0); // circulatingSupply;
            expect(NFTTokenGroup[8]).to.equal(1); // burnCount;*/
        });
    });

    describe("configureGroup", function () {
        it('Reverts: groupId is 0', async () => {
            await expect(
                super721IMX.connect(owner).configureGroup(ethers.BigNumber.from(0), {
                    name: 'FrenBurgers',
                    supplyType: 0,
                    supplyData: 20000,
                    burnType: 1,
                    burnData: 20000
                })
            ).to.be.revertedWith("Ix17");
        });

        it('Reverts: sender does not have the right', async () => {
            await expect(
                super721IMX.configureGroup(itemGroupId, {
                    name: 'FrenBurgers',
                    supplyType: 0,
                    supplyData: 20000,
                    burnType: 1,
                    burnData: 20000
                })
            ).to.be.revertedWith("Ix01");
        });

        it('Reverts: collection is locked', async () => {
            await super721IMX.connect(owner).lock();

            await expect(
                super721IMX.connect(owner).configureGroup(itemGroupId, {
                    name: 'FrenBurgers',
                    supplyType: 0,
                    supplyData: 20000,
                    burnType: 1,
                    burnData: 20000
                })
            ).to.be.revertedWith("Ix18");
        });

        it('Reverts: cannot change a capped to uncap', async () => {
            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'FrenBurgers',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            })

            await expect(
                super721IMX.connect(owner).configureGroup(itemGroupId, {
                    name: 'FrenBurgers',
                    supplyType: 1,
                    supplyData: 20000,
                    burnType: 1,
                    burnData: 20000
                })
            ).to.be.revertedWith("Ix19");
        });

        it('Reverts: cannot increase supply of a capped group', async () => {
            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'FrenBurgers',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            })

            await expect(
                super721IMX.connect(owner).configureGroup(itemGroupId, {
                    name: 'FrenBurgers',
                    supplyType: 0,
                    supplyData: 30000,
                    burnType: 1,
                    burnData: 20000
                })
            ).to.be.revertedWith("Ix20");
        });

        it('Reverts: cannot decrease supply below circulating supply', async () => {
            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'FrenBurgers',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            })

            await super721IMX.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId], ethers.utils.id('a'));

            await expect(
                super721IMX.connect(owner).configureGroup(itemGroupId, {
                    name: 'FrenBurgers',
                    supplyType: 0,
                    supplyData: 0,
                    burnType: 1,
                    burnData: 20000
                })
            ).to.be.revertedWith("Ix21");
        });

        it('allows configuring a group when there is permission for GROUP circumstance', async () => {
            let groupCirumstance = "0x0000000000000000000000000000000000000000000000000000000000000001"
            await super721IMX.connect(owner).setPermit(
                signer1.address,
                groupCirumstance,
                setConfigureGroupRight,
                ethers.constants.MaxUint256
            );

            await super721IMX.connect(signer1).configureGroup(itemGroupId, {
                name: 'FrenBurgers',
                supplyType: 0,
                supplyData: 0,
                burnType: 1,
                burnData: 20000
            })

            await expect(
                await (await super721IMX.connect(owner).itemGroups(groupCirumstance)).name
                ).to.be.equal("FrenBurgers");
        });

        it('initializes a group and allows reconfiguration', async () => {
            // struct ItemGroupInput {
            //     string name;
            //     SupplyType supplyType;
            //     uint256 supplyData;
            //     BurnType burnType;
            //     uint256 burnData;
            //   }

            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                    name: 'FrenBurgers',
                    supplyType: 1,
                    supplyData: 20000,
                    burnType: 0,
                    burnData: 10000
            });

            let frenBurgersGroup = await super721IMX.itemGroups(itemGroupId);
            expect(frenBurgersGroup[0]).to.equal(true); // initialized;
            expect(frenBurgersGroup[1]).to.equal('FrenBurgers'); // name;
            expect(frenBurgersGroup[2]).to.equal(1); // supplyType;
            expect(frenBurgersGroup[3]).to.equal(20000); // supplyData;
            expect(frenBurgersGroup[4]).to.equal(0); // burnType;
            expect(frenBurgersGroup[5]).to.equal(10000); // burnData;
            expect(frenBurgersGroup[6]).to.equal(0); // circulatingSupply;
            expect(frenBurgersGroup[7]).to.equal(0); // mintCount;
            expect(frenBurgersGroup[8]).to.equal(0); // burnCount;

            // reconfiguring before minting
            // SupplyType can be changed from NOT Capped to anything
            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'BestFrenBurgers',
                supplyType: 0,
                supplyData: 20000,
                burnType: 0, // TODO: do we want, Update: 0 is non burnable
                burnData: 10000 // If it is zero, the burnData is useless
            });

            frenBurgersGroup = await super721IMX.itemGroups(itemGroupId);
            expect(frenBurgersGroup[0]).to.equal(true); // initialized;
            expect(frenBurgersGroup[1]).to.equal('BestFrenBurgers'); // name;
            expect(frenBurgersGroup[2]).to.equal(0); // supplyType;
            expect(frenBurgersGroup[3]).to.equal(20000); // supplyData;
            expect(frenBurgersGroup[4]).to.equal(0); // burnType; // TODO: change this?, Update: Why ?
            expect(frenBurgersGroup[5]).to.equal(10000); // burnData;
            expect(frenBurgersGroup[6]).to.equal(0); // circulatingSupply;
            expect(frenBurgersGroup[7]).to.equal(0); // mintCount;
            expect(frenBurgersGroup[8]).to.equal(0); // burnCount;


            // minting an item and then reconfiguring
            await super721IMX.connect(owner).setPermit(
                signer1.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );
            await super721IMX.connect(signer1).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'));
            expect(await super721IMX.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(1);

            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'BestFrenBurgers',
                supplyType: 0,
                supplyData: 1,
                burnType: 0,
                burnData: 10000
            });

            frenBurgersGroup = await super721IMX.itemGroups(itemGroupId);
            expect(frenBurgersGroup[0]).to.equal(true); // initialized;
            expect(frenBurgersGroup[1]).to.equal('BestFrenBurgers'); // name;
            expect(frenBurgersGroup[2]).to.equal(0); // supplyType;
            expect(frenBurgersGroup[3]).to.equal(1); // supplyData;
            expect(frenBurgersGroup[4]).to.equal(0); // burnType; // TODO: change this?
            expect(frenBurgersGroup[5]).to.equal(10000); // burnData;
            expect(frenBurgersGroup[6]).to.equal(1); // circulatingSupply;
            expect(frenBurgersGroup[7]).to.equal(1); // mintCount;
            expect(frenBurgersGroup[8]).to.equal(0); // burnCount;
        });
    });

    describe("tokenByIndex", function () {
        it('returns the token at a given index', async () => {
            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });

            await super721IMX.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'));
            expect(await super721IMX.tokenByIndex(0)).to.equal(shiftedItemGroupId);
            await super721IMX.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId.add(1)], ethers.utils.id('a'));
            expect(await super721IMX.tokenByIndex(1)).to.equal(shiftedItemGroupId.add(1));

            await expect(
                super721IMX.tokenByIndex(2)
            ).to.be.reverted;
            //).to.be.revertedWith("EnumerableMap: index out of bounds");
            // Solidiy 0.8.0 includes Panic codes for these situations instead of invalid opcode error
        });
    });

    describe("totalSupply", function () {
        it('returns the totalSupply of tokens', async () => {
            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });

            await super721IMX.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'));
            expect(await super721IMX.totalSupply()).to.equal(1);
            await super721IMX.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId.add(1)], ethers.utils.id('a'));

            expect(await super721IMX.totalSupply()).to.equal(2);

            await super721IMX.connect(owner).configureGroup(itemGroupId2, {
                name: 'GenericToken2',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });
            // here
            // TODO: see 2 vs 1.. amount not right
            // Update: It is probably because you were minting 2 NFTs at an index, 
            // Which should be impossible. So, the count was more but indices were less
            await super721IMX.connect(owner).mintBatch(
                signer1.address,
                [shiftedItemGroupId2.add(1), shiftedItemGroupId2.add(2), shiftedItemGroupId2.add(3)],
                ethers.utils.id('a')
            );
            // 2 supply in gorup1 and 3 supply in grooup2 equals totalsupply = 5
            expect(await super721IMX.totalSupply()).to.equal(5);
            expect(await super721IMX.balanceOf(signer1.address)).to.equal(5);
        });
    });

    describe("balanceOf", function () {
        it('Reverts: query for Zero address', async () => {
            await expect(super721IMX.balanceOf(NULL_ADDRESS)
            ).to.be.revertedWith("Ix08");
        });

        it('returns the balanceOf of tokens for an address', async () => {
            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });

            await super721IMX.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'));
            expect(await super721IMX.balanceOf(signer1.address)).to.equal(1);
            expect(await super721IMX.balanceOf(signer2.address)).to.equal(0);
            await super721IMX.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId.add(1)], ethers.utils.id('a'));
            expect(await super721IMX.balanceOf(signer1.address)).to.equal(2);
            expect(await super721IMX.balanceOf(signer2.address)).to.equal(0)


            await super721IMX.connect(owner).configureGroup(itemGroupId2, {
                name: 'GenericToken2',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });

            await super721IMX.connect(owner).mintBatch(
                signer2.address,
                [shiftedItemGroupId2.add(1), shiftedItemGroupId2.add(2), shiftedItemGroupId2.add(3)],
                ethers.utils.id('a')
            );
            expect(await super721IMX.totalSupply()).to.equal(5);

            expect(await super721IMX.balanceOf(signer1.address)).to.equal(2);
            expect(await super721IMX.balanceOf(signer2.address)).to.equal(3);
        });
    });

    describe("balanceOfBatch", function () {
        it('Reverts: accounts and ids mismatch', async () => {
            await expect(super721IMX.balanceOfBatch([signer2.address], [shiftedItemGroupId2, shiftedItemGroupId2.add(1)])
            ).to.be.revertedWith("");
        });
        it('returns the balanceOf of tokens for arrays addresses and indexes', async () => {
            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });

            expect((await super721IMX.balanceOfBatch([signer1.address], [shiftedItemGroupId]))[0]).to.equal(0);
            await super721IMX.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'));
            expect((await super721IMX.balanceOfBatch([signer1.address], [shiftedItemGroupId]))[0]).to.equal(1);
            expect((await super721IMX.balanceOfBatch([signer2.address], [shiftedItemGroupId]))[0]).to.equal(0);
            await super721IMX.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId.add(1)], ethers.utils.id('a'));
            expect((await super721IMX.balanceOfBatch([signer1.address], [shiftedItemGroupId]))[0]).to.equal(1);
            expect((await super721IMX.balanceOfBatch([signer1.address], [shiftedItemGroupId.add(1)]))[0]).to.equal(1);
            expect((await super721IMX.balanceOfBatch([signer2.address], [shiftedItemGroupId]))[0]).to.equal(0);


            await super721IMX.connect(owner).configureGroup(itemGroupId2, {
                name: 'GenericToken2',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });

            await super721IMX.connect(owner).mintBatch(
                signer2.address,
                [shiftedItemGroupId2.add(1), shiftedItemGroupId2.add(2), shiftedItemGroupId2.add(3)],
                ethers.utils.id('a')
            );

            expect((await super721IMX.balanceOfBatch([signer2.address], [shiftedItemGroupId2.add(1)]))[0]).to.equal(1);
            expect((await super721IMX.balanceOfBatch([signer2.address], [shiftedItemGroupId2.add(2)]))[0]).to.equal(1);
            expect((await super721IMX.balanceOfBatch([signer2.address], [shiftedItemGroupId2.add(3)]))[0]).to.equal(1);
            expect((await super721IMX.balanceOfBatch([signer2.address], [shiftedItemGroupId]))[0]).to.equal(0);
        });
    });

    describe("approve", function () {
        let tokenId;

        beforeEach(async function () {
            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });

            await super721IMX.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'));
            tokenId = super721IMX.tokenOfOwnerByIndex(signer1.address, 0);
        });

        it('Reverts: sender is not current owner', async () => {
            await expect(
                super721IMX.approve(signer2.address, tokenId)
            ).to.be.revertedWith("Ix04");
        });

        it('Reverts: approving current owner', async () => {
            await expect(
                super721IMX.connect(signer1).approve(signer1.address, tokenId)
            ).to.be.revertedWith("Ix03");
        });

        it('approves when owner approves another address', async () => {
            await expect(
                super721IMX.getApproved(4)
            ).to.be.revertedWith("Ix34");
            expect(await super721IMX.getApproved(tokenId)).to.equal(NULL_ADDRESS);
            await super721IMX.connect(signer1).approve(signer2.address, tokenId);
            expect(await super721IMX.getApproved(tokenId)).to.equal(signer2.address);
        });
    });

    describe("version", function () {
        it('returns 1', async () => {
            expect(await super721IMX.version()).to.equal(1);
        });
    });

    describe("ownerOf", function () {
        it('returns the ownerOf a given token based on tokenId', async () => {
            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });

            await super721IMX.connect(owner).setPermit(
                signer1.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );

            await super721IMX.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'));
            let tokenId = super721IMX.tokenOfOwnerByIndex(signer1.address, 0);
            expect(await super721IMX.ownerOf(tokenId)).to.equal(signer1.address);

            // configuring another ItemGroup and minting more
            await super721IMX.connect(owner).configureGroup(itemGroupId2, {
                name: 'NONFUNGIBLEFUNGUS',
                supplyType: 0,
                supplyData: 20000,
                burnType: 0,
                burnData: 20000
            });

            await super721IMX.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId2], ethers.utils.id('a'));
            let tokenId2 = super721IMX.tokenOfOwnerByIndex(signer1.address, 1);
            expect(await super721IMX.ownerOf(tokenId2)).to.equal(signer1.address);

            await super721IMX.connect(signer1)["safeTransferFrom(address,address,uint256)"](
                signer1.address,
                signer2.address,
                tokenId2
            );

            await expect(await super721IMX.ownerOf(tokenId2)
            ).to.be.equal(signer2.address);
        });
    });

    describe("mintBatch", function () {
        it('Reverts: mintBatch to address(0)', async () => {
            await expect(
                super721IMX.mintBatch(NULL_ADDRESS, [shiftedItemGroupId], ethers.utils.id('a'))
            ).to.be.revertedWith("Super721::mintBatch: mint to the zero address");
        });

        it('Reverts: token already exists"', async () => {
            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });

            await super721IMX.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'));

            await expect(
                super721IMX.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'))
            ).to.be.revertedWith("Ix23");
        });

        it('Reverts: mint to non existent group"', async () => {
            await expect(
                super721IMX.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'))
            ).to.be.revertedWith("Ix22");
        });

        it('Reverts: cannot mint beyond cap', async () => {
            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 1,
                burnType: 0,
                burnData: 0
            });

            await super721IMX.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'))
            await expect(
                super721IMX.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId.add(1)], ethers.utils.id('a'))
                ).to.be.revertedWith("Ix24");
        });
        it('should mint if there is a persmission for the group of the item', async () => {
            let groupCirumstance = "0x0000000000000000000000000000000000000000000000000000000000000001"
            await super721IMX.connect(owner).setPermit(
                signer1.address,
                groupCirumstance,
                mintRight,
                ethers.constants.MaxUint256
            );

            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'FrenBurgers',
                supplyType: 0,
                supplyData: 1,
                burnType: 1,
                burnData: 20000
            })

            await super721IMX.connect(signer1).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'));

        });
        it('should mint if there is a persmission for the specific ITEM circumstance', async () => {
            let itemCirumstance = "0x0000000000000000000000000000000100000000000000000000000000000001"
            await super721IMX.connect(owner).setPermit(
                signer1.address,
                itemCirumstance,
                mintRight,
                ethers.constants.MaxUint256
            );

            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'FrenBurgers',
                supplyType: 0,
                supplyData: 1,
                burnType: 1,
                burnData: 20000
            })

            await super721IMX.connect(signer1).mintBatch(signer1.address, [shiftedItemGroupId.add(1)], ethers.utils.id('a'));

        });
        it('allows mintBatch when rights and proper config', async () => {
            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });

            await expect(
                super721IMX.connect(signer1).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'))
            ).to.be.revertedWith("Ix25");

            await super721IMX.connect(owner).setPermit(
                signer1.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );

            let originalBalance = await super721IMX.balanceOfGroup(signer1.address, shiftedItemGroupId);
            let originalGroupBalance = await super721IMX.groupBalances(itemGroupId, signer1.address);
            let originalTotalBalance = await super721IMX.totalBalances(signer1.address);
            let originalCirculatingSupply = (await super721IMX.itemGroups(itemGroupId))[6];
            let originalMintCount = (await super721IMX.itemGroups(itemGroupId))[7];
            expect(originalBalance).to.equal(0);
            expect(originalGroupBalance).to.equal(0);
            expect(originalTotalBalance).to.equal(0);
            expect(originalCirculatingSupply).to.equal(0);
            await super721IMX.connect(signer1).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'));
            expect(await super721IMX.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(originalBalance.add(1));
            expect((await super721IMX.itemGroups(itemGroupId))[6]).to.equal(originalCirculatingSupply.add(1));
            expect((await super721IMX.itemGroups(itemGroupId))[7]).to.equal(originalMintCount.add(1));

            expect(
                await super721IMX.groupBalances(itemGroupId, signer1.address)
            ).to.equal(originalGroupBalance.add(1));

            expect(
                await super721IMX.totalBalances(signer1.address)
            ).to.equal(originalTotalBalance.add(1));

            // configuring another ItemGroup and minting more
            await super721IMX.connect(owner).configureGroup(itemGroupId2, {
                name: 'NONFungibleFungus',
                supplyType: 1,
                supplyData: 20000,
                itemType: 1,
                itemData: 0,
                burnType: 0,
                burnData: 20000
            });

            await expect(
                super721IMX.connect(signer2).mintBatch(signer1.address, [shiftedItemGroupId2], ethers.utils.id('a'))
            ).to.be.revertedWith("Ix25");

            await super721IMX.connect(owner).setPermit(
                signer2.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );

            let originalBalance2 = await super721IMX.balanceOfGroup(signer1.address, shiftedItemGroupId2);
            let originalGroupBalance2 = await super721IMX.groupBalances(itemGroupId2, signer1.address);
            let originalTotalBalance2 = await super721IMX.totalBalances(signer1.address);
            let originalCirculatingSupply2 = (await super721IMX.itemGroups(itemGroupId2))[6];
            let originalMintCount2 = (await super721IMX.itemGroups(itemGroupId2))[7];
            expect(originalBalance2).to.equal(0);
            expect(originalGroupBalance2).to.equal(0);
            expect(originalTotalBalance2).to.equal(1);
            expect(originalCirculatingSupply2).to.equal(0);
            await super721IMX.connect(signer2).mintBatch(signer1.address, [shiftedItemGroupId2], ethers.utils.id('a'));
            expect(await super721IMX.balanceOfGroup(signer1.address, shiftedItemGroupId2)).to.equal(originalBalance2.add(1));
            expect((await super721IMX.itemGroups(itemGroupId2))[6]).to.equal(originalCirculatingSupply2.add(1));
            expect((await super721IMX.itemGroups(itemGroupId2))[7]).to.equal(originalMintCount2.add(1));
        });
    });

    describe("setMetadata", function () {
        it('Reverts: no setMetadata permissions', async () => {
            await expect(
                super721IMX.setMetadata(1, 'mettaDatum')
            ).to.be.revertedWith("Ix01");
        });

        it('Reverts: global lockURI', async () => {
            await super721IMX.connect(owner).lockURI();

            await expect(
                super721IMX.connect(owner).setMetadata(1, 'mettaDatum')
            ).to.be.revertedWith("");
        });

        it('allows setMetadata when there is permission to the GROUP circumstance', async () => {
            let currentBlockNumber = await ethers.provider.getBlockNumber();
            let block = await ethers.provider.getBlock(currentBlockNumber);
            let expiration = block.timestamp + 10000;

            let groupCirumstance = "0x0000000000000000000000000000000000000000000000000000000000000001";
            await super721IMX.connect(owner).setPermit(
                deployer.address,
                groupCirumstance,
                setMetadataRight,
                expiration
            );

            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'FrenBurgers',
                supplyType: 0,
                supplyData: 0,
                burnType: 1,
                burnData: 20000
            })

            expect(await super721IMX.metadata(shiftedItemGroupId.add(1))).to.equal('');
            await super721IMX.setMetadata(shiftedItemGroupId.add(1), 'mettaDatum');
            expect(await super721IMX.metadata(shiftedItemGroupId.add(1))).to.equal('mettaDatum');
        });

        // NOTE: allows setMetadata for groups that aren't configured ¯\_(ツ)_/¯
        it('allows setMetadata when permission', async () => {
            let currentBlockNumber = await ethers.provider.getBlockNumber();
            let block = await ethers.provider.getBlock(currentBlockNumber);
            let expiration = block.timestamp + 10000;

            await super721IMX.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setMetadataRight,
                expiration
            );
            expect(await super721IMX.metadata(1)).to.equal('');
            await super721IMX.setMetadata(1, 'mettaDatum');
            expect(await super721IMX.metadata(1)).to.equal('mettaDatum');
        });
    });

    describe("tokenURI", function () {
        it('should return the tokenURI', async () => {
            console.log(await super721IMX.metadataUri());
            await super721IMX.connect(owner).setURI("://ipfs/uri/{id}.json");
            await expect(
                await super721IMX.tokenURI(3)
            ).to.be.equal("://ipfs/uri/3.json");
        });
    });

    describe("mintFor", function () {
        it('Reverts: caller is not IMX core', async () => {
            await expect(
                super721IMX.mintFor(signer1.address, shiftedItemGroupId, ethers.utils.id('a'))
            ).to.be.revertedWith("Ix26");
        });

        it('Reverts: mintFor function is locked', async () => {
            await super721IMXLock.connect(owner).toggleMintFor(); // LOCKED

            await expect(
                super721IMX.mintFor(signer1.address, shiftedItemGroupId, ethers.utils.id('a'))
            ).to.be.revertedWith("Ix26");

            await super721IMXLock.connect(owner).toggleMintFor(); // UNLOCKED

            await expect(
                super721IMX.mintFor(signer1.address, shiftedItemGroupId, ethers.utils.id('a'))
            ).to.be.revertedWith("Ix26");
        });

        it('IMX core should mint for an address', async () => {
            await mockIMXCore.setSuper721Address(super721IMX.address);

            await super721IMX.connect(owner).setPermit(
                mockIMXCore.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );

            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });
<<<<<<< HEAD
            await mockIMXCore.mintFor(signer1.address, 1, "0x00000000000000000000000000000001000000000000000000000000000000013a73646a666273646a6c666273646a6c666273646a6c6662736a6c646a73");

            await expect(
=======
            const tokenID = '340282366920938463463374607431768211457';
            const blueprint = 'superfarm.smth.com';
            const blob = toHex(`{${tokenID}}:{${blueprint}}`);
            await mockIMXCore.mintFor(signer1.address, 1, blob);
            expect(
>>>>>>> staging
                await super721IMX.balanceOf(signer1.address)
                ).to.be.equal("1");
            expect(await super721IMX.metadata( '340282366920938463463374607431768211457')).to.be.eq("superfarm.smth.com")
        });
    });

    describe("Synergy between (BurnTypes) <==> (burnBatch, mintBatch)", function () {
        // *Reminting means, minting to the token index which was burned
        // BurnType(0) = None,          | can be minted | can not be burned | can not be reminted*
        // BurnType(1) = Burnable,      | can be minted | can be burned     | can not be reminted*
        // BurnType(2) = Replenishable, | can be minted | can be burned     | can be reminted*
        it('should test BurnType=None group. can be minted | can not be burned | can not be reminted', async () => {
            // Create group
            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 1,
                burnType: 0,
                burnData: 0
            });

            // Mint to the group. Group supplyData is full now
            await super721IMX.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId],
                ethers.utils.id('a')
            );

            // Can not mint more beyond supply cap
            await expect(
            super721IMX.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId.add(1)],
                ethers.utils.id('a')
            )).to.be.revertedWith("Ix24");

            // Burning must fail
            await expect(
                super721IMX.connect(owner).burnBatch(
                    await signer1.address, [shiftedItemGroupId])
            ).to.be.revertedWith("Ix30");
        });

        it('should test BurnType=Burnable group. can be minted | can be burned | can not be reminted', async () => {
            // Create group
            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 2,
                burnType: 1,
                burnData: 2
            });

            // Mint to the group
            await super721IMX.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId],
                ethers.utils.id('a')
            );

            // Mint to the group again. Group ciculatingSupply is full now
            await super721IMX.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId.add(1)],
                ethers.utils.id('a')
            );

            // Can not mint more beyond supply cap
            await expect(
                super721IMX.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId.add(2)],
                    ethers.utils.id('a')
            )).to.be.revertedWith("Ix24");

            // Check circulating supply, mintcount, burncount
            let group = await super721IMX.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("2"); // Circulation
            expect(group.mintCount).to.be.equal("2"); // Mints
            expect(group.burnCount).to.be.equal("0"); // Burns

            // Burn one item
            await super721IMX.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId]);

            // Check circulating supply, mintcount, burncount
            group = await super721IMX.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("1"); // Circulation
            expect(group.mintCount).to.be.equal("2"); // Mints
            expect(group.burnCount).to.be.equal("1"); // Burns

            // Try reminting the same token ID and it must fail
            await expect(
                super721IMX.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId],
                    ethers.utils.id('a'))
                ).to.be.revertedWith("Ix23");

            // Burn one more item
            await super721IMX.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId.add(1)]);

            // Check circulating supply, mintcount, burncount
            group = await super721IMX.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("0"); // Circulation
            expect(group.mintCount).to.be.equal("2"); // Mints
            expect(group.burnCount).to.be.equal("2"); // Burns

            // Try reminting the same token ID and it must fail
            await expect(
                super721IMX.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId.add(1)],
                    ethers.utils.id('a'))
                ).to.be.revertedWith("Ix23");

            // Burning must fail since it reached the burnData limit
            await expect(
                super721IMX.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId])
            ).to.be.revertedWith("Ix31");
        });
        
        it('should test BurnType=Replenishable group. can be minted | can be burned | can be reminted', async () => {
            // Create group
            await super721IMX.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 2,
                burnType: 2,
                burnData: 2
            });

            // Mint to the group
            await super721IMX.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId],
                ethers.utils.id('a')
            );

            // Mint to the group again. Group ciculatingSupply is full now
            await super721IMX.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId.add(1)],
                ethers.utils.id('a')
            );

            // Can not mint more beyond supply cap
            await expect(
                super721IMX.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId.add(2)],
                    ethers.utils.id('a')
            )).to.be.revertedWith("Ix24");

            // Check circulating supply, mintcount, burncount
            let group = await super721IMX.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("2"); // Circulation
            expect(group.mintCount).to.be.equal("2"); // Mints
            expect(group.burnCount).to.be.equal("0"); // Burns

            // Burn one item
            await super721IMX.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId]);

            // Check circulating supply, mintcount, burncount
            group = await super721IMX.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("1"); // Circulation
            expect(group.mintCount).to.be.equal("2"); // Mints
            expect(group.burnCount).to.be.equal("1"); // Burns

            // Try reminting the same token ID and it must pass
            await super721IMX.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId],
                    ethers.utils.id('a'));

            // Check circulating supply, mintcount, burncount
            group = await super721IMX.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("2"); // Circulation
            expect(group.mintCount).to.be.equal("3"); // Mints
            expect(group.burnCount).to.be.equal("1"); // Burns

            // Can not mint more beyond supply cap
            await expect(
                super721IMX.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId.add(2)],
                    ethers.utils.id('a')
            )).to.be.revertedWith("Ix24");

            // Burn one more item
            await super721IMX.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId.add(1)]);

            // Check circulating supply, mintcount, burncount
            group = await super721IMX.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("1"); // Circulation
            expect(group.mintCount).to.be.equal("3"); // Mints
            expect(group.burnCount).to.be.equal("2"); // Burns

            // Try reminting the same token ID and it must pass
            await super721IMX.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId.add(1)],
                ethers.utils.id('a'));

            // Check circulating supply, mintcount, burncount
            group = await super721IMX.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("2"); // Circulation
            expect(group.mintCount).to.be.equal("4"); // Mints
            expect(group.burnCount).to.be.equal("2"); // Burns

            // Try reminting the same token ID and it must fail
            await expect(
                super721IMX.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId.add(1)],
                    ethers.utils.id('a'))
                ).to.be.revertedWith("Ix23");
        });
    });
    
});

function toHex(str) {
    let result = '';
    for (let i=0; i < str.length; i++) {
      result += str.charCodeAt(i).toString(16);
    }
    return '0x' + result;
  }
  
