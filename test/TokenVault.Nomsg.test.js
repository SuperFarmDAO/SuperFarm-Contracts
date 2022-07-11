'use strict';

// Imports.
import { network, ethers, waffle } from 'hardhat';
import { expect } from 'chai';

import 'chai/register-should';
let currentTime, snapshotId;

const DATA = "0x02";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const AssetType = Object.freeze({
    None: 0,
    Eth: 1,
    ERC20: 2,
    ERC1155: 3,
    ERC721: 4
});

// ENUMS in Super721
const SupplyType721 = Object.freeze({
    Capped: 0,
    Uncapped: 1,
    Flexible: 2
});

const BurnType721 = Object.freeze({
    None: 0,
    Burnable: 1,
    Replenishable: 2
});

// ENUMS in Super1155
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


// Test the TokenVault without Timelock and MultiSigWallet functionality.
describe('===TokenVault w/o Timelock and MultiSig===', function () {
    let alice, bob, carol, dev;
    let Token, Super721, Super1155, ProxyRegistry, TokenVault;
    before(async () => {
        [alice, bob, carol, dev] = await ethers.getSigners();
        
        // Create factories for deploying all required contracts using specified signers.
        Token = await ethers.getContractFactory('Token');
        TokenVault = await ethers.getContractFactory('TokenVault');
        Super721 = await ethers.getContractFactory("Super721");
        Super1155 = await ethers.getContractFactory("Super1155");
        ProxyRegistry = await ethers.getContractFactory("ProxyRegistry");
    });

    // Deploy a fresh set of smart contracts for testing with.
    let token, 
        tokenVault, 
        proxyRegistry,
        super721,
        super721Additional,
        super1155,
        super1155Additional;
    let balanceERC20TokenVault = ethers.utils.parseEther("1000000000");
    let itemGroupId, itemGroupId2, shiftedItemGroupId, shiftedItemGroupId2;
    let prov = waffle.provider;
    let etherBalanceVault = ethers.utils.parseEther('500');
    let UNIVERSAL;

    beforeEach(async () => {
        token = await Token.connect(dev).deploy('Token', 'TOK', ethers.utils.parseEther('10000000000'));
        await token.deployed();
        tokenVault = await TokenVault.connect(dev).deploy('Vault One', token.address, bob.address, carol.address, ethers.BigNumber.from('1'));
        await tokenVault.deployed();
        await token.connect(dev).mint(tokenVault.address, ethers.utils.parseEther('1000000000'));
        proxyRegistry = await ProxyRegistry.connect(dev).deploy();
        await proxyRegistry.deployed();
        super721 = await Super721.connect(dev).deploy(
            dev.address,
            "SUPER721",
            "S721",
            "URI_SUPER721",
            "URI_SUPER721",
            proxyRegistry.address
        );
        await super721.deployed();
        super721Additional = await Super721.connect(dev).deploy(
            dev.address,
            "SUPER721ADD",
            "S721A",
            "URI_SUPER721A",
            "URI_SUPER721A",
            proxyRegistry.address
        );
        await super721Additional.deployed();
        super1155 = await Super1155.connect(dev).deploy(
            dev.address,
            "SUPER1155",
            "URI_SUPER1155",
            "URI_SUPER1155",
            proxyRegistry.address
        );
        await super1155.deployed();
        super1155Additional = await Super1155.connect(dev).deploy(
            dev.address,
            "SUPER1155ADD",
            "URI_SUPER1155A",
            "URI_SUPER1155A",
            proxyRegistry.address
        );
        await super1155Additional.deployed();

        await token.connect(dev).mint(tokenVault.address, balanceERC20TokenVault);

        // mint and create 721 and 1155 tokens
        itemGroupId = ethers.BigNumber.from(1);
        itemGroupId2 = ethers.BigNumber.from(2);
        shiftedItemGroupId = itemGroupId.shl(128);
        shiftedItemGroupId2 = itemGroupId2.shl(128);

        await super721.connect(dev).configureGroup(
            itemGroupId, 
            {
                name: 'NFT',
                supplyType: SupplyType721.Capped,
                supplyData: 20000,
                burnType: BurnType721.Burnable,
                burnData: 100
            }
        );

        await super721.connect(dev).configureGroup(
            itemGroupId2,
            {
                name: 'NFT2',
                supplyType: SupplyType721.Capped,
                supplyData: 20000,
                burnType: BurnType721.Burnable, // what if 0/none? Update: 0 is unburnable
                burnData: 100
            }
        );

        await super721.connect(dev).mintBatch( tokenVault.address, [shiftedItemGroupId], ethers.utils.id('a'));
        // await super721.connect(dev).mintBatch( tokenVault.address, [shiftedItemGroupId2], ethers.utils.id('b'));

        await super1155.connect(dev).configureGroup(
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
        
        await super1155.connect(dev).configureGroup(
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
        
        let setUriRight = await super721.SET_URI();
        UNIVERSAL = await super721.UNIVERSAL();
        let BURN = await super721.BURN();

        // Mint fungible item
        await super1155.connect(dev).mintBatch(tokenVault.address, [shiftedItemGroupId], ["10"], DATA);
        await super1155.connect(dev).mintBatch(tokenVault.address, [shiftedItemGroupId2], ["1"], DATA);

        await super721.connect(dev).setPermit(
            tokenVault.address,
            UNIVERSAL, 
            BURN,
            ethers.constants.MaxUint256
        );

        await super1155.connect(dev).setPermit(
            tokenVault.address,
            UNIVERSAL, 
            BURN,
            ethers.constants.MaxUint256
        );

        let works = await super721.hasRight(tokenVault.address, UNIVERSAL, BURN);
        

        await expect( dev.sendTransaction({
            to: tokenVault.address,
            value: etherBalanceVault
        })).to.emit(tokenVault, 'Receive').withArgs(dev.address, etherBalanceVault);

    });

    // accelerate tests by taking snapshot of block 
    beforeEach(async function() {
		currentTime = await (await ethers.provider.getBlock()).timestamp;
		snapshotId = await network.provider.send("evm_snapshot");
	});


	afterEach(async function() {
		await network.provider.send("evm_revert", [snapshotId]);
	});

    // Verify that the multisignature wallet can send tokens from the vault.
    it('should update panic data', async () => {    
        await tokenVault.connect(dev).changePanicDetails(carol.address, bob.address);

        await tokenVault.connect(dev).lock();

        await expect(
            tokenVault.changePanicDetails(carol.address, bob.address)
        ).to.be.revertedWith(
            "CannotChangePanicDetailsOnLockedVault()"
        );
    });

    it('should add Super721 and Super1155 addresses', async () => {
        await tokenVault.connect(dev).addSuper721Addr([super721.address, super721Additional.address]);
        await tokenVault.connect(dev).addSuper1155Addr([super1155.address, super1155Additional.address]);

        await expect( 
         tokenVault.connect(dev).addSuper721Addr([super721.address])
        ).to.be.revertedWith("AddressOfSuper721AlreadyInSet()");
        
        await expect( 
            tokenVault.connect(dev).addSuper1155Addr([super1155.address])
        ).to.be.revertedWith("AddressOfSuper1155AlreadyInSet");
    })

    let asset721,
        asset1155,
        assetERC20,
        assetEth;
    describe('Test adding of tokens on contract ->', function () {
        beforeEach(async () => {
            await tokenVault.connect(dev).addSuper721Addr([super721.address]);
            await tokenVault.connect(dev).addSuper1155Addr([super1155.address]);
        
            asset721 = {  
                assetType: AssetType.ERC721,
                amounts: [ethers.BigNumber.from('1')], 
                ids: [shiftedItemGroupId]
            };
            asset1155 = {  
                assetType: AssetType.ERC1155,
                amounts: [ethers.BigNumber.from('10')], 
                ids: [shiftedItemGroupId.add(1)]
            };
            assetERC20 = {  
                assetType: AssetType.ERC20,
                amounts: [ethers.BigNumber.from('1')], 
                ids: []
            };
            assetEth = {  
                assetType: AssetType.Eth,
                amounts: [ethers.BigNumber.from('10')], 
                ids: []
            };
        });
        
        it("should add 721 and 1155 tokens to contract", async () => {
            await tokenVault.connect(dev).addTokens(
                [super721.address, super1155.address],
                [asset721, asset1155]
            );

        }); 
    
        it('addTokens REVERTs', async ()=> {
            await expect(
                tokenVault.connect(dev).addTokens(
                    [super721.address],
                    [asset721, asset1155]
                )
            ).to.be.revertedWith("NumberOfContractsAndAssetsShouldBeTheSame()");
            
            await expect(
                tokenVault.connect(dev).addTokens(
                    [token.address, super1155.address],
                    [asset721, asset1155]
                )
            ).to.be.revertedWith("AddressOfTokenIsNotPermited()");
            
            await expect(
                tokenVault.connect(dev).addTokens(
                    [super721.address, super1155.address],
                    [assetERC20, assetEth]
                )
            ).to.be.revertedWith("TypeOfAssetIsNotERC721OrERC1155()");
        });

        describe('Test sending of tokens on contract ->', function () {
            let assetERC20 = {
                assetType: AssetType.ERC20,
                amounts: [ethers.utils.parseEther('1000')],
                ids: []
            }; 

            beforeEach(async () => {
                await tokenVault.connect(dev).addTokens(
                    [super721.address, super1155.address],
                    [asset721, asset1155]
                );
            });

            it('should sendTokens ERC20', async () => {
                await tokenVault.sendTokens([alice.address], [token.address], [assetERC20]);
                let balance = await token.balanceOf(alice.address);
                expect(balance.toString()).to.equal(ethers.utils.parseEther('1000'));
            });

            it('should sendTokens ERC721', async () => {
                let balance721 = await super721.balanceOf(tokenVault.address);
                // console.log(`vault balance of 721 before: ${balance721}`);
                await tokenVault.sendTokens([alice.address], [super721.address], [asset721]);
                
                balance721 = await super721.balanceOf(tokenVault.address);
                // console.log(`vault balance of 721 after: ${balance721}`);
                expect(await super721.balanceOf(alice.address)).to.be.equal(ethers.BigNumber.from('1'));
            });

            it('should sendTokens ERC1155', async () => {
                
                let balance1155 = await super1155.balanceOf(tokenVault.address, shiftedItemGroupId.add(1));
                // console.log(`vault balance of 1155 before: ${balance1155}`);
                
                await tokenVault.sendTokens([alice.address], [super1155.address], [asset1155]);
                balance1155 = await super1155.balanceOf(tokenVault.address, shiftedItemGroupId.add(1));
                // console.log(`vault balance of 1155 after: ${balance1155}`);
                expect(await super1155.balanceOf(alice.address, shiftedItemGroupId.add(1))).to.be.equal(ethers.BigNumber.from('10')) 
            });

            it('should sendTokens Ether', async () => {
                let balanceBefore = await prov.getBalance(alice.address);
                await tokenVault.sendTokens([alice.address], [ZERO_ADDRESS], [assetEth]);
                let balanceAfter = await prov.getBalance(alice.address);
                // TODO check balances after
                expect(balanceAfter.sub(balanceBefore)).to.be.equal(ethers.BigNumber.from('10')); 
            });

            it('should sendTokens combo', async () => {
                let balanceBefore = await prov.getBalance(alice.address);
                await tokenVault.sendTokens(
                    [alice.address, bob.address, carol.address, alice.address],
                    [token.address, super721.address, super1155.address, ZERO_ADDRESS],
                    [assetERC20, asset721, asset1155, assetEth]
                );
                let balanceAfter = await prov.getBalance(alice.address);
                expect(await token.balanceOf(alice.address)).to.be.equal(ethers.utils.parseEther('1000'));
                expect(await super721.balanceOf(bob.address)).to.be.equal(ethers.BigNumber.from('1'));
                expect(await super1155.balanceOf(carol.address, shiftedItemGroupId.add(1))).to.be.equal(ethers.BigNumber.from('10'));
                expect(balanceAfter.sub(balanceBefore)).to.be.equal(ethers.BigNumber.from('10')); 
            });

            it('sendTokens() REVERTs:', async () => {
                await expect(
                 tokenVault.sendTokens([], [token.address], [assetERC20])
                ).to.be.revertedWith("MustSendTokensToAtLeastOneRecipient");

                await expect(
                 tokenVault.sendTokens([alice.address], [token.address], [assetERC20, asset721])
                ).to.be.revertedWith("RecipientLengthCannotBeMismathedWithAssetsLength()");
            
                await expect(
                 tokenVault.sendTokens([alice.address], [super721Additional.address], [asset721])
                ).to.be.revertedWith("Super721IsNotAvailible");
                
                await expect(
                    tokenVault.sendTokens([alice.address], [super1155Additional.address], [asset1155])
                ).to.be.revertedWith("Super1155IsNotAvailible");
                
                await expect(
                    tokenVault.sendTokens([alice.address], [ZERO_ADDRESS], 
                        [{  
                            assetType: AssetType.Eth,
                            amounts: [etherBalanceVault.add(ethers.BigNumber.from('1'))], 
                            ids: []
                        }]
                    )
                ).to.be.revertedWith("SendEthFailed");
            });



            it('PANIC transfer', async () => {
                // let panicOwner = await tokenVault.panicOwner();
                let zero = ethers.utils.parseEther('0');
                
                let balanceERC20 = await token.balanceOf(tokenVault.address);
                let balanceERC721 = await super721.balanceOf(tokenVault.address);
                let balanceERC1155 = await super1155.balanceOf(tokenVault.address, shiftedItemGroupId.add(1));
                let balanceEthBefore = await prov.getBalance(tokenVault.address);
                let carolEthBefore = await prov.getBalance(carol.address);
                
                await tokenVault.connect(bob).panic();
        
                let balanceEthAfter = await prov.getBalance(tokenVault.address);
                let carolEthAfter = await prov.getBalance(carol.address);

                expect(await token.balanceOf(carol.address)).to.be.equal(balanceERC20);
                expect(await super721.balanceOf(carol.address)).to.be.equal(balanceERC721);
                expect(await super1155.balanceOf(carol.address, shiftedItemGroupId.add(1))).to.be.equal(balanceERC1155);
                expect(carolEthAfter.sub(carolEthBefore)).to.be.equal(balanceEthBefore); 
                
                expect(await token.balanceOf(tokenVault.address)).to.be.equal(zero);
                expect(await super721.balanceOf(tokenVault.address)).to.be.equal(zero);
                expect(await super1155.balanceOf(tokenVault.address, shiftedItemGroupId.add(1))).to.be.equal(zero);
                expect(balanceEthAfter).to.be.equal(zero); 
               
            });

            it('PANIC burn', async () => {
                let zero = ethers.utils.parseEther('0');
                let balanceEthBefore = await prov.getBalance(tokenVault.address);
                
                await tokenVault.connect(dev).changePanicDetails(bob.address, ZERO_ADDRESS);
                
                await tokenVault.connect(bob).panic();
                let balanceEthAfter = await prov.getBalance(tokenVault.address);

                expect(await token.balanceOf(tokenVault.address)).to.be.equal(zero);
                expect(await super721.balanceOf(tokenVault.address)).to.be.equal(zero);
                expect(await super1155.balanceOf(tokenVault.address, shiftedItemGroupId.add(1))).to.be.equal(zero);
                expect(balanceEthAfter).to.be.equal(zero); 
                // bob's balance are zero 
                expect(await token.balanceOf(bob.address)).to.be.equal(zero);
                expect(await super721.balanceOf(bob.address)).to.be.equal(zero);
                expect(await super1155.balanceOf(bob.address, shiftedItemGroupId.add(1))).to.be.equal(zero);
            });

            it('PANIC REVERT trying non panic owner call panic', async () => {

            });
        });
    })
    
});