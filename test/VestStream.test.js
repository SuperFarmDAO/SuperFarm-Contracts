'use strict';

// Imports.
import { network, ethers, waffle } from 'hardhat';
import { expect } from 'chai';
import 'chai/register-should';

// enum in VestStream
const RequirmentType = Object.freeze({
    ETH: 0, 
    ERC20: 1,
    ERC1155: 2,
    ERC721: 3
});

const RewardType = Object.freeze({
    Day: 0,
    Minute: 1,
    Second: 2
});

// enums in Super721
const SupplyType = Object.freeze({
    Capped: 0,
    Uncapped: 1,
    Flexible: 2
  });

const BurnType = Object.freeze({
    None: 0,
    Burnable: 1,
    Replenishable: 2
});

const DATA = "0x02";


// Test the VestStream contract's ability to create and run token claims.
describe('VestStream', function () {
    let alice, bob, minter, beneficiary;
	let mintRight;
    let UNIVERSAL;
	let itemGroupId = ethers.BigNumber.from(1);
    let shiftedItemGroupId = itemGroupId.shl(128);
	let rewardPerDay = ethers.utils.parseEther("86400");
	let rewardPerMinute = ethers.utils.parseEther("60");
	let rewardPerSecond = ethers.utils.parseEther("1");
    let Token, VestStream, Super1155, Super721, ProxyRegistry;
    let saltETH, saltERC1155, saltERC721, saltETHClaim, saltERC1155ZeroLen, saltERC721ZeroLen;

    let prov = waffle.provider;

    before(async () => {
        [alice, bob, minter, beneficiary]= await ethers.getSigners();
        // const addresses = await Promise.all(signers.map(async signer => signer.getAddress()));
        // alice = { provider: signers[0].provider, signer: signers[0], address: addresses[0] };
        // bob = { provider: signers[1].provider, signer: signers[1], address: addresses[1] };
        // minter = { provider: signers[4].provider, signer: signers[4], address: addresses[4] };

        // Create factories for deploying all required contracts using specified signers.
        Token = await ethers.getContractFactory('Token');
        VestStream = await ethers.getContractFactory('VestStream');
        Super1155 = await ethers.getContractFactory('Super1155');
        Super721 = await ethers.getContractFactory('Super721');
        ProxyRegistry = await ethers.getContractFactory('ProxyRegistry');
    });
    
    // Deploy a fresh set of smart contracts for testing with.
    let token, vestStream, super1155, super721, proxyRegistry;
    let currentTime;
    beforeEach(async () => {
        token = await Token.connect(minter).deploy('Token', 'TOK', ethers.utils.parseEther('1000000000'));
        await token.deployed();
        vestStream = await VestStream.connect(minter).deploy(token.address);
        await vestStream.deployed();
        proxyRegistry = await ProxyRegistry.connect(minter).deploy();
        await proxyRegistry.deployed();
        super1155 = await Super1155.connect(minter).deploy(
            minter.address,
            "SUPER1155",
            "URI_SUPER1155",
            "URI_SUPER1155", 
            proxyRegistry.address
        );
        await super1155.deployed();
        super721 = await Super721.connect(minter).deploy(
            minter.address, 
            "SUPER721", 
            "S721", 
            "URI_SUPER21",
            "URI_SUPER721", 
            proxyRegistry.address
        );
        await super721.deployed();
        mintRight = await super721.MINT();
        UNIVERSAL = await super1155.UNIVERSAL();
        
        currentTime = Math.floor(Date.now() / 1000);
        // Mint test tokens and send them to the vesting contract.
        await token.connect(minter).mint(vestStream.address, ethers.utils.parseEther('100000000'));
        await token.connect(minter).mint(alice.address, ethers.utils.parseEther('10000') );    
    });

    // Verify that the vesting owner can sweep tokens from the contract.
    it('should allow the vesting owner to sweep', async () => {
        let contractBalance = await token.balanceOf(vestStream.address);
        contractBalance.should.be.equal(ethers.utils.parseEther('100000000'));
        await vestStream.connect(minter).sweep(token.address);
        contractBalance = await token.balanceOf(vestStream.address);
        contractBalance.should.be.equal(ethers.utils.parseEther('0'));
        let minterBalance = await token.balanceOf(minter.address);
        minterBalance.should.be.equal(ethers.utils.parseEther('100000000'));
    });

    // Verify that non-owners can not sweep tokens from the contract.
    it('should not allow non-owners to sweep', async () => {
        await expect(
            vestStream.connect(alice).sweep(token.address)
        ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    // Verify that the vesting owner can create a claim.
    it('should allow the vesting owner to create a claim', async () => {
        let salt = 0;
        await vestStream.connect(minter).createClaim(
            [ alice.address ],
            [ ethers.utils.parseEther('10000') ],
            currentTime + 60,
            currentTime + 120,    
            { 
                asset: token.address, 
                amount: ethers.utils.parseEther('100'), 
                requirmentType: RequirmentType.ERC20, 
                ids:[ethers.BigNumber.from("1")] 
            },
            { 
                amount: rewardPerDay,
                rewardType: RewardType.Day
            },
            salt, 
            false
        );
        // check values after 
        let claim = await vestStream.getClaim(alice.address, salt);
        claim.startTime.should.be.equal(currentTime+60);
        claim.endTime.should.be.equal(currentTime+120);
    });

    // Verify that a non-owner may not create a claim.
    it('CreateClaim REVERT: should not allow non-owners to create a claim', async () => {
        let salt = 0;
        await expect(
            vestStream.connect(bob).createClaim(
                [ alice.address ],
                [ ethers.utils.parseEther('10000') ],
                currentTime + 60, 
                currentTime + 120,
			    { 
                    asset: token.address, 
                    amount: ethers.utils.parseEther('100'),
                    requirmentType: RequirmentType.ERC20, 
                    ids:[ethers.BigNumber.from("1")] }, 
                { 
                    amount: rewardPerDay,
                    rewardType: RewardType.Day
                },
                salt, 
                false
            )
        ).to.be.revertedWith('P1');
    });

    // Verify that a claim cannot be created with no beneficiary.
    it('CreateClaim REVERT: should revert with empty beneficiaries', async () => {
        let salt = 0;
        await expect(
            vestStream.connect(minter).createClaim(
                [ ],
                [ ], 
                currentTime + 60, 
                currentTime + 120,
                { 
                    asset: token.address, 
                    amount: ethers.utils.parseEther('100'),
                    requirmentType: RequirmentType.ERC20,
                    ids:[ethers.BigNumber.from("1")]}, 
                { 
                    amount: rewardPerDay,
                    rewardType: RewardType.Day
                },    
                salt, 
                false
            )
        ).to.be.revertedWith('You must specify at least one beneficiary for a claim.');
    });

    // Verify that beneficiary and balance param lengths match
    it('CreateClaim REVERT: should revert on parameter length mismatch', async () => {
        let salt = 0;
        await expect(
            vestStream.connect(minter).createClaim(
                [ alice.address, bob.address ],
                [ ethers.utils.parseEther('10000') ],
                currentTime + 60,
                currentTime + 120,    
                { 
                    asset: token.address, 
                    amount: ethers.utils.parseEther('100'), 
                    requirmentType: RequirmentType.ERC20,
                    ids:[ethers.BigNumber.from("1")] }, 
                { 
                    amount: rewardPerDay,
                    rewardType: RewardType.Day
                },
                salt, 
                false
            )
        ).to.be.revertedWith('Beneficiaries and their amounts may not be mismatched.');
    });

    // Verify that claims for zero cannot be created
    // ATTENTION not used 
//    it('CreateClaim REVERT: should revert with zero token claims', async () => {
//        let salt = 0;
//        await expect(
//            vestStream.connect(minter).createClaim(
//                [ alice.address ], 
//                [ 0 ], 
//                currentTime + 60, 
//                currentTime + 120, 
//				rewardPerDay,    
//                { asset: token.address, 
//                  amount: ethers.utils.parseEther('100'), 
//                  requirmentType: RequirmentType.ERC20,
//                  ids:[ethers.BigNumber.from("1")] }, 
//                salt, 
//                false
//            )
//        ).to.be.revertedWith('You may not create a zero-token claim.');
//    });

    // Verify that a claim cannot be created which ends before it starts.
    it('CreateClaim REVERT: should revert with temporally-impossible claims', async () => {
        let salt = 0;
        await expect(
            vestStream.connect(minter).createClaim(
                [ alice.address ],
                [ ethers.utils.parseEther('10000') ], 
                currentTime - 120, 
                currentTime - 240,
                { 
                    asset: token.address, 
                    amount: ethers.utils.parseEther('100'), 
                    requirmentType: RequirmentType.ERC20,
                    ids:[ethers.BigNumber.from("1")]}, 
                { 
                    amount: rewardPerDay,
                    rewardType: RewardType.Day
                },   
                salt, 
                false
            )
        ).to.be.revertedWith('You may not create a claim which ends before it starts.');
    });

    // Verify that no claims are for the zero address.
  // ATTENTION not used
//    it('CreateClaim REVERT: should revert with zero address beneficiaries', async () => {
//        let salt = 0;
//        await expect(
//            vestStream.connect(minter).createClaim(
//                [ ethers.constants.AddressZero ],
//                [ ethers.utils.parseEther('10000') ], 
//                currentTime + 60, 
//                currentTime + 120,
//				rewardPerDay,    
//                { asset: token.address, 
//                  amount: ethers.utils.parseEther('100'), 
//                  requirmentType: RequirmentType.ERC20,
//                  ids:[ethers.BigNumber.from("1")]}, 
//                salt, 
//                false
//            )
//        ).to.be.revertedWith('The zero address may not be a beneficiary.');
//    });

    // Verify that no claim can be queried for the zero address.
    it('CreateClaim REVERT: should revert when checking zero address claim', async () => {
        let salt = 0;
        await expect(
            vestStream.connect(minter).getClaim(ethers.constants.AddressZero, salt)
        ).to.be.revertedWith('The zero address may not be a claim beneficiary.');
    });

    // Test user claims.
    describe('-> After creation of claim ...', function () {
        beforeEach(async () => {
            const currentBlock = await ethers.provider.getBlockNumber();
            const block = await ethers.provider.getBlock(currentBlock);
            currentTime = block.timestamp;
            let salt = 0;
            await vestStream.connect(minter).createClaim(
                [ alice.address ],
                [ ethers.utils.parseEther('10000') ],
                currentTime + 60,
                currentTime + 120, 
				{ 
                    asset: token.address, 
                    amount: ethers.utils.parseEther('100'), 
                    requirmentType: RequirmentType.ERC20,
                    ids:[ethers.BigNumber.from("1")] }, 
                { 
                    amount: rewardPerDay,
                    rewardType: RewardType.Day
                },
                salt, 
                false
            );
            salt++;
            // Create Claim for ETH 
            await vestStream.connect(minter).createClaim(
                [ alice.address ],
                [ ethers.utils.parseEther('10000') ],
                currentTime + 60,
                currentTime + 120, 
				{ 
                    asset: token.address, 
                    amount: ethers.utils.parseEther('1'), 
                    requirmentType: RequirmentType.ETH, 
                    ids:[ethers.BigNumber.from("1")] }, 
                { 
                    amount: rewardPerMinute,
                    rewardType: RewardType.Minute
                },
                salt, 
                false
            );
            saltETH = salt;
            salt++;
            // Create Claim for ERC1155 
            await vestStream.connect(minter).createClaim(
                [ alice.address ],
                [ ethers.utils.parseEther('10000') ],
                currentTime + 60,
                currentTime + 120, 
				{ 
                    asset: super1155.address, 
                    amount: ethers.BigNumber.from("1"), 
                    requirmentType: RequirmentType.ERC1155,
                    ids:[shiftedItemGroupId] }, 
                { 
                    amount: rewardPerSecond,
                    rewardType: RewardType.Second
                },
                salt, 
                false
            );
            saltERC1155 = salt;
            salt++;
            // Create Claim for ERC721 CHECK
            await vestStream.connect(minter).createClaim(
                [ alice.address ],
                [ ethers.utils.parseEther('10000') ],
                currentTime + 60,
                currentTime + 120, 
				{ 
                    asset: super721.address, 
                    amount: ethers.BigNumber.from("1"), 
                    requirmentType: RequirmentType.ERC721,
                    ids:[shiftedItemGroupId] }, 
                { 
                    amount: rewardPerDay,
                    rewardType: RewardType.Day
                },
                salt, 
                false
            );
            saltERC721 = salt;
            salt++;
            // Create Claim for claiming in ETH CHECK
            await vestStream.connect(minter).createClaim(
                [ alice.address ],
                [ ethers.utils.parseEther('10') ],
                currentTime + 60,
                currentTime + 120, 
				{
                    asset: token.address, 
                    amount: ethers.utils.parseEther('100'),
                    requirmentType: RequirmentType.ERC20,
                    ids:[ethers.BigNumber.from("1")]}, 
                { 
                    amount: ethers.utils.parseEther("0.86400"),    
                    rewardType: RewardType.Day
                },
                salt, 
                true
            );
            saltETHClaim = salt;
            salt++;
            // create claim for ERC721 with zero ids lenght
            await vestStream.connect(minter).createClaim(
                [ alice.address ],
                [ ethers.utils.parseEther('10000') ],
                currentTime + 60,
                currentTime + 120, 
				{ 
                    asset: super1155.address, 
                    amount: ethers.BigNumber.from("1"), 
                    requirmentType: RequirmentType.ERC1155,
                    ids:[] }, 
                { 
                    amount: rewardPerSecond,
                    rewardType: RewardType.Second
                },
                salt, 
                false
            );
            saltERC1155ZeroLen = salt;
            salt++;
            // create claim for ERC1155 with zero ids lenght
            await vestStream.connect(minter).createClaim(
                [ alice.address ],
                [ ethers.utils.parseEther('10000') ],
                currentTime + 60,
                currentTime + 120, 
				{ 
                    asset: super721.address, 
                    amount: ethers.BigNumber.from("1"), 
                    requirmentType: RequirmentType.ERC721,
                    ids:[] }, 
                { 
                    amount: rewardPerDay,
                    rewardType: RewardType.Day
                },
                salt, 
                false
            );
            saltERC721ZeroLen = salt;
        });

        // Alice should be able to claim tokens.
        it('should allow users to claim their tokens for ERC20', async () => {
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 120 ]
            });
            await minter.provider.send('evm_mine');
            await vestStream.connect(alice).claim(0);
            let aliceBalance = await token.balanceOf(alice.address);
            aliceBalance.should.be.equal(ethers.utils.parseEther('10060'));
        });

        it("claim REVERT: shouldn't allow users to claim their tokens for ERC20, cause not enough ERC20", async () => {
            await token.connect(alice).transfer(bob.address, ethers.utils.parseEther("9901"));
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 120 ]
            });
            await minter.provider.send('evm_mine');
            await expect( vestStream.connect(alice).claim(0))
            .to.be.revertedWith("Not enough ERC20");
            
        });


        it('should allow users to claim their tokens for ETH', async () => {
            await expect( minter.sendTransaction({
                to: vestStream.address,
                value: ethers.utils.parseEther('5000')
            })).to.emit(vestStream, 'Receive').withArgs(minter.address, ethers.utils.parseEther("5000"))

            await minter.provider.send('evm_mine');
            let contractBalanceBefore = await prov.getBalance(vestStream.address);
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 120 ]
            });
            await minter.provider.send('evm_mine');
            await vestStream.connect(alice).claim(saltETHClaim);

            let contractBalanceAfter = await prov.getBalance(vestStream.address);
            let aliceBalanceAfter = await prov.getBalance(alice.address);
            // use that cause if alice call the transaction her balance is slightly change
            (contractBalanceBefore.sub(contractBalanceAfter)).should.be.equal(ethers.utils.parseEther('0.0006'));
        });

        it("should fail to claim their tokens for ETH, cause contract hasn't revards", async () => {
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 120 ]
            });
            await minter.provider.send('evm_mine');
            await expect(
                vestStream.connect(alice).claim(saltETHClaim)
            ).to.be.revertedWith("Claim failed");
        });

        // Verify that we revert on completed claims.
        it('claim REVERT: should revert on completed claims', async () => {
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 120 ]
            });
            await minter.provider.send('evm_mine');
            await vestStream.connect(alice).claim(0);
            let aliceBalance = await token.balanceOf(alice.address);
            aliceBalance.should.be.equal(ethers.utils.parseEther('10060'));
            await expect(
                vestStream.connect(alice).claim(0)
            ).to.be.revertedWith('This claim has already been completely claimed.');
        });

        it('claim amount check, if claiming too late', async () => {
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 12000 ]
            });
            await minter.provider.send('evm_mine');
            await vestStream.connect(alice).claim(0);
            let aliceBalance = await token.balanceOf(alice.address);
            aliceBalance.should.be.equal(ethers.utils.parseEther('10060'));
        });

        it('claim multiple times after start time', async () => {
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 60 ]
            });
            await minter.provider.send('evm_mine');
            let blockNumBefore = await ethers.provider.getBlockNumber();
            let blockBefore = await ethers.provider.getBlock(blockNumBefore);
            // TODO rewrite 
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 75 ]
            });
            await minter.provider.send('evm_mine');
            await vestStream.connect(alice).claim(0);
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 90 ]
            });
            await minter.provider.send('evm_mine');
            await vestStream.connect(alice).claim(0);
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 105 ]
            });
            await minter.provider.send('evm_mine');
            await vestStream.connect(alice).claim(0);
            
            let aliceBalance = await token.balanceOf(alice.address);
            expect(aliceBalance).to.be.equal(ethers.utils.parseEther("10046"))
            // console.log(`claim at startTime balance after is ${aliceBalance}`);
        })

        it('should allow user to claim if has enough ETH', async () => {
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 120 ]
            });
            await minter.provider.send('evm_mine');
            await vestStream.connect(alice).claim(saltETH);  
            let aliceBalance = await token.balanceOf(alice.address);
            aliceBalance.should.be.equal(ethers.utils.parseEther('10060'));
        });

        it("claim REVERT: if user hasn't got enough ETH", async () => {
            let aliceBalance = await prov.getBalance(alice.address);
            
            await alice.sendTransaction({
                to: bob.address,
                value: aliceBalance.sub(ethers.utils.parseEther('0.1'))
            });
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 120 ]
            });
            await minter.provider.send('evm_mine');
            await expect(
             vestStream.connect(alice).claim(saltETH)
            ).to.be.revertedWith("Not enough ETH");;
        });

        // We should be able to query Alice's claimable amount.
        it('should allow querying a user claim', async () => {
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 120 ]
            });
            await minter.provider.send('evm_mine');
            let aliceAmount = await vestStream.connect(alice).claimableAmount(alice.address, 0);
            aliceAmount.should.be.equal(ethers.utils.parseEther('60'));
        });

        it('should allow to claim if user has ERC1155', async () => {
            await super1155.connect(minter).configureGroup(
                itemGroupId,
                { name: 'SEVENUP',
                  supplyType: 1,
                  supplyData: 1,
                  itemType: 2,
                  itemData: 1,
                  burnType: 2,
                  burnData: 0 }
            );
            // Set Permit for minting
            await super1155.connect(minter).setPermit(
                alice.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );
            // Mint semi fungible group.
            await super1155.connect(alice).mintBatch(alice.address, [shiftedItemGroupId], ["1"], DATA);

            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 120 ]
            });

            await vestStream.connect(alice).claim(saltERC1155);
            let aliceBalance = await token.balanceOf(alice.address);
            aliceBalance.should.be.equal(ethers.utils.parseEther('10060'))
        });

        it('should allow to claim if user has ERC1155 with zero lenght ids', async () => {
            await super1155.connect(minter).configureGroup(
                itemGroupId,
                { name: 'SEVENUP',
                  supplyType: 1,
                  supplyData: 1,
                  itemType: 2,
                  itemData: 1,
                  burnType: 2,
                  burnData: 0 }
            );
            // Set Permit for minting
            await super1155.connect(minter).setPermit(
                alice.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );
            // Mint semi fungible group.
            await super1155.connect(alice).mintBatch(alice.address, [shiftedItemGroupId], ["1"], DATA);

            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 120 ]
            });

            await vestStream.connect(alice).claim(saltERC1155ZeroLen);
            let aliceBalance = await token.balanceOf(alice.address);
            aliceBalance.should.be.equal(ethers.utils.parseEther('10060'))
        });

        it('should allow to claim if user has ERC721', async () => {
            // TODO mintng ERC721 token to address 
            let groupCirumstance = "0x0000000000000000000000000000000000000000000000000000000000000001"
            await super721.connect(minter).setPermit(
                alice.address,
                groupCirumstance,
                mintRight,
                ethers.constants.MaxUint256
            );
			await super721.connect(minter).configureGroup(
                itemGroupId,
                { name: 'GenericToken',
                  supplyType: SupplyType.Capped,
                  supplyData: 1,
                  burnType: BurnType.None,
                  burnData: 0 }
            )
			await super721.connect(alice).mintBatch(alice.address, [shiftedItemGroupId], ethers.utils.id('a'))

			await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 120 ]
            });

            await vestStream.connect(alice).claim(saltERC721);
            let aliceBalance = await token.balanceOf(alice.address);
            aliceBalance.should.be.equal(ethers.utils.parseEther('10060'))
        });

        it('should allow to claim if user has ERC721 with zero lenght', async () => {
            let groupCirumstance = "0x0000000000000000000000000000000000000000000000000000000000000001"
            await super721.connect(minter).setPermit(
                alice.address,
                groupCirumstance,
                mintRight,
                ethers.constants.MaxUint256
            );
			await super721.connect(minter).configureGroup(
                itemGroupId,
                { name: 'GenericToken',
                  supplyType: SupplyType.Capped,
                  supplyData: 1,
                  burnType: BurnType.None,
                  burnData: 0 }
            )
			await super721.connect(alice).mintBatch(alice.address, [shiftedItemGroupId], ethers.utils.id('a'))

			await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 120 ]
            });

            await vestStream.connect(alice).claim(saltERC721ZeroLen);
            let aliceBalance = await token.balanceOf(alice.address);
            aliceBalance.should.be.equal(ethers.utils.parseEther('10060'))
        });
        
        it("claim REVERT: shouldn't allow to claim if user hasn't got ERC1155", async () => {
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 120 ]
            });
            await minter.provider.send('evm_mine');
            await expect(
                vestStream.connect(alice).claim(saltERC1155)
            ).to.be.revertedWith("Not enough ERC1155 tokens");
        });

        it("claim REVERT: shouldn't allow to claim if user hasn't got ERC721", async () => {
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 120 ]
            });
            await expect(
                vestStream.connect(alice).claim(saltERC721)
            ).to.be.revertedWith("Not enough ERC721 tokens");
        });
        
        it("claim REVERT: shouldn't allow to claim if user hasn't got ERC1155 and ids are zero lenghts", async () => {
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 120 ]
            });
            await minter.provider.send('evm_mine');
            await expect(
                vestStream.connect(alice).claim(saltERC1155ZeroLen)
            ).to.be.revertedWith("Not enough ERC1155 tokens");
        });

        it("claim REVERT: shouldn't allow to claim if user hasn't got ERC721 and ids are zero lenghts", async () => {
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 120 ]
            });
            await expect(
                vestStream.connect(alice).claim(saltERC721ZeroLen)
            ).to.be.revertedWith("Not enough ERC721 tokens");
        });
        
        // Verify that a non-claimant has a zero claimable amount.
        it('should find zero claim for users with no claim', async () => {
            let bobClaim = await vestStream.connect(alice).claimableAmount(bob.address, 0);
            bobClaim.should.be.equal(0);
        });

        // Verify that a claim which hasn't started yet is zero.
        it('should find zero claim for unstarted claims', async () => {
            let salt = 0;
            await vestStream.connect(minter).createClaim(
                [ bob.address ],
                [ ethers.utils.parseEther('10000') ],
                currentTime + 60,
                currentTime + 120,
                { asset: token.address, 
                  amount: ethers.utils.parseEther('100'),
                  requirmentType: RequirmentType.ERC20,
                  ids:[ethers.BigNumber.from("1")]
                }, 
                { 
                    amount: rewardPerDay,
                    rewardType: RewardType.Day
                },
                salt, 
                false
            );
            await network.provider.request({
                method: 'evm_setNextBlockTimestamp',
                params: [ currentTime + 30 ]
            });
            let bobClaimable = await vestStream.connect(alice).claimableAmount(bob.address, salt);
            await expect( vestStream.connect(alice).claim(0)).to.be.revertedWith("Nothing to claim");

            bobClaimable.should.be.equal(0);
        });
    });
});