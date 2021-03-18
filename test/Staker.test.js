'use strict';

// Imports.
import { ethers } from 'hardhat';
import { expect } from 'chai';
import 'chai/register-should';

// Test the Staker contract's ability to function with generic assets.
describe('Staker', function () {
	let alice, bob, carol, minter;
	let Token, Staker;
	before(async () => {
		const signers = await ethers.getSigners();
		const addresses = await Promise.all(signers.map(async signer => signer.getAddress()));
		alice = { provider: signers[0].provider, signer: signers[0], address: addresses[0] };
		bob = { provider: signers[1].provider, signer: signers[1], address: addresses[1] };
		carol = { provider: signers[2].provider, signer: signers[2], address: addresses[2] };
		minter = { provider: signers[4].provider, signer: signers[4], address: addresses[4] };

		// Create factories for deploying all required contracts using specified signers.
		Token = await ethers.getContractFactory('Token');
		Staker = await ethers.getContractFactory('Staker');
	});

	// Deploy a fresh set of smart contracts for testing with.
	let token, staker;
	beforeEach(async () => {
		token = await Token.connect(minter.signer).deploy('Token', 'TOK', ethers.utils.parseEther('1000000000'));
		await token.deployed();
		staker = await Staker.connect(alice.signer).deploy('Staker', token.address);
		await staker.deployed();

		// Mint test tokens and send them to the Staker.
		await token.connect(minter.signer).mint(minter.address, ethers.utils.parseEther('1000000000'));
		await token.connect(minter.signer).transfer(staker.address, ethers.utils.parseEther('1000000000'));
	});

	// Verify that the Staker starts with the correct amount of granted token.
	it('should have the expected amount of granted token', async () => {
		let stakerBalance = await staker.getRemainingToken();
		stakerBalance.should.be.equal(ethers.utils.parseEther('1000000000'));
	});

	// Verify that pools can only be added after defining an emission schedule.
	it('can only add a pool after defining the emission schedule', async () => {
		await expect(
			staker.connect(alice.signer).addPool(token.address, 100, 100)
		).to.be.revertedWith('Staking pools cannot be addded until an emission schedule has been defined.');
		await staker.connect(alice.signer).setEmissions([
			{ blockNumber: 0, rate: 10 },
			{ blockNumber: 10, rate: 5 },
			{ blockNumber: 20, rate: 1 }
		], [
			{ blockNumber: 0, rate: 10 },
			{ blockNumber: 10, rate: 5 },
			{ blockNumber: 20, rate: 1 }
		]);
		await staker.connect(alice.signer).addPool(token.address, 100, 100);
	});

	// Perform operations on the Staker with an emission schedule defined and a pool added.
	describe('-> After initialization of emission schedule ...', function () {
		beforeEach(async () => {
			token = await Token.connect(minter.signer).deploy('Token', 'TOK', ethers.utils.parseEther('1000000000'));
			await token.deployed();
			staker = await Staker.connect(alice.signer).deploy('Staker', token.address);
			await staker.deployed();

			// Mint test tokens and send them to the Staker, Bob, and Carol.
			await token.connect(minter.signer).mint(minter.address, ethers.utils.parseEther('1000000000'));
			await token.connect(minter.signer).transfer(staker.address, ethers.utils.parseEther('900000000'));
			await token.connect(minter.signer).transfer(bob.address, ethers.utils.parseEther('50000000'));
			await token.connect(minter.signer).transfer(carol.address, ethers.utils.parseEther('50000000'));

			// Bob and Carol must approve the Staker to spend their test tokens.
			await token.connect(bob.signer).approve(staker.address, ethers.utils.parseEther('1000000000'));
			await token.connect(carol.signer).approve(staker.address, ethers.utils.parseEther('1000000000'));

			// Establish the emissions schedule and add the token pool.
			await staker.connect(alice.signer).setEmissions([
				{ blockNumber: 1000, rate: ethers.utils.parseEther('10') },
				{ blockNumber: 1010, rate: ethers.utils.parseEther('5') },
				{ blockNumber: 1020, rate: ethers.utils.parseEther('1') }
			], [
				{ blockNumber: 1000, rate: 100 },
				{ blockNumber: 1010, rate: 50 },
				{ blockNumber: 1020, rate: 10 }
			]);
			await staker.connect(alice.signer).addPool(token.address, 100, 50);
		});

		// Verify that users can deposit tokens.
		it('should allow users to deposit tokens', async () => {
			let bobBalance = await token.balanceOf(bob.address);
			let carolBalance = await token.balanceOf(carol.address);
			let stakerBalance = await token.balanceOf(staker.address);
			bobBalance.should.be.equal(ethers.utils.parseEther('50000000'));
			carolBalance.should.be.equal(ethers.utils.parseEther('50000000'));
			stakerBalance.should.be.equal(ethers.utils.parseEther('900000000'));
			await staker.connect(bob.signer).deposit(token.address, ethers.utils.parseEther('50000000'));
			await staker.connect(carol.signer).deposit(token.address, ethers.utils.parseEther('50000000'));
			bobBalance = await token.balanceOf(bob.address);
			carolBalance = await token.balanceOf(carol.address);
			stakerBalance = await token.balanceOf(staker.address);
			bobBalance.should.be.equal(ethers.utils.parseEther('0'));
			carolBalance.should.be.equal(ethers.utils.parseEther('0'));
			stakerBalance.should.be.equal(ethers.utils.parseEther('1000000000'));
		});

		// Verify that users can withdraw tokens.
		it('should allow users to withdraw deposited tokens', async () => {
			let bobBalance = await token.balanceOf(bob.address);
			let carolBalance = await token.balanceOf(carol.address);
			let stakerBalance = await token.balanceOf(staker.address);
			bobBalance.should.be.equal(ethers.utils.parseEther('50000000'));
			carolBalance.should.be.equal(ethers.utils.parseEther('50000000'));
			stakerBalance.should.be.equal(ethers.utils.parseEther('900000000'));
			await staker.connect(bob.signer).deposit(token.address, ethers.utils.parseEther('50000000'));
			await staker.connect(carol.signer).deposit(token.address, ethers.utils.parseEther('50000000'));
			bobBalance = await token.balanceOf(bob.address);
			carolBalance = await token.balanceOf(carol.address);
			stakerBalance = await token.balanceOf(staker.address);
			bobBalance.should.be.equal(ethers.utils.parseEther('0'));
			carolBalance.should.be.equal(ethers.utils.parseEther('0'));
			stakerBalance.should.be.equal(ethers.utils.parseEther('1000000000'));
			await staker.connect(bob.signer).withdraw(token.address, ethers.utils.parseEther('50000000'));
			await staker.connect(carol.signer).withdraw(token.address, ethers.utils.parseEther('50000000'));
			bobBalance = await token.balanceOf(bob.address);
			carolBalance = await token.balanceOf(carol.address);
			bobBalance.should.be.at.least(ethers.utils.parseEther('50000000'));
			carolBalance.should.be.at.least(ethers.utils.parseEther('50000000'));
		});

		// Verify that users correctly earn emitted tokens and points.
		it('should properly reward users for their stakes', async () => {
			let bobBalance = await token.balanceOf(bob.address);
			let carolBalance = await token.balanceOf(carol.address);
			let stakerBalance = await token.balanceOf(staker.address);
			bobBalance.should.be.equal(ethers.utils.parseEther('50000000'));
			carolBalance.should.be.equal(ethers.utils.parseEther('50000000'));
			stakerBalance.should.be.equal(ethers.utils.parseEther('900000000'));

			// Mine up to a preconfigured point for deposits.
			let blockNumber = await ethers.provider.getBlockNumber();
			let blocksToMine = 998 - blockNumber;
			for (let i = 0; i < blocksToMine; ++i) {
				ethers.provider.send('evm_mine');
			}
			await staker.connect(bob.signer).deposit(token.address, ethers.utils.parseEther('50000000'));
			await staker.connect(carol.signer).deposit(token.address, ethers.utils.parseEther('50000000'));
			bobBalance = await token.balanceOf(bob.address);
			carolBalance = await token.balanceOf(carol.address);
			stakerBalance = await token.balanceOf(staker.address);
			bobBalance.should.be.equal(ethers.utils.parseEther('0'));
			carolBalance.should.be.equal(ethers.utils.parseEther('0'));
			stakerBalance.should.be.equal(ethers.utils.parseEther('1000000000'));

			// Mine through the emission schedule and verify correct rewards.
			for (let i = 0; i < 25; ++i) {
				ethers.provider.send('evm_mine');
			}
			let totalEmittedPoints = await staker.connect(bob.signer).getTotalEmittedPoints(1000, 1025);
			totalEmittedPoints.should.be.equal(1550);
			let bobPendingTokens = await staker.connect(bob.signer).getPendingTokens(token.address, bob.address);
			bobPendingTokens.should.be.equal(ethers.utils.parseEther('77.5'));
			let carolPendingTokens = await staker.connect(carol.signer).getPendingTokens(token.address, carol.address);
			carolPendingTokens.should.be.equal(ethers.utils.parseEther('77.5'));
			let bobPoints = await staker.connect(bob.signer).getAvailablePoints(bob.address);
			bobPoints.should.be.equal(775);
			let bobTotalPoints = await staker.connect(bob.signer).getTotalPoints(bob.address);
			bobTotalPoints.should.be.equal(775);
			let bobSpentPoints = await staker.connect(bob.signer).getSpentPoints(bob.address);
			bobSpentPoints.should.be.equal(0);
			let carolPoints = await staker.connect(carol.signer).getAvailablePoints(carol.address);
			carolPoints.should.be.equal(775);
			let carolTotalPoints = await staker.connect(carol.signer).getTotalPoints(carol.address);
			carolTotalPoints.should.be.equal(775);
			let carolSpentPoints = await staker.connect(carol.signer).getSpentPoints(carol.address);
			carolSpentPoints.should.be.equal(0);

			// Check for correctness upon user withdrawal.
			await staker.connect(bob.signer).withdraw(token.address, ethers.utils.parseEther('50000000'));
			await staker.connect(carol.signer).withdraw(token.address, ethers.utils.parseEther('50000000'));
			bobBalance = await token.balanceOf(bob.address);
			carolBalance = await token.balanceOf(carol.address);
			bobBalance.should.be.equal(ethers.utils.parseEther('50000078'));
			carolBalance.should.be.equal(ethers.utils.parseEther('50000079'));
			bobPoints = await staker.connect(bob.signer).getAvailablePoints(bob.address);
			bobPoints.should.be.equal(780);
			bobTotalPoints = await staker.connect(bob.signer).getTotalPoints(bob.address);
			bobTotalPoints.should.be.equal(780);
			bobSpentPoints = await staker.connect(bob.signer).getSpentPoints(bob.address);
			bobSpentPoints.should.be.equal(0);
			carolPoints = await staker.connect(carol.signer).getAvailablePoints(carol.address);
			carolPoints.should.be.equal(790);
			carolTotalPoints = await staker.connect(carol.signer).getTotalPoints(carol.address);
			carolTotalPoints.should.be.equal(790);
			carolSpentPoints = await staker.connect(carol.signer).getSpentPoints(carol.address);
			carolSpentPoints.should.be.equal(0);
			bobPendingTokens = await staker.connect(bob.signer).getPendingTokens(token.address, bob.address);
			bobPendingTokens.should.be.equal(ethers.utils.parseEther('0'));
			carolPendingTokens = await staker.connect(carol.signer).getPendingTokens(token.address, carol.address);
			carolPendingTokens.should.be.equal(ethers.utils.parseEther('0'));
		});
	});
});
