//const { describe, it } = require('mocha');
//const { network, ethers } = require('hardhat');
const { BigNumber } = require('ethers');
const { expect } = require('chai');

function getAbiSig(method){
  let encoded = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(method));
  return encoded.substring(0,10);
}

describe("Launchpad tests", function() {
  let SuperPad, SuperToken, SwapToken1, SwapToken2, PoolId, RoundId, Deployer, User, Receiver;

  before(async () => {
    const signers = await ethers.getSigners();
    const addresses = await Promise.all(signers.map(async signer => signer.getAddress()));
    Deployer = { provider: signers[0].provider, signer: signers[0], address: addresses[0] };
    User = { provider: signers[1].provider, signer: signers[1], address: addresses[1]};
    Receiver = { provider: signers[2].provider, signer: signers[2], address: addresses[2]};

    let SuperPadContract = await ethers.getContractFactory('SuperPad');
    SuperPad = await SuperPadContract.connect(Deployer.signer).deploy();
    await SuperPad.deployed();

    let SuperTokenContract = await ethers.getContractFactory('SuperToken');
    SuperToken = await SuperTokenContract.connect(Deployer.signer).deploy();
    await SuperToken.deployed();
    await SuperToken.initialize('_T0K3N', 'TK3N');

    let SwapTokenContract1 = await ethers.getContractFactory('SuperToken');
    SwapToken1 = await SwapTokenContract1.connect(Deployer.signer).deploy();
    await SwapToken1.deployed();
    await SwapToken1.initialize('_5W4P1', '5W4P1');

    let SwapTokenContract2 = await ethers.getContractFactory('SuperToken');
    SwapToken2 = await SwapTokenContract2.connect(Deployer.signer).deploy();
    await SwapToken2.deployed();
    await SwapToken2.initialize('_5W4P2', '5W4P2');

    await SuperToken.connect(Deployer.signer).transfer(User.address, ethers.utils.parseEther("100000"));
    await SwapToken1.connect(Deployer.signer).transfer(User.address, ethers.utils.parseEther("100000"));
    await SwapToken2.connect(Deployer.signer).transfer(User.address, ethers.utils.parseEther("100000"));
    await SuperToken.connect(Deployer.signer).transfer(Receiver.address, ethers.utils.parseEther("100000"));
    await SwapToken1.connect(Deployer.signer).transfer(Receiver.address, ethers.utils.parseEther("100000"));
    await SwapToken2.connect(Deployer.signer).transfer(Receiver.address, ethers.utils.parseEther("100000"));
  });


  it("Initialize launchpad, set owner and set supertoken", async function() {
    let initialize = await SuperPad.connect(Deployer.signer).initialize();
    let owner = await SuperPad.owner();
    let setSuper = await SuperPad.connect(Deployer.signer).setSuperToken(SuperToken.address);
    //console.log({"owner":owner});
  });

  it("Revert on zero address for pool token", async function() {
    await expect(
      SuperPad.connect(Deployer.signer).createPool(
        ethers.constants.AddressZero,  //pooled token
        SwapToken1.address,  //purchasing currency i.e. weth
        ethers.utils.parseEther("20"),  //pool cap
        ethers.utils.parseEther(".0001"), //pool token price ea
        false,  // is white list only
        true, // is token holder only (must setSuperToken())
        ethers.utils.parseEther("10")  // maximum purchasable tokens
      )
    ).to.be.revertedWith("function call to a non-contract account")
  });

  it("Revert on zero price for pool token", async function() {
    await expect(
      SuperPad.connect(Deployer.signer).createPool(
        SuperToken.address,  //pooled token
        SwapToken1.address,  //purchasing currency i.e. weth
        ethers.utils.parseEther("20"),  //pool cap
        0, //pool token price ea
        false,  // is white list only
        true, // is token holder only (must setSuperToken())
        ethers.utils.parseEther("10")  // maximum purchasable tokens
      )
    ).to.be.revertedWith("Price must be greater than 0")
  });

  it("Create pool", async function() {
    let approveSuper = await SuperToken.connect(Deployer.signer).approve(SuperPad.address, ethers.utils.parseEther("10000"))
    let createPool = await SuperPad.connect(Deployer.signer).createPool(
      SuperToken.address,  //pooled token
      SwapToken1.address,  //purchasing currency i.e. weth
      ethers.utils.parseEther("20"),  //pool cap
      ethers.utils.parseEther(".0001"), //pool token price ea
      false,  // is white list only
      true, // is token holder only (must setSuperToken())
      ethers.utils.parseEther("10")  // maximum purchasable tokens
    );
    let createPoolReceipt = await createPool.wait();
    PoolId = createPoolReceipt.events[2].args.id;
    //console.log({"receipt":receipt.events[2].args.id});
  });

  it("Revert on call to finish pool before it starts", async function() {
    await expect(
      SuperPad.connect(Deployer.signer).finishPool(PoolId)
    ).to.be.revertedWith("Pool is not enabled");
  });

  it("Execute User swap #1", async function() {
    const currentBlock = await ethers.provider.getBlockNumber()
    const block = await ethers.provider.getBlock(currentBlock)
    const timestamp = block.timestamp + 50001
    //console.log("timestamp", block.timestamp);

    await network.provider.request({
      method: 'evm_setNextBlockTimestamp',
      params: [timestamp]
    })
    await network.provider.send('evm_mine');

    const newCurrentBlock = await ethers.provider.getBlockNumber()
    const newBlock = await ethers.provider.getBlock(newCurrentBlock)
    //console.log("timestamp", newBlock.timestamp);

    let swapTokenBalanceBefore = await SwapToken1.connect(User.signer).balanceOf(User.address)
    let superTokenBalanceBefore = await SuperToken.connect(User.signer).balanceOf(User.address)

    let approveSwap = await SwapToken1.connect(User.signer).approve(SuperPad.address, ethers.utils.parseEther("100000"))
    let approveSuper = await SuperToken.connect(User.signer).approve(SuperPad.address, ethers.utils.parseEther("100000"))



    await expect(
      SuperPad.connect(User.signer).swap(PoolId, ethers.utils.parseEther("50000"))
    ).to.be.revertedWith("Pool must be enabled")

    await SuperPad.connect(Deployer.signer).startPool(PoolId)

    let swap = await SuperPad.connect(User.signer).swap(PoolId, ethers.utils.parseEther("50000"));

  });

  it("Verify Pool and Round lengths", async function() {
    let poolsLength = await SuperPad.poolsLength();
    expect(poolsLength).to.equal(1)

  });

  it("Revert on second call to start same pool", async function() {
    await expect(
      SuperPad.connect(Deployer.signer).startPool(PoolId)
    ).to.be.revertedWith("Pool is already enabled");
  });

  it("Revert on claim before pool finish", async function() {
    await expect(
      SuperPad.connect(User.signer).claim(PoolId)
    ).to.be.revertedWith("Cannot claim until pool is finished");
  });

  it("Finish Pool", async function() {
    let finishPool = await SuperPad.connect(Deployer.signer).finishPool(PoolId);
  });

  it("Revert on attempt to reopen pool", async function() {
    await expect(
      SuperPad.connect(Deployer.signer).startPool(PoolId)
    ).to.be.revertedWith("Pool is already completed");
  });

  it("Revert on attempt to finish pool again", async function() {
    await expect(
      SuperPad.connect(Deployer.signer).finishPool(PoolId)
    ).to.be.revertedWith("Pool is not enabled");
  });

  it("Claim Tokens", async function() {
    let claim = await SuperPad.connect(User.signer).claim(PoolId);
    let swapTokenBalanceAfter = await SwapToken1.connect(User.signer).balanceOf(User.address)
    let superTokenBalanceAfter = await SuperToken.connect(User.signer).balanceOf(User.address)
    //console.log({"swapTokenBalanceAfter": swapTokenBalanceAfter.toString(), "superTokenBalanceAfter": superTokenBalanceAfter.toString()});
  });

});