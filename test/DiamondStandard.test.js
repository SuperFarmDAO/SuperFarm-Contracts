const { Provider } = require('@ethersproject/abstract-provider');
const { expect } = require('chai');
const { BigNumber, utils } = require('ethers');
const { mnemonicToSeed } = require('ethers/lib/utils');
const { ethers } = require('hardhat');
const Web3 = require('web3');

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const DATA = "0x02";

///////////////////////////////////////////////////////////
// SEE https://hardhat.org/tutorial/testing-contracts.html
// FOR HELP WRITING TESTS
// USE https://github.com/gnosis/mock-contract FOR HELP
// WITH MOCK CONTRACT
///////////////////////////////////////////////////////////

// Start test block
describe('===DiamondStandard===', function () {
    let deployer, owner, paymentReceiver, signer1, signer2, signer3;

    let fd, fi; //FaceDependent, FaceIndependent
    let dp; // DiamondProxy
    before(async function () {
        this.Fd = await ethers.getContractFactory("FacetDependent");
        this.Fi = await ethers.getContractFactory("FacetIndependent");
        this.Dp = await ethers.getContractFactory("DiamondProxy");
    });

    beforeEach(async function () {
        [deployer, owner, paymentReceiver, signer1, signer2, signer3] = await ethers.getSigners();
        
        fd = await this.Fd.deploy();
        await fd.deployed();

        fi = await this.Fi.deploy();
        await fi.deployed();

        // Add all the selectors of all the functions to their corresponding Facets
        dp = await this.Dp.deploy(
            [0xde992a2a, 0x13af4035, 0x9b9f3458, 0xd003d23e, 0x6f73ce0d, 0x136d6a39, 0xb108fbe5],
            [fi.address, fi.address, fi.address, fd.address, fd.address, fd.address, fi.address]
        ); //9b9f3458
        //0x893d20e8
        await dp.deployed();
    });

    describe("General", function () {
        it('should check validity', async function () {
            const abi1 = ["function setOwner(address _address)"];
            const abi2 = ["function getOwner(bool dummy)"];
            const abi3 = ["function getAccessAddresses(address _address)"];
            const abi4 = ["function addAccessAddresses(address _address)"];

            const interface1 = new ethers.utils.Interface(abi1);
            const interface2 = new ethers.utils.Interface(abi2);
            const interface3 = new ethers.utils.Interface(abi3);
            const interface4 = new ethers.utils.Interface(abi4);

            const callData1 = interface1.encodeFunctionData("setOwner", [signer1.address]);
            const callData2 = interface2.encodeFunctionData("getOwner", [true]);
            const callData3 = interface3.encodeFunctionData("getAccessAddresses", [signer2.address]);
            const callData4 = interface4.encodeFunctionData("addAccessAddresses", [signer2.address]);


            await deployer.sendTransaction({
                to: dp.address,
                data: callData1
            })

            // let tx =await deployer.sendTransaction({
            //     to: dp.address,
            //     data: callData2
            // })

            let tx = await ethers.provider.call({
                to: dp.address,
                data: callData2
            })

            // let owner = await dp.callStatic.getOwner();

            let t1 = await ethers.provider.call({
                to: dp.address,
                data: callData3
            })
            console.log(t1); // False

            await deployer.sendTransaction({
                to: dp.address,
                data: callData4
            })

            let t2 = await ethers.provider.call({
                to: dp.address,
                data: callData3
            })
            console.log(t2); // True

            // let z = await dp.getOwner();

            // console.log(z)
            // console.log(tx)

        });
    });
});