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
    let super721LiteFacet;
    let super721Blueprint;
    let super721LiteProxy1;
    let super721LiteProxy2;
    let proxyRegistry;
    const originalUri = "://ipfs/uri/";
    const originalUri721 = "://ipfs/uri/";

    before(async function () {
        this.Super721LiteFacet = await ethers.getContractFactory("Super721LiteFacet");
        this.Super721LiteProxy = await ethers.getContractFactory("Super721LiteProxy");
        this.Super721Blueprint = await ethers.getContractFactory("Super721LiteBlueprint");
        this.ProxyRegistry = await ethers.getContractFactory("MockProxyRegistry");
    });

    beforeEach(async function () {
        [deployer, signer1, signer2, signer3] = await ethers.getSigners();

        proxyRegistry = await this.ProxyRegistry.deploy();
        await proxyRegistry.deployed();

        super721LiteFacet = await this.Super721LiteFacet.deploy();
        await super721LiteFacet.deployed();

        super721Blueprint = await this.Super721Blueprint.deploy();
        await super721Blueprint.deployed();
        
        setUriRight = await super721Blueprint.SET_URI();
        lockUriRight = await super721Blueprint.LOCK_URI();
        lockItemUriRight = await super721Blueprint.LOCK_ITEM_URI();
        mintRight = await super721Blueprint.MINT();
        setProxyRegistryRight = await super721Blueprint.SET_PROXY_REGISTRY();
        setMetadataRight = await super721Blueprint.SET_METADATA();
        lockCreationRight = await super721Blueprint.LOCK_CREATION();

        super721LiteProxy1 = await this.Super721LiteProxy.deploy(
            super721LiteFacet.address,
            signer1.address,
            "QazCoin",
            "Q",
            9,
            5,
            originalUri,
            originalUri721,
            proxyRegistry.address);
    });

    // Test cases

    //////////////////////////////
    //       Constructor
    //////////////////////////////
    describe("Deploy a new proxy", function () {
        it('should check deployed paramaters', async function () {
            // For "string" return value:
            // Remove 128characters to the left and remove all the zeros from the end in pairs of two
            let abi1 = ["function name()"];
            let interfaced1 = new ethers.utils.Interface(abi1);
            let callData1 = interfaced1.encodeFunctionData("name");
            let t1 = await ethers.provider.call({
                to: super721LiteProxy1.address,
                data: callData1
            });
            let name = await t1.substring(130, t1.length);
            for (let i = name.length - 1; i >= 0; i-=2) {
                if ((name[i] == "0" && name[i-1] != "0") ||
                    name[i] != "0" && name[i-1] != "0") {
                        name = await name.substring(0, i+1);
                        break;
                    }
            }
            await expect(await ethers.utils.toUtf8String(await ethers.utils.hexlify("0x" + name))).to.be.equal("QazCoin");

            let abi2 = ["function symbol()"];
            let interfaced2 = new ethers.utils.Interface(abi2);
            let callData2 = interfaced2.encodeFunctionData("symbol");
            let t2 = await ethers.provider.call({
                to: super721LiteProxy1.address,
                data: callData2
            });
            let symbol = await t2.substring(130, t2.length);
            for (let i = symbol.length - 1; i >= 0; i-=2) {
                if ((symbol[i] == "0" && symbol[i-1] != "0") ||
                    symbol[i] != "0" && symbol[i-1] != "0") {
                        symbol = await symbol.substring(0, i+1);
                        break;
                    }
            }
            await expect(await ethers.utils.toUtf8String(await ethers.utils.hexlify("0x" + symbol))).to.be.equal("Q");

            let abi3 = ["function tokenURI(uint256)"];
            let interfaced3 = new ethers.utils.Interface(abi3);
            let callData3 = interfaced3.encodeFunctionData("tokenURI", [5]);
            let t3 = await ethers.provider.call({
                to: super721LiteProxy1.address,
                data: callData3
            });
            let tokenUri = await t3.substring(130, t3.length);
            for (let i = tokenUri.length - 1; i >= 0; i-=2) {
                if ((tokenUri[i] == "0" && tokenUri[i-1] != "0") ||
                    tokenUri[i] != "0" && tokenUri[i-1] != "0") {
                        tokenUri = await tokenUri.substring(0, i+1);
                        break;
                    }
            }
            await expect(await ethers.utils.toUtf8String(await ethers.utils.hexlify("0x" + tokenUri))).to.be.equal("://ipfs/uri/5");
            
            // For "uint256" or "integer" return value: 
            // Simply convert it to uint
            let abi4 = ["function totalSupply()"];
            let interfaced4 = new ethers.utils.Interface(abi4);
            let callData4 = interfaced4.encodeFunctionData("totalSupply");
            let t4 = await ethers.provider.call({
                to: super721LiteProxy1.address,
                data: callData4
            });
            await expect(await ethers.BigNumber.from(t4)).to.be.equal(9);

            let abi5 = ["function batchSize()"];
            let interfaced5 = new ethers.utils.Interface(abi5);
            let callData5 = interfaced5.encodeFunctionData("batchSize");
            let t5 = await ethers.provider.call({
                to: super721LiteProxy1.address,
                data: callData5
            });
            await expect(await ethers.BigNumber.from(t5)).to.be.equal(5);
            

            // For "address" return value: 
            // Simply get the 40 hex characters from the right
            let abi6 = ["function implementation()"];
            let interfaced6 = new ethers.utils.Interface(abi6);
            let callData6 = interfaced6.encodeFunctionData("implementation");
            let t6 = await ethers.provider.call({
                to: super721LiteProxy1.address,
                data: callData6
            });
            let imp = await ethers.utils.getAddress(t6.substring(t6.length - 40, t6.length));
            await expect(imp).to.be.equal(super721LiteFacet.address);

            // For URI return value:
            // Same string rule applies
            let abi7 = ["function contractURI()"];
            let interfaced7 = new ethers.utils.Interface(abi7);
            let callData7 = interfaced7.encodeFunctionData("contractURI");
            let t7 = await ethers.provider.call({
                to: super721LiteProxy1.address,
                data: callData7
            });
            let cUri = await t7.substring(130, t7.length);
            for (let i = cUri.length - 1; i >= 0; i-=2) {
                if ((cUri[i] == "0" && cUri[i-1] != "0") ||
                        cUri[i] != "0" && cUri[i-1] != "0") {
                        cUri = await cUri.substring(0, i+1);
                        break;
                    }
            }
            await expect(await ethers.utils.toUtf8String(await ethers.utils.hexlify("0x" + cUri))).to.be.equal("://ipfs/uri/");

            // For "address" return value: 
            // Simply get the 40 hex characters from the right
            let abi8 = ["function proxyRegistryAddress()"];
            let interfaced8 = new ethers.utils.Interface(abi8);
            let callData8 = interfaced8.encodeFunctionData("proxyRegistryAddress");
            let t8 = await ethers.provider.call({
                to: super721LiteProxy1.address,
                data: callData8
            });
            let imp2 = await ethers.utils.getAddress(t8.substring(t8.length - 40, t8.length));
            await expect(imp2).to.be.equal(proxyRegistry.address);
        });

        it('should check all functionalities', async function () {
            // Signer2 tries minting without permit
            let abi = ["function mintBatch(address, uint256, bytes)"];
            let interfaced = new ethers.utils.Interface(abi);
            let callData = interfaced.encodeFunctionData("mintBatch", [signer3.address, 5, "0x00"]);
            await expect (signer2.sendTransaction({
                to: super721LiteProxy1.address,
                data: callData
            })).to.be.revertedWith("P1");

            // Signer2 is given permit by the owner
            abi = ["function UNIVERSAL()"];
            interfaced = new ethers.utils.Interface(abi);
            callData = interfaced.encodeFunctionData("UNIVERSAL");
            let t = await ethers.provider.call({
                to: super721LiteProxy1.address,
                data: callData
            });

            abi = ["function setPermit(address, bytes32, bytes32, uint256)"];
            interfaced = new ethers.utils.Interface(abi);
            callData = interfaced.encodeFunctionData("setPermit", [signer2.address, t, mintRight, ethers.constants.MaxUint256]);
            await signer1.sendTransaction({
                to: super721LiteProxy1.address,
                data: callData
            });

            // Signer2 tries minting to zero address
            abi = ["function mintBatch(address, uint256, bytes)"];
            interfaced = new ethers.utils.Interface(abi);
            callData = interfaced.encodeFunctionData("mintBatch", [NULL_ADDRESS, 5, "0x00"]);
            await expect (signer2.sendTransaction({
                to: super721LiteProxy1.address,
                data: callData
            })).to.be.revertedWith("Super721: mint to zero address");

            // Signer2 tries minting more than the batchSize
            abi = ["function mintBatch(address, uint256, bytes)"];
            interfaced = new ethers.utils.Interface(abi);
            callData = interfaced.encodeFunctionData("mintBatch", [signer3.address, 10, "0x00"]);
            await expect (signer2.sendTransaction({
                to: super721LiteProxy1.address,
                data: callData
            })).to.be.revertedWith("Super721: quantity too high");

            // Signer2 tries minting successfully to signer3
            abi = ["function mintBatch(address, uint256, bytes)"];
            interfaced = new ethers.utils.Interface(abi);
            callData = interfaced.encodeFunctionData("mintBatch", [signer3.address, 2, "0x00"]);
            await signer2.sendTransaction({
                to: super721LiteProxy1.address,
                data: callData
            });

            // Signer2 tries minting successfully to signer1
            abi = ["function mintBatch(address, uint256, bytes)"];
            interfaced = new ethers.utils.Interface(abi);
            callData = interfaced.encodeFunctionData("mintBatch", [signer1.address, 1, "0x00"]);
            await signer2.sendTransaction({
                to: super721LiteProxy1.address,
                data: callData
            });

            // Signer2 tries minting successfully to signer3
            abi = ["function mintBatch(address, uint256, bytes)"];
            interfaced = new ethers.utils.Interface(abi);
            callData = interfaced.encodeFunctionData("mintBatch", [signer3.address, 2, "0x00"]);
            await signer2.sendTransaction({
                to: super721LiteProxy1.address,
                data: callData
            });

            // MintedIndices so far: [S3][S3][S1][S3][S3][MintIndex][-][-][-]
            // Signer2 tries minting beyond cap = 9
            abi = ["function mintBatch(address, uint256, bytes)"];
            interfaced = new ethers.utils.Interface(abi);
            callData = interfaced.encodeFunctionData("mintBatch", [signer3.address, 5, "0x00"]);
            await expect (signer2.sendTransaction({
                to: super721LiteProxy1.address,
                data: callData
            })).to.be.revertedWith("Super721: cap reached");

            // Check tokenOfOwnerByIndex for Signer1
            abi = ["function tokenOfOwnerByIndex(address, uint256)"];
            interfaced = new ethers.utils.Interface(abi);
            callData = interfaced.encodeFunctionData("tokenOfOwnerByIndex", [signer1.address, 0]);
            t = await ethers.provider.call({
                to: super721LiteProxy1.address,
                data: callData
            });
            await expect(ethers.BigNumber.from(t)).to.be.equal(2);

            // Check ownershipOf token indices 3th and 4th
            abi = ["function ownerOf(uint256)"];
            interfaced = new ethers.utils.Interface(abi);
            callData = interfaced.encodeFunctionData("ownerOf", [4]);
            t = await ethers.provider.call({
                to: super721LiteProxy1.address,
                data: callData
            });
            expect(await ethers.utils.getAddress(t.substring(t.length - 40, t.length))).to.be.equal(signer3.address);

            // Signer3 transfers two tokens to signer1
            abi = ["function safeBatchTransferFrom(address, address, uint256[], bytes)"];
            interfaced = new ethers.utils.Interface(abi);
            callData = interfaced.encodeFunctionData("safeBatchTransferFrom", [signer3.address, signer1.address, [3, 4], "0x00"]);
            await signer3.sendTransaction({
                to: super721LiteProxy1.address,
                data: callData
            });

            // Signer1 now owns 3th index
            abi = ["function ownerOf(uint256)"];
            interfaced = new ethers.utils.Interface(abi);
            callData = interfaced.encodeFunctionData("ownerOf", [3]);
            t = await ethers.provider.call({
                to: super721LiteProxy1.address,
                data: callData
            });
            expect(await ethers.utils.getAddress(t.substring(t.length - 40, t.length))).to.be.equal(signer1.address);

             // Signer1 now owns 4th index
             abi = ["function ownerOf(uint256)"];
             interfaced = new ethers.utils.Interface(abi);
             callData = interfaced.encodeFunctionData("ownerOf", [4]);
             t = await ethers.provider.call({
                 to: super721LiteProxy1.address,
                 data: callData
             });
             expect(await ethers.utils.getAddress(t.substring(t.length - 40, t.length))).to.be.equal(signer1.address);
        });
    });
});