'use strict';

// Imports.
import { network, ethers } from 'hardhat';
import { expect } from 'chai';
import 'chai/register-should';

async function fastForward (amount) {
	const currentBlock = await ethers.provider.getBlockNumber();
	const block = await ethers.provider.getBlock(currentBlock);
	const timestamp = block.timestamp + amount;

	await network.provider.request({
		method: 'evm_setNextBlockTimestamp',
		params: [timestamp]
	});
	await network.provider.send('evm_mine');
}

describe('SuperAuction Variants', function () {
	let beneficiary, bidder_01, bidder_02;
	let FeeOwner, MockProxyRegistry, Item, SuperAuctionAccept, SuperAuctionReserve;
	const startingUri = 'starting-uri';
	let itemIds = [];
	let itemAmounts = [];

	before(async () => {
		const signers = await ethers.getSigners();
		const addresses = await Promise.all(signers.map(async signer => signer.getAddress()));
		beneficiary = { provider: signers[0].provider, signer: signers[0], address: addresses[0] };
		bidder_01 = { provider: signers[1].provider, signer: signers[1], address: addresses[1] };
		bidder_02 = { provider: signers[2].provider, signer: signers[2], address: addresses[2] };

		FeeOwner = await ethers.getContractFactory('FeeOwner');
		MockProxyRegistry = await ethers.getContractFactory('MockProxyRegistry');
		Item = await ethers.getContractFactory('Fee1155NFTLockable');

		SuperAuctionAccept = await ethers.getContractFactory('SuperAuctionAccept');
		SuperAuctionReserve = await ethers.getContractFactory('SuperAuctionReserve');

		for (let i = 1; i <= 10; i++) {
			itemIds.push(i);
			itemAmounts.push(1);
		}
	});

	let itemFeeOwner, proxyRegistry, item, superAuctionAccept, superAuctionReserve;
	beforeEach(async () => {
		//  setup item contract
		itemFeeOwner = await FeeOwner.connect(beneficiary.signer).deploy('10000', '10000');
		await itemFeeOwner.deployed();
		proxyRegistry = await MockProxyRegistry.connect(beneficiary.signer).deploy();
		await proxyRegistry.deployed();
		item = await Item.connect(beneficiary.signer).deploy(startingUri, itemFeeOwner.address, proxyRegistry.address);
		await item.deployed();

		superAuctionAccept = await SuperAuctionAccept.connect(beneficiary.signer).deploy(
			beneficiary.address,  //beneficiary
			item.address,  // item.address
			0, //groupId
			10000, //duration in seconds
			1000, //bidbuffer
			100000, //receiptbuffer
			ethers.utils.parseEther('1')//minBid
		);

		superAuctionReserve = await SuperAuctionReserve.connect(beneficiary.signer).deploy(
			beneficiary.address,  //beneficiary
			item.address,  // item.address
			0, //groupId
			10000, //duration in seconds
			1000, //bidbuffer
			ethers.utils.parseEther('10') //_reservePrice
		);
	});

	it('revert: bid too low', async () => {
		await expect(
			superAuctionAccept.connect(bidder_01.signer).bid({value: ethers.utils.parseEther('.5')})
		).to.be.revertedWith("Minimum bid amount not met.")
	});

	it('successful bid', async () => {
		await superAuctionAccept.connect(bidder_01.signer).bid({value: ethers.utils.parseEther('1')})

		expect(
			await superAuctionAccept.connect(bidder_02.signer).bid({value: ethers.utils.parseEther('3')})
		).to.changeEtherBalance(bidder_01.signer, ethers.utils.parseEther('1'))

	});

	it('revert: higher bid', async () => {
		await superAuctionAccept.connect(bidder_01.signer).bid({value: ethers.utils.parseEther('2')})
		await expect(
			superAuctionAccept.connect(bidder_02.signer).bid({value: ethers.utils.parseEther('1.5')})
		).to.be.revertedWith("There already is a higher bid.")
	});

	it('revert: auction is finished', async () => {
		await superAuctionAccept.connect(bidder_01.signer).bid({value: ethers.utils.parseEther('2')})

		const currentBlock = await ethers.provider.getBlockNumber();
		const block = await ethers.provider.getBlock(currentBlock);

		let duration = 100001;
		const timestamp = block.timestamp + duration;

		await network.provider.request({
			method: 'evm_setNextBlockTimestamp',
			params: [timestamp]
		});
		await network.provider.send('evm_mine');
		
		await expect(
			superAuctionAccept.connect(bidder_02.signer).bid({value: ethers.utils.parseEther('2.5')})
		).to.be.revertedWith("Auction already ended.")
	});

	it('extends auction during bid buffer', async () => {
		await superAuctionAccept.connect(bidder_01.signer).bid({value: ethers.utils.parseEther('2')})
		let bidBuffer = await superAuctionAccept.bidBuffer();
		let auctionEndTime = await superAuctionAccept.auctionEndTime();

		const currentBlock = await ethers.provider.getBlockNumber();
		const block = await ethers.provider.getBlock(currentBlock);

		let duration = (auctionEndTime - bidBuffer + 1) - block.timestamp;
		const timestamp = block.timestamp + duration;

		await network.provider.request({
			method: 'evm_setNextBlockTimestamp',
			params: [timestamp]
		});
		await network.provider.send('evm_mine');

		await superAuctionAccept.connect(bidder_02.signer).bid({value: ethers.utils.parseEther('3')})

		// console.log({
		// 	"bidBuffer": bidBuffer.toString(),
		// 	"auctionEndTime": auctionEndTime.toString(),
		// 	"duration": duration,
		// });

		let newAuctionEndTime = await superAuctionAccept.auctionEndTime();
		expect(	newAuctionEndTime ).to.equal(auctionEndTime.add(bidBuffer));
	});

	it('___', async () => {

	});

	// it('should allow owner to create items', async () => {
	// 	let createItemGroupTransaction = await item.connect(beneficiary.signer).createNFT(beneficiary.address, itemIds, itemAmounts, []);
	// 	let createItemGroupReceipt = await createItemGroupTransaction.wait();
	// 	let newItemGroupEvent = createItemGroupReceipt.events[createItemGroupReceipt.events.length - 1];
	// 	let newItemGroupId = newItemGroupEvent.args[0];
	// 	console.log({"groupid":newItemGroupId, "newItemGroupEvent":newItemGroupEvent});
	// });
	//
	// it('should allow owner to create items', async () => {
	// 	let createItemGroupTransaction = await item.connect(beneficiary.signer).createNFT(beneficiary.address, itemIds2, itemAmounts2, []);
	// 	let createItemGroupReceipt = await createItemGroupTransaction.wait();
	// 	let newItemGroupEvent = createItemGroupReceipt.events[createItemGroupReceipt.events.length - 1];
	// 	let newItemGroupId = newItemGroupEvent.args['itemGroupId'];
	// 	let newItemGroupSize = newItemGroupEvent.args['itemGroupSize'];
	// 	console.log({"groupid":newItemGroupId, "newItemGroupSize":newItemGroupSize});
	// });

});
