'use strict';

// Imports.
import { ethers } from 'hardhat';
import { expect } from 'chai';
import 'chai/register-should';

// Test the Shop contract's ability to list and sell NFTs.
describe('Shop1155', function () {
	let alice, bob, carol, minter;
	let Token, Staker, FeeOwner, Shop1155, MockProxyRegistry, Fee1155;
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
		FeeOwner = await ethers.getContractFactory('FeeOwner');
		Shop1155 = await ethers.getContractFactory('Shop1155');
		MockProxyRegistry = await ethers.getContractFactory('MockProxyRegistry');
		Fee1155 = await ethers.getContractFactory('Fee1155');
	});

	// Deploy a fresh set of smart contracts for testing with.
	let token, staker, platformFeeOwner, shop, itemFeeOwner, proxyRegistry, itemOne;
	beforeEach(async () => {
		token = await Token.connect(minter.signer).deploy('Token', 'TOK', ethers.utils.parseEther('1000000000'));
		await token.deployed();
		staker = await Staker.connect(alice.signer).deploy('Staker', token.address);
		await staker.deployed();
		platformFeeOwner = await FeeOwner.connect(alice.signer).deploy('2500', '10000');
		await platformFeeOwner.deployed();
		shop = await Shop1155.connect(alice.signer).deploy('Shop', platformFeeOwner.address, [ staker.address ]);
		await shop.deployed();
		itemFeeOwner = await FeeOwner.connect(alice.signer).deploy('10000', '10000');
		await itemFeeOwner.deployed();
		proxyRegistry = await MockProxyRegistry.connect(alice.signer).deploy();
		await proxyRegistry.deployed();
		itemOne = await Fee1155.connect(alice.signer).deploy('', itemFeeOwner.address, proxyRegistry.address);
		await itemOne.deployed();
		await itemOne.connect(alice.signer).create([ 10, 10, 10 ], [ 10, 10, 10 ], [ alice.address, alice.address, alice.address ], []);

		// Alice must approve the Shop to transfer items on her behalf.
		await itemOne.connect(alice.signer).setApprovalForAll(shop.address, true);

		// Alice as owner of the Staker must approve the shop to spend user points.
		await staker.connect(alice.signer).approvePointSpender(shop.address, true);

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
			{ blockNumber: 0, rate: ethers.utils.parseEther('10') }
		], [
			{ blockNumber: 0, rate: 100 }
		]);
		await staker.connect(alice.signer).addPool(token.address, 100, 100);

		// Let Bob and Carol deposit some token to begin accruing points.
		await staker.connect(bob.signer).deposit(token.address, ethers.utils.parseEther('50000000'));
		await staker.connect(carol.signer).deposit(token.address, ethers.utils.parseEther('50000000'));
	});

	// Verify that the Shop can list an item.
	it('should be able to list an item for sale', async () => {
		let aliceBalance = await itemOne.balanceOf(alice.address, 1);
		aliceBalance.should.be.equal(10);
		await shop.connect(alice.signer).listItems([{
			assetType: 0,
			asset: '0x0000000000000000000000000000000000000000',
			price: 100
		}], [ itemOne.address ], [ [ 1 ] ], [ [ 10 ] ]);
		let inventoryCount = await shop.getInventoryCount();
		inventoryCount.should.be.equal(1);
		aliceBalance = await itemOne.balanceOf(alice.address, 1);
		aliceBalance.should.be.equal(0);
		let shopBalance = await itemOne.balanceOf(shop.address, 1);
		shopBalance.should.be.equal(10);
	});

	// Verify that users can buy items from the shop.
	it('should be able to sell items to users', async () => {
		let aliceBalance = await itemOne.balanceOf(alice.address, 1);
		aliceBalance.should.be.equal(10);
		await shop.connect(alice.signer).listItems([{
			assetType: 0,
			asset: '0x0000000000000000000000000000000000000000',
			price: 100
		},
		{
			assetType: 0,
			asset: '0x0000000000000000000000000000000000000001',
			price: 100
		},
		{
			assetType: 1,
			asset: '0x0000000000000000000000000000000000000000',
			price: ethers.utils.parseEther('0.1')
		}], [ itemOne.address ], [ [ 1, 2, 3 ] ], [ [ 1, 1, 1 ] ]);
		let inventoryCount = await shop.getInventoryCount();
		inventoryCount.should.be.equal(3);
		aliceBalance = await itemOne.balanceOf(alice.address, 1);
		aliceBalance.should.be.equal(9);
		let shopBalance = await itemOne.balanceOf(shop.address, 1);
		shopBalance.should.be.equal(1);

		// Check for expected price pair lengths.
		let priceLength = await shop.pricePairLengths(0);
		priceLength.should.be.equal(3);
		priceLength = await shop.pricePairLengths(1);
		priceLength.should.be.equal(3);
		priceLength = await shop.pricePairLengths(2);
		priceLength.should.be.equal(3);

		// Let Bob spend his Staker points on an item.
		let bobPoints = await staker.connect(bob.signer).getAvailablePoints(bob.address);
		await shop.connect(bob.signer).purchaseItem(0, 1, 0);
		let bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(1);
		shopBalance = await itemOne.balanceOf(shop.address, 1);
		shopBalance.should.be.equal(0);
		let finalBobPoints = await staker.connect(bob.signer).getAvailablePoints(bob.address);
		(bobPoints.add(50).sub(finalBobPoints)).should.be.equal(100);
	});

	// Verify that the shop owner can change the price of item listings.
	it('should allow the shop owner to change item prices', async () => {
		let aliceBalance = await itemOne.balanceOf(alice.address, 1);
		aliceBalance.should.be.equal(10);
		await shop.connect(alice.signer).listItems([{
			assetType: 0,
			asset: '0x0000000000000000000000000000000000000000',
			price: 100
		}], [ itemOne.address ], [ [ 1 ] ], [ [ 10 ] ]);
		let inventoryCount = await shop.getInventoryCount();
		inventoryCount.should.be.equal(1);
		aliceBalance = await itemOne.balanceOf(alice.address, 1);
		aliceBalance.should.be.equal(0);
		let shopBalance = await itemOne.balanceOf(shop.address, 1);
		shopBalance.should.be.equal(10);
		await shop.connect(alice.signer).changeItemPrice(0, [{
			assetType: 0,
			asset: '0x0000000000000000000000000000000000000000',
			price: 50
		}]);

		// Let Bob spend his Staker points on an item.
		let bobPoints = await staker.connect(bob.signer).getAvailablePoints(bob.address);
		await shop.connect(bob.signer).purchaseItem(0, 2, 0);
		let bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(2);
		shopBalance = await itemOne.balanceOf(shop.address, 1);
		shopBalance.should.be.equal(8);
		let finalBobPoints = await staker.connect(bob.signer).getAvailablePoints(bob.address);
		(bobPoints.add(50).sub(finalBobPoints)).should.be.equal(100);
	});

	// Verify that users cannot buy items that are out of stock.
	it('should not be able to buy items that are not in stock', async () => {
		let aliceBalance = await itemOne.balanceOf(alice.address, 1);
		aliceBalance.should.be.equal(10);
		await shop.connect(alice.signer).listItems([{
			assetType: 0,
			asset: '0x0000000000000000000000000000000000000000',
			price: 10
		}], [ itemOne.address ], [ [ 1 ] ], [ [ 10 ] ]);
		let inventoryCount = await shop.getInventoryCount();
		inventoryCount.should.be.equal(1);
		aliceBalance = await itemOne.balanceOf(alice.address, 1);
		aliceBalance.should.be.equal(0);
		let shopBalance = await itemOne.balanceOf(shop.address, 1);
		shopBalance.should.be.equal(10);

		// Let Bob spend his Staker points on an item.
		await shop.connect(bob.signer).purchaseItem(0, 10, 0);
		let bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(10);
		shopBalance = await itemOne.balanceOf(shop.address, 1);
		shopBalance.should.be.equal(0);

		// Carol should not be able to purchase any of the item.
		await expect(
			shop.connect(carol.signer).purchaseItem(0, 1, 0)
		).to.be.revertedWith('There is not enough of your desired item in stock to purchase.');
	});
});
