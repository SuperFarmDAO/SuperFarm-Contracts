import {ethers, network} from "hardhat";
import {expect} from "chai";
import {BigNumber} from "ethers";

import * as utils from "./utils.js"

describe("SuperFarm Marketplace", function(){
    let owner, protocolFeeRecipient, creator, alice, bob;
    let marketplace, registry, transferProxy, erc1155, erc721, exchangeToken, weth;

    beforeEach(async function () {
        [owner, protocolFeeRecipient, creator, alice, bob] = await ethers.getSigners();
        [marketplace, registry, transferProxy, erc1155, erc721, weth] =  await utils.withContracts(protocolFeeRecipient.address, network.config.chainId);
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
            time,
            salt, 
            protocolFeeRecipient.address,
            creator.address,
            marketplace.address,
            bob.address,
            utils.NULL_ADDRESS,
            erc721.address,
            dataSell,
            utils.replacementPatternSell,
            1,
            0
        )
        salt++
        let dataBuy = iface.encodeFunctionData("transferFrom", [utils.NULL_ADDRESS, alice.address, 1]);
        let orderBuy = utils.makeOrder(
            ethers.utils.parseEther("0.12"),
            weth.address,
            time,
            salt,
            utils.NULL_ADDRESS,
            creator.address,
            marketplace.address,
            alice.address,
            utils.NULL_ADDRESS,
            erc721.address,
            dataBuy,
            utils.replacementPatternBuy,
            0,
            0
        )
        console.log("entered")
        let sellHash = await marketplace.hashOrder(orderSell)
        let buyHash = await marketplace.hashOrder(orderBuy)
        console.log("entered")
        let signatureSell = await bob.signMessage(ethers.utils.arrayify(sellHash));
        let signatureBuy = await alice.signMessage(ethers.utils.arrayify(buyHash));
        console.log("entered")
        let sigSell = ethers.utils.splitSignature(signatureSell);
        let sigBuy = ethers.utils.splitSignature(signatureBuy);
        console.log("entered")
        let proxy = await registry.proxies(bob.address)
        await erc721.connect(bob).approve(proxy, 1)
        await weth.connect(alice).approve(transferProxy.address, ethers.utils.parseEther("0.12"))
        await marketplace.connect(alice).atomicMatch_(orderBuy, {v: sigBuy.v, r: sigBuy.r, s: sigBuy.s}, orderSell, {v: sigSell.v, r: sigSell.r, s: sigSell.s}, "0x0000000000000000000000000000000000000000000000000000000000000000", [], [])
        // ensure nft and tokens transfers
        expect(await weth.balanceOf(bob.address)).to.be.eq(ethers.utils.parseEther("100.1"))
        expect(await erc721.balanceOf(alice.address)).to.be.eq("2")
    })

    it("MarketPlace listing with decreasing price", async function() {
        let salt = 1;
        let abi = ["function transferFrom(address from,address to,uint256 tokenId)"]
        let iface = new ethers.utils.Interface(abi)
        let dataSell = iface.encodeFunctionData("transferFrom", [bob.address, utils.NULL_ADDRESS, 1]);
        let time = await utils.getCurrentTime()
        let orderSell = utils.makeOrder(
            ethers.utils.parseEther("0.1"),
            weth.address,
            time,
            salt, 
            protocolFeeRecipient.address,
            creator.address,
            marketplace.address,
            bob.address,
            utils.NULL_ADDRESS,
            erc721.address,
            dataSell,
            utils.replacementPatternSell,
            1,
            0
        )
        salt++
        let dataBuy = iface.encodeFunctionData("transferFrom", [utils.NULL_ADDRESS, alice.address, 1]);
        let orderBuy = utils.makeOrder(
            ethers.utils.parseEther("0.12"),
            weth.address,
            time,
            salt,
            utils.NULL_ADDRESS,
            creator.address,
            marketplace.address,
            alice.address,
            utils.NULL_ADDRESS,
            erc721.address,
            dataBuy,
            utils.replacementPatternBuy,
            0,
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

    it("Buy erc721 for ether", async function() {

        let salt = 1;
        let abi = ["function transferFrom(address from,address to,uint256 tokenId)"]
        let iface = new ethers.utils.Interface(abi)
        let dataSell = iface.encodeFunctionData("transferFrom", [bob.address, utils.NULL_ADDRESS, 1]);
        let time = await utils.getCurrentTime()
        let orderSell = utils.makeOrder(
            ethers.utils.parseEther("12"),
            utils.NULL_ADDRESS,
            time,
            salt, 
            protocolFeeRecipient.address,
            creator.address,
            marketplace.address,
            bob.address,
            utils.NULL_ADDRESS,
            erc721.address,
            dataSell,
            utils.replacementPatternSell,
            1,
            0
        )
        salt++
        let dataBuy = iface.encodeFunctionData("transferFrom", [utils.NULL_ADDRESS, alice.address, 1]);
        let orderBuy = utils.makeOrder(
            ethers.utils.parseEther("12"),
            utils.NULL_ADDRESS,
            time,
            salt,
            utils.NULL_ADDRESS,
            creator.address,
            marketplace.address,
            alice.address,
            utils.NULL_ADDRESS,
            erc721.address,
            dataBuy,
            utils.replacementPatternBuy,
            0,
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
        let oldBobBalance = await bob.getBalance();
        let oldAliceBalance = await alice.getBalance();

        console.log("Bob old: ", oldBobBalance.toString());
        console.log("Alice old: ", oldAliceBalance.toString());
        await marketplace.connect(alice).atomicMatch_(orderBuy, {v: sigBuy.v, r: sigBuy.r, s: sigBuy.s}, orderSell, {v: sigSell.v, r: sigSell.r, s: sigSell.s}, "0x0000000000000000000000000000000000000000000000000000000000000000", [], [], { value: ethers.utils.parseEther("12")})


        let bnBob = BigNumber.from(await bob.getBalance());
        console.log(bnBob.toString());
        let newBobBalance = await bob.getBalance();
        let newAliceBalance = await alice.getBalance();

        console.log("Bob new: ", newBobBalance.toString());
        console.log("Alice new: ", newAliceBalance.toString());

        let finalBob = BigNumber.from(oldBobBalance);
        
        // ensure nft and tokens transfers
        console.log("Bob", bnBob.sub(finalBob).toString())
        console.log("Alice", newAliceBalance - oldAliceBalance)

        expect(await erc721.balanceOf(alice.address)).to.be.eq("2")
        expect(bnBob.sub(finalBob).toString()).to.be.equal(ethers.utils.parseEther("12"));
    });
    it("Erc721 auction", async function() {
        let salt = 1;
        let abi = ["function transferFrom(address from,address to,uint256 tokenId)"]
        let iface = new ethers.utils.Interface(abi)
        let dataSell = iface.encodeFunctionData("transferFrom", [bob.address, utils.NULL_ADDRESS, 1]);
        let time = await utils.getCurrentTime()
        let orderSell = utils.makeOrder(
            ethers.utils.parseEther("0.1"),
            utils.NULL_ADDRESS,
            time,
            salt, 
            protocolFeeRecipient.address,
            creator.address,
            marketplace.address,
            bob.address,
            utils.NULL_ADDRESS,
            erc721.address,
            dataSell,
            utils.replacementPatternSell,
            1,
            2
        )
        salt++
        let dataBuy = iface.encodeFunctionData("transferFrom", [utils.NULL_ADDRESS, alice.address, 1]);
        let orderBuy = utils.makeOrder(
            ethers.utils.parseEther("0.12"),
            utils.NULL_ADDRESS,
            time,
            salt,
            utils.NULL_ADDRESS,
            creator.address,
            marketplace.address,
            alice.address,
            utils.NULL_ADDRESS,
            erc721.address,
            dataBuy,
            utils.replacementPatternBuy,
            0,
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

        await marketplace.connect(alice).atomicMatch_(orderBuy, {v: sigBuy.v, r: sigBuy.r, s: sigBuy.s}, orderSell, {v: sigSell.v, r: sigSell.r, s: sigSell.s}, "0x0000000000000000000000000000000000000000000000000000000000000000", [], [], { value: ethers.utils.parseEther("12")})

        expect(await erc721.balanceOf(alice.address)).to.be.eq("2")
    });

    it("Marketplace offer listing", async function() {
        let salt = 1;
        let abi = ["function transferFrom(address from,address to,uint256 tokenId)"]
        let iface = new ethers.utils.Interface(abi)
        let dataSell = iface.encodeFunctionData("transferFrom", [bob.address, utils.NULL_ADDRESS, 1]);
        let time = await utils.getCurrentTime()
        let orderSell = utils.makeOrder(
            ethers.utils.parseEther("0.1"),
            utils.NULL_ADDRESS,
            time,
            salt, 
            protocolFeeRecipient.address,
            creator.address,
            marketplace.address,
            bob.address,
            utils.NULL_ADDRESS,
            erc721.address,
            dataSell,
            utils.replacementPatternSell,
            1,
            3
        )
        salt++
        let dataBuy = iface.encodeFunctionData("transferFrom", [utils.NULL_ADDRESS, alice.address, 1]);
        let orderBuy = utils.makeOrder(
            ethers.utils.parseEther("0.12"),
            utils.NULL_ADDRESS,
            time,
            salt,
            utils.NULL_ADDRESS,
            creator.address,
            marketplace.address,
            alice.address,
            utils.NULL_ADDRESS,
            erc721.address,
            dataBuy,
            utils.replacementPatternBuy,
            0,
            3
        )
        let sellHash = await marketplace.hashOrder(orderSell)
        let buyHash = await marketplace.hashOrder(orderBuy)
        let signatureSell = await bob.signMessage(ethers.utils.arrayify(sellHash));
        let signatureBuy = await alice.signMessage(ethers.utils.arrayify(buyHash));
        let sigSell = ethers.utils.splitSignature(signatureSell);
        let sigBuy = ethers.utils.splitSignature(signatureBuy);
        let proxy = await registry.proxies(bob.address)
        await erc721.connect(bob).approve(proxy, 1)

        await marketplace.connect(alice).atomicMatch_(orderBuy, {v: sigBuy.v, r: sigBuy.r, s: sigBuy.s}, orderSell, {v: sigSell.v, r: sigSell.r, s: sigSell.s}, "0x0000000000000000000000000000000000000000000000000000000000000000", [], [], { value: ethers.utils.parseEther("12")})

        expect(await erc721.balanceOf(alice.address)).to.be.eq("2")
    });
});