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
describe('===Super1155Intrinsic===', function () {
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

    describe("Intrinsic Super1155 batch test", function () {
        let shiftedItemGroupId3, shiftedItemGroupId4;
        beforeEach(async function(){

            // Create Itemsgroup ID = 1
            await super1155.connect(owner).configureGroup(itemGroupId, {
                    name: 'PEPSI',
                    supplyType: 0,
                    supplyData: 10,
                    itemType: 0,
                    itemData: 0,
                    burnType: 1,
                    burnData: 10
                }, {
                    transferTime: 0,
                    transferFeeAmount: 0,
                    transferToken: NULL_ADDRESS,
                    transferType: 0,
                    transferFeeType: 0
                }, {
                    rate: ethers.utils.parseEther("5"),
                    burnShare: 2000,
                    prefund: 0,
                    totalLocked: 0,
                    intrinsicToken: NULL_ADDRESS,
                    intrinsic: true
                }, {value: ethers.utils.parseEther("10")});
            
            // Create the leftShifted itemgroup ID
            shiftedItemGroupId3 = shiftedItemGroupId.mul(3);
            shiftedItemGroupId4 = shiftedItemGroupId.mul(4);

            // Mint INFT
            await super1155.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId, shiftedItemGroupId.add(1), shiftedItemGroupId.add(2)], ["1", "1", "1"], DATA,  {value: ethers.utils.parseEther("5")} );

            // Burn INFT
            let b1 = await deployer.getBalance();
            let b2 = await owner.getBalance();
            console.log("Balances before burn")
            console.log(b1);
            console.log(b2);

            await super1155.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId, shiftedItemGroupId.add(1), shiftedItemGroupId.add(2)], ["1", "1", "1"]);
            
            b1 = await deployer.getBalance();
            b2 = await owner.getBalance();
            console.log("Balances before burn")
            console.log(b1);
            console.log(b2);

            let test = await super1155.intrinsicGroups(itemGroupId);
            console.log(test);
        });

        it('should burnBatch tokens in batch based on UNIVERSAL, GROUP and ITEM circumstances (Function)', async function () {
            // // Burn 1 amount from each address successfully 
            // await super1155.connect(owner).burnBatch(deployer.address, [shiftedItemGroupId3, shiftedItemGroupId4], ["1", "1"]);
            // let balancesBatch = await super1155.connect(owner).balanceOfBatch([deployer.address, deployer.address], [shiftedItemGroupId3.add(1), shiftedItemGroupId4.add(1)]);
            // expect(balancesBatch[0]).to.be.equal("4");
            // expect(balancesBatch[1]).to.be.equal("4");

            // // Set Permit for burning based on group circumstance
            // let groupCirumstance = "0x0000000000000000000000000000000000000000000000000000000000000003"
            // await super1155.connect(owner).setPermit(
            //     deployer.address,
            //     groupCirumstance,
            //     burnRight,
            //     ethers.constants.MaxUint256
            // );
          
            // await super1155.connect(deployer).burnBatch(deployer.address, [shiftedItemGroupId3], ["1"]);
            // balancesBatch = await super1155.connect(owner).balanceOfBatch([deployer.address, deployer.address], [shiftedItemGroupId3.add(1), shiftedItemGroupId4.add(1)]);
            // expect(balancesBatch[0]).to.be.equal("3");
            // expect(balancesBatch[1]).to.be.equal("4");

            // // Set Permit for burning based on item circumstance
            // let itemCirumstance = "0x0000000000000000000000000000000400000000000000000000000000000001"
            // await super1155.connect(owner).setPermit(
            //     deployer.address,
            //     itemCirumstance,
            //     burnRight,
            //     ethers.constants.MaxUint256
            // );

            // await super1155.connect(deployer).burnBatch(deployer.address, [shiftedItemGroupId4.add(1)], ["1"]);
            // balancesBatch = await super1155.connect(owner).balanceOfBatch([deployer.address, deployer.address], [shiftedItemGroupId3.add(1), shiftedItemGroupId4.add(1)]);
            // expect(balancesBatch[0]).to.be.equal("3");
            // expect(balancesBatch[1]).to.be.equal("3");
        });
    });

});