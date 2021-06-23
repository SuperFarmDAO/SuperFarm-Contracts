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

		SuperAuctionAccept = await ethers.getContractFactory('SuperAuctionAcceptV2');
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
		await superAuctionAccept.deployed();
		await item.connect(beneficiary.signer).transferOwnership(superAuctionAccept.address)

		// superAuctionReserve = await SuperAuctionReserve.connect(beneficiary.signer).deploy(
		// 	beneficiary.address,  //beneficiary
		// 	item.address,  // item.address
		// 	0, //groupId
		// 	10000, //duration in seconds
		// 	1000, //bidbuffer
		// 	ethers.utils.parseEther('10') //_reservePrice
		// );
		// await superAuctionReserve.deployed();
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

	it('extends auction during bid buffer and accept', async () => {
		await superAuctionAccept.connect(bidder_01.signer).bid({value: ethers.utils.parseEther('2')})
		let bidCount = await superAuctionAccept.bidCount();
		expect( bidCount ).to.equal(1);

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

		let bidAmount = ethers.utils.parseEther('3');
		await superAuctionAccept.connect(bidder_02.signer).bid({value: bidAmount})

		bidCount = await superAuctionAccept.bidCount();
		expect( bidCount ).to.equal( 2 );

		let lastBid = await superAuctionAccept.bidHistory(bidCount - 1);

		expect( lastBid.bidder ).to.equal( bidder_02.address );
		expect( lastBid.amount ).to.equal( bidAmount );

		let newAuctionEndTime = await superAuctionAccept.auctionEndTime();
		expect(	newAuctionEndTime ).to.equal( auctionEndTime.add(bidBuffer) );

		await network.provider.request({
			method: 'evm_setNextBlockTimestamp',
			params: [parseInt(newAuctionEndTime)]
		});
		await network.provider.send('evm_mine');
		await superAuctionAccept.connect(beneficiary.signer).accept()

		await expect(
			superAuctionAccept.connect(beneficiary.signer).accept()
		).to.be.revertedWith( "The auction has already ended." )

		await expect(
			superAuctionAccept.connect(beneficiary.signer).decline()
		).to.be.revertedWith( "The auction has already ended." )

		let history = await superAuctionAccept.bidData();

		let data = await superAuctionAccept.auctionData();

		await expect(
			superAuctionAccept.connect(beneficiary.signer).remainder()
		).to.be.revertedWith( "Cannot claim remainder until auction has ended." )

		let receiptBuffer = await superAuctionAccept.receiptBuffer();
		await network.provider.request({
			method: 'evm_setNextBlockTimestamp',
			params: [parseInt(newAuctionEndTime + receiptBuffer)]
		});
		await network.provider.send('evm_mine');

		await expect(
			superAuctionAccept.connect(beneficiary.signer).returnHighestBid()
		).to.be.revertedWith( "The auction has already ended." )

	});

	it('revert: cant accept before end', async () => {
		await expect(
			superAuctionAccept.connect(beneficiary.signer).accept()
		).to.be.revertedWith( "Auction not yet ended." )
	});

	it('revert: cant decline before end', async () => {
		await expect(
			superAuctionAccept.connect(beneficiary.signer).decline()
		).to.be.revertedWith( "Auction not yet ended." )
	});

	it('Decline final result ', async () => {
		await superAuctionAccept.connect(bidder_01.signer).bid({value: ethers.utils.parseEther('2')})
		let auctionEndTime = await superAuctionAccept.auctionEndTime();

		await network.provider.request({
			method: 'evm_setNextBlockTimestamp',
			params: [parseInt(auctionEndTime)]
		});
		await network.provider.send('evm_mine');
		await superAuctionAccept.connect(beneficiary.signer).decline()

		await expect(
			superAuctionAccept.connect(bidder_02.signer).returnHighestBid()
		).to.be.revertedWith( "Auction not yet expired." )
	});

	it('Fade away and allow item clawback to beneficiary', async () => {
		await superAuctionAccept.connect(bidder_01.signer).bid({value: ethers.utils.parseEther('2')})
		let auctionEndTime = await superAuctionAccept.auctionEndTime();
		let receiptBuffer = await superAuctionAccept.receiptBuffer();
		let receiptAllowed = auctionEndTime.add(receiptBuffer);

		await network.provider.request({
			method: 'evm_setNextBlockTimestamp',
			params: [parseInt(receiptAllowed)]
		});
		await network.provider.send('evm_mine');
		let itemOwner = await item.owner();

		await expect(
			superAuctionAccept.connect(bidder_01.signer).ownershipClawback()
		).to.be.revertedWith( "You are not the original owner of this contract." )

		let returnedHighBid = await superAuctionAccept.connect(bidder_02.signer).returnHighestBid();

		expect(
			await item.owner()
		).to.equal(superAuctionAccept.address)

		let clawback = await superAuctionAccept.connect(beneficiary.signer).ownershipClawback();

		expect(
			await item.owner()
		).to.equal(beneficiary.address)

	});

	it('apocalyptic redemption', async () => {
		let contractBalance;
		await superAuctionAccept.connect(bidder_01.signer).bid({value: ethers.utils.parseEther('2')})

		contractBalance = await bidder_01.provider.getBalance(superAuctionAccept.address);

		let auctionEndTime = await superAuctionAccept.auctionEndTime();
		let receiptBuffer = await superAuctionAccept.receiptBuffer();
		let receiptAllowed = auctionEndTime.add(receiptBuffer);

		await network.provider.request({
			method: 'evm_setNextBlockTimestamp',
			params: [parseInt(receiptAllowed)]
		});
		await network.provider.send('evm_mine');

		expect(
			await superAuctionAccept.connect(beneficiary.signer).remainder()
		).to.changeEtherBalance(beneficiary.signer, ethers.utils.parseEther('2'))

		expect(
			await bidder_01.provider.getBalance(superAuctionAccept.address)
		).to.equal(0)

		await expect(
			superAuctionAccept.connect(beneficiary.signer).returnHighestBid()
		).to.be.revertedWith( "Cannot return 0 value" )
	});

});
