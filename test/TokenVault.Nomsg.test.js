'use strict';

// Imports.
import { ethers } from 'hardhat';
import { expect } from 'chai';

import 'chai/register-should';

// Test the TokenVault with Timelock and MultiSigWallet functionality.
describe('TokenVault', function () {
	let alice, bob, carol, dev;
	let Token, MultiSigWallet, Timelock, TokenVault;
	before(async () => {
		const signers = await ethers.getSigners();
		const addresses = await Promise.all(signers.map(async signer => signer.getAddress()));
		alice = { provider: signers[0].provider, signer: signers[0], address: addresses[0] };
		bob = { provider: signers[1].provider, signer: signers[1], address: addresses[1] };
		carol = { provider: signers[2].provider, signer: signers[2], address: addresses[2] };
		dev = { provider: signers[3].provider, signer: signers[3], address: addresses[3] };

		// Create factories for deploying all required contracts using specified signers.
		Token = await ethers.getContractFactory('Token');
		TokenVault = await ethers.getContractFactory('TokenVault');
	});

	// Deploy a fresh set of smart contracts for testing with.
	let token, multiSig, timeLock, tokenVault;
	beforeEach(async () => {
		token = await Token.connect(alice.signer).deploy('Token', 'TOK', ethers.utils.parseEther('1000000000'));
		await token.deployed();
		tokenVault = await TokenVault.connect(alice.signer).deploy('Vault One', token.address, bob.address, carol.address, 3);
        await tokenVault.deployed();
		await token.connect(alice.signer).mint(tokenVault.address, ethers.utils.parseEther('1000000000'));
	});

	// Verify that the multisignature wallet can send tokens from the vault.
	it('should update panic data', async () => {
        await tokenVault.changePanicDetails(carol.address, bob.address);

        await tokenVault.lock();

        try {
            await tokenVault.changePanicDetails(carol.address, bob.address);
        } catch (error) {
            expect(error.message).to.include("You cannot change panic details on a vault which is locked.")
        }
	});
    it('should send tokens', async () => {
        await tokenVault.sendTokens([alice.address], [ethers.utils.parseEther('1000')]);

        let balance = await token.balanceOf(alice.address);

        expect(balance.toString()).to.equal(ethers.utils.parseEther('1000'));
	});

    it('PANIC', async () => {
        let panicOwner = await tokenVault.panicOwner();
        await tokenVault.connect(bob.signer).panic();

        let panicBalance = await token.balanceOf(carol.address);

        expect(panicBalance.toString()).to.equal(ethers.utils.parseEther('1000000000'));
	});
});
