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
describe('===Super721===', function () {
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
    let super721;
    let proxyRegistry;
    const originalUri = "://ipfs/uri/";
    const originalUri721 = "://ipfs/uri/";
    let itemGroupId = ethers.BigNumber.from(1);
    let shiftedItemGroupId = itemGroupId.shl(128);
    let itemGroupId2 = ethers.BigNumber.from(2);
    let shiftedItemGroupId2 = itemGroupId2.shl(128);

    before(async function () {
        this.Super721 = await ethers.getContractFactory("Super721");
        this.ProxyRegistry = await ethers.getContractFactory("MockProxyRegistry");
    });

    beforeEach(async function () {
        [deployer, owner, signer1, signer2, signer3] = await ethers.getSigners();

        proxyRegistry = await this.ProxyRegistry.deploy();
        await proxyRegistry.deployed();

        super721 = await this.Super721.deploy(
            owner.address,
            "Super721",
            "SIMX721",
            originalUri,
            originalUri721,
            proxyRegistry.address,
        );
        await super721.deployed();
        
        setUriRight = await super721.SET_URI();
        lockUriRight = await super721.LOCK_URI();
        lockItemUriRight = await super721.LOCK_ITEM_URI();
        mintRight = await super721.MINT();
        setProxyRegistryRight = await super721.SET_PROXY_REGISTRY();
        setMetadataRight = await super721.SET_METADATA();
        lockCreationRight = await super721.LOCK_CREATION();
        setConfigureGroupRight = await super721.CONFIGURE_GROUP();
        UNIVERSAL = await super721.UNIVERSAL();
    });

    // Test cases

    //////////////////////////////
    //       Constructor
    //////////////////////////////
    describe("Constructor", function () {
        it('initialized values as expected', async function () {
            expect(await super721.owner()).to.equal(owner.address);
            expect(await super721.name()).to.equal('Super721');
            expect(await super721.metadataUri()).to.equal(originalUri);
            expect(await super721.proxyRegistryAddress()).to.equal(proxyRegistry.address);
        });

        it('should initialize a new instance succesfully where deployer is the owner', async function () {
            let super721IMXv2 = await this.Super721.deploy(
                deployer.address,
                "Super721",
                "SIMX721",
                originalUri,
                originalUri721,
                proxyRegistry.address,
            );
            expect(await super721IMXv2.owner()).to.equal(deployer.address);
            expect(await super721IMXv2.name()).to.equal('Super721');
            expect(await super721IMXv2.metadataUri()).to.equal(originalUri);
            expect(await super721IMXv2.proxyRegistryAddress()).to.equal(proxyRegistry.address);
        });
    });

    describe("uri", function () {
        it('returns the metadataUri', async function () {
            expect(await super721.metadataUri()).to.equal(originalUri);
        });
    });

    describe("setURI", function () {
        it('reverts when there is not a valid permit for sender', async function () {
            await expect(
                super721.setURI("://ipfs/newuri/{id}")
            ).to.be.revertedWith('P1');
            expect(await super721.metadataUri()).to.equal(originalUri);
        });

        it('reverts when the collection has been locked', async function () {
            await super721.connect(owner).lockURI();

            await expect(
                super721.connect(owner).setURI("://ipfs/newuri/")
            ).to.be.revertedWith("S721Req3");

            expect(await super721.metadataUri()).to.equal(originalUri);
        });

        it('sets the metadataUri when there is a valid permit', async function () {
            await super721.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setUriRight,
                ethers.constants.MaxUint256
            );
            await super721.setURI("://ipfs/newuri/");
            expect(await super721.metadataUri()).to.equal("://ipfs/newuri/");
            expect(await super721.uriLocked()).to.equal(false);
        });
    });

    describe("lockURI", function () {
        it('reverts when there is not a valid permit for sender', async function () {
            await expect(
                super721.lockURI()
            ).to.be.revertedWith('P1');
            expect(await super721.metadataUri()).to.equal(originalUri);
        });

        it('sets the metadataUri and locks it when there is a valid permit', async function () {
            await super721.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                lockUriRight,
                ethers.constants.MaxUint256
            );
            await super721.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setUriRight,
                ethers.constants.MaxUint256
            );
            await super721.connect(deployer).setURI("://ipfs/lockeduri/{id}");
            await super721.connect(deployer).lockURI();
            expect(await super721.metadataUri()).to.equal("://ipfs/lockeduri/{id}");
            expect(await super721.uriLocked()).to.equal(true);
        });
    });

    describe("lockItemGroupURI", function () {
        it('reverts when there is not a valid permit for sender', async function () {
            expect(await super721.metadataFrozen(1)).to.equal(false);
            await expect(
                super721.lockGroupURI("://ipfs/lockeduri/{id}", 1)
            ).to.be.revertedWith('S721Rev1');
            expect(await super721.metadataFrozen(1)).to.equal(false);
        });

        it('sets the metadataUri and locks it when there is a valid permit', async function () {
            await super721.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                lockItemUriRight,
                ethers.constants.MaxUint256
            );
            expect(await super721.metadataFrozen(1)).to.equal(false);
            await super721.lockGroupURI("://ipfs/lockeduri/", 1);
            expect(await super721.metadataFrozen(1)).to.equal(true);
            expect(await super721.metadataUri()).to.equal("://ipfs/uri/");
            expect(await super721.uriLocked()).to.equal(false);
        });
    });

    describe("setProxyRegistry", function () {
        it('Reverts: no setProxyRegistry permissions', async () => {
            await expect(
                super721.setProxyRegistry(signer1.address)
            ).to.be.revertedWith("P1");
        });

        it('allows setProxyRegistry when permissions', async () => {
            let currentBlockNumber = await ethers.provider.getBlockNumber();
            let block = await ethers.provider.getBlock(currentBlockNumber);
            let expiration = block.timestamp + 10000;

            await super721.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setProxyRegistryRight,
                expiration
            );
            expect(await super721.proxyRegistryAddress()).to.equal(proxyRegistry.address);
            await super721.setProxyRegistry(signer1.address);
            expect(await super721.proxyRegistryAddress()).to.equal(signer1.address);
        });
    });

    describe("balanceOfGroup", function () {
        it('Reverts: querying balance of address(0)', async () => {
            await expect(
                super721.balanceOfGroup(NULL_ADDRESS, 1)
            ).to.be.revertedWith("S721Req5");
        });

        it('returns the balanceOfGroup other addresses', async () => {
            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(0);

            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });
            await super721.connect(owner).mintBatch(
                signer1.address,
                [shiftedItemGroupId],
                ethers.utils.id('a')
            );

            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721.balanceOfGroup(signer2.address, shiftedItemGroupId)).to.equal(0);
        });
    });

    describe("lock", function () {
        it('Reverts: permit is not valid unless owner is sender', async () => {
            await expect(
                super721.lock()
            ).to.be.revertedWith("P1");

            expect(await super721.locked()).to.equal(false);
            await super721.connect(owner).lock();
            expect(await super721.locked()).to.equal(true);
        });

        it('sets locked to true when the permit is valid', async () => {
            let currentBlockNumber = await ethers.provider.getBlockNumber();
            let block = await ethers.provider.getBlock(currentBlockNumber);
            let expiration = block.timestamp + 10000;

            await super721.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                lockCreationRight,
                expiration
            );

            expect(await super721.locked()).to.equal(false);
            await super721.lock();
            expect(await super721.locked()).to.equal(true);
        });
    });

    describe("isApprovedForAll", function () {
        it('Reverts: setting approval status for self', async () => {
            await expect(
                super721.setApprovalForAll(deployer.address, true)
            ).to.be.revertedWith("S721Req8");
        });

        it('uses operatorApprovals except when the operator is registered in the proxyRegistry', async () => {
            expect(await super721.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
            await super721.setApprovalForAll(signer1.address, true);
            expect(await super721.isApprovedForAll(deployer.address, signer1.address)).to.equal(true);
            await super721.setApprovalForAll(signer1.address, false);
            expect(await super721.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
        });

        it('returns true when proxyRegistry.proxies(_owner) == operator', async () => {
            expect(await super721.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
            expect(await proxyRegistry.proxies(deployer.address)).to.equal(NULL_ADDRESS);
            await proxyRegistry.connect(deployer).setProxy(deployer.address, signer1.address);
            expect(await proxyRegistry.proxies(deployer.address)).to.equal(signer1.address);
            expect(await super721.isApprovedForAll(deployer.address, signer1.address)).to.equal(true);
            await proxyRegistry.connect(deployer).setProxy(deployer.address, NULL_ADDRESS);
            expect(await proxyRegistry.proxies(deployer.address)).to.equal(NULL_ADDRESS);
            expect(await super721.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
        });
    });

    describe("safeBatchTransferFrom", function () {
        it('Reverts: when ERC721Receiver does not return onERC721Received.selector', async () => {
            let itemGroupIdTransferException = ethers.BigNumber.from(999);
            let shiftedItemGroupIdTransferException = itemGroupIdTransferException.shl(128);

            await super721.connect(owner).configureGroup(itemGroupIdTransferException, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });

            await super721.connect(owner).mintBatch(
                signer1.address,
                [shiftedItemGroupIdTransferException],
                ethers.utils.id('a')
            );

            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupIdTransferException)).to.equal(1);

            // Transfer to Non-ERC721 receiver implementor
            await expect(
                super721.connect(signer1).safeBatchTransferFrom(
                    signer1.address,
                    proxyRegistry.address,
                    [shiftedItemGroupIdTransferException],
                    ethers.utils.id(''))
            ).to.be.revertedWith("S721Rev3");

            let MockERC721Receiver1 = await ethers.getContractFactory("MockERC721Receiver1");
            let mockERC721Receiver1 = await MockERC721Receiver1.deploy();
            await mockERC721Receiver1.deployed();

            await expect(
                super721.connect(signer1).safeBatchTransferFrom(
                    signer1.address,
                    mockERC721Receiver1.address,
                    [shiftedItemGroupIdTransferException],
                    ethers.utils.id(''))
            ).to.be.revertedWith("S721Rev2");

            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupIdTransferException)).to.equal(1);

            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT2',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });

            await super721.connect(owner).mintBatch(
                signer1.address,
                [shiftedItemGroupId],
                ethers.utils.id('a')
            );
            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721.balanceOfGroup(mockERC721Receiver1.address, shiftedItemGroupId)).to.equal(0);
            await super721.connect(signer1).safeBatchTransferFrom(
                signer1.address,
                mockERC721Receiver1.address,
                [shiftedItemGroupId],
                ethers.utils.id('b')
            );

            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(0);
            expect(await super721.balanceOfGroup(mockERC721Receiver1.address, shiftedItemGroupId)).to.equal(1);
        });
        it('Reverts: when insufficient balance for transfer', async () => {
            let MockERC721Receiver1 = await ethers.getContractFactory("MockERC721Receiver1");
            let mockERC721Receiver1 = await MockERC721Receiver1.deploy();
            await mockERC721Receiver1.deployed();

            // trigger fail with arbitrary fail value ([2])
            await expect(
                super721.connect(signer1).safeBatchTransferFrom(
                    signer1.address,
                    mockERC721Receiver1.address,
                    [2],
                    ethers.utils.id('b'))
            ).to.be.revertedWith("S721Req14");
        });
        it('Reverts: transfer to the 0 address', async () => {
            await expect(
                super721.safeBatchTransferFrom(signer1.address, NULL_ADDRESS, [1], ethers.utils.id('a'))
            ).to.be.revertedWith("S721Req12");
        });
        it('Reverts: caller is not owner nor approved', async () => {
            // not owner or approved
            await expect(
                super721.connect(signer3).safeBatchTransferFrom(signer1.address, super721.address, [1], ethers.utils.id('a'))
            ).to.be.revertedWith("S721Req13");
        });
        it('transfers in batches, safely', async () => {
            let MockERC721Receiver1 = await ethers.getContractFactory("MockERC721Receiver1");
            let mockERC721Receiver1 = await MockERC721Receiver1.deploy();
            await mockERC721Receiver1.deployed();

            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT1',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });

            // configure group2 and mint both
            await super721.connect(owner).configureGroup(itemGroupId2, {
                name: 'NFT2',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1, // what if 0/none? Update: 0 is unburnable
                burnData: 100
            });

            await expect(
                super721.connect(owner).burnBatch(signer1.address, [shiftedItemGroupId2])
            ).to.be.revertedWith("S721Req29");

            // MINT
            await super721.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId, shiftedItemGroupId2], ethers.utils.id('a'));

            expect(await super721.balanceOfGroup(deployer.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721.groupBalances(itemGroupId, deployer.address)).to.equal(1);
            expect(await super721.balanceOfGroup(deployer.address, shiftedItemGroupId2)).to.equal(1);
            expect(await super721.groupBalances(itemGroupId2, deployer.address)).to.equal(1);
            expect(await super721.totalBalances(deployer.address)).to.equal(2);

            // caller is owner
            await super721.safeBatchTransferFrom(
                deployer.address,
                signer2.address,
                [shiftedItemGroupId, shiftedItemGroupId2],
                ethers.utils.id('a')
            );

            expect(await super721.balanceOfGroup(deployer.address, itemGroupId)).to.equal(0);
            expect(await super721.groupBalances(shiftedItemGroupId, deployer.address)).to.equal(0);
            expect(await super721.balanceOfGroup(deployer.address, shiftedItemGroupId2)).to.equal(0);
            expect(await super721.groupBalances(itemGroupId2, deployer.address)).to.equal(0);
            expect(await super721.totalBalances(deployer.address)).to.equal(0);

            expect(await super721.balanceOfGroup(signer2.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721.groupBalances(itemGroupId, signer2.address)).to.equal(1);
            expect(await super721.balanceOfGroup(signer2.address, shiftedItemGroupId2)).to.equal(1);
            expect(await super721.groupBalances(itemGroupId2, signer2.address)).to.equal(1);
            expect(await super721.totalBalances(signer2.address)).to.equal(2);

            // configure group3
            let itemGroupId3 = itemGroupId.mul(3);
            await super721.connect(owner).configureGroup(itemGroupId3, {
                name: 'NFT3',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });
            let shiftedItemGroupId3 = shiftedItemGroupId.mul(3);
            await super721.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId3], ethers.utils.id('a'));

            // caller is approved
            await super721.setApprovalForAll(signer1.address, true);
            await super721.connect(signer1).safeBatchTransferFrom(
                deployer.address,
                signer3.address,
                [shiftedItemGroupId3],
                ethers.utils.id('a')
            );
            expect(await super721.balanceOfGroup(deployer.address, shiftedItemGroupId3)).to.equal(0);
            expect(await super721.groupBalances(itemGroupId3, deployer.address)).to.equal(0);
            expect(await super721.totalBalances(deployer.address)).to.equal(0);
            expect(await super721.balanceOfGroup(signer3.address, shiftedItemGroupId3)).to.equal(1);
            expect(await super721.groupBalances(itemGroupId3, signer3.address)).to.equal(1);
            expect(await super721.totalBalances(signer3.address)).to.equal(1);

            // to address is a contract
            await super721.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId3.add(1)], ethers.utils.id('a'));
            await super721.safeBatchTransferFrom(
                deployer.address,
                mockERC721Receiver1.address,
                [shiftedItemGroupId3.add(1)],
                ethers.utils.id('a')
            );
            expect(await super721.balanceOfGroup(deployer.address, shiftedItemGroupId3.add(1))).to.equal(0);
            expect(await super721.groupBalances(itemGroupId3, deployer.address)).to.equal(0);
            expect(await super721.totalBalances(deployer.address)).to.equal(0);
            expect(await super721.balanceOfGroup(mockERC721Receiver1.address, shiftedItemGroupId3.add(1))).to.equal(1);
            expect(await super721.groupBalances(itemGroupId3, mockERC721Receiver1.address)).to.equal(1);
            expect(await super721.totalBalances(mockERC721Receiver1.address)).to.equal(1);
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

            await super721.connect(owner).configureGroup(itemGroupIdTransferException, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });

            await super721.connect(owner).mintBatch(
                signer1.address,
                [shiftedItemGroupIdTransferException],
                ethers.utils.id('a')
            );

            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupIdTransferException)).to.equal(1);

            // Using the Overloaded variant which is without the bytes32 as parameter
            await expect(
                super721.connect(signer1)["safeTransferFrom(address,address,uint256)"](
                    signer1.address,
                    mockERC721Receiver1.address,
                    shiftedItemGroupIdTransferException)
            ).to.be.revertedWith("S721Rev2");

            // Using the Overloaded variant which is without the bytes32 as parameter
            await expect(
                super721.connect(signer1)["safeTransferFrom(address,address,uint256)"](
                    signer1.address,
                    proxyRegistry.address,
                    shiftedItemGroupIdTransferException)
            ).to.be.revertedWith("S721Rev3");

            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupIdTransferException)).to.equal(1);
        });
        it('Reverts: transfer to the 0 address', async () => {
            await expect(
                super721["safeTransferFrom(address,address,uint256)"](signer1.address, NULL_ADDRESS, 1)
            ).to.be.revertedWith("S721Req9");
        });
        it('Reverts: call is not owner nor approved', async () => {
            // not owner
            await expect(
                super721["safeTransferFrom(address,address,uint256)"](signer1.address, super721.address, 1)
            ).to.be.revertedWith("S721Req10");

            // not approved
            await expect(
                super721.connect(signer3)["safeTransferFrom(address,address,uint256)"](signer1.address, super721.address, 1)
            ).to.be.revertedWith("S721Req10");
        });
        it('should safeTransferFrom', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });

            // configure group2 and mint both
            await super721.connect(owner).configureGroup(itemGroupId2, {
                name: 'NFT2',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });

            await expect(
                super721.connect(owner).burnBatch(signer1.address, [shiftedItemGroupId2])
            ).to.be.revertedWith("S721Req29");

            // MINT
            await super721.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId, shiftedItemGroupId2], ethers.utils.id('a'));

            expect(await super721.balanceOfGroup(deployer.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721.groupBalances(itemGroupId, deployer.address)).to.equal(1);
            expect(await super721.totalBalances(deployer.address)).to.equal(2);
            expect(await super721.balanceOfGroup(deployer.address, shiftedItemGroupId2)).to.equal(1);
            expect(await super721.groupBalances(itemGroupId2, deployer.address)).to.equal(1);
            expect(await super721.totalBalances(deployer.address)).to.equal(2);

            // caller is owner
            await super721["safeTransferFrom(address,address,uint256,bytes)"](
                deployer.address,
                signer2.address,
                shiftedItemGroupId,
                ethers.utils.id('a')
            );

            expect(await super721.balanceOfGroup(deployer.address, shiftedItemGroupId)).to.equal(0);
            expect(await super721.groupBalances(itemGroupId, deployer.address)).to.equal(0);
            expect(await super721.totalBalances(deployer.address)).to.equal(1);

            expect(await super721.balanceOfGroup(signer2.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721.groupBalances(itemGroupId, signer2.address)).to.equal(1);
            expect(await super721.totalBalances(signer2.address)).to.equal(1);

            // caller is approved
            await super721.setApprovalForAll(signer1.address, true);
            await super721.connect(signer1)["safeTransferFrom(address,address,uint256,bytes)"](
                deployer.address,
                signer3.address,
                shiftedItemGroupId2,
                ethers.utils.id('a')
            );
            expect(await super721.balanceOfGroup(deployer.address, shiftedItemGroupId2)).to.equal(0);
            expect(await super721.groupBalances(itemGroupId2, deployer.address)).to.equal(0);
            expect(await super721.totalBalances(deployer.address)).to.equal(0);
            expect(await super721.balanceOfGroup(signer3.address, shiftedItemGroupId2)).to.equal(1);
            expect(await super721.groupBalances(itemGroupId2, signer3.address)).to.equal(1);
            expect(await super721.totalBalances(signer3.address)).to.equal(1);

            // to address is a contract
            let itemGroupId3 = itemGroupId.mul(3);
            let shiftedItemGroupId3 = shiftedItemGroupId.mul(3);

            // a contract
            let DummyContract = await ethers.getContractFactory("MockERC721Receiver1");
            let dummyContract = await DummyContract.deploy();
            await dummyContract.deployed();

            // configure group3
            await super721.connect(owner).configureGroup(itemGroupId3, {
                name: 'NFT3',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });
            await super721.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId3], ethers.utils.id('a'));
            await super721["safeTransferFrom(address,address,uint256,bytes)"](
                deployer.address,
                dummyContract.address,
                shiftedItemGroupId3,
                ethers.utils.id('a')
            );
            expect(await super721.balanceOfGroup(deployer.address, shiftedItemGroupId3)).to.equal(0);
            expect(await super721.groupBalances(itemGroupId3, deployer.address)).to.equal(0);
            expect(await super721.totalBalances(deployer.address)).to.equal(0);
            expect(await super721.balanceOfGroup(dummyContract.address, shiftedItemGroupId3)).to.equal(1);
            expect(await super721.groupBalances(itemGroupId3, dummyContract.address)).to.equal(1);
            expect(await super721.totalBalances(dummyContract.address)).to.equal(1);
        });

        it('should transferFrom', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });

            await super721.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId], ethers.utils.id('a'));

            expect(await super721.balanceOfGroup(deployer.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721.groupBalances(itemGroupId, deployer.address)).to.equal(1);
            expect(await super721.totalBalances(deployer.address)).to.equal(1);

            await expect(
                super721.connect(signer1).transferFrom(
                    deployer.address,
                    signer2.address,
                    shiftedItemGroupId,
            )).to.be.revertedWith("S721Req33");

            await expect(
                super721.transferFrom(
                    deployer.address,
                    signer2.address,
                    shiftedItemGroupId2,
            )).to.be.revertedWith("S721Req32");

            await super721.transferFrom(
                deployer.address,
                signer2.address,
                shiftedItemGroupId,
            );

            expect(await super721.balanceOfGroup(deployer.address, shiftedItemGroupId)).to.equal(0);
            expect(await super721.groupBalances(itemGroupId, deployer.address)).to.equal(0);
            expect(await super721.totalBalances(deployer.address)).to.equal(0);

            expect(await super721.balanceOfGroup(signer2.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721.groupBalances(itemGroupId, signer2.address)).to.equal(1);
            expect(await super721.totalBalances(signer2.address)).to.equal(1);
        });
    });

    describe("burnBatch", function () {
        it('Reverts: no right', async () => {
            await expect(
                super721.burnBatch(signer1.address, [1])
            ).to.be.revertedWith("S721Req28");
        });
        it('Reverts: non-existent group', async () => {
            await expect(
                super721.connect(owner).burnBatch(signer1.address, [1])
            ).to.be.revertedWith("S721Req25");
        });
        it('Reverts: burn limit exceeded', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 0
            });

            await expect(
                super721.connect(owner).burnBatch(signer1.address, [shiftedItemGroupId])
            ).to.be.revertedWith("S721Req26");
        });
        it('Reverts: burn zero address', async () => {
            await expect(
                super721.connect(owner).burnBatch(NULL_ADDRESS, [shiftedItemGroupId])
            ).to.be.revertedWith("S721Req27");
        });
        it('Reverts: item is not burnable', async () => {
            await super721.connect(owner).configureGroup(itemGroupId2, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 20000,
                burnType: 0, //non burnable item group
                burnData: 0
            });

            await super721.connect(owner).mintBatch(
                signer1.address, [shiftedItemGroupId2], ethers.utils.id('a')
            );

            // Try burning a non burnable token
            await expect(
                super721.connect(owner).burnBatch(signer1.address, [shiftedItemGroupId2])
            ).to.be.revertedWith("S721Rev4");
        });
        it('burns in batches replenishable items', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 1,
                burnType: 2, //replenishable item group
                burnData: 1
            });

            await super721.connect(owner).mintBatch(
                signer1.address, [shiftedItemGroupId], ethers.utils.id('a')
            );

            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721.groupBalances(itemGroupId, signer1.address)).to.equal(1);
            expect(await super721.totalBalances(signer1.address)).to.equal(1);
            expect(await super721.circulatingSupply(shiftedItemGroupId)).to.equal(1);
            expect(await super721.burnCount(shiftedItemGroupId)).to.equal(0);

            // Try burning a replenishable token
            await super721.connect(owner).burnBatch(signer1.address, [shiftedItemGroupId]);

            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(0);
            expect(await super721.groupBalances(itemGroupId, signer1.address)).to.equal(0);
            expect(await super721.totalBalances(signer1.address)).to.equal(0);
            expect(await super721.circulatingSupply(shiftedItemGroupId)).to.equal(0);
            expect(await super721.burnCount(shiftedItemGroupId)).to.equal(1);

            await super721.connect(owner).mintBatch(
                signer1.address, [shiftedItemGroupId], ethers.utils.id('a')
            );

            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721.groupBalances(itemGroupId, signer1.address)).to.equal(1);
            expect(await super721.totalBalances(signer1.address)).to.equal(1);
            expect(await super721.circulatingSupply(shiftedItemGroupId)).to.equal(1);
            expect(await super721.burnCount(shiftedItemGroupId)).to.equal(1);
        });
        it('burns in batches', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });

            // configure group2
            await super721.connect(owner).configureGroup(itemGroupId2, {
                name: 'NFT2',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 100
            });

            await expect(
                super721.connect(owner).burnBatch(signer1.address, [shiftedItemGroupId, shiftedItemGroupId2])
            ).to.be.revertedWith("S721Req29");

            // MINT
            await super721.connect(owner).mintBatch(
                signer1.address, [shiftedItemGroupId, shiftedItemGroupId2], ethers.utils.id('a')
            );

            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721.groupBalances(itemGroupId, signer1.address)).to.equal(1);
            expect(await super721.totalBalances(signer1.address)).to.equal(2);
            expect(await super721.circulatingSupply(shiftedItemGroupId)).to.equal(1);
            expect(await super721.burnCount(shiftedItemGroupId)).to.equal(0);
            let genericTokensGroup = await super721.itemGroups(itemGroupId);
            expect(genericTokensGroup[6]).to.equal(1); // circulatingSupply;
            expect(genericTokensGroup[8]).to.equal(0); // burnCount;

            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId2)).to.equal(1);
            expect(await super721.groupBalances(itemGroupId2, signer1.address)).to.equal(1);
            expect(await super721.totalBalances(signer1.address)).to.equal(2);
            expect(await super721.circulatingSupply(shiftedItemGroupId2)).to.equal(1);
            expect(await super721.burnCount(shiftedItemGroupId2)).to.equal(0);
            let NFTTokenGroup = await super721.itemGroups(itemGroupId2);
            expect(NFTTokenGroup[6]).to.equal(1); // circulatingSupply;
            expect(NFTTokenGroup[8]).to.equal(0); // burnCount;

            // BURN
            await super721.connect(owner).burnBatch(
                signer1.address,
                [shiftedItemGroupId, shiftedItemGroupId2],
            );

            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(0);
            expect(await super721.groupBalances(itemGroupId, signer1.address)).to.equal(0);
            expect(await super721.totalBalances(signer1.address)).to.equal(0);
            genericTokensGroup = await super721.itemGroups(itemGroupId);
            expect(genericTokensGroup[6]).to.equal(0); // circulatingSupply;
            expect(genericTokensGroup[8]).to.equal(1); // burnCount;
            expect(await super721.circulatingSupply(shiftedItemGroupId)).to.equal(0);
            expect(await super721.burnCount(shiftedItemGroupId)).to.equal(1);

            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId2)).to.equal(0);
            expect(await super721.groupBalances(itemGroupId2, signer1.address)).to.equal(0);
            expect(await super721.totalBalances(signer1.address)).to.equal(0);
            expect(await super721.circulatingSupply(shiftedItemGroupId2)).to.equal(0);
            expect(await super721.burnCount(shiftedItemGroupId2)).to.equal(1);
            NFTTokenGroup = await super721.itemGroups(itemGroupId2);
            expect(NFTTokenGroup[6]).to.equal(0); // circulatingSupply;
            expect(NFTTokenGroup[8]).to.equal(1); // burnCount;*/
        });
    });

    describe("configureGroup", function () {
        it('Reverts: groupId is 0', async () => {
            await expect(
                super721.connect(owner).configureGroup(ethers.BigNumber.from(0), {
                    name: 'FrenBurgers',
                    supplyType: 0,
                    supplyData: 20000,
                    burnType: 1,
                    burnData: 20000
                })
            ).to.be.revertedWith("S721Req15");
        });

        it('Reverts: sender does not have the right', async () => {
            await expect(
                super721.configureGroup(itemGroupId, {
                    name: 'FrenBurgers',
                    supplyType: 0,
                    supplyData: 20000,
                    burnType: 1,
                    burnData: 20000
                })
            ).to.be.revertedWith("S721Rev1");
        });

        it('Reverts: collection is locked', async () => {
            await super721.connect(owner).lock();

            await expect(
                super721.connect(owner).configureGroup(itemGroupId, {
                    name: 'FrenBurgers',
                    supplyType: 0,
                    supplyData: 20000,
                    burnType: 1,
                    burnData: 20000
                })
            ).to.be.revertedWith("S721Req16");
        });

        it('Reverts: cannot change a capped to uncap', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'FrenBurgers',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            })

            await expect(
                super721.connect(owner).configureGroup(itemGroupId, {
                    name: 'FrenBurgers',
                    supplyType: 1,
                    supplyData: 20000,
                    burnType: 1,
                    burnData: 20000
                })
            ).to.be.revertedWith("S721Req17");
        });

        it('Reverts: cannot increase supply of a capped group', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'FrenBurgers',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            })

            await expect(
                super721.connect(owner).configureGroup(itemGroupId, {
                    name: 'FrenBurgers',
                    supplyType: 0,
                    supplyData: 30000,
                    burnType: 1,
                    burnData: 20000
                })
            ).to.be.revertedWith("S721Req18");
        });

        it('Reverts: cannot decrease supply below circulating supply', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'FrenBurgers',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            })

            await super721.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId], ethers.utils.id('a'));

            await expect(
                super721.connect(owner).configureGroup(itemGroupId, {
                    name: 'FrenBurgers',
                    supplyType: 0,
                    supplyData: 0,
                    burnType: 1,
                    burnData: 20000
                })
            ).to.be.revertedWith("S721Req19");
        });

        it('allows configuring a group when there is permission for GROUP circumstance', async () => {
            let groupCirumstance = "0x0000000000000000000000000000000000000000000000000000000000000001"
            await super721.connect(owner).setPermit(
                signer1.address,
                groupCirumstance,
                setConfigureGroupRight,
                ethers.constants.MaxUint256
            );

            await super721.connect(signer1).configureGroup(itemGroupId, {
                name: 'FrenBurgers',
                supplyType: 0,
                supplyData: 0,
                burnType: 1,
                burnData: 20000
            })

            await expect(
                await (await super721.connect(owner).itemGroups(groupCirumstance)).name
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

            await super721.connect(owner).configureGroup(itemGroupId, {
                    name: 'FrenBurgers',
                    supplyType: 1,
                    supplyData: 20000,
                    burnType: 0,
                    burnData: 10000
            });

            let frenBurgersGroup = await super721.itemGroups(itemGroupId);
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
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'BestFrenBurgers',
                supplyType: 0,
                supplyData: 20000,
                burnType: 0, // TODO: do we want, Update: 0 is non burnable
                burnData: 10000 // If it is zero, the burnData is useless
            });

            frenBurgersGroup = await super721.itemGroups(itemGroupId);
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
            await super721.connect(owner).setPermit(
                signer1.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );
            await super721.connect(signer1).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'));
            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(1);

            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'BestFrenBurgers',
                supplyType: 0,
                supplyData: 1,
                burnType: 0,
                burnData: 10000
            });

            frenBurgersGroup = await super721.itemGroups(itemGroupId);
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
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });

            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'));
            expect(await super721.tokenByIndex(0)).to.equal(shiftedItemGroupId);
            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId.add(1)], ethers.utils.id('a'));
            expect(await super721.tokenByIndex(1)).to.equal(shiftedItemGroupId.add(1));

            await expect(
                super721.tokenByIndex(2)
            ).to.be.reverted;
            //).to.be.revertedWith("EnumerableMap: index out of bounds");
            // Solidiy 0.8.0 includes Panic codes for these situations instead of invalid opcode error
        });
    });

    describe("totalSupply", function () {
        it('returns the totalSupply of tokens', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });

            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'));
            expect(await super721.totalSupply()).to.equal(1);
            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId.add(1)], ethers.utils.id('a'));

            expect(await super721.totalSupply()).to.equal(2);

            await super721.connect(owner).configureGroup(itemGroupId2, {
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
            await super721.connect(owner).mintBatch(
                signer1.address,
                [shiftedItemGroupId2.add(1), shiftedItemGroupId2.add(2), shiftedItemGroupId2.add(3)],
                ethers.utils.id('a')
            );
            // 2 supply in gorup1 and 3 supply in grooup2 equals totalsupply = 5
            expect(await super721.totalSupply()).to.equal(5);
            expect(await super721.balanceOf(signer1.address)).to.equal(5);
        });
    });

    describe("balanceOf", function () {
        it('Reverts: query for Zero address', async () => {
            await expect(super721.balanceOf(NULL_ADDRESS)
            ).to.be.revertedWith("S721Req6");
        });

        it('returns the balanceOf of tokens for an address', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });

            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'));
            expect(await super721.balanceOf(signer1.address)).to.equal(1);
            expect(await super721.balanceOf(signer2.address)).to.equal(0);
            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId.add(1)], ethers.utils.id('a'));
            expect(await super721.balanceOf(signer1.address)).to.equal(2);
            expect(await super721.balanceOf(signer2.address)).to.equal(0)


            await super721.connect(owner).configureGroup(itemGroupId2, {
                name: 'GenericToken2',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });

            await super721.connect(owner).mintBatch(
                signer2.address,
                [shiftedItemGroupId2.add(1), shiftedItemGroupId2.add(2), shiftedItemGroupId2.add(3)],
                ethers.utils.id('a')
            );
            expect(await super721.totalSupply()).to.equal(5);

            expect(await super721.balanceOf(signer1.address)).to.equal(2);
            expect(await super721.balanceOf(signer2.address)).to.equal(3);
        });
    });

    describe("balanceOfBatch", function () {
        it('Reverts: accounts and ids mismatch', async () => {
            await expect(super721.balanceOfBatch([signer2.address], [shiftedItemGroupId2, shiftedItemGroupId2.add(1)])
            ).to.be.revertedWith("S721Req7");
        });
        it('returns the balanceOf of tokens for arrays addresses and indexes', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });

            expect((await super721.balanceOfBatch([signer1.address], [shiftedItemGroupId]))[0]).to.equal(0);
            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'));
            expect((await super721.balanceOfBatch([signer1.address], [shiftedItemGroupId]))[0]).to.equal(1);
            expect((await super721.balanceOfBatch([signer2.address], [shiftedItemGroupId]))[0]).to.equal(0);
            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId.add(1)], ethers.utils.id('a'));
            expect((await super721.balanceOfBatch([signer1.address], [shiftedItemGroupId]))[0]).to.equal(1);
            expect((await super721.balanceOfBatch([signer1.address], [shiftedItemGroupId.add(1)]))[0]).to.equal(1);
            expect((await super721.balanceOfBatch([signer2.address], [shiftedItemGroupId]))[0]).to.equal(0);


            await super721.connect(owner).configureGroup(itemGroupId2, {
                name: 'GenericToken2',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });

            await super721.connect(owner).mintBatch(
                signer2.address,
                [shiftedItemGroupId2.add(1), shiftedItemGroupId2.add(2), shiftedItemGroupId2.add(3)],
                ethers.utils.id('a')
            );

            expect((await super721.balanceOfBatch([signer2.address], [shiftedItemGroupId2.add(1)]))[0]).to.equal(1);
            expect((await super721.balanceOfBatch([signer2.address], [shiftedItemGroupId2.add(2)]))[0]).to.equal(1);
            expect((await super721.balanceOfBatch([signer2.address], [shiftedItemGroupId2.add(3)]))[0]).to.equal(1);
            expect((await super721.balanceOfBatch([signer2.address], [shiftedItemGroupId]))[0]).to.equal(0);
        });
    });

    describe("approve", function () {
        let tokenId;

        beforeEach(async function () {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });

            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'));
            tokenId = super721.tokenOfOwnerByIndex(signer1.address, 0);
        });

        it('Reverts: sender is not current owner', async () => {
            await expect(
                super721.approve(signer2.address, tokenId)
            ).to.be.revertedWith("S721Req2");
        });

        it('Reverts: approving current owner', async () => {
            await expect(
                super721.connect(signer1).approve(signer1.address, tokenId)
            ).to.be.revertedWith("S721Req1");
        });

        it('approves when owner approves another address', async () => {
            await expect(
                super721.getApproved(4)
            ).to.be.revertedWith("S721Req31");
            expect(await super721.getApproved(tokenId)).to.equal(NULL_ADDRESS);
            await super721.connect(signer1).approve(signer2.address, tokenId);
            expect(await super721.getApproved(tokenId)).to.equal(signer2.address);
        });
    });

    describe("version", function () {
        it('returns 1', async () => {
            expect(await super721.version()).to.equal(1);
        });
    });

    describe("ownerOf", function () {
        it('returns the ownerOf a given token based on tokenId', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });

            await super721.connect(owner).setPermit(
                signer1.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );

            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'));
            let tokenId = super721.tokenOfOwnerByIndex(signer1.address, 0);
            expect(await super721.ownerOf(tokenId)).to.equal(signer1.address);

            // configuring another ItemGroup and minting more
            await super721.connect(owner).configureGroup(itemGroupId2, {
                name: 'NONFUNGIBLEFUNGUS',
                supplyType: 0,
                supplyData: 20000,
                burnType: 0,
                burnData: 20000
            });

            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId2], ethers.utils.id('a'));
            let tokenId2 = super721.tokenOfOwnerByIndex(signer1.address, 1);
            expect(await super721.ownerOf(tokenId2)).to.equal(signer1.address);

            await super721.connect(signer1)["safeTransferFrom(address,address,uint256)"](
                signer1.address,
                signer2.address,
                tokenId2
            );

            await expect(await super721.ownerOf(tokenId2)
            ).to.be.equal(signer2.address);
        });
    });

    describe("mintBatch", function () {
        it('Reverts: mintBatch to address(0)', async () => {
            await expect(
                super721.mintBatch(NULL_ADDRESS, [shiftedItemGroupId], ethers.utils.id('a'))
            ).to.be.revertedWith("S721Req23");
        });

        it('Reverts: token already exists"', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });

            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'));

            await expect(
                super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'))
            ).to.be.revertedWith("S721Req21");
        });

        it('Reverts: mint to non existent group"', async () => {
            await expect(
                super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'))
            ).to.be.revertedWith("S721Req20");
        });

        it('Reverts: cannot mint beyond cap', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 1,
                burnType: 0,
                burnData: 0
            });

            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'))
            await expect(
                super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId.add(1)], ethers.utils.id('a'))
                ).to.be.revertedWith("S721Req22");
        });
        it('should mint if there is a persmission for the group of the item', async () => {
            let groupCirumstance = "0x0000000000000000000000000000000000000000000000000000000000000001"
            await super721.connect(owner).setPermit(
                signer1.address,
                groupCirumstance,
                mintRight,
                ethers.constants.MaxUint256
            );

            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'FrenBurgers',
                supplyType: 0,
                supplyData: 1,
                burnType: 1,
                burnData: 20000
            })

            await super721.connect(signer1).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'));

        });
        it('should mint if there is a persmission for the specific ITEM circumstance', async () => {
            let itemCirumstance = "0x0000000000000000000000000000000100000000000000000000000000000001"
            await super721.connect(owner).setPermit(
                signer1.address,
                itemCirumstance,
                mintRight,
                ethers.constants.MaxUint256
            );

            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'FrenBurgers',
                supplyType: 0,
                supplyData: 1,
                burnType: 1,
                burnData: 20000
            })

            await super721.connect(signer1).mintBatch(signer1.address, [shiftedItemGroupId.add(1)], ethers.utils.id('a'));

        });
        it('allows mintBatch when rights and proper config', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });

            await expect(
                super721.connect(signer1).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'))
            ).to.be.revertedWith("S721Req24");

            await super721.connect(owner).setPermit(
                signer1.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );

            let originalBalance = await super721.balanceOfGroup(signer1.address, shiftedItemGroupId);
            let originalGroupBalance = await super721.groupBalances(itemGroupId, signer1.address);
            let originalTotalBalance = await super721.totalBalances(signer1.address);
            let originalCirculatingSupply = (await super721.itemGroups(itemGroupId))[6];
            let originalMintCount = (await super721.itemGroups(itemGroupId))[7];
            expect(originalBalance).to.equal(0);
            expect(originalGroupBalance).to.equal(0);
            expect(originalTotalBalance).to.equal(0);
            expect(originalCirculatingSupply).to.equal(0);
            await super721.connect(signer1).mintBatch(signer1.address, [shiftedItemGroupId], ethers.utils.id('a'));
            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(originalBalance.add(1));
            expect((await super721.itemGroups(itemGroupId))[6]).to.equal(originalCirculatingSupply.add(1));
            expect((await super721.itemGroups(itemGroupId))[7]).to.equal(originalMintCount.add(1));

            expect(
                await super721.groupBalances(itemGroupId, signer1.address)
            ).to.equal(originalGroupBalance.add(1));

            expect(
                await super721.totalBalances(signer1.address)
            ).to.equal(originalTotalBalance.add(1));

            // configuring another ItemGroup and minting more
            await super721.connect(owner).configureGroup(itemGroupId2, {
                name: 'NONFungibleFungus',
                supplyType: 1,
                supplyData: 20000,
                itemType: 1,
                itemData: 0,
                burnType: 0,
                burnData: 20000
            });

            await expect(
                super721.connect(signer2).mintBatch(signer1.address, [shiftedItemGroupId2], ethers.utils.id('a'))
            ).to.be.revertedWith("S721Req24");

            await super721.connect(owner).setPermit(
                signer2.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );

            let originalBalance2 = await super721.balanceOfGroup(signer1.address, shiftedItemGroupId2);
            let originalGroupBalance2 = await super721.groupBalances(itemGroupId2, signer1.address);
            let originalTotalBalance2 = await super721.totalBalances(signer1.address);
            let originalCirculatingSupply2 = (await super721.itemGroups(itemGroupId2))[6];
            let originalMintCount2 = (await super721.itemGroups(itemGroupId2))[7];
            expect(originalBalance2).to.equal(0);
            expect(originalGroupBalance2).to.equal(0);
            expect(originalTotalBalance2).to.equal(1);
            expect(originalCirculatingSupply2).to.equal(0);
            await super721.connect(signer2).mintBatch(signer1.address, [shiftedItemGroupId2], ethers.utils.id('a'));
            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId2)).to.equal(originalBalance2.add(1));
            expect((await super721.itemGroups(itemGroupId2))[6]).to.equal(originalCirculatingSupply2.add(1));
            expect((await super721.itemGroups(itemGroupId2))[7]).to.equal(originalMintCount2.add(1));
        });
    });

    describe("setMetadata", function () {
        it('Reverts: no setMetadata permissions', async () => {
            await expect(
                super721.setMetadata(1, 'mettaDatum')
            ).to.be.revertedWith("S721Rev1");
        });

        it('Reverts: global lockURI', async () => {
            await super721.connect(owner).lockURI();

            await expect(
                super721.connect(owner).setMetadata(1, 'mettaDatum')
            ).to.be.revertedWith("S721Req30");
        });

        it('allows setMetadata when there is permission to the GROUP circumstance', async () => {
            let currentBlockNumber = await ethers.provider.getBlockNumber();
            let block = await ethers.provider.getBlock(currentBlockNumber);
            let expiration = block.timestamp + 10000;

            let groupCirumstance = "0x0000000000000000000000000000000000000000000000000000000000000001";
            await super721.connect(owner).setPermit(
                deployer.address,
                groupCirumstance,
                setMetadataRight,
                expiration
            );

            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'FrenBurgers',
                supplyType: 0,
                supplyData: 0,
                burnType: 1,
                burnData: 20000
            })

            expect(await super721.metadata(shiftedItemGroupId.add(1))).to.equal('');
            await super721.setMetadata(shiftedItemGroupId.add(1), 'mettaDatum');
            expect(await super721.metadata(shiftedItemGroupId.add(1))).to.equal('mettaDatum');
        });

        // NOTE: allows setMetadata for groups that aren't configured ¯\_(ツ)_/¯
        it('allows setMetadata when permission', async () => {
            let currentBlockNumber = await ethers.provider.getBlockNumber();
            let block = await ethers.provider.getBlock(currentBlockNumber);
            let expiration = block.timestamp + 10000;

            await super721.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setMetadataRight,
                expiration
            );
            expect(await super721.metadata(1)).to.equal('');
            await super721.setMetadata(1, 'mettaDatum');
            expect(await super721.metadata(1)).to.equal('mettaDatum');
        });
    });

    describe("tokenURI", function () {
        it('should return the tokenURI', async () => {
            await expect(
                await super721.tokenURI(4)
            ).to.be.equal("://ipfs/uri/4");
        });
    });

    describe("Synergy between (BurnTypes) <==> (burnBatch, mintBatch)", function () {
        // *Reminting means, minting to the token index which was burned
        // BurnType(0) = None,          | can be minted | can not be burned | can not be reminted*
        // BurnType(1) = Burnable,      | can be minted | can be burned     | can not be reminted*
        // BurnType(2) = Replenishable, | can be minted | can be burned     | can be reminted*
        it('should test BurnType=None group. can be minted | can not be burned | can not be reminted', async () => {
            // Create group
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 1,
                burnType: 0,
                burnData: 0
            });

            // Mint to the group. Group supplyData is full now
            await super721.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId],
                ethers.utils.id('a')
            );

            // Can not mint more beyond supply cap
            await expect(
            super721.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId.add(1)],
                ethers.utils.id('a')
            )).to.be.revertedWith("S721Req22");

            // Burning must fail
            await expect(
                super721.connect(owner).burnBatch(
                    await signer1.address, [shiftedItemGroupId])
            ).to.be.revertedWith("S721Rev4");
        });

        it('should test BurnType=Burnable group. can be minted | can be burned | can not be reminted', async () => {
            // Create group
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 2,
                burnType: 1,
                burnData: 2
            });

            // Mint to the group
            await super721.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId],
                ethers.utils.id('a')
            );

            // Mint to the group again. Group ciculatingSupply is full now
            await super721.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId.add(1)],
                ethers.utils.id('a')
            );

            // Can not mint more beyond supply cap
            await expect(
                super721.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId.add(2)],
                    ethers.utils.id('a')
            )).to.be.revertedWith("S721Req22");

            // Check circulating supply, mintcount, burncount
            let group = await super721.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("2"); // Circulation
            expect(group.mintCount).to.be.equal("2"); // Mints
            expect(group.burnCount).to.be.equal("0"); // Burns

            // Burn one item
            await super721.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId]);

            // Check circulating supply, mintcount, burncount
            group = await super721.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("1"); // Circulation
            expect(group.mintCount).to.be.equal("2"); // Mints
            expect(group.burnCount).to.be.equal("1"); // Burns

            // Try reminting the same token ID and it must fail
            await expect(
                super721.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId],
                    ethers.utils.id('a'))
                ).to.be.revertedWith("S721Req21");

            // Burn one more item
            await super721.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId.add(1)]);

            // Check circulating supply, mintcount, burncount
            group = await super721.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("0"); // Circulation
            expect(group.mintCount).to.be.equal("2"); // Mints
            expect(group.burnCount).to.be.equal("2"); // Burns

            // Try reminting the same token ID and it must fail
            await expect(
                super721.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId.add(1)],
                    ethers.utils.id('a'))
                ).to.be.revertedWith("S721Req21");

            // Burning must fail since it reached the burnData limit
            await expect(
                super721.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId])
            ).to.be.revertedWith("S721Req26");
        });
        
        it('should test BurnType=Replenishable group. can be minted | can be burned | can be reminted', async () => {
            // Create group
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 2,
                burnType: 2,
                burnData: 2
            });

            // Mint to the group
            await super721.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId],
                ethers.utils.id('a')
            );

            // Mint to the group again. Group ciculatingSupply is full now
            await super721.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId.add(1)],
                ethers.utils.id('a')
            );

            // Can not mint more beyond supply cap
            await expect(
                super721.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId.add(2)],
                    ethers.utils.id('a')
            )).to.be.revertedWith("S721Req22");

            // Check circulating supply, mintcount, burncount
            let group = await super721.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("2"); // Circulation
            expect(group.mintCount).to.be.equal("2"); // Mints
            expect(group.burnCount).to.be.equal("0"); // Burns

            // Burn one item
            await super721.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId]);

            // Check circulating supply, mintcount, burncount
            group = await super721.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("1"); // Circulation
            expect(group.mintCount).to.be.equal("2"); // Mints
            expect(group.burnCount).to.be.equal("1"); // Burns

            // Try reminting the same token ID and it must pass
            await super721.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId],
                    ethers.utils.id('a'));

            // Check circulating supply, mintcount, burncount
            group = await super721.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("2"); // Circulation
            expect(group.mintCount).to.be.equal("3"); // Mints
            expect(group.burnCount).to.be.equal("1"); // Burns

            // Can not mint more beyond supply cap
            await expect(
                super721.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId.add(2)],
                    ethers.utils.id('a')
            )).to.be.revertedWith("S721Req22");

            // Burn one more item
            await super721.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId.add(1)]);

            // Check circulating supply, mintcount, burncount
            group = await super721.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("1"); // Circulation
            expect(group.mintCount).to.be.equal("3"); // Mints
            expect(group.burnCount).to.be.equal("2"); // Burns

            // Try reminting the same token ID and it must pass
            await super721.connect(owner).mintBatch(
                deployer.address,
                [shiftedItemGroupId.add(1)],
                ethers.utils.id('a'));

            // Check circulating supply, mintcount, burncount
            group = await super721.itemGroups(itemGroupId);
            expect(group.circulatingSupply).to.be.equal("2"); // Circulation
            expect(group.mintCount).to.be.equal("4"); // Mints
            expect(group.burnCount).to.be.equal("2"); // Burns

            // Try reminting the same token ID and it must fail
            await expect(
                super721.connect(owner).mintBatch(
                    deployer.address,
                    [shiftedItemGroupId.add(1)],
                    ethers.utils.id('a'))
                ).to.be.revertedWith("S721Req21");
        });
    });
    
});
