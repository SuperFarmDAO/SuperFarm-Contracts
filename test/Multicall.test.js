'use strict';
const hre = require("hardhat");
const { expect } = require('chai');
import 'chai/register-should';
import Web3 from 'web3';
import * as utils from "./utils.js"

import { ethers, network } from 'hardhat';
let owner, alice, bob;
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const web3 = new Web3();


var convert = function hexToStr(hex) {
	var str = '';
	for (var i = 0; i < hex.length; i += 2) {
	   var v = parseInt(hex.substr(i, 2), 16);
	   if (v) str += String.fromCharCode(v);
	}

  	let params = [];
	let res = "";
	for (var i=0; i<= str.length; i++){
		if(str.charCodeAt(i) > 31){
			res = res + str[i];
		}
		else{
			params.push(res);
			res = "";
		}
	}
	params.pop();

  return params;
}

describe("Multicall", function () {
    let multicall, Multicall, mintShop, MintShop, super1155, Super1155;
    let marketplace, registry, transferProxy, erc1155, erc721, weth;
    beforeEach(async () => {
        [owner, alice, bob] = await ethers.getSigners();
        Multicall = await ethers.getContractFactory('Multicall');
        MintShop = await ethers.getContractFactory("MintShop1155");
        Super1155 = await ethers.getContractFactory("Super1155");
        multicall = await Multicall.deploy();

        // TODO add Marketplace 
        [marketplace, registry, transferProxy, erc1155, erc721, weth] =  await utils.withContracts(owner.address, owner.address);
        await weth.mint(alice.address, utils.mint.weth.alice)
        await weth.mint(bob.address, utils.mint.weth.bob)
        await erc721.mint(alice.address, utils.mint.erc721.alice)
        await erc721.mint(bob.address, utils.mint.erc721.bob)

        await erc1155.mint(alice.address, utils.mint.erc1155.alice.id, utils.mint.erc1155.alice.amount, utils.mint.erc1155.alice.data)
        await erc1155.mint(bob.address, utils.mint.erc1155.bob.id, utils.mint.erc1155.bob.amount, utils.mint.erc1155.bob.data)

        await registry.startGrantAuthentication(marketplace.address)
        await utils.evm_increaseTime(604_801_000)
        await registry.endGrantAuthentication(marketplace.address)
        await registry.connect(alice).registerProxy();
        await registry.connect(bob).registerProxy();

        mintShop = await MintShop.deploy(
            owner.address,
            alice.address,
            4,
            200
        );

        super1155 = await Super1155.deploy(
            owner.address,
            "Super1155",
            "0/00",
            "0/00",
            NULL_ADDRESS
        );

        await mintShop.setItems([super1155.address]);
        
        let latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
        await mintShop.connect(owner).addPool({
            name: "firstPool",
            startTime: latestBlock.timestamp,
            endTime: latestBlock.timestamp + 60,
            purchaseLimit: 5,
            singlePurchaseLimit: 2,
            requirement: {
                requiredType: 0,
                requiredAsset: [NULL_ADDRESS],
                requiredAmount: 1,
                whitelistId: 1,
                requiredId: []
            },
            collection: super1155.address
        }, [1, 2], [1, 1], [10, 1], [[{
            assetType: 1,
            asset: NULL_ADDRESS,
            price: 1
        }], [{
            assetType: 1,
            asset: NULL_ADDRESS,
            price: 1
        }]]);

        await mintShop.connect(owner).addPool({
            name: "anotherPool",
            startTime: latestBlock.timestamp,
            endTime: latestBlock.timestamp + 60,
            purchaseLimit: 5,
            singlePurchaseLimit: 2,
            requirement: {
                requiredType: 0,
                requiredAsset: [NULL_ADDRESS],
                requiredAmount: 1,
                whitelistId: 1,
                requiredId: []
            },
            collection: super1155.address
        }, [1, 2], [1, 1], [10, 1], [[{
            assetType: 1,
            asset: NULL_ADDRESS,
            price: 228
        }], [{
            assetType: 1,
            asset: NULL_ADDRESS,
            price: 42
        }]]);
    });

    it ("Shoud get data with web3", async function() {
        let ABIgetPools = ["function getPools(uint256[] calldata _ids, uint256 _itemIndex) external view returns (PoolOutput[] memory)"];
        let iface = new ethers.utils.Interface(ABIgetPools);
        // let encodedData = await ethers.utils.defaultAbiCoder.encode([ "uint[]", "uint" ], [ [ 0 ], 0])

        let encodedData = iface.encodeFunctionData("getPools", [  [ 0 ], 0 ]);
        let call = {
            target: mintShop.address,
            callData: encodedData
        }
        let result = await multicall.staticCallBytes([call]);

        let result2 = await mintShop.getPools(  [ 0 ], 0 );
        const MintShopABI = await hre.artifacts.readArtifact("MintShop1155");


        const functionABI =  MintShopABI.abi.find((abiItem) => {return abiItem.name == 'getPools';});

        const decoded = web3.eth.abi.decodeParameters(functionABI.outputs, String(result));

        console.log("what we get")
   
        console.log(decoded[0][0][0]); 
    });

    it ("Shoud get data by ethers call one function", async function() {
        const MintShopABI = await hre.artifacts.readArtifact("MintShop1155");
        
        let call = utils.encodeCall(mintShop.address, MintShopABI, "getPools", [[0], 0])

        let result = await multicall.staticCallBytes(call);

        const decoded = utils.decodeResult(MintShopABI, "getPools", result);

        console.log("what we get")
        console.log(decoded[0][0][0]);  
    });

    it("Should work with multiple functions ", async function() {
        const MintShopABI = await hre.artifacts.readArtifact("MintShop1155");
        
        let call = utils.encodeCalls(
            [mintShop.address, mintShop.address],
            [MintShopABI, MintShopABI],
            ["getPools","getPools"],
            [[[0], 0], [[1], 0]]
        );        

        let result = await multicall.staticCallBytes(call);
        console.log(result);

        let decodedResults = utils.decodeResults([MintShopABI, MintShopABI], ["getPools", "getPools"], result);

        console.log(decodedResults);
        console.log(decodedResults[0][0]);
        console.log(decodedResults[1][0]);
    });


})