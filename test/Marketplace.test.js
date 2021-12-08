import {ethers, network} from "hardhat";
import {expect} from "chai";
import {BigNumber} from "ethers";

import * as utils from "./utils.js"

// Note ethers 5.5.0 might not work with signMessage. So downgrade to 5.4.0.

describe("SuperFarm Marketplace", function(){
    let owner, protocolFeeRecipient, creator, alice, bob, royaltyOwner1, royaltyOwner2;
    let marketplace, registry, transferProxy, erc1155, erc721, weth;

    beforeEach(async function () {
        [owner, protocolFeeRecipient, creator, alice, bob, royaltyOwner1, royaltyOwner2] = await ethers.getSigners();
        [marketplace, registry, transferProxy, erc1155, erc721, weth] =  await utils.withContracts(network.config.chainId, protocolFeeRecipient.address, 100);
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

    // it("Deploy and mint", async function(){
    //     expect(await weth.balanceOf(bob.address)).to.be.eq(utils.mint.weth.bob)
    //     expect(await weth.balanceOf(alice.address)).to.be.eq(utils.mint.weth.alice)
    //     expect(await erc721.balanceOf(bob.address)).to.be.eq("1")
    //     expect(await erc721.balanceOf(alice.address)).to.be.eq("1")
    //     expect((await erc1155.balanceOf(bob.address, 1)).toString()).to.be.eq(utils.mint.erc1155.bob.amount.toString())
    //     expect((await erc1155.balanceOf(alice.address, 2)).toString()).to.be.eq(utils.mint.erc1155.alice.amount.toString())
    // })

    // it("ProxyRegistry: Register new user proxies, and authorize marketplace", async function(){

    //     expect(await registry.proxies(alice.address)).to.not.be.eq(utils.NULL_ADDRESS)
    //     expect(await registry.proxies(bob.address)).to.not.be.eq(utils.NULL_ADDRESS)
    // })

    // it("Marketplace: erc721 for erc20", async function(){
    //     let salt = 1;
    //     let abi = ["function transferFrom(address from,address to,uint256 tokenId)"]
    //     let iface = new ethers.utils.Interface(abi)
    //     let dataSell = iface.encodeFunctionData("transferFrom", [bob.address, utils.NULL_ADDRESS, 1]);
    //     let time = await utils.getCurrentTime()
    //     let orderSell = utils.makeOrder(
    //         ethers.utils.parseEther("1"),
    //         [],
    //         time, 
    //         time + 100, 
    //         salt, 
    //         [100, 200, 300, 400], // 100 = 1% in basis points
    //         [protocolFeeRecipient.address, creator.address, royaltyOwner1.address, royaltyOwner2.address],
    //         marketplace.address, 
    //         bob.address, // Seller
    //         1, 
    //         utils.NULL_ADDRESS, 
    //         0, 
    //         0,
    //         erc721.address, 
    //         utils.NULL_ADDRESS, 
    //         weth.address, 
    //         dataSell, 
    //         utils.replacementPatternSell, 
    //         0x0 
    //     )
    //     salt++
    //     let dataBuy = iface.encodeFunctionData("transferFrom", [utils.NULL_ADDRESS, alice.address, 1]);
    //     let orderBuy = utils.makeOrder(
    //         ethers.utils.parseEther("1.5"),
    //         [],
    //         await utils.getCurrentTime(), 
    //         await utils.getCurrentTime() + 100, 
    //         salt, 
    //         [], 
    //         [], 
    //         marketplace.address, 
    //         alice.address, // Buyer
    //         0, 
    //         utils.NULL_ADDRESS, 
    //         0, 
    //         0,
    //         erc721.address, 
    //         utils.NULL_ADDRESS, 
    //         weth.address, 
    //         dataBuy, 
    //         utils.replacementPatternBuy, 
    //         0x0 
    //     )
    //     // Create Orders Hashes
    //     let sellHash = await marketplace.hashOrder(orderSell)
    //     let buyHash = await marketplace.hashOrder(orderBuy)

    //     // Sign transactions
    //     let signatureSell = await bob.signMessage(ethers.utils.arrayify(sellHash));
    //     let signatureBuy = await alice.signMessage(ethers.utils.arrayify(buyHash));

    //     // Get V, R, S
    //     let sigSell = ethers.utils.splitSignature(signatureSell);
    //     let sigBuy = ethers.utils.splitSignature(signatureBuy);

    //     // Approve corresponding proxy
    //     let proxy = await registry.proxies(bob.address)
    //     await erc721.connect(bob).approve(proxy, 1)
    //     await weth.connect(alice).approve(transferProxy.address, ethers.utils.parseEther("1"))

    //     // BOOM ! Atomic Match
    //     await marketplace.connect(alice).atomicMatch_(orderBuy, {v: sigBuy.v, r: sigBuy.r, s: sigBuy.s}, orderSell, {v: sigSell.v, r: sigSell.r, s: sigSell.s}, "0x0000000000000000000000000000000000000000000000000000000000000000", [], [])
        
    //     // Confirm NFT transfers
    //     expect(await erc721.balanceOf(alice.address)).to.be.eq("2")
    //     expect(await erc721.balanceOf(bob.address)).to.be.eq("0")
        
    //     // Confirm Price Token Transfer
    //     expect(await weth.balanceOf(bob.address)).to.be.eq(ethers.utils.parseEther("100.999999999999999"))
    //     expect(await weth.balanceOf(alice.address)).to.be.eq(ethers.utils.parseEther("9"))

    //     // Confirm fee tranfers
    //     expect(await weth.balanceOf(protocolFeeRecipient.address)).to.be.eq("100")
    //     expect(await weth.balanceOf(creator.address)).to.be.eq("200")
    //     expect(await weth.balanceOf(royaltyOwner1.address)).to.be.eq("300")
    //     expect(await weth.balanceOf(royaltyOwner2.address)).to.be.eq("400")
    // })

    // it("MarketPlace listing with decreasing price", async function() {
    //     let salt = 1;
    //     let abi = ["function transferFrom(address from,address to,uint256 tokenId)"]
    //     let iface = new ethers.utils.Interface(abi)
    //     let dataSell = iface.encodeFunctionData("transferFrom", [bob.address, utils.NULL_ADDRESS, 1]);
    //     let time = await utils.getCurrentTime()
    //     let orderSell = utils.makeOrder(
    //         ethers.utils.parseEther("1.5"),
    //         [ethers.utils.parseEther("0.5"), ethers.BigNumber.from(time+500)],
    //         time, 
    //         time + 1000, 
    //         salt, 
    //         // Different combination of fees and addresses were checked!
    //         [100, 200, 300, 400], // 100 = 1% in basis points
    //         [protocolFeeRecipient.address, creator.address, royaltyOwner2.address, royaltyOwner1.address], 
    //         marketplace.address, 
    //         bob.address, // Seller
    //         1, 
    //         utils.NULL_ADDRESS, 
    //         1, // DecreasingPrice
    //         0,
    //         erc721.address, 
    //         utils.NULL_ADDRESS, 
    //         weth.address, 
    //         dataSell, 
    //         utils.replacementPatternSell, 
    //         0x0 
    //     )
    //     salt++
    //     let dataBuy = iface.encodeFunctionData("transferFrom", [utils.NULL_ADDRESS, alice.address, 1]);
    //     let orderBuy = utils.makeOrder(
    //         ethers.utils.parseEther("1.5"),
    //         [ethers.utils.parseEther("0.5"), ethers.BigNumber.from(time+500)],
    //         time, 
    //         time + 1000, 
    //         salt, 
    //         [], 
    //         [], 
    //         marketplace.address, 
    //         alice.address, // Buyer
    //         0, 
    //         utils.NULL_ADDRESS, 
    //         1, 
    //         0,
    //         erc721.address, 
    //         utils.NULL_ADDRESS, 
    //         weth.address, 
    //         dataBuy, 
    //         utils.replacementPatternBuy, 
    //         0x0 
    //     )

    //     // Create Orders Hashes
    //     let sellHash = await marketplace.hashOrder(orderSell)
    //     let buyHash = await marketplace.hashOrder(orderBuy)
        
    //     // Sign Transactions
    //     let signatureSell = await bob.signMessage(ethers.utils.arrayify(sellHash));
    //     let signatureBuy = await alice.signMessage(ethers.utils.arrayify(buyHash));
        
    //     // Get V, R, S
    //     let sigSell = ethers.utils.splitSignature(signatureSell);
    //     let sigBuy = ethers.utils.splitSignature(signatureBuy);
        
    //     // Approve corresponding proxy
    //     let proxy = await registry.proxies(bob.address)
    //     await erc721.connect(bob).approve(proxy, 1)
    //     await weth.connect(alice).approve(transferProxy.address, ethers.utils.parseEther("2"))
    //     await utils.evm_increaseTime(250);
    //     let price = await marketplace.connect(alice).calculateFinalPrice(1, ethers.utils.parseEther("1.5"), [ethers.utils.parseEther("0.5"), ethers.BigNumber.from(time+500)], time);
    //     expect(price).to.be.eq(ethers.utils.parseEther("1"))
    //     await utils.evm_increaseTime(250);
    //     price = await marketplace.connect(alice).calculateFinalPrice(1, ethers.utils.parseEther("1.5"), [ethers.utils.parseEther("0.5"), ethers.BigNumber.from(time+500)], time);
    //     expect(price).to.be.eq(ethers.utils.parseEther("0.5"))

    //     // BOOM ! Atomic Match
    //     await marketplace.connect(alice).atomicMatch_(orderBuy, {v: sigBuy.v, r: sigBuy.r, s: sigBuy.s}, orderSell, {v: sigSell.v, r: sigSell.r, s: sigSell.s}, "0x0000000000000000000000000000000000000000000000000000000000000000", [], [])

    //     // Confirm NFT transfers
    //     expect(await erc721.balanceOf(alice.address)).to.be.eq("2")
    //     expect(await erc721.balanceOf(bob.address)).to.be.eq("0")
        
    //     // Confirm Price Token Transfer
    //     expect(await weth.balanceOf(bob.address)).to.be.eq(ethers.utils.parseEther("100.499999999999999"))
    //     expect(await weth.balanceOf(alice.address)).to.be.eq(ethers.utils.parseEther("9.5"))

    //     // Confirm fee tranfers
    //     expect(await weth.balanceOf(protocolFeeRecipient.address)).to.be.above(ethers.utils.parseEther("0"))
    //     expect(await weth.balanceOf(creator.address)).to.be.above(ethers.utils.parseEther("0"))
    //     expect(await weth.balanceOf(royaltyOwner1.address)).to.be.above(ethers.utils.parseEther("0"))
    //     expect(await weth.balanceOf(royaltyOwner2.address)).to.be.above(ethers.utils.parseEther("0"))
    // });
    
    // it("Buy erc721 for ether", async function() {
    //     let salt = 1;
    //     let abi = ["function transferFrom(address from,address to,uint256 tokenId)"]
    //     let iface = new ethers.utils.Interface(abi)
    //     let dataSell = iface.encodeFunctionData("transferFrom", [bob.address, utils.NULL_ADDRESS, 1]);
    //     let time = await utils.getCurrentTime()
    //     let orderSell = utils.makeOrder(
    //         ethers.utils.parseEther("12"),
    //         [],
    //         time, 
    //         time + 1000, 
    //         salt, 
    //         [100, 200, 300, 400], // 100 = 1% in basis points
    //         [protocolFeeRecipient.address, creator.address, royaltyOwner2.address, royaltyOwner1.address],
    //         marketplace.address, 
    //         bob.address, // Seller
    //         1, 
    //         utils.NULL_ADDRESS, 
    //         0,
    //         0,
    //         erc721.address, 
    //         utils.NULL_ADDRESS, 
    //         utils.NULL_ADDRESS, 
    //         dataSell, 
    //         utils.replacementPatternSell, 
    //         0x0 
    //     )
    //     salt++
    //     let dataBuy = iface.encodeFunctionData("transferFrom", [utils.NULL_ADDRESS, alice.address, 1]);
    //     let orderBuy = utils.makeOrder(
    //         ethers.utils.parseEther("12"),
    //         [],
    //         time, 
    //         time + 1000, 
    //         salt, 
    //         [], 
    //         [], 
    //         marketplace.address, 
    //         alice.address, // Buyer
    //         0, 
    //         utils.NULL_ADDRESS, 
    //         0, 
    //         0,
    //         erc721.address, 
    //         utils.NULL_ADDRESS, 
    //         utils.NULL_ADDRESS, 
    //         dataBuy, 
    //         utils.replacementPatternBuy, 
    //         0x0 
    //     )

    //     // Create Orders Hashes
    //     let sellHash = await marketplace.hashOrder(orderSell)
    //     let buyHash = await marketplace.hashOrder(orderBuy)

    //     // Sign Transactions
    //     let signatureSell = await bob.signMessage(ethers.utils.arrayify(sellHash));
    //     let signatureBuy = await alice.signMessage(ethers.utils.arrayify(buyHash));

    //     // Get V, R, S
    //     let sigSell = ethers.utils.splitSignature(signatureSell);
    //     let sigBuy = ethers.utils.splitSignature(signatureBuy);

    //     // Approve corresponding proxy
    //     let proxy = await registry.proxies(bob.address)
    //     await erc721.connect(bob).approve(proxy, 1)
    //     let oldBobBalance = await bob.getBalance();
    //     let oldAliceBalance = await alice.getBalance();

    //     // BOOM ! Atomic Match
    //     await marketplace.connect(alice).atomicMatch_(orderBuy, {v: sigBuy.v, r: sigBuy.r, s: sigBuy.s}, orderSell, {v: sigSell.v, r: sigSell.r, s: sigSell.s}, "0x0000000000000000000000000000000000000000000000000000000000000000", [], [], { value: ethers.utils.parseEther("15")})
        
    //     // Confirm Ether Transfer
    //     expect(await bob.getBalance()).to.be.above(ethers.utils.parseEther("10005")); // Must be around 10011
    //     expect(await alice.getBalance()).to.be.below(ethers.utils.parseEther("9990")); // Must be around 988

    //     // Confirm NFT transfers
    //     expect(await erc721.balanceOf(alice.address)).to.be.eq("2")
    //     expect(await erc721.balanceOf(bob.address)).to.be.eq("0")
    // });

    // it("Erc721 auction via ether", async function() {
    //     let salt = 1;
    //     let abi = ["function transferFrom(address from,address to,uint256 tokenId)"]
    //     let iface = new ethers.utils.Interface(abi)
    //     let dataSell = iface.encodeFunctionData("transferFrom", [bob.address, utils.NULL_ADDRESS, 1]);
    //     let time = await utils.getCurrentTime()
    //     let orderSell = utils.makeOrder(
    //         ethers.utils.parseEther("12"),
    //         [],
    //         time, 
    //         time + 1000, 
    //         salt, 
    //         [100, 200, 300, 400], // 100 = 1% in basis points
    //         [protocolFeeRecipient.address, creator.address, royaltyOwner2.address, royaltyOwner1.address],
    //         marketplace.address, 
    //         bob.address, // Seller
    //         1, 
    //         utils.NULL_ADDRESS, 
    //         2,
    //         0,
    //         erc721.address, 
    //         utils.NULL_ADDRESS, 
    //         utils.NULL_ADDRESS, 
    //         dataSell, 
    //         utils.replacementPatternSell, 
    //         0x0 
    //     )
    //     salt++
    //     let dataBuy = iface.encodeFunctionData("transferFrom", [utils.NULL_ADDRESS, alice.address, 1]);
    //     let orderBuy = utils.makeOrder(
    //         ethers.utils.parseEther("12"),
    //         [],
    //         time, 
    //         time + 1000, 
    //         salt, 
    //         [], 
    //         [], 
    //         marketplace.address, 
    //         alice.address, // Buyer
    //         0, 
    //         utils.NULL_ADDRESS, 
    //         2, 
    //         0,
    //         erc721.address, 
    //         utils.NULL_ADDRESS, 
    //         utils.NULL_ADDRESS, 
    //         dataBuy, 
    //         utils.replacementPatternBuy, 
    //         0x0 
    //     )

    //     // Create Orders Hashes
    //     let sellHash = await marketplace.hashOrder(orderSell)
    //     let buyHash = await marketplace.hashOrder(orderBuy)

    //     // Sign Transactions
    //     let signatureSell = await bob.signMessage(ethers.utils.arrayify(sellHash));
    //     let signatureBuy = await alice.signMessage(ethers.utils.arrayify(buyHash));

    //     // Get V, R, S
    //     let sigSell = ethers.utils.splitSignature(signatureSell);
    //     let sigBuy = ethers.utils.splitSignature(signatureBuy);

    //     // Approve corresponding proxy
    //     let proxy = await registry.proxies(bob.address)
    //     await erc721.connect(bob).approve(proxy, 1)

    //     // BOOM ! Atomic Match
    //     await marketplace.connect(alice).atomicMatch_(orderBuy, {v: sigBuy.v, r: sigBuy.r, s: sigBuy.s}, orderSell, {v: sigSell.v, r: sigSell.r, s: sigSell.s}, "0x0000000000000000000000000000000000000000000000000000000000000000", [], [], { value: ethers.utils.parseEther("12")})

    //     // Confirm Ether Transfer
    //     expect(await bob.getBalance()).to.be.above(ethers.utils.parseEther("10005")); // Must be around 10011
    //     expect(await alice.getBalance()).to.be.below(ethers.utils.parseEther("9990")); // Must be around 988

    //     // Confirm NFT transfers
    //     expect(await erc721.balanceOf(alice.address)).to.be.eq("2")
    //     expect(await erc721.balanceOf(bob.address)).to.be.eq("0")
    // });

    // it("Marketplace offer listing", async function() {
    //     let salt = 1;
    //     let abi = ["function transferFrom(address from,address to,uint256 tokenId)"]
    //     let iface = new ethers.utils.Interface(abi)
    //     let dataSell = iface.encodeFunctionData("transferFrom", [bob.address, utils.NULL_ADDRESS, 1]);
    //     let time = await utils.getCurrentTime()
    //     let orderSell = utils.makeOrder(
    //         0, // Not needed since buyer is offering
    //         [],
    //         time, 
    //         time + 1000, 
    //         salt, 
    //         [100, 200, 300, 400], // 100 = 1% in basis points
    //         [protocolFeeRecipient.address, creator.address, royaltyOwner2.address, royaltyOwner1.address],
    //         marketplace.address, 
    //         bob.address, // Seller
    //         1, 
    //         utils.NULL_ADDRESS, 
    //         3,
    //         0,
    //         erc721.address, 
    //         utils.NULL_ADDRESS, 
    //         utils.NULL_ADDRESS, 
    //         dataSell, 
    //         utils.replacementPatternSell, 
    //         0x0 
    //     )
    //     salt++
    //     let dataBuy = iface.encodeFunctionData("transferFrom", [utils.NULL_ADDRESS, alice.address, 1]);
    //     let orderBuy = utils.makeOrder(
    //         ethers.utils.parseEther("200"),
    //         [],
    //         time, 
    //         time + 1000, 
    //         salt, 
    //         [], 
    //         [], 
    //         marketplace.address, 
    //         alice.address, // Buyer
    //         0, 
    //         utils.NULL_ADDRESS, 
    //         3, 
    //         0,
    //         erc721.address, 
    //         utils.NULL_ADDRESS, 
    //         utils.NULL_ADDRESS, 
    //         dataBuy, 
    //         utils.replacementPatternBuy, 
    //         0x0 
    //     )

    //     // Create Orders Hashes
    //     let sellHash = await marketplace.hashOrder(orderSell)
    //     let buyHash = await marketplace.hashOrder(orderBuy)

    //     // Sign Transactions
    //     let signatureSell = await bob.signMessage(ethers.utils.arrayify(sellHash));
    //     let signatureBuy = await alice.signMessage(ethers.utils.arrayify(buyHash));

    //     // Get V, R, S
    //     let sigSell = ethers.utils.splitSignature(signatureSell);
    //     let sigBuy = ethers.utils.splitSignature(signatureBuy);

    //     // Approve corresponding proxy
    //     let proxy = await registry.proxies(bob.address)
    //     await erc721.connect(bob).approve(proxy, 1)

    //     // BOOM ! Atomic Match
    //     await marketplace.connect(alice).atomicMatch_(orderBuy, {v: sigBuy.v, r: sigBuy.r, s: sigBuy.s}, orderSell, {v: sigSell.v, r: sigSell.r, s: sigSell.s}, "0x0000000000000000000000000000000000000000000000000000000000000000", [], [], { value: ethers.utils.parseEther("800")})

    //     // Confirm Ether Transfer
    //     expect(await bob.getBalance()).to.be.above(ethers.utils.parseEther("10150")); // Must be around 10200
    //     expect(await alice.getBalance()).to.be.below(ethers.utils.parseEther("9800")); // Must be around 9775

    //     // Confirm NFT transfers
    //     expect(await erc721.balanceOf(alice.address)).to.be.eq("2")
    //     expect(await erc721.balanceOf(bob.address)).to.be.eq("0")
    // });
    it("EIP712 test", async function() {
        // let owner = await ethers.getSigners()


        let salt = 1;
        let abi = ["function transferFrom(address from,address to,uint256 tokenId)"]
        let iface = new ethers.utils.Interface(abi)
        let dataSell = iface.encodeFunctionData("transferFrom", [bob.address, utils.NULL_ADDRESS, 1]);
        let time = await utils.getCurrentTime()

    const order = utils.makeOrder(
        0, // Not needed since buyer is offering
        [],
        time, 
        time + 1000, 
        salt, 
        [100, 200, 300, 400], // 100 = 1% in basis points
        [protocolFeeRecipient.address, creator.address, royaltyOwner2.address, royaltyOwner1.address],
        marketplace.address, 
        bob.address, // Seller
        1, 
        utils.NULL_ADDRESS, 
        3,
        0,
        erc721.address, 
        utils.NULL_ADDRESS, 
        utils.NULL_ADDRESS, 
        dataSell, 
        utils.replacementPatternSell, 
        0x0 
    )
    let domain = {
        name: "Super Marketplace",
        version: "1",
        chainId: network.config.chainId,
        verifyingContract: marketplace.address
    }

    let signature = await owner._signTypedData(domain, utils.OrderTypes, order);
    let test = ethers.utils.splitSignature(signature);
    await marketplace.recover(order, {v: test.v, s: test.s, r: test.r});
    console.log(owner.address);
    
    });

});