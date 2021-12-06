const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { mnemonicToSeed } = require('ethers/lib/utils');
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
describe('===Notary===', function () {
    let deployer, owner, signer1;
    
    let proxyRegistry,
        super1155,
        notary;
    const originalUri = "://ipfs/uri/{id}";
    const contractUri = "://ipfs/uri/{id}";
    let itemGroupId = ethers.BigNumber.from(1);
    let shiftedItemGroupId = itemGroupId.shl(128);
    let itemGroupId2 = ethers.BigNumber.from(2);
    let shiftedItemGroupId2 = itemGroupId2.shl(128);

    before(async function () {
        this.ProxyRegistry = await ethers.getContractFactory("ProxyRegistry");
        this.Super1155 = await ethers.getContractFactory("Super1155");
        this.Notary = await ethers.getContractFactory("Notary");
    });

    beforeEach(async function () {
        [deployer, owner, signer1] = await ethers.getSigners();

        // Deploy Proxy Registry
        proxyRegistry = await this.ProxyRegistry.deploy();
        await proxyRegistry.deployed();

        // Deploy Super1155 item collection
        super1155 = await this.Super1155.deploy(
            owner.address,
            "Super1155",
            originalUri,
            contractUri,
            proxyRegistry.address
        );
        await super1155.deployed();

        // Notary will be deployed later after creating some item collection
    });

    // Test cases

    //////////////////////////////
    //       Constructor
    //////////////////////////////
    describe("Constructor", function () {
        it('should initialize values as expected', async function () {
            notary = await this.Notary.deploy(
                super1155.address,
                [0, 1, 2]  // Initialize dummy token ids
            );

            expect(await notary.collection()).to.equal(super1155.address);
            expect(await notary.signatureStatus(1)).to.equal(1);
            expect(await notary.signatureStatus(3)).to.equal(0);
        });
    });

    describe("Sign", function () {
        beforeEach(async function() {
            // Create Itemsgroup ID = 1. Remember about Fungible items Index coercion to index 1
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'FUNGIBLE',
                    supplyType: 1,
                    supplyData: 5,
                    itemType: 1,
                    itemData: 0,
                    burnType: 1,
                    burnData: 2
                });

            // Create Itemsgroup ID = 2
            await super1155.connect(owner).configureGroup(itemGroupId2, {
                name: 'NFT',
                    supplyType: 0,
                    supplyData: 2,
                    itemType: 0,
                    itemData: 0,
                    burnType: 0,
                    burnData: 0
                });

            // Mint items in batch to group 1 & 2
            await super1155.connect(owner).mintBatch(
                signer1.address, 
                [shiftedItemGroupId.add(1), shiftedItemGroupId2, shiftedItemGroupId2.add(1)], 
                ["5", "1", "1"], // FT, NFT, NFT
                DATA);

            // Create Notary of those items with their IDs
            notary = await this.Notary.deploy(
                super1155.address,
                [shiftedItemGroupId.add(1), shiftedItemGroupId2, shiftedItemGroupId2.add(1)]
            );
        });

        it('Reverts: can not sign for no items', async function () {
            await expect(
                notary.connect(signer1).sign([])
            ).to.be.revertedWith("Notary::sign::Must sign for at least one ID");
        });

        it('Reverts: invalid token id', async function () {
            await expect(
                notary.connect(signer1).sign([shiftedItemGroupId.add(2)])
            ).to.be.revertedWith("Notary::sign::Invalid token ID");
        });

        it('Reverts: already signed', async function () {
            await notary.connect(signer1).sign([shiftedItemGroupId.add(1)])
            await expect(
                notary.connect(signer1).sign([shiftedItemGroupId.add(1)])
            ).to.be.revertedWith("Notary::sign::Token ID already signed for");
        });

        it('should sign for the provided asset id', async function () {
            await notary.connect(signer1).sign(
                [shiftedItemGroupId.add(1), shiftedItemGroupId2, shiftedItemGroupId2.add(1)]);

            await expect(
                await notary.connect(signer1).signed(signer1.address, shiftedItemGroupId.add(1))
            ).to.be.equal(true);
            await expect(
                await notary.connect(signer1).signed(signer1.address, shiftedItemGroupId2)
            ).to.be.equal(true);
            await expect(
                await notary.connect(signer1).signed(signer1.address, shiftedItemGroupId2.add(1))
            ).to.be.equal(true);
            await expect(
                await notary.connect(signer1).signed(signer1.address, shiftedItemGroupId2.add(2))
            ).to.be.equal(false);
        });
    });
});
