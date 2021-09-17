'use strict';
const { expect } = require('chai');

// Imports.
// import { ethers } from 'hardhat';
import 'chai/register-should';
let today = new Date() / 1000;
let owner, user_one, user_two;
let NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
describe("DropFactory test", function () {
    let factory, Factory, mintShop;
    beforeEach(async () => {
        [owner, user_one, user_two] = await ethers.getSigners();
    });

    it("Shoud deploy contract", async function() {
        Factory = await ethers.getContractFactory('DropFactory');
        factory = await Factory.deploy('v0.1');

        await factory.deployed();

        let value = await factory.version();
        expect(value).to.equal('v0.1');
    });

    it("Shoud try to create new drop", async function() {
        let configGroup = {
            name: 'PEPSI',
            supplyType: 0,
            supplyData: 10,
            itemType: 1,
            itemData: 0,
            burnType: 1,
            burnData: 6
        };

       

        let poolData = {

        };
        let poolInput = {
            name: "firstPool",
            startTime: today,
            endTime: today + 60,
            purchaseLimit: 5,
            singlePurchaseLimit: 2,
            requirement: {
                requiredType: 0,
                requiredAsset: NULL_ADDRESS,
                requiredAmount: 1,
                whitelistId: 1
            }
        };

        let poolConfigurationData = {
            groupIds: [1, 2],
            issueNumberOffsets: [1, 1],
            caps: [10, 1],
            prices: [[{
                assetType: 1,
                asset: NULL_ADDRESS,
                price: 1
            }], [{
                assetType: 1,
                asset: NULL_ADDRESS,
                price: 1
            }]]
        }


        let addresses = await factory.createDrop(
            owner.address,
            "TEST_COLLECTION", 
            "data_uri", 
            "0x0000000000000000000000000000000000000000",
            user_one.address, 
            100, 
            configGroup, 
            poolInput, 
            poolConfigurationData);


        console.log(addresses);
    });

  
});