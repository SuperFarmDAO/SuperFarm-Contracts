'use strict';
const { expect } = require('chai');
import {getCurrentTime} from "./utils.js";

// Imports.
// import { ethers } from 'hardhat';
import {BigNumber} from "ethers";
import 'chai/register-should';
let owner, user_one, user_two, user_three;
let TokenRedeemer, tr, Super721, super721;
let snaphotId;
let currentTime;
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const originalUri = "://ipfs/uri/";
const originalUri721 = "://ipfs/uri/";
let itemGroupId = ethers.BigNumber.from(1);
let shiftedItemGroupId = itemGroupId.shl(128);

let mintRight;
let UNIVERSAL;
let super1155, Super1155;



describe("TokenRedeemerV3", function () {
    before(async function() {
        [owner, user_one, user_two, user_three] = await ethers.getSigners();
        TokenRedeemer = await ethers.getContractFactory("TokenRedeemerV3");
        tr = await TokenRedeemer.deploy(NULL_ADDRESS);

        Super1155 = await ethers.getContractFactory("Super1155");

        super1155 = await Super1155.deploy(
            owner.address,
            "Super1155",
            originalUri,
            originalUri,
            NULL_ADDRESS
        );

        Super721 = await ethers.getContractFactory("Super721");

        super721 = await Super721.deploy(
            owner.address,
            "Super721",
            "SIMX721",
            originalUri,
            originalUri721,
            NULL_ADDRESS,
        );
        mintRight = await super721.MINT();


        await super721.connect(owner).configureGroup(shiftedItemGroupId, {
            name: 'NFT',
            supplyType: 0,
            supplyData: 20000,
            burnType: 1,
            burnData: 100
        });
        UNIVERSAL = await super721.UNIVERSAL();
        await super721.connect(owner).setPermit(
            tr.address,
            UNIVERSAL,
            mintRight,
            ethers.constants.MaxUint256
        );

        await super1155.connect(owner).configureGroup(itemGroupId, {
            name: 'NFT',
            supplyType: 0,
            supplyData: 5,
            itemType: 1,
            itemData: 0,
            burnType: 0,
            burnData: 0
        });

        await super1155.connect(owner).mintBatch(user_one.address, [shiftedItemGroupId], ["2"], "0x02");

        let balance = await super1155.balanceOf(user_one.address, shiftedItemGroupId.add(1));
        console.log(balance)


        let config = {
            groupIdOut: itemGroupId.add(1),
            amountOut: 1,
            tokenOut: super721.address,
            burnOnRedemption: false,
            customBurn: false,
            requirements: [{
                collection: super1155.address,
                tokenId: [shiftedItemGroupId.add(1)],
                amounts: [1]
            }]
        }

        await tr.connect(owner).setRedemptionConfig(config, 0);
    });

    beforeEach(async function() {
        currentTime = await (await ethers.provider.getBlock()).timestamp;
        snaphotId = await network.provider.send("evm_snapshot");
    });

    afterEach(async function() {
        await network.provider.send("evm_revert", [snaphotId]);
    });

    it("Shoud redeem a token", async function() {
       await tr.connect(user_one).redeem(0);
    });
});

