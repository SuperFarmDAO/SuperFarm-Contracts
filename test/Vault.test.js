'use strict';

// Imports.
import { ethers } from 'hardhat';
import 'chai/register-should';
import { expect } from 'chai';

// Test the TokenVault with Timelock and MultiSigWallet functionality.
describe('TokenVault', function () {
    let itemGroupId = ethers.BigNumber.from(1);
    let shiftedItemGroupId = itemGroupId.shl(128);
	let owner, user_one, panic_destination;
	let Token, token, Vault, vault, ERC721, erc721, ERC1155, erc1155;
	before(async () => {
        [owner, user_one, panic_destination] = await ethers.getSigners();
		Token = await ethers.getContractFactory("Token");
        Vault = await ethers.getContractFactory("Vault");

        token = await Token.deploy(owner.address,'Token', 'TOK', ethers.utils.parseEther('1000000000'), true);
        vault = await Vault.deploy(owner.address, "Vault", owner.address, 3);
	});

    

    it("Shoud deploy correctly", async() => {
        let panicDest = await vault.panicDestination();
        let panicLimit = await vault.panicLimit();
        let ownerOfContract = await vault.owner();
        let version = await vault.version();

        expect(panicDest).to.be.eq(owner.address);
        expect(panicLimit).to.be.eq(3);
        expect(ownerOfContract).to.be.eq(owner.address);
        expect(version).to.be.eq(1);
    });

	it("Shoud revert: update panicDestination", async() => {
        await expect(vault.connect(user_one).setPanicDestination(owner.address)).to.be.revertedWith("PermitControl: sender does not have a valid permit");
    });

    it("Shoud update panicDestination address", async() => {
        await vault.connect(owner).setPanicDestination(panic_destination.address);
        let panicDest = await vault.panicDestination();

        expect(panicDest).to.be.eq(panic_destination.address);
    });

    it("Shoud revert: lock", async() => {
        await expect(vault.connect(user_one).lock()).to.be.revertedWith("PermitControl: sender does not have a valid permit");
    });

    it("Shoud lock panicDestinationAddress", async() => {
        await vault.connect(owner).lock();
        let canAlterPanic = await vault.canAlterPanicDestination();
        expect(canAlterPanic).to.be.eq(false);

    });


    let snapshotId;
	describe('sendAssets and panic', async () => {
        before("Shoud deploy everything necessary", async() => {
            ERC721 = await ethers.getContractFactory("Super721");
            ERC1155 = await ethers.getContractFactory("Super1155");

            erc721 = await ERC721.deploy(owner.address, "TEST", "TST", "URI", ethers.constants.AddressZero);
            erc1155 = await ERC1155.deploy(owner.address, "TEST", "uri", ethers.constants.AddressZero);
           

            await token.mint(owner.address, ethers.utils.parseEther("1000000"));

            await erc721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                burnType: 1,
                burnData: 20000
            });

            await erc1155.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });

            await erc721.connect(owner).mintBatch(
                vault.address,
                [shiftedItemGroupId],
                [1],
                "0x00"
            );

            await erc1155.connect(owner).mintBatch(
                vault.address,
                [shiftedItemGroupId],
                [1],
                "0x00"
            );
            console.log(ethers.constants.AddressZero);
            // await owner.call({
            //     to: vault.address,
            //     value: ethers.utils.parseEther("1.0"),
            //   });
            await token.connect(owner).transfer(vault.address, ethers.utils.parseEther("1000"));
        });

        beforeEach(async () => {
            snapshotId = await network.provider.send("evm_snapshot");
        });
    
        afterEach(async function() {
            await network.provider.send("evm_revert", [snapshotId]);
        });

        it("Shoud revert", async() => {
            let AssetTransferInput = {
                recipient: owner.address,
                asset: token.address,
                id: 0,
                amount: ethers.utils.parseEther("100"),
                assetType: 1
            }
            await expect(vault.connect(user_one).sendAssets([AssetTransferInput])).to.be.revertedWith("PermitControl: sender does not have a valid permit");
        })

        it("Shoud revert on transfer", async() => {
            let AssetTransferInput = {
                recipient: owner.address,
                asset: ethers.constants.AddressZero,
                id: shiftedItemGroupId,
                amount: ethers.utils.parseEther("0.5"),
                assetType: 0
            };

            await expect(vault.connect(owner).sendAssets([AssetTransferInput])).to.be.revertedWith("Vault::sendAssets::Ether transfer failed");
        });

        it("Shoud transfer diffent assets", async() => {
            let AssetTransferInput1 = {
                recipient: owner.address,
                asset: token.address,
                id: 0,
                amount: ethers.utils.parseEther("100"),
                assetType: 1
            }; 
            let AssetTransferInput2 = {
                recipient: owner.address,
                asset: erc721.address,
                id: shiftedItemGroupId,
                amount: 1,
                assetType: 2
            };
            let AssetTransferInput3 = {
                recipient: owner.address,
                asset: erc1155.address,
                id: shiftedItemGroupId,
                amount: 1,
                assetType: 3
            };
            
            await vault.connect(owner).sendAssets([AssetTransferInput1,AssetTransferInput2,AssetTransferInput3]);
        });

        it("Panic: shoud revert", async() => {

            let panicInput = {
                asset: token.address,
                id: 0,
                amount: ethers.utils.parseEther("100"),
                assetType: 1
            }
            await expect(vault.connect(user_one).panic([panicInput])).to.be.revertedWith("PermitControl: sender does not have a valid permit");
        })

        it("Panic: shoud transfer assets to panicDestination", async() => {

            let panicInput = {
                asset: token.address,
                id: 0,
                amount: ethers.utils.parseEther("100"),
                assetType: 1
            }
            await vault.connect(owner).panic([panicInput]);
            let panicBalance = await token.balanceOf(panic_destination.address);
            let panicCounter = await vault.panicCounter();
            expect(panicBalance.toString()).to.be.eq(ethers.utils.parseEther("100"));
            expect(panicCounter).to.be.eq(1);

        })
        it("Panic: shoud transfer assets to panicDestination", async() => {

            let panicInput = {
                asset: token.address,
                id: 0,
                amount: ethers.utils.parseEther("100"),
                assetType: 1
            }
            await vault.connect(owner).panic([panicInput]);
            let panicBalance = await token.balanceOf(panic_destination.address);
            let panicCounter = await vault.panicCounter();
            expect(panicBalance.toString()).to.be.eq(ethers.utils.parseEther("100"));
            expect(panicCounter).to.be.eq(1);

        })

        it("Panic: shoud hit panic limit", async() => {

            let panicInput = {
                asset: token.address,
                id: 0,
                amount: ethers.utils.parseEther("100"),
                assetType: 1
            }
            
            

            await vault.connect(owner).panic([panicInput]);
            let panicCounter = await vault.panicCounter();

            expect(panicCounter).to.be.eq(1);

            await vault.connect(owner).panic([panicInput]);
            panicCounter = await vault.panicCounter();
            expect(panicCounter).to.be.eq(2);

            await vault.connect(owner).panic([panicInput]);
            panicCounter = await vault.panicCounter();
            expect(panicCounter).to.be.eq(3);

            let panicBalance = await token.balanceOf(panic_destination.address);
            expect(panicBalance.toString()).to.be.eq(ethers.utils.parseEther("300"));


            await vault.connect(owner).panic([panicInput]);
            panicCounter = await vault.panicCounter();
            panicBalance = await token.balanceOf(panic_destination.address);
            expect(panicBalance.toString()).to.be.eq(ethers.utils.parseEther("300"));


            let DEADBEEF = await vault.DEADBEEF();
            panicBalance = await token.balanceOf(DEADBEEF);
            expect(panicBalance.toString()).to.be.eq(ethers.utils.parseEther("100"));
            


        })
	});


});
