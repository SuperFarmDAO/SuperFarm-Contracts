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
            ethers.utils.parseEther("1"),
            0,
            time, 
            time + 100, 
            salt, 
            [100, 200, 300, 400, 500], // 100 = 1% in basis points
            [[protocolFeeRecipient.address], [creator.address], [royaltyOwner1.address], [royaltyOwner2.address], []],
            marketplace.address, 
            bob.address, // Seller
            1, 
            utils.NULL_ADDRESS, 
            0, 
            0,
            erc721.address, 
            utils.NULL_ADDRESS, 
            weth.address, 
            dataSell, 
            utils.replacementPatternSell, 
            0x0 
        )
        salt++
        let dataBuy = iface.encodeFunctionData("transferFrom", [utils.NULL_ADDRESS, alice.address, 1]);
        let orderBuy = utils.makeOrder(
            ethers.utils.parseEther("1.5"),
            0,
            await utils.getCurrentTime(), 
            await utils.getCurrentTime() + 100, 
            salt, 
            [], 
            [[]], 
            marketplace.address, 
            alice.address, // Buyer
            0, 
            utils.NULL_ADDRESS, 
            0, 
            0,
            erc721.address, 
            utils.NULL_ADDRESS, 
            weth.address, 
            dataBuy, 
            utils.replacementPatternBuy, 
            0x0 
        )
        // Create Orders Hashes
        let sellHash = await marketplace.hashOrder(orderSell)
        let buyHash = await marketplace.hashOrder(orderBuy)

        // Sign transactions
        let signatureSell = await bob.signMessage(ethers.utils.arrayify(sellHash));
        let signatureBuy = await alice.signMessage(ethers.utils.arrayify(buyHash));

        // Get V, R, S
        let sigSell = ethers.utils.splitSignature(signatureSell);
        let sigBuy = ethers.utils.splitSignature(signatureBuy);

        // Approve corresponding proxy
        let proxy = await registry.proxies(bob.address)
        await erc721.connect(bob).approve(proxy, 1)
        await weth.connect(alice).approve(transferProxy.address, ethers.utils.parseEther("1"))
        await marketplace.connect(alice).atomicMatch_(orderBuy, {v: sigBuy.v, r: sigBuy.r, s: sigBuy.s}, orderSell, {v: sigSell.v, r: sigSell.r, s: sigSell.s}, "0x0000000000000000000000000000000000000000000000000000000000000000", [], [])
        
        // Confirm NFT transfers
        expect(await erc721.balanceOf(alice.address)).to.be.eq("2")
        expect(await erc721.balanceOf(bob.address)).to.be.eq("0")
        
        // Confirm Price Token Transfer
        expect(await weth.balanceOf(bob.address)).to.be.eq(ethers.utils.parseEther("100.9"))
        expect(await weth.balanceOf(alice.address)).to.be.eq(ethers.utils.parseEther("9"))

        // Confirm fee tranfers
        expect(await weth.balanceOf(protocolFeeRecipient.address)).to.be.eq(ethers.utils.parseEther("0.01"))
        expect(await weth.balanceOf(creator.address)).to.be.eq(ethers.utils.parseEther("0.02"))
        expect(await weth.balanceOf(royaltyOwner1.address)).to.be.eq(ethers.utils.parseEther("0.03"))
        expect(await weth.balanceOf(royaltyOwner2.address)).to.be.eq(ethers.utils.parseEther("0.04"))
    })

    it("MarketPlace listing with decreasing price", async function() {
        let salt = 1;
        let abi = ["function transferFrom(address from,address to,uint256 tokenId)"]
        let iface = new ethers.utils.Interface(abi)
        let dataSell = iface.encodeFunctionData("transferFrom", [bob.address, utils.NULL_ADDRESS, 1]);
        let time = await utils.getCurrentTime()
        let orderSell = utils.makeOrder(
            ethers.utils.parseEther("1"),
            ethers.utils.parseEther("0.5"),
            time, 
            time + 1000, 
            salt, 
            [100, 200, 300, 400], // 100 = 1% in basis points
            [[protocolFeeRecipient.address, royaltyOwner1.address], [creator.address], [royaltyOwner1.address], [royaltyOwner1.address, royaltyOwner2.address]], 
            marketplace.address, 
            bob.address, // Seller
            1, 
            utils.NULL_ADDRESS, 
            1, // DecreasingPrice
            0,
            erc721.address, 
            utils.NULL_ADDRESS, 
            weth.address, 
            dataSell, 
            utils.replacementPatternSell, 
            0x0 
        )
        salt++
        let dataBuy = iface.encodeFunctionData("transferFrom", [utils.NULL_ADDRESS, alice.address, 1]);
        let orderBuy = utils.makeOrder(
            ethers.utils.parseEther("1.5"),
            0,
            await utils.getCurrentTime(), 
            await utils.getCurrentTime() + 100, 
            salt, 
            [], 
            [[]], 
            marketplace.address, 
            alice.address, // Buyer
            0, 
            utils.NULL_ADDRESS, 
            1, 
            0,
            erc721.address, 
            utils.NULL_ADDRESS, 
            weth.address, 
            dataBuy, 
            utils.replacementPatternBuy, 
            0x0 
        )

        // Create Orders Hashes
        let sellHash = await marketplace.hashOrder(orderSell)
        let buyHash = await marketplace.hashOrder(orderBuy)

        // Sign Transactions
        let signatureSell = await bob.signMessage(ethers.utils.arrayify(sellHash));
        let signatureBuy = await alice.signMessage(ethers.utils.arrayify(buyHash));

        // Get V, R, S
        let sigSell = ethers.utils.splitSignature(signatureSell);
        let sigBuy = ethers.utils.splitSignature(signatureBuy);

        // Approve corresponding proxy
        let proxy = await registry.proxies(bob.address)
        await erc721.connect(bob).approve(proxy, 1)
        await weth.connect(alice).approve(transferProxy.address, ethers.utils.parseEther("2"))
        await utils.evm_increaseTime(500);
        let time2 = await utils.getCurrentTime()
        console.log(time)
        console.log(time2)
        console.log(time2 - time);
        let price = await marketplace.connect(alice).calculateFinalPrice(1, 1, ethers.utils.parseEther("1"),  ethers.utils.parseEther("0.2"), time, (time2+500));
        console.log("Decreased price: ", price.toString());

        // const currentBlock = await ethers.provider.getBlockNumber();
		// const block = await ethers.provider.getBlock(currentBlock);
		// let currentTime = block.timestamp;
        // await network.provider.request({
        //     method: 'evm_setNextBlockTimestamp',
        //     params: [ currentTime + 60 ]
        // });
        // await  network.provider.send('evm_mine');
        // price = await marketplace.connect(alice).calculateFinalPrice(1, 1, ethers.utils.parseEther("1"), 0, time, (time+120));
        // console.log("Decreased2 price: ", price.toString());
        // await marketplace.connect(alice).atomicMatch_(orderBuy, {v: sigBuy.v, r: sigBuy.r, s: sigBuy.s}, orderSell, {v: sigSell.v, r: sigSell.r, s: sigSell.s}, "0x0000000000000000000000000000000000000000000000000000000000000000", [], [])
        // let aliceBalance = await weth.balanceOf(alice.address);
        // console.log("Alice's balance: ", aliceBalance.toString());
    });

