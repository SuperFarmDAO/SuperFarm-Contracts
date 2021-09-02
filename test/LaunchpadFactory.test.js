'use strict';
const { expect } = require('chai');

// Imports.
// import { ethers } from 'hardhat';
import 'chai/register-should';
let owner, user_one, user_two;
describe("LaunchpadFactory", function () {
    let factory, Factory;
    beforeEach(async () => {
        [owner, user_one, user_two] = await ethers.getSigners();
    });

    it("Shoud deploy contract", async function() {
        Factory = await ethers.getContractFactory('LaunchpadFactory');
        factory = await Factory.deploy('v0.0');

        await factory.deployed();

        let value = await factory.version();
        expect(value).to.equal('v0.0');
    });

    it("Shoud try to create Launchpad, when not in whitelist", async function() {
        await factory.toggleListEnforcement(true);
        try {
        let selfStareter = await factory.connect(owner).launch("TEST TITLE");
        } catch (error) {
            expect(error.message).to.include("FACTORY: OPERATOR NOT WHITELISTED")
        }
    });

    it ("Shoud add addresses to whitelist", async function() {
        await factory.modWhiteList([owner.address, user_one.address], true);

        let selfStarter = await factory.connect(owner).launch("TEST TITLE");
    });

    it ("Shoud get data", async function() {
        let info_user_one = await factory.getLaunchpadCount(user_one.address);
        let info_owner = await factory.getLaunchpadCount(owner.address);


        expect(info_user_one.toString()).to.equal('0');
        expect(info_owner.toString()).to.equal('1');
    });
});