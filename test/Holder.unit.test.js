'use strict';
const { expect } = require('chai');
import {getCurrentTime} from "./utils.js";

// Imports.
// import { ethers } from 'hardhat';
import {BigNumber} from "ethers";
import 'chai/register-should';
let owner, user_one, user_two, user_three, service;
let Holder, holder, MockERC20, erc20;
let CREATE_POOL_RIGHT, UNIVERSAL;
let snaphotId;
let currentTime;
describe("Holder", function () {
    before(async function() {
        [owner, user_one, user_two, user_three, service] = await ethers.getSigners();
        Holder = await ethers.getContractFactory("HolderClaiming");
        MockERC20 = await ethers.getContractFactory("MockERC20");
        erc20 = await MockERC20.deploy();
        holder = await Holder.deploy(service.address);

        CREATE_POOL_RIGHT = await holder.CREATE_POOL();
        UNIVERSAL = await holder.UNIVERSAL();


        await holder.connect(owner).setPermit(
            user_one.address,
            UNIVERSAL,
            CREATE_POOL_RIGHT,
            ethers.constants.MaxUint256
        );

        await erc20.connect(owner).approve(holder.address, ethers.utils.parseEther("10000000"));
    });

    beforeEach(async function() {
        currentTime = await (await ethers.provider.getBlock()).timestamp;
        snaphotId = await network.provider.send("evm_snapshot");
    });

    afterEach(async function() {
        await network.provider.send("evm_revert", [snaphotId]);
    });

    it("Shoud deploy everything correctly", async function() {
        // expect(await holder.rewardToken()).to.equal(erc20.address);
        expect(await holder.service()).to.equal(service.address);
    });

    describe("create-pool", async function() {
        it("Reverts: creating pool without permission", async function() {
            // let curentTime = 
            let poolCreationStruct = {
                startTime: currentTime,
                endTime: currentTime + 100,
                rewardPerSec: (await ethers.utils.parseEther("1")),
                rewardTokenAmount: (await ethers.utils.parseEther("10000000")),
                rewardToken: erc20.address
            };

            await expect(holder.connect(user_two).addPool(poolCreationStruct)).to.be.revertedWith("P1");
        });

        it("Shoud create pool", async function() {
            let poolCreationStruct = {
                startTime: currentTime,
                endTime: currentTime + 100,
                rewardPerSec: (await ethers.utils.parseEther("1")),
                rewardTokenAmount: (await ethers.utils.parseEther("10000000")),
                rewardToken: erc20.address
            };
            await holder.connect(owner).addPool(poolCreationStruct);

            // await expect(await (erc20.balanceOf(holder.address)).toString()).to.equal(ethers.utils.parseEther("10000000"));
        });
    });  

    describe("claim", async function() {

        it("Revert: wrong time", async function() {

            let poolCreationStruct = {
                startTime: currentTime + 1000,
                endTime: currentTime + 1100,
                rewardPerSec: (await ethers.utils.parseEther("1")),
                rewardTokenAmount: (await ethers.utils.parseEther("10000000")),
                rewardToken: erc20.address
            };
            await holder.connect(owner).addPool(poolCreationStruct);

            let checkpoint = {
                startTime: [currentTime, currentTime - 100],
                endTime: [currentTime + 100, currentTime - 50], 
                balance: [1, 1]
            };
            let messageHash = ethers.utils.solidityKeccak256(["uint[]", "uint[]", "uint[]"], [checkpoint.startTime, checkpoint.endTime, checkpoint.balance]);

            let signedMessageHash = await service.signMessage(messageHash);

            let splittedSignature = await ethers.utils.splitSignature(signedMessageHash);
            await expect(holder.connect(user_one).claim(0, messageHash, {v: splittedSignature.v, r:splittedSignature.r, s:splittedSignature.s}, checkpoint)).to.be.revertedWith("Pool is not running");
        });


        it("Revert: wrong pool id", async function() {
            let poolCreationStruct = {
                startTime: currentTime,
                endTime: currentTime + 100,
                rewardPerSec: (await ethers.utils.parseEther("1")),
                rewardTokenAmount: (await ethers.utils.parseEther("10000000")),
                rewardToken: erc20.address
            };
            await holder.connect(owner).addPool(poolCreationStruct);

            let checkpoint = {
                startTime: [currentTime, currentTime - 100],
                endTime: [currentTime + 100, currentTime - 50], 
                balance: [1, 1]
            };
            let messageHash = ethers.utils.solidityKeccak256(["uint[]", "uint[]", "uint[]"], [checkpoint.startTime, checkpoint.endTime, checkpoint.balance]);


            let signedMessageHash = await service.signMessage(messageHash);

            let splittedSignature = await ethers.utils.splitSignature(signedMessageHash);
            await expect(holder.connect(user_one).claim(1, messageHash, {v: splittedSignature.v, r:splittedSignature.r, s:splittedSignature.s}, checkpoint)).to.be.revertedWith("Wrong pool id");
        });

        it("Revert: Hash has already been used", async function() {
            let poolCreationStruct = {
                startTime: currentTime - 10,
                endTime: currentTime + 100,
                rewardPerSec: (await ethers.utils.parseEther("1")),
                rewardTokenAmount: (await ethers.utils.parseEther("10000000")),
                rewardToken: erc20.address
            };
            await holder.connect(owner).addPool(poolCreationStruct);
            let checkpoint = {
                startTime: [currentTime, currentTime - 100],
                endTime: [currentTime + 100, currentTime - 50], 
                balance: [1, 1]
            };

            let messageHash = ethers.utils.solidityKeccak256(["uint[]", "uint[]", "uint[]"], [checkpoint.startTime, checkpoint.endTime, checkpoint.balance]);
            
            let signedMessageHash = await service.signMessage(ethers.utils.arrayify(messageHash));
            let splittedSignature = await ethers.utils.splitSignature(signedMessageHash);
            await holder.connect(user_one).claim(0, messageHash, {v: splittedSignature.v, r:splittedSignature.r, s:splittedSignature.s}, checkpoint);
            await expect(holder.connect(user_one).claim(0, messageHash, {v: splittedSignature.v, r:splittedSignature.r, s:splittedSignature.s}, checkpoint)).to.be.revertedWith("Hash has already been used");
        });

        it("Revert: Wrong hash provided", async function() {
            let poolCreationStruct = {
                startTime: currentTime - 10,
                endTime: currentTime + 100,
                rewardPerSec: (await ethers.utils.parseEther("1")),
                rewardTokenAmount: (await ethers.utils.parseEther("10000000")),
                rewardToken: erc20.address
            };
            await holder.connect(owner).addPool(poolCreationStruct);
            let checkpoint = {
                startTime: [currentTime-1, currentTime - 100],
                endTime: [currentTime + 100, currentTime - 50], 
                balance: [1, 1]
            };

            let checkpoint1 = {
                startTime: [currentTime, currentTime - 100],
                endTime: [currentTime + 100, currentTime - 50], 
                balance: [1, 1]
            };
            let messageHash = ethers.utils.solidityKeccak256(["uint[]", "uint[]", "uint[]"], [checkpoint.startTime, checkpoint.endTime, checkpoint.balance]);
            
            let signedMessageHash = await service.signMessage(ethers.utils.arrayify(messageHash));
            let splittedSignature = await ethers.utils.splitSignature(signedMessageHash);
            await expect(holder.connect(user_one).claim(0, messageHash, {v: splittedSignature.v, r:splittedSignature.r, s:splittedSignature.s}, checkpoint1)).to.be.revertedWith("Wrong hash provided");
        });

        it("Revert: Hash has already been used", async function() {
            let poolCreationStruct = {
                startTime: currentTime - 10,
                endTime: currentTime + 100,
                rewardPerSec: (await ethers.utils.parseEther("1")),
                rewardTokenAmount: (await ethers.utils.parseEther("1")),
                rewardToken: erc20.address
            };
            await holder.connect(owner).addPool(poolCreationStruct);
            let checkpoint = {
                startTime: [currentTime, currentTime - 100],
                endTime: [currentTime + 100, currentTime - 50], 
                balance: [1, 1]
            };

            let messageHash = ethers.utils.solidityKeccak256(["uint[]", "uint[]", "uint[]"], [checkpoint.startTime, checkpoint.endTime, checkpoint.balance]);
            
            let signedMessageHash = await service.signMessage(ethers.utils.arrayify(messageHash));
            let splittedSignature = await ethers.utils.splitSignature(signedMessageHash);
            await expect(holder.connect(user_one).claim(0, messageHash, {v: splittedSignature.v, r:splittedSignature.r, s:splittedSignature.s}, checkpoint)).to.be.revertedWith("Not enough tokens for reward");
        });

        it("Holder shoud claim rewards", async function() {
            let poolCreationStruct = {
                startTime: currentTime - 10,
                endTime: currentTime + 100,
                rewardPerSec: (await ethers.utils.parseEther("1")),
                rewardTokenAmount: (await ethers.utils.parseEther("10000000")),
                rewardToken: erc20.address
            };
            await holder.connect(owner).addPool(poolCreationStruct);
            let checkpoint = {
                startTime: [currentTime, currentTime - 100],
                endTime: [currentTime + 100, currentTime - 50], 
                balance: [1, 1]
            };

            let messageHash = ethers.utils.solidityKeccak256(["uint[]", "uint[]", "uint[]"], [checkpoint.startTime, checkpoint.endTime, checkpoint.balance]);
            
            let signedMessageHash = await service.signMessage(ethers.utils.arrayify(messageHash));
            let splittedSignature = await ethers.utils.splitSignature(signedMessageHash);
            await holder.connect(user_one).claim(0, messageHash, {v: splittedSignature.v, r:splittedSignature.r, s:splittedSignature.s}, checkpoint);
            let userOneBalance = (await erc20.balanceOf(user_one.address)).toString();
            console.log(userOneBalance);
            console.log(calculateRewards(checkpoint, ethers.utils.parseEther("1")));
            expect(Number(userOneBalance)).to.equal(calculateRewards(checkpoint, ethers.utils.parseEther("1")));
        });
    });
});


function calculateRewards(checkpoint, rewardPerSec) {
    let reward = 0;
    for (let i = 0; i < checkpoint.startTime.length; i++) {
        reward += (checkpoint.endTime[i] - checkpoint.startTime[i]) * (checkpoint.balance[i] * rewardPerSec);
    }
    return reward;
}
