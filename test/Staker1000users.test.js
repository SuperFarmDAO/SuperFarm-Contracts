const { expect, util } = require("chai");
const { BigNumber } = require("ethers");
const { mnemonicToSeed, checkProperties } = require("ethers/lib/utils");
const { ethers, network } = require("hardhat");
//const Web3 = require('web3');

import * as utils from "./utils.js";

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

const DATA = "0x02";

///////////////////////////////////////////////////////////
// SEE https://hardhat.org/tutorial/testing-contracts.html
// FOR HELP WRITING TESTS
// USE https://github.com/gnosis/mock-contract FOR HELP
// WITH MOCK CONTRACT
///////////////////////////////////////////////////////////

// Start test block
describe("===Stakerv3ds===", function () {
  let deployer,
    owner,
    admin,
    paymentReceiver,
    signer1,
    signer2,
    signer3,
    developer;

  let coreSelectors,
    stakingSelectors,
    pointsSelectors,
    boostersSelectors,
    viewsSelectors,
    addressesForSelectors,
    allSelectors;

  let some721,
    some1155,
    rewardToken,
    depositToken,
    IOUToken,
    super721,
    super1155,
    proxyRegistry,
    stakerV3FacetCore,
    stakerV3FacetStaking,
    stakerV3FacetPoints,
    stakerV3FacetBoosters,
    stakerV3FacetViews,
    stakerV3dsProxy,
    diamondStakingFacet,
    diamondCoreFacet,
    diamondPointsFacet,
    diamondBoostersFacet,
    diamondViewsFacet;
  let startOfStaking;
  const originalUri = "://ipfs/uri/";
  const originalUri721 = "://ipfs/uri/";
  const originalUri1155 = "://ipfs/uri/";
  let itemGroupId = ethers.BigNumber.from(1);
  let shiftedItemGroupId = itemGroupId.shl(128);
  let itemGroupId2 = ethers.BigNumber.from(2);
  let shiftedItemGroupId2 = itemGroupId2.shl(128);
  let itemGroupId3 = ethers.BigNumber.from(3);
  let shiftedItemGroupId3 = itemGroupId3.shl(128);
  let stakerName = "StakerV3ds";

  before(async function () {
    this.MockERC721 = await ethers.getContractFactory("TestERC721");
    this.MockERC1155 = await ethers.getContractFactory("TestERC1155");
    this.MockERC20 = await ethers.getContractFactory("MockERC20");
    this.StakerV3Proxy = await ethers.getContractFactory("StakerProxy");
    this.StakerV3FacetCore = await ethers.getContractFactory(
      "StakerV3FacetCore"
    );
    this.StakerV3FacetViews = await ethers.getContractFactory(
      "StakerV3FacetViews"
    );
    this.StakerV3FacetStaking = await ethers.getContractFactory(
      "StakerV3FacetStaking"
    );
    this.StakerV3FacetPoints = await ethers.getContractFactory(
      "StakerV3FacetPoints"
    );
    this.StakerV3FacetBoosters = await ethers.getContractFactory(
      "StakerV3FacetBoosters"
    );
    this.Super721 = await ethers.getContractFactory("Super721");
    this.Super1155 = await ethers.getContractFactory("Super1155");
    this.ProxyRegistry = await ethers.getContractFactory("MockProxyRegistry");
  });

  beforeEach(async function () {
    [
      deployer,
      owner,
      admin,
      paymentReceiver,
      signer1,
      signer2,
      signer3,
      developer,
    ] = await ethers.getSigners();

    some721 = await this.MockERC721.deploy();
    await await some721.deployed();

    // some1155 = await this.MockERC1155.deploy();
    // some1155.deployed();

    rewardToken = await this.MockERC20.deploy();
    await rewardToken.deployed();

    depositToken = await this.MockERC20.deploy();
    await depositToken.deployed();

    stakerV3FacetCore = await this.StakerV3FacetCore.deploy();
    await stakerV3FacetCore.deployed();

    stakerV3FacetStaking = await this.StakerV3FacetStaking.deploy();
    await stakerV3FacetStaking.deployed();

    stakerV3FacetPoints = await this.StakerV3FacetPoints.deploy();
    await stakerV3FacetPoints.deployed();

    stakerV3FacetBoosters = await this.StakerV3FacetBoosters.deploy();
    await stakerV3FacetBoosters.deployed();

    stakerV3FacetViews = await this.StakerV3FacetViews.deploy();
    await stakerV3FacetViews.deployed();

    proxyRegistry = await this.ProxyRegistry.deploy();
    await proxyRegistry.deployed();

    IOUToken = await this.MockERC721.deploy();
    await IOUToken.deployed();

    super721 = await this.Super721.deploy(
      owner.address,
      "Super721",
      "SIMX721",
      originalUri,
      originalUri721,
      proxyRegistry.address
    );
    await super721.deployed();

    super1155 = await this.Super1155.deploy(
      owner.address,
      "Super1155",
      originalUri,
      originalUri1155,
      proxyRegistry.address
    );
    await super1155.deployed();

    var someSelector1 = await utils.getSelector(
      "function setEmissions((uint256,uint256)[],(uint256,uint256)[])"
    );
    //console.log(someSelector1);

    var someSelector = await utils.getSelector("function initialize(address)");
    //console.log(someSelector);

    coreSelectors = await utils.getSelectors(stakerV3FacetCore);
    addressesForSelectors = [];
    // console.log(coreSelectors);
    let counter = 0;
    for (counter; counter < coreSelectors.length; counter++) {
      addressesForSelectors.push(stakerV3FacetCore.address);
    }

    oldCounter = counter;
    viewsSelectors = await utils.getSelectors(stakerV3FacetViews);
    for (counter; counter < viewsSelectors.length + oldCounter; counter++) {
      addressesForSelectors.push(stakerV3FacetViews.address);
    }

    oldCounter = counter;
    pointsSelectors = await utils.getSelectors(stakerV3FacetPoints);
    for (counter; counter < pointsSelectors.length + oldCounter; counter++) {
      addressesForSelectors.push(stakerV3FacetPoints.address);
    }
    // console.log(pointsSelectors);

    oldCounter = counter;
    boostersSelectors = await utils.getSelectors(stakerV3FacetBoosters);
    for (counter; counter < boostersSelectors.length + oldCounter; counter++) {
      addressesForSelectors.push(stakerV3FacetBoosters.address);
    }

    var oldCounter = counter;
    stakingSelectors = await utils.getSelectors(stakerV3FacetStaking);
    for (counter; counter < stakingSelectors.length + oldCounter; counter++) {
      addressesForSelectors.push(stakerV3FacetStaking.address);
    }
    //console.log(stakingSelectors);

    allSelectors = [
      ...coreSelectors,
      ...viewsSelectors,
      ...pointsSelectors,
      ...boostersSelectors,
      ...stakingSelectors,
    ];
    //console.log(allSelectors);

    stakerV3dsProxy = await this.StakerV3Proxy.deploy(
      stakerV3FacetCore.address,
      owner.address,
      rewardToken.address,
      admin.address,
      IOUToken.address,
      stakerName,
      allSelectors,
      addressesForSelectors
    );
    await stakerV3dsProxy.deployed();

    some721.mint(signer1.address, 1);

    rewardToken.transfer(
      stakerV3dsProxy.address,
      ethers.utils.parseEther("1000000")
    );

    IOUToken.transferOwnership(stakerV3dsProxy.address);

    diamondStakingFacet = await ethers.getContractAt(
      "StakerV3FacetStaking",
      stakerV3dsProxy.address
    );

    diamondCoreFacet = await ethers.getContractAt(
      "StakerV3FacetCore",
      stakerV3dsProxy.address
    );

    diamondBoostersFacet = await ethers.getContractAt(
      "StakerV3FacetBoosters",
      stakerV3dsProxy.address
    );

    diamondPointsFacet = await ethers.getContractAt(
      "StakerV3FacetPoints",
      stakerV3dsProxy.address
    );

    diamondViewsFacet = await ethers.getContractAt(
      "StakerV3FacetViews",
      stakerV3dsProxy.address
    );
  });

  describe("change booster with 1000 partcipants", function () {
    it("stakerv3", async function () {
      await diamondCoreFacet.connect(owner).setEmissions(
        [
          {
            timeStamp: await utils.getCurrentTime(),
            rate: ethers.utils.parseEther("10"),
          },
        ],
        [
          {
            timeStamp: await utils.getCurrentTime(),
            rate: ethers.utils.parseEther("10"),
          },
        ]
      );

      await diamondCoreFacet.connect(owner).configureBoostersBatch(
        [1, 2],
        [
          {
            multiplier: 2300,
            amountRequired: 1,
            groupRequired: itemGroupId2,
            contractRequired: super721.address,
            boostType: 2,
            typeOfAsset: 1,
            historyOfTokenMultipliers: [],
            historyOfPointMultipliers: [],
          },
          {
            multiplier: 2000,
            amountRequired: 2,
            groupRequired: 0,
            contractRequired: super1155.address,
            boostType: 2,
            typeOfAsset: 2,
            historyOfTokenMultipliers: [],
            historyOfPointMultipliers: [],
          },
        ]
      );

      await diamondCoreFacet.connect(owner).addPool({
        id: 0,
        tokenStrength: 10000,
        pointStrength: 10000,
        groupId: 0,
        tokensPerShare: 0,
        pointsPerShare: 0,
        compoundInterestThreshold: ethers.utils.parseEther("1000"),
        compoundInterestMultiplier: 5000,
        boostInfo: [1, 2],
        assetAddress: super721.address,
        typeOfAsset: 1,
        lockPeriod: 0,
        lockAmount: 0,
        lockMultiplier: 0,
        timeLockTypeOfBoost: 0,
        compoundTypeOfBoost: 0,
        typeOfPool: 0,
      });

      // Mint ITEMS for Signer1
      await super721.connect(owner).configureGroup(itemGroupId2, {
        name: "PEPSI",
        supplyType: 0,
        supplyData: 2100,
        burnType: 0,
        burnData: 0,
      });

      const accounts = await hre.ethers.getSigners();
      let arrayOfSigners = [];
      //let signersS = [];

      let tokenCounter = 0;
      for (let i = 0; i < 100; i++) {
        arrayOfSigners.push(await ethers.Wallet.createRandom());
        arrayOfSigners[i] = arrayOfSigners[i].connect(ethers.provider);
        await signer3.sendTransaction({
          to: arrayOfSigners[i].address,
          value: ethers.utils.parseEther("1"),
        });

        await depositToken.transfer(
          arrayOfSigners[i].address,
          ethers.utils.parseEther("1000")
        );

        await super721
          .connect(owner)
          .mintBatch(
            arrayOfSigners[i].address,
            [
              shiftedItemGroupId2.add(tokenCounter),
              shiftedItemGroupId2.add(tokenCounter + 1),
            ],
            DATA
          );

        await super721
          .connect(arrayOfSigners[i])
          .setApprovalForAll(stakerV3dsProxy.address, true);

        console.log(i + " " + arrayOfSigners[i].address);

        await diamondBoostersFacet
          .connect(arrayOfSigners[i])
          .stakeItemsBatch(0, 1, {
            assetAddress: super721.address,
            id: [shiftedItemGroupId2.add(tokenCounter)],
            amounts: [1],
            IOUTokenId: [],
          });

        await diamondStakingFacet.connect(arrayOfSigners[i]).deposit(
          0,
          {
            assetAddress: super721.address,
            id: [shiftedItemGroupId2.add(tokenCounter + 1)],
            amounts: [1],
            IOUTokenId: [],
          },
          false
        );

        tokenCounter += 2;
      }

      console.log("withdraws starts");

      await diamondStakingFacet.connect(arrayOfSigners[0]).withdraw(0, [0]);

      await diamondCoreFacet.connect(owner).configureBoostersBatch(
        [1],
        [
          {
            multiplier: 3000,
            amountRequired: 1,
            groupRequired: itemGroupId2,
            contractRequired: super721.address,
            boostType: 2,
            typeOfAsset: 1,
            historyOfTokenMultipliers: [],
            historyOfPointMultipliers: [],
          },
        ]
      );

      await utils.evm_increaseTime(30);

      await diamondStakingFacet.connect(arrayOfSigners[1]).withdraw(0, [1]);

      await utils.evm_increaseTime(30);

      await diamondCoreFacet.connect(owner).configureBoostersBatch(
        [1],
        [
          {
            multiplier: 2900,
            amountRequired: 1,
            groupRequired: itemGroupId2,
            contractRequired: super721.address,
            boostType: 2,
            typeOfAsset: 1,
            historyOfTokenMultipliers: [],
            historyOfPointMultipliers: [],
          },
        ]
      );

      for (let i = 2; i < 10; i++) {
        await diamondStakingFacet.connect(arrayOfSigners[i]).claim(0, []);
      }
    });
  });
});
