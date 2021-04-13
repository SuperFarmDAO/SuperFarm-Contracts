//'use strict';
const hre = require('hardhat')
const { ethers } = require('hardhat')
const { describe, it } = require('mocha')
const { expect } = require('chai')

const UniswapV2PairABI = require("@uniswap/v2-core/build/UniswapV2Pair.json").abi;

async function fastForward(amount){
  const currentBlock = await ethers.provider.getBlockNumber()
  const block = await ethers.provider.getBlock(currentBlock)
  const timestamp = block.timestamp + amount

  await hre.network.provider.request({
    method: 'evm_setNextBlockTimestamp',
    params: [timestamp]
  })
  await hre.network.provider.send("evm_mine")
}

const toToken = (count) => {
  return count * (10 ** 18)
}

const fromToken = (count) => {
  return parseInt(count) / (10 ** 18)
}


SUPER_TOKEN = '0xe53ec727dbdeb9e2d5456c3be40cff031ab40a55';
SUPER_HOLDER = '0xf8e6E9cEAc3828499DDDf63AC91BBEb42A88e965';
SUPER_WETH_LP = '0x25647e01bd0967c1b9599fa3521939871d1d0888';
SUPER_WETH_LP_HOLDER = '0x87ad7b8e02ea527f63051692b9cbd9fd137e8de4';


describe("SuperFarmDAO Liquidity Incentive Program: Tests", function() {
  let alice, bob, dev, super_deployer;
  let SuperStaking, SuperToken, SuperLP;

  before(async () => {
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [SUPER_HOLDER]
    })
    super_deployer = await ethers.provider.getSigner(SUPER_HOLDER)

    const signers = await ethers.getSigners();
    const addresses = await Promise.all(signers.map(async signer => signer.getAddress()));
    alice = { provider: signers[0].provider, signer: signers[0], address: addresses[0] };
    bob = { provider: signers[1].provider, signer: signers[1], address: addresses[1] };
    dev = { provider: signers[3].provider, signer: signers[3], address: addresses[3] };

    SuperToken = await ethers.getContractAt('contracts/Token.sol:Token', SUPER_TOKEN);
    SuperLP = await ethers.getContractAt(UniswapV2PairABI, SUPER_WETH_LP);
    SuperStakingContract = await ethers.getContractFactory('SuperStaking');

    SuperStaking = await SuperStakingContract.connect(super_deployer).deploy(dev.address, SUPER_TOKEN, SUPER_WETH_LP);
    await SuperStaking.deployed();

    let rewardAmount = await ethers.utils.parseEther('1000000')
    await SuperToken.connect(super_deployer).transfer(SuperStaking.address, rewardAmount);
  });

  beforeEach(async () => {
    console.log('    -------------------------------------------------------------------------');
  });

  it('senseless token (in)sanity check', async function () {
    let remainingSupply = await ethers.utils.parseEther('1500000')
    expect(
      await SuperToken.balanceOf(SUPER_HOLDER)
    ).to.equal(remainingSupply)
  })

  it("Test Staking Settings", async function() {
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [SUPER_WETH_LP_HOLDER]
    })
    super_weth_bags = await ethers.provider.getSigner(SUPER_WETH_LP_HOLDER)
    let super_weth_bags_balance = await SuperLP.balanceOf(SUPER_WETH_LP_HOLDER)

    let programLength = 2592000; //one month
    let rewardAmount = await ethers.utils.parseEther('1000000')
    let rewardRate = rewardAmount.div(programLength);

    await SuperStaking.connect(super_deployer).setRewardRate(rewardRate, 1)
    expect(await SuperStaking.rewardRate()).to.equal(rewardRate)

    await SuperStaking.connect(super_deployer).notifyRewardAmount(rewardAmount)

    await SuperLP.connect(super_weth_bags).approve(SuperStaking.address, ethers.utils.parseEther('2000000'));
    SuperStaking = SuperStaking.connect(super_weth_bags)
    let stakingAmount = await ethers.utils.parseEther('20');
    await SuperStaking.stake(stakingAmount);

    expect(
      await SuperLP.balanceOf(SuperStaking.address)
    ).to.equal(stakingAmount)

    fastForward(programLength);
  });

  it("Check Earnings", async function() {

    const currentBlock = await ethers.provider.getBlockNumber()
    const block = await ethers.provider.getBlock(currentBlock)

    await SuperStaking.stake(1); //call updatepool modifier indirectly
    expect(
       await SuperStaking.earned(SUPER_WETH_LP_HOLDER)
    ).to.be.gt(ethers.utils.parseEther('999999')).and.to.be.lt(ethers.utils.parseEther('1000000'))

    let period = await SuperStaking.periodFinish();
    console.log(period.toString(), block.timestamp, "periodFinish");
  });

});