//     it("Buy erc721 for ether", async function() {

//         let salt = 1;
//         let abi = ["function transferFrom(address from,address to,uint256 tokenId)"]
//         let iface = new ethers.utils.Interface(abi)
//         let dataSell = iface.encodeFunctionData("transferFrom", [bob.address, utils.NULL_ADDRESS, 1]);
//         let time = await utils.getCurrentTime()
//         let orderSell = utils.makeOrder(
//             ethers.utils.parseEther("12"),
//             utils.NULL_ADDRESS,
//             time,
//             salt, 
//             protocolFeeRecipient.address,
//             creator.address,
//             marketplace.address,
//             bob.address,
//             utils.NULL_ADDRESS,
//             erc721.address,
//             dataSell,
//             utils.replacementPatternSell,
//             1,
//             0
//         )
//         salt++
//         let dataBuy = iface.encodeFunctionData("transferFrom", [utils.NULL_ADDRESS, alice.address, 1]);
//         let orderBuy = utils.makeOrder(
//             ethers.utils.parseEther("12"),
//             utils.NULL_ADDRESS,
//             time,
//             salt,
//             utils.NULL_ADDRESS,
//             creator.address,
//             marketplace.address,
//             alice.address,
//             utils.NULL_ADDRESS,
//             erc721.address,
//             dataBuy,
//             utils.replacementPatternBuy,
//             0,
//             0
//         )
//         let sellHash = await marketplace.hashOrder(orderSell)
//         let buyHash = await marketplace.hashOrder(orderBuy)
//         let signatureSell = await bob.signMessage(ethers.utils.arrayify(sellHash));
//         let signatureBuy = await alice.signMessage(ethers.utils.arrayify(buyHash));
//         let sigSell = ethers.utils.splitSignature(signatureSell);
//         let sigBuy = ethers.utils.splitSignature(signatureBuy);
//         let proxy = await registry.proxies(bob.address)
//         await erc721.connect(bob).approve(proxy, 1)
//         let oldBobBalance = await bob.getBalance();
//         let oldAliceBalance = await alice.getBalance();

