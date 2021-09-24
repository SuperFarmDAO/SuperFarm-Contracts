'use strict';
const { expect } = require('chai');
// Imports.
// import { ethers } from 'hardhat';
import 'chai/register-should';
// import { ethers } from 'hardhat';
let today = new Date() / 100;
let owner, user_one, user_two;
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
describe("DropFactory test", function () {
    let factory, Factory, mintShop, mintShopHelper, MintShopHelper, super1155Helper, Super1155Helper, bytesMintShop, bytesSuper1155;
    beforeEach(async () => {
        [owner, user_one, user_two] = await ethers.getSigners();
    });

    it("Shoud deploy contract", async function () {
        Super1155Helper = await ethers.getContractFactory('Super1155Helper');
        MintShopHelper = await ethers.getContractFactory('MintShopHelper');

        mintShopHelper = await MintShopHelper.deploy();
        super1155Helper = await Super1155Helper.deploy();

        // bytesMintShop = ethers.utils.hexlify(bytecodeMintShop);
        await mintShopHelper.deployed();
        
        await super1155Helper.deployed();

        // MintShopHelper = await ethers.getContractFactory('HelperMintShop');
        Factory = await ethers.getContractFactory('DropFactory');

        // mintShopHelper = await MintShopHelper.deploy();
        factory = await Factory.deploy('v0.1', mintShopHelper.address, super1155Helper.address);


        await factory.deployed();

        let value = await factory.version();
        expect(value).to.equal('v0.1');
    });

    it("Shoud try to create new drop", async function () {
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
            startTime: 1,
            endTime: 1 + 60,
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

        let data2 = [[1, 2], [1, 1], [10, 1], [[{
            assetType: 1,
            asset: NULL_ADDRESS,
            price: 1
        }], [{
            assetType: 1,
            asset: NULL_ADDRESS,
            price: 1
        }]]];


        console.log(1);
        let data = [
            [1, 2],
            [1, 1],
            [10, 1],
            [[
                1,
                NULL_ADDRESS,
                1
            ], [
                1,
                NULL_ADDRESS,
                1
            ]]
        ];
        let salt = "0x60eb971ba5cc65e981c8b3a0fff625736ce28dc2ee9a1b10f749ac1828c4aded";
        // console.log(2);
        // console.log([data2]);
        // console.log(poolInput);
        console.log("DROPFACTORY ADDRESS: ", factory.address);
        console.log("OWNER v TESTE: ", owner.address)

        // let address = await factory.computeAddress(salt, bytecode);

        // console.log(address.toString());
        let addresses = await factory.createDrop(
            owner.address,
            "TEST_COLLECTION",
            "data_uri",
            "0x0000000000000000000000000000000000000000",
            user_one.address,
            ethers.utils.parseEther("100"),
            [configGroup],
            [poolInput],
            [data2]
        );

        let drops = await factory.getDrops();

        console.log(drops.toString());
        // console.log(addresses);
    });


});