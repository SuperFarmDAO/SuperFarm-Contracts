'use strict';
const { expect } = require('chai');
import 'chai/register-should';
import {computeRootHash} from "./utils.js";
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
        Factory = await hre.ethers.getContractFactory('DropFactory');

        // mintShopHelper = await MintShopHelper.deploy();
        factory = await Factory.deploy(mintShopHelper.address, super1155Helper.address);


        await factory.deployed();
        console.log(factory.address);
        let value = await factory.version();
        expect(value).to.equal('v0.1');
        // done();
    }).timeout(10000);

    it("Shoud try to create new drop", async function () {
    
        let mintShopCreateData = {
            _paymentReceiver: '0x0656886450758213b1C2CDD73A4DcdeeC10d4D20',
            _globalPurchaseLimit: 100,
            _maxAllocation: 10
        }
        let whiteList1 = {
            "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" : 1, 
            "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" : 1, 
            "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC": 1, 
            "0x90F79bf6EB2c4f870365E785982E1f101E93b906": 1, 
            "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65": 1, 
            "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc": 1, 
            "0x976EA74026E726554dB657fA54763abd0C3a0aa9": 1
        }

        let whiteList2 = {
            "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" : 1, 
            "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" : 1, 
            "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC": 1, 
            "0x90F79bf6EB2c4f870365E785982E1f101E93b906": 1, 
            "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65": 1
        }

        let whiteList3 = {
            "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" : 1, 
            "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" : 1, 
            "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC": 1, 
            "0x90F79bf6EB2c4f870365E785982E1f101E93b906": 1,
            "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc": 1, 
            "0x976EA74026E726554dB657fA54763abd0C3a0aa9": 1
        }

        let whiteListCreate1 = {
            _accesslistId: 0,
            _merkleRoot: computeRootHash(whiteList1),
            _startTime: 0,
            _endTime: ethers.constants.MaxUint256,
            _price: ethers.utils.parseEther("1"),
            _token: NULL_ADDRESS
        }
        let whiteListCreate2 = {
            _accesslistId: 1,
            _merkleRoot: computeRootHash(whiteList2),
            _startTime: 0,
            _endTime: ethers.constants.MaxUint256,
            _price: ethers.utils.parseEther("1"),
            _token: NULL_ADDRESS
        }
        let whiteListCreate3 = {
            _accesslistId: 2,
            _merkleRoot: computeRootHash(whiteList3),
            _startTime: 0,
            _endTime: ethers.constants.MaxUint256,
            _price: ethers.utils.parseEther("1"),
            _token: NULL_ADDRESS
        }
        let wlData = [[whiteListCreate1, whiteListCreate2, whiteListCreate3]];

        let salt = ethers.utils.formatBytes32String("HelloWorld");

        const drop = await factory.createDrop(
            '0x0656886450758213b1C2CDD73A4DcdeeC10d4D20',
            'Test ETH Collection',
            'https://d20l5i85b8vtpg.cloudfront.net/thumbnail/4c7c68ed-f446-4ca6-9e55-de65fa7aace2.png',
            'https://d20l5i85b8vtpg.cloudfront.net/thumbnail/4c7c68ed-f446-4ca6-9e55-de65fa7aace2.png',
            '0xf57b2c51ded3a29e6891aba85459d600256cf317',
            mintShopCreateData,
            [
                {
                    name: "TEST ETH NFT",
                    supplyType: 0,
                    supplyData: 200,
                    itemType: 0,
                    itemData: 0,
                    burnType: 1,
                    burnData: 200
                },
                {
                    name: "TES NFT ETH CONTRACT",
                    supplyType: 1,
                    supplyData: 200,
                    itemType: 0,
                    itemData: 0,
                    burnType: 1,
                    burnData: 200
                }
            ],
            [
                {
                    name: "Test ETH Collection",
                    startTime: 0,
                    endTime: 1640933280,
                    purchaseLimit: 100,
                    singlePurchaseLimit: 1,
                    requirement: {
                        requiredType: 0,
                        requiredAsset: ["0x0000000000000000000000000000000000000000"],
                        requiredAmount: 0,
                        requiredId: []
                    },
                    collection: "0x0000000000000000000000000000000000000000"
                }
            ],
            [[[1, 2], [1, 1], [5, 5],
                [
                    [
                        {
                            assetType: 1,
                            asset: "0x0000000000000000000000000000000000000000",
                            price: ethers.utils.parseEther("0.5")
                            
                        }
                    ],
                    [
                        {
                            assetType: 1,
                            asset: "0x0000000000000000000000000000000000000000",
                            price: {
                                type: "BigNumber",
                                hex: "0x00"
                            }
                        }
                    ]
                ]
            ]],
            wlData,
            salt
        );
        let addresses = await factory.getExactDrop(salt);
        let newMintShopAddress = addresses[1];
        let MSHOP = await hre.ethers.getContractAt("MintShop1155", newMintShopAddress);
        console.log("newMintShopAddress ", newMintShopAddress);
        

    }).timeout(10000);


});