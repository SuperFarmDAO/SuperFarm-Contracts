'use strict';
const { expect } = require('chai');
import {getCurrentTime} from "./utils.js";

// Imports.
import { ethers } from 'hardhat';
import {BigNumber} from "ethers";
import 'chai/register-should';
import * as utils from "./utils.js"

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

let configStandart;


describe("TokenRedeemerV3", function () {
	before(async function() {
		[owner, user_one, user_two, user_three] = await ethers.getSigners();
		TokenRedeemer = await ethers.getContractFactory("TokenRedeemer");
		tr = await TokenRedeemer.deploy(NULL_ADDRESS);

		[super721, super1155] = await utils.withSuperTokens(owner.address);
		mintRight = await super721.MINT();


		await super721.connect(owner).configureGroup(itemGroupId, {
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
			supplyType: utils.S1155SupplyType.Capped,
			supplyData: 5,
			itemType: utils.S1155ItemType.Fungible,
			itemData: 0,
			burnType: utils.S1155BurnType.Burnable,
			burnData: 0
		});
		await super1155.connect(owner).configureGroup(itemGroupId.add(1), {
			name: 'NFT',
			supplyType: utils.S1155SupplyType.Capped,
			supplyData: 5,
			itemType: utils.S1155ItemType.Fungible,
			itemData: 0,
			burnType: utils.S1155BurnType.Burnable,
			burnData: 0
		});

		await super721.connect(owner).mintBatch(user_one.address, [shiftedItemGroupId], ethers.utils.id('a'));
		await super1155.connect(owner).mintBatch(user_one.address, [shiftedItemGroupId], ["2"], "0x02");
		await super1155.connect(owner).mintBatch(user_one.address, [shiftedItemGroupId.add(1)], ["3"], "0x02");

		let balance = await super1155.balanceOf(user_one.address, shiftedItemGroupId.add(1));
		
		let config = {
			groupIdOut: itemGroupId,
			tokenOut: super721.address,
			burnOnRedemption: false,
			customBurn: false,
			requirements: [{
				collection: super1155.address,
				tokenId: [shiftedItemGroupId.add(1)],
				amounts: [1]
			}]
		}

		configStandart = {
			groupIdOut: itemGroupId,
			tokenOut: super721.address,
			burnOnRedemption: false,
			customBurn: false,
			requirements: [{
				collection: super1155.address,
				tokenId: [shiftedItemGroupId.add(1), shiftedItemGroupId.add(2)],
				amounts: [1, 2]
			}]
		}

		await tr.connect(owner).setRedemptionConfig(config, 0);

		
		let BURN = await super721.BURN();

		await super721.connect(owner).setPermit(
			tr.address,
			UNIVERSAL, 
			BURN, 
			ethers.constants.MaxUint256
		);

		await super1155.connect(owner).setPermit(
			tr.address,
			UNIVERSAL, 
			BURN, 
			ethers.constants.MaxUint256
		)
	});

	beforeEach(async function() {
		currentTime = await (await ethers.provider.getBlock()).timestamp;
		snaphotId = await network.provider.send("evm_snapshot");
	});

	afterEach(async function() {
		await network.provider.send("evm_revert", [snaphotId]);
	});

	it('Shoud redeem a token', async function() {
		await tr.connect(user_one).redeem(0);
	});

	it("Shoud revert: update config with no rights", async function() {
		let config = configStandart;
		await expect( 
			tr.connect(user_one).setRedemptionConfig(config, 0)
		).to.be.revertedWith("P1");
	});

	it('Shoud revert: groupId cannot be zero', async function() {
		let config = configStandart;
		config.groupIdOut = 0;
		await expect(
			tr.connect(owner).setRedemptionConfig(config, 0)
		).to.be.revertedWith("TokenRedeemer::setRedemptionConfig: group id cannot be zero");
	});

	it("Shoud revert: token out cannot be zero address", async function() {
		let config = configStandart;
		config.tokenOut = ethers.constants.AddressZero;
		await expect(
			tr.connect(owner).setRedemptionConfig(config, 0)
		).to.be.revertedWith("TokenRedeemer::setRedemptionConfig: token out cannot be zero address");
	});
    
	it('Shoud revert: must specify requirements', async function() {
		let config = configStandart;
		config.requirements = [];
		await expect(
			tr.connect(owner).setRedemptionConfig(config, 0)
		).to.be.revertedWith('TokenRedeemer::setRedemptionConfig: must specify requirements');
	});

	it('Shoud revert: required token cannot be zero', async function() {
		let config = configStandart;
		config.requirements = [{
			collection: NULL_ADDRESS,
			tokenId: [shiftedItemGroupId.add(1), shiftedItemGroupId.add(2)],
			amounts: [1, 2]
		}];
		await expect(
			tr.connect(owner).setRedemptionConfig(config, 0)
		).to.be.revertedWith("TokenRedeemer::redeem: required token cannot be zero");
	});

	it("Shoud revert: tokenId length cannot be zero", async function() {
		let config = configStandart;
		config.requirements = [{
			collection: super1155.address,
			tokenId: [],
			amounts: [1, 2]
		}];
		await expect(
			tr.connect(owner).setRedemptionConfig(config, 0)
		).to.be.revertedWith("TokenRedeemer::redeem: required tokenId cannot be zero");
	});

	it("Shoud revert: tokenId length cannot be zero", async function() {
		let config = configStandart;
		config.requirements = [{
			collection: super1155.address,
			tokenId: [shiftedItemGroupId.add(1), shiftedItemGroupId.add(2)],
			amounts: [1]
		}]
		await expect(
			tr.connect(owner).setRedemptionConfig(config, 0)
		).to.be.revertedWith("TokenRedeemer::redeem: required tokenId and amounts should be same length");
	});

	it('Shoud update config', async function() {
		let config = configStandart;
		await tr.connect(owner).setRedemptionConfig(config, 0);
	});

    it('Should revert if user tries to redeem token twice', async function() {
        let config = configStandart;
		await tr.connect(owner).setRedemptionConfig(config, 0);
		await tr.connect(user_one).redeem(0);
        await expect(
            tr.connect(user_one).redeem(0)
        ).to.be.revertedWith("User already redeemed")
	});

    
    it('Should revert if not token owner tries to redeem token', async function() {
        let config = configStandart;
		await tr.connect(owner).setRedemptionConfig(config, 0);
		await expect(
            tr.connect(user_two).redeem(0)
        ).to.be.revertedWith("TokenRedeemer::redeem: msg sender is not token owner");
    
	});
    
	it("Shoud update config and redeem nft", async function () {
		let config = configStandart;
		await tr.connect(owner).setRedemptionConfig(config, 0);
		await tr.connect(user_one).redeem(0);
	});

	

	it("Should burn token on redemption genericBurn 721 ", async function () {
        let config = {
			groupIdOut: itemGroupId,
			tokenOut: super721.address,
			burnOnRedemption: true,
			customBurn: false,
			requirements: [{
				collection: super1155.address,
				tokenId: [shiftedItemGroupId.add(1), shiftedItemGroupId.add(1)],
				amounts: [1, 2]
			}]
		}
		await tr.connect(owner).setRedemptionConfig(config, 0);
		await tr.connect(user_one).redeem(0);
    });

	it("Should burn token on redemption genericBurn 1155 ", async function () {
		// TODO which address is to use for burn 
		let config = {
			groupIdOut: itemGroupId,
			tokenOut: super721.address,
			burnOnRedemption: true,
			customBurn: false,
			requirements: [{
				collection: super1155.address,
				tokenId: [shiftedItemGroupId.add(1), shiftedItemGroupId.add(1)],
				amounts: [1, 2]
			}]
		}
		await tr.connect(owner).setRedemptionConfig(config, 0);
		await tr.connect(user_one).redeem(0);
	});


	it("Should burn token on redemption genericTransfer 721", async function () {
        let config = {
			groupIdOut: itemGroupId,
			tokenOut: super721.address,
			burnOnRedemption: true,
			customBurn: true,
			requirements: [{
				collection: super1155.address,
				tokenId: [shiftedItemGroupId.add(1), shiftedItemGroupId.add(1)],
				amounts: [1, 2]
			}]
		}
		await tr.connect(owner).setRedemptionConfig(config, 0);
		await tr.connect(user_one).redeem(0);
    });

	it("Should burn token on redemption genericTransfer 1155", async function () {});
	

    
});

