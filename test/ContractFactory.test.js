'use strict';

// Imports.
import { ethers } from 'hardhat';
import { expect, should } from 'chai';
should();

// Test the contract factory.
describe('ContractFactory', function () {
	let alice, bob, carol, dev;
	let ContractFactory;
	before(async () => {
		const signers = await ethers.getSigners();
		const addresses = await Promise.all(signers.map(async signer => signer.getAddress()));
		alice = { provider: signers[0].provider, signer: signers[0], address: addresses[0] };
		bob = { provider: signers[1].provider, signer: signers[1], address: addresses[1] };
		carol = { provider: signers[2].provider, signer: signers[2], address: addresses[2] };
		dev = { provider: signers[3].provider, signer: signers[3], address: addresses[3] };

		// Create factories for deploying all required contracts using signers.
		ContractFactory = await ethers.getContractFactory('ContractFactory');
	});

	// Deploy a fresh set of smart contracts for testing with.
	let contractFactory;
	beforeEach(async () => {

		// Deploy a contract factory.
		contractFactory = await ContractFactory.connect(dev.signer).deploy();
	});

	// Test that the contract factory functions as anticipated.
	describe('testing the contract factory', function () {
		it('contract deployment produces addresses as expected', async () => {
			const salt = `${alice.address}000000000000000000000001`;
			const bytecode = '0x6080604052600160005534801561001557600080fd5b5060405161022f38038061022f8339810160408190526100349161003c565b600155610055565b60006020828403121561004e57600080fd5b5051919050565b6101cb806100646000396000f3fe608060405234801561001057600080fd5b50600436106100575760003560e01c8063199ffe991461005c5780633fa4f2451461008e57806354fd4d501461009757806359275408146100a0578063d09de08a146100c9575b600080fd5b61007c61006a36600461013e565b60026020526000908152604090205481565b60405190815260200160405180910390f35b61007c60015481565b61007c60005481565b61007c6100ae36600461013e565b6001600160a01b031660009081526002602052604090205490565b6100d16100d3565b005b60018054906100e390829061016e565b600181905533600081815260026020908152604091829020849055815192835282018490528101919091527f64f50d594c2a739c7088f9fc6785e1934030e17b52f1a894baec61b98633a59f9060600160405180910390a150565b60006020828403121561015057600080fd5b81356001600160a01b038116811461016757600080fd5b9392505050565b8082018082111561018f57634e487b7160e01b600052601160045260246000fd5b9291505056fea26469706673582212207d0879676f7d1df92ab6f845725a31b5d0530a18b4bd72d30f789d84a1ae5cf864736f6c634300081000330000000000000000000000000000000000000000000000000000000000000000';

			// Verify that the destination address matches expectation.
			const expectedAddress = ethers.utils.getCreate2Address(
				contractFactory.address,
				salt,
				ethers.utils.keccak256(bytecode)
			);
			const predestinedAddress = await contractFactory.checkDestinationAddress(
				bytecode,
				salt
			);
			predestinedAddress[0].should.be.equal(expectedAddress);

			// Verify that Bob cannot steal our salt.
			await expect(
				contractFactory.connect(bob.signer).deploy(bytecode, salt)
			).to.be.revertedWith('InvalidSaltSender()');

			// Perform a deployment and verify that the address continues to match.
			const deployTx = await contractFactory.connect(alice.signer).deploy(
				bytecode,
				salt
			);
			const deployReceipt = await deployTx.wait();
			const deployedAddress = deployReceipt.events[0].args.destination;
			deployedAddress.should.be.equal(expectedAddress);
		});
	});
});
