"use strict";

// Imports.
import { ethers, network, waffle } from "hardhat";
import { expect } from "chai";
import "chai/register-should";

const DATA = "0x02";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const AssetType = Object.freeze({
    None: 0,
    Eth: 1,
    ERC20: 2,
    ERC1155: 3,
    ERC721: 4
});

// ENUMS in Super721
const SupplyType721 = Object.freeze({
    Capped: 0,
    Uncapped: 1,
    Flexible: 2
});

const BurnType721 = Object.freeze({
    None: 0,
    Burnable: 1,
    Replenishable: 2
});

// ENUMS in Super1155
const SupplyType1155 = Object.freeze({
    Capped: 0 ,
    Uncapped: 1 ,
    Flexible: 2 
});

const ItemType1155 = Object.freeze({
    Nonfungible: 0,
    Fungible: 1,
    Semifungible: 2
  });

const BurnType1155 = Object.freeze({
    None: 0,
    Burnable: 1,
    Replenishable: 2
});

async function getTime() {
    let blockNumBefore = await ethers.provider.getBlockNumber();
    let blockBefore = await ethers.provider.getBlock(blockNumBefore);
    let timestampBefore = blockBefore.timestamp;
    return timestampBefore;
}

// Test the TokenVault with Timelock and MultiSigWallet functionality.
describe("===TokenVault Timelock MultiSig=== ", function () {
    let admin, alice, bob, carol, dev;
    let Token,
        MultiSigWallet,
        Timelock,
        TokenVault,
        Super721,
        Super1155,
        ProxyRegistry;
    let transValue = ethers.utils.parseEther("0");
    let prov = waffle.provider;        
    let TimeNow = Math.floor(Date.now() / 1000);
    let transactionValue = ethers.utils.parseEther("0");
    let signatureMSG = "";
    let etherBalanceVault = ethers.utils.parseEther('500');

    before(async () => {
        [admin, alice, bob, carol, dev] = await ethers.getSigners();
        // Create factories for deploying all required contracts using specified signers.
        Token = await ethers.getContractFactory("Token");
        MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
        Timelock = await ethers.getContractFactory("Timelock");
        TokenVault = await ethers.getContractFactory("TokenVault");
        Super721 = await ethers.getContractFactory("Super721");
        Super1155 = await ethers.getContractFactory("Super1155");
        ProxyRegistry = await ethers.getContractFactory("ProxyRegistry");
        await ethers.provider.send("evm_setNextBlockTimestamp", [TimeNow])
        await ethers.provider.send("evm_mine")
    });

    // Deploy a fresh set of smart contracts for testing with.
    let token,
        multiSig,
        timeLock,
        tokenVault,
        super721,
        super1155,
        super721Additional,
        super1155Additional,
        proxyRegistry;
    let itemGroupId,
        itemGroupId2,
        shiftedItemGroupId,
        shiftedItemGroupId2;
    
    beforeEach(async () => {
        token = await Token.connect(admin).deploy(
            "Token",
            "TOK",
            ethers.utils.parseEther("1000000000")
        );
        await token.deployed();
        multiSig = await MultiSigWallet.connect(admin).deploy(
            [alice.address, bob.address, carol.address],
            2
        );
        await multiSig.deployed();
        timeLock = await Timelock.connect(admin).deploy(
            multiSig.address,
            "172900"
        );
        await timeLock.deployed();
        tokenVault = await TokenVault.connect(admin).deploy(
            "Vault One",
            token.address,
            multiSig.address,
            multiSig.address,
            3
        );
        await tokenVault.deployed();
        proxyRegistry = await ProxyRegistry.connect(admin).deploy();
        await proxyRegistry.deployed();
        super721 = await Super721.connect(admin).deploy(
            admin.address,
            "SUPER721",
            "S721",
            "URI_SUPER721",
            "URI_SUPER721",
            proxyRegistry.address
        );
        await super721.deployed();
        super721Additional = await Super721.connect(admin).deploy(
            admin.address,
            "SUPER721ADD",
            "S721A",
            "URI_SUPER721A",
            "URI_SUPER721A",
            proxyRegistry.address
        );
        await super721Additional.deployed();
        super1155 = await Super1155.connect(admin).deploy(
            admin.address,
            "SUPER1155",
            "URI_SUPER1155",
            "URI_SUPER1155",
            proxyRegistry.address
        );
        await super1155.deployed();
        super1155Additional = await Super1155.connect(admin).deploy(
            admin.address,
            "SUPER1155ADD",
            "URI_SUPER1155A",
            "URI_SUPER1155A",
            proxyRegistry.address
        );
        await super1155Additional.deployed();

        itemGroupId = ethers.BigNumber.from(1);
        itemGroupId2 = ethers.BigNumber.from(2);
        shiftedItemGroupId = itemGroupId.shl(128);
        shiftedItemGroupId2 = itemGroupId2.shl(128);

        await super721.connect(admin).configureGroup(
            itemGroupId, 
            {
                name: 'NFT',
                supplyType: SupplyType721.Capped,
                supplyData: 20000,
                burnType: BurnType721.Burnable,
                burnData: 100
            }
        );

        await super721.connect(admin).configureGroup(
            itemGroupId2,
            {
                name: 'NFT2',
                supplyType: SupplyType721.Capped,
                supplyData: 20000,
                burnType: BurnType721.Burnable, // what if 0/none? Update: 0 is unburnable
                burnData: 100
            }
        );

        await super721.connect(admin).mintBatch( tokenVault.address, [shiftedItemGroupId], ethers.utils.id('a'));
        // await super721.connect(dev).mintBatch( tokenVault.address, [shiftedItemGroupId2], ethers.utils.id('b'));

        await super1155.connect(admin).configureGroup(
            itemGroupId,
            {
                name: 'PEPSI',
                supplyType: SupplyType1155.Capped,
                supplyData: 10,
                itemType: ItemType1155.Fungible,
                itemData: 0,
                burnType: BurnType1155.Burnable,
                burnData: 10
            }
        );
        
        await super1155.connect(admin).configureGroup(
            itemGroupId2,
            {
                name: 'COLA',
                supplyType: SupplyType1155.Capped,
                supplyData: 15,
                itemType: ItemType1155.Nonfungible,
                itemData: 0,
                burnType: BurnType1155.Burnable,
                burnData: 5
            }
        );
        
        let setUriRight = await super721.SET_URI();
        let UNIVERSAL = await super721.UNIVERSAL();
        let BURN = await super721.BURN();

        // Mint fungible item
        await super1155.connect(admin).mintBatch(tokenVault.address, [shiftedItemGroupId], ["10"], DATA);
        await super1155.connect(admin).mintBatch(tokenVault.address, [shiftedItemGroupId2], ["1"], DATA);

        // TODO burn right for super721 and super1155
        await super721.connect(admin).setPermit(
            tokenVault.address,
            UNIVERSAL, 
            BURN,
            ethers.constants.MaxUint256
        );

        await super1155.connect(admin).setPermit(
            tokenVault.address,
            UNIVERSAL, 
            BURN,
            ethers.constants.MaxUint256
        );

        let works = await super721.hasRight(tokenVault.address, UNIVERSAL, BURN);

        await expect( dev.sendTransaction({
            to: tokenVault.address,
            value: etherBalanceVault
        })).to.emit(tokenVault, 'Receive').withArgs(dev.address, etherBalanceVault);

        await tokenVault.connect(admin).transferOwnership(timeLock.address);
        await token
            .connect(admin)
            .mint(tokenVault.address, ethers.utils.parseEther("1000000000"));
         
    });
    
    // Verify that the multisignature wallet can send tokens from the vault.
    it("should allow the multisig to send tokens via timelock", async () => {
        let devBalance = await token.balanceOf(dev.address);
        devBalance.should.be.equal(0);
        let eta = Math.floor(Date.now() / 1000) + 180000;

        // Generate the raw transaction for releasing tokens from the vault.
        let releaseTokenTransaction =
            await tokenVault.populateTransaction.sendTokens(
                [dev.address],
                [token.address],
                [{
                    assetType: AssetType.ERC20,
                    amounts: [ethers.utils.parseEther("1000")], 
                    ids: [] 
                }]
            );

        // Generate the raw transaction for enqueuing token release with the time lock.
        let enqueueTransaction =
            await timeLock.populateTransaction.queueTransaction(
                tokenVault.address,
                ethers.utils.parseEther("0"),
                "",
                releaseTokenTransaction.data,
                eta
            );

        // Generate the raw transaction for executing token release with the time lock.
        let executeTransaction =
            await timeLock.populateTransaction.executeTransaction(
                tokenVault.address,
                ethers.utils.parseEther("0"),
                "",
                releaseTokenTransaction.data,
                eta
            );

        // Submit the token release transaction with the first multisigner.
        await multiSig
            .connect(alice)
            .submitTransaction(
                timeLock.address,
                ethers.utils.parseEther("0"),
                enqueueTransaction.data
            );
        let transactionData = await multiSig.transactions(0);
        transactionData.destination.should.be.equal(timeLock.address);
        transactionData.value.should.be.equal(ethers.utils.parseEther("0"));
        transactionData.data.should.be.equal(enqueueTransaction.data);
        transactionData.executed.should.be.equal(false);
        let aliceConfirmation = await multiSig.confirmations(0, alice.address);
        aliceConfirmation.should.be.equal(true);

        // Confirm the token release transaction with the second multisigner.
        let confirmationTransaction = await multiSig.connect(bob).confirmTransaction(0);
        let confirmationReceipt = await confirmationTransaction.wait();
        let executionEvent =
            confirmationReceipt.events[confirmationReceipt.events.length -1];
        executionEvent.event.should.be.equal("Execution");
        transactionData = await multiSig.transactions(0);
        transactionData.destination.should.be.equal(timeLock.address);
        transactionData.value.should.be.equal(ethers.utils.parseEther("0"));
        transactionData.data.should.be.equal(enqueueTransaction.data);
        transactionData.executed.should.be.equal(true);
        let bobConfirmation = await multiSig.confirmations(0, bob.address);
        bobConfirmation.should.be.equal(true);

        // Confirm that the tokens have not been sent yet.
        devBalance = await token.balanceOf(dev.address);
        devBalance.should.be.equal(0);
 
        // Submit the token release execution transaction with the first multisigner.
        await multiSig
            .connect(alice)
            .submitTransaction(
                timeLock.address,
                ethers.utils.parseEther("0"),
                executeTransaction.data
            );
        transactionData = await multiSig.transactions(1);
        transactionData.destination.should.be.equal(timeLock.address);
        transactionData.value.should.be.equal(ethers.utils.parseEther("0"));
        transactionData.data.should.be.equal(executeTransaction.data);
        transactionData.executed.should.be.equal(false);
        aliceConfirmation = await multiSig.confirmations(1, alice.address);
        aliceConfirmation.should.be.equal(true);

        // Confirm that the time lock may not be executed prematurely.
        confirmationTransaction = await multiSig
            .connect(bob)
            .confirmTransaction(1);
        confirmationReceipt = await confirmationTransaction.wait();
        executionEvent =
            confirmationReceipt.events[confirmationReceipt.events.length - 1];
        executionEvent.event.should.be.equal("ExecutionFailure");
        transactionData = await multiSig.transactions(1);
        transactionData.destination.should.be.equal(timeLock.address);
        transactionData.value.should.be.equal(ethers.utils.parseEther("0"));
        transactionData.data.should.be.equal(executeTransaction.data);
        transactionData.executed.should.be.equal(false);
        bobConfirmation = await multiSig.confirmations(1, bob.address);
        bobConfirmation.should.be.equal(true);

        // Wait for the time lock to mature.
        let currentTime = 200500;
        ethers.provider.send("evm_increaseTime", [currentTime]);
        ethers.provider.send("evm_mine");

        // Reset the second multisig holder's confirmation.
        await multiSig.connect(bob).revokeConfirmation(1);
        console.log();
        let confCount = await multiSig.getConfirmationCount(1);
        console.log("Confirmations: " + confCount);
        let owners = await multiSig.getOwners();
        let transCount = await multiSig.getTransactionCount(true, true);
        console.log(owners.toString());
        console.log(transCount.toString());

        // Confirm that the time lock may now be executed.
        console.log(1);
        confirmationTransaction = await multiSig.connect(bob).confirmTransaction(1);

        confCount = await multiSig.getConfirmationCount(1);
        console.log("Confirmations: " + confCount);
        
        devBalance = await token.balanceOf(dev.address);
        devBalance.should.be.equal(ethers.utils.parseEther("1000"));
        
        confirmationReceipt = await confirmationTransaction.wait();
        executionEvent =
            confirmationReceipt.events[confirmationReceipt.events.length - 1];
        executionEvent.event.should.be.equal("Execution");

        // TODO time now update  
    });

    it("should update panic data", async () => {
        let estimatesTimeOfArrival = await getTime() + 180000;

        let changePanicDetails =
            await tokenVault.populateTransaction.changePanicDetails(
                admin.address,
                alice.address
            );
        let enqueueTransaction =
            await timeLock.populateTransaction.queueTransaction(
                tokenVault.address, // target
                transactionValue, // value
                signatureMSG, // signature
                changePanicDetails.data, // data
                estimatesTimeOfArrival // estimated time of arrival
            );
        let executeTransaction =
            await timeLock.populateTransaction.executeTransaction(
                tokenVault.address,  
                transactionValue, 
                signatureMSG,
                changePanicDetails.data,
                estimatesTimeOfArrival
            );

        await multiSig.connect(alice).submitTransaction(
            timeLock.address, 
            transactionValue,
            enqueueTransaction.data
        );
        await multiSig.connect(bob).confirmTransaction(0);

        await multiSig.connect(alice).submitTransaction(
            timeLock.address, 
            transactionValue, 
            executeTransaction.data
        );
        
        ethers.provider.send("evm_increaseTime", [190000]);
        ethers.provider.send("evm_mine");
        
        await multiSig.connect(bob).confirmTransaction(1);
    
        expect(await tokenVault.panicOwner()).to.be.equal(admin.address);
        expect(await tokenVault.panicDestination()).to.be.equal(alice.address);

        estimatesTimeOfArrival = await getTime() + 180000;
        let lockTransaction = await tokenVault.populateTransaction.lock();
        enqueueTransaction = await timeLock.populateTransaction.queueTransaction(
            tokenVault.address, // target
            transactionValue, // value
            signatureMSG, // signature
            lockTransaction.data, // data
            estimatesTimeOfArrival // estimated time of arrival
        );
        executeTransaction = await timeLock.populateTransaction.executeTransaction(
            tokenVault.address, // target
            transactionValue, // value
            signatureMSG, // signature
            lockTransaction.data, // data
            estimatesTimeOfArrival
        );

        await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, enqueueTransaction.data);
        await multiSig.connect(bob).confirmTransaction(2);
        await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, executeTransaction.data);
        ethers.provider.send("evm_increaseTime", [190000]);
        ethers.provider.send("evm_mine");
        await multiSig.connect(bob).confirmTransaction(3);
        
        estimatesTimeOfArrival = await getTime() + 180000;

        enqueueTransaction = await timeLock.populateTransaction.queueTransaction(
            tokenVault.address, // target
            transactionValue, // value
            signatureMSG, // signature
            changePanicDetails.data, // data
            estimatesTimeOfArrival // estimated time of arrival
        );
        executeTransaction = await timeLock.populateTransaction.executeTransaction(
            tokenVault.address,  
            transactionValue, 
            signatureMSG,
            changePanicDetails.data,
            estimatesTimeOfArrival
        );

        await multiSig.connect(alice).submitTransaction(
            timeLock.address, 
            transactionValue,
            enqueueTransaction.data
        );
        await multiSig.connect(bob).confirmTransaction(4);
        await multiSig.connect(alice).submitTransaction(
            timeLock.address, 
            transactionValue, 
            executeTransaction.data
        );
        
        ethers.provider.send("evm_increaseTime", [190000]);
        ethers.provider.send("evm_mine");
        
        await multiSig.connect(bob).confirmTransaction(5);
    
        expect(await tokenVault.panicOwner()).to.be.equal(admin.address);
        expect(await tokenVault.panicDestination()).to.be.equal(alice.address);
    });

    it('should add Super721 and Super1155 addresses', async () => {
        let estimatesTimeOfArrival = await getTime() + 180000;
        let add721 = await tokenVault.populateTransaction.addSuper721Addr([super721.address, super721Additional.address]);
        let add1155 = await tokenVault.populateTransaction.addSuper1155Addr([super1155.address, super1155Additional.address]);

        let enqueueTransaction1 = await timeLock.populateTransaction.queueTransaction(
            tokenVault.address,
            transactionValue, 
            signatureMSG, 
            add721.data,
            estimatesTimeOfArrival
        );
        let enqueueTransaction2 = await timeLock.populateTransaction.queueTransaction(
            tokenVault.address,
            transactionValue, 
            signatureMSG, 
            add1155.data,
            estimatesTimeOfArrival
        );
        let executeTransaction1 = await timeLock.populateTransaction.executeTransaction(
            tokenVault.address,
            transactionValue, 
            signatureMSG, 
            add721.data,
            estimatesTimeOfArrival
        );
        let executeTransaction2 = await timeLock.populateTransaction.executeTransaction(
            tokenVault.address,
            transactionValue, 
            signatureMSG, 
            add1155.data,
            estimatesTimeOfArrival
        );

        await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, enqueueTransaction1.data);
        await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, enqueueTransaction2.data);
        await multiSig.connect(bob).confirmTransaction(0);
        await multiSig.connect(bob).confirmTransaction(1);
        await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, executeTransaction1.data);
        await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, executeTransaction2.data);
        ethers.provider.send("evm_increaseTime", [190000]);
        ethers.provider.send("evm_mine");
        await multiSig.connect(bob).confirmTransaction(2);
        await multiSig.connect(bob).confirmTransaction(3);
       
        //TODO reverts
    //     await expect( 
    //      tokenVault.connect(dev).addSuper721Addr([super721.address])
    //     ).to.be.revertedWith("address of super721 already presented in set");
    //     
    //     await expect( 
    //         tokenVault.connect(dev).addSuper1155Addr([super1155.address])
    //     ).to.be.revertedWith("address of super1155 already presented in set");
    })

    let asset721,
        asset1155,
        assetERC20,
        assetEth;
    describe('Test adding of tokens on contract ->', function () {
        beforeEach(async () => {
            let estimatesTimeOfArrival = await getTime() + 180000;
            let add721 = await tokenVault.populateTransaction.addSuper721Addr([super721.address, super721Additional.address]);
            let add1155 = await tokenVault.populateTransaction.addSuper1155Addr([super1155.address, super1155Additional.address]);

            let enqueueTransaction1 = await timeLock.populateTransaction.queueTransaction(tokenVault.address, transactionValue, signatureMSG, add721.data, estimatesTimeOfArrival);
            let enqueueTransaction2 = await timeLock.populateTransaction.queueTransaction(tokenVault.address, transactionValue, signatureMSG, add1155.data, estimatesTimeOfArrival);
            let executeTransaction1 = await timeLock.populateTransaction.executeTransaction(tokenVault.address, transactionValue, signatureMSG, add721.data, estimatesTimeOfArrival );
            let executeTransaction2 = await timeLock.populateTransaction.executeTransaction(tokenVault.address, transactionValue, signatureMSG, add1155.data, estimatesTimeOfArrival );

            await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, enqueueTransaction1.data);
            await multiSig.connect(bob).confirmTransaction(0);
            await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, enqueueTransaction2.data);
            await multiSig.connect(bob).confirmTransaction(1);
            await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, executeTransaction1.data);
            await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, executeTransaction2.data);
            ethers.provider.send("evm_increaseTime", [190000]);
            ethers.provider.send("evm_mine");
            await multiSig.connect(bob).confirmTransaction(2);
            await multiSig.connect(bob).confirmTransaction(3);
        
            asset721 = {  
                assetType: AssetType.ERC721,
                amounts: [ethers.BigNumber.from('1')], 
                ids: [shiftedItemGroupId]
            };
            asset1155 = {  
                assetType: AssetType.ERC1155,
                amounts: [ethers.BigNumber.from('10')], 
                ids: [shiftedItemGroupId.add(1)]
            };
            assetERC20 = {  
                assetType: AssetType.ERC20,
                amounts: [ethers.BigNumber.from('1')], 
                ids: []
            };
            assetEth = {  
                assetType: AssetType.Eth,
                amounts: [ethers.utils.parseEther('10')], 
                ids: []
            };
        });
        
        it("should add 721 and 1155 tokens to contract", async () => {
            let estimatesTimeOfArrival = await getTime() + 180000;
            let addTokens = await tokenVault.populateTransaction.addTokens(
                [super721.address, super1155.address],
                [asset721, asset1155]
            );
            
            let enqueueTransaction = await timeLock.populateTransaction.queueTransaction(
                tokenVault.address,
                transactionValue,
                signatureMSG, 
                addTokens.data, 
                estimatesTimeOfArrival
            );
            let executeTransaction = await timeLock.populateTransaction.executeTransaction(
                tokenVault.address,
                transactionValue,
                signatureMSG, 
                addTokens.data, 
                estimatesTimeOfArrival
            );
            
            await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, enqueueTransaction.data);
            await multiSig.connect(bob).confirmTransaction(4);
            await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, executeTransaction.data);
            ethers.provider.send("evm_increaseTime", [190000]);
            ethers.provider.send("evm_mine");
            
            let confirmationTransaction = await multiSig.connect(bob).confirmTransaction(5);
            let confirmationReceipt = await confirmationTransaction.wait();
            let executionEvent = confirmationReceipt.events[confirmationReceipt.events.length - 1];
            executionEvent.event.should.be.equal("Execution");
        }); 
    
        // TODO reverts doesn't works
        // it('addTokens REVERTs', async ()=> {
        //     await expect(
        //         tokenVault.connect(admin).addTokens(
        //             [super721.address],
        //             [asset721, asset1155]
        //         )
        //     ).to.be.revertedWith("Number of contracts and assets should be the same");
        //     
        //     await expect(
        //         tokenVault.connect(admin).addTokens(
        //             [token.address, super1155.address],
        //             [asset721, asset1155]
        //         )
        //     ).to.be.revertedWith("Address of token is not permited");
        //     
        //     await expect(
        //         tokenVault.connect(admin).addTokens(
        //             [super721.address, super1155.address],
        //             [assetERC20, assetEth]
        //         )
        //     ).to.be.revertedWith("Type of asset isn't ERC721 or ERC1155");
        // });

        describe('Test sending of tokens on contract ->', function () {
            let assetERC20 = {
                assetType: AssetType.ERC20,
                amounts: [ethers.utils.parseEther('1000')],
                ids: []
            }; 

            beforeEach(async () => {
                let estimatesTimeOfArrival = await getTime() + 180000;
                let addTokens = await tokenVault.populateTransaction.addTokens(
                    [super721.address, super1155.address],
                    [asset721, asset1155]
                );
                
                let enqueueTransaction = await timeLock.populateTransaction.queueTransaction(
                    tokenVault.address,
                    transactionValue,
                    signatureMSG, 
                    addTokens.data, 
                    estimatesTimeOfArrival
                );
                let executeTransaction = await timeLock.populateTransaction.queueTransaction(
                    tokenVault.address,
                    transactionValue,
                    signatureMSG, 
                    addTokens.data, 
                    estimatesTimeOfArrival
                );
                
                await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, enqueueTransaction.data);
                await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, executeTransaction.data);
                await multiSig.connect(bob).confirmTransaction(4);
                ethers.provider.send("evm_increaseTime", [190000]);
                ethers.provider.send("evm_mine");
                
                await multiSig.connect(bob).confirmTransaction(5);
            });

            it('should sendTokens ERC20', async () => {
                let estimatesTimeOfArrival = await getTime() + 180000;
                let sendERC20 = await tokenVault.populateTransaction.sendTokens([alice.address], [token.address], [assetERC20]);
                let enqueueTransaction = await timeLock.populateTransaction.queueTransaction(
                    tokenVault.address,
                    transactionValue,
                    signatureMSG, 
                    sendERC20.data, 
                    estimatesTimeOfArrival
                );
                let executeTransaction = await timeLock.populateTransaction.executeTransaction(
                    tokenVault.address,
                    transactionValue,
                    signatureMSG, 
                    sendERC20.data, 
                    estimatesTimeOfArrival
                );

                await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, enqueueTransaction.data);
                await multiSig.connect(bob).confirmTransaction(6);
                await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, executeTransaction.data);
                ethers.provider.send("evm_increaseTime", [190000]);
                ethers.provider.send("evm_mine");
                
                await multiSig.connect(bob).confirmTransaction(7);
                
                let balance = await token.balanceOf(alice.address);
                expect(balance.toString()).to.equal(ethers.utils.parseEther('1000'));
            });

            it('should sendTokens ERC721', async () => {
                let estimatesTimeOfArrival = await getTime() + 180000;
                let balance721 = await super721.balanceOf(tokenVault.address);
                // console.log(`vault balance of 721 before: ${balance721}`);
                let sendERC721 = await tokenVault.populateTransaction.sendTokens([alice.address], [super721.address], [asset721]);
                

                let enqueueTransaction = await timeLock.populateTransaction.queueTransaction(
                    tokenVault.address,
                    transactionValue,
                    signatureMSG, 
                    sendERC721.data, 
                    estimatesTimeOfArrival
                );
                let executeTransaction = await timeLock.populateTransaction.executeTransaction(
                    tokenVault.address,
                    transactionValue,
                    signatureMSG, 
                    sendERC721.data, 
                    estimatesTimeOfArrival
                );

                await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, enqueueTransaction.data);
                await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, executeTransaction.data);
                await multiSig.connect(bob).confirmTransaction(6);
                ethers.provider.send("evm_increaseTime", [190000]);
                ethers.provider.send("evm_mine");
                
                await multiSig.connect(bob).confirmTransaction(7);

                balance721 = await super721.balanceOf(tokenVault.address);
                // console.log(`vault balance of 721 after: ${balance721}`);
                expect(await super721.balanceOf(alice.address)).to.be.equal(ethers.BigNumber.from('1'));
            });

            it('should sendTokens ERC1155', async () => {
                let estimatesTimeOfArrival = await getTime() + 180000;
                
                let balance1155 = await super1155.balanceOf(tokenVault.address, shiftedItemGroupId.add(1));
                // console.log(`vault balance of 1155 before: ${balance1155}`);
                let send1155 = await tokenVault.populateTransaction.sendTokens([alice.address], [super1155.address], [asset1155]);
               
                let enqueueTransaction = await timeLock.populateTransaction.queueTransaction(
                    tokenVault.address,
                    transactionValue,
                    signatureMSG, 
                    send1155.data, 
                    estimatesTimeOfArrival
                );
                let executeTransaction = await timeLock.populateTransaction.executeTransaction(
                    tokenVault.address,
                    transactionValue,
                    signatureMSG, 
                    send1155.data, 
                    estimatesTimeOfArrival
                );

                await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, enqueueTransaction.data);
                await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, executeTransaction.data);
                await multiSig.connect(bob).confirmTransaction(6);
                ethers.provider.send("evm_increaseTime", [190000]);
                ethers.provider.send("evm_mine");
                
                await multiSig.connect(bob).confirmTransaction(7);
                
                balance1155 = await super1155.balanceOf(tokenVault.address, shiftedItemGroupId.add(1));
                // console.log(`vault balance of 1155 after: ${balance1155}`);
                expect(await super1155.balanceOf(alice.address, shiftedItemGroupId.add(1))).to.be.equal(ethers.BigNumber.from('10')) 
            });

            it('should sendTokens Ether', async () => {
                let estimatesTimeOfArrival = await getTime() + 180000;
                
                let balanceBeforeContract = await prov.getBalance(tokenVault.address);
                // console.log(`balance of vault before is ${balanceBeforeContract}`);
                let sendEth = await tokenVault.populateTransaction.sendTokens([alice.address], [ZERO_ADDRESS], [assetEth]);
                
                let enqueueTransaction = await timeLock.populateTransaction.queueTransaction(
                    tokenVault.address,
                    transactionValue,
                    signatureMSG, 
                    sendEth.data, 
                    estimatesTimeOfArrival
                );  
                let executeTransaction = await timeLock.populateTransaction.executeTransaction(
                    tokenVault.address,
                    transactionValue,
                    signatureMSG, 
                    sendEth.data, 
                    estimatesTimeOfArrival
                );
                        
                await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, enqueueTransaction.data);
                await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, executeTransaction.data);
                await multiSig.connect(bob).confirmTransaction(6);
                ethers.provider.send("evm_increaseTime", [190000]);
                ethers.provider.send("evm_mine");
                
                let balanceBefore = await prov.getBalance(alice.address);
                await multiSig.connect(bob).confirmTransaction(7);
                let balanceAfterContract = await prov.getBalance(tokenVault.address);
                // console.log(`balance of vault before is ${balanceAfterContract}`);
                
                let balanceAfter = await prov.getBalance(alice.address);
                expect(balanceAfter.sub(balanceBefore)).to.be.equal(ethers.utils.parseEther('10')); 
            });

            it('should sendTokens combo', async () => {
                let estimatesTimeOfArrival = await getTime() + 180000;
                
                let sendMultipleTokens = await tokenVault.populateTransaction.sendTokens(
                    [alice.address, bob.address, carol.address, alice.address],
                    [token.address, super721.address, super1155.address, ZERO_ADDRESS],
                    [assetERC20, asset721, asset1155, assetEth]
                );
                
                let enqueueTransaction = await timeLock.populateTransaction.queueTransaction(
                    tokenVault.address,
                    transactionValue,
                    signatureMSG, 
                    sendMultipleTokens.data, 
                    estimatesTimeOfArrival
                );
                let executeTransaction = await timeLock.populateTransaction.executeTransaction(
                    tokenVault.address,
                    transactionValue,
                    signatureMSG, 
                    sendMultipleTokens.data, 
                    estimatesTimeOfArrival
                );

                await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, enqueueTransaction.data);
                await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, executeTransaction.data);
                await multiSig.connect(bob).confirmTransaction(6);
                ethers.provider.send("evm_increaseTime", [190000]);
                ethers.provider.send("evm_mine");
                
                let balanceBefore = await prov.getBalance(alice.address);
                await multiSig.connect(bob).confirmTransaction(7);
                let balanceAfter = await prov.getBalance(alice.address);
                
                expect(await token.balanceOf(alice.address)).to.be.equal(ethers.utils.parseEther('1000'));
                expect(await super721.balanceOf(bob.address)).to.be.equal(ethers.BigNumber.from('1'));
                expect(await super1155.balanceOf(carol.address, shiftedItemGroupId.add(1))).to.be.equal(ethers.BigNumber.from('10'));
                expect(balanceAfter.sub(balanceBefore)).to.be.equal(ethers.utils.parseEther('10')); 
            });

            // TODO reverts doesn't catch properly
            // it('sendTokens() REVERTs:', async () => {
            //     await expect(
            //      tokenVault.sendTokens([], [token.address], [assetERC20])
            //     ).to.be.revertedWith("You must send tokens to at least one recipient.");
