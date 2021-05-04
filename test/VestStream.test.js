'use strict';

// Imports.
import { network, ethers } from 'hardhat';
import { expect } from 'chai';
import 'chai/register-should';

// Test the VestStream contract's ability to create and run token claims.
describe('VestStream', function () {
	let alice, bob, minter;
	let Token, VestStream;
	before(async () => {
		const signers = await ethers.getSigners();
		const addresses = await Promise.all(signers.map(async signer => signer.getAddress()));
		alice = { provider: signers[0].provider, signer: signers[0], address: addresses[0] };
		bob = { provider: signers[1].provider, signer: signers[1], address: addresses[1] };
		minter = { provider: signers[4].provider, signer: signers[4], address: addresses[4] };

		// Create factories for deploying all required contracts using specified signers.
		Token = await ethers.getContractFactory('Token');
		VestStream = await ethers.getContractFactory('VestStream');
	});

	// Deploy a fresh set of smart contracts for testing with.
	let token, vestStream;
	let currentTime;
	beforeEach(async () => {
		token = await Token.connect(minter.signer).deploy('Token', 'TOK', ethers.utils.parseEther('1000000000'));
		await token.deployed();
		vestStream = await VestStream.connect(minter.signer).deploy(token.address);
		await vestStream.deployed();
		currentTime = Math.floor(Date.now() / 1000);

		// Mint test tokens and send them to the vesting contract.
		await token.connect(minter.signer).mint(vestStream.address, ethers.utils.parseEther('1000000000'));
	});

	// Verify that the vesting owner can create a claim.
	it('should allow the vesting owner to create a claim', async () => {
		await vestStream.connect(minter.signer).createClaim([ alice.address ], [ ethers.utils.parseEther('10000') ], currentTime + 60, currentTime + 120);
		let claim = await vestStream.getClaim(alice.address);
		claim.totalAmount.should.be.equal(ethers.utils.parseEther('10000'));
	});

	// Verify that a non-owner may not create a claim.
	it('should not allow non-owners to create a claim', async () => {
		await expect(
			vestStream.connect(bob.signer).createClaim([ alice.address ], [ ethers.utils.parseEther('10000') ], currentTime + 60, currentTime + 120)
		).to.be.revertedWith('Ownable: caller is not the owner');
	});

	// Verify that a claim cannot be created with no beneficiary.
	it('should revert with empty beneficiaries', async () => {
		await expect(
			vestStream.connect(minter.signer).createClaim([ ], [ ], currentTime + 60, currentTime + 120)
		).to.be.revertedWith('You must specify at least one beneficiary for a claim.');
	});

	// Verify that beneficiary and balance param lengths match
	it('should revert on parameter length mismatch', async () => {
		await expect(
			vestStream.connect(minter.signer).createClaim([ alice.address, bob.address ], [ ethers.utils.parseEther('10000') ], currentTime + 60, currentTime + 120)
		).to.be.revertedWith('Beneficiaries and their amounts may not be mismatched.');
	});

	// Verify that claims for zero cannot be created
	it('should revert with zero token claims', async () => {
		await expect(
			vestStream.connect(minter.signer).createClaim([ alice.address ], [ 0 ], currentTime + 60, currentTime + 120)
		).to.be.revertedWith('You may not create a zero-token claim.');
	});

	// Verify that a claim cannot be created which ends before it starts.
	it('should revert with temporally-impossible claims', async () => {
		await expect(
			vestStream.connect(minter.signer).createClaim([ alice.address ], [ ethers.utils.parseEther('10000') ], currentTime - 120, currentTime - 240)
		).to.be.revertedWith('You may not create a claim which ends before it starts.');
	});

	// Verify that claims must start in the future.
	it('should revert with claims that have already started', async () => {
		await expect(
			vestStream.connect(minter.signer).createClaim([ alice.address ], [ ethers.utils.parseEther('10000') ], currentTime - 240, currentTime + 120)
		).to.be.revertedWith('Claim start time must be in the future.');
	});

	// Verify that no claims are for the zero address.
	it('should revert with zero address beneficiaries', async () => {
		await expect(
			vestStream.connect(minter.signer).createClaim([ ethers.constants.AddressZero ], [ ethers.utils.parseEther('10000') ], currentTime + 60, currentTime + 120)
		).to.be.revertedWith('The zero address may not be a beneficiary.');
	});

	// Verify that no claim can be queried for the zero address.
	it('should revert when checking zero address claim', async () => {
		await expect(
			vestStream.connect(minter.signer).getClaim(ethers.constants.AddressZero)
		).to.be.revertedWith('The zero address may not be a claim beneficiary.');
	});

	// Test user claims.
	describe('-> After creation of claim ...', function () {
		beforeEach(async () => {
			const currentBlock = await ethers.provider.getBlockNumber();
			const block = await ethers.provider.getBlock(currentBlock);
			currentTime = block.timestamp;
			await vestStream.connect(minter.signer).createClaim([ alice.address ], [ ethers.utils.parseEther('10000') ], currentTime + 60, currentTime + 120);
		});

		// Alice should be able to claim tokens.
		it('should allow users to claim their tokens', async () => {
			await network.provider.request({
				method: 'evm_setNextBlockTimestamp',
				params: [ currentTime + 120 ]
			});
			await minter.provider.send('evm_mine');
			await vestStream.connect(alice.signer).claim(alice.address);
			let aliceBalance = await token.balanceOf(alice.address);
			aliceBalance.should.be.equal(ethers.utils.parseEther('10000'));
		});

		// Verify that we revert on completed claims.
		it('should revert on completed claims', async () => {
			await network.provider.request({
				method: 'evm_setNextBlockTimestamp',
				params: [ currentTime + 120 ]
			});
			await minter.provider.send('evm_mine');
			await vestStream.connect(alice.signer).claim(alice.address);
			let aliceBalance = await token.balanceOf(alice.address);
			aliceBalance.should.be.equal(ethers.utils.parseEther('10000'));
			await expect(
				vestStream.connect(alice.signer).claim(alice.address)
			).to.be.revertedWith('This claim has already been completely claimed.');
		});

		// We should be able to query Alice's claimable amount.
		it('should allow querying a user claim', async () => {
			await network.provider.request({
				method: 'evm_setNextBlockTimestamp',
				params: [ currentTime + 120 ]
			});
			await minter.provider.send('evm_mine');
			let aliceAmount = await vestStream.connect(alice.signer).claimableAmount(alice.address);
			aliceAmount.should.be.equal(ethers.utils.parseEther('10000'));
		});

		// Verify that a non-claimant has a zero claimable amount.
		it('should find zero claim for users with no claim', async () => {
			let bobClaim = await vestStream.connect(alice.signer).claimableAmount(bob.address);
			bobClaim.should.be.equal(0);
		});

		// Verify that a claim which hasn't started yet is zero.
		it('should find zero claim for unstarted claims', async () => {
			await vestStream.connect(minter.signer).createClaim([ bob.address ], [ ethers.utils.parseEther('10000') ], currentTime + 60, currentTime + 120);
			await network.provider.request({
				method: 'evm_setNextBlockTimestamp',
				params: [ currentTime + 30 ]
			});
			let bobClaimable = await vestStream.connect(alice.signer).claimableAmount(bob.address);
			bobClaimable.should.be.equal(0);
		});
	});
});
