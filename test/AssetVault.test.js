'use strict';

// Imports.
import { ethers } from 'hardhat';
import 'chai/register-should';

// Useful testing constants replicating the contract-level enum.
const AssetType = Object.freeze({
  Ether: 0,
  ERC20: 1,
  ERC721: 2,
  ERC1155: 3
});

// Test the multi-asset vault.
describe('AssetVault', function () {
	let alice, bob, carol, dev;
  let MultiSigWallet, Timelock, AssetVault;
	let Token, TestERC721, TestERC1155;
	before(async () => {
		const signers = await ethers.getSigners();
		const addresses = await Promise.all(signers.map(async signer => signer.getAddress()));
		alice = { provider: signers[0].provider, signer: signers[0], address: addresses[0] };
		bob = { provider: signers[1].provider, signer: signers[1], address: addresses[1] };
		carol = { provider: signers[2].provider, signer: signers[2], address: addresses[2] };
		dev = { provider: signers[3].provider, signer: signers[3], address: addresses[3] };

		// Create factories for deploying all required contracts using specified signers.
		MultiSigWallet = await ethers.getContractFactory('MultiSigWallet');
		Timelock = await ethers.getContractFactory('Timelock');
		AssetVault = await ethers.getContractFactory('AssetVault');
    Token = await ethers.getContractFactory('Token');
    TestERC721 = await ethers.getContractFactory('TestERC721');
    TestERC1155 = await ethers.getContractFactory('TestERC1155');
	});

	// Deploy a fresh set of smart contracts for testing with.
  let multiSig, timelock, assetVault;
	let token, test721, secondTest721, test1155, secondTest1155;
	beforeEach(async () => {

    // Deploy a 2-out-of-3 multisig containing Alice, Bob, and Carol.
    multiSig = await MultiSigWallet.connect(dev.signer).deploy(
      [ alice.address, bob.address, carol.address ],
      2
    );
		await multiSig.deployed();

    // Deploy a 24-hour timelock to guard multisig transactions.
    timelock = await Timelock.connect(dev.signer).deploy(
      multiSig.address,
      '86400'
    );
		await timelock.deployed();

    // Deploy an asset vault.
		assetVault = await AssetVault.connect(dev.signer).deploy(
      'Vault One',
      dev.address, // panic owner
      dev.address, // panic destination
      3,
      '0x000000000000000000000000000000000000DEAD' // backup burn
    );
		await assetVault.deployed();

    // Deploy a mintable testing ERC-20 token with a supply cap of one billion.
    token = await Token.connect(dev.signer).deploy(
      'Token',
      'TOK',
      ethers.utils.parseEther('1000000000')
    );
		await token.deployed();

    // Deploy a mintable testing ERC-721 token.
    test721 = await TestERC721.connect(dev.signer).deploy();
    secondTest721 = await TestERC721.connect(dev.signer).deploy();

    // Deploy a mintable testing ERC-1155 token.
    test1155 = await TestERC1155.connect(dev.signer).deploy();
    secondTest1155 = await TestERC1155.connect(dev.signer).deploy();
	});

  // Test the multi-asset vault directly.
  describe('testing the asset vault', function () {

    /**
      Encapsulate all non-multisig asset sends tests into a repeatable function.
    */
    function testSends () {

      // The vault should be able to send Ether.
      it('vault owner can send Ether', async () => {
        let vaultBalance = await dev.provider.getBalance(assetVault.address);

        // Send Ether from the vault.
        await assetVault.connect(dev.signer).sendTokens(
          [ dev.address ],
          [ ethers.constants.AddressZero ],
          [
            {
              assetType: AssetType.Ether,
              amounts: [ ethers.utils.parseEther('10') ],
              ids: [ 0 ]
            }
          ]
        );

        // Confirm Ether was properly received.
        let newVaultBalance = await dev.provider.getBalance(assetVault.address);
        vaultBalance.sub(newVaultBalance).should.be.equal(
          ethers.utils.parseEther('10')
        );
      });

      // The vault should be able to send ERC-20 tokens.
      it('vault owner can send ERC-20 tokens', async () => {
        let vaultBalance = await token.balanceOf(assetVault.address);
        let devBalance = await token.balanceOf(dev.address);
        devBalance.should.be.equal(0);

        // Send tokens from the vault.
        await assetVault.connect(dev.signer).sendTokens(
          [ dev.address ],
          [ token.address ],
          [
            {
              assetType: AssetType.ERC20,
              amounts: [ ethers.utils.parseEther('100') ],
              ids: [ 0 ]
            }
          ]
        );

        // Confirm that tokens were properly received.
        let newVaultBalance = await token.balanceOf(assetVault.address);
        devBalance = await token.balanceOf(dev.address);
        devBalance.should.be.equal(ethers.utils.parseEther('100'));
        vaultBalance.sub(newVaultBalance).should.be.equal(
          ethers.utils.parseEther('100')
        );
      });

      // The vault should be able to send an ERC-721 token.
      it('vault owner can send an ERC-721 token', async () => {
        let vaultBalance = await test721.balanceOf(assetVault.address);
        vaultBalance.should.be.equal(3);
        let aliceBalance = await test721.balanceOf(alice.address);
        aliceBalance.should.be.equal(0);
        let bobBalance = await test721.balanceOf(bob.address);
        bobBalance.should.be.equal(0);
        let carolBalance = await test721.balanceOf(carol.address);
        carolBalance.should.be.equal(0);
        let devBalance = await test721.balanceOf(dev.address);
        devBalance.should.be.equal(0);

        // Send tokens from the vault.
        await assetVault.connect(dev.signer).sendTokens(
          [ alice.address ],
          [ test721.address ],
          [
            {
              assetType: AssetType.ERC721,
              amounts: [ 1 ],
              ids: [ 2 ]
            }
          ]
        );

        // Confirm that tokens were properly received.
        vaultBalance = await test721.balanceOf(assetVault.address);
        vaultBalance.should.be.equal(2);
        aliceBalance = await test721.balanceOf(alice.address);
        aliceBalance.should.be.equal(1);
        let twoOwner = await test721.ownerOf(2);
        twoOwner.should.be.equal(alice.address);

        bobBalance = await test721.balanceOf(bob.address);
        bobBalance.should.be.equal(0);

        carolBalance = await test721.balanceOf(carol.address);
        carolBalance.should.be.equal(0);

        devBalance = await test721.balanceOf(dev.address);
        devBalance.should.be.equal(0);
      });

      // The vault should be able to send multiple ERC-721 tokens.
      it('vault owner can send multiple ERC-721 tokens', async () => {
        let vaultBalance = await test721.balanceOf(assetVault.address);
        vaultBalance.should.be.equal(3);
        let aliceBalance = await test721.balanceOf(alice.address);
        aliceBalance.should.be.equal(0);
        let bobBalance = await test721.balanceOf(bob.address);
        bobBalance.should.be.equal(0);
        let carolBalance = await test721.balanceOf(carol.address);
        carolBalance.should.be.equal(0);
        let devBalance = await test721.balanceOf(dev.address);
        devBalance.should.be.equal(0);

        // Send tokens from the vault.
        await assetVault.connect(dev.signer).sendTokens(
          [ alice.address, bob.address ],
          [ test721.address, test721.address ],
          [
            {
              assetType: AssetType.ERC721,
              amounts: [ 1 ],
              ids: [ 2 ]
            },
            {
              assetType: AssetType.ERC721,
              amounts: [ 1, 1 ],
              ids: [ 1, 3 ]
            }
          ]
        );

        // Confirm that tokens were properly received.
        vaultBalance = await test721.balanceOf(assetVault.address);
        vaultBalance.should.be.equal(0);
        aliceBalance = await test721.balanceOf(alice.address);
        aliceBalance.should.be.equal(1);
        let twoOwner = await test721.ownerOf(2);
        twoOwner.should.be.equal(alice.address);

        bobBalance = await test721.balanceOf(bob.address);
        bobBalance.should.be.equal(2);
        let oneOwner = await test721.ownerOf(1);
        oneOwner.should.be.equal(bob.address);
        let threeOwner = await test721.ownerOf(3);
        threeOwner.should.be.equal(bob.address);

        carolBalance = await test721.balanceOf(carol.address);
        carolBalance.should.be.equal(0);

        devBalance = await test721.balanceOf(dev.address);
        devBalance.should.be.equal(0);
      });

      // The vault should be able to send multiple, different ERC-721 tokens.
      it('vault owner can send multiple different ERC-721 tokens', async () => {
        let vaultBalance = await test721.balanceOf(assetVault.address);
        vaultBalance.should.be.equal(3);
        let aliceBalance = await test721.balanceOf(alice.address);
        aliceBalance.should.be.equal(0);
        let bobBalance = await test721.balanceOf(bob.address);
        bobBalance.should.be.equal(0);
        let carolBalance = await test721.balanceOf(carol.address);
        carolBalance.should.be.equal(0);
        let devBalance = await test721.balanceOf(dev.address);
        devBalance.should.be.equal(0);

        vaultBalance = await secondTest721.balanceOf(assetVault.address);
        vaultBalance.should.be.equal(3);
        aliceBalance = await secondTest721.balanceOf(alice.address);
        aliceBalance.should.be.equal(0);
        bobBalance = await secondTest721.balanceOf(bob.address);
        bobBalance.should.be.equal(0);
        carolBalance = await secondTest721.balanceOf(carol.address);
        carolBalance.should.be.equal(0);
        devBalance = await secondTest721.balanceOf(dev.address);
        devBalance.should.be.equal(0);

        // Send tokens from the vault.
        await assetVault.connect(dev.signer).sendTokens(
          [ alice.address, bob.address, alice.address, carol.address ],
          [
            test721.address,
            test721.address,
            secondTest721.address,
            secondTest721.address
          ],
          [
            {
              assetType: AssetType.ERC721,
              amounts: [ 1 ],
              ids: [ 2 ]
            },
            {
              assetType: AssetType.ERC721,
              amounts: [ 1, 1 ],
              ids: [ 1, 3 ]
            },
            {
              assetType: AssetType.ERC721,
              amounts: [ 1 ],
              ids: [ 2 ]
            },
            {
              assetType: AssetType.ERC721,
              amounts: [ 1, 1 ],
              ids: [ 1, 3 ]
            }
          ]
        );

        // Confirm that tokens were properly received.
        vaultBalance = await test721.balanceOf(assetVault.address);
        vaultBalance.should.be.equal(0);
        aliceBalance = await test721.balanceOf(alice.address);
        aliceBalance.should.be.equal(1);
        let twoOwner = await test721.ownerOf(2);
        twoOwner.should.be.equal(alice.address);

        bobBalance = await test721.balanceOf(bob.address);
        bobBalance.should.be.equal(2);
        let oneOwner = await test721.ownerOf(1);
        oneOwner.should.be.equal(bob.address);
        let threeOwner = await test721.ownerOf(3);
        threeOwner.should.be.equal(bob.address);

        carolBalance = await test721.balanceOf(carol.address);
        carolBalance.should.be.equal(0);

        devBalance = await test721.balanceOf(dev.address);
        devBalance.should.be.equal(0);

        vaultBalance = await secondTest721.balanceOf(assetVault.address);
        vaultBalance.should.be.equal(0);
        aliceBalance = await secondTest721.balanceOf(alice.address);
        aliceBalance.should.be.equal(1);
        twoOwner = await secondTest721.ownerOf(2);
        twoOwner.should.be.equal(alice.address);

        bobBalance = await secondTest721.balanceOf(bob.address);
        bobBalance.should.be.equal(0);

        carolBalance = await secondTest721.balanceOf(carol.address);
        carolBalance.should.be.equal(2);
        oneOwner = await secondTest721.ownerOf(1);
        oneOwner.should.be.equal(carol.address);
        threeOwner = await secondTest721.ownerOf(3);
        threeOwner.should.be.equal(carol.address);

        devBalance = await secondTest721.balanceOf(dev.address);
        devBalance.should.be.equal(0);
      });

      // The vault should be able to send an ERC-1155 token.
      it('vault owner can send an ERC-1155 token', async () => {
        let vaultBalance = await test1155.balanceOf(assetVault.address, 3);
        vaultBalance.should.be.equal(3);
        vaultBalance = await test1155.balanceOf(assetVault.address, 2);
        vaultBalance.should.be.equal(2);
        vaultBalance = await test1155.balanceOf(assetVault.address, 1);
        vaultBalance.should.be.equal(1);

        // Send tokens from the vault.
        await assetVault.connect(dev.signer).sendTokens(
          [ alice.address ],
          [ test1155.address ],
          [
            {
              assetType: AssetType.ERC1155,
              amounts: [ 1 ],
              ids: [ 1 ]
            }
          ]
        );

        // Confirm that tokens were properly received.
        vaultBalance = await test1155.balanceOf(assetVault.address, 3);
        vaultBalance.should.be.equal(3);
        vaultBalance = await test1155.balanceOf(assetVault.address, 2);
        vaultBalance.should.be.equal(2);
        vaultBalance = await test1155.balanceOf(assetVault.address, 1);
        vaultBalance.should.be.equal(0);

        let aliceBalance = await test1155.balanceOf(alice.address, 1);
        aliceBalance.should.be.equal(1);
      });

      // The vault should be able to send multiple ERC-1155 tokens.
      it('vault owner can send multiple ERC-1155 tokens', async () => {
        let vaultBalance = await test1155.balanceOf(assetVault.address, 3);
        vaultBalance.should.be.equal(3);
        vaultBalance = await test1155.balanceOf(assetVault.address, 2);
        vaultBalance.should.be.equal(2);
        vaultBalance = await test1155.balanceOf(assetVault.address, 1);
        vaultBalance.should.be.equal(1);

        // Send tokens from the vault.
        await assetVault.connect(dev.signer).sendTokens(
          [ alice.address, bob.address ],
          [ test1155.address, test1155.address ],
          [
            {
              assetType: AssetType.ERC1155,
              amounts: [ 1 ],
              ids: [ 1 ]
            },
            {
              assetType: AssetType.ERC1155,
              amounts: [ 2 ],
              ids: [ 3 ]
            }
          ]
        );

        // Confirm that tokens were properly received.
        vaultBalance = await test1155.balanceOf(assetVault.address, 3);
        vaultBalance.should.be.equal(1);
        vaultBalance = await test1155.balanceOf(assetVault.address, 2);
        vaultBalance.should.be.equal(2);
        vaultBalance = await test1155.balanceOf(assetVault.address, 1);
        vaultBalance.should.be.equal(0);

        let aliceBalance = await test1155.balanceOf(alice.address, 1);
        aliceBalance.should.be.equal(1);
        let bobBalance = await test1155.balanceOf(bob.address, 3);
        bobBalance.should.be.equal(2);
      });

      // The vault should be able to send multiple, different ERC-1155 tokens.
      it('vault owner can send multiple different ERC-1155 tokens', async () => {
        let vaultBalance = await test1155.balanceOf(assetVault.address, 3);
        vaultBalance.should.be.equal(3);
        vaultBalance = await test1155.balanceOf(assetVault.address, 2);
        vaultBalance.should.be.equal(2);
        vaultBalance = await test1155.balanceOf(assetVault.address, 1);
        vaultBalance.should.be.equal(1);

        vaultBalance = await secondTest1155.balanceOf(assetVault.address, 3);
        vaultBalance.should.be.equal(3);
        vaultBalance = await secondTest1155.balanceOf(assetVault.address, 2);
        vaultBalance.should.be.equal(2);
        vaultBalance = await secondTest1155.balanceOf(assetVault.address, 1);
        vaultBalance.should.be.equal(1);

        // Send tokens from the vault.
        await assetVault.connect(dev.signer).sendTokens(
          [ alice.address, bob.address, alice.address, carol.address ],
          [
            test1155.address,
            test1155.address,
            secondTest1155.address,
            secondTest1155.address
          ],
          [
            {
              assetType: AssetType.ERC1155,
              amounts: [ 1 ],
              ids: [ 2 ]
            },
            {
              assetType: AssetType.ERC1155,
              amounts: [ 1, 1 ],
              ids: [ 1, 3 ]
            },
            {
              assetType: AssetType.ERC1155,
              amounts: [ 1 ],
              ids: [ 2 ]
            },
            {
              assetType: AssetType.ERC1155,
              amounts: [ 1, 1 ],
              ids: [ 1, 3 ]
            }
          ]
        );

        // Confirm that tokens were properly received.
        vaultBalance = await test1155.balanceOf(assetVault.address, 3);
        vaultBalance.should.be.equal(2);
        vaultBalance = await test1155.balanceOf(assetVault.address, 2);
        vaultBalance.should.be.equal(1);
        vaultBalance = await test1155.balanceOf(assetVault.address, 1);
        vaultBalance.should.be.equal(0);
        vaultBalance = await secondTest1155.balanceOf(assetVault.address, 3);
        vaultBalance.should.be.equal(2);
        vaultBalance = await secondTest1155.balanceOf(assetVault.address, 2);
        vaultBalance.should.be.equal(1);
        vaultBalance = await secondTest1155.balanceOf(assetVault.address, 1);
        vaultBalance.should.be.equal(0);
      });
    }

    /**
      Encapsulate all non-multisig panic tests into a repeatable function.
    */
    function testPanic () {

      // Test panic withdrawal.
      it('panic owner can trigger a panic withdrawal', async () => {
        await assetVault.connect(dev.signer).panic();

        // Confirm Ether was properly received.
        let vaultBalance = await dev.provider.getBalance(assetVault.address);
        vaultBalance.should.be.equal(0);

        // Confirm ERC-20 was properly received.
        vaultBalance = await token.balanceOf(assetVault.address);
        vaultBalance.should.be.equal(0);
        let devBalance = await token.balanceOf(dev.address);
        devBalance.should.be.equal(ethers.utils.parseEther('1000000000'));

        // Confirm ERC-721 was properly received.
        vaultBalance = await test721.balanceOf(assetVault.address);
        vaultBalance.should.be.equal(0);
        devBalance = await test721.balanceOf(dev.address);
        devBalance.should.be.equal(3);
        vaultBalance = await secondTest721.balanceOf(assetVault.address);
        vaultBalance.should.be.equal(0);
        devBalance = await secondTest721.balanceOf(dev.address);
        devBalance.should.be.equal(3);

        // Confirm ERC-1155 was properly received.
        vaultBalance = await test1155.balanceOf(assetVault.address, 3);
        vaultBalance.should.be.equal(0);
        devBalance = await test1155.balanceOf(dev.address, 3);
        devBalance.should.be.equal(3);
        vaultBalance = await test1155.balanceOf(assetVault.address, 2);
        vaultBalance.should.be.equal(0);
        devBalance = await test1155.balanceOf(dev.address, 2);
        devBalance.should.be.equal(2);
        vaultBalance = await test1155.balanceOf(assetVault.address, 1);
        vaultBalance.should.be.equal(0);
        devBalance = await test1155.balanceOf(dev.address, 1);
        devBalance.should.be.equal(1);
        vaultBalance = await secondTest1155.balanceOf(assetVault.address, 3);
        vaultBalance.should.be.equal(0);
        devBalance = await secondTest1155.balanceOf(dev.address, 3);
        devBalance.should.be.equal(3);
        vaultBalance = await secondTest1155.balanceOf(assetVault.address, 2);
        vaultBalance.should.be.equal(0);
        devBalance = await secondTest1155.balanceOf(dev.address, 2);
        devBalance.should.be.equal(2);
        vaultBalance = await secondTest1155.balanceOf(assetVault.address, 1);
        vaultBalance.should.be.equal(0);
        devBalance = await secondTest1155.balanceOf(dev.address, 1);
        devBalance.should.be.equal(1);
      });

      // Test sending some assets before panic withdrawal.
      it('panic after send works as expected', async () => {
        await assetVault.connect(dev.signer).sendTokens(
          [
            alice.address,
            alice.address,
            alice.address,
            alice.address,
            alice.address
          ],
          [
            token.address,
            test721.address,
            secondTest721.address,
            test1155.address,
            secondTest1155.address
          ],
          [
            {
              assetType: AssetType.ERC20,
              amounts: [ ethers.utils.parseEther('1') ],
              ids: [ 0 ]
            },
            {
              assetType: AssetType.ERC721,
              amounts: [ 1 ],
              ids: [ 1 ]
            },
            {
              assetType: AssetType.ERC721,
              amounts: [ 1 ],
              ids: [ 1 ]
            },
            {
              assetType: AssetType.ERC1155,
              amounts: [ 1 ],
              ids: [ 3 ]
            },
            {
              assetType: AssetType.ERC1155,
              amounts: [ 1, 1 ],
              ids: [ 2, 3 ]
            }
          ]
        );

        // Panic the vault.
        await assetVault.connect(dev.signer).panic();

        // Confirm Ether was properly received.
        let vaultBalance = await dev.provider.getBalance(assetVault.address);
        vaultBalance.should.be.equal(0);

        // Confirm ERC-20 was properly received.
        vaultBalance = await token.balanceOf(assetVault.address);
        vaultBalance.should.be.equal(0);
        let devBalance = await token.balanceOf(dev.address);
        devBalance.should.be.equal(ethers.utils.parseEther('999999999'));

        // Confirm ERC-721 was properly received.
        vaultBalance = await test721.balanceOf(assetVault.address);
        vaultBalance.should.be.equal(0);
        devBalance = await test721.balanceOf(dev.address);
        devBalance.should.be.equal(2);
        vaultBalance = await secondTest721.balanceOf(assetVault.address);
        vaultBalance.should.be.equal(0);
        devBalance = await secondTest721.balanceOf(dev.address);
        devBalance.should.be.equal(2);

        // Confirm ERC-1155 was properly received.
        vaultBalance = await test1155.balanceOf(assetVault.address, 3);
        vaultBalance.should.be.equal(0);
        devBalance = await test1155.balanceOf(dev.address, 3);
        devBalance.should.be.equal(2);
        vaultBalance = await test1155.balanceOf(assetVault.address, 2);
        vaultBalance.should.be.equal(0);
        devBalance = await test1155.balanceOf(dev.address, 2);
        devBalance.should.be.equal(2);
        vaultBalance = await test1155.balanceOf(assetVault.address, 1);
        vaultBalance.should.be.equal(0);
        devBalance = await test1155.balanceOf(dev.address, 1);
        devBalance.should.be.equal(1);
        vaultBalance = await secondTest1155.balanceOf(assetVault.address, 3);
        vaultBalance.should.be.equal(0);
        devBalance = await secondTest1155.balanceOf(dev.address, 3);
        devBalance.should.be.equal(2);
        vaultBalance = await secondTest1155.balanceOf(assetVault.address, 2);
        vaultBalance.should.be.equal(0);
        devBalance = await secondTest1155.balanceOf(dev.address, 2);
        devBalance.should.be.equal(1);
        vaultBalance = await secondTest1155.balanceOf(assetVault.address, 1);
        vaultBalance.should.be.equal(0);
        devBalance = await secondTest1155.balanceOf(dev.address, 1);
        devBalance.should.be.equal(1);
      });
    }

    // Test direct asset transfer.
    describe('with direct asset transfers', function () {

      // Send assets to the vault.
      beforeEach(async () => {

        // Send Ether to the vault.
        await alice.signer.sendTransaction({
          to: assetVault.address,
          value: ethers.utils.parseEther('20')
        });

        // Mint the testing ERC-20 token directly to the vault.
        await token.connect(dev.signer).mint(
          assetVault.address,
          ethers.utils.parseEther('1000000000')
        );

        // Mint testing ERC-721 tokens directly to the vault.
        await test721.connect(dev.signer).mint(assetVault.address, 1);
        await test721.connect(dev.signer).mint(assetVault.address, 2);
        await test721.connect(dev.signer).mint(assetVault.address, 3);
        await secondTest721.connect(dev.signer).mint(assetVault.address, 1);
        await secondTest721.connect(dev.signer).mint(assetVault.address, 2);
        await secondTest721.connect(dev.signer).mint(assetVault.address, 3);

        // Mint testing ERC-1155 tokens directly to the vault.
        await test1155.connect(dev.signer).mint(assetVault.address, 1, 1, []);
        await test1155.connect(dev.signer).mint(assetVault.address, 2, 2, []);
        await test1155.connect(dev.signer).mint(assetVault.address, 3, 3, []);
        await secondTest1155.connect(dev.signer).mint(
          assetVault.address,
          1,
          1,
          []
        );
        await secondTest1155.connect(dev.signer).mint(
          assetVault.address,
          2,
          2,
          []
        );
        await secondTest1155.connect(dev.signer).mint(
          assetVault.address,
          3,
          3,
          []
        );

        // Configure the assets that had been directly received.
        await assetVault.connect(dev.signer).configure(
          [
            token.address,
            test721.address,
            secondTest721.address,
            test1155.address,
            secondTest1155.address
          ],
          [
            {
              assetType: AssetType.ERC20,
              amounts: [ ethers.utils.parseEther('1000000000') ],
              ids: [ 0 ]
            },
            {
              assetType: AssetType.ERC721,
              amounts: [ 1, 1, 1 ],
              ids: [ 1, 2, 3 ]
            },
            {
              assetType: AssetType.ERC721,
              amounts: [ 1, 1, 1 ],
              ids: [ 1, 2, 3 ]
            },
            {
              assetType: AssetType.ERC1155,
              amounts: [ 1, 2, 3 ],
              ids: [ 1, 2, 3 ]
            },
            {
              assetType: AssetType.ERC1155,
              amounts: [ 1, 2, 3 ],
              ids: [ 1, 2, 3 ]
            }
          ]
        );
      });

      // Test all vault sends.
      testSends();

      // Test vault panic.
      testPanic();
    });

    // Test with asset deposits.
    describe('with asset deposits', function () {

      // Deposit assets in the vault.
      beforeEach(async () => {

        // Mint the testing ERC-20 token directly to Alice.
        await token.connect(dev.signer).mint(
          alice.address,
          ethers.utils.parseEther('1000000000')
        );

        // Mint testing ERC-721 tokens directly to Alice.
        await test721.connect(dev.signer).mint(alice.address, 1);
        await test721.connect(dev.signer).mint(alice.address, 2);
        await test721.connect(dev.signer).mint(alice.address, 3);
        await secondTest721.connect(dev.signer).mint(alice.address, 1);
        await secondTest721.connect(dev.signer).mint(alice.address, 2);
        await secondTest721.connect(dev.signer).mint(alice.address, 3);

        // Mint testing ERC-1155 tokens directly to the vault.
        await test1155.connect(dev.signer).mint(alice.address, 1, 1, []);
        await test1155.connect(dev.signer).mint(alice.address, 2, 2, []);
        await test1155.connect(dev.signer).mint(alice.address, 3, 3, []);
        await secondTest1155.connect(dev.signer).mint(
          alice.address,
          1,
          1,
          []
        );
        await secondTest1155.connect(dev.signer).mint(
          alice.address,
          2,
          2,
          []
        );
        await secondTest1155.connect(dev.signer).mint(
          alice.address,
          3,
          3,
          []
        );

        // Alice must set the vault as an approved spender.

        // Have Alice deposit all assets in the vault.
        await assetVault.connect(alice.signer).deposit(
          [
            token.address,
            test721.address,
            secondTest721.address,
            test1155.address,
            secondTest1155.address
          ],
          [
            {
              assetType: AssetType.ERC20,
              amounts: [ ethers.utils.parseEther('1000000000') ],
              ids: [ 0 ]
            },
            {
              assetType: AssetType.ERC721,
              amounts: [ 1, 1, 1 ],
              ids: [ 1, 2, 3 ]
            },
            {
              assetType: AssetType.ERC721,
              amounts: [ 1, 1, 1 ],
              ids: [ 1, 2, 3 ]
            },
            {
              assetType: AssetType.ERC1155,
              amounts: [ 1, 2, 3 ],
              ids: [ 1, 2, 3 ]
            },
            {
              assetType: AssetType.ERC1155,
              amounts: [ 1, 2, 3 ],
              ids: [ 1, 2, 3 ]
            }
          ],
          {
            value: ethers.utils.parseEther('20')
          }
        );
      });

      // Test all vault sends.
      testSends();

      // Test vault panic.
      testPanic();
    });

    // Test the vault in a multisig configuration.
    describe('with multisig', function () {

      // Transfer control of the multi-asset vault to the multisig timelock.
      beforeEach(async () => {
        await assetVault.connect(alice.signer).transferOwnership(
          timelock.address
        );
      });

      // Verify that the multisignature wallet can send tokens from the vault.
      // it('should allow the multisig to send tokens via timelock', async () => {
      //   let devBalance = await token.balanceOf(dev.address);
      //   devBalance.should.be.equal(0);
      //
      //   // Generate the raw transaction for releasing tokens from the vault.
      //   let releaseTokenTransaction = await assetVault.populateTransaction
      //     .sendTokens(
      //       [ dev.address ],
      //       [ token.address ],
      //       [
      //         {
      //           assetType: AssetType.ERC20,
      //           amounts: [ ethers.utils.parseEther('100') ],
      //           ids: [ 0 ]
      //         }
      //       ]
      //     );
      //
      //   // Generate the raw transaction for enqueuing token release with the time lock.
      //   let enqueueTransaction = await timelock.populateTransaction.queueTransaction(assetVault.address, ethers.utils.parseEther('0'), '', releaseTokenTransaction.data, Math.floor(Date.now() / 1000) + 180000);
      //
      //   // Generate the raw transaction for executing token release with the time lock.
      //   let executeTransaction = await timelock.populateTransaction.executeTransaction(assetVault.address, ethers.utils.parseEther('0'), '', releaseTokenTransaction.data, Math.floor(Date.now() / 1000) + 180000);
      //
      //   // Submit the token release transaction with the first multisigner.
      //   await multiSig.connect(alice.signer).submitTransaction(timelock.address, ethers.utils.parseEther('0'), enqueueTransaction.data);
      //   let transactionData = await multiSig.transactions(0);
      //   transactionData.destination.should.be.equal(timelock.address);
      //   transactionData.value.should.be.equal(ethers.utils.parseEther('0'));
      //   transactionData.data.should.be.equal(enqueueTransaction.data);
      //   transactionData.executed.should.be.equal(false);
      //   let aliceConfirmation = await multiSig.confirmations(0, alice.address);
      //   aliceConfirmation.should.be.equal(true);
      //
      //   // Confirm the token release transaction with the second multisigner.
      //   let confirmationTransaction = await multiSig.connect(bob.signer).confirmTransaction(0);
      //   let confirmationReceipt = await confirmationTransaction.wait();
      //   let executionEvent = confirmationReceipt.events[confirmationReceipt.events.length - 1];
      //   executionEvent.event.should.be.equal('Execution');
      //   transactionData = await multiSig.transactions(0);
      //   transactionData.destination.should.be.equal(timelock.address);
      //   transactionData.value.should.be.equal(ethers.utils.parseEther('0'));
      //   transactionData.data.should.be.equal(enqueueTransaction.data);
      //   transactionData.executed.should.be.equal(true);
      //   let bobConfirmation = await multiSig.confirmations(0, bob.address);
      //   bobConfirmation.should.be.equal(true);
      //
      //   // Confirm that the tokens have not been sent yet.
      //   devBalance = await token.balanceOf(dev.address);
      //   devBalance.should.be.equal(0);
      //
      //   // Submit the token release execution transaction with the first multisigner.
      //   await multiSig.connect(alice.signer).submitTransaction(timelock.address, ethers.utils.parseEther('0'), executeTransaction.data);
      //   transactionData = await multiSig.transactions(1);
      //   transactionData.destination.should.be.equal(timelock.address);
      //   transactionData.value.should.be.equal(ethers.utils.parseEther('0'));
      //   transactionData.data.should.be.equal(executeTransaction.data);
      //   transactionData.executed.should.be.equal(false);
      //   aliceConfirmation = await multiSig.confirmations(1, alice.address);
      //   aliceConfirmation.should.be.equal(true);
      //
      //   // Confirm that the time lock may not be executed prematurely.
      //   confirmationTransaction = await multiSig.connect(bob.signer).confirmTransaction(1);
      //   confirmationReceipt = await confirmationTransaction.wait();
      //   executionEvent = confirmationReceipt.events[confirmationReceipt.events.length - 1];
      //   executionEvent.event.should.be.equal('ExecutionFailure');
      //   transactionData = await multiSig.transactions(1);
      //   transactionData.destination.should.be.equal(timelock.address);
      //   transactionData.value.should.be.equal(ethers.utils.parseEther('0'));
      //   transactionData.data.should.be.equal(executeTransaction.data);
      //   transactionData.executed.should.be.equal(false);
      //   bobConfirmation = await multiSig.confirmations(1, bob.address);
      //   bobConfirmation.should.be.equal(true);
      //
      //   // Wait for the time lock to mature.
      //   ethers.provider.send('evm_increaseTime', [ 190000 ]);
      //
      //   // Reset the second multisig holder's confirmation.
      //   await multiSig.connect(bob.signer).revokeConfirmation(1);
      //
      //   // Confirm that the time lock may now be executed.
      //   confirmationTransaction = await multiSig.connect(bob.signer).confirmTransaction(1);
      //   confirmationReceipt = await confirmationTransaction.wait();
      //   executionEvent = confirmationReceipt.events[confirmationReceipt.events.length - 1];
      //   executionEvent.event.should.be.equal('Execution');
      //   transactionData = await multiSig.transactions(1);
      //   transactionData.destination.should.be.equal(timelock.address);
      //   transactionData.value.should.be.equal(ethers.utils.parseEther('0'));
      //   transactionData.data.should.be.equal(executeTransaction.data);
      //   transactionData.executed.should.be.equal(true);
      //   bobConfirmation = await multiSig.confirmations(1, bob.address);
      //   bobConfirmation.should.be.equal(true);
      //
      //   // Confirm that the tokens have been sent.
      //   devBalance = await token.balanceOf(dev.address);
      //   devBalance.should.be.equal(ethers.utils.parseEther('100'));
      // });
    });
  });
});
