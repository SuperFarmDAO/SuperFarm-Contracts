'use strict';

// Imports.
import { ethers } from 'hardhat';
import { expect } from 'chai';

import 'chai/register-should';

const DATA = "0x02";

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
describe('TokenVault', function () {
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

    beforeEach(async () => {
        token = await Token.connect(dev).deploy('Token', 'TOK', ethers.utils.parseEther('10000000000'));
        await token.deployed();
        tokenVault = await TokenVault.connect(dev).deploy('Vault One', token.address, bob.address, carol.address, 3);
        await tokenVault.deployed();
        await token.connect(dev).mint(tokenVault.address, ethers.utils.parseEther('1000000000'));
        proxyRegistry = await ProxyRegistry.connect(dev).deploy();
        await proxyRegistry.deployed();
        super721 = await Super721.connect(dev).deploy(
            dev.address,
            "SUPER721",
            "S721",
            "URI_SUPER721",
            proxyRegistry.address
        );
        await super721.deployed();
        super721Additional = await Super721.connect(dev).deploy(
            dev.address,
            "SUPER721ADD",
            "S721A",
            "URI_SUPER721A",
            proxyRegistry.address
        );
        await super721Additional.deployed();
        super1155 = await Super1155.connect(dev).deploy(
            dev.address,
            "SUPER1155",
            "URI_SUPER1155",
            proxyRegistry.address
        );
        await super1155.deployed();
        super1155Additional = await Super1155.connect(dev).deploy(
            dev.address,
            "SUPER1155ADD",
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
                burnData: 6
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
                burnType: BurnType1155.Replenishable,
                burnData: 5
            }
        );

        // Mint fungible item
        await super1155.connect(dev).mintBatch(tokenVault.address, [shiftedItemGroupId], ["7"], DATA);
        await super1155.connect(dev).mintBatch(tokenVault.address, [shiftedItemGroupId2], ["1"], DATA);

        let etherBalanceVault = ethers.utils.parseEther('500');
        await expect( dev.sendTransaction({
            to: tokenVault.address,
            value: etherBalanceVault
        })).to.emit(tokenVault, 'Receive').withArgs(dev.address, etherBalanceVault);

    });

    // Verify that the multisignature wallet can send tokens from the vault.
    it('should update panic data', async () => {
        await tokenVault.connect(dev).changePanicDetails(carol.address, bob.address);

        await tokenVault.connect(dev).lock();

        await expect(
            tokenVault.changePanicDetails(carol.address, bob.address)
        ).to.be.revertedWith(
            "You cannot change panic details on a vault which is locked."
        );
    });

    it('should add Super721 and Super1155 addresses', async () => {
        await tokenVault.connect(dev).addSuper721Addr([super721.address, super721Additional.address]);
        await tokenVault.connect(dev).addSuper1155Addr([super1155.address, super1155Additional.address]);

        await expect( 
         tokenVault.connect(dev).addSuper721Addr([super721.address])
        ).to.be.revertedWith("address of super721 already presented in set");
        
        await expect( 
            tokenVault.connect(dev).addSuper1155Addr([super1155.address])
        ).to.be.revertedWith("address of super1155 already presented in set");
    })

    describe('Test adding of tokens on contract ->', function () {
        beforeEach(async () => {
            await tokenVault.connect(dev).addSuper721Addr([super721.address, super721Additional.address]);
            await tokenVault.connect(dev).addSuper1155Addr([super1155.address, super1155Additional.address]);
        });
        
        it("should add 721 and 1155 tokens to contract", async () => {
            await tokenVault.connect(dev).addTokens(
                [super721.address, super1155.address],
                [
                    {  
                        assetType: AssetType.Super721,
                        amounts: [ethers.BigNumber.from('1')], 
                        ids: [shiftedItemGroupId]
                    },
                    {  
                        assetType: AssetType.Super1155,
                        amounts: [ethers.BigNumber.from('1')], 
                        ids: [shiftedItemGroupId]
                    },  
                ]
            );
            // TODO check that everything is ok after
        }); 
    
        it('addTokens REVERTs', async ()=> {
            await expect(
                tokenVault.connect(dev).addTokens(
                    [super721.address],
                    [
                        {  
                            assetType: AssetType.Super721,
                            amounts: [ethers.BigNumber.from('1')], 
                            ids: [shiftedItemGroupId]
                        },
                        {  
                            assetType: AssetType.Super1155,
                            amounts: [ethers.BigNumber.from('1')], 
                            ids: [shiftedItemGroupId]
                        },  
                    ]
                )
            ).to.be.revertedWith("Number of contracts and assets should be the same");
            
            await expect(
                tokenVault.connect(dev).addTokens(
                    [super721Additional.address, super1155.address],
                    [
                        {  
                            assetType: AssetType.Super721,
                            amounts: [ethers.BigNumber.from('1')], 
                            ids: [shiftedItemGroupId]
                        },
                        {  
                            assetType: AssetType.Super1155,
                            amounts: [ethers.BigNumber.from('1')], 
                            ids: [shiftedItemGroupId]
                        },  
                    ]
                )
            ).to.be.revertedWith("Address of token is not permited");
            
            await expect(
                tokenVault.connect(dev).addTokens(
                    [super721.address, super1155.address],
                    [
                        {  
                            assetType: AssetType.ERC20,
                            amounts: [ethers.BigNumber.from('1')], 
                            ids: [shiftedItemGroupId]
                        },
                        {  
                            assetType: AssetType.Ether,
                            amounts: [ethers.BigNumber.from('1')], 
                            ids: [shiftedItemGroupId]
                        },  
                    ]
                )
            ).to.be.revertedWith("Type of asset isn't ERC721 or ERC1155");
        });

        describe('Test sending of tokens on contract ->', function () {
            beforeEach(async () => {
                // TODO add tokens to contract 
            });

            // TODO send ERC20
            // TODO send Ether
            // TODO send ERC721
            // TODO send ERC1155
            // TODO send multiple tokens 
        
            it('should send tokens', async () => {
                await tokenVault.sendTokens([alice.address], [ethers.utils.parseEther('1000')]);
        
                let balance = await token.balanceOf(alice.address);
        
                expect(balance.toString()).to.equal(ethers.utils.parseEther('1000'));
            });

            // TODO before panic send tokens to contract
            it('PANIC', async () => {
                let panicOwner = await tokenVault.panicOwner();
                await tokenVault.connect(bob).panic();
        
                let panicBalance = await token.balanceOf(carol.address);
        
                expect(panicBalance.toString()).to.equal(ethers.utils.parseEther('1000000000'));
            });
        });
    })
    
});
