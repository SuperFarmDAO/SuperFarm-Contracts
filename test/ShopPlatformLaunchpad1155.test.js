'use strict';

// Imports.
import { ethers } from 'hardhat';
import { expect } from 'chai';
import 'chai/register-should';

// Test the Shop Launchpad contract's ability to list and sell NFTs.
describe('ShopPlatformLaunchpad1155', function () {
	const startingUri = 'starting-uri';
	let alice, bob, carol, minter;
	let Token, Staker, FeeOwner, ShopPlatformLaunchpad1155, MockProxyRegistry, Fee1155NFTLockable;
	before(async () => {
		const signers = await ethers.getSigners();
		const addresses = await Promise.all(signers.map(async signer => signer.getAddress()));
		alice = { provider: signers[0].provider, signer: signers[0], address: addresses[0] };
		bob = { provider: signers[1].provider, signer: signers[1], address: addresses[1] };
		carol = { provider: signers[2].provider, signer: signers[2], address: addresses[2] };
		minter = { provider: signers[4].provider, signer: signers[4], address: addresses[4] };

		// Create factories for deploying all required contracts using specified signers.
		Token = await ethers.getContractFactory('Token');
		Staker = await ethers.getContractFactory('Staker');
		FeeOwner = await ethers.getContractFactory('FeeOwner');
		ShopPlatformLaunchpad1155 = await ethers.getContractFactory('ShopPlatformLaunchpad1155');
		MockProxyRegistry = await ethers.getContractFactory('MockProxyRegistry');
		Fee1155NFTLockable = await ethers.getContractFactory('Fee1155NFTLockable');
	});

	// Deploy a fresh set of smart contracts for testing with.
	let token, staker, platformFeeOwner, shop, itemFeeOwner, proxyRegistry, itemOne;
	beforeEach(async () => {
		token = await Token.connect(minter.signer).deploy('Token', 'TOK', ethers.utils.parseEther('1000000000'));
		await token.deployed();
		staker = await Staker.connect(alice.signer).deploy('Staker', token.address);
		await staker.deployed();
		platformFeeOwner = await FeeOwner.connect(alice.signer).deploy('2500', '10000');
		await platformFeeOwner.deployed();
		itemFeeOwner = await FeeOwner.connect(alice.signer).deploy('10000', '10000');
		await itemFeeOwner.deployed();
		proxyRegistry = await MockProxyRegistry.connect(alice.signer).deploy();
		await proxyRegistry.deployed();
		itemOne = await Fee1155NFTLockable.connect(alice.signer).deploy(startingUri, itemFeeOwner.address, proxyRegistry.address);
		await itemOne.deployed();
		shop = await ShopPlatformLaunchpad1155.connect(alice.signer).deploy(itemOne.address, platformFeeOwner.address, [ staker.address ], 1);
		await shop.deployed();

		// Alice as owner of the Staker must approve the shop to spend user points.
		await staker.connect(alice.signer).approvePointSpender(shop.address, true);

		// Transfer ownership of the item contract to the launchpad.
		itemOne.connect(alice.signer).transferOwnership(shop.address);

		// Mint test tokens and send one to Bob.
		await token.connect(minter.signer).mint(minter.address, ethers.utils.parseEther('1000000000'));
		await token.connect(minter.signer).transfer(bob.address, ethers.utils.parseEther('1'));

		// Establish the emissions schedule and add the token pool.
		await staker.connect(alice.signer).setEmissions([
			{ blockNumber: 0, rate: ethers.utils.parseEther('0') }
		], [
			{ blockNumber: 0, rate: 100 }
		]);
		await staker.connect(alice.signer).addPool(token.address, 100, 100);

		// Bob must approve the Staker to spend his test tokens.
		await token.connect(bob.signer).approve(staker.address, ethers.utils.parseEther('1000000000'));

		// Let Bob deposit his token to begin accruing points.
		await staker.connect(bob.signer).deposit(token.address, ethers.utils.parseEther('1'));
	});

	// Verify that the Shop owner can add an item pool.
	it('should allow shop owner to create an item pool', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await shop.connect(alice.signer).addPool({
			name: 'Test Pool',
			startBlock: currentBlockNumber,
			endBlock: currentBlockNumber + 100,
			purchaseLimit: 1,
			requirement: {
				requiredType: 0,
				requiredAsset: ethers.constants.AddressZero,
				requiredAmount: 0,
				whitelistId: 0
			}
		}, [ 0 ], [ 10 ], [ [ {
			assetType: 1,
			asset: '0x0000000000000000000000000000000000000000',
			price: ethers.utils.parseEther('0.1')
		} ] ]);
	});

	// Verify that a user may purchase an item from a Shop's pool.
	it('should allow users to purchase items from pools for Ether', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await shop.connect(alice.signer).addPool({
			name: 'Test Pool',
			startBlock: currentBlockNumber,
			endBlock: currentBlockNumber + 100,
			purchaseLimit: 1,
			requirement: {
				requiredType: 0,
				requiredAsset: ethers.constants.AddressZero,
				requiredAmount: 0,
				whitelistId: 0
			}
		}, [ 0 ], [ 10 ], [ [ {
			assetType: 1,
			asset: '0x0000000000000000000000000000000000000000',
			price: ethers.utils.parseEther('0.1')
		} ] ]);

		// Conduct a purchase with Bob.
		let bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(0);
		await shop.connect(bob.signer).mintFromPool(0, 0, 0, 1, { value: ethers.utils.parseEther('0.1') });
		bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(1);
	});

	// Verify that a user may purchase an item from a Shop's pool with tokens.
	it('should allow users to purchase items from pools for tokens', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await shop.connect(alice.signer).addPool({
			name: 'Test Pool',
			startBlock: currentBlockNumber,
			endBlock: currentBlockNumber + 100,
			purchaseLimit: 1,
			requirement: {
				requiredType: 0,
				requiredAsset: ethers.constants.AddressZero,
				requiredAmount: 0,
				whitelistId: 0
			}
		}, [ 0 ], [ 10 ], [ [ {
			assetType: 2,
			asset: token.address,
			price: ethers.utils.parseEther('1')
		} ] ]);

		// Give Bob tokens.
		await token.connect(minter.signer).transfer(bob.address, ethers.utils.parseEther('1'));
		let bobTokenBalance = await token.balanceOf(bob.address);
		bobTokenBalance.should.be.equal(ethers.utils.parseEther('1'));

		// Bob needs to approve the Shop to spend his tokens.
		await token.connect(bob.signer).approve(shop.address, ethers.utils.parseEther('1'));

		// Conduct a purchase with Bob.
		let bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(0);
		await shop.connect(bob.signer).mintFromPool(0, 0, 0, 1);
		bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(1);
		bobTokenBalance = await token.balanceOf(bob.address);
		bobTokenBalance.should.be.equal(0);
	});

	// Verify that a user may purchase an item from a Shop's pool with points.
	it('should allow users to purchase items from pools for points', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await shop.connect(alice.signer).addPool({
			name: 'Test Pool',
			startBlock: currentBlockNumber,
			endBlock: currentBlockNumber + 100,
			purchaseLimit: 1,
			requirement: {
				requiredType: 0,
				requiredAsset: ethers.constants.AddressZero,
				requiredAmount: 0,
				whitelistId: 0
			}
		}, [ 0 ], [ 10 ], [ [ {
			assetType: 0,
			asset: '0x0000000000000000000000000000000000000000',
			price: 100
		} ] ]);

		// Conduct a purchase with Bob.
		let bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(0);
		await shop.connect(bob.signer).mintFromPool(0, 0, 0, 1);
		bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(1);
	});

	// Verify that a user may only purchase up to the Shop's purchase limit.
	it('should respect the configured purchase limit', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await shop.connect(alice.signer).addPool({
			name: 'Test Pool',
			startBlock: currentBlockNumber,
			endBlock: currentBlockNumber + 100,
			purchaseLimit: 1,
			requirement: {
				requiredType: 0,
				requiredAsset: ethers.constants.AddressZero,
				requiredAmount: 0,
				whitelistId: 0
			}
		}, [ 0 ], [ 10 ], [ [ {
			assetType: 1,
			asset: '0x0000000000000000000000000000000000000000',
			price: ethers.utils.parseEther('0.1')
		} ] ]);

		// Conduct a purchase with Bob.
		let bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(0);
		await shop.connect(bob.signer).mintFromPool(0, 0, 0, 1, { value: ethers.utils.parseEther('0.1') });
		bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(1);

		// Bob should not be able to make another purchase.
		await expect(
			shop.connect(bob.signer).mintFromPool(0, 0, 0, 1, { value: ethers.utils.parseEther('0.1') })
		).to.be.revertedWith('You may not purchase any more items from this sale.');
	});

	// Verify that a user may only purchase up to the Shop's purchase limit; single transaction.
	it('should respect the configured purchase limit in one transaction', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await shop.connect(alice.signer).addPool({
			name: 'Test Pool',
			startBlock: currentBlockNumber,
			endBlock: currentBlockNumber + 100,
			purchaseLimit: 1,
			requirement: {
				requiredType: 0,
				requiredAsset: ethers.constants.AddressZero,
				requiredAmount: 0,
				whitelistId: 0
			}
		}, [ 0 ], [ 10 ], [ [ {
			assetType: 1,
			asset: '0x0000000000000000000000000000000000000000',
			price: ethers.utils.parseEther('0.1')
		} ] ]);

		// Bob should not be able to purchase more than the limit.
		await expect(
			shop.connect(bob.signer).mintFromPool(0, 0, 0, 2, { value: ethers.utils.parseEther('0.1') })
		).to.be.revertedWith('You may not purchase any more items from this sale.');
	});

	// Verify that token-gated pools gate purchases.
	it('should respect token participation requirements', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await shop.connect(alice.signer).addPool({
			name: 'Test Pool',
			startBlock: currentBlockNumber,
			endBlock: currentBlockNumber + 100,
			purchaseLimit: 1,
			requirement: {
				requiredType: 1,
				requiredAsset: token.address,
				requiredAmount: ethers.utils.parseEther('1000'),
				whitelistId: 0
			}
		}, [ 0 ], [ 10 ], [ [ {
			assetType: 1,
			asset: '0x0000000000000000000000000000000000000000',
			price: ethers.utils.parseEther('0.1')
		} ] ]);

		// Bob should not be able to purchase an item without tokens.
		await expect(
			shop.connect(bob.signer).mintFromPool(0, 0, 0, 1, { value: ethers.utils.parseEther('0.1') })
		).to.be.revertedWith('You do not have enough required token to participate in this pool.');

		// Give Bob tokens.
		await token.connect(minter.signer).transfer(bob.address, ethers.utils.parseEther('999'));

		// Bob should still not be able to purchase an item.
		await expect(
			shop.connect(bob.signer).mintFromPool(0, 0, 0, 1, { value: ethers.utils.parseEther('0.1') })
		).to.be.revertedWith('You do not have enough required token to participate in this pool.');

		// Give Bob more tokens.
		await token.connect(minter.signer).transfer(bob.address, ethers.utils.parseEther('1'));

		// Bob should now be able to purchase an item.
		let bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(0);
		await shop.connect(bob.signer).mintFromPool(0, 0, 0, 1, { value: ethers.utils.parseEther('0.1') });
		bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(1);
	});

	// Verify that adding an invalid pool reverts based on time.
	it('should reject pools with invalid times', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await expect(
			shop.connect(alice.signer).addPool({
				name: 'Test Pool',
				startBlock: currentBlockNumber,
				endBlock: currentBlockNumber - 1,
				purchaseLimit: 1,
				requirement: {
					requiredType: 0,
					requiredAsset: ethers.constants.AddressZero,
					requiredAmount: 0,
					whitelistId: 0
				}
			}, [ 0 ], [ 10 ], [ [ {
				assetType: 1,
				asset: '0x0000000000000000000000000000000000000000',
				price: ethers.utils.parseEther('0.1')
			} ] ])
		).to.be.revertedWith('You cannot create a pool which ends before it starts.');
	});

	// Verify that adding an invalid pool reverts based on emptiness.
	it('should reject pools with no items', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await expect(
			shop.connect(alice.signer).addPool({
				name: 'Test Pool',
				startBlock: currentBlockNumber,
				endBlock: currentBlockNumber + 100,
				purchaseLimit: 1,
				requirement: {
					requiredType: 0,
					requiredAsset: ethers.constants.AddressZero,
					requiredAmount: 0,
					whitelistId: 0
				}
			}, [ ], [ 10 ], [ [ {
				assetType: 1,
				asset: '0x0000000000000000000000000000000000000000',
				price: ethers.utils.parseEther('0.1')
			} ] ])
		).to.be.revertedWith('You must list at least one item group.');
	});

	// Verify that adding an invalid pool reverts based on malformed data.
	it('should reject pools with malformed input', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await expect(
			shop.connect(alice.signer).addPool({
				name: 'Test Pool',
				startBlock: currentBlockNumber,
				endBlock: currentBlockNumber + 100,
				purchaseLimit: 1,
				requirement: {
					requiredType: 0,
					requiredAsset: ethers.constants.AddressZero,
					requiredAmount: 0,
					whitelistId: 0
				}
			}, [ 0, 1 ], [ 10 ], [ [ {
				assetType: 1,
				asset: '0x0000000000000000000000000000000000000000',
				price: ethers.utils.parseEther('0.1')
			} ] ])
		).to.be.revertedWith('Item groups length cannot be mismatched with mintable amounts length.');
	});

	// Verify that adding an invalid pool reverts based on unmintable items.
	it('should reject pools with unmintable items', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await expect(
			shop.connect(alice.signer).addPool({
				name: 'Test Pool',
				startBlock: currentBlockNumber,
				endBlock: currentBlockNumber + 100,
				purchaseLimit: 1,
				requirement: {
					requiredType: 0,
					requiredAsset: ethers.constants.AddressZero,
					requiredAmount: 0,
					whitelistId: 0
				}
			}, [ 0 ], [ 0 ], [ [ {
				assetType: 1,
				asset: '0x0000000000000000000000000000000000000000',
				price: ethers.utils.parseEther('0.1')
			} ] ])
		).to.be.revertedWith('You cannot add an item with no mintable amount.');
	});

	// Verify that invalid purchases revert when empty.
	it('should reject empty purchases', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await shop.connect(alice.signer).addPool({
			name: 'Test Pool',
			startBlock: currentBlockNumber,
			endBlock: currentBlockNumber + 100,
			purchaseLimit: 1,
			requirement: {
				requiredType: 0,
				requiredAsset: ethers.constants.AddressZero,
				requiredAmount: 0,
				whitelistId: 0
			}
		}, [ 0 ], [ 10 ], [ [ {
			assetType: 1,
			asset: '0x0000000000000000000000000000000000000000',
			price: ethers.utils.parseEther('0.1')
		} ] ]);

		// Conduct a purchase with Bob.
		await expect(
			shop.connect(bob.signer).mintFromPool(0, 0, 0, 0, { value: ethers.utils.parseEther('0.1') })
		).to.be.revertedWith('You must purchase at least one item.');
	});

	// Verify that invalid purchases revert for non-existent pools.
	it('should reject purchases on invalid pools', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await shop.connect(alice.signer).addPool({
			name: 'Test Pool',
			startBlock: currentBlockNumber,
			endBlock: currentBlockNumber + 100,
			purchaseLimit: 1,
			requirement: {
				requiredType: 0,
				requiredAsset: ethers.constants.AddressZero,
				requiredAmount: 0,
				whitelistId: 0
			}
		}, [ 0 ], [ 10 ], [ [ {
			assetType: 1,
			asset: '0x0000000000000000000000000000000000000000',
			price: ethers.utils.parseEther('0.1')
		} ] ]);

		// Conduct a purchase with Bob.
		await expect(
			shop.connect(bob.signer).mintFromPool(1, 0, 0, 1, { value: ethers.utils.parseEther('0.1') })
		).to.be.revertedWith('You can only purchase items from an active pool.');
	});

	// Verify that invalid purchases revert for invalid purchase assets.
	it('should reject purchases on invalid purchase assets', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await shop.connect(alice.signer).addPool({
			name: 'Test Pool',
			startBlock: currentBlockNumber,
			endBlock: currentBlockNumber + 100,
			purchaseLimit: 1,
			requirement: {
				requiredType: 0,
				requiredAsset: ethers.constants.AddressZero,
				requiredAmount: 0,
				whitelistId: 0
			}
		}, [ 0 ], [ 10 ], [ [ {
			assetType: 1,
			asset: '0x0000000000000000000000000000000000000000',
			price: ethers.utils.parseEther('0.1')
		} ] ]);

		// Conduct a purchase with Bob.
		await expect(
			shop.connect(bob.signer).mintFromPool(0, 0, 1, 1, { value: ethers.utils.parseEther('0.1') })
		).to.be.revertedWith('Your specified asset ID is not valid.');
	});

	// Verify that invalid purchases revert for items not belonging to a pool.
	it('should reject purchases on invalid pool items', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await shop.connect(alice.signer).addPool({
			name: 'Test Pool',
			startBlock: currentBlockNumber,
			endBlock: currentBlockNumber + 100,
			purchaseLimit: 1,
			requirement: {
				requiredType: 0,
				requiredAsset: ethers.constants.AddressZero,
				requiredAmount: 0,
				whitelistId: 0
			}
		}, [ 0 ], [ 10 ], [ [ {
			assetType: 1,
			asset: '0x0000000000000000000000000000000000000000',
			price: ethers.utils.parseEther('0.1')
		} ] ]);

		// Conduct a purchase with Bob.
		await expect(
			shop.connect(bob.signer).mintFromPool(0, 1, 0, 1, { value: ethers.utils.parseEther('0.1') })
		).to.be.revertedWith('Your specified asset ID is not valid.');
	});

	// Verify that invalid purchases revert for being too early.
	it('should reject purchases that are too early', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await shop.connect(alice.signer).addPool({
			name: 'Test Pool',
			startBlock: currentBlockNumber + 100,
			endBlock: currentBlockNumber + 100,
			purchaseLimit: 1,
			requirement: {
				requiredType: 0,
				requiredAsset: ethers.constants.AddressZero,
				requiredAmount: 0,
				whitelistId: 0
			}
		}, [ 0 ], [ 10 ], [ [ {
			assetType: 1,
			asset: '0x0000000000000000000000000000000000000000',
			price: ethers.utils.parseEther('0.1')
		} ] ]);

		// Conduct a purchase with Bob.
		await expect(
			shop.connect(bob.signer).mintFromPool(0, 0, 0, 1, { value: ethers.utils.parseEther('0.1') })
		).to.be.revertedWith('This pool is not currently running its sale.');
	});

	// Verify that invalid purchases revert for being too late.
	it('should reject purchases that are too late', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await shop.connect(alice.signer).addPool({
			name: 'Test Pool',
			startBlock: currentBlockNumber - 1,
			endBlock: currentBlockNumber - 1,
			purchaseLimit: 1,
			requirement: {
				requiredType: 0,
				requiredAsset: ethers.constants.AddressZero,
				requiredAmount: 0,
				whitelistId: 0
			}
		}, [ 0 ], [ 10 ], [ [ {
			assetType: 1,
			asset: '0x0000000000000000000000000000000000000000',
			price: ethers.utils.parseEther('0.1')
		} ] ]);

		// Conduct a purchase with Bob.
		await expect(
			shop.connect(bob.signer).mintFromPool(0, 0, 0, 1, { value: ethers.utils.parseEther('0.1') })
		).to.be.revertedWith('This pool is not currently running its sale.');
	});

	// Verify that invalid purchases revert for items that are out of stock.
	it('should reject purchases that are out of stock', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await shop.connect(alice.signer).addPool({
			name: 'Test Pool',
			startBlock: currentBlockNumber,
			endBlock: currentBlockNumber + 100,
			purchaseLimit: 1,
			requirement: {
				requiredType: 0,
				requiredAsset: ethers.constants.AddressZero,
				requiredAmount: 0,
				whitelistId: 0
			}
		}, [ 0 ], [ 1 ], [ [ {
			assetType: 1,
			asset: '0x0000000000000000000000000000000000000000',
			price: ethers.utils.parseEther('0.1')
		} ] ]);

		// Conduct a purchase with Alice.
		await shop.connect(alice.signer).mintFromPool(0, 0, 0, 1, { value: ethers.utils.parseEther('0.1') });

		// Conduct a purchase with Bob.
		await expect(
			shop.connect(bob.signer).mintFromPool(0, 0, 0, 1, { value: ethers.utils.parseEther('0.1') })
		).to.be.revertedWith('There are not enough items available for you to purchase.');
	});

	// Verify that invalid purchases revert when not enough Ether is sent.
	it('should reject purchases that do not send enough Ether', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await shop.connect(alice.signer).addPool({
			name: 'Test Pool',
			startBlock: currentBlockNumber,
			endBlock: currentBlockNumber + 100,
			purchaseLimit: 1,
			requirement: {
				requiredType: 0,
				requiredAsset: ethers.constants.AddressZero,
				requiredAmount: 0,
				whitelistId: 0
			}
		}, [ 0 ], [ 1 ], [ [ {
			assetType: 1,
			asset: '0x0000000000000000000000000000000000000000',
			price: ethers.utils.parseEther('0.1')
		} ] ]);

		// Conduct a purchase with Bob.
		await expect(
			shop.connect(bob.signer).mintFromPool(0, 0, 0, 1, { value: ethers.utils.parseEther('0.09') })
		).to.be.revertedWith('You did not send enough Ether to complete this purchase.');
	});

	// Verify that invalid purchases revert when users do not have enough tokens.
	it('should reject purchases that do not have enough tokens', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await shop.connect(alice.signer).addPool({
			name: 'Test Pool',
			startBlock: currentBlockNumber,
			endBlock: currentBlockNumber + 100,
			purchaseLimit: 1,
			requirement: {
				requiredType: 0,
				requiredAsset: ethers.constants.AddressZero,
				requiredAmount: 0,
				whitelistId: 0
			}
		}, [ 0 ], [ 1 ], [ [ {
			assetType: 2,
			asset: token.address,
			price: ethers.utils.parseEther('1')
		} ] ]);

		// Conduct a purchase with Bob.
		await expect(
			shop.connect(bob.signer).mintFromPool(0, 0, 0, 1, { value: ethers.utils.parseEther('0.09') })
		).to.be.revertedWith('You do not have enough token to complete this purchase.');
	});

	// Verify that multiple assets with multiple purchase assets work.
	it('should support multiple items per pool with multiple prices', async () => {
		await shop.connect(alice.signer).ownershipClawback();
		shop = await ShopPlatformLaunchpad1155.connect(alice.signer).deploy(itemOne.address, platformFeeOwner.address, [ staker.address ], 4);
		await shop.deployed();
		await itemOne.connect(alice.signer).transferOwnership(shop.address);

		// Add the testing pools to the new Shop.
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await shop.connect(alice.signer).addPool({
			name: 'Test Pool',
			startBlock: currentBlockNumber,
			endBlock: currentBlockNumber + 100,
			purchaseLimit: 4,
			requirement: {
				requiredType: 0,
				requiredAsset: ethers.constants.AddressZero,
				requiredAmount: 0,
				whitelistId: 0
			}
		}, [ 0, 1 ], [ 10, 5 ], [
			[ {
				assetType: 1,
				asset: '0x0000000000000000000000000000000000000000',
				price: ethers.utils.parseEther('0.1')
			},
			{
				assetType: 2,
				asset: token.address,
				price: ethers.utils.parseEther('1')
			} ],
			[ {
				assetType: 1,
				asset: '0x0000000000000000000000000000000000000000',
				price: ethers.utils.parseEther('1')
			},
			{
				assetType: 2,
				asset: token.address,
				price: ethers.utils.parseEther('10')
			} ]
		]);

		// Conduct the first Ether purchase.
		let aliceOldEtherBalance = await alice.provider.getBalance(alice.address);
		let bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(0);
		await shop.connect(bob.signer).mintFromPool(0, 0, 0, 1, { value: ethers.utils.parseEther('0.1') });
		bobBalance = await itemOne.balanceOf(bob.address, 1);
		bobBalance.should.be.equal(1);
		let aliceNewEtherBalance = await alice.provider.getBalance(alice.address);
		aliceNewEtherBalance.sub(aliceOldEtherBalance).should.be.equal(ethers.utils.parseEther('0.1'));

		// Conduct the second Ether purchase.
		let itemGroupTwo = ethers.BigNumber.from(1).shl(128);
		aliceOldEtherBalance = await alice.provider.getBalance(alice.address);
		bobBalance = await itemOne.balanceOf(bob.address, itemGroupTwo.add(1));
		bobBalance.should.be.equal(0);
		await shop.connect(bob.signer).mintFromPool(0, 1, 0, 1, { value: ethers.utils.parseEther('1') });
		bobBalance = await itemOne.balanceOf(bob.address, itemGroupTwo.add(1));
		bobBalance.should.be.equal(1);
		aliceNewEtherBalance = await alice.provider.getBalance(alice.address);
		aliceNewEtherBalance.sub(aliceOldEtherBalance).should.be.equal(ethers.utils.parseEther('1'));

		// Give Bob more tokens.
		await token.connect(minter.signer).transfer(bob.address, ethers.utils.parseEther('11'));

		// Bob must approve the Shop to spend his tokens.
		await token.connect(bob.signer).approve(shop.address, ethers.utils.parseEther('11'));

		// Conduct the first token purchase.
		let aliceOldTokenBalance = await token.balanceOf(alice.address);
		bobBalance = await itemOne.balanceOf(bob.address, 2);
		bobBalance.should.be.equal(0);
		await shop.connect(bob.signer).mintFromPool(0, 0, 1, 1);
		bobBalance = await itemOne.balanceOf(bob.address, 2);
		bobBalance.should.be.equal(1);
		let aliceNewTokenBalance = await token.balanceOf(alice.address);
		aliceNewTokenBalance.sub(aliceOldTokenBalance).should.be.equal(ethers.utils.parseEther('1'));
		let bobTokenBalance = await token.balanceOf(bob.address);
		bobTokenBalance.should.be.equal(ethers.utils.parseEther('10'));

		// Conduct the second token purchase.
		aliceOldTokenBalance = await token.balanceOf(alice.address);
		bobBalance = await itemOne.balanceOf(bob.address, itemGroupTwo.add(2));
		bobBalance.should.be.equal(0);
		await shop.connect(bob.signer).mintFromPool(0, 1, 1, 1);
		bobBalance = await itemOne.balanceOf(bob.address, itemGroupTwo.add(2));
		bobBalance.should.be.equal(1);
		aliceNewTokenBalance = await token.balanceOf(alice.address);
		aliceNewTokenBalance.sub(aliceOldTokenBalance).should.be.equal(ethers.utils.parseEther('10'));
		bobTokenBalance = await token.balanceOf(bob.address);
		bobTokenBalance.should.be.equal(ethers.utils.parseEther('0'));
	});

	// Verify correctness of the pool view function.
	it('should generate the correct pool view output', async () => {
		await shop.connect(alice.signer).ownershipClawback();
		shop = await ShopPlatformLaunchpad1155.connect(alice.signer).deploy(itemOne.address, platformFeeOwner.address, [ staker.address ], 4);
		await shop.deployed();
		await itemOne.connect(alice.signer).transferOwnership(shop.address);

		// Add the testing pools to the new Shop.
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await shop.connect(alice.signer).addPool({
			name: 'Test Pool',
			startBlock: currentBlockNumber,
			endBlock: currentBlockNumber + 100,
			purchaseLimit: 1,
			requirement: {
				requiredType: 0,
				requiredAsset: ethers.constants.AddressZero,
				requiredAmount: 0,
				whitelistId: 0
			}
		}, [ 0, 1 ], [ 10, 5 ], [
			[ {
				assetType: 1,
				asset: '0x0000000000000000000000000000000000000000',
				price: ethers.utils.parseEther('0.1')
			},
			{
				assetType: 2,
				asset: token.address,
				price: ethers.utils.parseEther('1')
			} ],
			[ {
				assetType: 1,
				asset: '0x0000000000000000000000000000000000000000',
				price: ethers.utils.parseEther('1')
			},
			{
				assetType: 2,
				asset: token.address,
				price: ethers.utils.parseEther('10')
			} ]
		]);

		// Get the first pool.
		let poolOne = (await shop.getPools([ 0 ]))[0];
		poolOne.name.should.be.equal('Test Pool');
		poolOne.startBlock.should.be.equal(currentBlockNumber);
		poolOne.endBlock.should.be.equal(currentBlockNumber + 100);
		poolOne.requirement.requiredType.should.be.equal(0);
		poolOne.requirement.requiredAsset.should.be.equal(ethers.constants.AddressZero);
		poolOne.requirement.requiredAmount.should.be.equal(0);
		poolOne.items[0].groupId.should.be.equal(0);
		poolOne.items[0].cap.should.be.equal(10);
		poolOne.items[0].minted.should.be.equal(0);
		poolOne.items[0].prices.length.should.be.equal(2);
		poolOne.items[0].prices[0].assetType.should.be.equal(1);
		poolOne.items[0].prices[0].asset.should.be.equal(ethers.constants.AddressZero);
		poolOne.items[0].prices[0].price.should.be.equal(ethers.utils.parseEther('0.1'));
		poolOne.items[0].prices[1].assetType.should.be.equal(2);
		poolOne.items[0].prices[1].asset.should.be.equal(token.address);
		poolOne.items[0].prices[1].price.should.be.equal(ethers.utils.parseEther('1'));
		poolOne.items[1].groupId.should.be.equal(1);
		poolOne.items[1].cap.should.be.equal(5);
		poolOne.items[1].minted.should.be.equal(0);
		poolOne.items[1].prices.length.should.be.equal(2);
		poolOne.items[1].prices[0].assetType.should.be.equal(1);
		poolOne.items[1].prices[0].asset.should.be.equal(ethers.constants.AddressZero);
		poolOne.items[1].prices[0].price.should.be.equal(ethers.utils.parseEther('1'));
		poolOne.items[1].prices[1].assetType.should.be.equal(2);
		poolOne.items[1].prices[1].asset.should.be.equal(token.address);
		poolOne.items[1].prices[1].price.should.be.equal(ethers.utils.parseEther('10'));
	});

	// Verify that the owner can specify whitelists which are respected.
	it('should respect whitelist requirements', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await shop.connect(alice.signer).addPool({
			name: 'Test Pool',
			startBlock: currentBlockNumber,
			endBlock: currentBlockNumber + 100,
			purchaseLimit: 1,
			requirement: {
				requiredType: 0,
				requiredAsset: ethers.constants.AddressZero,
				requiredAmount: 0,
				whitelistId: 1
			}
		}, [ 0 ], [ 10 ], [ [ {
			assetType: 2,
			asset: token.address,
			price: ethers.utils.parseEther('1')
		} ] ]);

		// The owner can specify a whitelist.
		await shop.connect(alice.signer).addWhitelist({
			addresses: [ carol.address ],
			expiryBlock: currentBlockNumber + 100,
			isActive: true
		});

		// Give Bob tokens.
		await token.connect(minter.signer).transfer(bob.address, ethers.utils.parseEther('1'));
		let bobTokenBalance = await token.balanceOf(bob.address);
		bobTokenBalance.should.be.equal(ethers.utils.parseEther('1'));

		// Give Carol tokens.
		await token.connect(minter.signer).transfer(carol.address, ethers.utils.parseEther('1'));
		let carolTokenBalance = await token.balanceOf(carol.address);
		carolTokenBalance.should.be.equal(ethers.utils.parseEther('1'));

		// Bob and Carol must approve the shop to spend their tokens.
		await token.connect(bob.signer).approve(shop.address, ethers.utils.parseEther('1'));
		await token.connect(carol.signer).approve(shop.address, ethers.utils.parseEther('1'));

		// Conduct a purchase with Carol.
		let carolBalance = await itemOne.balanceOf(carol.address, 1);
		carolBalance.should.be.equal(0);
		await shop.connect(carol.signer).mintFromPool(0, 0, 0, 1);
		carolBalance = await itemOne.balanceOf(carol.address, 1);
		carolBalance.should.be.equal(1);
		carolTokenBalance = await token.balanceOf(carol.address);
		carolTokenBalance.should.be.equal(0);

		// Bob should not be able to purchase an item without being whitelisted.
		await expect(
			shop.connect(bob.signer).mintFromPool(0, 0, 0, 1)
		).to.be.revertedWith(`You are not whitelisted on this pool.`);

		// The owner can add Bob to a whitelist.
		await shop.connect(alice.signer).addToWhitelist(1, [ bob.address ]);

		// Bob should now be able to purchase an item.
		let bobBalance = await itemOne.balanceOf(bob.address, 2);
		bobBalance.should.be.equal(0);
		await shop.connect(bob.signer).mintFromPool(0, 0, 0, 1);
		bobBalance = await itemOne.balanceOf(bob.address, 2);
		bobBalance.should.be.equal(1);
		bobTokenBalance = await token.balanceOf(bob.address);
		bobTokenBalance.should.be.equal(0);
	});

	// Verify that the owner can specify whitelists which properly expire.
	it('should respect whitelist expiration', async () => {
		const currentBlockNumber = await alice.provider.getBlockNumber();
		await shop.connect(alice.signer).addPool({
			name: 'Test Pool',
			startBlock: currentBlockNumber,
			endBlock: currentBlockNumber + 1000,
			purchaseLimit: 1,
			requirement: {
				requiredType: 0,
				requiredAsset: ethers.constants.AddressZero,
				requiredAmount: 0,
				whitelistId: 1
			}
		}, [ 0 ], [ 10 ], [ [ {
			assetType: 2,
			asset: token.address,
			price: ethers.utils.parseEther('1')
		} ] ]);

		// The owner can specify a whitelist.
		await shop.connect(alice.signer).addWhitelist({
			addresses: [ carol.address ],
			expiryBlock: currentBlockNumber + 100,
			isActive: true
		});

		// Give Bob tokens.
		await token.connect(minter.signer).transfer(bob.address, ethers.utils.parseEther('1'));
		let bobTokenBalance = await token.balanceOf(bob.address);
		bobTokenBalance.should.be.equal(ethers.utils.parseEther('1'));

		// Give Carol tokens.
		await token.connect(minter.signer).transfer(carol.address, ethers.utils.parseEther('1'));
		let carolTokenBalance = await token.balanceOf(carol.address);
		carolTokenBalance.should.be.equal(ethers.utils.parseEther('1'));

		// Bob and Carol must approve the shop to spend their tokens.
		await token.connect(bob.signer).approve(shop.address, ethers.utils.parseEther('1'));
		await token.connect(carol.signer).approve(shop.address, ethers.utils.parseEther('1'));

		// Conduct a purchase with Carol.
		let carolBalance = await itemOne.balanceOf(carol.address, 1);
		carolBalance.should.be.equal(0);
		await shop.connect(carol.signer).mintFromPool(0, 0, 0, 1);
		carolBalance = await itemOne.balanceOf(carol.address, 1);
		carolBalance.should.be.equal(1);
		carolTokenBalance = await token.balanceOf(carol.address);
		carolTokenBalance.should.be.equal(0);

		// Bob should not be able to purchase an item without being whitelisted.
		await expect(
			shop.connect(bob.signer).mintFromPool(0, 0, 0, 1)
		).to.be.revertedWith(`You are not whitelisted on this pool.`);

		// Mine until the whitelist limitation expires.
		for (let i = 0; i < 100; i++) {
			ethers.provider.send('evm_mine');
		}

		// Bob should now be able to purchase an item.
		let bobBalance = await itemOne.balanceOf(bob.address, 2);
		bobBalance.should.be.equal(0);
		await shop.connect(bob.signer).mintFromPool(0, 0, 0, 1);
		bobBalance = await itemOne.balanceOf(bob.address, 2);
		bobBalance.should.be.equal(1);
		bobTokenBalance = await token.balanceOf(bob.address);
		bobTokenBalance.should.be.equal(0);
	});
});
