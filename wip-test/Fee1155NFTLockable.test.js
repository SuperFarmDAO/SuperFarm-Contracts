'use strict';

// Imports.
import { ethers } from 'hardhat';
import { expect } from 'chai';
import 'chai/register-should';

// Test the SuperFarm NFT-only lockable ERC-1155 implementation.
describe('Fee1155NFTLockable', function () {
	const startingUri = 'starting-uri';
	let alice, bob;
	let FeeOwner, MockProxyRegistry, Fee1155NFTLockable;
	let itemIds = [];
	let itemAmounts = [];
	before(async () => {
		const signers = await ethers.getSigners();
		const addresses = await Promise.all(signers.map(async signer => signer.getAddress()));
		alice = { provider: signers[0].provider, signer: signers[0], address: addresses[0] };
		bob = { provider: signers[1].provider, signer: signers[1], address: addresses[1] };

		// Create factories for deploying all required contracts using specified signers.
		FeeOwner = await ethers.getContractFactory('FeeOwner');
		MockProxyRegistry = await ethers.getContractFactory('MockProxyRegistry');
		Fee1155NFTLockable = await ethers.getContractFactory('Fee1155NFTLockable');

		// Populate testing data for item creation.
		for (let i = 1; i <= 200; i++) {
			itemIds.push(i);
			itemAmounts.push(1);
		}
	});

	// Deploy a fresh set of smart contracts for testing with.
	let itemFeeOwner, proxyRegistry, itemOne;
	beforeEach(async () => {
		itemFeeOwner = await FeeOwner.connect(alice.signer).deploy('10000', '10000');
		await itemFeeOwner.deployed();
		proxyRegistry = await MockProxyRegistry.connect(alice.signer).deploy();
		await proxyRegistry.deployed();
		itemOne = await Fee1155NFTLockable.connect(alice.signer).deploy(startingUri, itemFeeOwner.address, proxyRegistry.address);
		await itemOne.deployed();
	});

	// Verify that the item has the correctly-constructed fields.
	it('should be constructed with correct data', async () => {
		let itemOwner = await itemOne.connect(alice.signer).owner();
		itemOwner.should.be.equal(alice.address);
		let itemReportedFeeOwner = await itemOne.connect(alice.signer).feeOwner();
		itemFeeOwner.address.should.be.equal(itemReportedFeeOwner);
		let itemUri = await itemOne.connect(alice.signer).metadataUri();
		itemUri.should.be.equal(startingUri);
	});

	// Verify that the owner can update the collection URI.
	it('should allow owner to update collection URI', async () => {
		let itemUri = await itemOne.connect(alice.signer).metadataUri();
		itemUri.should.be.equal(startingUri);
		await itemOne.connect(alice.signer).setURI('updated-uri');
		itemUri = await itemOne.connect(alice.signer).metadataUri();
		itemUri.should.be.equal('updated-uri');
	});

	// Verify that non-owners cannot update the collection URI.
	it('should prevent non-owners from updating collection URI', async () => {
		await expect(
			itemOne.connect(bob.signer).setURI('updated-uri')
		).to.be.revertedWith('Ownable: caller is not the owner');
	});

	// Verify that the owner can create items.
	it('should allow owner to create items', async () => {
		let createItemGroupTransaction = await itemOne.connect(alice.signer).createNFT(alice.address, itemIds, itemAmounts, []);
		let createItemGroupReceipt = await createItemGroupTransaction.wait();
		let newItemGroupEvent = createItemGroupReceipt.events[createItemGroupReceipt.events.length - 1];
		let newItemGroupId = newItemGroupEvent.args[0];
		newItemGroupId.should.be.equal(0);
		let newItemGroupSize = newItemGroupEvent.args[1];
		newItemGroupSize.should.be.equal(200);
		let newItemGroupCreator = newItemGroupEvent.args[2];
		newItemGroupCreator.should.be.equal(alice.address);
		let itemZeroId = newItemGroupId.add(1);
		let itemZeroBalance = await itemOne.connect(alice.signer).balanceOf(alice.address, itemZeroId);
		itemZeroBalance.should.be.equal(1);
	});

	// Verify that non-owners cannot create items.
	it('should prevent non-owners from creating items', async () => {
		await expect(
			itemOne.connect(bob.signer).createNFT(bob.address, itemIds, itemAmounts, [])
		).to.be.revertedWith('Ownable: caller is not the owner');
	});

	// Verify that the same item cannot be reminted.
	it('should prevent minting existing items', async () => {
		let createItemGroupTransaction = await itemOne.connect(alice.signer).createNFT(alice.address, itemIds, itemAmounts, []);
		let createItemGroupReceipt = await createItemGroupTransaction.wait();
		let newItemGroupEvent = createItemGroupReceipt.events[createItemGroupReceipt.events.length - 1];
		let newItemGroupId = newItemGroupEvent.args[0];
		let itemZeroId = newItemGroupId.add(1);
		let itemZeroBalance = await itemOne.connect(alice.signer).balanceOf(alice.address, itemZeroId);
		itemZeroBalance.should.be.equal(1);

		// Lock the collection and verify minting is no longer possible.
		await itemOne.connect(alice.signer).lock();
		await expect(
			itemOne.connect(alice.signer).createNFT(alice.address, itemIds, itemAmounts, [])
		).to.be.revertedWith('You cannot create more NFTs on a locked collection.');
	});
});
