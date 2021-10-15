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
describe('===Stakerv2===', function () {
    let deployer, owner, paymentReceiver, signer1, signer2, signer3;
    
    let rewardToken,
        depositToken,
        stakerv2,
        super721,
        super1155,
        proxyRegistry;
    const originalUri = "://ipfs/uri/";


    before(async function () {
        this.MockERC20 = await ethers.getContractFactory("MockERC20");
        this.Staker = await ethers.getContractFactory("StakerV2");
        this.Super721 = await ethers.getContractFactory("Super721");
        this.Super1155 = await ethers.getContractFactory("Super1155");
        this.ProxyRegistry = await ethers.getContractFactory("MockProxyRegistry");
    });

    beforeEach(async function () {
        [deployer, owner, paymentReceiver, signer1, signer2, signer3] = await ethers.getSigners();

        rewardToken = await this.MockERC20.deploy();
        await rewardToken.deployed();

        depositToken = await this.MockERC20.deploy();
        await depositToken.deployed();

        stakerv2 = await this.Staker.deploy(
            owner.address,
            "firstStaker",
            rewardToken.address
        );
        await stakerv2.deployed();

        proxyRegistry = await this.ProxyRegistry.deploy();
        await proxyRegistry.deployed();

        super721 = await this.Super721.deploy(
            owner.address,
            "Super721",
            "SIMX721",
            originalUri,
            proxyRegistry.address,
        );
        await super721.deployed();

        super1155 = await this.Super1155.deploy(
            owner.address,
            "Super1155",
            originalUri,
            proxyRegistry.address
        );
        await super1155.deployed();

    });

    // Test cases

    //////////////////////////////
    //       Constructor
    //////////////////////////////

    describe("All", function () {
        it('stakerv2', async function () {
            let itemGroupId = ethers.BigNumber.from(1);
            let shiftedItemGroupId = itemGroupId.shl(128);
            let itemGroupId2 = ethers.BigNumber.from(2);
            let shiftedItemGroupId2 = itemGroupId2.shl(128);

            await depositToken.transfer(signer1.address, ethers.utils.parseEther("1000"));
            await depositToken.transfer(signer2.address, ethers.utils.parseEther("1000"));
            await rewardToken.transfer(stakerv2.address, ethers.utils.parseEther("500000"));

            // Note 6.6666666666 per second is equivalent to 100 per 15 seconds(15 seconds = block time according to Blocks implementation)
            // Now the rewards must be set based on seconds
            await stakerv2.connect(owner).setEmissions(
                [{timeStamp: await (await ethers.provider.getBlock()).timestamp, rate: ethers.utils.parseEther("6.6666666666")}],
                [{timeStamp: await (await ethers.provider.getBlock()).timestamp, rate: ethers.utils.parseEther("6.6666666666")}]);

            await stakerv2.connect(owner).configureBoostersBatch([0, 1], [{   
                    set: true,
                    multiplier: 23000,
                    amountRequired: 3,
                    groupRequired: itemGroupId2,
                    contractRequired: super721.address,
                    assetType: 2
                }, {
                    set: true,
                    multiplier: 20000,
                    amountRequired: 2,
                    groupRequired: 0,
                    contractRequired: super1155.address,
                    assetType: 2
                }]);

            await stakerv2.connect(owner).addPool(depositToken.address, 10000, 10000, [0, 1]);
            await depositToken.connect(signer1).approve(stakerv2.address, ethers.utils.parseEther("1000"));
            await depositToken.connect(signer2).approve(stakerv2.address, ethers.utils.parseEther("1000"));
            
            // Mint ITEMS for Signer1
            await super721.connect(owner).configureGroup(itemGroupId2, {
                name: 'PEPSI',
                    supplyType: 0,
                    supplyData: 10,
                    burnType: 0,
                    burnData: 0
                });
            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId2, shiftedItemGroupId2.add(1), shiftedItemGroupId2.add(2)], DATA);
            await super721.connect(signer1).setApprovalForAll(stakerv2.address, true);

            // Mint ITEMS for Signer2
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'PEPSI',
                    supplyType: 0,
                    supplyData: 10,
                    itemType: 0,
                    itemData: 0,
                    burnType: 0,
                    burnData: 0
                });
            await super1155.connect(owner).mintBatch(signer2.address, [shiftedItemGroupId, shiftedItemGroupId.add(1)], [1, 1], DATA);
            await super1155.connect(signer2).setApprovalForAll(stakerv2.address, true);

            //User1-Deposit
            await stakerv2.connect(signer1).deposit(depositToken.address, ethers.utils.parseEther("200"));
            await network.provider.send("evm_increaseTime", [30])

            //User2-StakeITEMS
            await stakerv2.connect(signer2).stakeItemsBatch([shiftedItemGroupId, shiftedItemGroupId.add(1)], [1, 1], super1155.address, depositToken.address, 1);
            await network.provider.send("evm_increaseTime", [30])

            //User1-StakeITEMS
            await stakerv2.connect(signer1).stakeItemsBatch([shiftedItemGroupId2, shiftedItemGroupId2.add(1), shiftedItemGroupId2.add(2)], [1, 1, 1], super721.address, depositToken.address, 0);
            await network.provider.send("evm_increaseTime", [15])
            
            //User2-Deposit
            await stakerv2.connect(signer2).deposit(depositToken.address, ethers.utils.parseEther("150"));
            await network.provider.send("evm_increaseTime", [15])
            
            //User1-Claims
            await stakerv2.connect(signer1).claim(depositToken.address);

            //User1-UnstakeITEMS
            await stakerv2.connect(signer1).unstakeItemsBatch(depositToken.address, 0);
            await network.provider.send("evm_increaseTime", [15])

            //User2-Withdraw
            await stakerv2.connect(signer2).withdraw(depositToken.address, ethers.utils.parseEther("100"));
            await network.provider.send("evm_increaseTime", [15])

            //User2-Claims
            await stakerv2.connect(signer2).claim(depositToken.address);
            
            //User1-Deposit
            await stakerv2.connect(signer1).deposit(depositToken.address, ethers.utils.parseEther("150"));
            await network.provider.send("evm_increaseTime", [15])

            //User-2 && User-1 Withdraw-All and Claim
            await stakerv2.connect(signer2).withdraw(depositToken.address, ethers.utils.parseEther("50"));
            await stakerv2.connect(signer1).withdraw(depositToken.address, ethers.utils.parseEther("350"));
            await stakerv2.connect(signer1).claim(depositToken.address);
            await stakerv2.connect(signer2).claim(depositToken.address);
            console.log(await (await rewardToken.balanceOf(signer1.address)).toString());
            console.log(await (await rewardToken.balanceOf(signer2.address)).toString());
            console.log(await stakerv2.connect(signer3).getItemsUserInfo(signer2.address, 1));
            
            // Resultant must be around 900 rewards since 
            // (30 + 30 + 15 + 15 + 15 + 15 + 15) seconds * (6.666666666) Rate = 899.99999
           
            // 235011 + 655331 + 262178 + 51697 = 1204217 = 0.001204217 Ether Gas consumption for all calls above
            // as shown by gas reporter. It is yet to be confirmed on Testnet.
        });
    });
});