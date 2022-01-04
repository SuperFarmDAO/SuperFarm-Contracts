'use strict';

// Imports.
import { ethers } from 'hardhat';
import { expect } from 'chai';
import 'chai/register-should';

// Test the Staker contract's ability to function with generic assets.
describe('StakerReader', function () {
	let alice, bob, carol, minter;
	let Token, Token2, Staker, StakerReader;
	before(async () => {
		const signers = await ethers.getSigners();
		const addresses = await Promise.all(signers.map(async signer => signer.getAddress()));
		alice = { provider: signers[0].provider, signer: signers[0], address: addresses[0] };
		bob = { provider: signers[1].provider, signer: signers[1], address: addresses[1] };
		carol = { provider: signers[2].provider, signer: signers[2], address: addresses[2] };
		minter = { provider: signers[4].provider, signer: signers[4], address: addresses[4] };

		// Create factories for deploying all required contracts using specified signers.
		Token = await ethers.getContractFactory('Token');
        Token2 = await ethers.getContractFactory('MockERC20')
		Staker = await ethers.getContractFactory('Staker');
		StakerReader = await ethers.getContractFactory('StakerReader');
	});

	// Deploy a fresh set of smart contracts for testing with.
	let token, token2, staker, stakerReader;
	beforeEach(async () => {
		token = await Token.connect(minter.signer).deploy('Token', 'TOK', ethers.utils.parseEther('1000000000'));
		await token.deployed();
        token2 = await Token2.connect(minter.signer).deploy();
        await token2.deployed()
		staker = await Staker.connect(alice.signer).deploy('Staker', token.address);
		await staker.deployed();
		stakerReader = await StakerReader.connect(alice.signer).deploy();
		await stakerReader.deployed();

		// Mint test tokens and send them to the Staker.
		await token.connect(minter.signer).mint(minter.address, ethers.utils.parseEther('1000000000'));
        await token2.connect(minter.signer).transfer(staker.address, ethers.utils.parseEther('1000000'));
		await token2.connect(minter.signer).transfer(alice.address, ethers.utils.parseEther('1000000'));
		await token2.connect(minter.signer).transfer(bob.address, ethers.utils.parseEther('1000000'));
		await token2.connect(minter.signer).transfer(carol.address, ethers.utils.parseEther('1000000'));
	});

	// Verify that the StakerReader works.
	it('should be able to read data from a Staker', async () => {

		// Callers must approve the Staker to spend their test tokens.
		await token2.connect(alice.signer).approve(staker.address, ethers.utils.parseEther('100000000000000'));
		await token2.connect(bob.signer).approve(staker.address, ethers.utils.parseEther('100000000000000'));
		await token2.connect(carol.signer).approve(staker.address, ethers.utils.parseEther('100000000000000'));

		// Establish the emissions schedule and add the token pool.
		await staker.connect(alice.signer).setEmissions([
			{ timeStamp: 1000, rate: ethers.utils.parseEther('10') },
			{ timeStamp: 1010, rate: ethers.utils.parseEther('5') },
			{ timeStamp: 1020, rate: ethers.utils.parseEther('1') }
		], [
			{ timeStamp: 1000, rate: 100 },
			{ timeStamp: 1010, rate: 50 },
			{ timeStamp: 1020, rate: 10 }
		]);
		await staker.connect(alice.signer).addPool(token2.address, 100, 50);

		await staker.connect(alice.signer).deposit(token2.address, ethers.utils.parseEther('1000'));
		let stakerInformation = await stakerReader.connect(bob.signer).getFarmData(alice.address, staker.address, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');
		console.log(stakerInformation);
	});
});
