const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { ethers } = require('hardhat');
const Web3 = require('web3');

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const DATA = "0x02";

///////////////////////////////////////////////////////////
// SEE https://hardhat.org/tutorial/testing-contracts.html
// FOR HELP WRITING TESTS
// USE https://github.com/gnosis/mock-contract FOR HELP
// WITH MOCK CONTRACT
///////////////////////////////////////////////////////////

// Start test block
describe('===SuperEnjin1155===', function () {
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
        this.Super1155 = await ethers.getContractFactory("SuperEnjin1155");
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
            ).to.be.revertedWith('CollectionUriHasBeenLocked');

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
            ).to.be.revertedWith('SettingApprovalForSelf');
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


});