'use strict';
const { expect } = require('chai');

// Imports.
// import { ethers } from 'hardhat';
import 'chai/register-should';
let owner, user_one, user_two;
describe("Counter", function () {
    let counter, Counter;
    beforeEach(async () => {
        [owner, user_one, user_two] = await ethers.getSigners();
    });

    it("Shoud deploy contract", async function() {
        counter = await ethers.getContractFactory('Counter');
        Counter = await counter.deploy('0');

        await Counter.deployed();
        let value = await Counter.value();
        expect(value).to.equal(0);
    });

    it ("Shoud increment value", async function() {
        await Counter.increment();

        let value = await Counter.value();
        expect(value).to.equal(1);
    });

    it ("Shoud get data", async function() {
        await Counter.increment();

        let value = await Counter.getIncrementFor(owner.address);
        expect(value).to.equal(2);
    });
});