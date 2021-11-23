"use strict";

// Imports.
import { ethers, network, waffle } from "hardhat";
import { expect } from "chai";
import "chai/register-should";

const DATA = "0x02";

const AssetType = Object.freeze({
    None: 0,
    Eth: 1,
    ERC20: 2,
    ERC1155: 3,
    ERC721: 4
});

// Test the TokenVault with Timelock and MultiSigWallet functionality.
describe("TokenVault", function () {
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
            proxyRegistry.address
        );
        await super721.deployed();
        super721Additional = await Super721.connect(admin).deploy(
            admin.address,
            "SUPER721ADD",
            "S721A",
            "URI_SUPER721A",
            proxyRegistry.address
        );
        await super721Additional.deployed();
        super1155 = await Super1155.connect(admin).deploy(
            admin.address,
            "SUPER1155",
            "URI_SUPER1155",
            proxyRegistry.address
        );
        await super1155.deployed();
        super1155Additional = await Super1155.connect(admin).deploy(
            admin.address,
            "SUPER1155ADD",
            "URI_SUPER1155A",
            proxyRegistry.address
        );
        await super1155Additional.deployed();

        await tokenVault.connect(admin).transferOwnership(timeLock.address);
        await token
            .connect(admin)
            .mint(tokenVault.address, ethers.utils.parseEther("1000000000"));
        
        let TimeNow = Math.floor(Date.now() / 1000);
        await ethers.provider.send("evm_setNextBlockTimestamp", [TimeNow])
        await ethers.provider.send("evm_mine") 
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

        
    });

    it("should update panic data", async () => {
        // TODO
        let estimatesTimeOfArrival = Math.floor(Date.now() / 1000 + 180000);
        let transactionValue = ethers.utils.parseEther("0");
        let signatureMSG = "";

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
        await multiSig.connect(bob).confirmTransaction(1);
        
        executionEvent =
        confirmationReceipt.events[confirmationReceipt.events.length - 1];
        executionEvent.event.should.be.equal("ExecutionFailure");
   

        let currentTime = Math.floor(Date.now() / 1000);
        ethers.provider.send("evm_increaseTime", [currentTime + 190000]);
        ethers.provider.send("evm_mine");

        await multiSig.connect(bob).executeTransaction(1);
            
        expect(await tokenVault.panicOwner()).to.be.equal();
        expect(await tokenVault.panicDestination()).to.be.equal(alice.address);
    });

    it(" add Super1155 and Super721 contracts to TokenVault contract", async () => {
        let eta = Math.floor(Date.now() / 1000 + 10001);
        
        let addS721 = await tokenVault.populateTransaction.addSuper721Addr(super721.address);
        let addS1155 = await tokenVault.populateTransaction.addSuper1155Addr(super1155.address);
        
        let enqueueAddS721 = await timeLock.populateTransaction.queueTransaction(
            tokenVault.address, transValue, "", addS721.data, eta
        ); 
        let enqueueAddS1155 = await timeLock.populateTransaction.queueTransaction(
            tokenVault.address, transValue, "", addS1155.data, eta
        ); 

        let executeAddS721 = await timeLock.populateTransaction.executeTransaction(
            tokenVault.address, transValue, "", addS721.data, eta
        );
        let executeAddS1155 = await timeLock.populateTransaction.executeTransaction(
            tokenVault.address, transValue, "", addS721.data, eta
        );

        await multiSig.connect(alice).submitTransaction(timeLock.address, transValue, enqueueAddS721.data);
        await multiSig.connect(alice).submitTransaction(timeLock.address, transValue, enqueueAddS1155.data);
        await multiSig.connect(alice).submitTransaction(timeLock.address, transValue, executeAddS721.data);
        await multiSig.connect(alice).submitTransaction(timeLock.address, transValue, executeAddS1155.data);
        await multiSig.connect(carol).submitTransaction(timeLock.address, transValue, executeAddS721.data);
        await multiSig.connect(carol).submitTransaction(timeLock.address, transValue, executeAddS1155.data);

        await multiSig.connect(bob).confirmTransaction(0);
        await multiSig.connect(bob).confirmTransaction(1);
        await multiSig.connect(bob).confirmTransaction(2);
        await multiSig.connect(bob).confirmTransaction(3);
        await multiSig.connect(bob).confirmTransaction(4); // carol's transaction
        await multiSig.connect(bob).confirmTransaction(5); // carol's transaction

        let currentTime = Math.floor(Date.now() / 1000);
        ethers.provider.send("evm_increaseTime", [currentTime + 11000]);
        ethers.provider.send("evm_mine");

        await multiSig.connect(bob).executeTransaction(2);
        await multiSig.connect(bob).executeTransaction(3);

        // revert if trying to add in second time 
        await expect(
        multiSig.connect(bob).executeTransaction(4)
        ).to.be.revertedWith("address of super721 already presented in set");
        await expect(
        multiSig.connect(bob).executeTransaction(5)
        ).to.be.revertedWith("address of super1155 already presented in set");

    })


    let sendTokensERC20,
        sendTokensEth,
        sendTokensERC721,
        sendTokensERC1155;
        
    describe("Testing of token send", function () {
        // create different types of tokens and send them to contract
        beforeEach(async () => {
            // mint tokens to 
            let itemGroupId = ethers.BigNumber.from(1);
            let itemGroupId2 = ethers.BigNumber.from(1);
            let shiftedItemGroupId = itemGroupId.shl(128);
            let shiftedItemGroupId2 = itemGroupId.shl(128);

            await super721.connect(admin).configureGroup(
                itemGroupId, 
                {
                    name: 'NFT',
                    supplyType: 0,
                    supplyData: 20000,
                    burnType: 1,
                    burnData: 100
                }
            );

            await super721.connect(admin).configureGroup(
                itemGroupId2,
                {
                    name: 'NFT2',
                    supplyType: 0,
                    supplyData: 20000,
                    burnType: 1, // what if 0/none? Update: 0 is unburnable
                    burnData: 100
                }
            );

            await super721.connect(admin).mintBatch( tokenVault.address, [shiftedItemGroupId], ethers.utils.id('a'));
            await super721.connect(admin).mintBatch( tokenVault.address, [shiftedItemGroupId2], ethers.utils.id('a'));

            await super1155.connect(admin).configureGroup(
                itemGroupId,
                {
                    name: 'PEPSI',
                    supplyType: 0,
                    supplyData: 10,
                    itemType: 1,
                    itemData: 0,
                    burnType: 1,
                    burnData: 6
                }
            );
            
            await super1155.connect(admin).configureGroup(
                itemGroupId2,
                {
                    name: 'COLA',
                    supplyType: 0,
                    supplyData: 15,
                    itemType: 1,
                    itemData: 0,
                    burnType: 2,
                    burnData: 5
                }
            );

            // Mint fungible item
            await super1155.connect(admin).mintBatch(tokenVault.address, [shiftedItemGroupId], ["7"], DATA);
            await super1155.connect(admin).mintBatch(tokenVault.address, [shiftedItemGroupId2], ["7"], DATA);

            await expect( dev.sendTransaction({
                to: tokenVault.address,
                value: ethers.utils.parseEther('5000')
            })).to.emit(tokenVault, 'Receive').withArgs(dev.address, ethers.utils.parseEther("5000"))

            // TODO balances of token vault for ERC721 and ERC1155 are okay 
            
            sendTokensERC20 = await tokenVault.populateTransaction.sendTokens(
                [dev.address], 
                [{
                    assetType: AssetType.ERC20,
                    token: token.address,
                    amounts: [ethers.utils.parseEther("1000")], 
                    ids: [], 
                    data: ""
                }]
            );

            sendTokensEth = await tokenVault.populateTransaction.sendTokens(
                [dev.address], 
                [{
                    assetType: AssetType.Eth,
                    token: "",
                    amounts: [ethers.utils.parseEther("1")], 
                    ids: [], 
                    data: ""
                }]
            );

            sendTokensERC721 = await tokenVault.populateTransaction.sendTokens(
                [dev.address], 
                [{
                    assetType: AssetType.ERC721,
                    token: super721.address,
                    amounts: [], 
                    ids: [], 
                    data: ""
                }]
            );

            sendTokensERC1155 = await tokenVault.populateTransaction.sendTokens(
                [dev.address], 
                [{
                    assetType: AssetType.ERC1155,
                    token: super1155.address,
                    amounts: [], 
                    ids: [], 
                    data: ""
                }]
            );

            sendTokensAll = await tokenVault.populateTransaction.sendTokens(
                [dev.address], 
                [{ assetType: AssetType.ERC20,
                   token: token.address,
                   amounts: [ethers.utils.parseEther("1000")], 
                   ids: [], 
                   data: "" },
                 { assetType: AssetType.Eth,
                   token: "",
                   amounts: [ethers.utils.parseEther("1")], 
                   ids: [], 
                   data: "" },
                 { assetType: AssetType.ERC721,
                   token: super721.address,
                   amounts: [], 
                   ids: [], 
                   data: "" },
                 { assetType: AssetType.ERC1155,
                   token: super1155.address,
                   amounts: [], 
                   ids: [], 
                   data: "" }]
            ); 

            // TODO set addresses S721 and s1155 availible
            // TODO add tokens in contract lists 

        });

        // TESTS starts
        it("should send ERC20 tokens", async () => {
            eta = Math.floor(Date.now() / 1000 + 10000);
            let executeSend = await timeLock.populateTransaction.executeTransaction(
                tokenVault.address, transValue, "", sendTokensERC20.data, eta
            )

            let devBalanceBefore = token.balanceOf(dev.address);

            await multiSig.connect(alice).submitTransaction(timeLock.address, transValue, executeSend.data);
            await multiSig.connect(bob).confirmTransaction(0);

            let currentTime = Math.floor(Date.now() / 1000);
            ethers.provider.send("evm_increaseTime", [currentTime + 11000]);
            ethers.provider.send("evm_mine");

            await multiSig.connect(bob).executeTransaction(0);

            let devBalanceAfter = token.balanceOf(dev.address);
            
            // check dev balance after 
            expect(devBalanceAfter.sub(devBalanceBefore)).to.be.equal(ethers.utils.parseEther("1000"));
        });
    
        it("should send ETH ", async () => {
            eta = Math.floor(Date.now() / 1000 + 10000);
            let executeSend = await timeLock.populateTransaction.executeTransaction(
                tokenVault.address, transValue, "", sendTokensEth.data, eta
            )

            let devBalanceBefore = prov.getBalance(dev.address);

            await multiSig.connect(alice).submitTransaction(timeLock.address, transValue, executeSend.data);
            await multiSig.connect(bob).confirmTransaction(0);

            let currentTime = Math.floor(Date.now() / 1000);
            ethers.provider.send("evm_increaseTime", [currentTime + 11000]);
            ethers.provider.send("evm_mine");

            await multiSig.connect(bob).executeTransaction(0);

            let devBalanceAfter = prov.getBalance(dev.address);
            // check dev balance after 
            expect(devBalanceAfter.sub(devBalanceBefore)).to.be.equal(ethers.utils.parseEther("1000"));
        });

        it("should send ERC751 tokens", async () => {
            eta = Math.floor(Date.now() / 1000 + 10000);
            let executeSend = await timeLock.populateTransaction.executeTransaction(
                tokenVault.address, transValue, "", sendTokensERC721.data, eta
            )

             let devBalanceBefore = 22; // TODO balance check for 721

            await multiSig.connect(alice).submitTransaction(timeLock.address, transValue, executeSend.data);
            await multiSig.connect(bob).confirmTransaction(0);

            let currentTime = Math.floor(Date.now() / 1000);
            ethers.provider.send("evm_increaseTime", [currentTime + 11000]);
            ethers.provider.send("evm_mine");

            await multiSig.connect(bob).executeTransaction(0);

            let devBalanceAfter = 21; // TODO balance check for 721
            // check dev balance after 
            expect(devBalanceAfter.sub(devBalanceBefore)).to.be.equal(ethers.utils.parseEther("1000"));
        });
    
        it("should send ERC1155 tokens", async () => {
            eta = Math.floor(Date.now() / 1000 + 10000);
            let executeSend = await timeLock.populateTransaction.executeTransaction(
                tokenVault.address, transValue, "", sendTokensERC1155.data, eta
            )

            let devBalanceBefore = 22; // TODO balance check for 1155

            await multiSig.connect(alice).submitTransaction(timeLock.address, transValue, executeSend.data);
            await multiSig.connect(bob).confirmTransaction(0);

            let currentTime = Math.floor(Date.now() / 1000);
            ethers.provider.send("evm_increaseTime", [currentTime + 11000]);
            ethers.provider.send("evm_mine");

            await multiSig.connect(bob).executeTransaction(0);

            let devBalanceAfter = 42; // TODO balance check for 1155
            // check dev balance after 
            expect(devBalanceAfter.sub(devBalanceBefore)).to.be.equal(ethers.utils.parseEther("1000"))
        });

        it("should send all types of tokens", async() => {
            
        });

        it("REVERTS in sendTokens() function", async () => {

            expect().to.be.revertedWith("You must send tokens to at least one recipient.");
            expect().to.be.revertedWith("Recipients length cannot be mismatched with assets length.");
            expect().to.be.revertedWith("send Eth failed");
            expect().to.be.revertedWith("Super721 address is not availible");
            expect().to.be.revertedWith("Super1155 address is not availible");

        })
    
    });




    it("PANIC", async () => {
        // TODO
    });

    it("", async () => {});
});
