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
       
         
        let configGroup = {
            name: 'PEPSI',
            supplyType: 0,
            supplyData: 10,
            itemType: 1,
            itemData: 0,
            burnType: 1,
            burnData: 6
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
                whitelistId: 0
            },
            collection: NULL_ADDRESS
        };


        let data2 = [[1, 2], [1, 1], [10,10], [[{
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
        // let salt = "0x60eb971ba5cc65e981c8b3a0fff625736ce28dc2ee9a1b10f749ac1828c4aded";
        // // console.log(2);
        // // console.log([data2]);
        // // console.log(poolInput);
        // console.log("DROPFACTORY ADDRESS: ", factory.address);
        // console.log("OWNER v TESTE: ", owner.address);

        // let address = await factory.computeAddress(salt, bytecode);
        // let splitted = mintShopBytecode.split()

        // var chuncks = [];

        // for (var i = 0, charsLength = mintShopBytecode.length; i < charsLength; i += 66) {
        //     chuncks.push(mintShopBytecode.substring(i, i + 66));
        // }
        // fs.writeFile('mintShopByteCode.txt', chuncks);
        // console.log(chuncks);

        // fs.writeFile('mintShopByteCode.txt', chuncks.join('\n'), function (err) {
        //     if (err) return console.log(err);
        //     // console.log('Hello World > helloworld.txt');
        //   });

    //     fs.writeFile(
    //         'mintShopByteCode.txt',
    //         chuncks.map(function(v){ return v.join(' ') }).join('\n'),
    //         function (err) { console.log(err ? 'Error :'+err : 'ok') }
    //    );
        // await factory.sendData(chuncks);

        // let bytecodeInContract = await factory.getData();
        // console.log(bytecodeInContract);
        // console.log(address.toString());

        let salt = ethers.utils.formatBytes32String("HelloWorld");

        const drop = await factory.createDrop(
            '0x0656886450758213b1C2CDD73A4DcdeeC10d4D20',
            'Test ETH Collection',
            'https://d20l5i85b8vtpg.cloudfront.net/thumbnail/4c7c68ed-f446-4ca6-9e55-de65fa7aace2.png',
            '0xf57b2c51ded3a29e6891aba85459d600256cf317',
            '0x0656886450758213b1C2CDD73A4DcdeeC10d4D20',
            100,
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
                        requiredAsset: "0x0000000000000000000000000000000000000000",
                        requiredAmount: 0,
                        whitelistId: 0
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
            [
                {
                    expiryTime:{
                        type:"BigNumber",
                        hex:"0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
                    },
                    isActive:true,
                    addresses:[
                        "0x0000000000000000000000000000000000000000"
                    ]
                }
            ],
            salt
        );

       

        // let drops = await factory.getDrops();

        // let drops = await factory.getExactDrop(salt);


        
        // let MS =await  hre.ethers.getContractAt("MintShop1155", mintShopAddres);
        let addresses = await factory.getExactDrop(salt);
        let newMintShopAddress = addresses[1];
        let MSHOP = await hre.ethers.getContractAt("MintShop1155", newMintShopAddress);
        // let signers = await hre.ethers.getSigners();
        // console.log("signer1 ", signers[1]);
        console.log("newMintShopAddress ", newMintShopAddress);
        let poolData = await MSHOP.getPools([0], 0);
        // console.log(poolData);
        // console.log(poolData.toString());

            const id = 0; // In MVP there is only 1 pool in the drop, i.e. 1 collection, and there is no need to find it out of many others.
            const assetIndex = 0; // Hardcoded value only ETH
            const amount = 1; // In MVP in a single transaction, the user can buy only 1 instance of NFT.
            const itemIndex = 0; // In MVP only one contract address is used, for this reason it is hardcoded 0.
            const transactionData = {
                gasLimit: '0xe4e1c0',
                value: ethers.utils.parseEther("0.5")
            }

        let transaction = await MSHOP.mintFromPool( id,
            1,
            assetIndex,
            amount,
            itemIndex,
            transactionData);

        console.log(transaction);
        

    }).timeout(10000);


});