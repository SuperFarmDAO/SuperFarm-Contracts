"use strict";

// Imports.
import { ethers } from "hardhat";
import "chai/register-should";

const AssetType = Object.freeze({
    Eth: 0,
    ERC20: 1,
    ERC1155: 2,
    ERC721: 3,
});

/**
 * TODO LIST
 *
 *
 *
 *
 */

// Test the TokenVault with Timelock and MultiSigWallet functionality.
describe("TokenVault", function () {
    let alice, bob, carol, dev;
    let Token,
        MultiSigWallet,
        Timelock,
        TokenVault,
        Super721,
        Super1155,
        ProxyRegistry;
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
            "URI_SUPER21",
            proxyRegistry.address
        );
        await super721.deployed();
        super1155 = await Super1155.connect(admin).deploy(
            admin.address,
            "SUPER1155",
            "URI_SUPER1155",
            proxyRegistry.address
        );
        await super1155.deployed();
        await tokenVault.connect(admin).transferOwnership(timeLock.address);
        await token
            .connect(admin)
            .mint(tokenVault.address, ethers.utils.parseEther("1000000000"));
    });

    // Verify that the multisignature wallet can send tokens from the vault.
    it("should allow the multisig to send tokens via timelock", async () => {
        let devBalance = await token.balanceOf(dev.address);
        devBalance.should.be.equal(0);

        // Generate the raw transaction for releasing tokens from the vault.
        let releaseTokenTransaction =
            await tokenVault.populateTransaction.sendTokens(
                [dev.address],
                [ethers.utils.parseEther("1000000")]
            );

        // Generate the raw transaction for enqueuing token release with the time lock.
        let enqueueTransaction =
            await timeLock.populateTransaction.queueTransaction(
                tokenVault.address,
                ethers.utils.parseEther("0"),
                "",
                releaseTokenTransaction.data,
                Math.floor(Date.now() / 1000) + 180000
            );

        // Generate the raw transaction for executing token release with the time lock.
        let executeTransaction =
            await timeLock.populateTransaction.executeTransaction(
                tokenVault.address,
                ethers.utils.parseEther("0"),
                "",
                releaseTokenTransaction.data,
                Math.floor(Date.now() / 1000) + 180000
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
        let confirmationTransaction = await multiSig
            .connect(bob)
            .confirmTransaction(0);
        let confirmationReceipt = await confirmationTransaction.wait();
        let executionEvent =
            confirmationReceipt.events[confirmationReceipt.events.length - 1];
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
        let currentTime = Math.floor(Date.now() / 1000);
        ethers.provider.send("evm_increaseTime", [currentTime + 190000]);
        ethers.provider.send("evm_mine");

        // Reset the second multisig holder's confirmation.
        await multiSig.connect(bob).revokeConfirmation(1);
        console.log();
        let owners = await multiSig.getOwners();
        let transCount = await multiSig.getTransactionCount(true, true);
        console.log(owners.toString());
        console.log(transCount.toString());

        // Confirm that the time lock may now be executed.
        console.log(1);

        confirmationTransaction = await multiSig
            .connect(bob)
            .confirmTransaction(1);
        console.log(2);

        // confirmationTransaction = await multiSig.connect(alice).confirmTransaction(1);
        console.log(3);

        confirmationTransaction = await multiSig
            .connect(carol)
            .confirmTransaction(1);
        console.log(4);
        let confCount = await multiSig.getConfirmationCount(1);

        // confirmationTransaction = await multiSig.connect(bob).confirmTransaction(2);
        console.log("Confirmations: " + confCount);
        confirmationReceipt = await confirmationTransaction.wait();
        // await execute.wait();
        console.log(1);
        console.log(confirmationTransaction);
        executionEvent =
            confirmationReceipt.events[confirmationReceipt.events.length - 1];
        executionEvent.event.should.be.equal("Execution");
        transactionData = await multiSig.transactions(1);
        transactionData.destination.should.be.equal(timeLock.address);
        transactionData.value.should.be.equal(ethers.utils.parseEther("0"));
        transactionData.data.should.be.equal(executeTransaction.data);
        // transactionData.executed.should.be.equal(true);

        bobConfirmation = await multiSig.confirmations(1, bob.address);
        bobConfirmation.should.be.equal(true);

        // Confirm that the tokens have been sent.
        //  execute = await multiSig.connect(bob).executeTransaction(1, {gasLimit: 10000000});

        devBalance = await token.balanceOf(dev.address);
        devBalance.should.be.equal(ethers.utils.parseEther("1000000"));
    });

    it("should update panic data", async () => {
        // TODO
    });

    it("should send ERC20 tokens", async () => {
        // TODO
    });

    it("should send ERC751 tokens", async () => {
        // TODO
    });

    it("should send ERC1155 tokens", async () => {
        // TODO
    });

    it("should send ETH ", async () => {
        // TODO
    });

    it("PANIC", async () => {
        // TODO
    });

    it("", async () => {});
});
