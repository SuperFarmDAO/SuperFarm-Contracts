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
describe('===Staker===', function () {
    let deployer, owner, paymentReceiver, proxyRegistryOwner, signer1, signer2, signer3;
    
    let rewardToken,
        depositToken,
        staker;

    before(async function () {
        this.MockERC20 = await ethers.getContractFactory("MockERC20");
        this.Staker = await ethers.getContractFactory("Staker");
    });

    beforeEach(async function () {
        [deployer, owner, paymentReceiver, proxyRegistryOwner, signer1, signer2, signer3] = await ethers.getSigners();

        rewardToken = await this.MockERC20.deploy();
        await rewardToken.deployed();

        depositToken = await this.MockERC20.deploy();
        await depositToken.deployed();

        staker = await this.Staker.deploy(
            "firstStaker",
            rewardToken.address
        );
        await staker.deployed();

        await staker.transferOwnership(owner.address);
    });

    // Test cases

    //////////////////////////////
    //       Constructor
    //////////////////////////////
    describe("Constructor", function () {
        it('should initialize values as expected', async function () {
            expect(await staker.name()).to.equal("firstStaker");
            expect(await staker.owner()).to.equal(owner.address);
            expect(await staker.canAlterDevelopers()).to.equal(true);
            expect(await staker.canAlterTokenEmissionSchedule()).to.equal(true);
            expect(await staker.canAlterPointEmissionSchedule()).to.equal(true);
        });
    });

    describe("addDeveloper, lockDevelopers, updateDeveloper, getDeveloperCount", function () {
        it('Reverts: addition of developers is locked', async function () {
            await staker.connect(owner).lockDevelopers();

            await expect(
                staker.connect(owner).addDeveloper(deployer.address, "1000")
            ).to.be.revertedWith("This Staker has locked the addition of developers; no more may be added.");
        });

        it('should add new developer', async function () {
            await staker.connect(owner).addDeveloper(deployer.address, "1000");

            await expect(
                await staker.connect(owner).developerAddresses(0)
            ).to.be.equal(deployer.address);
        });

        it('Reverts: Not a developer of the staker', async function () {
            await staker.connect(owner).addDeveloper(deployer.address, "1000");

            await expect(
                staker.connect(signer1).updateDeveloper(signer1.address, "500")
            ).to.be.revertedWith("You are not a developer of this Staker.");
        });

        it('Reverts: Can not increase share', async function () {
            await staker.connect(owner).addDeveloper(deployer.address, "1000");

            await expect(
                staker.connect(deployer).updateDeveloper(deployer.address, "1500")
            ).to.be.revertedWith("You cannot increase your developer share.");
        });

        it('should update developer', async function () {
            await staker.connect(owner).addDeveloper(deployer.address, "1000");
            await staker.connect(deployer).updateDeveloper(deployer.address, "900");

            await expect(
                await staker.connect(deployer).developerShares(deployer.address)
            ).to.be.equal("900");
        });

        it('should return developers count', async function () {
            await staker.connect(owner).addDeveloper(deployer.address, "1000");
            await staker.connect(owner).addDeveloper(signer1.address, "900");
       

            await expect(
                await staker.connect(deployer).getDeveloperCount()
            ).to.be.equal("2");
        });
    });

    describe("setEmissions, lockTokenEmissions", function () {
        it('Reverts: alteration of token emissions is locked', async function () {
            await staker.connect(owner).lockTokenEmissions();

            await expect(
                staker.connect(owner).setEmissions([
                    {  blockNumber: await (await ethers.provider.getBlock()).number,  rate: 5 }
                ],[
                    {  blockNumber: await (await ethers.provider.getBlock()).number,  rate: 5 }
                ])
            ).to.be.revertedWith("This Staker has locked the alteration of token emissions.");
        });

        it('Reverts: alteration of point emissions is locked', async function () {
            await staker.connect(owner).lockPointEmissions();

            await expect(
                staker.connect(owner).setEmissions([
                    {  blockNumber: await (await ethers.provider.getBlock()).number,  rate: 5 }
                ],[
                    {  blockNumber: await (await ethers.provider.getBlock()).number,  rate: 5 }
                ])
            ).to.be.revertedWith("his Staker has locked the alteration of point emissions.");
        });

        it('Reverts: token emission schedule must be set', async function () {
            await expect(
                staker.connect(owner).setEmissions([],[])
            ).to.be.revertedWith("You must set the token emission schedule.");
        });

        it('Reverts: point emission schedule must be set', async function () {
            await expect(
                staker.connect(owner).setEmissions([
                    {  blockNumber: await (await ethers.provider.getBlock()).number, rate: 5 }
                ],[])
            ).to.be.revertedWith("You must set the point emission schedule.");
        });

        it('should set emissions', async function () {
            await staker.connect(owner).setEmissions([
                { blockNumber: await (await ethers.provider.getBlock()).number, rate: 5 }
            ],[
                { blockNumber: await (await ethers.provider.getBlock()).number, rate: 5 }
            ]);
        });

        it('should set emissions of staker where earliestTokenEmission/earliestPointEmission blocks are less', async function () {
            await staker.connect(owner).setEmissions([
                {  blockNumber: await (await ethers.provider.getBlock()).number,  rate: 5 }
            ],[
                {  blockNumber: await (await ethers.provider.getBlock()).number,  rate: 5 }
            ]);

            // Mine new blocks so that the earliestTokenEmission/EarliestPointEmission blocks are less
            await ethers.provider.send("evm_increaseTime", [70]);
            await ethers.provider.send("evm_mine", []);

            await staker.connect(owner).setEmissions([
                {  blockNumber: await (await ethers.provider.getBlock()).number,  rate: 5 }
            ],[
                {  blockNumber: await (await ethers.provider.getBlock()).number,  rate: 5 }
            ]);
        });
    });

    describe("addPool, overwrite pool, getPoolCount", function () {
        it('Reverts: emission schedule not defined', async function () {
            await expect(
                staker.connect(owner).addPool(
                    depositToken.address,
                    1,
                    1
                )
            ).to.be.revertedWith("Staking pools cannot be addded until an emission schedule has been defined.");
        });

        it('should add a new pool, overwrite it and get pool count', async function () {
            // Set emission
            await staker.connect(owner).setEmissions([
                {  blockNumber: await (await ethers.provider.getBlock()).number,  rate: 5 }
            ],[
                {  blockNumber: await (await ethers.provider.getBlock()).number,  rate: 5 }
            ]);

            // Create new pool
            await staker.connect(owner).addPool(
                    depositToken.address,
                    1,
                    1
                );

            await expect(
                await (await staker.connect(owner).poolInfo(depositToken.address)).tokenStrength
            ).to.be.equal("1");

            // Update the pool with 2x the strength
            await staker.connect(owner).addPool(
                depositToken.address,
                2,
                2
            );

            await expect(
                await (await staker.connect(owner).poolInfo(depositToken.address)).tokenStrength
            ).to.be.equal("2");

            // Get Pool count
            await expect(
                await staker.connect(owner).getPoolCount()
            ).to.be.equal("1");
        });
    });

    describe("deposit, withdraw, getRemainingToken", function () {
        it('Reverts: Inactive pool', async function () {
            await expect(
                staker.connect(signer1).deposit(depositToken.address, ethers.utils.parseEther("100"))
            ).to.be.revertedWith("You cannot deposit assets into an inactive pool.");
        });

        it('should deposit and Return at updatePool: block.number <= pool.lastRewardBlock, new block not mined', async function () {
            // Set emission such that new block after the lastRewardBlock hasn't been mined
            // And this makes the pool 'not update' because the blocks mining hasn't reached the emission block
            // It can also be thought of stopping hackers to mine blocks in advance
            await staker.connect(owner).setEmissions([
                {  blockNumber: (await (await ethers.provider.getBlock()).number) + 100, rate: 5 } // Increasing the last reward block by 100
            ],[
                {  blockNumber: (await (await ethers.provider.getBlock()).number) + 100, rate: 5 }
            ]);

            // Create new pool
            await staker.connect(owner).addPool(
                    depositToken.address,
                    1,
                    1
                );

            // Give the signer some mockERC20 tokens
            await depositToken.connect(deployer).transfer(signer1.address, ethers.utils.parseEther("1000"));
            
            // Signer approves staker contract
            await depositToken.connect(signer1).approve(staker.address, ethers.utils.parseEther("100"));

            // Signer deposits the tokens
            await staker.connect(signer1).deposit(depositToken.address, ethers.utils.parseEther("100"));
        });
        
        it('should deposit and Return at updatePool: poolTokenSupply <= 0', async function () {
            // Set Emission rate to current block number
            await staker.connect(owner).setEmissions([
                {  blockNumber: await (await ethers.provider.getBlock()).number, rate: 5 }
            ],[
                {  blockNumber: await (await ethers.provider.getBlock()).number, rate: 5 }
            ]);

            // Create new pool
            await staker.connect(owner).addPool(
                    depositToken.address,
                    1,
                    1
                );

            // Give the signer some mockERC20 tokens
            await depositToken.connect(deployer).transfer(signer1.address, ethers.utils.parseEther("1000"));
            
            // Signer approves staker contract
            await depositToken.connect(signer1).approve(staker.address, ethers.utils.parseEther("100"));

            // Signer deposits the tokens
            await staker.connect(signer1).deposit(depositToken.address, ethers.utils.parseEther("100"));
        });

        it('should deposit and withdraw amount of tokens in the pool, different from the rewardToken', async function () {
            // Set Emission rate to current block number
            await staker.connect(owner).setEmissions([
                {  blockNumber: await (await ethers.provider.getBlock()).number,  rate: 5 }
            ],[
                {  blockNumber: await (await ethers.provider.getBlock()).number,  rate: 5 }
            ]);

            // Create new pool
            await staker.connect(owner).addPool(
                    depositToken.address,
                    1,
                    1
                );

            // Let Signer2 be the developer
            await staker.connect(owner).addDeveloper(deployer.address, "2");

            // Give the signer some mockERC20 tokens
            await depositToken.connect(deployer).transfer(signer1.address, ethers.utils.parseEther("1000"));
            
            // Signer approves staker contract
            await depositToken.connect(signer1).approve(staker.address, ethers.utils.parseEther("200"));

            // Signer deposits the tokens
            await staker.connect(signer1).deposit(depositToken.address, ethers.utils.parseEther("100"));

            // Signer deposits some more tokens
            await staker.connect(signer1).deposit(depositToken.address, ethers.utils.parseEther("50"));

            // Withdraw deposited tokens
            await expect(
                staker.connect(signer1).withdraw(depositToken.address, ethers.utils.parseEther("200"))
            ).to.be.revertedWith("You cannot withdraw that much of the specified token; you are not owed it.");

            await staker.connect(signer1).withdraw(depositToken.address, ethers.utils.parseEther("140"));

            // Get remaining tokens
            await expect((
                await staker.connect(owner).getRemainingToken()).toString()
            ).to.be.equal("0");
        });

        it('should deposit and withdraw amount of tokens in the pool, same as the rewardToken', async function () {
            // Set Emission rate to current block number
            await staker.connect(owner).setEmissions([
                {  blockNumber: await (await ethers.provider.getBlock()).number,   rate: 5 }
            ],[
                {  blockNumber: await (await ethers.provider.getBlock()).number,   rate: 5 }
            ]);

            // Create new pool
            await staker.connect(owner).addPool(
                    rewardToken.address,
                    1,
                    1
                );

            // Let Signer2 be the developer
            await staker.connect(owner).addDeveloper(deployer.address, "2");

            // Give the signer some mockERC20 tokens
            await rewardToken.connect(deployer).transfer(signer1.address, ethers.utils.parseEther("1000"));
            
            // Signer approves staker contract
            await rewardToken.connect(signer1).approve(staker.address, ethers.utils.parseEther("200"));

            // Signer deposits the tokens
            await staker.connect(signer1).deposit(rewardToken.address, ethers.utils.parseEther("100"));

            // Signer deposits some more tokens
            await staker.connect(signer1).deposit(rewardToken.address, ethers.utils.parseEther("50"));

            // Withdraw deposited tokens
            await expect(
                staker.connect(signer1).withdraw(rewardToken.address, ethers.utils.parseEther("200"))
            ).to.be.revertedWith("You cannot withdraw that much of the specified token; you are not owed it.");

            await staker.connect(signer1).withdraw(rewardToken.address, ethers.utils.parseEther("140"));

             // Get remaining tokens
             await expect((
                await staker.connect(owner).getRemainingToken()).toString()
            ).to.be.equal(ethers.utils.parseEther("10"));    
        });
    });

    describe("getTotalEmittedTokens, getTotalEmittedPoints", function () {
        it('Reverts: tokens/points emission from higher block to lower block', async function () {
            // Set Emission rate to current block number
            await staker.connect(owner).setEmissions([
                {  blockNumber: await (await ethers.provider.getBlock()).number,  rate: 5 }
            ],[
                {  blockNumber: await (await ethers.provider.getBlock()).number,  rate: 5 }
            ]);

            await expect(
                staker.connect(signer1).getTotalEmittedTokens(await (await ethers.provider.getBlock()).number, 
                                                            (await (await ethers.provider.getBlock()).number) - 10)
            ).to.be.revertedWith("Tokens cannot be emitted from a higher block to a lower block.");

            await expect(
                staker.connect(signer1).getTotalEmittedPoints(await (await ethers.provider.getBlock()).number, 
                                                            (await (await ethers.provider.getBlock()).number) - 10)
            ).to.be.revertedWith("Points cannot be emitted from a higher block to a lower block.");
        });

        it('should get emitted tokens/points where _toBlock < emissionBlock', async function () {
            // Set Emission rate to current block number
            await staker.connect(owner).setEmissions([
				{ blockNumber: (await (await ethers.provider.getBlock()).number) +  5, rate: ethers.utils.parseEther('10')},
				{ blockNumber: (await (await ethers.provider.getBlock()).number) + 10, rate: ethers.utils.parseEther('5') },
				{ blockNumber: (await (await ethers.provider.getBlock()).number) + 15, rate: ethers.utils.parseEther('1') }
			], [
				{ blockNumber: (await (await ethers.provider.getBlock()).number) + 5,  rate: 100},
				{ blockNumber: (await (await ethers.provider.getBlock()).number) + 10, rate: 50 },
				{ blockNumber: (await (await ethers.provider.getBlock()).number) + 15, rate: 10 }
			]);

            for (let i = 0; i < 6; ++i) {
				ethers.provider.send('evm_mine');
			}

            let emissionTokens = await staker.connect(signer1).getTotalEmittedTokens(await (await ethers.provider.getBlock()).number, 
            (await (await ethers.provider.getBlock()).number) + 3);
            let emissionPoints = await staker.connect(signer1).getTotalEmittedPoints((await (await ethers.provider.getBlock()).number), 
            (await (await ethers.provider.getBlock()).number) + 3);

            await expect(emissionTokens).to.be.equal(ethers.utils.parseEther("30"));
            await expect(emissionPoints).to.be.equal("300");
        });

        it('should get emitted points where workingBlock < emissionBlock', async function () {
            // Set Emission rate to current block number
            await staker.connect(owner).setEmissions([
				{ blockNumber: (await (await ethers.provider.getBlock()).number) +  5, rate: ethers.utils.parseEther('10')},
				{ blockNumber: (await (await ethers.provider.getBlock()).number) + 10, rate: ethers.utils.parseEther('5') },
				{ blockNumber: (await (await ethers.provider.getBlock()).number) + 15, rate: ethers.utils.parseEther('1') }
			], [
				{ blockNumber: (await (await ethers.provider.getBlock()).number) + 5,  rate: 100},
				{ blockNumber: (await (await ethers.provider.getBlock()).number) + 10, rate: 50 },
				{ blockNumber: (await (await ethers.provider.getBlock()).number) + 15, rate: 10 }
			]);

            let emissionTokens = await staker.connect(signer1).getTotalEmittedTokens((await (await ethers.provider.getBlock()).number), 
            (await (await ethers.provider.getBlock()).number) + 2);
            let emissionPoints = await staker.connect(signer1).getTotalEmittedPoints((await (await ethers.provider.getBlock()).number), 
            (await (await ethers.provider.getBlock()).number) + 2);

            await expect(emissionTokens).to.be.equal(ethers.utils.parseEther("0"));
            await expect(emissionPoints).to.be.equal("0");
        });

        it('should get emitted tokens/points where workingBlock < _toBlock', async function () {
             // Set Emission rate to current block number
             await staker.connect(owner).setEmissions([
				{ blockNumber: (await (await ethers.provider.getBlock()).number), rate: ethers.utils.parseEther('10')},
			], [
				{ blockNumber: (await (await ethers.provider.getBlock()).number),  rate: 100},
			]);

            let emissionTokens = await staker.connect(signer1).getTotalEmittedTokens((await (await ethers.provider.getBlock()).number), 
            (await (await ethers.provider.getBlock()).number));    
            let emissionPoints = await staker.connect(signer1).getTotalEmittedPoints((await (await ethers.provider.getBlock()).number), 
            (await (await ethers.provider.getBlock()).number));                                                    
        });
    });

    describe("getPendingTokens, getPendingPoints, getAvailablePoints, getTotalPoints, approvePointSpender, spendPoints, getSpentPoints, sweep", function () {
        it('should get pending tokens and pending points when pool token is the disburse token', async function () {
            // Set Emission rate to current block number
            await staker.connect(owner).setEmissions([
				{ blockNumber: 1000, rate: ethers.utils.parseEther('10') },
				{ blockNumber: 1010, rate: ethers.utils.parseEther('5') },
				{ blockNumber: 1020, rate: ethers.utils.parseEther('1') }
			], [
				{ blockNumber: 1000, rate: 100 },
				{ blockNumber: 1010, rate: 50 },
				{ blockNumber: 1020, rate: 10 }
			]);
			await staker.connect(owner).addPool(rewardToken.address, 100, 50);

            // Mine up to a preconfigured point for deposits.
			let blockNumber = await ethers.provider.getBlockNumber();
			let blocksToMine = 998 - blockNumber;

			for (let i = 0; i < blocksToMine; ++i) {
				ethers.provider.send('evm_mine');
			}

            // Give the signer some mockERC20 tokens
            await rewardToken.connect(deployer).transfer(signer1.address, ethers.utils.parseEther("10"));

            // Give staker contract some mockERC20 tokens
            await rewardToken.connect(deployer).transfer(staker.address, ethers.utils.parseEther("100"));
            
            // Signer approves staker contract
            await rewardToken.connect(signer1).approve(staker.address, ethers.utils.parseEther("10"));
           
            // Signer deposits the tokens
            await staker.connect(signer1).deposit(rewardToken.address, ethers.utils.parseEther("10"));

            // Get Pending Tokens
            await expect((
                await staker.connect(owner).getPendingTokens(rewardToken.address, signer1.address)).toString()
            ).to.be.equal("0");
            await expect((
                await staker.connect(owner).getPendingPoints(rewardToken.address, signer1.address)).toString()
            ).to.be.equal("0");

            // Jump forward and travel in time through the portal
            for (let i = 0; i < 25; ++i) {
				ethers.provider.send('evm_mine');
			}

            // Get Pending Tokens
            await expect((
                await staker.connect(owner).getPendingTokens(rewardToken.address, signer1.address)).toString()
            ).not.to.be.equal("0");
            await expect((
                await staker.connect(owner).getPendingPoints(rewardToken.address, signer1.address)).toString()
            ).not.to.be.equal("0");

        });

        it('should get pending tokens/points when pool token is not disburse token. Should getAvailablePoints, getTotalPoints, approvePointSpender, spendPoints, getSpentPoints, sweep', async function () {
            // Set Emission rate to current block number
            await staker.connect(owner).setEmissions([
				{ blockNumber: 1000, rate: ethers.utils.parseEther('10') },
				{ blockNumber: 1010, rate: ethers.utils.parseEther('5') },
				{ blockNumber: 1020, rate: ethers.utils.parseEther('1') }
			], [
				{ blockNumber: 1000, rate: 100 },
				{ blockNumber: 1010, rate: 50 },
				{ blockNumber: 1020, rate: 10 }
			]);
			await staker.connect(owner).addPool(depositToken.address, 100, 50);

            // Mine up to a preconfigured point for deposits.
			let blockNumber = await ethers.provider.getBlockNumber();
			let blocksToMine = 998 - blockNumber;

			for (let i = 0; i < blocksToMine; ++i) {
				ethers.provider.send('evm_mine');
			}

            // Give the signer some mockERC20 tokens
            await depositToken.connect(deployer).transfer(signer1.address, ethers.utils.parseEther("10"));

            // Give staker contract some mockERC20 tokens
            await depositToken.connect(deployer).transfer(staker.address, ethers.utils.parseEther("100"));
            
            // Signer approves staker contract
            await depositToken.connect(signer1).approve(staker.address, ethers.utils.parseEther("10"));
           
            // Signer deposits the tokens
            await staker.connect(signer1).deposit(depositToken.address, ethers.utils.parseEther("10"));

            // Get Pending Tokens
            await expect((
                await staker.connect(owner).getPendingTokens(depositToken.address, signer1.address)).toString()
            ).to.be.equal("0");
            await expect((
                await staker.connect(owner).getPendingPoints(depositToken.address, signer1.address)).toString()
            ).to.be.equal("0");

            // Jump forward and travel in time through the portal
            for (let i = 0; i < 25; ++i) {
				ethers.provider.send('evm_mine');
			}

            // Has pending tokens
            await expect((
                await staker.connect(owner).getPendingTokens(depositToken.address, signer1.address)).toString()
            ).not.to.be.equal("0");
            await expect((
                await staker.connect(owner).getPendingPoints(depositToken.address, signer1.address)).toString()
            ).not.to.be.equal("0");

            // Has available points
            await expect(
                await staker.connect(signer1).getAvailablePoints(signer1.address)
                ).not.to.be.equal("0");
            await expect(
                await staker.connect(signer1).getTotalPoints(signer1.address)
                ).not.to.be.equal("0");

            // Signer2 tries to spend points without approval
            await expect(
                staker.connect(signer2).spendPoints(signer1.address, 5)
                ).to.be.revertedWith("You are not permitted to spend user points.");

            // Approve signer2 as point spender
            await staker.connect(owner).approvePointSpender(signer2.address, true);
            await expect(
                await staker.approvedPointSpenders(signer2.address)).to.be.equal(true);

            // Signer2 spends points more than available
            await expect(
                staker.connect(signer2).spendPoints(signer1.address, 100)
                ).to.be.revertedWith("The user does not have enough points to spend the requested amount.");

            // Signer2 spends correct amount
            await staker.connect(signer2).spendPoints(signer1.address, 2);

            // Get points spent
            await expect(
                await staker.getSpentPoints(signer1.address)
            ).to.be.equal(2);

            // Sweep all specific tokens back
            await rewardToken.connect(deployer).transfer(staker.address, ethers.utils.parseEther("10"));

            await expect(
                await rewardToken.balanceOf(staker.address)
            ).not.to.be.equal("0");
            
            await staker.connect(owner).sweep(rewardToken.address);

            await expect(
                await rewardToken.balanceOf(staker.address)
            ).to.be.equal("0");
        });
    });
});