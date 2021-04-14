'use strict';
//  const hre = require('hardhat');
const { network, ethers } = require('hardhat');
const { describe, it } = require('mocha');
const { expect } = require('chai');
require('dotenv').config();

const overrides = {
	gasPrice: ethers.utils.parseUnits('0', 'gwei')
};

const UniswapV2PairABI = require('@uniswap/v2-core/build/UniswapV2Pair.json').abi;

async function fastForward (amount) {
	const currentBlock = await ethers.provider.getBlockNumber();
	const block = await ethers.provider.getBlock(currentBlock);
	const timestamp = block.timestamp + amount;

	await network.provider.request({
		method: 'evm_setNextBlockTimestamp',
		params: [timestamp]
	});
	await network.provider.send('evm_mine');
}

const SUPER_TOKEN = '0xe53ec727dbdeb9e2d5456c3be40cff031ab40a55';
const SUPER_HOLDER = '0xf8e6E9cEAc3828499DDDf63AC91BBEb42A88e965';
const SUPER_WETH_LP = '0x25647e01bd0967c1b9599fa3521939871d1d0888';
const SUPER_WETH_LP_HOLDER = '0x87ad7b8e02ea527f63051692b9cbd9fd137e8de4';

describe('SuperFarmDAO Liquidity Incentive Program: Tests', function () {
	let superDeployer;
	let SuperStaking, SuperToken, SuperLP;

	before(async () => {
		await network.provider.request({
			method: 'hardhat_reset',
			params: [{
				forking: {
					jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
					blockNumber: 11969707
				}
			}]
		});
		await network.provider.request({
			method: 'hardhat_impersonateAccount',
			params: [SUPER_HOLDER]
		});

		superDeployer = await ethers.provider.getSigner(SUPER_HOLDER);

		SuperToken = await ethers.getContractAt('contracts/Token.sol:Token', SUPER_TOKEN);

		let SuperStakingContract = await ethers.getContractFactory('SuperStaking');
		SuperLP = await ethers.getContractAt(UniswapV2PairABI, SUPER_WETH_LP);
		SuperStaking = await SuperStakingContract.connect(superDeployer).deploy(SUPER_HOLDER, SUPER_TOKEN, SUPER_WETH_LP, overrides);
		await SuperStaking.deployed();

		let rewardAmount = await ethers.utils.parseEther('1000000');
		await SuperToken.connect(superDeployer).transfer(SuperStaking.address, rewardAmount, overrides);
	});

	it('Test Staking Settings', async function () {
		await network.provider.request({
			method: 'hardhat_impersonateAccount',
			params: [SUPER_WETH_LP_HOLDER]
		});
		let superWethBags = await ethers.provider.getSigner(SUPER_WETH_LP_HOLDER);

		let programLength = 2592000; // one month
		let rewardAmount = ethers.utils.parseEther('1000000');
		let rewardRate = rewardAmount.div(programLength);

		const connectedStake = await SuperStaking.connect(superDeployer);
		await connectedStake.setRewardRate(rewardRate, 1, overrides);
		expect(await connectedStake.rewardRate()).to.equal(rewardRate);

		await connectedStake.notifyRewardAmount(rewardAmount, overrides);

		await SuperLP.connect(superWethBags).approve(SuperStaking.address, ethers.utils.parseEther('2000000'), overrides);
		SuperStaking = SuperStaking.connect(superWethBags);
		let stakingAmount = await ethers.utils.parseEther('20');
		await SuperStaking.stake(stakingAmount, overrides);

		expect(
			await SuperLP.balanceOf(SuperStaking.address)
		).to.equal(stakingAmount);

		fastForward(programLength);
	});

	it('Check Earnings', async function () {
		await SuperStaking.stake(1, overrides); // call updatepool modifier indirectly
		expect(
			await SuperStaking.earned(SUPER_WETH_LP_HOLDER, overrides)
		).to.be.gt(ethers.utils.parseEther('999999')).and.to.be.lt(ethers.utils.parseEther('1000000'));
		//  const currentBlock = await ethers.provider.getBlockNumber();
		//  const block = await ethers.provider.getBlock(currentBlock);
		//	let period = await SuperStaking.periodFinish();
		//	console.log(period.toString(), block.timestamp, 'periodFinish');

		await network.provider.request({
			method: 'hardhat_reset',
			params: []
		});
	});
});
