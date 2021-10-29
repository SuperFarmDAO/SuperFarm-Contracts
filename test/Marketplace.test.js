import {ethers, network} from "hardhat";
import {expect} from "chai";

import * as utils from "./utils.js"

describe("SuperFarm Marketplace", function(){
    let owner, protocolFeeRecipient, alice, bob;
    let marketplace, registry, transferProxy, erc1155, erc721, exchangeToken, weth;

    // before(async function(){

    // })

    beforeEach(async function () {
        [owner, protocolFeeRecipient, alice, bob] = await ethers.getSigners();
        [marketplace, registry, transferProxy, erc1155, erc721, exchangeToken, weth] =  await utils.withContracts(protocolFeeRecipient.address, network.config.chainId);
        await exchangeToken.mint(alice.address, utils.mint.exchangeToken.alice)
        await exchangeToken.mint(bob.address, utils.mint.exchangeToken.bob)
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

    });

    it("Deploy and mint", async function(){
        // await exchangeToken.mint(alice.address, utils.mint.exchangeToken.alice)
        // await exchangeToken.mint(bob.address, utils.mint.exchangeToken.bob)
        // await weth.mint(alice.address, utils.mint.weth.alice)
        // await weth.mint(bob.address, utils.mint.weth.bob)
        // await erc721.mint(alice.address, utils.mint.erc721.alice)
        // await erc721.mint(alice.address, 4)
        // await erc721.mint(bob.address, 5)
        // // await erc721.mint(bob.address, utils.mint.erc721.bob)

        // await erc1155.mint(alice.address, utils.mint.erc1155.alice.id, utils.mint.erc1155.alice.amount, utils.mint.erc1155.alice.data)
        // await erc1155.mint(bob.address, utils.mint.erc1155.bob.id, utils.mint.erc1155.bob.amount, utils.mint.erc1155.bob.data)

        expect(await exchangeToken.balanceOf(bob.address)).to.be.eq(utils.mint.exchangeToken.bob)
        expect(await exchangeToken.balanceOf(alice.address)).to.be.eq(utils.mint.exchangeToken.alice)
        expect(await weth.balanceOf(bob.address)).to.be.eq(utils.mint.weth.bob)
        expect(await weth.balanceOf(alice.address)).to.be.eq(utils.mint.weth.alice)
        expect(await erc721.balanceOf(bob.address)).to.be.eq("1")
        expect(await erc721.balanceOf(alice.address)).to.be.eq("1")
        expect((await erc1155.balanceOf(bob.address, 1)).toString()).to.be.eq(utils.mint.erc1155.bob.amount.toString())
        expect((await erc1155.balanceOf(alice.address, 2)).toString()).to.be.eq(utils.mint.erc1155.alice.amount.toString())
    })

    it("ProxyRegistry: Register new user proxies, and authorize marketplace", async function(){

        expect(await registry.proxies(alice.address)).to.not.be.eq(utils.NULL_ADDRESS)
        expect(await registry.proxies(bob.address)).to.not.be.eq(utils.NULL_ADDRESS)
    })

    it("Marketplace: erc721 for erc20", async function(){
        let salt = 1;
        let abi = ["function transferFrom(address from,address to,uint256 tokenId)"]
        let iface = new ethers.utils.Interface(abi)
        let dataSell = iface.encodeFunctionData("transferFrom", [bob.address, utils.NULL_ADDRESS, 1]);
        let time = await utils.getCurrentTime()
        let orderSell = utils.makeOrder(
            ethers.utils.parseEther("0.1"),
            weth.address,
            exchangeToken.address,
            time,
            salt, 
            protocolFeeRecipient.address,
            marketplace.address,
            bob.address,
            utils.NULL_ADDRESS,
            erc721.address,
            dataSell,
            utils.replacementPatternSell,
            1
        )
        salt++
        let dataBuy = iface.encodeFunctionData("transferFrom", [utils.NULL_ADDRESS, alice.address, 1]);
        let orderBuy = utils.makeOrder(
            ethers.utils.parseEther("0.12"),
            weth.address,
            exchangeToken.address,
            time,
            salt,
            utils.NULL_ADDRESS,
            marketplace.address,
            alice.address,
            utils.NULL_ADDRESS,
            erc721.address,
            dataBuy,
            utils.replacementPatternBuy,
            0
        )
        let sellHash = await marketplace.hashOrder(orderSell)
        let buyHash = await marketplace.hashOrder(orderBuy)
        let signatureSell = await bob.signMessage(ethers.utils.arrayify(sellHash));
        let signatureBuy = await alice.signMessage(ethers.utils.arrayify(buyHash));
        let sigSell = ethers.utils.splitSignature(signatureSell);
        let sigBuy = ethers.utils.splitSignature(signatureBuy);
        let proxy = await registry.proxies(bob.address)
        await erc721.connect(bob).approve(proxy, 1)
        await weth.connect(alice).approve(transferProxy.address, ethers.utils.parseEther("0.12"))
        await marketplace.connect(alice).atomicMatch_(orderBuy, {v: sigBuy.v, r: sigBuy.r, s: sigBuy.s}, orderSell, {v: sigSell.v, r: sigSell.r, s: sigSell.s}, "0x0000000000000000000000000000000000000000000000000000000000000000", [], [])
        // ensure nft and tokens transfers
        expect(await weth.balanceOf(bob.address)).to.be.eq(ethers.utils.parseEther("100.1"))
        expect(await erc721.balanceOf(alice.address)).to.be.eq("2")
    })

    it("MarketPlace offer with decreasing price", async function() {
        let salt = 1;
        let abi = ["function transferFrom(address from,address to,uint256 tokenId)"]
        let iface = new ethers.utils.Interface(abi)
        let dataSell = iface.encodeFunctionData("transferFrom", [bob.address, utils.NULL_ADDRESS, 1]);
        let time = await utils.getCurrentTime()
        let orderSell = utils.makeOrder(
            ethers.utils.parseEther("0.1"),
            weth.address,
            exchangeToken.address,
            time,
            salt, 
            protocolFeeRecipient.address,
            marketplace.address,
            bob.address,
            utils.NULL_ADDRESS,
            erc721.address,
            dataSell,
            utils.replacementPatternSell,
            1
        )
        salt++
        let dataBuy = iface.encodeFunctionData("transferFrom", [utils.NULL_ADDRESS, alice.address, 1]);
        let orderBuy = utils.makeOrder(
            ethers.utils.parseEther("0.12"),
            weth.address,
            exchangeToken.address,
            time,
            salt,
            utils.NULL_ADDRESS,
            marketplace.address,
            alice.address,
            utils.NULL_ADDRESS,
            erc721.address,
            dataBuy,
            utils.replacementPatternBuy,
            0
        )
        let sellHash = await marketplace.hashOrder(orderSell)
        let buyHash = await marketplace.hashOrder(orderBuy)
        let signatureSell = await bob.signMessage(ethers.utils.arrayify(sellHash));
        let signatureBuy = await alice.signMessage(ethers.utils.arrayify(buyHash));
        let sigSell = ethers.utils.splitSignature(signatureSell);
        let sigBuy = ethers.utils.splitSignature(signatureBuy);
        let proxy = await registry.proxies(bob.address)
        await erc721.connect(bob).approve(proxy, 1)
        await weth.connect(alice).approve(transferProxy.address, ethers.utils.parseEther("0.12"))
        let price = await marketplace.connect(alice).calculateFinalPrice(1, 1, ethers.utils.parseEther("0.12"), 0, time, (time+360));
        console.log(price.toString());
        // await marketplace.connect(alice).atomicMatch_(orderBuy, {v: sigBuy.v, r: sigBuy.r, s: sigBuy.s}, orderSell, {v: sigSell.v, r: sigSell.r, s: sigSell.s}, "0x0000000000000000000000000000000000000000000000000000000000000000", [], [])
    });
});