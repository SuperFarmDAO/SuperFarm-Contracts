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

const AssetType = Object.freeze({
    Unminted721:0,
    Unminted1155:1,
    Minted721:2,
    Minted1155:3
});

// TODO write tests for unminted1155 first 

// funcs list to cover :
//      bid()
//      accept()
//      decline()
//      returnHighestBid()
//      withdraw()
//      auctionEnd()
//      ownershipClawback()


describe('SuperAuction Variants', function () {
    let beneficiary, bidder_01, bidder_02;
    let FeeOwner, MockProxyRegistry, Super721, Super1155, SuperAuctionAccept, SuperAuctionReserve;
    const startingUri = 'starting-uri';
    const auctionDuration = 10000;
    const bidbuffer = 1000;
    const receiptbuffer = 100000;
    let itemIds = [];
    let itemAmounts = [];

    before(async () => {
        beneficiary, bidder_01, bidder_02 = await ethers.getSigners();
        
        this.ProxyRegistry = await ethers.getContractFactory("ProxyRegistry");
        Super721 = await ethers.getContractFactory('Super721');
        Super1155 = await ethers.getContractFactory('Super1155');
        
        SuperAuction = await ethers.getContractFactory('SuperAuction');
        
    });
    
    let itemFeeOwner, proxyRegistry, item, superAuctionAccept, superAuctionReserve;
    beforeEach(async () => {

        //  setup item contract
        proxyRegistry = await this.ProxyRegistry.deploy();
        await proxyRegistry.deployed();
        
        super1155 = await this.Super1155.deploy(
            owner.address,
            "Super1155",
            originalUri,
            contractUri1155,
            proxyRegistry.address
        );
        await super1155.deployed();

        superAuctionAccept = await SuperAuction.connect(beneficiary.signer).deploy(
            beneficiary.address,  //beneficiary
            item.address,  // item.address - > address of contract TODO
            AssetType.Unminted1155 , // AssetType 
            0, //groupId
            auctionDuration, //duration in seconds
            bidbuffer, //bidbuffer
            receiptbuffer, //receiptbuffer
            ethers.utils.parseEther('1')//minBid
        );
        await superAuctionAccept.deployed();
        await item.connect(beneficiary.signer).transferOwnership(superAuctionAccept.address)

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
        expect(    newAuctionEndTime ).to.equal( auctionEndTime.add(bidBuffer) );

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
