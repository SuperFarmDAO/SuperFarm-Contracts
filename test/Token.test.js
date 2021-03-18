'use strict';

// Imports.
import { ethers } from 'hardhat';
import { expect } from 'chai';
import 'chai/register-should';

// Test the Token contract's ability to function as a proper capped ERC-20.
// Many of these test cases are ported from YAM and Sushi. Thanks!
describe('Token', function () {
	let alice, bob, carol, dev;
	let Token;
	before(async () => {
		const signers = await ethers.getSigners();
		const addresses = await Promise.all(signers.map(async signer => signer.getAddress()));
		alice = { provider: signers[0].provider, signer: signers[0], address: addresses[0] };
		bob = { provider: signers[1].provider, signer: signers[1], address: addresses[1] };
		carol = { provider: signers[2].provider, signer: signers[2], address: addresses[2] };
		dev = { provider: signers[3].provider, signer: signers[3], address: addresses[3] };

		// Create factories for deploying all required contracts using specified signers.
		Token = await ethers.getContractFactory('Token');
	});

	// Deploy a fresh set of smart contracts for testing with.
	let token;
	beforeEach(async () => {
		token = await Token.connect(alice.signer).deploy('Token', 'TOK', ethers.utils.parseEther('1000000000'));
		await token.deployed();
	});

	// Verify that the Token may mint up to its cap and no more.
	it('should mint only up to its cap', async () => {
		await token.connect(alice.signer).mint(alice.address, ethers.utils.parseEther('1000000000'));
		await expect(
			token.connect(alice.signer).mint(alice.address, 1)
		).to.be.revertedWith('ERC20Capped: cap exceeded');
	});

	// Verify that the Token can correctly delegate voting signatories.
	describe('* delegateBySig()', function () {
		it('should revert if the signatory is invalid', async () => {
			const delegatee = alice.address;
			const nonce = 0;
			const expiry = 0;
			await expect(
				token.connect(alice.signer).delegateBySig(delegatee, nonce, expiry, 0, '0xbad0bad0bad0bad0bad0bad0bad0bad0bad0bad0bad0bad0bad0bad0bad0bad0', '0xbad0bad0bad0bad0bad0bad0bad0bad0bad0bad0bad0bad0bad0bad0bad0bad0')
			).to.be.revertedWith('Invalid signature.');
		});

		// Verify that a correct nonce is required for signatories.
		it('should revert if the nonce is invalid', async () => {
			const delegatee = alice.address;
			const nonce = 1;
			const expiry = 0;
			const domain = {
				name: 'TOK',
				chainId: 1,
				verifyingContract: '0x4BC6657283f8f24e27EAc1D21D1deE566C534A9A'
			};
			const types = {
				Delegation: [
					{ name: 'delegatee', type: 'address' },
					{ name: 'nonce', type: 'uint256' },
					{ name: 'expiry', type: 'uint256' }
				]
			};
			const message = {
				delegatee: delegatee,
				nonce: nonce,
				expiry: expiry
			};
			let sigHash = await ethers.utils._TypedDataEncoder.encode(domain, types, message);
			const rawSig = await alice.signer.signMessage(sigHash);
			const sig = await ethers.utils.splitSignature(rawSig);
			await expect(
				token.connect(alice.signer).delegateBySig(delegatee, nonce, expiry, sig.v, sig.r, sig.s)
			).to.be.revertedWith('Invalid nonce.');
		});

		// Verify that an unexpired signature is required.
		it('should revert if the signature has expired', async () => {
			const delegatee = alice.address;
			const nonce = 0;
			const expiry = 0;
			const domain = {
				name: 'TOK',
				chainId: 1,
				verifyingContract: '0x4BC6657283f8f24e27EAc1D21D1deE566C534A9A'
			};
			const types = {
				Delegation: [
					{ name: 'delegatee', type: 'address' },
					{ name: 'nonce', type: 'uint256' },
					{ name: 'expiry', type: 'uint256' }
				]
			};
			const message = {
				delegatee: delegatee,
				nonce: nonce,
				expiry: expiry
			};
			let sigHash = await ethers.utils._TypedDataEncoder.encode(domain, types, message);
			const rawSig = await alice.signer.signMessage(sigHash);
			const sig = await ethers.utils.splitSignature(rawSig);
			await expect(
				token.connect(alice.signer).delegateBySig(delegatee, nonce, expiry, sig.v, sig.r, sig.s)
			).to.be.revertedWith('Signature expired.');
		});

		// Verify that signature-based delegation works correctly.
		// TODO: signature delegation testing is presently broken due to Hardhat issues.
		// it('should delegate votes on behalf of the signatory', async () => {
		// 	const delegatee = alice.address;
		// 	const nonce = 0;
		// 	const expiry = 1e10;
		// 	const domain = {
		// 		name: 'TOK',
		// 		chainId: 1,
		// 		verifyingContract: '0x4BC6657283f8f24e27EAc1D21D1deE566C534A9A'
		// 	};
		// 	const types = {
		// 		Delegation: [
		// 			{ name: 'delegatee', type: 'address' },
		// 			{ name: 'nonce', type: 'uint256' },
		// 			{ name: 'expiry', type: 'uint256' }
		// 		]
		// 	};
		// 	const message = {
		// 		delegatee: delegatee,
		// 		nonce: nonce,
		// 		expiry: expiry
		// 	};
		// 	let sigHash = await ethers.utils._TypedDataEncoder.encode(domain, types, message);
		//
		// 	// TODO: try signing the EIP-712 message. Look at ajb413's solution first.
		// 	// Then sig-util.
		//
		// 	// let vanillaProvider = new vanillaEthers.providers.JsonRpcProvider(bob.provider.url);
		// 	// let vanillaSigner = vanillaProvider.getSigner(bob.address);
		//
		// 	// const rawSig = await vanillaSigner._signTypedData(domain, types, message);
		// 	const sig = await ethers.utils.splitSignature(rawSig);
		// 	console.log('a+', bob.address, alice.address)
		// 	await token.connect(bob.signer).delegateBySig(delegatee, nonce, expiry, sig.v, sig.r, sig.s);
		// 	let delegate = await token.connect(alice.signer).delegates(bob.address);
		// 	delegate = await token.connect(alice.signer).delegates(alice.address);
		// 	delegate.should.be.equal(alice.address);
		// });

		// Verify that direct delegation works correctly.
		it('should delegate votes on behalf of the caller', async () => {
			let delegate = await token.connect(alice.signer).delegates(bob.address);
			delegate.should.be.equal('0x0000000000000000000000000000000000000000');
			await token.connect(bob.signer).delegate(alice.address);
			delegate = await token.connect(alice.signer).delegates(bob.address);
			delegate.should.be.equal(alice.address);
		});
	});

	// Verify that the Token returns expected values when looking for checkpoint numbers.
	describe('* numCheckpoints()', function () {
		it('should return the correct number of checkpoints for a delegate', async () => {
			await token.connect(alice.signer).mint(alice.address, ethers.utils.parseEther('1000000000'));
			await token.connect(alice.signer).transfer(dev.address, ethers.utils.parseEther('100'));
			let numCheckpoints = await token.connect(alice.signer).numCheckpoints(bob.address);
			numCheckpoints.should.be.equal(0);

			// The delegatee has received votes; this creates a checkpoint.
			await token.connect(dev.signer).delegate(bob.address);
			numCheckpoints = await token.connect(alice.signer).numCheckpoints(bob.address);
			numCheckpoints.should.be.equal(1);

			// The delegator loses tokens; this creates new checkpoints.
			await token.connect(dev.signer).transfer(carol.address, ethers.utils.parseEther('10'));
			numCheckpoints = await token.connect(alice.signer).numCheckpoints(bob.address);
			numCheckpoints.should.be.equal(2);
			await token.connect(dev.signer).transfer(carol.address, ethers.utils.parseEther('10'));
			numCheckpoints = await token.connect(alice.signer).numCheckpoints(bob.address);
			numCheckpoints.should.be.equal(3);

			// The delegator has received new tokens; create a checkpoint for the delegatee.
			await token.connect(alice.signer).transfer(dev.address, ethers.utils.parseEther('100'));
			numCheckpoints = await token.connect(alice.signer).numCheckpoints(bob.address);
			numCheckpoints.should.be.equal(4);

			// Verify that the checkpoints contain the expected number of votes.
			let checkpointVotes = await token.connect(alice.signer).checkpoints(bob.address, 0);
			checkpointVotes[1].should.be.equal(ethers.utils.parseEther('100'));
			checkpointVotes = await token.connect(alice.signer).checkpoints(bob.address, 1);
			checkpointVotes[1].should.be.equal(ethers.utils.parseEther('90'));
			checkpointVotes = await token.connect(alice.signer).checkpoints(bob.address, 2);
			checkpointVotes[1].should.be.equal(ethers.utils.parseEther('80'));
			checkpointVotes = await token.connect(alice.signer).checkpoints(bob.address, 3);
			checkpointVotes[1].should.be.equal(ethers.utils.parseEther('180'));
		});

		// Verify that only one checkpoint is added per block.
		// This test case requires using Ganache instead of the Hardhat EVM.
		it('should add only one checkpoint per block; using Ganache', async () => {
			await token.connect(alice.signer).mint(alice.address, ethers.utils.parseEther('1000000000'));
			await token.connect(alice.signer).transfer(dev.address, ethers.utils.parseEther('100'));
			let numCheckpoints = await token.connect(alice.signer).numCheckpoints(bob.address);
			numCheckpoints.should.be.equal(0);

			// We must pause and restart mining around these transactions to ensure their inclusion into the same block.
			await ethers.provider.send('miner_stop');
			await token.connect(dev.signer).delegate(bob.address);
			let transferTransactionOne = await token.connect(dev.signer).transfer(carol.address, ethers.utils.parseEther('10'));
			let transferTransactionTwo = await token.connect(dev.signer).transfer(carol.address, ethers.utils.parseEther('10'));
			await ethers.provider.send('miner_start');
			let transactionOneBlock = (await ethers.provider.getTransaction(transferTransactionOne.hash)).blockNumber;
			let transactionTwoBlock = (await ethers.provider.getTransaction(transferTransactionTwo.hash)).blockNumber;
			transactionOneBlock.should.be.equal(transactionTwoBlock);

			// Verify that the checkpoints contain the expected number of votes.
			numCheckpoints = await token.connect(alice.signer).numCheckpoints(bob.address);
			numCheckpoints.should.be.equal(1);
			let checkpointVotes = await token.connect(alice.signer).checkpoints(bob.address, 0);
			checkpointVotes[1].should.be.equal(ethers.utils.parseEther('80'));
			checkpointVotes = await token.connect(alice.signer).checkpoints(bob.address, 1);
			checkpointVotes[1].should.be.equal(0);
			checkpointVotes = await token.connect(alice.signer).checkpoints(bob.address, 2);
			checkpointVotes[1].should.be.equal(0);
			await token.connect(alice.signer).transfer(dev.address, ethers.utils.parseEther('100'));
			numCheckpoints = await token.connect(alice.signer).numCheckpoints(bob.address);
			numCheckpoints.should.be.equal(2);
			checkpointVotes = await token.connect(alice.signer).checkpoints(bob.address, 1);
			checkpointVotes[1].should.be.equal(ethers.utils.parseEther('180'));
		});
	});

	// Verify that the Token returns expected values when getting prior vote counts.
	describe('* getPriorVotes()', function () {
		it('should return zero when there are no prior checkpoints', async () => {
			let aliceVotes = await token.connect(alice.signer).getPriorVotes(alice.address, 0);
			aliceVotes.should.be.equal(0);
		});

		// Verify that vote counting reverts on unfinalized blocks.
		it('should revert for unfinalized blocks', async () => {
			await expect(
				token.connect(alice.signer).getPriorVotes(alice.address, 1e6)
			).to.be.revertedWith('The specified block is not yet finalized.');
		});

		// Verify that vote counting correctly returns from checkpoint blocks.
		it('should return the latest vote tally if greater than the last checkpoint block', async () => {
			await token.connect(alice.signer).mint(alice.address, ethers.utils.parseEther('1000000000'));
			let delegateTransaction = await token.connect(alice.signer).delegate(alice.address);
			await ethers.provider.send('evm_mine');
			await ethers.provider.send('evm_mine');
			let priorVotes = await token.connect(alice.signer).getPriorVotes(alice.address, delegateTransaction.blockNumber);
			priorVotes.should.be.equal(ethers.utils.parseEther('1000000000'));
			priorVotes = await token.connect(alice.signer).getPriorVotes(alice.address, delegateTransaction.blockNumber + 1);
			priorVotes.should.be.equal(ethers.utils.parseEther('1000000000'));
		});

		// Verify that vote counting correctly returns from pre-checkpoint blocks.
		it('should return zero votes if prior to the first checkpoint block', async () => {
			await token.connect(alice.signer).mint(alice.address, ethers.utils.parseEther('1000000000'));
			await ethers.provider.send('evm_mine');
			let delegateTransaction = await token.connect(alice.signer).delegate(alice.address);
			await ethers.provider.send('evm_mine');
			await ethers.provider.send('evm_mine');
			let priorVotes = await token.connect(alice.signer).getPriorVotes(alice.address, delegateTransaction.blockNumber - 1);
			priorVotes.should.be.equal(0);
			priorVotes = await token.connect(alice.signer).getPriorVotes(alice.address, delegateTransaction.blockNumber + 1);
			priorVotes.should.be.equal(ethers.utils.parseEther('1000000000'));
		});

		// Verify that vote counting correctly updates through token transfers.
		it('should correctly track vote totals across multiple transfers', async () => {
			await token.connect(alice.signer).mint(alice.address, ethers.utils.parseEther('1000000000'));
			await token.connect(alice.signer).transfer(dev.address, ethers.utils.parseEther('100'));
			let delegateTransaction = await token.connect(dev.signer).delegate(bob.address);
			await ethers.provider.send('evm_mine');
			await ethers.provider.send('evm_mine');
			let transferTransactionOne = await token.connect(dev.signer).transfer(carol.address, ethers.utils.parseEther('10'));
			await ethers.provider.send('evm_mine');
			await ethers.provider.send('evm_mine');
			let transferTransactionTwo = await token.connect(dev.signer).transfer(carol.address, ethers.utils.parseEther('10'));
			await ethers.provider.send('evm_mine');
			await ethers.provider.send('evm_mine');
			let transferTransactionThree = await token.connect(carol.signer).transfer(dev.address, ethers.utils.parseEther('20'));
			await ethers.provider.send('evm_mine');
			await ethers.provider.send('evm_mine');

			// Now that transfers are all complete, check various vote checkpoints.
			let priorVotes = await token.connect(alice.signer).getPriorVotes(bob.address, delegateTransaction.blockNumber - 1);
			priorVotes.should.be.equal(0);
			priorVotes = await token.connect(alice.signer).getPriorVotes(bob.address, delegateTransaction.blockNumber);
			priorVotes.should.be.equal(ethers.utils.parseEther('100'));
			priorVotes = await token.connect(alice.signer).getPriorVotes(bob.address, delegateTransaction.blockNumber + 1);
			priorVotes.should.be.equal(ethers.utils.parseEther('100'));
			priorVotes = await token.connect(alice.signer).getPriorVotes(bob.address, transferTransactionOne.blockNumber);
			priorVotes.should.be.equal(ethers.utils.parseEther('90'));
			priorVotes = await token.connect(alice.signer).getPriorVotes(bob.address, transferTransactionOne.blockNumber + 1);
			priorVotes.should.be.equal(ethers.utils.parseEther('90'));
			priorVotes = await token.connect(alice.signer).getPriorVotes(bob.address, transferTransactionTwo.blockNumber);
			priorVotes.should.be.equal(ethers.utils.parseEther('80'));
			priorVotes = await token.connect(alice.signer).getPriorVotes(bob.address, transferTransactionTwo.blockNumber + 1);
			priorVotes.should.be.equal(ethers.utils.parseEther('80'));
			priorVotes = await token.connect(alice.signer).getPriorVotes(bob.address, transferTransactionThree.blockNumber);
			priorVotes.should.be.equal(ethers.utils.parseEther('100'));
			priorVotes = await token.connect(alice.signer).getPriorVotes(bob.address, transferTransactionThree.blockNumber + 1);
			priorVotes.should.be.equal(ethers.utils.parseEther('100'));
		});
	});
});
