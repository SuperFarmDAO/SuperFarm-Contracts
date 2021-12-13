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
            outline: {
                basePrice: 0,
                listingTime: 0,
                expirationTime: 100,
                exchange: NULL_ADDRESS,
                maker: NULL_ADDRESS,
                side: 0,
                taker: NULL_ADDRESS,
                saleKind: 0,
                target: NULL_ADDRESS,
                callType: 0,
                paymentToken: NULL_ADDRESS
            },
            extra: [0, 10],
            salt: 0,
            fees: [10, 10, 10],
            addresses: [NULL_ADDRESS],
            staticTarget: NULL_ADDRESS,
            data: dataBytes,
            replacementPattern: dataBytes,
            staticExtradata: dataBytes
        };
    
        let sig = ethers.utils.splitSignature(await owner._signTypedData(domain, OrderType, message))
        expect(await eip712.connect(owner).recoverAddress(sig.v, sig.r, sig.s, message)).to.be.true
        // let sig = ethers.utils.splitSignature(await owner._signTypedData(domain, types, message));
        // console.log(owner.address)
        // expect(await eip712.connect(owner).checkOutline(sig.v, sig.r, sig.s, message.outline)).to.be.true
    })
})