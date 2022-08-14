'use strict';

// Imports.
import { ethers, network } from 'hardhat';
import { expect, should } from 'chai';
should();

// Test the multi-asset vault.
describe('SignatureClaim721', function () {
	let alice, bob, carol, dev;
	let TestERC721, SignatureClaim721;
	before(async () => {
		const signers = await ethers.getSigners();
		const addresses = await Promise.all(signers.map(async signer => signer.getAddress()));
		alice = { provider: signers[0].provider, signer: signers[0], address: addresses[0] };
		bob = { provider: signers[1].provider, signer: signers[1], address: addresses[1] };
		carol = { provider: signers[2].provider, signer: signers[2], address: addresses[2] };
		dev = { provider: signers[3].provider, signer: signers[3], address: addresses[3] };

		// Create factories for deploying all required contracts using signers.
		TestERC721 = await ethers.getContractFactory('TestERC721');
		SignatureClaim721 = await ethers.getContractFactory('SignatureClaim721');
	});

	// Deploy a fresh set of smart contracts for testing with.
	let test721, signatureClaim721;
	beforeEach(async () => {
		// Deploy a mintable testing ERC-721 token.
		test721 = await TestERC721.connect(dev.signer).deploy();

		// Deploy the signature claim contract.
		signatureClaim721 = await SignatureClaim721.connect(dev.signer).deploy('Wedding', carol.address, test721.address, 1);
	});

	// Test the signature claim system directly.
	describe('testing the signature claim', function () {
		// Test direct asset transfer.
		describe('with assets', function () {
			// Send assets to the claim contract.
			beforeEach(async () => {
				// Mint testing ERC-721 tokens directly to the vault.
				await test721.connect(dev.signer).mint(signatureClaim721.address, 1);
				await test721.connect(dev.signer).mint(signatureClaim721.address, 2);
				await test721.connect(dev.signer).mint(signatureClaim721.address, 3);
			});

			it('allow a claimant to claim', async () => {
				const domain = {
					name: 'Wedding',
					version: '1',
					chainId: network.config.chainId,
					verifyingContract: signatureClaim721.address
				};

				// Our signer can now sign a digest to produce an executable signature.
				let signature = await carol.signer._signTypedData(
					domain,
					{
						claim: [
							{ name: '_claimant', type: 'address' },
							{ name: '_expiry', type: 'uint256' }
						]
					},
					{
						'_claimant': alice.address,
						'_expiry': ethers.constants.MaxUint256
					}
				);
				let { v, r, s } = ethers.utils.splitSignature(signature);

				// Alice should not have an item.
				let aliceBalance = await test721.balanceOf(alice.address);
				aliceBalance.should.be.equal(0);
				let itemOwner = await test721.ownerOf(1);
				itemOwner.should.equal(signatureClaim721.address);

				// Alice should be able to execute this signature.
				await signatureClaim721.connect(alice.signer).claim(
					ethers.constants.MaxUint256,
					v, r, s
				);
				aliceBalance = await test721.balanceOf(alice.address);
				aliceBalance.should.be.equal(1);
				itemOwner = await test721.ownerOf(1);
				itemOwner.should.be.equal(alice.address);
			});

			it('disallow double claiming', async () => {
				const domain = {
					name: 'Wedding',
					version: '1',
					chainId: network.config.chainId,
					verifyingContract: signatureClaim721.address
				};

				// Our signer can now sign a digest to produce an executable signature.
				let signature = await carol.signer._signTypedData(
					domain,
					{
						claim: [
							{ name: '_claimant', type: 'address' },
							{ name: '_expiry', type: 'uint256' }
						]
					},
					{
						'_claimant': alice.address,
						'_expiry': ethers.constants.MaxUint256
					}
				);
				let { v, r, s } = ethers.utils.splitSignature(signature);

				// Alice should not have an item.
				let aliceBalance = await test721.balanceOf(alice.address);
				aliceBalance.should.be.equal(0);
				let itemOwner = await test721.ownerOf(1);
				itemOwner.should.equal(signatureClaim721.address);

				// Alice should be able to execute this signature.
				await signatureClaim721.connect(alice.signer).claim(
					ethers.constants.MaxUint256,
					v, r, s
				);
				aliceBalance = await test721.balanceOf(alice.address);
				aliceBalance.should.be.equal(1);
				itemOwner = await test721.ownerOf(1);
				itemOwner.should.be.equal(alice.address);

				// Prevent double-claiming.
				await expect(
					signatureClaim721.connect(alice.signer).claim(
						ethers.constants.MaxUint256,
						v, r, s
					)
				).to.be.revertedWith('CannotClaimMoreThanOnce()');
			});
		});
	});
});
