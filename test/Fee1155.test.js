'use strict';

// Imports.
import { ethers } from 'hardhat';
import { expect } from 'chai';
import 'chai/register-should';

// Test the SuperFarm ERC-1155 implementation.
describe('Fee1155', function () {
	const startingUri = 'starting-uri';
	let alice, bob;
	let FeeOwner, MockProxyRegistry, Fee1155;
	before(async () => {
		const signers = await ethers.getSigners();
		const addresses = await Promise.all(signers.map(async signer => signer.getAddress()));
		alice = { provider: signers[0].provider, signer: signers[0], address: addresses[0] };
		bob = { provider: signers[1].provider, signer: signers[1], address: addresses[1] };

		// Create factories for deploying all required contracts using specified signers.
		FeeOwner = await ethers.getContractFactory('FeeOwner');
		MockProxyRegistry = await ethers.getContractFactory('MockProxyRegistry');
		Fee1155 = await ethers.getContractFactory('Fee1155');
	});

	// Deploy a fresh set of smart contracts for testing with.
	let itemFeeOwner, proxyRegistry, itemOne;
	beforeEach(async () => {
		itemFeeOwner = await FeeOwner.connect(alice.signer).deploy('10000', '10000');
		await itemFeeOwner.deployed();
		proxyRegistry = await MockProxyRegistry.connect(alice.signer).deploy();
		await proxyRegistry.deployed();
		itemOne = await Fee1155.connect(alice.signer).deploy(startingUri, itemFeeOwner.address, proxyRegistry.address);
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
		let createItemGroupTransaction = await itemOne.connect(alice.signer).create([ 1 ], [ 1 ], [ alice.address ], []);
		let createItemGroupReceipt = await createItemGroupTransaction.wait();
		let newItemGroupEvent = createItemGroupReceipt.events[0];
		let newItemGroupId = newItemGroupEvent.args[0];
		newItemGroupId.should.be.equal(0);
		let newItemGroupSize = newItemGroupEvent.args[1];
		newItemGroupSize.should.be.equal(1);
		let newItemGroupCreator = newItemGroupEvent.args[2];
		newItemGroupCreator.should.be.equal(alice.address);
		let itemZeroId = newItemGroupId.add(1);
		let itemZeroBalance = await itemOne.connect(alice.signer).balanceOf(alice.address, itemZeroId);
		itemZeroBalance.should.be.equal(1);
	});

	// Verify that the owner can mint items.
	it('should allow owner to mint items', async () => {
		let createItemGroupTransaction = await itemOne.connect(alice.signer).create([ 0 ], [ 1 ], [ alice.address ], []);
		let createItemGroupReceipt = await createItemGroupTransaction.wait();
		let newItemGroupEvent = createItemGroupReceipt.events[0];
		let newItemGroupId = newItemGroupEvent.args[0];
		let itemZeroId = newItemGroupId.add(1);
		let itemZeroBalance = await itemOne.connect(alice.signer).balanceOf(alice.address, itemZeroId);
		itemZeroBalance.should.be.equal(0);
		await itemOne.connect(alice.signer).mint(alice.address, itemZeroId, 1, []);
		itemZeroBalance = await itemOne.connect(alice.signer).balanceOf(alice.address, itemZeroId);
		itemZeroBalance.should.be.equal(1);
	});

	// Verify that the owner can mint a batch of items.
	it('should allow owner to mint item batches', async () => {
		let createItemGroupTransaction = await itemOne.connect(alice.signer).create([ 0, 0 ], [ 1, 1 ], [ alice.address, alice.address ], []);
		let createItemGroupReceipt = await createItemGroupTransaction.wait();
		let newItemGroupEvent = createItemGroupReceipt.events[0];
		let newItemGroupId = newItemGroupEvent.args[0];
		let itemZeroId = newItemGroupId.add(1);
		let itemZeroBalance = await itemOne.connect(alice.signer).balanceOf(alice.address, itemZeroId);
		itemZeroBalance.should.be.equal(0);
		let itemOneId = newItemGroupId.add(2);
		let itemOneBalance = await itemOne.connect(alice.signer).balanceOf(alice.address, itemOneId);
		itemOneBalance.should.be.equal(0);
		await itemOne.connect(alice.signer).mintBatch(alice.address, [ itemZeroId, itemOneId ], [ 1, 1 ], []);
		itemZeroBalance = await itemOne.connect(alice.signer).balanceOf(alice.address, itemZeroId);
		itemZeroBalance.should.be.equal(1);
		itemOneBalance = await itemOne.connect(alice.signer).balanceOf(alice.address, itemOneId);
		itemOneBalance.should.be.equal(1);
	});

	// Verify that non-owners cannot create items.
	it('should prevent non-owners from creating items', async () => {
		await expect(
			itemOne.connect(bob.signer).create([ 1 ], [ 1 ], [ bob.address ], [])
		).to.be.revertedWith('Ownable: caller is not the owner');
	});

	// Verify that non-owners cannot mint items.
	it('should prevent non-owners from minting items', async () => {
		await expect(
			itemOne.connect(bob.signer).mint(alice.address, 0, 1, [])
		).to.be.revertedWith('You are not an approved minter for this item.');
	});

	// Verify that the same item cannot be reminted.
	it('should prevent minting existing items', async () => {
		let createItemGroupTransaction = await itemOne.connect(alice.signer).create([ 1 ], [ 1 ], [ alice.address ], []);
		let createItemGroupReceipt = await createItemGroupTransaction.wait();
		let newItemGroupEvent = createItemGroupReceipt.events[0];
		let newItemGroupId = newItemGroupEvent.args[0];
		let itemZeroId = newItemGroupId.add(1);
		let itemZeroBalance = await itemOne.connect(alice.signer).balanceOf(alice.address, itemZeroId);
		itemZeroBalance.should.be.equal(1);
		await expect(
			itemOne.connect(alice.signer).mint(alice.address, itemZeroId, 1, [])
		).to.be.revertedWith('You cannot mint an item beyond its permitted maximum supply.');
	});
});
