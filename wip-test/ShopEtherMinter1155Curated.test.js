'use strict';

// Imports.
import { ethers } from 'hardhat';
import { expect } from 'chai';
import 'chai/register-should';

// Test the Shop contract's ability to list and sell NFTs.
describe('ShopEtherMinter1155Curated', function () {
	let alice, bob, carol;
	let FeeOwner, ShopEtherMinter1155Curated, MockProxyRegistry, Fee1155;
	before(async () => {
		const signers = await ethers.getSigners();
		const addresses = await Promise.all(signers.map(async signer => signer.getAddress()));
		alice = { provider: signers[0].provider, signer: signers[0], address: addresses[0] };
		bob = { provider: signers[1].provider, signer: signers[1], address: addresses[1] };
		carol = { provider: signers[2].provider, signer: signers[2], address: addresses[2] };

		// Create factories for deploying all required contracts using specified signers.
		FeeOwner = await ethers.getContractFactory('FeeOwner');
		ShopEtherMinter1155Curated = await ethers.getContractFactory('ShopEtherMinter1155Curated');
		MockProxyRegistry = await ethers.getContractFactory('MockProxyRegistry');
		Fee1155 = await ethers.getContractFactory('Fee1155');
	});

	// Deploy a fresh set of smart contracts for testing with.
	let platformFeeOwner, shop, itemFeeOwner, proxyRegistry, itemOne;
	beforeEach(async () => {
		itemFeeOwner = await FeeOwner.connect(alice.signer).deploy('10000', '10000');
		await itemFeeOwner.deployed();
		proxyRegistry = await MockProxyRegistry.connect(alice.signer).deploy();
		await proxyRegistry.deployed();
		itemOne = await Fee1155.connect(alice.signer).deploy('', itemFeeOwner.address, proxyRegistry.address);
		await itemOne.deployed();
		await itemOne.connect(alice.signer).create([ 0 ], [ 1 ], [ alice.address ], []);
		platformFeeOwner = await FeeOwner.connect(alice.signer).deploy('2500', '10000');
		await platformFeeOwner.deployed();
		shop = await ShopEtherMinter1155Curated.connect(alice.signer).deploy(itemOne.address, platformFeeOwner.address);
		await shop.deployed();

		// Alice must approve the Shop to mint items on her behalf.
		await itemOne.connect(alice.signer).setApprovalForAll(shop.address, true);
		await itemOne.connect(alice.signer).approveMinter(shop.address, true);
	});

	// Verify that the Shop can list an item.
	it('should be able to list an item for sale', async () => {
		let aliceBalance = await itemOne.balanceOf(alice.address, 1);
		aliceBalance.should.be.equal(0);
		await shop.connect(alice.signer).listItems([ 0 ], [ ethers.utils.parseEther('0.1') ]);
	});

	// Verify that users can place offers on items from the shop.
	it('should allow users to place offers for items', async () => {
		await shop.connect(alice.signer).listItems([ 0 ], [ ethers.utils.parseEther('0.1') ]);

		// Let Bob offer his Ether for an item.
		let bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(0);
		let aliceOldEtherBalance = await alice.provider.getBalance(alice.address);
		let bobOldEtherBalance = await bob.provider.getBalance(bob.address);
		await shop.connect(bob.signer).makeOffers([ 0 ], { value: ethers.utils.parseEther('0.1') });
		let bobEtherBalance = await bob.provider.getBalance(bob.address);
		bobEtherBalance.should.be.below(bobOldEtherBalance);
		bobEtherBalance.should.be.at.most(bobOldEtherBalance.sub(ethers.utils.parseEther('0.1')));
		bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(0);
		let aliceEtherBalance = await alice.provider.getBalance(alice.address);
		aliceEtherBalance.should.be.equal(aliceOldEtherBalance);

		// Let Alice accept Bob's offer for the item.
		aliceOldEtherBalance = await alice.provider.getBalance(alice.address);
		bobOldEtherBalance = await bob.provider.getBalance(bob.address);
		await shop.connect(alice.signer).acceptOffers([ 0 ], [ bob.address ], [ 1 ], [ 1 ]);
		bobEtherBalance = await bob.provider.getBalance(bob.address);
		bobEtherBalance.should.be.equal(bobOldEtherBalance);
		bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(1);
		aliceEtherBalance = await alice.provider.getBalance(alice.address);
		aliceEtherBalance.should.be.above(aliceOldEtherBalance);
		aliceEtherBalance.should.be.at.most(aliceOldEtherBalance.add(ethers.utils.parseEther('0.1')));
	});

	// Verify that users can cancel offers on items from the shop.
	it('should allow users to cancel offers for items', async () => {
		await shop.connect(alice.signer).listItems([ 0 ], [ ethers.utils.parseEther('0.1') ]);

		// Let Bob offer his Ether for an item.
		let bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(0);
		let aliceOldEtherBalance = await alice.provider.getBalance(alice.address);
		let bobOldEtherBalance = await bob.provider.getBalance(bob.address);
		await shop.connect(bob.signer).makeOffers([ 0 ], { value: ethers.utils.parseEther('0.1') });
		let bobEtherBalance = await bob.provider.getBalance(bob.address);
		bobEtherBalance.should.be.below(bobOldEtherBalance);
		bobEtherBalance.should.be.at.most(bobOldEtherBalance.sub(ethers.utils.parseEther('0.1')));
		bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(0);
		let aliceEtherBalance = await alice.provider.getBalance(alice.address);
		aliceEtherBalance.should.be.equal(aliceOldEtherBalance);

		// Let Bob cancel his Ether offer for an item.
		bobOldEtherBalance = await bob.provider.getBalance(bob.address);
		await shop.connect(bob.signer).cancelOffers([ 0 ]);
		bobEtherBalance = await bob.provider.getBalance(bob.address);
		bobEtherBalance.should.be.above(bobOldEtherBalance);
		bobEtherBalance.should.be.at.most(bobOldEtherBalance.add(ethers.utils.parseEther('0.1')));

		// Alice can no longer accept Bob's former offer for the item.
		aliceOldEtherBalance = await alice.provider.getBalance(alice.address);
		bobOldEtherBalance = await bob.provider.getBalance(bob.address);
		await expect(
			shop.connect(alice.signer).acceptOffers([ 0 ], [ bob.address ], [ 1 ], [ 1 ])
		).to.be.revertedWith('You cannot accept an offer for less than the current asking price.');
		bobEtherBalance = await bob.provider.getBalance(bob.address);
		bobEtherBalance.should.be.equal(bobOldEtherBalance);
		bobBalance = await itemOne.balanceOf(bob.address, 0);
		bobBalance.should.be.equal(0);
		aliceEtherBalance = await alice.provider.getBalance(alice.address);
		aliceEtherBalance.should.be.at.most(aliceOldEtherBalance);
	});

	// Verify that the shop owner can change the price of item listings.
	it('should allow the shop owner to change item prices', async () => {
		await shop.connect(alice.signer).listItems([ 0 ], [ ethers.utils.parseEther('0.1') ]);
		await shop.connect(alice.signer).listItems([ 0 ], [ ethers.utils.parseEther('0.2') ]);

		// Let Bob offer his Ether for an item.
		let bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(0);
		let aliceOldEtherBalance = await alice.provider.getBalance(alice.address);
		let bobOldEtherBalance = await bob.provider.getBalance(bob.address);
		await shop.connect(bob.signer).makeOffers([ 0 ], { value: ethers.utils.parseEther('0.2') });
		let bobEtherBalance = await bob.provider.getBalance(bob.address);
		bobEtherBalance.should.be.below(bobOldEtherBalance);
		bobEtherBalance.should.be.at.most(bobOldEtherBalance.sub(ethers.utils.parseEther('0.2')));
		bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(0);
		let aliceEtherBalance = await alice.provider.getBalance(alice.address);
		aliceEtherBalance.should.be.equal(aliceOldEtherBalance);

		// Let Alice accept Bob's offer for the item.
		aliceOldEtherBalance = await alice.provider.getBalance(alice.address);
		bobOldEtherBalance = await bob.provider.getBalance(bob.address);
		await shop.connect(alice.signer).acceptOffers([ 0 ], [ bob.address ], [ 1 ], [ 1 ]);
		bobEtherBalance = await bob.provider.getBalance(bob.address);
		bobEtherBalance.should.be.equal(bobOldEtherBalance);
		bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(1);
		aliceEtherBalance = await alice.provider.getBalance(alice.address);
		aliceEtherBalance.should.be.above(aliceOldEtherBalance);
		aliceEtherBalance.should.be.at.most(aliceOldEtherBalance.add(ethers.utils.parseEther('0.2')));
	});

	// Verify that users cannot buy items that are out of stock.
	it('should not be able to buy items that are not in stock', async () => {
		await shop.connect(alice.signer).listItems([ 0 ], [ ethers.utils.parseEther('0.1') ]);

		// Let Bob offer his Ether for an item.
		let bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(0);
		let aliceOldEtherBalance = await alice.provider.getBalance(alice.address);
		let bobOldEtherBalance = await bob.provider.getBalance(bob.address);
		await shop.connect(bob.signer).makeOffers([ 0 ], { value: ethers.utils.parseEther('0.1') });
		let bobEtherBalance = await bob.provider.getBalance(bob.address);
		bobEtherBalance.should.be.below(bobOldEtherBalance);
		bobEtherBalance.should.be.at.most(bobOldEtherBalance.sub(ethers.utils.parseEther('0.1')));
		bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(0);
		let aliceEtherBalance = await alice.provider.getBalance(alice.address);
		aliceEtherBalance.should.be.equal(aliceOldEtherBalance);

		// Let Alice accept Bob's offer for the item.
		aliceOldEtherBalance = await alice.provider.getBalance(alice.address);
		bobOldEtherBalance = await bob.provider.getBalance(bob.address);
		await shop.connect(alice.signer).acceptOffers([ 0 ], [ bob.address ], [ 1 ], [ 1 ]);
		bobEtherBalance = await bob.provider.getBalance(bob.address);
		bobEtherBalance.should.be.equal(bobOldEtherBalance);
		bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(1);
		aliceEtherBalance = await alice.provider.getBalance(alice.address);
		aliceEtherBalance.should.be.above(aliceOldEtherBalance);
		aliceEtherBalance.should.be.at.most(aliceOldEtherBalance.add(ethers.utils.parseEther('0.1')));

		// Alice should not be able to accept Carol's offer for the item; it has all been minted.
		let carolBalance = await itemOne.balanceOf(carol.address, 1);
		carolBalance.should.be.equal(0);
		await shop.connect(carol.signer).makeOffers([ 0 ], { value: ethers.utils.parseEther('0.1') });
		await expect(
			shop.connect(alice.signer).acceptOffers([ 0 ], [ carol.address ], [ 1 ], [ 1 ])
		).to.be.revertedWith('You cannot mint an item beyond its permitted maximum supply.');
		carolBalance = await itemOne.balanceOf(carol.address, 0);
		carolBalance.should.be.equal(0);
	});
});
