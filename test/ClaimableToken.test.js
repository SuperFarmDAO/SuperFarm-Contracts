'use strict';

// Imports.
import { ethers, network } from 'hardhat';
import { expect } from 'chai';
import 'chai/register-should';

describe('ClaimableToken', function () {
	let alice, bob, carol, dev;
	let ClaimableToken;
	before(async () => {
		const signers = await ethers.getSigners();
		const addresses = await Promise.all(signers.map(async signer => signer.getAddress()));
		alice = { provider: signers[0].provider, signer: signers[0], address: addresses[0] };
		bob = { provider: signers[1].provider, signer: signers[1], address: addresses[1] };
		carol = { provider: signers[2].provider, signer: signers[2], address: addresses[2] };
		dev = { provider: signers[3].provider, signer: signers[3], address: addresses[3] };

    ClaimableToken = await ethers.getContractFactory('ClaimableToken');
	});

	// Deploy a fresh set of smart contracts for testing with.
	let NAME = 'Testing Token';
	let claimableToken;
	beforeEach(async () => {
		let now = Math.floor(new Date().getTime() / 1000);
		await network.provider.send('evm_setNextBlockTimestamp', [ now ]);
		await network.provider.send('evm_mine');
		claimableToken = await ClaimableToken.connect(alice.signer).deploy(
			NAME,
			'TEST',
			ethers.utils.parseEther('1000000000'),
			dev.address,
			ethers.utils.parseEther('1000000000'),
			now - 600,
			ethers.constants.MaxUint256
		);
		await claimableToken.deployed();
	});

	// Verify that claimants may claim tokens with valid signatures.
	it('should allow claimants to claim', async () => {
	//	const network = await ethers.getDefaultProvider().getNetwork();

		// Retrieve the network chain ID.
		//let chainId = network.chainId;

		// Construct the domain separator for this contract.
		// let domainSeparator = ethers.utils.keccak256(
		// 	ethers.utils.defaultAbiCoder.encode(
		// 		[ 'bytes32', 'bytes32', 'bytes32', 'uint256', 'address' ],
		// 		[
		// 			ethers.utils.keccak256(ethers.utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
		// 			ethers.utils.keccak256(ethers.utils.toUtf8Bytes(NAME)),
		// 			ethers.utils.keccak256(ethers.utils.toUtf8Bytes('1')),
		// 			chainId,
		// 			claimableToken.address
		// 		]
		// 	)
		// );
        const domain = {
            name: NAME,
            version: "1",
            chainId: network.config.chainId,
            verifyingContract: claimableToken.address
        }

		// // Construct the mint typehash.
		// let MINT_TYPEHASH = ethers.utils.keccak256(
		// 	ethers.utils.toUtf8Bytes('mint(address _to,uint256 _amount)')
		// );

// 		// Construct a digest to give Bob tokens.
// 		let digest = ethers.utils.keccak256(
// 			ethers.utils.solidityPack(
// 				[ 'bytes1', 'bytes1', 'bytes32', 'bytes32' ],
// 				[
// 					'0x19',
// 					'0x01',
// 					domainSeparator,
// 					ethers.utils.keccak256(
// 						ethers.utils.defaultAbiCoder.encode(
// 							[ 'bytes32', 'address', 'uint256' ],
// 							[ MINT_TYPEHASH, bob.address, ethers.utils.parseEther('1000') ]
// 						)
// 					)
// 				]
// 			)
// 		);
// 		let signedDigest = await dev.signer.signMessage(digest);
// console.log('manual', signedDigest)

		// Our signer can now sign the digest to produce an executable signature.
		let signature = await dev.signer._signTypedData(
			domain,
			{
				mint: [
					{ name: '_to', type: 'address' },
					{ name: '_amount', type: 'uint256' }
				]
			},
			{
				'_to': bob.address,
				'_amount': ethers.utils.parseEther('1000')
			}
		);
		let { v, r, s } = ethers.utils.splitSignature(signature);
// console.log('ethers', signature)

		// Bob should be able to execute this signature.
		// I can't get this working with either signature. :C
		let bobBalance = await claimableToken.balanceOf(bob.address);
		bobBalance.should.be.equal(0);
		await claimableToken.connect(bob.signer).claim(
			ethers.utils.parseEther('1000'), v, r, s);
		bobBalance = await claimableToken.balanceOf(bob.address);
		bobBalance.should.be.equal(ethers.utils.parseEther('1000'));
	});
});
