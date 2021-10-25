const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { mnemonicToSeed, keccak256 } = require('ethers/lib/utils');
const { ethers } = require('hardhat');
const Web3 = require('web3');
const { MerkleTree } = require('merkletreejs')
// const SHA256 = require('crypto-js/sha256')

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const DATA = "0x02";

///////////////////////////////////////////////////////////
// SEE https://hardhat.org/tutorial/testing-contracts.html
// FOR HELP WRITING TESTS
// USE https://github.com/gnosis/mock-contract FOR HELP
// WITH MOCK CONTRACT
///////////////////////////////////////////////////////////

// Start test block
describe('===MintShop1155, PermitControl, Sweepable===', function () {
    let deployer, owner, paymentReceiver, proxyRegistryOwner, signer1, signer2, signer3;
    let UNIVERSAL,
        MANAGER,
        zeroRight,

        setSweepRight, 
        setLockSweepRight,

        setPaymentReceiverRight,
        setLockPaymentReceiverRight,
        setUpdateGlobalLimitRight,
        setLockGlobalLimitRight,
        setWhiteListRight,
        setPoolRight,

        setMintRight;

    let mintShop1155;
    let super1155;
    let super1155Second;
    let mockERC20;
    let staker;
    let proxyRegistry;
    const originalUri = "://ipfs/uri/{id}";
    let itemGroupId = ethers.BigNumber.from(1);
    let shiftedItemGroupId = itemGroupId.shl(128);
    let itemGroupId2 = ethers.BigNumber.from(2);
    let shiftedItemGroupId2 = itemGroupId2.shl(128);

    before(async function () {
        this.MintShop1155 = await ethers.getContractFactory("MintShop1155");
        this.MockERC20 = await ethers.getContractFactory("MockERC20");
        this.Staker = await ethers.getContractFactory("Staker");
        this.ProxyRegistry = await ethers.getContractFactory("ProxyRegistry");
        this.Super1155 = await ethers.getContractFactory("Super1155");
    });

    beforeEach(async function () {
        [deployer, owner, paymentReceiver, proxyRegistryOwner, signer1, signer2, signer3] = await ethers.getSigners();

        proxyRegistry = await this.ProxyRegistry.deploy();
        await proxyRegistry.deployed();
        await proxyRegistry.transferOwnership(proxyRegistryOwner.address);

        super1155 = await this.Super1155.deploy(
            owner.address,
            "Super1155",
            originalUri,
            proxyRegistry.address
        );

        // await super1155._transferOwnership(owner.address);
        super1155Second = await this.Super1155.deploy(
            owner.address,
            "Super1155142",
            originalUri + "uri2",
            proxyRegistry.address
        );
        await super1155.deployed();
        // await super1155Second._transferOwnership(owner.address);

        mintShop1155 = await this.MintShop1155.deploy(
            owner.address,
            paymentReceiver.address,
            "4"
        );
        await mintShop1155.deployed();

        mockERC20 = await this.MockERC20.deploy();
        await mockERC20.deployed();

        staker = await this.Staker.deploy(
            "firstStaker",
            mockERC20.address
        );

        // await mintShop1155.connect(deployer)._transferOwnership(owner.address);
        
        /// adding items to MintShop
        await mintShop1155.connect(owner).setItems([super1155.address, super1155Second.address]);
        
        await staker.transferOwnership(owner.address);

        UNIVERSAL = await mintShop1155.UNIVERSAL();
        MANAGER = await mintShop1155.MANAGER();
        zeroRight = await mintShop1155.ZERO_RIGHT();

        setSweepRight = await mintShop1155.SWEEP();
        setLockSweepRight = await mintShop1155.LOCK_SWEEP();

        setPaymentReceiverRight = await mintShop1155.SET_PAYMENT_RECEIVER();
        setLockPaymentReceiverRight = await mintShop1155.LOCK_PAYMENT_RECEIVER();
        setUpdateGlobalLimitRight = await mintShop1155.UPDATE_GLOBAL_LIMIT();
        setLockGlobalLimitRight = await mintShop1155.LOCK_GLOBAL_LIMIT();
        setWhiteListRight = await mintShop1155.WHITELIST();
        setPoolRight = await mintShop1155.POOL();

        setMintRight = await super1155.MINT();
    });

    // Test cases

    //////////////////////////////
    //       Constructor
    //////////////////////////////
    describe("Constructor", function () {
        it('should initialize values as expected', async function () {
            // expect(await mintShop1155.owner()).to.equal(owner.address);
            // expect(await mintShop1155.item()).to.equal(super1155.address);
            expect(await mintShop1155.paymentReceiver()).to.equal(paymentReceiver.address);
            expect(await mintShop1155.globalPurchaseLimit()).to.equal("4");
        });

        it('should deploy a new instance where deployer is the owner', async function () {
            let mintShop1155v2 = await this.MintShop1155.deploy(
                deployer.address,
                paymentReceiver.address,
                "4"
            );
            await super1155.deployed();

            // await mintShop1155v2._transferOwnership(deployer.address);

            expect(await mintShop1155v2.owner()).to.equal(deployer.address);
            // expect(await mintShop1155v2.item()).to.equal(super1155.address);
            expect(await mintShop1155v2.paymentReceiver()).to.equal(paymentReceiver.address);
            expect(await mintShop1155v2.globalPurchaseLimit()).to.equal("4");
        });
    });

    describe("version", function () {
        it('should return the correct version', async function(){
            expect(await mintShop1155.version()).to.equal(1)
        });
    });

    describe("updatePaymentReceiver", function () {
        it('Reverts: payment receiver address is locked', async function(){
            await mintShop1155.connect(owner).lockPaymentReceiver();
            await expect(
                mintShop1155.connect(owner).updatePaymentReceiver(owner.address)
            ).to.be.revertedWith("XXX");
        });

        it('Reverts: no valid permit', async function(){
            await expect(
                mintShop1155.connect(deployer).updatePaymentReceiver(owner.address)
            ).to.be.revertedWith("PermitControl: sender does not have a valid permit");
        });

        it('Reverts: setting manager for Zero address', async function(){
            let input = {
                types: ["address"],
                values: [deployer.address]
            }

            await expect(
                mintShop1155.connect(owner).setManagerRight(zeroRight, ethers.utils.defaultAbiCoder.encode(input.types, input.values))
            ).to.be.revertedWith("PermitControl: you may not specify a manager for the zero right");
        });

        it('should test PermitControl to set a manager who can further create permits to update payment receiver', async function(){
            // Declare a rights relationship for manager => payment
            await mintShop1155.connect(owner).setManagerRight(setPaymentReceiverRight, MANAGER);

            // Give a manager a permit
            await mintShop1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                MANAGER,
                ethers.constants.MaxUint256
            );
            
            // Give a manager a payment permit
            await mintShop1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setPaymentReceiverRight,
                ethers.constants.MaxUint256
            );

            // That manager creates a further permit for signer1 to update payment
            await mintShop1155.connect(deployer).setPermit(
                signer1.address,
                UNIVERSAL,
                setPaymentReceiverRight,
                ethers.constants.MaxUint256
            );
             
            await mintShop1155.connect(signer1).updatePaymentReceiver(owner.address);
            expect(await mintShop1155.paymentReceiver()).to.equal(owner.address);

            await mintShop1155.connect(signer1).updatePaymentReceiver(paymentReceiver.address);
            expect(await mintShop1155.paymentReceiver()).to.equal(paymentReceiver.address);
        });
    });

    describe("updateGlobalPurchaseLimit", function () {
        it('Reverts: global purchase limit is locked', async function(){
            await mintShop1155.connect(owner).lockGlobalPurchaseLimit();

            await expect(
                mintShop1155.connect(owner).updateGlobalPurchaseLimit("6")
            ).to.be.revertedWith("0x0A");
        });

        it('should update global purchase limit', async function(){
            await mintShop1155.connect(owner).updateGlobalPurchaseLimit("6");
        });
    });

    describe("addWhiteList, updateWhitelist", function () {
        let tree, root;
        whiteListAddresses = [deployer.address, owner.address, signer1.address];
        it ('shoud create a merkleTree', async function() {
            tree = MerkleTree(whiteListAddresses, keccak);
            root = tree.getRoot().toString('hex');
        });


        it('should add a whitelist', async function(){
            await mintShop1155.connect(owner).addWhiteList(0, 0, root, 0, ethers.constants.MaxUint256);
        });

    });

    // describe("addToWhitelist, getWhitelistStatus", function () {
    //     it('should add addresses to whitelist', async function(){
    //         // Create a whitelist with signer1 whitelisted
    //         await mintShop1155.connect(owner).addWhitelist({
    //             expiryTime: ethers.constants.MaxUint256,
    //             isActive: false,
    //             addresses: [signer1.address]
    //         });

    //         // Add more addresses to the whitelist including already existing one
    //         await mintShop1155.connect(owner).addToWhitelist(
    //             1,
    //             [signer1.address, signer2.address, signer3.address]
    //         );

    //         let result = await mintShop1155.connect(owner).getWhitelistStatus([signer1.address, signer2.address, owner.address], [1]);

    //         await expect(result[0][0]).to.be.equal(true); // First index is the addresses, second whitelists
    //         await expect(result[1][0]).to.be.equal(true); // First index is the addresses, second whitelists
    //         await expect(result[2][0]).to.be.equal(false); // First index is the addresses, second whitelists
    //     });
    // });

    // describe("removeFromWhitelist", function () {
    //     it('should remove addresses from whitelist', async function(){
    //         // Create a whitelist with signer1 whitelisted
    //         await mintShop1155.connect(owner).addWhitelist({
    //             expiryTime: ethers.constants.MaxUint256,
    //             isActive: false,
    //             addresses: [signer1.address]
    //         });

    //         // Add more addresses to the whitelist including already existing one
    //         await mintShop1155.connect(owner).addToWhitelist(
    //             1,
    //             [signer1.address, signer2.address, signer3.address]
    //         );
            
    //         // Get the addresses that are in the whitelist
    //         let result = await mintShop1155.connect(owner).getWhitelistStatus([signer1.address, signer3.address, owner.address, signer2.address], [1]);

    //         // Expect their presence
    //         await expect(result[0][0]).to.be.equal(true); // First index is the addresses, second whitelists
    //         await expect(result[1][0]).to.be.equal(true); // First index is the addresses, second whitelists
    //         await expect(result[2][0]).to.be.equal(false); // First index is the addresses, second whitelists
    //         await expect(result[3][0]).to.be.equal(true); // First index is the addresses, second whitelists

    //         // Remove one address from whitelist
    //         await mintShop1155.connect(owner).removeFromWhitelist(1, [signer1.address]);

    //         // Reload the addresses that are in the whitelist
    //         result = await mintShop1155.connect(owner).getWhitelistStatus([signer1.address, signer3.address], [1]);

    //         // Expect the absence
    //         await expect(result[0][0]).to.be.equal(false); // First index is the addresses, second whitelists
    //         await expect(result[1][0]).to.be.equal(true); // First index is the addresses, second whitelists
    //     });
    // });

    // describe("setWhitelistActive", function () {
    //     it('should return the correct version', async function(){
    //         // Create a whitelist with signer1 whitelisted
    //         await mintShop1155.connect(owner).addWhitelist({
    //             expiryTime: ethers.constants.MaxUint256,
    //             isActive: false,
    //             addresses: [signer1.address]
    //         });

    //         let whitelist = await mintShop1155.whitelists(1);
    //         await expect(
    //             whitelist.isActive
    //         ).to.be.equal(false);

    //         // Set the whitelist status to active
    //         await mintShop1155.connect(owner).setWhitelistActive(1, true);

    //         whitelist = await mintShop1155.whitelists(1);
    //         await expect(
    //             whitelist.isActive
    //         ).to.be.equal(true);
    //     });
    // });

    describe("updatePool, addPool, getPools", function () {
        beforeEach(async function(){
            // Configure token groups
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'FUNGIBLE',
                supplyType: 1,
                supplyData: 10,
                itemType: 1,
                itemData: 0,
                burnType: 1,
                burnData: 5
            });

            await super1155.connect(owner).configureGroup(itemGroupId2, {
                name: 'NONFUNGIBLE',
                supplyType: 0,
                supplyData: 1,
                itemType: 0,
                itemData: 0,
                burnType: 0,
                burnData: 0
            });

            await super1155Second.connect(owner).configureGroup(itemGroupId2, {
                name: 'NONFUNGIBLE',
                supplyType: 0,
                supplyData: 1,
                itemType: 0,
                itemData: 0,
                burnType: 0,
                burnData: 0
            });

            await super1155Second.connect(owner).configureGroup(itemGroupId2, {
                name: 'NONFUNGIBLE',
                supplyType: 0,
                supplyData: 1,
                itemType: 0,
                itemData: 0,
                burnType: 0,
                burnData: 0
            });
        });

        it('Reverts: updatePool a non-existent pool', async function(){
            // Updating a pool with non-existent pool id
            let latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
            await expect(mintShop1155.connect(owner).updatePool(1, {
                name: "firstPool",
                startTime: latestBlock.timestamp,
                endTime: latestBlock.timestamp + 60,
                purchaseLimit: 5,
                singlePurchaseLimit: 2,
                requirement: {
                    requiredType: 0,
                    requiredAsset: NULL_ADDRESS,
                    requiredAmount: 1,
                    whitelistId: 1
                },
                collection: super1155.address
            }, [1], [1], [1], [[{
                assetType: 1,
                asset: NULL_ADDRESS,
                price: 1
            }]])).to.be.revertedWith("0x1A");
        });

        it('Reverts: updatePool end time preceeds start time', async function(){
            // Updating a pool with endTime preceeding startTime
            let latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
            await expect(mintShop1155.connect(owner).updatePool(0, {
                name: "firstPool",
                startTime: latestBlock.timestamp,
                endTime: latestBlock.timestamp - 60,
                purchaseLimit: 5,
                singlePurchaseLimit: 2,
                requirement: {
                    requiredType: 0,
                    requiredAsset: NULL_ADDRESS,
                    requiredAmount: 1,
                    whitelistId: 1
                },
                collection: super1155.address
            }, [1], [1], [1], [[{
                assetType: 1,
                asset: NULL_ADDRESS,
                price: 1
            }]])).to.be.revertedWith("0x2A");
        });

        it('Reverts: updatePool no item groups included', async function(){
            // Updating a pool with 0 groups
            let latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
            await expect(mintShop1155.connect(owner).updatePool(0, {
                name: "firstPool",
                startTime: latestBlock.timestamp,
                endTime: latestBlock.timestamp + 60,
                purchaseLimit: 5,
                singlePurchaseLimit: 2,
                requirement: {
                    requiredType: 0,
                    requiredAsset: NULL_ADDRESS,
                    requiredAmount: 1,
                    whitelistId: 1
                },
                collection: super1155.address
            }, [], [1], [1], [[{
                assetType: 1,
                asset: NULL_ADDRESS,
                price: 1
            }]])).to.be.revertedWith("0x3A");
        });

        it('Reverts: updatePool groups and offsets length mismatch', async function(){
            // Updating a pool with groups and offsets length mismatch
            let latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
            await expect(mintShop1155.connect(owner).updatePool(0, {
                name: "firstPool",
                startTime: latestBlock.timestamp,
                endTime: latestBlock.timestamp + 60,
                purchaseLimit: 5,
                singlePurchaseLimit: 2,
                requirement: {
                    requiredType: 0,
                    requiredAsset: NULL_ADDRESS,
                    requiredAmount: 1,
                    whitelistId: 1
                },
                collection: super1155.address
            }, [1], [1, 2], [1], [[{
                assetType: 1,
                asset: NULL_ADDRESS,
                price: 1
            }]])).to.be.revertedWith("0x4A");
        });

        it('Reverts: updatePool groups and caps length mismatch', async function(){
            // Updating a pool with groups and caps length mismatch
            let latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
            await expect(mintShop1155.connect(owner).updatePool(0, {
                name: "firstPool",
                startTime: latestBlock.timestamp,
                endTime: latestBlock.timestamp + 60,
                purchaseLimit: 5,
                singlePurchaseLimit: 2,
                requirement: {
                    requiredType: 0,
                    requiredAsset: NULL_ADDRESS,
                    requiredAmount: 1,
                    whitelistId: 1
                },
                collection: super1155.address
            }, [1], [1], [1, 2], [[{
                assetType: 1,
                asset: NULL_ADDRESS,
                price: 1
            }]])).to.be.revertedWith("0x4A");
        });

        it('Reverts: updatePool groups and prices length mismatch', async function(){
            // Updating a pool with groups and prices length mismatch
            let latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
            await expect(mintShop1155.connect(owner).updatePool(0, {
                name: "firstPool",
                startTime: latestBlock.timestamp,
                endTime: latestBlock.timestamp + 60,
                purchaseLimit: 5,
                singlePurchaseLimit: 2,
                requirement: {
                    requiredType: 0,
                    requiredAsset: NULL_ADDRESS,
                    requiredAmount: 1,
                    whitelistId: 1
                },
                collection: super1155.address
            }, [1, 2], [1, 2], [1, 2], [[{
                assetType: 1,
                asset: NULL_ADDRESS,
                price: 1
            }]])).to.be.revertedWith("0x4A");
        });

        it('Reverts: updatePool no mintable amount', async function(){
            // Updating a pool with no mintable amount
            let latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
            await expect(mintShop1155.connect(owner).updatePool(0, {
                name: "firstPool",
                startTime: latestBlock.timestamp,
                endTime: latestBlock.timestamp + 60,
                purchaseLimit: 5,
                singlePurchaseLimit: 2,
                requirement: {
                    requiredType: 0,
                    requiredAsset: NULL_ADDRESS,
                    requiredAmount: 1,
                    whitelistId: 1
                },
                collection: super1155.address
            }, [1], [1], [0], [[{
                assetType: 1,
                asset: NULL_ADDRESS,
                price: 1
            }]])).to.be.revertedWith("0x5A");
        });

        it('should add a pool, update it, get the pool', async function(){
            // Creating a pool
            let latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
            await mintShop1155.connect(owner).addPool({
                name: "firstPool",
                startTime: latestBlock.timestamp,
                endTime: latestBlock.timestamp + 60,
                purchaseLimit: 5,
                singlePurchaseLimit: 2,
                requirement: {
                    requiredType: 0,
                    requiredAsset: NULL_ADDRESS,
                    requiredAmount: 1,
                    whitelistId: 1
                },
                collection: super1155.address
            }, [1, 2], [1, 1], [10, 1], [[{
                assetType: 1,
                asset: NULL_ADDRESS,
                price: 1
            }], [{
                assetType: 1,
                asset: NULL_ADDRESS,
                price: 1
            }]]);

            // Updating the purchase limit to 1
            latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
            await mintShop1155.connect(owner).updatePool(0, {
                name: "firstPool",
                startTime: latestBlock.timestamp,
                endTime: latestBlock.timestamp + 60,
                purchaseLimit: 1,
                singlePurchaseLimit: 2,
                requirement: {
                    requiredType: 0,
                    requiredAsset: NULL_ADDRESS,
                    requiredAmount: 1,
                    whitelistId: 1
                },
                collection: super1155.address
            }, [1, 2], [1, 1], [10, 1], [[{
                assetType: 1,
                asset: NULL_ADDRESS,
                price: 1
            }], [{
                assetType: 1,
                asset: NULL_ADDRESS,
                price: 1
            }]]);

            //Get the pool
            let pools = await mintShop1155.connect(owner).getPools([0], 0);
            console.log(pools[0].config);
            console.log("================= COLLECTION ================");
            console.log(pools[0].config.collection)
            console.log("================= COLLECTION ================");

            console.log(pools[0].config);
            console.log("=================");

            console.log(pools[0].items[0].prices[0].price);


            expect(pools[0].config.name).to.be.equal("firstPool");
        });
    });

    describe("mintFromPool, getPoolsWithAddress, getPurchaseCounts", function () {
        beforeEach(async function(){
            // Configure token groups
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'FUNGIBLE',
                supplyType: 1,
                supplyData: 10,
                itemType: 1,
                itemData: 0,
                burnType: 1,
                burnData: 5
            });

            await super1155.connect(owner).configureGroup(itemGroupId2, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 5,
                itemType: 0,
                itemData: 0,
                burnType: 0,
                burnData: 0
            });

            await super1155.connect(owner).configureGroup(itemGroupId2.add(1), {
                name: 'SUPERNFT',
                supplyType: 0,
                supplyData: 5,
                itemType: 0,
                itemData: 0,
                burnType: 0,
                burnData: 0
            });

            // Create Pools
            let latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
            await mintShop1155.connect(owner).addPool({
                name: "firstPool",
                startTime: latestBlock.timestamp,
                endTime: latestBlock.timestamp + 60,
                purchaseLimit: 3,
                singlePurchaseLimit: 2,
                requirement: {
                    requiredType: 0,
                    requiredAsset: NULL_ADDRESS,
                    requiredAmount: 1,
                    whitelistId: 0
                    },
                    collection: super1155.address
                }, [1, 2], // Groups 1 = FT, 2 = NFT
                [1, 0], // NumberOffset 1 = FT, 0 = NFT // FT's are coerced to index 1
                [10, 5], // Caps 10 = FT, 5 = NFT
                [
                    [{ // Price pair for FTs
                        assetType: 1,
                        asset: NULL_ADDRESS,
                        price: 1
                    }], 

                    [{ // Price pairs for NFTs, 5 NFTs = 5 Prices Pairs
                        assetType: 1,
                        asset: NULL_ADDRESS,
                        price: 1
                    }, {
                        assetType: 1,
                        asset: NULL_ADDRESS,
                        price: 1
                    }, {
                        assetType: 1,
                        asset: NULL_ADDRESS,
                        price: 1
                    }, {
                        assetType: 1,
                        asset: NULL_ADDRESS,
                        price: 1
                    }, {
                        assetType: 1,
                        asset: NULL_ADDRESS,
                        price: 1
                    }]
                ]);

            latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
            await mintShop1155.connect(owner).addPool({
                name: "secondPool",
                startTime: latestBlock.timestamp,
                endTime: latestBlock.timestamp + 60,
                purchaseLimit: 2,
                singlePurchaseLimit: 1,
                requirement: {
                    requiredType: 0,
                    requiredAsset: NULL_ADDRESS,
                    requiredAmount: 1,
                    whitelistId: 0
                    },
                    collection: super1155.address
                }, [3], // Group
                [0], // NumberOffset
                [2], // Caps
                [
                    [{ // Price pairs
                        assetType: 1,
                        asset: NULL_ADDRESS,
                        price: 1
                    }, {
                        assetType: 1,
                        asset: NULL_ADDRESS,
                        price: 1
                    }]
                ]);

            // Get the pool
            let pools = await mintShop1155.connect(owner).getPools([0], 0);
            expect(pools[0].config.name).to.be.equal("firstPool");
        });

        it('Reverts: mintFromPool amount less than 0', async function(){
            // Mint from pool
            await expect(
                mintShop1155.connect(owner).mintFromPool(0, 2, 1, 0, 0)
            ).to.be.revertedWith("0x0B");
        });

        it('Reverts: mintFromPool pool not active', async function(){
            // Mint from pool
            await expect(
                mintShop1155.connect(owner).mintFromPool(2, 2, 1, 1, 0)
            ).to.be.revertedWith("0x1B");
        });

        it('Reverts: mintFromPool amount greater than singlePurchaseLimit', async function(){
            // Mint from pool
            await expect(
                mintShop1155.connect(owner).mintFromPool(0, 2, 1, 3, 0)
            ).to.be.revertedWith("0x2B");
        });

        it('Reverts: mintFromPool assetindex not valid', async function(){
            // Mint from pool
            await expect(
                mintShop1155.connect(owner).mintFromPool(0, 2, 5, 1, 0)
            ).to.be.revertedWith("0x3B");
        });

        it('Reverts: mintFromPool pool is not running', async function(){
            // Jump forward in time more than the pool end time
            await ethers.provider.send("evm_increaseTime", [70]);
            await ethers.provider.send("evm_mine", []);

            // Mint from pool
            await expect(
                mintShop1155.connect(owner).mintFromPool(0, 2, 0, 1, 0)
            ).to.be.revertedWith("0x4B");
        });

        it('Reverts: mintFromPool pool purchase limit reach', async function(){
            // Give the Shop permit to mint items in Super1155 contract
            await super1155.connect(owner).setPermit(
                mintShop1155.address,
                UNIVERSAL,
                setMintRight,
                ethers.constants.MaxUint256
            );

            // Mint three times
            await mintShop1155.connect(owner).mintFromPool(0, 2, 0, 1, 0, {value: ethers.utils.parseEther("1")})
            await mintShop1155.connect(owner).mintFromPool(0, 2, 1, 1, 0, {value: ethers.utils.parseEther("1")})
            await mintShop1155.connect(owner).mintFromPool(0, 2, 2, 1, 0, {value: ethers.utils.parseEther("1")})

            // Mint again surpassing the purchase limit of the pool
            await expect(
                mintShop1155.connect(owner).mintFromPool(0, 2, 0, 1, 0, {value: ethers.utils.parseEther("1")})
            ).to.be.revertedWith("0x5B");
        });

        it('Reverts: mintFromPool global purchase limit reach', async function(){
            // Give the Shop permit to mint items in Super1155 contract
            await super1155.connect(owner).setPermit(
                mintShop1155.address,
                UNIVERSAL,
                setMintRight,
                ethers.constants.MaxUint256
            );

            // Mint four times
            await mintShop1155.connect(owner).mintFromPool(0, 2, 0, 1, 0, {value: ethers.utils.parseEther("1")})
            await mintShop1155.connect(owner).mintFromPool(0, 2, 1, 1, 0, {value: ethers.utils.parseEther("1")})
            await mintShop1155.connect(owner).mintFromPool(0, 2, 2, 1, 0, {value: ethers.utils.parseEther("1")})
            await mintShop1155.connect(owner).mintFromPool(1, 3, 0, 1, 0, {value: ethers.utils.parseEther("1")})

            // Mint again surpassing the global purchase limit
            await expect(
                mintShop1155.connect(owner).mintFromPool(1, 3, 1, 1, 0, {value: ethers.utils.parseEther("1")})
            ).to.be.revertedWith("0x5B");
        });

        it('Reverts: mintFromPool not whitelisted in the pool', async function(){
            // Give the Shop permit to mint items in Super1155 contract
            await super1155.connect(owner).setPermit(
                mintShop1155.address,
                UNIVERSAL,
                setMintRight,
                ethers.constants.MaxUint256
            );

            // Create whitelist with deployer's address in it
            await mintShop1155.connect(owner).addWhitelist({
                expiryTime: ethers.constants.MaxUint256,
                isActive: false,
                addresses: [deployer.address]
            });

            // Set the whitelist status to active
            await mintShop1155.connect(owner).setWhitelistActive(1, true);

            // Update the pool from beforeEach to include whitelist
            let latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
            await mintShop1155.connect(owner).updatePool(1, {
                name: "secondPool",
                startTime: latestBlock.timestamp,
                endTime: latestBlock.timestamp + 60,
                purchaseLimit: 2,
                singlePurchaseLimit: 1,
                requirement: {
                    requiredType: 0,
                    requiredAsset: NULL_ADDRESS,
                    requiredAmount: 1,
                    whitelistId: 1
                    },
                    collection: super1155.address
                }, [3], // Group
                [0], // NumberOffset
                [2], // Caps
                [
                    [{ // Price pairs
                        assetType: 1,
                        asset: NULL_ADDRESS,
                        price: 1
                    }, {
                        assetType: 1,
                        asset: NULL_ADDRESS,
                        price: 1
                    }]
                ]);
           
            // Mint
            await expect(
                mintShop1155.connect(signer1).mintFromPool(1, 3, 0, 1, 0, {value: ethers.utils.parseEther("1")})
            ).to.be.revertedWith("0x6B");
        });

        it('Reverts: mintFromPool not enough items available for purchase', async function(){
            // Give the Shop permit to mint items in Super1155 contract
            await super1155.connect(owner).setPermit(
                mintShop1155.address,
                UNIVERSAL,
                setMintRight,
                ethers.constants.MaxUint256
            );

            // Update the pool from beforeEach to lower its cap
            let latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
            await mintShop1155.connect(owner).updatePool(1, {
                name: "secondPool",
                startTime: latestBlock.timestamp,
                endTime: latestBlock.timestamp + 60,
                purchaseLimit: 2,
                singlePurchaseLimit: 1,
                requirement: {
                    requiredType: 0,
                    requiredAsset: NULL_ADDRESS,
                    requiredAmount: 1,
                    whitelistId: 0
                    },
                    collection: super1155.address
                }, [3], // Group
                [0], // NumberOffset
                [1], // Caps
                [
                    [{ // Price pairs
                        assetType: 1,
                        asset: NULL_ADDRESS,
                        price: 1
                    }, {
                        assetType: 1,
                        asset: NULL_ADDRESS,
                        price: 1
                    }]
                ]);
           
            await mintShop1155.connect(signer1).mintFromPool(1, 3, 0, 1, 0, {value: ethers.utils.parseEther("1")})

            // Mint until cap reached
            await expect(
                mintShop1155.connect(signer1).mintFromPool(1, 3, 0, 1, 0, {value: ethers.utils.parseEther("1")})
            ).to.be.revertedWith("0x7B");
        });

        it('Reverts: not enough ether sent', async function(){

            let latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
            await mintShop1155.connect(owner).updatePool(1, {
                name: "secondPool",
                startTime: latestBlock.timestamp,
                endTime: latestBlock.timestamp + 60,
                purchaseLimit: 2,
                singlePurchaseLimit: 1,
                requirement: {
                    requiredType: 0,
                    requiredAsset: NULL_ADDRESS,
                    requiredAmount: 1,
                    whitelistId: 0
                    },
                    collection: super1155.address
                }, [3], // Group
                [0], // NumberOffset
                [2], // Caps
                [
                    [{ // Price pairs
                        assetType: 1,
                        asset: NULL_ADDRESS,
                        price: ethers.utils.parseEther("1")
                    }, {
                        assetType: 1,
                        asset: NULL_ADDRESS,
                        price: 1
                    }]
                ]);

            // Give the Shop permit to mint items in Super1155 contract
            await super1155.connect(owner).setPermit(
                mintShop1155.address,
                UNIVERSAL,
                setMintRight,
                ethers.constants.MaxUint256
            );

            await expect(
                mintShop1155.connect(owner).mintFromPool(1, 3, 0, 1, 0, {value: ethers.utils.parseEther("0.5")})
            ).to.be.revertedWith("0x9B");
        });

        it('Reverts => Success: mintFromPool not enough ERC20 tokens for the pool then getPrchaseCount', async function(){
            // Give the Shop permit to mint items in Super1155 contract
            await super1155.connect(owner).setPermit(
                mintShop1155.address,
                UNIVERSAL,
                setMintRight,
                ethers.constants.MaxUint256
            );

            // Update the pool from beforeEach to include ERC20 token as price pair
            let latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
            await mintShop1155.connect(owner).updatePool(1, {
                name: "secondPool",
                startTime: latestBlock.timestamp,
                endTime: latestBlock.timestamp + 60,
                purchaseLimit: 4,
                singlePurchaseLimit: 3,
                requirement: {
                    requiredType: 1,
                    requiredAsset: mockERC20.address,
                    requiredAmount: ethers.utils.parseEther("10"),
                    whitelistId: 0
                    },
                    collection: super1155.address
                }, [3], // Group
                [0], // NumberOffset
                [5], // Caps
                [
                    [{ // Price pairs
                        assetType: 2,
                        asset: mockERC20.address,
                        price: ethers.utils.parseEther("15")
                    }, {
                        assetType: 2,
                        asset: mockERC20.address,
                        price: ethers.utils.parseEther("15")
                    }]
                ]);
           
            // Give signer1 some amount of ERC20 Tokens
            await mockERC20.connect(deployer).transfer(signer1.address, ethers.utils.parseEther("5"));

            // Mint until cap reached
            await expect(
                mintShop1155.connect(signer1).mintFromPool(1, 3, 0, 1, 0)
            ).to.be.revertedWith("0x8B");

            // Give signer1 some more amount of ERC20 Tokens
            await mockERC20.connect(deployer).transfer(signer1.address, ethers.utils.parseEther("5"));

            // Signer1 approves mintshop1155 contract
            await mockERC20.connect(signer1).approve(mintShop1155.address, ethers.utils.parseEther("15"));

            await expect(
                mintShop1155.connect(signer1).mintFromPool(1, 3, 1, 3, 0)
            ).to.be.revertedWith("0x1C");

            // Successful purchase, Give signer1 some more amount of ERC20 Tokens
            await mockERC20.connect(deployer).transfer(signer1.address, ethers.utils.parseEther("5"));

            await mintShop1155.connect(signer1).mintFromPool(1, 3, 1, 1, 0);

            // getPurchaseCounts
            let balances = await mintShop1155.connect(signer1).getPurchaseCounts([signer1.address, signer2.address, owner.address], [1]);

            await expect(balances[0][0]).to.be.equal("1"); //First index is the address, second is the ids
            await expect(balances[1][0]).to.be.equal("0"); //First index is the address, second is the ids
            await expect(balances[2][0]).to.be.equal("0"); //First index is the address, second is the ids
        });

        it('Reverts: mintFromPool unrecognized asset type (But it gets reverted at the time of assigning instead of actual revert)', async function(){
            // Give the Shop permit to mint items in Super1155 contract
            await super1155.connect(owner).setPermit(
                mintShop1155.address,
                UNIVERSAL,
                setMintRight,
                ethers.constants.MaxUint256
            );

            // Update the pool from beforeEach to include ERC20 token as price pair
            let latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
            await expect(
                mintShop1155.connect(owner).updatePool(1, {
                name: "secondPool",
                startTime: latestBlock.timestamp,
                endTime: latestBlock.timestamp + 60,
                purchaseLimit: 2,
                singlePurchaseLimit: 1,
                requirement: {
                    requiredType: 0,
                    requiredAsset: NULL_ADDRESS,
                    requiredAmount: 1,
                    whitelistId: 0
                    },
                    collection: super1155.address
                }, [3], // Group
                [0], // NumberOffset
                [2], // Caps
                [
                    [{ // Price pairs
                        assetType: 3,
                        asset: NULL_ADDRESS,
                        price: 1
                    }, {
                        assetType: 3,
                        asset: NULL_ADDRESS,
                        price: 1
                    }]
                ])).to.be.reverted;
            
        });

        it('Reverts: not enough ERC1155 required items', async function(){
            // Give the Shop permit to mint items in Super1155 contract
            await super1155.connect(owner).setPermit(
                mintShop1155.address,
                UNIVERSAL,
                setMintRight,
                ethers.constants.MaxUint256
            );

            // Update the pool from beforeEach to include ERC1155 requirement
            let latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
            await mintShop1155.connect(owner).updatePool(1, {
                name: "secondPool",
                startTime: latestBlock.timestamp,
                endTime: latestBlock.timestamp + 60,
                purchaseLimit: 2,
                singlePurchaseLimit: 1,
                requirement: {
                    requiredType: 2,
                    requiredAsset: super1155.address,
                    requiredAmount: 1,
                    whitelistId: 0
                    },
                    collection: super1155.address
                }, [3], // Group
                [0], // NumberOffset
                [2], // Caps
                [
                    [{ // Price pairs
                        assetType: 1,
                        asset: NULL_ADDRESS,
                        price: 1
                    }, {
                        assetType: 1,
                        asset: NULL_ADDRESS,
                        price: 1
                    }]
                ]);

                // Mint based on ERC1155 item holdings
                await expect(
                    mintShop1155.connect(signer1).mintFromPool(1, 3, 1, 1, 0, )
                ).to.be.revertedWith("0x8B");

                // Mint ERC1155 for signer1
                await super1155.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], ["1"], DATA);

                await mintShop1155.connect(signer1).mintFromPool(1, 3, 0, 1, 0, {value: ethers.utils.parseEther("1")});
        });

        it('should getPoolsWithAddress', async function(){
            // Get all the pools mentioned
            let pools = await mintShop1155.connect(owner).getPoolsWithAddress([0, 1], owner.address, 0);
            await expect(
                pools[0].config.name
            ).to.be.equal("firstPool")
        });
    });

    describe("mintFromPool for staker contract for a specific Super1155 group", function () {
        it('should purchase using staking points', async function(){
            // Configure token group
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'FUNGIBLE',
                supplyType: 1,
                supplyData: 10,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 5
            });

            // Create Pool of that token group
            let latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
            await mintShop1155.connect(owner).addPool({
                name: "firstPool",
                startTime: latestBlock.timestamp,
                endTime: latestBlock.timestamp + 60,
                purchaseLimit: 3,
                singlePurchaseLimit: 2,
                requirement: {
                    requiredType: 3,
                    requiredAsset: staker.address,
                    requiredAmount: 1000, // Required amount of points
                    whitelistId: 0
                    },
                    collection: super1155.address
                }, [1], // Groups 1 = FT, 2 = NFT
                [0], // NumberOffset 1 = FT, 0 = NFT // FT's are coerced to index 1
                [10], // Caps 10 = FT, 5 = NFT
                [
                    [{ // Price pair for FTs
                        assetType: 0,
                        asset: staker.address,
                        price: 1
                    }]
                ]);

            // Set Emission rate to current block number
            await staker.connect(owner).setEmissions([
				{ blockNumber: (await (await ethers.provider.getBlock()).number) +  5, rate: ethers.utils.parseEther('10') },
			], [
				{ blockNumber: (await (await ethers.provider.getBlock()).number) +  5, rate: 100 },
			]);
			await staker.connect(owner).addPool(mockERC20.address, 100, 50);

			for (let i = 0; i < 4; ++i) {
				ethers.provider.send('evm_mine');
			}

            // Give the signer1 some mockERC20 tokens
            await mockERC20.connect(deployer).transfer(signer1.address, ethers.utils.parseEther("10"));

            // Give staker contract some mockERC20 tokens
            await mockERC20.connect(deployer).transfer(staker.address, ethers.utils.parseEther("1000"));
            
            // Signer1 approves staker contract
            await mockERC20.connect(signer1).approve(staker.address, ethers.utils.parseEther("10"));
           
            // Signer1 deposits the tokens
            await staker.connect(signer1).deposit(mockERC20.address, ethers.utils.parseEther("10"));

            // Jump forward and travel in time through the portal
            for (let i = 0; i < 5; ++i) {
				ethers.provider.send('evm_mine');
			}

            await expect((
                await staker.connect(owner).getPendingPoints(mockERC20.address, signer1.address)).toString()
            ).to.be.equal("500");
            
            // Signer1 hasn't claimed points
            // mintFromPool of mintshop1155 must revert
            await expect(
                mintShop1155.connect(signer1).mintFromPool(0, 1, 0, 1, 0)
            ).to.be.revertedWith("MintShop1155: you do not have enough required points for this pool");
            
            // Jump forward and travel in time through the portal, signer1 must be eligible for the pool now
            for (let i = 0; i < 5; ++i) {
				ethers.provider.send('evm_mine');
			}

            // Signer1 withdraws his deposits thus receiving points
            await staker.connect(signer1).withdraw(mockERC20.address, ethers.utils.parseEther("10"));

            await expect(
                await staker.connect(signer1).getAvailablePoints(signer1.address)
            ).to.be.above("1000");

            // Owner of staker contract approves the mintshop1155 to use user points
            await staker.connect(owner).approvePointSpender(mintShop1155.address, true);

            // Owner of mintshop1155 contract sets a permit for signer1 to mint
            await super1155.connect(owner).setPermit(
                mintShop1155.address,
                UNIVERSAL,
                setMintRight,
                ethers.constants.MaxUint256
            );
            
            // Signer1 Successfully mint
            await mintShop1155.connect(signer1).mintFromPool(0, 1, 0, 1, 0);
        });
    });

    describe("sweep, lockSweep", function () {
        it('Reverts: sweep is locked', async function(){
            await mintShop1155.connect(owner).lockSweep();

            await expect(
                mintShop1155.connect(owner).sweep(mockERC20.address, ethers.utils.parseEther("10"), signer1.address)
            ).to.be.revertedWith("Sweep: the sweep function is locked");
        });

        it('should sweep tokens back from mintshop1155 to the user address', async function(){
            await mockERC20.connect(deployer).transfer(signer3.address, ethers.utils.parseEther("10"));

            await mockERC20.connect(signer3).transfer(mintShop1155.address, ethers.utils.parseEther("5"));

            await mintShop1155.connect(owner).sweep(mockERC20.address, ethers.utils.parseEther("5"), signer3.address);

            await expect(
                await mockERC20.balanceOf(signer3.address)
            ).to.be.equal(ethers.utils.parseEther("10"));
        });
    });

    describe("max allocation test", function() {
        it("Shoud revert", async function() {
            let mShop = await this.MintShop1155.deploy(
                deployer.address,
                paymentReceiver.address,
                "4"
            );


            let sup = await this.Super1155.deploy(
                owner.address,
                "Super1155142",
                originalUri + "uri2",
                proxyRegistry.address
            );
            await sup.connect(owner).configureGroup(1, {
                name: 'NFT',
                supplyType: 0,
                supplyData: 5,
                itemType: 0,
                itemData: 0,
                burnType: 0,
                burnData: 0
            });

            await sup.connect(owner).setPermit(
                mShop.address,
                UNIVERSAL,
                setMintRight,
                ethers.constants.MaxUint256
            );

            await mShop.setItems([sup.address]);

            // await super1155.setPermit();

            let latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
            console.log()
            await mShop.connect(deployer).addPool({
                name: "maxAllocationTest",
                startTime: latestBlock.timestamp,
                endTime: latestBlock.timestamp + 60,
                purchaseLimit: 100,
                singlePurchaseLimit: 1,
                requirement: {
                    requiredType: 0,
                    requiredAsset: NULL_ADDRESS,
                    requiredAmount: 1,
                    whitelistId: 0
                    },
                    collection: sup.address
                }, [1], // Groups 1 = FT, 2 = NFT
                [1], // NumberOffset 1 = FT, 0 = NFT // FT's are coerced to index 1
                [10], // Caps 10 = FT, 5 = NFT
                [
                    [{ // Price pairs for NFTs, 5 NFTs = 5 Prices Pairs
                        assetType: 1,
                        asset: NULL_ADDRESS,
                        price: 1
                    }]
                ]);

                let pools = await mShop.getPools([0], 0);
                console.log(pools[0].items[0].groupId.toString());

                await mShop.connect(signer1).mintFromPool(0, 1, 0, 1, 0, {value: ethers.utils.parseEther("1")})

                await expect(
                    mShop.connect(signer1).mintFromPool(0, 1, 0, 1, 0, {value: ethers.utils.parseEther("1")})
                ).to.be.revertedWith("0x0D");
        });
    });
});