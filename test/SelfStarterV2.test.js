'use strict';
const { expect } = require('chai');

const today = Math.trunc(new Date().getTime() / 1000);
import 'chai/register-should';
import { BigNumber } from 'ethers';
// import { ethers } from 'ethers';
let owner, user_one, user_two;

const decimalPlaces = 18;

describe("SelfStarterV2", function () {
    let starter, Starter, token, Token, token2, Token2;
    beforeEach(async () => {
        [owner, user_one, user_two] = await ethers.getSigners();
    });

    it("Shoud deploy all contracts", async function() {
        Starter = await ethers.getContractFactory('SelfStarterV2');
        Token = await ethers.getContractFactory('Token');
        starter = await Starter.deploy('TEST TITLE');
        token = await Token.connect(owner).deploy('TEST', 'TEST', ethers.utils.parseEther("10000000000000"));
        token2 = await Token.connect(owner).deploy('TEST2', 'TEST2', ethers.utils.parseEther("100000000"));
        await starter.deployed();
        await token.deployed();
        await token2.deployed();

        let title = await starter.idoTitle();
        expect(title).to.equal('TEST TITLE');

        await token.mint(owner.address, ethers.utils.parseEther("10000000000000"));
        await token2.mint(owner.address, ethers.utils.parseEther("100000000"));

        let balance1 = await token.balanceOf(owner.address);
        let balance2 = await token2.balanceOf(owner.address);

        expect(balance1.toString()).to.equal(balance1);
        expect(balance2.toString()).to.equal(balance2);


    });

    it ("Shoud revert when creating pool", async function() {
        try {
            await starter.connect(user_two).createPool(
                ethers.utils.parseEther("100000000"),
                '10000',
                ethers.utils.parseEther("100000"),
                token.address,
                true,
                owner.address,
                '0',
                today + 1000,
                today + 10000
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
            ethers.utils.parseEther("100"),
            '10000',
            ethers.utils.parseEther("10"),
            token.address,
            true,
            owner.address,
            '0',
            today + 1000,
            today + 10000
        );
        
        let value = await starter.poolsLength();
        expect(value).to.equal(1);
    });

    it ("Shoud add to whitelist", async function() {
       await starter.addWhiteList(
           0, 
           [user_one.address, user_two.address], 
           [ethers.utils.parseEther("500"), ethers.utils.parseEther("1000")]
        );
    });

    it ("Shoud update data for pool", async function() {
        await starter.setMinHolderAmount('0', '0');

        await starter.setHolderToken('0', owner.address);

        await starter.setStartTime('0', today + 1010);

        await starter.setTimespan('0', today + 10100);

        await starter.setTitle('Updated title');
     });

    it ('Shoud revert all transactions', async function() {
        try {
            await starter.connect(user_one).swap(0, ethers.utils.parseEther("1000"));
        } catch (error) {
            expect(error.message).to.include("TIME: Pool not open")
        }

        await ethers.provider.send("evm_setNextBlockTimestamp", [(today + 1010)]);
        await ethers.provider.send("evm_mine");

        try {
            await starter.connect(user_one).swap(0, ethers.utils.parseEther("1000"));
        } catch (error) {
            expect(error.message).to.include("Amount is not equal msg.value")
        }

        try {
            await starter.swap(ethers.utils.parseEther('1'), ethers.utils.parseEther('0'));
        } catch (error) {
            expect(error.message).to.include("Amount should not be zero")
        }

    })

    it ("Shoud try to swap", async function() {
       
        await ethers.provider.send("evm_setNextBlockTimestamp", [(today + 1050)]);
        await ethers.provider.send("evm_mine");

        await starter.connect(user_one).swap(
            0,
            ethers.utils.parseEther('1'), 
            {value: ethers.utils.parseEther('1').toString()}
        );
     });

     it("Shoud create manual pool", async function() {
        token2.connect(owner).approve(starter.address, ethers.utils.parseEther("100000000"));
        await starter.connect(owner).createPool(
            ethers.utils.parseEther("100"),
            '10000',
            ethers.utils.parseEther("100"),
            token2.address,
            true,
            owner.address,
            '0',
            0,
            0
        );

        await starter.addWhiteList(
            1, 
            [user_one.address, user_two.address], 
            [ethers.utils.parseEther("500"), ethers.utils.parseEther("1000")]
         );

        let value = await starter.poolsLength();
        expect(value).to.equal(2);
     });


     it("Shoud start, then finish pool", async function() {
        await starter.startPool(1);
        await starter.connect(user_one).swap(
            1,
            ethers.utils.parseEther('1'), 
            {value: ethers.utils.parseEther('1').toString()}
        );
        await starter.stopPool(1);

        try {
            await starter.connect(user_one).swap(
                0,
                ethers.utils.parseEther('1'), 
                {value: ethers.utils.parseEther('1').toString()}
            );
        } catch(erorr) {
            expect(error.message).to.include("Pool must be enabled")
        }
     });

     it("Shoud claim tokens", async function() {

        await starter.connect(user_one).claim(1);
        
     });
});