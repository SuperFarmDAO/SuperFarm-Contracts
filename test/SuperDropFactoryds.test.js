const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { mnemonicToSeed } = require('ethers/lib/utils');
const { ethers } = require('hardhat');
const Web3 = require('web3');
import {computeRootHash} from "./utils.js";


const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const DATA = "0x02";

///////////////////////////////////////////////////////////
// SEE https://hardhat.org/tutorial/testing-contracts.html
// FOR HELP WRITING TESTS
// USE https://github.com/gnosis/mock-contract FOR HELP
// WITH MOCK CONTRACT
///////////////////////////////////////////////////////////

// Start test block
describe('===Drop Factory DS===', function () {
    let deployer, owner, paymentReceiver, signer1, signer2, signer3;

    let FacetGroupUri, FacetMintBurn, FacetTransferApproval,
    FacetMintFromPool, FacetPools;

    let facetGroupUri, facetMintBurn, facetTransferApproval,
    facetMintFromPool, facetPools;

    let DropFactory, LinkProxy;

    let dropFactory, linkProxy;
    before(async function () {
        [deployer, owner, paymentReceiver, signer1, signer2, signer3] = await ethers.getSigners();

        FacetGroupUri = await ethers.getContractFactory("FacetGroupUri");
        FacetMintBurn = await ethers.getContractFactory("FacetMintBurn");
        FacetTransferApproval = await ethers.getContractFactory("FacetTransferApproval");
        FacetMintFromPool = await ethers.getContractFactory("FacetMintFromPool");
        FacetPools = await ethers.getContractFactory("FacetPools");
        DropFactory = await ethers.getContractFactory("SuperDropFactory");
        LinkProxy = await ethers.getContractFactory("LinkProxy");

        facetGroupUri = await FacetGroupUri.deploy();
        facetMintBurn = await FacetMintBurn.deploy();
        facetTransferApproval = await FacetTransferApproval.deploy();
        facetMintFromPool = await FacetMintFromPool.deploy();
        facetPools = await FacetPools.deploy();
        
        linkProxy = await LinkProxy.deploy();
        dropFactory = await DropFactory.deploy(deployer.address, linkProxy.address);
    });

    it("follows you", async function(){

        // Caluclate the Key for the functionToFacet mapping
        let initializeSuper1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0x8129fc1c, "Super1155"]);
        let configureGroupSuper1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0x790974f2, "Super1155"]);
        let transferOwnershipSuper1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0xf2fde38b, "Super1155"]);
        let UNIVERSALSuper1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0x17f5ebb4, "Super1155"]);
        let setPermitSuper1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0xcf64d4c2, "Super1155"]);
        let ownerSuper1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0x8da5cb5b, "Super1155"]);

        let initializerSuperMintShop1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0x8129fc1c, "SuperMintShop1155"]);
        let setItemsSuperMintShopt1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0xe5e6e846, "SuperMintShop1155"]);
        let addPoolSuperMintShopt1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0x227292e0, "SuperMintShop1155"]);
        let addWhiteListSuperMintShopt1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0x455006e4, "SuperMintShop1155"]);
        let transferOwnershipSuperMintShopt1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0xf2fde38b, "SuperMintShop1155"]);
        let ownerSuperMintShop1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0x8da5cb5b, "SuperMintShop1155"]);

        // Register the key in the LinkProxy contract
        await linkProxy.registerLink(initializeSuper1155, facetGroupUri.address); // initialize Super1155
        await linkProxy.registerLink(configureGroupSuper1155, facetGroupUri.address);
        await linkProxy.registerLink(transferOwnershipSuper1155, facetGroupUri.address);
        await linkProxy.registerLink(UNIVERSALSuper1155, facetGroupUri.address); 
        await linkProxy.registerLink(setPermitSuper1155, facetGroupUri.address); 
        await linkProxy.registerLink(ownerSuper1155, facetGroupUri.address); 

        await linkProxy.registerLink(initializerSuperMintShop1155, facetMintFromPool.address); // initialize SuperMintShop1155
        await linkProxy.registerLink(setItemsSuperMintShopt1155, facetPools.address); 
        await linkProxy.registerLink(addPoolSuperMintShopt1155, facetPools.address); 
        await linkProxy.registerLink(addWhiteListSuperMintShopt1155, facetPools.address); 
        await linkProxy.registerLink(transferOwnershipSuperMintShopt1155, facetMintFromPool.address);
        await linkProxy.registerLink(ownerSuperMintShop1155, facetMintFromPool.address);

        let mintShopCreateData = {
            paymentReceiver: '0x0656886450758213b1C2CDD73A4DcdeeC10d4D20',
            globalPurchaseLimit: 100,
            maxAllocation: 10
        }

        let itemGroupInput = [{
            supplyData: 200,
            itemData: 0,
            burnData: 200,
            timeData: {timeStamp: 0, timeInterval: 0, timeRate: 0, timeCap: 0},
            transferData: {transferTime: 0, transferFeeAmount: 0, transferToken: NULL_ADDRESS,transferType: 0, transferFeeType: 0},
            intrinsicData: {rate: 0, burnShare: 0, prefund: 0, totalLocked: 0, intrinsicToken: NULL_ADDRESS, intrinsic: false},
            supplyType: 0,
            itemType: 0,
            burnType: 1,
            name: "TEST ETH NFT"
        }, {
            supplyData: 200,
            itemData: 0,
            burnData: 200,
            timeData: {timeStamp: 0, timeInterval: 0, timeRate: 0, timeCap: 0},
            transferData: {transferTime: 0, transferFeeAmount: 0, transferToken: NULL_ADDRESS,transferType: 0, transferFeeType: 0},
            intrinsicData: {rate: 0, burnShare: 0, prefund: 0, totalLocked: 0, intrinsicToken: NULL_ADDRESS, intrinsic: false},
            supplyType: 0,
            itemType: 0,
            burnType: 1,
            name: "TES NFT ETH CONTRACT"
        }]

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

        const drop = await dropFactory.connect(signer1).createDrop(
            signer3.address,
            'Test ETH Collection',
            'https://d20l5i85b8vtpg.cloudfront.net/thumbnail/4c7c68ed-f446-4ca6-9e55-de65fa7aace2.png',
            'https://d20l5i85b8vtpg.cloudfront.net/thumbnail/4c7c68ed-f446-4ca6-9e55-de65fa7aace2.png',
            '0xf57b2c51ded3a29e6891aba85459d600256cf317',
            mintShopCreateData,
            itemGroupInput,
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
        let addresses = await dropFactory.getExactDrop(salt);
        let super1155 = await hre.ethers.getContractAt("MintShop1155", addresses[2]);
        let superMintShop1155 = await hre.ethers.getContractAt("MintShop1155", addresses[1]);

        let super1155Owner = await super1155.owner();
        let superMintShop1155Owner = await superMintShop1155.owner();

        console.log("Owner supplied at creation of Drop:");
        console.log(signer3.address);
        console.log("Owner of super1155 after Diamond Standard CreateDrop:");
        console.log(super1155Owner);
        console.log("Owner of superMintShop1155 after Diamond Standard CreateDrop:");
        console.log(superMintShop1155Owner);
    });
});