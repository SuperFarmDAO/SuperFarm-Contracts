'use strict';

// Imports.
import { ethers } from 'hardhat';
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
		MultiSigWallet = await ethers.getContractFactory('MultiSigWallet');
		Timelock = await ethers.getContractFactory('Timelock');
		TokenVault = await ethers.getContractFactory('TokenVault');
	});

	// Deploy a fresh set of smart contracts for testing with.
	let token, multiSig, timeLock, tokenVault;
	beforeEach(async () => {
		token = await Token.connect(alice.signer).deploy('Token', 'TOK', ethers.utils.parseEther('1000000000'));
		await token.deployed();
		multiSig = await MultiSigWallet.connect(alice.signer).deploy([ alice.address, bob.address, carol.address ], 2);
		await multiSig.deployed();
		timeLock = await Timelock.connect(alice.signer).deploy(multiSig.address, '172800');
		await timeLock.deployed();
		tokenVault = await TokenVault.connect(alice.signer).deploy('Vault One', token.address, multiSig.address, multiSig.address, 3);
		await tokenVault.deployed();
		await tokenVault.connect(alice.signer).transferOwnership(timeLock.address);
		await token.connect(alice.signer).mint(tokenVault.address, ethers.utils.parseEther('1000000000'));
	});

	// Verify that the multisignature wallet can send tokens from the vault.
	it('should allow the multisig to send tokens via timelock', async () => {
		let devBalance = await token.balanceOf(dev.address);
		devBalance.should.be.equal(0);

		// Generate the raw transaction for releasing tokens from the vault.
		let releaseTokenTransaction = await tokenVault.populateTransaction.sendTokens([ dev.address ], [ ethers.utils.parseEther('1000000') ]);

		// Generate the raw transaction for enqueuing token release with the time lock.
		let enqueueTransaction = await timeLock.populateTransaction.queueTransaction(tokenVault.address, ethers.utils.parseEther('0'), '', releaseTokenTransaction.data, Math.floor(Date.now() / 1000) + 180000);

		// Generate the raw transaction for executing token release with the time lock.
		let executeTransaction = await timeLock.populateTransaction.executeTransaction(tokenVault.address, ethers.utils.parseEther('0'), '', releaseTokenTransaction.data, Math.floor(Date.now() / 1000) + 180000);

		// Submit the token release transaction with the first multisigner.
		await multiSig.connect(alice.signer).submitTransaction(timeLock.address, ethers.utils.parseEther('0'), enqueueTransaction.data);
		let transactionData = await multiSig.transactions(0);
		transactionData.destination.should.be.equal(timeLock.address);
		transactionData.value.should.be.equal(ethers.utils.parseEther('0'));
		transactionData.data.should.be.equal(enqueueTransaction.data);
		transactionData.executed.should.be.equal(false);
		let aliceConfirmation = await multiSig.confirmations(0, alice.address);
		aliceConfirmation.should.be.equal(true);

		// Confirm the token release transaction with the second multisigner.
		let confirmationTransaction = await multiSig.connect(bob.signer).confirmTransaction(0);
		let confirmationReceipt = await confirmationTransaction.wait();
		let executionEvent = confirmationReceipt.events[confirmationReceipt.events.length - 1];
		executionEvent.event.should.be.equal('Execution');
		transactionData = await multiSig.transactions(0);
		transactionData.destination.should.be.equal(timeLock.address);
		transactionData.value.should.be.equal(ethers.utils.parseEther('0'));
		transactionData.data.should.be.equal(enqueueTransaction.data);
		transactionData.executed.should.be.equal(true);
		let bobConfirmation = await multiSig.confirmations(0, bob.address);
		bobConfirmation.should.be.equal(true);

		// Confirm that the tokens have not been sent yet.
		devBalance = await token.balanceOf(dev.address);
		devBalance.should.be.equal(0);

		// Submit the token release execution transaction with the first multisigner.
		await multiSig.connect(alice.signer).submitTransaction(timeLock.address, ethers.utils.parseEther('0'), executeTransaction.data);
		transactionData = await multiSig.transactions(1);
		transactionData.destination.should.be.equal(timeLock.address);
		transactionData.value.should.be.equal(ethers.utils.parseEther('0'));
		transactionData.data.should.be.equal(executeTransaction.data);
		transactionData.executed.should.be.equal(false);
		aliceConfirmation = await multiSig.confirmations(1, alice.address);
		aliceConfirmation.should.be.equal(true);

		// Confirm that the time lock may not be executed prematurely.
		confirmationTransaction = await multiSig.connect(bob.signer).confirmTransaction(1);
		confirmationReceipt = await confirmationTransaction.wait();
		executionEvent = confirmationReceipt.events[confirmationReceipt.events.length - 1];
		executionEvent.event.should.be.equal('ExecutionFailure');
		transactionData = await multiSig.transactions(1);
		transactionData.destination.should.be.equal(timeLock.address);
		transactionData.value.should.be.equal(ethers.utils.parseEther('0'));
		transactionData.data.should.be.equal(executeTransaction.data);
		transactionData.executed.should.be.equal(false);
		bobConfirmation = await multiSig.confirmations(1, bob.address);
		bobConfirmation.should.be.equal(true);

		// Wait for the time lock to mature.
		ethers.provider.send('evm_increaseTime', [ 190000 ]);

		// Reset the second multisig holder's confirmation.
		await multiSig.connect(bob.signer).revokeConfirmation(1);

		// Confirm that the time lock may now be executed.
		confirmationTransaction = await multiSig.connect(bob.signer).confirmTransaction(1);
		confirmationReceipt = await confirmationTransaction.wait();
		executionEvent = confirmationReceipt.events[confirmationReceipt.events.length - 1];
		executionEvent.event.should.be.equal('Execution');
		transactionData = await multiSig.transactions(1);
		transactionData.destination.should.be.equal(timeLock.address);
		transactionData.value.should.be.equal(ethers.utils.parseEther('0'));
		transactionData.data.should.be.equal(executeTransaction.data);
		transactionData.executed.should.be.equal(true);
		bobConfirmation = await multiSig.confirmations(1, bob.address);
		bobConfirmation.should.be.equal(true);

		// Confirm that the tokens have been sent.
		devBalance = await token.balanceOf(dev.address);
		devBalance.should.be.equal(ethers.utils.parseEther('1000000'));
	});
});
