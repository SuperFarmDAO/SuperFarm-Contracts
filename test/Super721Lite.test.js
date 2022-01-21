const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { ethers } = require('hardhat');
const Web3 = require('web3');

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const DECIMALS = 2;

const AMT = 150

///////////////////////////////////////////////////////////
// SEE https://hardhat.org/tutorial/testing-contracts.html
// FOR HELP WRITING TESTS
// USE https://github.com/gnosis/mock-contract FOR HELP
// WITH MOCK CONTRACT
///////////////////////////////////////////////////////////

// Start test block
describe('===Super721Lite===', function () {
    let deployer, signer1, signer2, signer3;
    let setUriRight,
        lockUriRight,
        lockItemUriRight,
        mintRight,
        setMetadataRight,
        lockCreationRight,
        setProxyRegistryRight;
    let UNIVERSAL;
    let super721Lite;
    let super721Blueprint;
    let super721LiteProxy1;
    let super721LiteProxy2;
    let proxyRegistry;
    const originalUri = "://ipfs/uri/";
    const originalUri721 = "://ipfs/uri/";

    before(async function () {
        this.Super721Lite = await ethers.getContractFactory("Super721Lite");
        this.Super721LiteProxy = await ethers.getContractFactory("Super721LiteProxy");
        this.Super721Blueprint = await ethers.getContractFactory("Super721LiteBlueprint");
        this.ProxyRegistry = await ethers.getContractFactory("MockProxyRegistry");
    });

    beforeEach(async function () {
        [deployer, signer1, signer2, signer3] = await ethers.getSigners();

        proxyRegistry = await this.ProxyRegistry.deploy();
        await proxyRegistry.deployed();

        super721Lite = await this.Super721Lite.deploy();
        await super721Lite.deployed();

        super721Blueprint = await this.Super721Blueprint.deploy();
        await super721Blueprint.deployed();
        
        setUriRight = await super721Blueprint.SET_URI();
        lockUriRight = await super721Blueprint.LOCK_URI();
        lockItemUriRight = await super721Blueprint.LOCK_ITEM_URI();
        mintRight = await super721Blueprint.MINT();
        setProxyRegistryRight = await super721Blueprint.SET_PROXY_REGISTRY();
        setMetadataRight = await super721Blueprint.SET_METADATA();
        lockCreationRight = await super721Blueprint.LOCK_CREATION();
    });

    // Test cases

    //////////////////////////////
    //       Constructor
    //////////////////////////////
    describe("Deploy a new proxy", function () {
        it('should check all correctness', async function () {
            super721LiteProxy1 = await this.Super721LiteProxy.deploy(
                super721Lite.address,
                signer1.address,
                "QazCoin",
                "Q",
                100,
                5,
                originalUri,
                originalUri721,
                proxyRegistry.address);
               
            // For "string" return value:
            // Remove 128characters to the left and remove all the zeros from the end in pairs of two
            let abi1 = ["function name()"];
            let interfaced1 = new ethers.utils.Interface(abi1);
            let callData1 = interfaced1.encodeFunctionData("name");
            let t1 = await ethers.provider.call({
                to: super721LiteProxy1.address,
                data: callData1
            });
            console.log("Collection Name:");
            console.log(await ethers.utils.toUtf8String(t1));

            let abi2 = ["function symbol()"];
            let interfaced2 = new ethers.utils.Interface(abi2);
            let callData2 = interfaced2.encodeFunctionData("symbol");
            let t2 = await ethers.provider.call({
                to: super721LiteProxy1.address,
                data: callData2
            });
            console.log("Collection Symbol:");
            console.log(await ethers.utils.toUtf8String(t2));

            let abi3 = ["function tokenURI(uint256)"];
            let interfaced3 = new ethers.utils.Interface(abi3);
            let callData3 = interfaced3.encodeFunctionData("tokenURI", [5]);
            let t3 = await ethers.provider.call({
                to: super721LiteProxy1.address,
                data: callData3
            });
            console.log("Collection URI:");
            console.log(await ethers.utils.toUtf8String(t3));
            
            // For "uint256" or "integer" return value: 
            // Simply convert it to uint
            let abi4 = ["function totalSupply()"];
            let interfaced4 = new ethers.utils.Interface(abi4);
            let callData4 = interfaced4.encodeFunctionData("totalSupply");
            let t4 = await ethers.provider.call({
                to: super721LiteProxy1.address,
                data: callData4
            });
            console.log("Collection TotalSupply:");
            console.log((await ethers.BigNumber.from(t4)).toString());

            let abi5 = ["function batchSize()"];
            let interfaced5 = new ethers.utils.Interface(abi5);
            let callData5 = interfaced5.encodeFunctionData("batchSize");
            let t5 = await ethers.provider.call({
                to: super721LiteProxy1.address,
                data: callData5
            });
            console.log("Collection BatchSize:");
            console.log((await ethers.BigNumber.from(t5)).toString());

            // For "address" return value: 
            // Simply get the 40 hex characters from the right
            let abi6 = ["function implementation()"];
            let interfaced6 = new ethers.utils.Interface(abi6);
            let callData6 = interfaced6.encodeFunctionData("implementation");
            let t6 = await ethers.provider.call({
                to: super721LiteProxy1.address,
                data: callData6
            });
            console.log("Collection Logic Contract Address:");
            console.log(await ethers.utils.getAddress(await ethers.utils.hexlify(await ethers.utils.stripZeros(t6))));

            // b.contractURI = _contractURI;
            // b.proxyRegistryAddress = _proxyRegistryAddress;
        });
    });
});
