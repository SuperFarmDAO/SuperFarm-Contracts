// const { expect } = require('chai');
// const { BigNumber } = require('ethers');
// const { ethers } = require('hardhat');
// import * as utils from "./utils.js"
// const Web3 = require('web3');
// const hre = require("hardhat");

// const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

// const DECIMALS = 2;

// const AMT = 150

// ///////////////////////////////////////////////////////////
// // SEE https://hardhat.org/tutorial/testing-contracts.html
// // FOR HELP WRITING TESTS
// // USE https://github.com/gnosis/mock-contract FOR HELP
// // WITH MOCK CONTRACT
// ///////////////////////////////////////////////////////////

// // Start test block
// describe('===Super1155Lite===', function () {
//     let deployer, signer1, signer2, signer3;
//     let setUriRight,
//         lockUriRight,
//         lockItemUriRight,
//         mintRight,
//         setMetadataRight,
//         lockCreationRight,
//         setProxyRegistryRight;
//     let UNIVERSAL;
//     let super1155LiteFacet;
//     let super1155Blueprint;
//     let super1155LiteProxy1;
//     let super1155LiteProxy2;
//     let proxyRegistry;
//     const originalUri = "://ipfs/uri/";
//     const originalUri1155 = "://ipfs/uri/";
//     let Super1155LiteFacetABI;
//     before(async function () {
//         this.Super1155LiteFacet = await ethers.getContractFactory("Super1155LiteFacet");
//         this.Super1155LiteProxy = await ethers.getContractFactory("Super1155LiteProxy");
//         this.Super1155Blueprint = await ethers.getContractFactory("Super1155LiteBlueprint");
//         this.ProxyRegistry = await ethers.getContractFactory("MockProxyRegistry");
//     });

//     beforeEach(async function () {
//         [deployer, signer1, signer2, signer3] = await ethers.getSigners();

//         proxyRegistry = await this.ProxyRegistry.deploy();
//         await proxyRegistry.deployed();

//         super1155LiteFacet = await this.Super1155LiteFacet.deploy();
//         await super1155LiteFacet.deployed();

//         super1155Blueprint = await this.Super1155Blueprint.deploy();
//         await super1155Blueprint.deployed();
        
//         setUriRight = await super1155Blueprint.SET_URI();
//         lockUriRight = await super1155Blueprint.LOCK_URI();
//         lockItemUriRight = await super1155Blueprint.LOCK_ITEM_URI();
//         mintRight = await super1155Blueprint.MINT();
//         setProxyRegistryRight = await super1155Blueprint.SET_PROXY_REGISTRY();
//         setMetadataRight = await super1155Blueprint.SET_METADATA();
//         lockCreationRight = await super1155Blueprint.LOCK_CREATION();

//         super1155LiteProxy1 = await this.Super1155LiteProxy.deploy(
//             super1155LiteFacet.address,
//             signer1.address,
//             "QazCoin",
//             "Q",
//             9,
//             5,
//             originalUri,
//             originalUri1155,
//             proxyRegistry.address
//         );

//         await super1155LiteProxy1.deployed();

//         Super1155LiteFacetABI = hre.artifacts.readArtifact('Super1155LiteFacet');

//     });

//     beforeEach(async function () {
//         currentTime = await (await ethers.provider.getBlock()).timestamp;
// 		snapshotId = await network.provider.send("evm_snapshot");
//     });

//     afterEach( async function () {
// 		await network.provider.send("evm_revert", [snapshotId]);
//     });

//     // // // // // //
//     // TEST CASES  // 
//     // // // // // //
//     describe('check contract parameters', function() {
//         let callName = utils.encodeCall(
//             super1155LiteProxy1.address,
//             Super1155LiteFacetABI,
//             "name", 
//             ""
//         );
//         let callMetadataUri = utils.encodeCall(
//             super1155LiteProxy1.address,
//             Super1155LiteFacetABI,
//             "name", 
//             ""
//         );
//         let callContractURI = utils.encodeCall(
//             super1155LiteProxy1.address,
//             Super1155LiteFacetABI,
//             "name", 
//             "");
//         let callProxyRegistryAddress = utils.encodeCall(
//             super1155LiteProxy1.address,
//             Super1155LiteFacetABI,
//             "name", 
//             ""
//         );
//         let callVersion = utils.encodeCall(
//             super1155LiteProxy1.address,
//             Super1155LiteFacetABI,
//             "name", 
//             ""
//         );

//         let name = utils.decodeResult(
//             Super1155LiteFacetABI, 
//             "name", 
//             callName
//         );
//         let metadataUri; 
//         let contractURI; 
//         let proxyRegistryAddress; 
//         let version; 
//         // expect(await super1155Lite.owner()).to.equal(owner.address);
//         expect(name()).to.equal("Super1155Lite");
//         expect(metadataUri()).to.equal(metadataUri);
//         expect(contractURI()).to.equal(contractUri);
//         expect(proxyRegistryAddress()).to.equal(proxyRegistry.address);
//         expect(version()).to.equal(1);
//     });
// });

