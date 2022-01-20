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

    it("should create a Drop, MintFromPool", async function(){
        /***CREATING DROP */
        // Caluclate the Key for the functionToFacet mapping
        let initializeSuper1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0x8129fc1c, "Super1155"]);
        let configureGroupSuper1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0x790974f2, "Super1155"]);
        let transferOwnershipSuper1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0xf2fde38b, "Super1155"]);
        let UNIVERSALSuper1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0x17f5ebb4, "Super1155"]);
        let setPermitSuper1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0xcf64d4c2, "Super1155"]);
        let ownerSuper1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0x8da5cb5b, "Super1155"]);
        let mintBatchSuper1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0x1f7fdffa, "Super1155"]);
        let balanceOfBatchSuper1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0x4e1273f4, "Super1155"]);

        let initializerSuperMintShop1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0x8129fc1c, "SuperMintShop1155"]);
        let setItemsSuperMintShopt1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0xe5e6e846, "SuperMintShop1155"]);
        let addPoolSuperMintShopt1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0x227292e0, "SuperMintShop1155"]);
        let addWhiteListSuperMintShopt1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0x455006e4, "SuperMintShop1155"]);
        let transferOwnershipSuperMintShopt1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0xf2fde38b, "SuperMintShop1155"]);
        let ownerSuperMintShop1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0x8da5cb5b, "SuperMintShop1155"]);
        let mintFromPoolSuperMintShop1155 = ethers.utils.solidityKeccak256(["bytes4", "string"], [0xa9d9aa50, "SuperMintShop1155"]);

        // Register the key in the LinkProxy contract
        await linkProxy.registerLink(initializeSuper1155, facetGroupUri.address); // initialize Super1155
        await linkProxy.registerLink(configureGroupSuper1155, facetGroupUri.address);
        await linkProxy.registerLink(transferOwnershipSuper1155, facetGroupUri.address);
        await linkProxy.registerLink(UNIVERSALSuper1155, facetGroupUri.address); 
        await linkProxy.registerLink(setPermitSuper1155, facetGroupUri.address); 
        await linkProxy.registerLink(ownerSuper1155, facetGroupUri.address); 
        await linkProxy.registerLink(mintBatchSuper1155, facetMintBurn.address); 
        await linkProxy.registerLink(balanceOfBatchSuper1155, facetMintBurn.address); 

        await linkProxy.registerLink(initializerSuperMintShop1155, facetMintFromPool.address); // initialize SuperMintShop1155
        await linkProxy.registerLink(setItemsSuperMintShopt1155, facetPools.address); 
        await linkProxy.registerLink(addPoolSuperMintShopt1155, facetPools.address); 
        await linkProxy.registerLink(addWhiteListSuperMintShopt1155, facetPools.address); 
        await linkProxy.registerLink(transferOwnershipSuperMintShopt1155, facetMintFromPool.address);
        await linkProxy.registerLink(ownerSuperMintShop1155, facetMintFromPool.address);
        await linkProxy.registerLink(mintFromPoolSuperMintShop1155, facetMintFromPool.address);

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
            "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65": 1,
            "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc" : 1
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
        let super1155 = await hre.ethers.getContractAt("StorageSuper1155", addresses[2]);
        let superMintShop1155 = await hre.ethers.getContractAt("StorageSuperMintShop1155", addresses[1]);
        
        // Owner of Super1155. // Same for SuperMinstShop1155
        const abi1 = ["function owner()"];
        const interfaced1 = new ethers.utils.Interface(abi1);
        const callData1 = interfaced1.encodeFunctionData("owner");
        let t1 = await ethers.provider.call({
            to: super1155.address,
            data: callData1
        })
        console.log(t1);
        console.log(signer3.address)

        console.log("SIGNER2")
        console.log(signer2.address)
        console.log("MINTSHOP")
        console.log(superMintShop1155.address)
        
        /***MINTFROMPOOL */
        const abi2 = ["function mintFromPool(uint256 _id, uint256 _groupId, uint256 _assetIndex, uint256 _amount, uint256 _itemIndex, (uint256 whiteListId, uint256 index, uint256 allowance, bytes32 node, bytes32[] merkleProof))"];
        const interfaced2 = new ethers.utils.Interface(abi2);
        const callData2 = interfaced2.encodeFunctionData("mintFromPool", [0, 1, 0, 1, 0, {
            whiteListId: 1,
            index: 4,
            allowance: 1,
            node: "0xf4ca8532861558e29f9858a3804245bb30f0303cc71e4192e41546237b6ce58b",
            merkleProof: [
                "0xe5c951f74bc89efa166514ac99d872f6b7a3c11aff63f51246c3742dfa925c9b",
                "0x475c5d26aa18ffb9161fadc3542fa0570c5ca4fc8a994f69219fd5157f2f7aa7",
                "0xcbd7db216427a61297ec0d7f576a864376cbd4f9fcf02d3c789a7447ec08903c"
            ]
        }]);

        await signer2.sendTransaction({
            to: superMintShop1155.address,
            data: callData2,
            value: ethers.utils.parseEther("0.5")
        })

        // Balance
        const abi3 = ["function balanceOfBatch(address[] _owners, uint256[] _ids)"];
        const interfaced3 = new ethers.utils.Interface(abi3);
        const callData = interfaced3.encodeFunctionData("balanceOfBatch", [[signer2.address],[ethers.BigNumber.from("0x0000000000000000000000000000000100000000000000000000000000000001")]]);
        let t3 = await ethers.provider.call({
            to: super1155.address,
            data: callData
        })
        console.log(t3);
    });
});