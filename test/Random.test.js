'use strict';

// Imports.
import { ethers } from 'hardhat';
import { expect } from 'chai';
const today = Math.trunc(new Date().getTime() / 1000);
import 'chai/register-should';
const padded = ethers.utils.hexZeroPad('0x11', 32)

describe('Random', function () {
	let alice, bob, carol, dev;
	let VrfCoordinatorMock, Random, LinkToken;
	before(async () => {
		const signers = await ethers.getSigners();
		const addresses = await Promise.all(signers.map(async signer => signer.getAddress()));
		alice = { provider: signers[0].provider, signer: signers[0], address: addresses[0] };
		bob = { provider: signers[1].provider, signer: signers[1], address: addresses[1] };
		carol = { provider: signers[2].provider, signer: signers[2], address: addresses[2] };
		dev = { provider: signers[3].provider, signer: signers[3], address: addresses[3] };

		Random = await ethers.getContractFactory('Random');
		VrfCoordinatorMock = await ethers.getContractFactory('VRFCoordinatorMock');
        LinkToken = await ethers.getContractFactory('LinkToken');
	});

	// Deploy a fresh set of smart contracts for testing with.
	let linkToken, random, vrfCoordinatorMock;
	beforeEach(async () => {
		linkToken = await LinkToken.connect(alice.signer).deploy();
		await linkToken.deployed();
		vrfCoordinatorMock = await VrfCoordinatorMock.deploy(linkToken.address);
        random = await Random.connect(alice.signer).deploy(
            alice.address, 
            "Random1", 
            {coordinator: vrfCoordinatorMock.address, link: linkToken.address, keyHash: '0x6e75b569a01ef56d18cab6a8e71e6600d6ce853834d4a5748b720d06f878b3a4', fee: ethers.utils.parseEther("1")});

		await linkToken.connect(alice.signer).transfer(random.address, ethers.utils.parseEther('100'));


		  
	});

	// Verify that the multisignature wallet can send tokens from the vault.
	it('should revert transaction random data', async () => {
		try {
			let rand = await random.connect(bob.signer).random(padded);
		} catch(error) {
			expect(error.message).to.include("Random: you do not have enough LINK to request randomness")
		}
		try {
			await random.asRange(padded, '2', '1000');
		} catch(error) {
			expect(error.message).to.include("Random: you may only interpret the results of a fulfilled request")
		}
	});
    it('should set random number', async () => {
		await linkToken.connect(alice.signer).transfer(random.address, ethers.utils.parseEther('100'));
		await linkToken.approve(random.address, ethers.utils.parseEther('100000'));

		let linkBalance = await linkToken.balanceOf(alice.address);
		console.log("link balance: " + linkBalance.toString());


		let rand = await random.connect(alice.signer).random(padded);

		await hre.network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [vrfCoordinatorMock.address],
		  });

		  const res = await rand.wait();
		  let event = res.events[res.events.length - 1].args[2];
		  console.log(event.toString());
		  
		  random.on("RequestCreated", (from, id, chainlinkRequest) => {
				console.log(from, id, chainlinkRequest);
		  });
		await vrfCoordinatorMock.callBackWithRandomness(event.toString(), '10000', random.address);

		await hre.network.provider.request({
			method: "hardhat_stopImpersonatingAccount",
			params: [vrfCoordinatorMock.address],
		  });

		let result = await random.asRange(padded, '2', '1000');
		console.log(result.toString());
	});
});