//         console.log("Bob old: ", oldBobBalance.toString());
//         console.log("Alice old: ", oldAliceBalance.toString());
//         await marketplace.connect(alice).atomicMatch_(orderBuy, {v: sigBuy.v, r: sigBuy.r, s: sigBuy.s}, orderSell, {v: sigSell.v, r: sigSell.r, s: sigSell.s}, "0x0000000000000000000000000000000000000000000000000000000000000000", [], [], { value: ethers.utils.parseEther("12")})


//         let bnBob = BigNumber.from(await bob.getBalance());
//         console.log(bnBob.toString());
//         let newBobBalance = await bob.getBalance();
//         let newAliceBalance = await alice.getBalance();

//         console.log("Bob new: ", newBobBalance.toString());
//         console.log("Alice new: ", newAliceBalance.toString());

//         let finalBob = BigNumber.from(oldBobBalance);
        
//         // ensure nft and tokens transfers
//         console.log("Bob", bnBob.sub(finalBob).toString())
//         console.log("Alice", newAliceBalance - oldAliceBalance)

//         expect(await erc721.balanceOf(alice.address)).to.be.eq("2")
//         expect(bnBob.sub(finalBob).toString()).to.be.equal(ethers.utils.parseEther("12"));
//     });
//     it("Erc721 auction", async function() {
//         let salt = 1;
//         let abi = ["function transferFrom(address from,address to,uint256 tokenId)"]
//         let iface = new ethers.utils.Interface(abi)
//         let dataSell = iface.encodeFunctionData("transferFrom", [bob.address, utils.NULL_ADDRESS, 1]);
//         let time = await utils.getCurrentTime()
//         let orderSell = utils.makeOrder(
//             ethers.utils.parseEther("0.1"),
//             utils.NULL_ADDRESS,
//             time,
//             salt, 
//             protocolFeeRecipient.address,
//             creator.address,
//             marketplace.address,
//             bob.address,
//             utils.NULL_ADDRESS,
//             erc721.address,
//             dataSell,
//             utils.replacementPatternSell,
//             1,
//             2
//         )
//         salt++
//         let dataBuy = iface.encodeFunctionData("transferFrom", [utils.NULL_ADDRESS, alice.address, 1]);
//         let orderBuy = utils.makeOrder(
//             ethers.utils.parseEther("0.12"),
//             utils.NULL_ADDRESS,
//             time,
//             salt,
//             utils.NULL_ADDRESS,
//             creator.address,
//             marketplace.address,
//             alice.address,
//             utils.NULL_ADDRESS,
//             erc721.address,
//             dataBuy,
//             utils.replacementPatternBuy,
//             0,
//             0
//         )
//         let sellHash = await marketplace.hashOrder(orderSell)
//         let buyHash = await marketplace.hashOrder(orderBuy)
//         let signatureSell = await bob.signMessage(ethers.utils.arrayify(sellHash));
//         let signatureBuy = await alice.signMessage(ethers.utils.arrayify(buyHash));
//         let sigSell = ethers.utils.splitSignature(signatureSell);
//         let sigBuy = ethers.utils.splitSignature(signatureBuy);
//         let proxy = await registry.proxies(bob.address)
//         await erc721.connect(bob).approve(proxy, 1)

//         await marketplace.connect(alice).atomicMatch_(orderBuy, {v: sigBuy.v, r: sigBuy.r, s: sigBuy.s}, orderSell, {v: sigSell.v, r: sigSell.r, s: sigSell.s}, "0x0000000000000000000000000000000000000000000000000000000000000000", [], [], { value: ethers.utils.parseEther("12")})

//         expect(await erc721.balanceOf(alice.address)).to.be.eq("2")
//     });

