'use strict';

// Imports.
import { ethers } from 'hardhat';
import 'chai/register-should';

// Test the SharedSuper item contracts.
describe('SharedSuper', function () {
	let alice, bob, carol, dev;
	let Super1155, Super1155Helper, SuperShared1155;
	before(async () => {
		const signers = await ethers.getSigners();
		const addresses = await Promise.all(signers.map(async signer => signer.getAddress()));
		alice = { provider: signers[0].provider, signer: signers[0], address: addresses[0] };
		bob = { provider: signers[1].provider, signer: signers[1], address: addresses[1] };
		carol = { provider: signers[2].provider, signer: signers[2], address: addresses[2] };
		dev = { provider: signers[3].provider, signer: signers[3], address: addresses[3] };

		// Create factories for deploying all required contracts using specified signers.
		Super1155 = await ethers.getContractFactory('Super1155');
		Super1155Helper = await ethers.getContractFactory('Super1155Helper');
		SuperShared1155 = await ethers.getContractFactory('SuperShared1155');
	});

	// Deploy a fresh set of smart contracts for testing with.
	let item1155, helper1155, sharedManager1155;
	beforeEach(async () => {
    const COLLECTION_NAME = 'Test1155';
    const COLLECTION_URI = 'sample-uri';
    const PROXY_REGISTRY_ADDRESS = ethers.constants.AddressZero;
    item1155 = await Super1155.connect(dev.signer).deploy(
      alice.address,
      COLLECTION_NAME,
      COLLECTION_URI,
      PROXY_REGISTRY_ADDRESS
    );
    await item1155.deployed();
		helper1155 = await Super1155Helper.connect(dev.signer).deploy();
		await helper1155.deployed();
    sharedManager1155 = await SuperShared1155.connect(dev.signer).deploy(
      alice.address,
      'TestShared1155',
      helper1155.address,
      COLLECTION_NAME,
      COLLECTION_URI,
      PROXY_REGISTRY_ADDRESS
    );
    await sharedManager1155.deployed();
	});

  // Verify that the version number is up-to-date.
  it('should be testing with the correct version', async () => {
    let version = await sharedManager1155.connect(alice.signer).version();
    version.should.be.equal(1);
  });

	// Verify that a shared contract can support item creation.
	it('should allow callers to create items', async () => {
	});
});