// 
            //     await expect(
            //      tokenVault.sendTokens([alice.address], [token.address], [assetERC20, asset721])
            //     ).to.be.revertedWith("Recipients length cannot be mismatched with assets length.");
            // 
            //     await expect(
            //      tokenVault.sendTokens([alice.address], [super721Additional.address], [asset721])
            //     ).to.be.revertedWith("Super721 address is not availible");
            //     
            //     await expect(
            //         tokenVault.sendTokens([alice.address], [super1155Additional.address], [asset1155])
            //     ).to.be.revertedWith("Super1155 address is not availible");
            //     
            //     await expect(
            //         tokenVault.sendTokens([alice.address], [ZERO_ADDRESS], 
            //             [{  
            //                 assetType: AssetType.Eth,
            //                 amounts: [etherBalanceVault.add(ethers.BigNumber.from('1'))], 
            //                 ids: []
            //             }]
            //         )
            //     ).to.be.revertedWith("send Eth failed");
            // });

            // TODO before panic send tokens to contract
            it('PANIC transfer', async () => {
                // let panicOwner = await tokenVault.panicOwner();
                let balanceERC20 = await token.balanceOf(tokenVault.address);
                let balanceERC721 = await super721.balanceOf(tokenVault.address);
                let balanceERC1155 = await super1155.balanceOf(tokenVault.address, shiftedItemGroupId.add(1));
                let balanceEthBefore = await prov.getBalance(tokenVault.address);
                let balanceEthMsg = await prov.getBalance(multiSig.address);

                let panic = await tokenVault.populateTransaction.panic();
                await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, panic.data);
                console.log("submited")
                await multiSig.connect(bob).confirmTransaction(6);
                
                let zero = ethers.utils.parseEther('0');
                // TODO tokens after operation on carol address balance on vault is zero  
                // vault balances are zero 
                expect(await token.balanceOf(tokenVault.address)).to.be.equal(zero);
                expect(await super721.balanceOf(tokenVault.address)).to.be.equal(zero);
                expect(await super1155.balanceOf(tokenVault.address, shiftedItemGroupId.add(1))).to.be.equal(zero);
                expect(balanceEthAfter.sub(balanceEthBefore)).to.be.equal(zero); 
                
                expect(await token.balanceOf(multiSig.address)).to.be.equal(balanceERC20);
                expect(await super721.balanceOf(multiSig.address)).to.be.equal(balanceERC721);
                expect(await super1155.balanceOf(multiSig.address, shiftedItemGroupId.add(1))).to.be.equal(balanceERC1155);

            });

            it('PANIC burn', async () => {
                let estimatesTimeOfArrival = await getTime() + 180000;
                let balanceEthBefore = await prov.getBalance(tokenVault.address);
                
                // change pnic distination to zero to call burn 
                let changePanicDetails = await tokenVault.populateTransaction.changePanicDetails(bob.address, ZERO_ADDRESS);
                let enqueueTransaction = await timeLock.populateTransaction.queueTransaction(
                    tokenVault.address, // target
                    transactionValue, // value
                    signatureMSG, // signature
                    changePanicDetails.data, // data
                    estimatesTimeOfArrival // estimated time of arrival
                );
                let executeTransaction = await timeLock.populateTransaction.executeTransaction(
                    tokenVault.address,  
                    transactionValue, 
                    signatureMSG,
                    changePanicDetails.data,
                    estimatesTimeOfArrival
                );        
                await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, enqueueTransaction.data);
                await multiSig.connect(bob).confirmTransaction(6);
                await multiSig.connect(alice).submitTransaction(timeLock.address, transactionValue, executeTransaction.data);
                
                ethers.provider.send("evm_increaseTime", [190000]);
                ethers.provider.send("evm_mine");
                
                await multiSig.connect(bob).confirmTransaction(7);
            
                expect(await tokenVault.panicOwner()).to.be.equal(bob.address);
                expect(await tokenVault.panicDestination()).to.be.equal(ZERO_ADDRESS);

                await tokenVault.connect(bob).panic();
                let balanceEthAfter = await prov.getBalance(tokenVault.address);

                let zero = ethers.utils.parseEther('0');
                // vault balances are zero 
                expect(await token.balanceOf(tokenVault.address)).to.be.equal(zero);
                expect(await super721.balanceOf(tokenVault.address)).to.be.equal(zero);
                expect(await super1155.balanceOf(tokenVault.address, shiftedItemGroupId.add(1))).to.be.equal(zero);
                expect(balanceEthAfter.sub(balanceEthBefore)).to.be.equal(zero); 
                // bob's balance are zero 
                expect(await token.balanceOf(bob.address)).to.be.equal(zero);
                expect(await super721.balanceOf(bob.address)).to.be.equal(zero);
                expect(await super1155.balanceOf(bob.address, shiftedItemGroupId.add(1))).to.be.equal(zero);
                // expect(balanceEthAfter.sub(balanceEthBefore)).to.be.equal(zero); 

            });

            it('PANIC REVERT trying non panic owner call panic', async () => {
                await expect( tokenVault.connect(bob).panic())
                .to.be.revertedWith("TokenVault: caller is not the panic owner");
            });
        });
    })
});
