'use strict';
const { expect } = require('chai');

const today = Math.trunc(new Date().getTime() / 1000);
import 'chai/register-should';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
// import { ethers } from 'ethers';
let owner, user_one, user_two;

const decimalPlaces = 18;

describe("SuperStarter", function () {
    let starter, Starter, token, Token, token2, Token2;
    beforeEach(async () => {
        [owner, user_one, user_two] = await ethers.getSigners();
    });

    it("Shoud deploy all contracts", async function() {
        Starter = await ethers.getContractFactory('SuperStarter');
        Token = await ethers.getContractFactory('Token');
        token = await Token.connect(owner).deploy('TEST', 'TEST', ethers.utils.parseEther("10000000000000"));
        token2 = await Token.connect(owner).deploy('TEST2', 'TEST2', ethers.utils.parseEther("100000000"));
        starter = await Starter.deploy(ethers.utils.parseEther("1"), token.address);

        await starter.deployed();
        await token.deployed();
        await token2.deployed();

        await token.mint(owner.address, ethers.utils.parseEther("10000000000000"));

        await token2.mint(owner.address, ethers.utils.parseEther("100000000"));
        await token.transfer(user_one.address, ethers.utils.parseEther("100000"));
        await token2.transfer(starter.address, ethers.utils.parseEther("100000"));

        let balance1 = await token.balanceOf(owner.address);
        let balance2 = await token2.balanceOf(owner.address);

        expect(balance1.toString()).to.equal(balance1);
        expect(balance2.toString()).to.equal(balance2);


    });

    it ("Shoud revert when creating pool", async function() {
        try {
            await starter.connect(user_two).createPool(
                token.address,
                token2.address,
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("1"),
                false,
                false,
                ethers.utils.parseEther("100")
            );
        } catch (error) {
            expect(error.message).to.include("Ownable: caller is not the owner")
        }
    });

    it ("Shoud create pool", async function() {
        token.connect(owner).approve(starter.address, ethers.utils.parseEther("100000000"));
        let balance1 = await token.balanceOf(owner.address);
        console.log(balance1.toString())
        await starter.connect(owner).createPool(
            token.address,
                token2.address,
                ethers.utils.parseEther("100000"),
                ethers.utils.parseEther("1"),
                true,
                false,
                ethers.utils.parseEther("1000000")
        );  
        let value = await starter.poolsLength();
        expect(value).to.equal(1);
    });

    it ("Shoud add to whitelist", async function() {
       await starter.addWhiteListBatch(
           0, 
           [user_one.address, user_two.address], 
           [ethers.utils.parseEther("500"), ethers.utils.parseEther("1000")]
        );
        await starter.addWhiteList(
            0, 
            owner.address, 
            ethers.utils.parseEther("500")
         );
    });

    it ('Shoud revert all transactions', async function() {
        try {
            await starter.connect(user_one).swap(0, ethers.utils.parseEther("1000"));
        } catch (error) {
            expect(error.message).to.include("Pool must be enabled")
        }

        await starter.startPool(0);
        token.connect(owner).approve(starter.address, ethers.utils.parseEther("100000000"));

        try {
            await starter.connect(owner).swap(0, ethers.utils.parseEther("10"));
        } catch (error) {
            expect(error.message).to.include("Amount is not equal msg.value");
        }

        try {
            await starter.swap(ethers.utils.parseUnits('1', decimalPlaces), ethers.utils.parseUnits('0', decimalPlaces));
        } catch (error) {
            expect(error.message).to.include("Amount should not be zero")
        }

    })

    it ("Shoud try to swap", async function() {
       
        await starter.connect(user_one).swap(
            0,
            ethers.utils.parseEther('0.5'), 
            {value: ethers.utils.parseEther('0.5').toString()}
        );
        
     });


     

     it("Shoud claim tokens", async function() {
        await starter.finishPool(0);
        await starter.connect(user_one).claim(0);
        
     });
});