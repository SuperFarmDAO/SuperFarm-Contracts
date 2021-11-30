'use strict';

// Imports.
import { ethers } from 'hardhat';
import 'chai/register-should';

// Test the FarmRecords contract's ability to function as a proper registry.
describe('FarmRecords', function () {
	let alice, bob, dev;
	let FeeOwner, MockProxyRegistry, FarmTokenRecords, FarmStakerRecords, FarmShopRecords, FarmItemRecords, Token, Staker, Shop1155, Fee1155;
	before(async () => {
		const signers = await ethers.getSigners();
		const addresses = await Promise.all(signers.map(async signer => signer.getAddress()));
		alice = { provider: signers[0].provider, signer: signers[0], address: addresses[0] };
		bob = { provider: signers[1].provider, signer: signers[1], address: addresses[1] };
		dev = { provider: signers[3].provider, signer: signers[3], address: addresses[3] };

		// Create factories for deploying all required contracts using specified signers.
		FeeOwner = await ethers.getContractFactory('FeeOwner');
		MockProxyRegistry = await ethers.getContractFactory('MockProxyRegistry');
		FarmTokenRecords = await ethers.getContractFactory('FarmTokenRecords');
		FarmStakerRecords = await ethers.getContractFactory('FarmStakerRecords');
		FarmShopRecords = await ethers.getContractFactory('FarmShopRecords');
		FarmItemRecords = await ethers.getContractFactory('FarmItemRecords');
		Token = await ethers.getContractFactory('Token');
		Staker = await ethers.getContractFactory('Staker');
		Shop1155 = await ethers.getContractFactory('Shop1155');
		Fee1155 = await ethers.getContractFactory('Fee1155');
	});

	// Deploy a fresh set of smart contracts for testing with.
	let platformFeeOwner, proxyRegistry, farmTokenRecords, farmStakerRecords, farmShopRecords, farmItemRecords;
	beforeEach(async () => {
		platformFeeOwner = await FeeOwner.connect(dev.signer).deploy('2500', '10000');
		await platformFeeOwner.deployed();
		proxyRegistry = await MockProxyRegistry.connect(dev.signer).deploy();
		await proxyRegistry.deployed();
		farmTokenRecords = await FarmTokenRecords.connect(dev.signer).deploy();
		await farmTokenRecords.deployed();
		farmStakerRecords = await FarmStakerRecords.connect(dev.signer).deploy();
		await farmStakerRecords.deployed();
		farmShopRecords = await FarmShopRecords.connect(dev.signer).deploy(platformFeeOwner.address);
		await farmShopRecords.deployed();
		farmItemRecords = await FarmItemRecords.connect(dev.signer).deploy(proxyRegistry.address);
		await farmItemRecords.deployed();
	});

	// Verify that the FarmTokenRecords contract can create Tokens for users.
	it('should allow users to create Tokens', async () => {
		let tokenCreatedTransaction = await farmTokenRecords.connect(alice.signer)
			.createToken('Token', 'TOK', ethers.utils.parseEther('1000000000'), [], []);
		let tokenCreatedReceipt = await tokenCreatedTransaction.wait();
		let newTokenEvent = tokenCreatedReceipt.events[2];
		let newTokenAddress = newTokenEvent.args[0];
		let tokenCount = await farmTokenRecords.getTokenCount(alice.address);
		tokenCount.should.be.equal(1);
		let tokenRecord = await farmTokenRecords.tokenRecords(alice.address, 0);
		tokenRecord.should.be.equal(newTokenAddress);

		// Verify that the new Token was correctly initialized.
		let newToken = await Token.attach(newTokenAddress);
		let name = await newToken.name();
		name.should.be.equal('Token');
		let symbol = await newToken.symbol();
		symbol.should.be.equal('TOK');
		let cap = await newToken.cap();
		cap.should.be.equal(ethers.utils.parseEther('1000000000'));
		let totalSupply = await newToken.totalSupply();
		totalSupply.should.be.equal(0);
		let owner = await newToken.owner();
		owner.should.be.equal(alice.address);
	});

	// Verify that the FarmTokenRecords contract can create Tokens with direct mint.
	it('should allow users to create Tokens with direct mint', async () => {
		let tokenCreatedTransaction = await farmTokenRecords.connect(alice.signer)
			.createToken('Token', 'TOK', ethers.utils.parseEther('1000000000'), [ alice.address, bob.address ], [ ethers.utils.parseEther('1000'), ethers.utils.parseEther('2000') ]);
		let tokenCreatedReceipt = await tokenCreatedTransaction.wait();
		let newTokenEvent = tokenCreatedReceipt.events[4];
		let newTokenAddress = newTokenEvent.args[0];
		let tokenCount = await farmTokenRecords.getTokenCount(alice.address);
		tokenCount.should.be.equal(1);
		let tokenRecord = await farmTokenRecords.tokenRecords(alice.address, 0);
		tokenRecord.should.be.equal(newTokenAddress);

		// Verify that the new Token was correctly initialized.
		let newToken = await Token.attach(newTokenAddress);
		let name = await newToken.name();
		name.should.be.equal('Token');
		let symbol = await newToken.symbol();
		symbol.should.be.equal('TOK');
		let cap = await newToken.cap();
		cap.should.be.equal(ethers.utils.parseEther('1000000000'));
		let totalSupply = await newToken.totalSupply();
		totalSupply.should.be.equal(ethers.utils.parseEther('3000'));
		let owner = await newToken.owner();
		owner.should.be.equal(alice.address);
		let aliceBalance = await newToken.balanceOf(alice.address);
		aliceBalance.should.be.equal(ethers.utils.parseEther('1000'));
		let bobBalance = await newToken.balanceOf(bob.address);
		bobBalance.should.be.equal(ethers.utils.parseEther('2000'));
	});

	// Verify that the FarmStakerRecords contract can create Stakers for users.
	it('should allow users to create Stakers', async () => {
		let tokenCreatedTransaction = await farmTokenRecords.connect(alice.signer)
			.createToken('Token', 'TOK', ethers.utils.parseEther('1000000000'), [ alice.address, bob.address ], [ ethers.utils.parseEther('1000'), ethers.utils.parseEther('2000') ]);
		let tokenCreatedReceipt = await tokenCreatedTransaction.wait();
		let newTokenEvent = tokenCreatedReceipt.events[4];
		let newTokenAddress = newTokenEvent.args[0];

		// Create a Staker based on the recent Token.
		let stakerCreatedTransaction = await farmStakerRecords.connect(alice.signer)
			.createFarm('Staker', newTokenAddress, [
				{ blockNumber: 0, rate: ethers.utils.parseEther('1') }
			], [
				{ blockNumber: 0, rate: 1 }
			], [
				{ poolToken: newTokenAddress, tokenStrength: 100, pointStrength: 100 }
			]);
		let stakerCreatedReceipt = await stakerCreatedTransaction.wait();
		let newStakerEvent = stakerCreatedReceipt.events[3];
		let newStakerAddress = newStakerEvent.args[0];
		let stakerCount = await farmStakerRecords.getFarmCount(alice.address);
		stakerCount.should.be.equal(1);
		let farmRecord = await farmStakerRecords.farmRecords(alice.address, 0);
		farmRecord.should.be.equal(newStakerAddress);

		// Verify that the new Staker was correctly initialized.
		let newStaker = await Staker.attach(newStakerAddress);
		let name = await newStaker.name();
		name.should.be.equal('Staker');
		let token = await newStaker.token();
		token.should.be.equal(newTokenAddress);
	});

	// Verify that the FarmShopRecords owner can update its platform FeeOwner.
	it('should allow owner to update the platform FeeOwner', async () => {
		let currentPlatformFeeOwner = await farmShopRecords.platformFeeOwner();
		currentPlatformFeeOwner.should.be.equal(platformFeeOwner.address);
		let newPlatformFeeOwner = await FeeOwner.connect(dev.signer).deploy('2500', '10000');
		await newPlatformFeeOwner.deployed();
		await farmShopRecords.changePlatformFeeOwner(newPlatformFeeOwner.address);
		currentPlatformFeeOwner = await farmShopRecords.platformFeeOwner();
		currentPlatformFeeOwner.should.be.equal(newPlatformFeeOwner.address);
	});

	// Verify that the FarmShopRecords contract can create Shops for users.
	it('should allow users to create Shops', async () => {
		let shopCreatedTransaction = await farmShopRecords.connect(alice.signer)
			.createShop('Shop', []);
		let shopCreatedReceipt = await shopCreatedTransaction.wait();
		let newShopEvent = shopCreatedReceipt.events[2];
		let newShopAddress = newShopEvent.args[0];
		let shopCount = await farmShopRecords.getShopCount(alice.address);
		shopCount.should.be.equal(1);
		let shopRecord = await farmShopRecords.shopRecords(alice.address, 0);
		shopRecord.should.be.equal(newShopAddress);

		// Verify that the new Shop was correctly initialized.
		let newShop = await Shop1155.attach(newShopAddress);
		let name = await newShop.name();
		name.should.be.equal('Shop');
	});

	// Verify that the FarmShopRecords contract can create Shops with Stakers.
	it('should allow users to create Shops with Stakers', async () => {
		let tokenCreatedTransaction = await farmTokenRecords.connect(alice.signer)
			.createToken('Token', 'TOK', ethers.utils.parseEther('1000000000'), [ alice.address, bob.address ], [ ethers.utils.parseEther('1000'), ethers.utils.parseEther('2000') ]);
		let tokenCreatedReceipt = await tokenCreatedTransaction.wait();
		let newTokenEvent = tokenCreatedReceipt.events[4];
		let newTokenAddress = newTokenEvent.args[0];

		// Create a Staker based on the recent Token.
		let stakerCreatedTransaction = await farmStakerRecords.connect(alice.signer)
			.createFarm('Staker', newTokenAddress, [
				{ blockNumber: 0, rate: ethers.utils.parseEther('1') }
			], [
				{ blockNumber: 0, rate: 1 }
			], [
				{ poolToken: newTokenAddress, tokenStrength: 100, pointStrength: 100 }
			]);
		let stakerCreatedReceipt = await stakerCreatedTransaction.wait();
		let newStakerEvent = stakerCreatedReceipt.events[3];
		let newStakerAddress = newStakerEvent.args[0];

		// Create a Shop using the recent Staker.
		let shopCreatedTransaction = await farmShopRecords.connect(alice.signer)
			.createShop('Shop', [ newStakerAddress ]);
		let shopCreatedReceipt = await shopCreatedTransaction.wait();
		let newShopEvent = shopCreatedReceipt.events[2];
		let newShopAddress = newShopEvent.args[0];
		let shopCount = await farmShopRecords.getShopCount(alice.address);
		shopCount.should.be.equal(1);
		let shopRecord = await farmShopRecords.shopRecords(alice.address, 0);
		shopRecord.should.be.equal(newShopAddress);

		// Verify that the new Shop was correctly initialized.
		let newShop = await Shop1155.attach(newShopAddress);
		let name = await newShop.name();
		name.should.be.equal('Shop');
		let stakerCount = await newShop.getStakerCount();
		stakerCount.should.be.equal(1);
		let stakerDetails = await newShop.stakers(0);
		stakerDetails.should.be.equal(newStakerAddress);
	});

	// Verify that the FarmItemRecords contract can create Items for users.
	it('should allow users to create Items', async () => {
		let itemCreatedTransaction = await farmItemRecords.connect(alice.signer)
			.createItem('test-uri', '10', [ 1, 1, 1, 1, 1 ], [ 1, 1, 1, 1, 1 ], [ alice.address, alice.address, alice.address, alice.address, alice.address ], []);
		let itemCreatedReceipt = await itemCreatedTransaction.wait();
		let newItemEvent = itemCreatedReceipt.events[itemCreatedReceipt.events.length - 1];
		let newItemAddress = newItemEvent.args[0];
		let itemCount = await farmItemRecords.getItemCount(alice.address);
		itemCount.should.be.equal(1);
		let itemRecord = await farmItemRecords.itemRecords(alice.address, 0);
		itemRecord.should.be.equal(newItemAddress);

		// Verify that the new Item was correctly initialized.
		let newItem = await Fee1155.attach(newItemAddress);
		let metadataUri = await newItem.metadataUri();
		metadataUri.should.be.equal('test-uri');
		let newItemOwner = await newItem.owner();
		newItemOwner.should.be.equal(alice.address);
		let newItemRoyaltyFeeOwner = await FeeOwner.attach(await newItem.feeOwner());
		let newItemRoyaltyOwner = await newItemRoyaltyFeeOwner.owner();
		newItemRoyaltyOwner.should.be.equal(alice.address);
		let itemBalance = await newItem.balanceOf(alice.address, 1);
		itemBalance.should.be.equal(1);
		itemBalance = await newItem.balanceOf(alice.address, 2);
		itemBalance.should.be.equal(1);
		itemBalance = await newItem.balanceOf(alice.address, 3);
		itemBalance.should.be.equal(1);
		itemBalance = await newItem.balanceOf(alice.address, 4);
		itemBalance.should.be.equal(1);
		itemBalance = await newItem.balanceOf(alice.address, 5);
		itemBalance.should.be.equal(1);
	});

	// Item creation and listing should support proper lookup.
	it('should be possible to find shop inventory with item prices', async () => {
		let tokenCreatedTransaction = await farmTokenRecords.connect(alice.signer)
			.createToken('Token', 'TOK', ethers.utils.parseEther('1000000000'), [ alice.address, bob.address ], [ ethers.utils.parseEther('1000'), ethers.utils.parseEther('2000') ]);
		let tokenCreatedReceipt = await tokenCreatedTransaction.wait();
		let newTokenEvent = tokenCreatedReceipt.events[4];
		let newTokenAddress = newTokenEvent.args[0];

		// Create a Staker based on the recent Token.
		let stakerCreatedTransaction = await farmStakerRecords.connect(alice.signer)
			.createFarm('Staker', newTokenAddress, [
				{ blockNumber: 0, rate: ethers.utils.parseEther('1') }
			], [
				{ blockNumber: 0, rate: 1 }
			], [
				{ poolToken: newTokenAddress, tokenStrength: 100, pointStrength: 100 }
			]);
		let stakerCreatedReceipt = await stakerCreatedTransaction.wait();
		let newStakerEvent = stakerCreatedReceipt.events[3];
		let newStakerAddress = newStakerEvent.args[0];

		// Create a Shop using the recent Staker.
		let shopCreatedTransaction = await farmShopRecords.connect(alice.signer)
			.createShop('Shop', [ newStakerAddress ]);
		let shopCreatedReceipt = await shopCreatedTransaction.wait();
		let newShopEvent = shopCreatedReceipt.events[2];
		let newShopAddress = newShopEvent.args[0];
		let shopCount = await farmShopRecords.getShopCount(alice.address);
		shopCount.should.be.equal(1);
		let shopRecord = await farmShopRecords.shopRecords(alice.address, 0);
		shopRecord.should.be.equal(newShopAddress);

		let itemCreatedTransaction = await farmItemRecords.connect(alice.signer)
			.createItem('https://superfarm-images.s3.amazonaws.com/745c28f4-17dd-4922-a2f0-2e9008f9c6b3/{id}.json', '10', [ 1, 1, 1 ], [ 1, 1, 1 ], [ alice.address, alice.address, alice.address ], []);
		let itemCreatedReceipt = await itemCreatedTransaction.wait();
		let newItemEvent = itemCreatedReceipt.events[itemCreatedReceipt.events.length - 1];
		let newItemAddress = newItemEvent.args[0];

		let itemContract = await Fee1155.attach(newItemAddress);
		let approvalTransaction = await itemContract.setApprovalForAll(newShopAddress, true);
		await approvalTransaction.wait();

		let shopContract = await Shop1155.attach(newShopAddress);
		let listingTransaction = await shopContract.listItems([
			{
				assetType: 1,
				asset: '0x0000000000000000000000000000000000000000',
				price: '100000000000000000'
			},
			{
				assetType: 0,
				asset: '0x0000000000000000000000000000000000000000',
				price: '1000'
			}
		], [ newItemAddress ], [ [ 1, 2, 3 ] ], [ [ 1, 1, 1 ] ]);
		await listingTransaction.wait();

		let shopInventoryCount = await shopContract.getInventoryCount();
		for (let j = 0; j < shopInventoryCount; j++) {
			let pricePairLength = await shopContract.pricePairLengths(j);
			pricePairLength.should.be.equal(2);
		}
	});
});
