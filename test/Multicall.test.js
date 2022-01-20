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
const DATA = "0x02";

const SupplyType1155 = Object.freeze({
    Capped: 0 ,
    Uncapped: 1 ,
    Flexible: 2 
});

const ItemType1155 = Object.freeze({
    Nonfungible: 0,
    Fungible: 1,
    Semifungible: 2
  });

const BurnType1155 = Object.freeze({
    None: 0,
    Burnable: 1,
    Replenishable: 2
});

describe("Multicall", function () {
    const originalUri = "://ipfs/uri/{id}";
    const contractUri1155 = "://ipfs/uri/{id}";
    let multicall, Multicall, mintShop, MintShop, super1155, Super1155;
    let marketplace, registry, transferProxy, erc1155, erc721, weth;
    let itemGroupId = ethers.BigNumber.from(1);
    let itemGroupId2 = ethers.BigNumber.from(2);
    let shiftedItemGroupId = itemGroupId.shl(128);
    let shiftedItemGroupId2 = itemGroupId2.shl(128);
    let aliceBalance, bobBalance;
    beforeEach(async () => {
        [owner, alice, bob] = await ethers.getSigners();
        Multicall = await ethers.getContractFactory('Multicall');
        Super1155 = await ethers.getContractFactory("Super1155");
        multicall = await Multicall.deploy();


        [marketplace, registry, transferProxy, erc1155, erc721, weth] =  await utils.withContracts(owner.address, owner.address);
        await weth.mint(alice.address, utils.mint.weth.alice)
        await weth.mint(bob.address, utils.mint.weth.bob)
        await erc721.mint(alice.address, utils.mint.erc721.alice)
        await erc721.mint(bob.address, utils.mint.erc721.bob)

        await erc1155.mint(alice.address, utils.mint.erc1155.alice.id, utils.mint.erc1155.alice.amount, utils.mint.erc1155.alice.data)
        await erc1155.mint(bob.address, utils.mint.erc1155.bob.id, utils.mint.erc1155.bob.amount, utils.mint.erc1155.bob.data)

        super1155 = await Super1155.deploy(
            owner.address,
            "Super1155",
            originalUri,
            contractUri1155,
            NULL_ADDRESS
        );

        await super1155.connect(owner).configureGroup(
            itemGroupId,
            {
                name: 'PEPSI',
                supplyType: SupplyType1155.Capped,
                supplyData: 10,
                itemType: ItemType1155.Fungible,
                itemData: 0,
                burnType: BurnType1155.Burnable,
                burnData: 10
            }
        );
        
        await super1155.connect(owner).configureGroup(
            itemGroupId2,
            {
                name: 'COLA',
                supplyType: SupplyType1155.Capped,
                supplyData: 15,
                itemType: ItemType1155.Nonfungible,
                itemData: 0,
                burnType: BurnType1155.Burnable,
                burnData: 5
            }
        );
        
        await super1155.connect(owner).mintBatch(alice.address, [shiftedItemGroupId], ["10"], DATA);
        await super1155.connect(owner).mintBatch(bob.address, [shiftedItemGroupId2], ["1"], DATA);

        aliceBalance = await super1155.balanceOf(alice.address, shiftedItemGroupId.add(1));
        bobBalance = await super1155.balanceOf(bob.address, shiftedItemGroupId2.add(1));
    });

    it ("staticCallBytes", async function() {
        const Super1155ABI = await hre.artifacts.readArtifact("Super1155");
        
        let call = utils.encodeCalls(
            [super1155.address, super1155.address],
            [Super1155ABI, Super1155ABI],
            ["uri", "uriLocked"], 
            [[1], []]
        );

        let result = await multicall.staticCallBytes(call);
        let decoded = utils.decodeResults([Super1155ABI, Super1155ABI], ["uri", "uriLocked"], result);

        expect(decoded[0]).to.be.equal(originalUri);
        expect(decoded[1]).to.be.equal(false)  
    });

    it("staticCallUint", async function() {
        const Super1155ABI = await hre.artifacts.readArtifact("Super1155");
        
        let call = utils.encodeCalls(
            [super1155.address, super1155.address],
            [Super1155ABI, Super1155ABI],
            ["balanceOf","balanceOf"],
            [[alice.address, shiftedItemGroupId.add(1)], [bob.address, shiftedItemGroupId2.add(1)]]
        );        
        let result = await multicall.staticCallUint(call);

        expect(result[0]).to.be.equal(aliceBalance);
        expect(result[1]).to.be.equal(bobBalance);
    });

    it("staticCallUintSumm", async function() {
        const Super1155ABI = await hre.artifacts.readArtifact("Super1155");
        
        let call = utils.encodeCalls(
            [super1155.address, super1155.address],
            [Super1155ABI, Super1155ABI],
            ["balanceOf","balanceOf"],
            [[alice.address, shiftedItemGroupId.add(1)], [bob.address, shiftedItemGroupId2.add(1)]]
        );        
        let result = await multicall.staticCallUintSumm(call);

        expect(result).to.be.equal(aliceBalance.add(bobBalance));
    });

    it ("Multicall:: Staticcall failed", async function() {
        const Super1155ABI = await hre.artifacts.readArtifact("Super721");
        
        let call = utils.encodeCalls(
            [super1155.address, super1155.address],
            [Super1155ABI, Super1155ABI],
            ["tokenURI", "tokenURI"], 
            [[1], [1]]
        );

        await expect(multicall.staticCallBytes(call)).to.be.revertedWith("Multicall:: Staticcall failed");
        await expect(multicall.staticCallUintSumm(call)).to.be.revertedWith("Multicall:: Staticcall failed");
        await expect(multicall.staticCallUint(call)).to.be.revertedWith("Multicall:: Staticcall failed");
    });
})