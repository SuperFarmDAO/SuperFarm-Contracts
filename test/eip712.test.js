import {ethers, network} from "hardhat";
import {expect} from "chai";
import {OrderType, types} from "./TestTypes.js"
import {BigNumber} from "ethers";

import * as utils from "./utils.js"
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';


describe("Testing EIP712 standard", function(){
    let owner, alice, bob;
    let EIP712, eip712

    beforeEach(async function () {
        [owner, alice, bob] = await ethers.getSigners();
        EIP712 = await ethers.getContractFactory("EIP712Test");
        eip712 = await EIP712.deploy();
        await eip712.deployed();
    });

    it("recover public key", async function(){
        const domain = {
            name: "TestEIP712",
            version: "1",
            chainId: network.config.chainId,
            verifyingContract: eip712.address
        }
        const dataBytes = ethers.utils.id("hi");
        
        const message = {
            conditions: {
                give:{
                    assetsType: 2,
                    target: NULL_ADDRESS,
                    staticTarget: NULL_ADDRESS,
                    data: dataBytes,
                    replacementPattern: dataBytes,
                    staticExtradata: dataBytes
                },
                take:{
                    assetsType: 2,
                    target: NULL_ADDRESS,
                    staticTarget: NULL_ADDRESS,
                    data: dataBytes,
                    replacementPattern: dataBytes,
                    staticExtradata: dataBytes
                },
                listingTime: 0,
                expirationTime: 100,
                maker: NULL_ADDRESS,
                taker: NULL_ADDRESS,
                saleKind: 0
            },
            // exchange: NULL_ADDRESS,
            // side: 0,
            // callType: 0,
            // salt: 0,
            // fees: [10, 10, 10],
            // feeReceivers: [NULL_ADDRESS]
        };
        console.log(ethers.utils._TypedDataEncoder.getPrimaryType(types))
        console.log(owner.address)
        let signature = await owner._signTypedData(domain, types, message)
        expect(await eip712.connect(owner).recoverAddress(signature, message)).to.be.true
    })
})