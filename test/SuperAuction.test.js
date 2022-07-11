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

async function getTime() {
    let blockNumBefore = await ethers.provider.getBlockNumber();
    let blockBefore = await ethers.provider.getBlock(blockNumBefore);
    let timestampBefore = blockBefore.timestamp;
    return timestampBefore;
}

const AssetType = Object.freeze({
    Unminted721:0,
    Unminted1155:1,
    Minted721:2,
    Minted1155:3
});

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const originalUri = "://ipfs/uri/{id}";
const contractUri1155 = "://ipfs/uri/{id}";


describe('===SuperAuction===', function () {
    let beneficiary, bidder_01, bidder_02, tokenHodler;
    let FeeOwner, MockProxyRegistry, mockProxyRegistry, Super721, Super1155, SuperAuction, super721, super1155, superAuction, ProxyRegistry;
    const startingUri = 'starting-uri';
    const auctionDuration = 10000;
    const bidbuffer = 1000;
    const receiptbuffer = 100000;
    const originalUri = "://ipfs/uri/{id}";
    const contractUri1155 = "://ipfs/uri/{id}";
    const originalUri721 = "://ipfs/uri/";
    let itemIds = [];
    let itemAmounts = [];
    let itemGroupId, shiftedItemGroupId;
    let itemGroupId2, shiftedItemGroupId2;
    let itemFeeOwner, proxyRegistry, item;
    let mintRight1155, UNIVERSAL1155, mintRight721, UNIVERSAL721;

    before(async () => {
        ProxyRegistry = await ethers.getContractFactory("ProxyRegistry");
        MockProxyRegistry = await ethers.getContractFactory("MockProxyRegistry");
        Super721 = await ethers.getContractFactory('Super721');
        Super1155 = await ethers.getContractFactory('Super1155');
        SuperAuction = await ethers.getContractFactory('SuperAuction');
    });
    
    beforeEach(async () => {
        
        [beneficiary, bidder_01, bidder_02, tokenHodler] = await ethers.getSigners();
        proxyRegistry = await ProxyRegistry.deploy();
        await proxyRegistry.deployed();
        mockProxyRegistry = await MockProxyRegistry.deploy();
        await mockProxyRegistry.deployed();

        super1155 = await Super1155.deploy(
            beneficiary.address,
            "Super1155",
            originalUri,
            contractUri1155,
            proxyRegistry.address
        );
        await super1155.deployed();

        super721 = await Super721.deploy(
            beneficiary.address,
            "Super721",
            "S721", 
            originalUri, 
            originalUri721, 
            mockProxyRegistry.address
        );
        await super721.deployed();


        mintRight1155 = await super1155.MINT();
        UNIVERSAL1155 = await super1155.UNIVERSAL();
        mintRight721 = await super721.MINT();
        UNIVERSAL721 = await super721.UNIVERSAL();

        itemGroupId = ethers.BigNumber.from(1);
        itemGroupId2 = ethers.BigNumber.from(2);
        shiftedItemGroupId = itemGroupId.shl(128);
        shiftedItemGroupId2 = itemGroupId2.shl(128);

        
        // configure group for mint
        await super1155.connect(beneficiary).configureGroup(itemGroupId, {
                name: 'PEPSI',
                supplyType: 1,
                supplyData: 10,
                itemType: 1,
                itemData: 0,
                burnType: 1,
                burnData: 5
        });

        await super1155.connect(beneficiary).configureGroup(itemGroupId2, {
            name: 'PEPSI',
            supplyType: 1,
            supplyData: 10,
            itemType: 1,
            itemData: 0,
            burnType: 1,
            burnData: 5
        });

        await super721.connect(beneficiary).configureGroup(itemGroupId, {
            name: 'GenericToken',
            supplyType: 0,
            supplyData: 20000,
            burnType: 1,
            burnData: 20000
        });

        await super721.connect(beneficiary).configureGroup(itemGroupId2, {
            name: 'GenericToken',
            supplyType: 0,
            supplyData: 20000,
            burnType: 1,
            burnData: 20000
        });
        //  mint items for hodler 
        await super721.connect(beneficiary).mintBatch(tokenHodler.address, [shiftedItemGroupId2], ethers.utils.id('a'));
        await super1155.connect(beneficiary).mintBatch(tokenHodler.address, [shiftedItemGroupId2], ["1"], "0x02");
        //console.log(info);
    });

    describe('SuperAuction for Unminted1155', function () { 
        beforeEach(async () => {
            // deploying of Auction with given params 
            superAuction = await SuperAuction.deploy(
                beneficiary.address,  //beneficiary
                super1155.address,  // 
                AssetType.Unminted1155, // AssetType 
                beneficiary.address, // owner of item 
                itemGroupId, //groupId
                auctionDuration, //duration in seconds
                bidbuffer, //bidbuffer
                receiptbuffer, //receiptbuffer
                ethers.utils.parseEther('1'), //minBid
                ethers.utils.parseEther('1.5') // reservePrice
            );
            await superAuction.deployed();

            await super1155.connect(beneficiary).setPermit(
                superAuction.address,
                UNIVERSAL1155, 
                mintRight1155,
                ethers.constants.MaxUint256
            );

            await super1155.connect(beneficiary).transferOwnership(superAuction.address);
        })

        it('revert: bid too low', async () => {
            await expect(
                superAuction.connect(bidder_01).bid({value: ethers.utils.parseEther('.5')})
            ).to.be.revertedWith("Minimum bid amount not met.")
        });
    
        it('successful bid', async () => {
            await superAuction.connect(bidder_01).bid({value: ethers.utils.parseEther('1')})
    
            expect(
                await superAuction.connect(bidder_02).bid({value: ethers.utils.parseEther('3')})
            ).to.changeEtherBalance(bidder_01, ethers.utils.parseEther('1'))
    
        });
    
        it('revert: higher bid', async () => {
            await superAuction.connect(bidder_01).bid({value: ethers.utils.parseEther('2')})
            await expect(
                superAuction.connect(bidder_02).bid({value: ethers.utils.parseEther('1.5')})
            ).to.be.revertedWith("There already is a higher bid.")
        });
    
        it('revert: auction is finished', async () => {
            await superAuction.connect(bidder_01).bid({value: ethers.utils.parseEther('2')})
    
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
                superAuction.connect(bidder_02).bid({value: ethers.utils.parseEther('2.5')})
            ).to.be.revertedWith("Auction already ended.")
        });
    
        it('extends auction during bid buffer and accept', async () => {
            await superAuction.connect(bidder_01).bid({value: ethers.utils.parseEther('2')})
            let bidCount = await superAuction.bidCount();
            expect( bidCount ).to.equal(1);
    
            let bidBuffer = await superAuction.bidBuffer();
            let auctionEndTime = await superAuction.auctionEndTime();
    
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
            await superAuction.connect(bidder_02).bid({value: bidAmount})
    
            bidCount = await superAuction.bidCount();
            expect( bidCount ).to.equal( 2 );
    
            let lastBid = await superAuction.bidHistory(bidCount - 1);
    
            expect( lastBid.bidder ).to.equal( bidder_02.address );
            expect( lastBid.amount ).to.equal( bidAmount );
    
            let newAuctionEndTime = await superAuction.auctionEndTime();
            expect(    newAuctionEndTime ).to.equal( auctionEndTime.add(bidBuffer) );
    
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [parseInt(newAuctionEndTime)]
            });
            await network.provider.send('evm_mine');
            await superAuction.connect(beneficiary).accept()
    
            await expect(
                superAuction.connect(beneficiary).accept()
            ).to.be.revertedWith( "The auction has already ended." )
    
            await expect(
                superAuction.connect(beneficiary).decline()
            ).to.be.revertedWith( "The auction has already ended." )
    
            let history = await superAuction.bidData();
    
            let data = await superAuction.auctionData();
    
            await expect(
                superAuction.connect(beneficiary).remainder()
            ).to.be.revertedWith( "Cannot claim remainder until auction has ended." )
    
            let receiptBuffer = await superAuction.receiptBuffer();
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [parseInt(newAuctionEndTime.add(receiptBuffer))]
            });
            await network.provider.send('evm_mine');
    
            await expect(
                superAuction.connect(beneficiary).returnHighestBid()
            ).to.be.revertedWith( "The auction has already ended." )
    
        });
    
        it('revert: cant accept before end', async () => {
            await expect(
                superAuction.connect(beneficiary).accept()
            ).to.be.revertedWith( "Auction not yet ended." )
        });
    
        it('revert: cant decline before end', async () => {
            await expect(
                superAuction.connect(beneficiary).decline()
            ).to.be.revertedWith( "Auction not yet ended." )
        });
    
        it('Decline final result ', async () => {
            await superAuction.connect(bidder_01).bid({value: ethers.utils.parseEther('2')})
            let auctionEndTime = await superAuction.auctionEndTime();
    
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [parseInt(auctionEndTime)]
            });
            await network.provider.send('evm_mine');
            await superAuction.connect(beneficiary).decline()
    
            await expect(
                superAuction.connect(bidder_02).returnHighestBid()
            ).to.be.revertedWith( "Auction not yet expired." )
        });
    
        it('Fade away and allow item clawback to beneficiary', async () => {
            await superAuction.connect(bidder_01).bid({value: ethers.utils.parseEther('2')})
            let auctionEndTime = await superAuction.auctionEndTime();
            let receiptBuffer = await superAuction.receiptBuffer();
            let receiptAllowed = auctionEndTime.add(receiptBuffer);
    
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [parseInt(receiptAllowed)]
            });
            await network.provider.send('evm_mine');
            let itemOwner = await super1155.owner();
    
            await expect(
                superAuction.connect(bidder_01).ownershipClawback()
            ).to.be.revertedWith( "You are not the original owner of this contract." )
    
            let returnedHighBid = await superAuction.connect(bidder_02).returnHighestBid();
    
            expect(
                await super1155.owner()
            ).to.equal(superAuction.address)
    
            let clawback = await superAuction.connect(beneficiary).ownershipClawback();
    
            expect(
                await super1155.owner()
            ).to.equal(beneficiary.address)
    
        });
    
        it('apocalyptic redemption', async () => {
            let contractBalance;
            await superAuction.connect(bidder_01).bid({value: ethers.utils.parseEther('2')})
    
            contractBalance = await bidder_01.provider.getBalance(superAuction.address);
    
            let auctionEndTime = await superAuction.auctionEndTime();
            let receiptBuffer = await superAuction.receiptBuffer();
            let receiptAllowed = auctionEndTime.add(receiptBuffer);
    
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [parseInt(receiptAllowed)]
            });
            await network.provider.send('evm_mine');
    
            expect(
                await superAuction.connect(beneficiary).remainder()
            ).to.changeEtherBalance(beneficiary, ethers.utils.parseEther('2'))
    
            expect(
                await bidder_01.provider.getBalance(superAuction.address)
            ).to.equal(0)
    
            await expect(
                superAuction.connect(beneficiary).returnHighestBid()
            ).to.be.revertedWith( "Cannot return 0 value" )
        });
    
        let auctionEndTime,
            receiptBuffer,
            receiptAllowed;
        describe('testing of auction ending', function () {
            beforeEach(async() => {
                auctionEndTime = await superAuction.auctionEndTime();
                receiptBuffer = await superAuction.receiptBuffer();
                receiptAllowed = auctionEndTime.add(receiptBuffer);
            });
    
            it('AuctionEnd, reserve price were met', async() => {
                await superAuction.connect(bidder_01).bid({value: ethers.utils.parseEther('2')})
                
                await network.provider.request({
                    method: 'evm_setNextBlockTimestamp',
                    params: [parseInt(receiptAllowed)]
                });
                await network.provider.send('evm_mine');
                
                await superAuction.auctionEnd();
            });
            
            it('AuctionEnd, reserve price were not met', async() => {
                await superAuction.connect(bidder_01).bid({value: ethers.utils.parseEther('1.2')})
                
                await network.provider.request({
                    method: 'evm_setNextBlockTimestamp',
                    params: [parseInt(receiptAllowed)]
                });
                await network.provider.send('evm_mine');
                
                await superAuction.auctionEnd();
            }); 
        });

    });

    describe('SuperAuction for Unminted721', function () {
        beforeEach(async () => {
            // deploying of Auction with given params 
            superAuction = await SuperAuction.deploy(
                beneficiary.address,  //beneficiary
                super721.address,  // item.address 
                AssetType.Unminted721, // AssetType 
                beneficiary.address, // owner of item 
                itemGroupId, //groupId
                auctionDuration, //duration in seconds
                bidbuffer, //bidbuffer
                receiptbuffer, //receiptbuffer
                ethers.utils.parseEther('1'), //minBid
                ethers.utils.parseEther('1.5') // reservePrice
            );
            await superAuction.deployed();

            await super721.connect(beneficiary).setPermit(
                superAuction.address,
                UNIVERSAL721, 
                mintRight721,
                ethers.constants.MaxUint256
            );

            await super721.connect(beneficiary).transferOwnership(superAuction.address);
        });

        it('extends auction during bid buffer and accept', async () => {
            await superAuction.connect(bidder_01).bid({value: ethers.utils.parseEther('2')})
            let bidCount = await superAuction.bidCount();
            expect( bidCount ).to.equal(1);
    
            let bidBuffer = await superAuction.bidBuffer();
            let auctionEndTime = await superAuction.auctionEndTime();
    
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
            await superAuction.connect(bidder_02).bid({value: bidAmount})
            
            bidCount = await superAuction.bidCount();
            expect( bidCount ).to.equal( 2 );
            
            let lastBid = await superAuction.bidHistory(bidCount - 1);
            
            expect( lastBid.bidder ).to.equal( bidder_02.address );
            expect( lastBid.amount ).to.equal( bidAmount );
            
            let newAuctionEndTime = await superAuction.auctionEndTime();
            expect(    newAuctionEndTime ).to.equal( auctionEndTime.add(bidBuffer) );
    
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [parseInt(newAuctionEndTime)]
            });
            await network.provider.send('evm_mine');
            await superAuction.connect(beneficiary).accept()
    
            await expect(
                superAuction.connect(beneficiary).accept()
            ).to.be.revertedWith( "The auction has already ended." )
    
            await expect(
                superAuction.connect(beneficiary).decline()
            ).to.be.revertedWith( "The auction has already ended." )
    
            let history = await superAuction.bidData();
    
            let data = await superAuction.auctionData();
            
            await expect(
                superAuction.connect(beneficiary).remainder()
            ).to.be.revertedWith( "Cannot claim remainder until auction has ended." )
            let receiptBuffer = await superAuction.receiptBuffer();
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [parseInt(newAuctionEndTime.add(receiptBuffer))]
            });
            await network.provider.send('evm_mine');
            
            await expect(
                superAuction.connect(beneficiary).returnHighestBid()
            ).to.be.revertedWith( "The auction has already ended." )
    
        });
    
        it('Fade away and allow item clawback to beneficiary', async () => {
            await superAuction.connect(bidder_01).bid({value: ethers.utils.parseEther('2')})
            let auctionEndTime = await superAuction.auctionEndTime();
            let receiptBuffer = await superAuction.receiptBuffer();
            let receiptAllowed = auctionEndTime.add(receiptBuffer);
    
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [parseInt(receiptAllowed)]
            });
            await network.provider.send('evm_mine');
            let itemOwner = await super721.owner();
    
            await expect(
                superAuction.connect(bidder_01).ownershipClawback()
            ).to.be.revertedWith( "You are not the original owner of this contract." )
    
            let returnedHighBid = await superAuction.connect(bidder_02).returnHighestBid();

            expect(
                await super721.owner()
            ).to.equal(superAuction.address)
    
            let clawback = await superAuction.connect(beneficiary).ownershipClawback();
    
            expect(
                await super721.owner()
            ).to.equal(beneficiary.address)
    
        });
      
        let auctionEndTime,
            receiptBuffer,
            receiptAllowed;
        describe('testing of auction ending', function () {
            beforeEach(async() => {
                auctionEndTime = await superAuction.auctionEndTime();
                receiptBuffer = await superAuction.receiptBuffer();
                receiptAllowed = auctionEndTime.add(receiptBuffer);
            });
    
            it('AuctionEnd, reserve price were met', async() => {
                await superAuction.connect(bidder_01).bid({value: ethers.utils.parseEther('2')})
                
                await network.provider.request({
                    method: 'evm_setNextBlockTimestamp',
                    params: [parseInt(receiptAllowed)]
                });
                await network.provider.send('evm_mine');
                
                await superAuction.auctionEnd();
            });
            
            it('AuctionEnd, reserve price were not met', async() => {
                await superAuction.connect(bidder_01).bid({value: ethers.utils.parseEther('1.2')})
                
                await network.provider.request({
                    method: 'evm_setNextBlockTimestamp',
                    params: [parseInt(receiptAllowed)]
                });
                await network.provider.send('evm_mine');
                
                await superAuction.auctionEnd();
            }); 
        });

    });


    describe('SuperAuction for Minted1155', function () {
        beforeEach(async () => {
            // deploying of Auction with given params 
            superAuction = await SuperAuction.deploy(
                beneficiary.address,  //beneficiary
                super1155.address,  // item.address 
                AssetType.Minted1155, // AssetType 
                tokenHodler.address, // owner of item 
                itemGroupId2, //groupId
                auctionDuration, //duration in seconds
                bidbuffer, //bidbuffer
                receiptbuffer, //receiptbuffer
                ethers.utils.parseEther('1'), //minBid
                ethers.utils.parseEther('1.5') // reservePrice
            );
            await superAuction.deployed();

            await super1155.connect(beneficiary).setPermit(
                superAuction.address,
                UNIVERSAL1155, 
                mintRight1155,
                ethers.constants.MaxUint256
            );

            await super1155.connect(beneficiary).transferOwnership(superAuction.address);
            await super1155.connect(tokenHodler).setApprovalForAll(superAuction.address, true);
            let balanceHodler = await super1155.balanceOf(tokenHodler.address, shiftedItemGroupId2.add(1));
        });
        let auctionEndTime,
            receiptBuffer,
            receiptAllowed;
        describe('testing of auction ending', function () {
            beforeEach(async() => {
                auctionEndTime = await superAuction.auctionEndTime();
                receiptBuffer = await superAuction.receiptBuffer();
                receiptAllowed = auctionEndTime.add(receiptBuffer);
            });
    
            it('AuctionEnd, reserve price were met', async() => {
                await superAuction.connect(bidder_01).bid({value: ethers.utils.parseEther('2')})
                
                await network.provider.request({
                    method: 'evm_setNextBlockTimestamp',
                    params: [parseInt(receiptAllowed)]
                });
                await network.provider.send('evm_mine');
                
                await superAuction.auctionEnd();
                expect(
                    await super1155.balanceOf(bidder_01.address, shiftedItemGroupId2.add(1))
                ).to.be.equal("1")
            });
            
            it('AuctionEnd, reserve price were not met', async() => {
                await superAuction.connect(bidder_01).bid({value: ethers.utils.parseEther('1.2')})
                
                await network.provider.request({
                    method: 'evm_setNextBlockTimestamp',
                    params: [parseInt(receiptAllowed)]
                });
                await network.provider.send('evm_mine');
                
                await superAuction.auctionEnd();
                expect(
                    await super1155.balanceOf(bidder_01.address, shiftedItemGroupId2.add(1))
                ).to.be.equal("0")
            }); 

            it('extends auction during bid buffer and accept', async () => {
                await superAuction.connect(bidder_01).bid({value: ethers.utils.parseEther('2')})
                let bidCount = await superAuction.bidCount();
                expect( bidCount ).to.equal(1);
        
                let bidBuffer = await superAuction.bidBuffer();
                let auctionEndTime = await superAuction.auctionEndTime();
        
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
                await superAuction.connect(bidder_02).bid({value: bidAmount})
                
                bidCount = await superAuction.bidCount();
                expect( bidCount ).to.equal( 2 );
                
                let lastBid = await superAuction.bidHistory(bidCount - 1);
                
                expect( lastBid.bidder ).to.equal( bidder_02.address );
                expect( lastBid.amount ).to.equal( bidAmount );
                
                let newAuctionEndTime = await superAuction.auctionEndTime();
                expect(    newAuctionEndTime ).to.equal( auctionEndTime.add(bidBuffer) );
        
                await network.provider.request({
                    method: 'evm_setNextBlockTimestamp',
                    params: [parseInt(newAuctionEndTime)]
                });
                await network.provider.send('evm_mine');
                await superAuction.connect(beneficiary).accept()
        
                await expect(
                    superAuction.connect(beneficiary).accept()
                ).to.be.revertedWith( "The auction has already ended." )
        
                await expect(
                    superAuction.connect(beneficiary).decline()
                ).to.be.revertedWith( "The auction has already ended." )
        
                let history = await superAuction.bidData();
                let data = await superAuction.auctionData();
                
                await expect(
                    superAuction.connect(beneficiary).remainder()
                ).to.be.revertedWith( "Cannot claim remainder until auction has ended." )
                let receiptBuffer = await superAuction.receiptBuffer();
                await network.provider.request({
                    method: 'evm_setNextBlockTimestamp',
                    params: [parseInt(newAuctionEndTime.add(receiptBuffer))]
                });
                await network.provider.send('evm_mine');
                
                await expect(
                    superAuction.connect(beneficiary).returnHighestBid()
                ).to.be.revertedWith( "The auction has already ended." )
        
            });

        });
    });

    describe('SuperAuction for Minted721', function () { 
        beforeEach(async () => {
            // deploying of Auction with given params 
            superAuction = await SuperAuction.deploy(
                beneficiary.address,  //beneficiary
                super721.address,  // item.address
                AssetType.Minted721, // AssetType 
                tokenHodler.address, // owner of item 
                itemGroupId2, //groupId
                auctionDuration, //duration in seconds
                bidbuffer, //bidbuffer
                receiptbuffer, //receiptbuffer
                ethers.utils.parseEther('1'), //minBid
                ethers.utils.parseEther('1.5') // reservePrice
            );
            await superAuction.deployed();
//
            await super721.connect(beneficiary).setPermit(
                superAuction.address,
                UNIVERSAL721, 
                mintRight721,
                ethers.constants.MaxUint256
            );
//
            await super721.connect(beneficiary).transferOwnership(superAuction.address);
            await super721.connect(tokenHodler).setApprovalForAll(superAuction.address, true);
        });

        let auctionEndTime,
            receiptBuffer,
            receiptAllowed;
        describe('testing of auction ending', function () {
            beforeEach(async() => {
                auctionEndTime = await superAuction.auctionEndTime();
                receiptBuffer = await superAuction.receiptBuffer();
                receiptAllowed = auctionEndTime.add(receiptBuffer);
            });
    
            it('AuctionEnd, reserve price were met', async() => {
                await superAuction.connect(bidder_01).bid({value: ethers.utils.parseEther('2')})
                
                await network.provider.request({
                    method: 'evm_setNextBlockTimestamp',
                    params: [parseInt(receiptAllowed)]
                });
                await network.provider.send('evm_mine');
                
                await superAuction.auctionEnd();
                expect(
                    await super721.balanceOfGroup(bidder_01.address, shiftedItemGroupId2)
                ).to.be.equal("1")
            });
            
            it('AuctionEnd, reserve price were not met', async() => {
                await superAuction.connect(bidder_01).bid({value: ethers.utils.parseEther('1.2')})
                
                await network.provider.request({
                    method: 'evm_setNextBlockTimestamp',
                    params: [parseInt(receiptAllowed)]
                });
                await network.provider.send('evm_mine');
                
                await superAuction.auctionEnd();
                expect(
                    await super721.balanceOfGroup(bidder_01.address, shiftedItemGroupId2)
                ).to.be.equal("0")
            });
        });

        it('extends auction during bid buffer and accept', async () => {
            await superAuction.connect(bidder_01).bid({value: ethers.utils.parseEther('2')})
            let bidCount = await superAuction.bidCount();
            expect( bidCount ).to.equal(1);
    
            let bidBuffer = await superAuction.bidBuffer();
            let auctionEndTime = await superAuction.auctionEndTime();
    
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
            await superAuction.connect(bidder_02).bid({value: bidAmount})
            
            bidCount = await superAuction.bidCount();
            expect( bidCount ).to.equal( 2 );
            
            let lastBid = await superAuction.bidHistory(bidCount - 1);
            
            expect( lastBid.bidder ).to.equal( bidder_02.address );
            expect( lastBid.amount ).to.equal( bidAmount );
            
            let newAuctionEndTime = await superAuction.auctionEndTime();
            expect(    newAuctionEndTime ).to.equal( auctionEndTime.add(bidBuffer) );
    
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [parseInt(newAuctionEndTime)]
            });
            await network.provider.send('evm_mine');
            await superAuction.connect(beneficiary).accept()
    
            await expect(
                superAuction.connect(beneficiary).accept()
            ).to.be.revertedWith( "The auction has already ended." )
    
            await expect(
                superAuction.connect(beneficiary).decline()
            ).to.be.revertedWith( "The auction has already ended." )
    
            let history = await superAuction.bidData();
            let data = await superAuction.auctionData();
            
            await expect(
                superAuction.connect(beneficiary).remainder()
            ).to.be.revertedWith( "Cannot claim remainder until auction has ended." )
            let receiptBuffer = await superAuction.receiptBuffer();
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [parseInt(newAuctionEndTime.add(receiptBuffer))]
            });
            await network.provider.send('evm_mine');
            
            await expect(
                superAuction.connect(beneficiary).returnHighestBid()
            ).to.be.revertedWith( "The auction has already ended." )
    
        });

    });

})