//     it("Marketplace offer listing", async function() {
//         let salt = 1;
//         let abi = ["function transferFrom(address from,address to,uint256 tokenId)"]
//         let iface = new ethers.utils.Interface(abi)
//         let dataSell = iface.encodeFunctionData("transferFrom", [bob.address, utils.NULL_ADDRESS, 1]);
//         let time = await utils.getCurrentTime()
//         let orderSell = utils.makeOrder(
//             ethers.utils.parseEther("0.1"),
//             utils.NULL_ADDRESS,
//             time,
//             salt, 
//             protocolFeeRecipient.address,
//             creator.address,
//             marketplace.address,
//             bob.address,
//             utils.NULL_ADDRESS,
//             erc721.address,
//             dataSell,
//             utils.replacementPatternSell,
//             1,
//             3
//         )
//         salt++
//         let dataBuy = iface.encodeFunctionData("transferFrom", [utils.NULL_ADDRESS, alice.address, 1]);
//         let orderBuy = utils.makeOrder(
//             ethers.utils.parseEther("0.12"),
//             utils.NULL_ADDRESS,
//             time,
//             salt,
//             utils.NULL_ADDRESS,
//             creator.address,
//             marketplace.address,
//             alice.address,
//             utils.NULL_ADDRESS,
//             erc721.address,
//             dataBuy,
//             utils.replacementPatternBuy,
//             0,
//             3
//         )
//         let sellHash = await marketplace.hashOrder(orderSell)
//         let buyHash = await marketplace.hashOrder(orderBuy)
//         let signatureSell = await bob.signMessage(ethers.utils.arrayify(sellHash));
//         let signatureBuy = await alice.signMessage(ethers.utils.arrayify(buyHash));
//         let sigSell = ethers.utils.splitSignature(signatureSell);
//         let sigBuy = ethers.utils.splitSignature(signatureBuy);
//         let proxy = await registry.proxies(bob.address)
//         await erc721.connect(bob).approve(proxy, 1)

//         await marketplace.connect(alice).atomicMatch_(orderBuy, {v: sigBuy.v, r: sigBuy.r, s: sigBuy.s}, orderSell, {v: sigSell.v, r: sigSell.r, s: sigSell.s}, "0x0000000000000000000000000000000000000000000000000000000000000000", [], [], { value: ethers.utils.parseEther("12")})

//         expect(await erc721.balanceOf(alice.address)).to.be.eq("2")
//     });

//     it("Marketplace offer listing", async function() {
//         let salt = 1;
//         let abi = ["function transferFrom(address from,address to,uint256 tokenId)"]
//         let iface = new ethers.utils.Interface(abi)
//         let dataSell = iface.encodeFunctionData("transferFrom", [bob.address, utils.NULL_ADDRESS, 1]);
//         let time = await utils.getCurrentTime()
//         let orderSell = utils.makeOrder(
//             ethers.utils.parseEther("0.1"),
//             utils.NULL_ADDRESS,
//             time,
//             salt, 
//             protocolFeeRecipient.address,
//             creator.address,
//             marketplace.address,
//             bob.address,
//             utils.NULL_ADDRESS,
//             erc721.address,
//             dataSell,
//             utils.replacementPatternSell,
//             1,
//             3
//         )
//         salt++
//         let dataBuy = iface.encodeFunctionData("transferFrom", [utils.NULL_ADDRESS, alice.address, 1]);
//         let orderBuy = utils.makeOrder(
//             ethers.utils.parseEther("0.12"),
//             utils.NULL_ADDRESS,
//             time,
//             salt,
//             utils.NULL_ADDRESS,
//             creator.address,
//             marketplace.address,
//             alice.address,
//             utils.NULL_ADDRESS,
//             erc721.address,
//             dataBuy,
//             utils.replacementPatternBuy,
//             0,
//             3
//         )
//         let sellHash = await marketplace.hashOrder(orderSell)
//         let buyHash = await marketplace.hashOrder(orderBuy)
//         let signatureSell = await bob.signMessage(ethers.utils.arrayify(sellHash));
//         let signatureBuy = await alice.signMessage(ethers.utils.arrayify(buyHash));
//         let sigSell = ethers.utils.splitSignature(signatureSell);
//         let sigBuy = ethers.utils.splitSignature(signatureBuy);
//         let proxy = await registry.proxies(bob.address)
//         await erc721.connect(bob).approve(proxy, 1)

//         await marketplace.connect(alice).atomicMatch_(orderBuy, {v: sigBuy.v, r: sigBuy.r, s: sigBuy.s}, orderSell, {v: sigSell.v, r: sigSell.r, s: sigSell.s}, "0x0000000000000000000000000000000000000000000000000000000000000000", [], [], { value: ethers.utils.parseEther("12")})

//         expect(await erc721.balanceOf(alice.address)).to.be.eq("2")
//     });
});