'use strict';

// Imports.
const hre = require('hardhat');
const ethers = hre.ethers;

// founder vault
// const recipient = '0x8c65Eb6d932d2b600aB642Cca5967dd452143560';
// const vault = '0xf6e4795173CAfa138c76Df176Dde7C3BdA2E14CA'
// const amount = '78020000';

// development vault
// const recipient = '0x7e60b2211C68CaBB2E7F5287Fc7F61f1D811DD10';
// const vault = '0xbdA122FF9d13E7B5baeE2502FA35f8Ceb23a4700'
// const amount = '3000000';

// nft drop
// const vault = '0x23a1Fd006D151e1d920d5DE860e82C697e73fBCF';
// const recipient = '0x71144Da54AacCE56462a6fA911751F0A475BC4e6';
// const amount = '11587170';

// ecosystem vault
// const recipient = '0x4E94CdA65193C99b3ba12b5c93a130F9D1D5D46e';
// const vault = '0x7080f65ABb8834259668900de238fCFB73aC3f2C';
// const amount = '47220800';

// staking vault
// const recipient = '0x331C59032b5720e20CEC99fed49551Acc309532c';
// const vault = '0x72267D7090dcAb8CB832Fc77048f47333c250cB1';
// const amount = '144007481';

// Generate transaction submission data that can be fed to a MultiSigWallet.
async function main () {
	const TokenVault = new ethers.utils.Interface([
    'function sendTokens(address[] calldata _recipients, uint256[] calldata _amounts)'
  ]);
	const Timelock = new ethers.utils.Interface([
    'function queueTransaction(address,uint,string,bytes,uint)',
    'function executeTransaction(address,uint,string,bytes,uint)'
  ]);

	// Generate the raw transaction for releasing tokens from the vault.
	let releaseTokenTransaction = await TokenVault.encodeFunctionData('sendTokens(address[],uint256[])', [
		[ recipient ], [ ethers.utils.parseEther(amount) ]
	]);
	console.log('Release Token Data', releaseTokenTransaction);

	// Generate the raw transaction for enqueuing token release with the time lock.
	let enqueueTime = Math.floor(Date.now() / 1000) + 172800 + 1500;
	console.log(`Enqueue time: ${enqueueTime} ...`);
	let enqueueTransaction = await Timelock.encodeFunctionData('queueTransaction(address,uint,string,bytes,uint)', [
		vault, ethers.utils.parseEther('0'), '', releaseTokenTransaction, enqueueTime
	]);
	console.log('Enqueue Token Release', enqueueTransaction);
	console.log('Timelock Transaction Hash', ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode([
		'address', 'uint', 'string', 'bytes', 'uint'
	], [
		vault, ethers.utils.parseEther('0'), '', releaseTokenTransaction, enqueueTime
	])));

	// Generate the raw transaction for executing token release with the time lock.
	let executeTransaction = await Timelock.encodeFunctionData('executeTransaction(address,uint,string,bytes,uint)', [
		vault, ethers.utils.parseEther('0'), '', releaseTokenTransaction, enqueueTime
	]);
	console.log('Execute Token Release', executeTransaction);
	console.log('Confirmed Timelock Execution Hash', ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode([
		'address', 'uint', 'string', 'bytes', 'uint'
	], [
		vault, ethers.utils.parseEther('0'), '', releaseTokenTransaction, enqueueTime
	])));
}

// Execute the script and catch errors.
main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
