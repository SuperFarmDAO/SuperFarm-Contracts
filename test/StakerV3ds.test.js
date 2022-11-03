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
    diamondViewFacet;
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

    diamondViewFacet = await ethers.getContractAt(
      "StakerV3FacetViews",
      stakerV3dsProxy.address
    );
  });

  describe("Proxy", function () {
    it("Reverts: mismatch of selector and addresses lengths of arrays at constructor", async function () {
      //  decrease length of selectors array by 1;
      await allSelectors.pop();
      await expect(
        this.StakerV3Proxy.deploy(
          stakerV3FacetCore.address,
          owner.address,
          rewardToken.address,
          admin.address,
          IOUToken.address,
          stakerName,
          allSelectors,
          addressesForSelectors
        )
      ).to.be.revertedWith("ArraysLengthsMismatch()");
    });
    it("Reverts: wrong implemintation given", async function () {
      await expect(
        this.StakerV3Proxy.deploy(
          stakerV3FacetStaking.address,
          owner.address,
          rewardToken.address,
          admin.address,
          IOUToken.address,
          stakerName,
          allSelectors,
          addressesForSelectors
        )
      ).to.be.revertedWith("DelegateCallFails()");
    });
    it("Reverts: invalid selector of the function for delegate call", async function () {
      // generate data for sendTransaction with invalid selector
      const invalidAbi = ["function someInvalidFunc(address _address)"];
      const invalidInterface = new ethers.utils.Interface(invalidAbi);
      const callData = invalidInterface.encodeFunctionData("someInvalidFunc", [
        signer1.address,
      ]);

      // executing calldata at proxy contract
      await expect(
        owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: callData,
        })
      ).to.be.revertedWith("NoImplementation()");
    });
  });

  describe("Core Facet testings", function () {
    describe("addDeveloper, lockDevelopers, updateDeveloper, getDeveloperCount", function () {
      it("Reverts: addition of developers is locked", async function () {
        const coreFacetABI = await hre.artifacts.readArtifact(
          "StakerV3FacetCore"
        );

        await diamondCoreFacet.connect(owner).lockDevelopers();

        await expect(
          diamondCoreFacet.connect(owner).addDeveloper(developer.address, 500)
        ).to.be.revertedWith("CantAlterDevs");
      });

      it("Reverts: update developer by person with 0 share", async function () {
        await expect(
          diamondCoreFacet.connect(owner).updateDeveloper(signer2.address, 100)
        ).to.be.revertedWith("ZeroDevShare()");
      });

      it("should add new developer", async function () {
        const developersShare = [500, 1500, 2500];

        const viewFacetABI = await hre.artifacts.readArtifact(
          "StakerV3FacetViews"
        );

        await diamondCoreFacet
          .connect(owner)
          .addDeveloper(developer.address, developersShare[0]);

        await diamondCoreFacet
          .connect(owner)
          .addDeveloper(signer1.address, developersShare[1]);

        await diamondCoreFacet
          .connect(owner)
          .addDeveloper(signer2.address, developersShare[2]);

        // getDeveloperAddresses
        let devAddresses = await diamondViewFacet
          .connect(owner)
          .getDeveloperAddresses();

        expect(devAddresses[0]).to.be.eq(developer.address);
        expect(devAddresses[1]).to.be.eq(signer1.address);
        expect(devAddresses[2]).to.be.eq(signer2.address);

        // getDeveloperShare
        let devShares = [];

        for (let i = 0; i < devAddresses.length; i++) {
          devShares[i] = await diamondViewFacet
            .connect(owner)
            .getDeveloperShare(devAddresses[i]);
        }

        expect(devShares[0]).to.be.eq(developersShare[0]);
        expect(devShares[1]).to.be.eq(developersShare[1]);
        expect(devShares[2]).to.be.eq(developersShare[2]);
      });

      it("Reverts: can not increase share", async function () {
        await diamondCoreFacet
          .connect(owner)
          .addDeveloper(developer.address, 500);

        await expect(
          diamondCoreFacet
            .connect(developer)
            .updateDeveloper(developer.address, 1000)
        ).to.be.revertedWith("CantIncreaseDevShare()");
      });

      it("Reverts: can not update developer at address with greater then 0 share", async function () {
        await diamondCoreFacet
          .connect(owner)
          .addDeveloper(developer.address, 500);

        await diamondCoreFacet
          .connect(owner)
          .addDeveloper(signer1.address, 1000);

        await expect(
          diamondCoreFacet
            .connect(developer)
            .updateDeveloper(signer1.address, 100)
        ).to.be.revertedWith("InvalidNewAddress()");
      });

      it("should update developer address correctly", async function () {
        const developersShare = [500, 1500, 2500];

        const viewFacetABI = await hre.artifacts.readArtifact(
          "StakerV3FacetViews"
        );

        await diamondCoreFacet
          .connect(owner)
          .addDeveloper(developer.address, developersShare[0]);

        await diamondCoreFacet
          .connect(owner)
          .addDeveloper(signer1.address, developersShare[1]);

        await diamondCoreFacet
          .connect(owner)
          .addDeveloper(signer2.address, developersShare[2]);

        // Updating devs
        await diamondCoreFacet
          .connect(developer)
          .updateDeveloper(developer.address, 0);

        await diamondCoreFacet
          .connect(signer1)
          .updateDeveloper(signer3.address, developersShare[1]);

        await diamondCoreFacet
          .connect(signer2)
          .updateDeveloper(signer2.address, developersShare[2] - 1000);

        /**
         *
         *
         *          ASSERTING
         *
         *
         */

        // getDeveloperAddresses
        let devAddresses = await diamondViewFacet
          .connect(owner)
          .getDeveloperAddresses();

        expect(devAddresses).to.not.contain(developer.address);
        expect(devAddresses[0]).to.be.eq(signer2.address);
        expect(devAddresses[1]).to.be.eq(signer3.address);

        let newDevShares = [];
        // getDeveloperShare
        newDevShares[0] = await diamondViewFacet
          .connect(owner)
          .getDeveloperShare(devAddresses[0]);

        // getDeveloperShare
        newDevShares[1] = await diamondViewFacet
          .connect(owner)
          .getDeveloperShare(devAddresses[1]);

        expect(newDevShares[0]).to.be.eq(developersShare[2] - 1000);
        expect(newDevShares[1]).to.be.eq(developersShare[1]);

        diamondCoreFacet
          .connect(signer2)
          .updateDeveloper(signer2.address, developersShare[2] - 1000);
      });
    });
    describe("setEmissions, lockTokenEmissions, lockPointEmissions", function () {
      it("Reverts: alteration of token emission is locked", async function () {
        await diamondCoreFacet.connect(owner).lockTokenEmissions();

        // setEmissions()
        await expect(
          diamondCoreFacet.connect(owner).setEmissions(
            [
              {
                timeStamp: await utils.getCurrentTime(),
                rate: ethers.utils.parseEther("6.6666666666"),
              },
            ],
            [
              {
                timeStamp: await utils.getCurrentTime(),
                rate: ethers.utils.parseEther("6.6666666666"),
              },
            ]
          )
        ).to.be.revertedWith("CantAlterTokenEmissionSchedule()");
      });

      it("Reverts: alteration of point emissions is locked", async function () {
        await diamondCoreFacet.connect(owner).lockPointEmissions();

        await expect(
          diamondCoreFacet.connect(owner).setEmissions(
            [
              {
                timeStamp: await utils.getCurrentTime(),
                rate: ethers.utils.parseEther("6.6666666666"),
              },
            ],
            [
              {
                timeStamp: await utils.getCurrentTime(),
                rate: ethers.utils.parseEther("6.6666666666"),
              },
            ]
          )
        ).to.be.revertedWith("CantAlterPointEmissionSchedule()");
      });

      it("Reverts: token emission schedule must be set", async function () {
        await expect(
          diamondCoreFacet.connect(owner).setEmissions([], [])
        ).to.be.revertedWith("ZeroTokenEmissionEvents()");
      });

      it("Reverts: point emission schedule must be set", async function () {
        await expect(
          diamondCoreFacet.connect(owner).setEmissions(
            [
              {
                timeStamp: await utils.getCurrentTime(),
                rate: ethers.utils.parseEther("6.6666666666"),
              },
            ],
            []
          )
        ).to.be.revertedWith("ZeroPointEmissionEvents()");
      });

      it("should set emissions", async function () {
        await diamondCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );
      });

      it("should set emissions of staker where earliestTokenEmission/earliestPointEmission timestamps are less", async function () {
        await diamondCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );

        // Increase time so that the earliestTokenEmission/EarliestPointEmission timestamps are less
        await ethers.provider.send("evm_increaseTime", [70]);
        await ethers.provider.send("evm_mine", []);

        await diamondCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );
      });
    });

    describe("configureBoostersBatch, getBoostersCount, getBoosterInfo", function () {
      it("Reverts: boost info must be set", async function () {
        await expect(
          diamondCoreFacet.connect(owner).configureBoostersBatch([1, 2], [])
        ).to.be.revertedWith("EmptyBoostInfoArray()");

        await expect(
          diamondCoreFacet.connect(owner).configureBoostersBatch(
            [1],
            [
              {
                multiplier: 0,
                amountRequired: 0,
                groupRequired: 0,
                contractRequired: ethers.constants.AddressZero,
                boostType: 2,
                typeOfAsset: 0,
                historyOfTokenMultipliers: [],
                historyOfPointMultipliers: [],
              },
            ]
          )
        ).to.be.revertedWith("InvalidConfBoostersInputs()");
      });

      it("Reverts: mismatch of ids and boost info arrays leghts", async function () {
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);

        await expect(
          diamondCoreFacet.connect(owner).configureBoostersBatch(
            [1, 2, 3],
            [
              {
                multiplier: 2300,
                amountRequired: 3,
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
          )
        ).to.be.revertedWith("InputLengthsMismatch()");
      });

      it("Reverts: you can not configure boost with id 0", async function () {
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);

        await expect(
          diamondCoreFacet.connect(owner).configureBoostersBatch(
            [1, 0],
            [
              {
                multiplier: 2300,
                amountRequired: 3,
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
          )
        ).to.be.revertedWith("BoosterIdZero()");
      });

      it("Reverts: you can't set ERC20 as asset for stake for boosts", async function () {
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);

        await expect(
          diamondCoreFacet.connect(owner).configureBoostersBatch(
            [1, 2],
            [
              {
                multiplier: 2300,
                amountRequired: 3,
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
                contractRequired: depositToken.address,
                boostType: 2,
                typeOfAsset: 0,
                historyOfTokenMultipliers: [],
                historyOfPointMultipliers: [],
              },
            ]
          )
        ).to.be.revertedWith("InvalidConfBoostersAssetType()");
      });

      it("should configure boosters correctly", async function () {
        const viewFacetABI = await hre.artifacts.readArtifact(
          "StakerV3FacetViews"
        );
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);

        const configOfBoosters = [
          {
            multiplier: 2300,
            amountRequired: 3,
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
        ];

        await diamondCoreFacet
          .connect(owner)
          .configureBoostersBatch([1, 2], configOfBoosters);

        const getBoosterCountData = await diamondViewFacet
          .connect(owner)
          .getBoostersCount();

        let getBoosterInfo = [];
        getBoosterInfo[0] = await diamondViewFacet
          .connect(owner)
          .getBoosterInfo(1);

        getBoosterInfo[1] = await diamondViewFacet
          .connect(owner)
          .getBoosterInfo(2);

        expect(await configOfBoosters[0].multiplier).to.be.eq(
          getBoosterInfo[0].multiplier
        );
        expect(await configOfBoosters[1].multiplier).to.be.eq(
          getBoosterInfo[1].multiplier
        );
        expect(await getBoosterCountData).to.be.eq(2);
      });

      it("should change existed boosters correctly", async function () {
        const viewFacetABI = await hre.artifacts.readArtifact(
          "StakerV3FacetViews"
        );
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);

        const configOfBoosters = [
          {
            multiplier: 2300,
            amountRequired: 3,
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
        ];

        await diamondCoreFacet
          .connect(owner)
          .configureBoostersBatch([1, 2], configOfBoosters);

        await diamondCoreFacet.connect(owner).configureBoostersBatch(
          [1],
          [
            {
              multiplier: 0,
              amountRequired: 3,
              groupRequired: itemGroupId2,
              contractRequired: super721.address,
              boostType: 2,
              typeOfAsset: 1,
              historyOfTokenMultipliers: [],
              historyOfPointMultipliers: [],
            },
          ]
        );

        await diamondCoreFacet.connect(owner).configureBoostersBatch(
          [2],
          [
            {
              multiplier: 26000,
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

        const getBoosterCountData = await diamondViewFacet
          .connect(owner)
          .getBoostersCount();

        let getBoosterInfo = [];
        getBoosterInfo[0] = await diamondViewFacet
          .connect(owner)
          .getBoosterInfo(1);

        getBoosterInfo[1] = await diamondViewFacet
          .connect(owner)
          .getBoosterInfo(2);

        expect(await getBoosterInfo[0].multiplier).to.be.eq(0);
        expect(await getBoosterInfo[1].multiplier).to.be.eq(26000);
        expect(await getBoosterCountData).to.be.eq(1);
      });
    });

    describe("addPool, overwrtite pool, getPoolCount", function () {
      it("Reverts: emission schedule not defined", async function () {
        await expect(
          diamondCoreFacet.connect(owner).addPool({
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
          })
        ).to.be.revertedWith("EmissionNotSet()");
      });

      it("Reverts: pool token is ERC20 token", async function () {
        await diamondCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );

        await expect(
          diamondCoreFacet.connect(owner).addPool({
            id: 0,
            tokenStrength: 10000,
            pointStrength: 10000,
            groupId: 0,
            tokensPerShare: 0,
            pointsPerShare: 0,
            compoundInterestThreshold: ethers.utils.parseEther("1000"),
            compoundInterestMultiplier: 5000,
            boostInfo: [1, 2],
            assetAddress: rewardToken.address,
            typeOfAsset: 1,
            lockPeriod: 0,
            lockAmount: 0,
            lockMultiplier: 0,
            timeLockTypeOfBoost: 0,
            compoundTypeOfBoost: 0,
            typeOfPool: 0,
          })
        ).to.be.reverted;
      });

      it("Reverts: mismatch typeOfAsset and real asset type", async function () {
        await diamondCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );

        await expect(
          diamondCoreFacet.connect(owner).addPool({
            id: 0,
            tokenStrength: 10000,
            pointStrength: 10000,
            groupId: 0,
            tokensPerShare: 0,
            pointsPerShare: 0,
            compoundInterestThreshold: ethers.utils.parseEther("1000"),
            compoundInterestMultiplier: 5000,
            boostInfo: [1, 2],
            assetAddress: super1155.address,
            typeOfAsset: 1,
            lockPeriod: 0,
            lockAmount: 0,
            lockMultiplier: 0,
            timeLockTypeOfBoost: 0,
            compoundTypeOfBoost: 0,
            typeOfPool: 0,
          })
        ).to.be.revertedWith("InvalidAsset()");

        await expect(
          diamondCoreFacet.connect(owner).addPool({
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
            typeOfAsset: 2,
            lockPeriod: 0,
            lockAmount: 0,
            lockMultiplier: 0,
            timeLockTypeOfBoost: 0,
            compoundTypeOfBoost: 0,
            typeOfPool: 0,
          })
        ).to.be.revertedWith("InvalidAsset()");
      });

      it("Reverts: token or point strength of the pool is set to 0 or less", async function () {
        await diamondCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );

        await expect(
          diamondCoreFacet.connect(owner).addPool({
            id: 0,
            tokenStrength: 0,
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
          })
        ).to.be.revertedWith("ZeroStrength()");
      });

      // it("Reverts: ERC20 can't be as asset at pool for stake", async function () {
      //   await diamondCoreFacet.connect(owner).setEmissions(
      //     [
      //       {
      //         timeStamp: await utils.getCurrentTime(),
      //         rate: ethers.utils.parseEther("6.6666666666"),
      //       },
      //     ],
      //     [
      //       {
      //         timeStamp: await utils.getCurrentTime(),
      //         rate: ethers.utils.parseEther("6.6666666666"),
      //       },
      //     ]
      //   );

      //   await expect(diamondCoreFacet.connect(owner).addPool({
      //     id: 0,
      //     tokenStrength: 100,
      //     pointStrength: 10000,
      //     groupId: 0,
      //     tokensPerShare: 0,
      //     pointsPerShare: 0,
      //     compoundInterestThreshold: ethers.utils.parseEther("1000"),
      //     compoundInterestMultiplier: 5000,
      //     boostInfo: [1, 2],
      //     assetAddress: depositToken.address,
      //     typeOfAsset: 0,
      //     lockPeriod: 0,
      //     lockAmount: 0,
      //     lockMultiplier: 0,
      //     timeLockTypeOfBoost: 0,
      //     compoundTypeOfBoost: 0,
      //   })).to.be.revertedWith("InvalidTypeOfAsset()");
      // });

      it("Reverts: when group id is required but it is ERC20 asset", async function () {
        await diamondCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );

        await expect(
          diamondCoreFacet.connect(owner).addPool({
            id: 1,
            tokenStrength: 10000,
            pointStrength: 10000,
            groupId: 1,
            tokensPerShare: 0,
            pointsPerShare: 0,
            compoundInterestThreshold: ethers.utils.parseEther("1000000"),
            compoundInterestMultiplier: 5000,
            boostInfo: [1, 2],
            assetAddress: depositToken.address,
            typeOfAsset: 0,
            lockPeriod: 0,
            lockAmount: 0,
            lockMultiplier: 0,
            timeLockTypeOfBoost: 0,
            compoundTypeOfBoost: 0,
            typeOfPool: 0,
          })
        ).to.be.revertedWith("InvalidGroupIdForERC20()");
      });

      it("should add a new pool, overwrite it and get pool count", async function () {
        const viewFacetABI = await hre.artifacts.readArtifact(
          "StakerV3FacetViews"
        );

        await diamondCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
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
          boostInfo: [1],
          assetAddress: super721.address,
          typeOfAsset: 1,
          lockPeriod: 0,
          lockAmount: 0,
          lockMultiplier: 0,
          timeLockTypeOfBoost: 0,
          compoundTypeOfBoost: 0,
          typeOfPool: 0,
        });

        let getPoolCount = await diamondViewFacet.connect(owner).getPoolCount();

        expect(await getPoolCount).to.be.eq(1);

        await diamondCoreFacet.connect(owner).addPool({
          id: 0,
          tokenStrength: 12000,
          pointStrength: 12000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          compoundInterestThreshold: ethers.utils.parseEther("1000"),
          compoundInterestMultiplier: 5000,
          boostInfo: [2],
          assetAddress: super721.address,
          typeOfAsset: 1,
          lockPeriod: 0,
          lockAmount: 0,
          lockMultiplier: 0,
          timeLockTypeOfBoost: 0,
          compoundTypeOfBoost: 0,
          typeOfPool: 0,
        });

        getPoolCount = await diamondViewFacet.connect(owner).getPoolCount();
        expect(await getPoolCount).to.be.eq(1);
      });
    });

    describe("onERC721Received", function () {
      it("should work correctly", async function () {
        await diamondCoreFacet
          .connect(owner)
          .onERC721Received(owner.address, signer1.address, 1, [0x01, 0x02]);
      });
    });
  });

  describe("Staking Facet testings", function () {
    let viewFacetABI;
    describe("deposit, getItemsUserInfo", function () {
      beforeEach(async function () {
        viewFacetABI = await hre.artifacts.readArtifact("StakerV3FacetViews");
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);
        let itemGroupId3 = ethers.BigNumber.from(3);
        let shiftedItemGroupId3 = itemGroupId3.shl(128);

        await depositToken.transfer(
          signer1.address,
          ethers.utils.parseEther("1000")
        );
        await depositToken.transfer(
          signer2.address,
          ethers.utils.parseEther("1000")
        );
        await depositToken.transfer(
          signer3.address,
          ethers.utils.parseEther("1000")
        );
        await depositToken
          .connect(signer1)
          .approve(stakerV3dsProxy.address, ethers.utils.parseEther("1000"));
        await depositToken
          .connect(signer2)
          .approve(stakerV3dsProxy.address, ethers.utils.parseEther("1000"));
        await depositToken
          .connect(signer3)
          .approve(stakerV3dsProxy.address, ethers.utils.parseEther("1000"));
        await rewardToken.transfer(
          stakerV3dsProxy.address,
          ethers.utils.parseEther("500000")
        );

        //await stakerV3FacetCore.connect(owner).initialize(owner.address);

        // Note 6.6666666666 per second is equivalent to 100 per 15 seconds(15 seconds = block time according to Blocks implementation)
        // Now the rewards must be set based on seconds
        await diamondCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );

        await diamondCoreFacet.connect(owner).configureBoostersBatch(
          [1, 2],
          [
            {
              multiplier: 2300,
              amountRequired: 3,
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
          supplyData: 10,
          burnType: 0,
          burnData: 0,
        });
        await super721
          .connect(owner)
          .mintBatch(
            signer1.address,
            [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
              shiftedItemGroupId2.add(3),
              shiftedItemGroupId2.add(4),
              shiftedItemGroupId2.add(5),
              shiftedItemGroupId2.add(6),
            ],
            DATA
          );
        await super721
          .connect(owner)
          .mintBatch(
            signer2.address,
            [
              shiftedItemGroupId2.add(7),
              shiftedItemGroupId2.add(8),
              shiftedItemGroupId2.add(9),
            ],
            DATA
          );
        await super721.connect(owner).configureGroup(itemGroupId3, {
          name: "PEPSI2",
          supplyType: 0,
          supplyData: 11,
          burnType: 0,
          burnData: 0,
        });
        await super721
          .connect(owner)
          .mintBatch(
            signer1.address,
            [
              shiftedItemGroupId3,
              shiftedItemGroupId3.add(1),
              shiftedItemGroupId3.add(2),
            ],
            DATA
          );
        await super721
          .connect(signer1)
          .setApprovalForAll(stakerV3dsProxy.address, true);
        await super721
          .connect(signer2)
          .setApprovalForAll(stakerV3dsProxy.address, true);

        // Mint ITEMS for Signer2
        await super1155.connect(owner).configureGroup(itemGroupId, {
          name: "PEPSI",
          supplyType: 0,
          supplyData: 100,
          itemType: 2,
          itemData: 20,
          burnType: 0,
          burnData: 0,
        });
        await super1155
          .connect(owner)
          .mintBatch(
            signer2.address,
            [shiftedItemGroupId, shiftedItemGroupId.add(1)],
            [20, 10],
            DATA
          );
        await super1155
          .connect(signer2)
          .setApprovalForAll(stakerV3dsProxy.address, true);
      });

      it("Reverts: deposit in pool with group requires, not an group item", async function () {
        await diamondCoreFacet.connect(owner).addPool({
          id: 1,
          tokenStrength: 10000,
          pointStrength: 10000,
          groupId: itemGroupId,
          tokensPerShare: 0,
          pointsPerShare: 0,
          compoundInterestThreshold: ethers.utils.parseEther("1000000"),
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

        await expect(
          diamondStakingFacet.connect(signer1).deposit(
            1,
            {
              assetAddress: super721.address,
              id: [
                shiftedItemGroupId2,
                shiftedItemGroupId2.add(1),
                shiftedItemGroupId2.add(2),
              ],
              amounts: [1, 2, 3],
              IOUTokenId: [],
            },
            false
          )
        ).to.be.revertedWith("InvalidGroupIdForStake()");
      });

      it("Should deposit correctly with group id requires", async function () {
        await diamondCoreFacet.connect(owner).addPool({
          id: 1,
          tokenStrength: 10000,
          pointStrength: 10000,
          groupId: itemGroupId2,
          tokensPerShare: 0,
          pointsPerShare: 0,
          compoundInterestThreshold: ethers.utils.parseEther("1000000"),
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

        await diamondStakingFacet.connect(signer1).deposit(
          1,
          {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          },
          false
        );
      });

      it("Reverts: when asset is ERC20 and amounts array length not equal 1", async function () {
        await diamondCoreFacet.connect(owner).addPool({
          id: 1,
          tokenStrength: 10000,
          pointStrength: 10000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          compoundInterestThreshold: ethers.utils.parseEther("1000000"),
          compoundInterestMultiplier: 5000,
          boostInfo: [1, 2],
          assetAddress: depositToken.address,
          typeOfAsset: 0,
          lockPeriod: 0,
          lockAmount: 0,
          lockMultiplier: 0,
          timeLockTypeOfBoost: 0,
          compoundTypeOfBoost: 0,
          typeOfPool: 0,
        });

        await expect(
          diamondStakingFacet.connect(signer1).deposit(
            1,
            {
              assetAddress: depositToken.address,
              id: [1, 2],
              amounts: [ethers.utils.parseEther("100"), 20],
              IOUTokenId: [],
            },
            false
          )
        ).to.be.revertedWith("InvalidERC20DepositInputs()");
      });

      it("ERC20 staking asset tests", async function () {
        await diamondCoreFacet.connect(owner).addPool({
          id: 1,
          tokenStrength: 10000,
          pointStrength: 10000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          compoundInterestThreshold: ethers.utils.parseEther("1000000"),
          compoundInterestMultiplier: 5000,
          boostInfo: [1, 2],
          assetAddress: depositToken.address,
          typeOfAsset: 0,
          lockPeriod: 0,
          lockAmount: 0,
          lockMultiplier: 0,
          timeLockTypeOfBoost: 0,
          compoundTypeOfBoost: 0,
          typeOfPool: 0,
        });

        await diamondStakingFacet.connect(signer1).deposit(
          1,
          {
            assetAddress: depositToken.address,
            id: [1],
            amounts: [ethers.utils.parseEther("100")],
            IOUTokenId: [],
          },
          false
        );

        startOfStaking = await utils.getCurrentTime();

        await network.provider.send("evm_setNextBlockTimestamp", [
          startOfStaking + 30,
        ]);
        await ethers.provider.send("evm_mine", []);

        await diamondStakingFacet.connect(signer1).withdraw(1, [0]);

        //User2-Claims
        await diamondStakingFacet.connect(signer1).claim(1, []);

        expect(await rewardToken.balanceOf(signer1.address)).to.be.closeTo(
          ethers.utils.parseEther("103.3333"),
          ethers.utils.parseEther("0.01")
        );
      });

      it("Reverts: Inactive pool", async function () {
        await expect(
          diamondStakingFacet.connect(signer1).deposit(
            5,
            {
              assetAddress: super721.address,
              id: [1, 2, 3],
              amounts: [1, 1, 1],
              IOUTokenId: [],
            },
            false
          )
        ).to.be.revertedWith("InactivePool()");
      });

      it("Reverts: wrong asset deposited", async function () {
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);

        await expect(
          diamondStakingFacet.connect(signer1).deposit(
            0,
            {
              assetAddress: some721.address,
              id: [
                shiftedItemGroupId2,
                shiftedItemGroupId2.add(1),
                shiftedItemGroupId2.add(2),
              ],
              amounts: [1, 2, 3],
              IOUTokenId: [],
            },
            false
          )
        ).to.be.revertedWith("InvalidAssetToStake()");
      });

      it("Reverts: you can't deposit erc721 amounts other than 1", async function () {
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);

        await expect(
          diamondStakingFacet.connect(signer1).deposit(
            0,
            {
              assetAddress: super721.address,
              id: [
                shiftedItemGroupId2,
                shiftedItemGroupId2.add(1),
                shiftedItemGroupId2.add(2),
              ],
              amounts: [1, 2, 3],
              IOUTokenId: [],
            },
            false
          )
        ).to.be.revertedWith("InvalidERC721Amount()");
      });

      it("should deposit at pool correctly", async function () {
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);

        await diamondStakingFacet.connect(signer1).deposit(
          0,
          {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          },
          false
        );

        expect(await super721.balanceOf(signer1.address)).to.be.eq(7);
        expect(await super721.ownerOf(shiftedItemGroupId2)).to.be.eq(
          stakerV3dsProxy.address
        );
        expect(await super721.ownerOf(shiftedItemGroupId2.add(1))).to.be.eq(
          stakerV3dsProxy.address
        );

        expect(await IOUToken.balanceOf(signer1.address)).to.be.eq(3);
        expect(await IOUToken.ownerOf(0)).to.be.eq(signer1.address);
        expect(await IOUToken.ownerOf(1)).to.be.eq(signer1.address);
      });

      it("Reverts: wrong booster id for stake", async function () {
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);

        await expect(
          diamondBoostersFacet.connect(signer1).stakeItemsBatch(0, 10, {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          })
        ).to.be.revertedWith("InvalidInfoStakeForBoost()");
      });

      it("Reverts: mismatch of id and amounts arrays lentghs", async function () {
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);

        await expect(
          diamondBoostersFacet.connect(signer1).stakeItemsBatch(0, 1, {
            assetAddress: some721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1],
            IOUTokenId: [],
          })
        ).to.be.revertedWith("AssetArrayLengthsMismatch()");

        await expect(
          diamondStakingFacet.connect(signer1).deposit(
            0,
            {
              assetAddress: super721.address,
              id: [
                shiftedItemGroupId2,
                shiftedItemGroupId2.add(1),
                shiftedItemGroupId2.add(2),
              ],
              amounts: [1, 1],
              IOUTokenId: [],
            },
            false
          )
        ).to.be.revertedWith("AssetArrayLengthsMismatch()");
      });

      it("Reverts: check that you not eligible to stake in the pool for booster", async function () {
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);
        let itemGroupId3 = ethers.BigNumber.from(3);
        let shiftedItemGroupId3 = itemGroupId3.shl(128);

        // incorrect asset
        await expect(
          diamondBoostersFacet.connect(signer1).stakeItemsBatch(0, 1, {
            assetAddress: some721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          })
        ).to.be.revertedWith("InvalidInfoStakeForBoost()");

        // incorrect amounts
        await expect(
          diamondBoostersFacet.connect(signer1).stakeItemsBatch(0, 1, {
            assetAddress: super721.address,
            id: [shiftedItemGroupId2, shiftedItemGroupId2.add(1)],
            amounts: [1, 1],
            IOUTokenId: [],
          })
        ).to.be.revertedWith("InvalidInfoStakeForBoost()");

        // incorrect group id
        await expect(
          diamondBoostersFacet.connect(signer1).stakeItemsBatch(0, 1, {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId3,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId3.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          })
        ).to.be.revertedWith("InvalidInfoStakeForBoost()");

        // setting booster multiplier to 0
        await diamondCoreFacet.connect(owner).configureBoostersBatch(
          [1],
          [
            {
              multiplier: 0,
              amountRequired: 3,
              groupRequired: itemGroupId2,
              contractRequired: super721.address,
              boostType: 2,
              typeOfAsset: 1,
              historyOfTokenMultipliers: [],
              historyOfPointMultipliers: [],
            },
          ]
        );

        // cant stake for booster with multiplier 0
        await expect(
          diamondBoostersFacet.connect(signer1).stakeItemsBatch(0, 1, {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          })
        ).to.be.revertedWith("InvalidInfoStakeForBoost()");
      });

      it("should stake items at pool for boosters correctly", async function () {
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);

        await diamondBoostersFacet.connect(signer1).stakeItemsBatch(0, 1, {
          assetAddress: super721.address,
          id: [
            shiftedItemGroupId2,
            shiftedItemGroupId2.add(1),
            shiftedItemGroupId2.add(2),
          ],
          amounts: [1, 1, 1],
          IOUTokenId: [],
        });

        expect(await super721.balanceOf(signer1.address)).to.be.eq(7);
        expect(await super721.ownerOf(shiftedItemGroupId2)).to.be.eq(
          stakerV3dsProxy.address
        );
        expect(await super721.ownerOf(shiftedItemGroupId2.add(1))).to.be.eq(
          stakerV3dsProxy.address
        );

        expect(await IOUToken.balanceOf(signer1.address)).to.be.eq(0);

        let getItemsUserInfo = await diamondViewFacet
          .connect(owner)
          .getItemsUserInfo(signer1.address, 1);

        expect(await getItemsUserInfo.tokenIds[0]).to.be.eq(
          shiftedItemGroupId2
        );
        expect(await getItemsUserInfo.tokenIds[1]).to.be.eq(
          shiftedItemGroupId2.add(1)
        );
        expect(await getItemsUserInfo.tokenIds[2]).to.be.eq(
          shiftedItemGroupId2.add(2)
        );
      });
    });

    describe("withdraw, claim", function () {
      beforeEach(async function () {
        viewFacetABI = await hre.artifacts.readArtifact("StakerV3FacetViews");
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);
        let itemGroupId3 = ethers.BigNumber.from(3);
        let shiftedItemGroupId3 = itemGroupId3.shl(128);

        await depositToken.transfer(
          signer1.address,
          ethers.utils.parseEther("1000")
        );
        await depositToken.transfer(
          signer2.address,
          ethers.utils.parseEther("1000")
        );
        await rewardToken.transfer(
          stakerV3dsProxy.address,
          ethers.utils.parseEther("500000")
        );

        //await stakerV3FacetCore.connect(owner).initialize(owner.address);

        // Note 6.6666666666 per second is equivalent to 100 per 15 seconds(15 seconds = block time according to Blocks implementation)
        // Now the rewards must be set based on seconds
        await diamondCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );

        await diamondCoreFacet.connect(owner).configureBoostersBatch(
          [1, 2],
          [
            {
              multiplier: 2300,
              amountRequired: 3,
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

        await diamondCoreFacet.connect(owner).addPool({
          id: 1,
          tokenStrength: 10000,
          pointStrength: 10000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          compoundInterestThreshold: ethers.utils.parseEther("1000"),
          compoundInterestMultiplier: 5000,
          boostInfo: [1, 2],
          assetAddress: super1155.address,
          typeOfAsset: 2,
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
          supplyData: 10,
          burnType: 0,
          burnData: 0,
        });
        await super721
          .connect(owner)
          .mintBatch(
            signer1.address,
            [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
              shiftedItemGroupId2.add(3),
              shiftedItemGroupId2.add(4),
              shiftedItemGroupId2.add(5),
              shiftedItemGroupId2.add(6),
            ],
            DATA
          );
        await super721
          .connect(owner)
          .mintBatch(
            signer2.address,
            [
              shiftedItemGroupId2.add(7),
              shiftedItemGroupId2.add(8),
              shiftedItemGroupId2.add(9),
            ],
            DATA
          );
        await super721.connect(owner).configureGroup(itemGroupId3, {
          name: "PEPSI2",
          supplyType: 0,
          supplyData: 11,
          burnType: 0,
          burnData: 0,
        });
        await super721
          .connect(owner)
          .mintBatch(
            signer1.address,
            [
              shiftedItemGroupId3,
              shiftedItemGroupId3.add(1),
              shiftedItemGroupId3.add(2),
            ],
            DATA
          );
        await super721
          .connect(signer1)
          .setApprovalForAll(stakerV3dsProxy.address, true);
        await super721
          .connect(signer2)
          .setApprovalForAll(stakerV3dsProxy.address, true);

        // Mint ITEMS for Signer2
        await super1155.connect(owner).configureGroup(itemGroupId, {
          name: "PEPSI",
          supplyType: 0,
          supplyData: 100,
          itemType: 2,
          itemData: 20,
          burnType: 0,
          burnData: 0,
        });
        await super1155
          .connect(owner)
          .mintBatch(
            signer2.address,
            [shiftedItemGroupId, shiftedItemGroupId.add(1)],
            [20, 10],
            DATA
          );
        await super1155
          .connect(signer2)
          .setApprovalForAll(stakerV3dsProxy.address, true);
      });

      it("Reverts: booster not available for this user", async function () {
        await expect(
          diamondBoostersFacet.connect(owner).unstakeItemsBatch(0, 1)
        ).to.be.revertedWith("NotStaked()");
      });

      // it("Reverts: withdraw amount exceeds user's amount on staking", async function () {
      //   await expect(diamondStakingFacet
      //     .connect(owner)
      //     .withdraw(0, {
      //       assetAddress: super721.address,
      //       id: [
      //         shiftedItemGroupId2.add(3),
      //         shiftedItemGroupId2.add(4),
      //         shiftedItemGroupId2.add(5),
      //       ],
      //       amounts: [1, 1, 1],
      //       IOUTokenId: [],
      //     })).to.be.revertedWith("InvalidAmount()");
      // });

      // it("Reverts: withdraw amount exceeds user's amount on staking", async function () {
      //   await expect(diamondStakingFacet.connect(owner).withdraw(
      //     0,
      //     {
      //       assetAddress: super721.address,
      //       id: [
      //         shiftedItemGroupId2.add(3),
      //         shiftedItemGroupId2.add(4),
      //         shiftedItemGroupId2.add(5),
      //       ],
      //       amounts: [1, 1, 1],
      //       IOUTokenId: [],
      //     }
      //   )).to.be.revertedWith("InvalidAmount()");
      // });

      // it("Reverts: balance of IOU token is zero", async function () {
      //   await expect(diamondStakingFacet.connect(owner).withdraw(
      //     0,
      //     {
      //       assetAddress: super721.address,
      //       id: [
      //         shiftedItemGroupId2.add(3),
      //         shiftedItemGroupId2.add(4),
      //         shiftedItemGroupId2.add(5),
      //       ],
      //       amounts: [0, 0, 0],
      //       IOUTokenId: [],
      //     }
      //   )).to.be.revertedWith("0x2E");
      // });

      it("Reverts: trying to withdraw with incorrect IOUToken id", async function () {
        await diamondStakingFacet.connect(signer1).deposit(
          0,
          {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          },
          false
        );

        await expect(
          diamondStakingFacet.connect(owner).withdraw(0, [0])
        ).to.be.revertedWith("NotAnOwnerOfIOUToken()");

        await IOUToken.connect(signer1).transferFrom(
          signer1.address,
          signer2.address,
          0
        );
      });

      it("Reverts: trying to withdraw with IOUToken related to other pool", async function () {
        await diamondCoreFacet.connect(owner).addPool({
          id: 1,
          tokenStrength: 10000,
          pointStrength: 10000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          compoundInterestThreshold: ethers.utils.parseEther("1000"),
          compoundInterestMultiplier: 5000,
          boostInfo: [1, 2],
          assetAddress: super1155.address,
          typeOfAsset: 2,
          lockPeriod: 0,
          lockAmount: 0,
          lockMultiplier: 0,
          timeLockTypeOfBoost: 0,
          compoundTypeOfBoost: 0,
          typeOfPool: 0,
        });

        await diamondStakingFacet.connect(signer1).deposit(
          0,
          {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          },
          false
        );

        await diamondStakingFacet.connect(signer2).deposit(
          1,
          {
            assetAddress: super1155.address,
            id: [shiftedItemGroupId, shiftedItemGroupId.add(1)],
            amounts: [1, 1],
            IOUTokenId: [],
          },
          false
        );

        await IOUToken.connect(signer1).transferFrom(
          signer1.address,
          signer2.address,
          0
        );

        await expect(
          diamondStakingFacet.connect(signer2).withdraw(1, [0])
        ).to.be.revertedWith("IOUTokenFromDifferentPool()");
      });

      it("should withdraw correctly", async function () {
        await diamondStakingFacet.connect(signer1).deposit(
          0,
          {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          },
          false
        );

        await diamondStakingFacet.connect(signer2).deposit(
          1,
          {
            assetAddress: super1155.address,
            id: [shiftedItemGroupId, shiftedItemGroupId.add(1)],
            amounts: [10, 10],
            IOUTokenId: [],
          },
          false
        );

        await diamondBoostersFacet.connect(signer1).stakeItemsBatch(0, 1, {
          assetAddress: super721.address,
          id: [
            shiftedItemGroupId2.add(3),
            shiftedItemGroupId2.add(4),
            shiftedItemGroupId2.add(5),
          ],
          amounts: [1, 1, 1],
          IOUTokenId: [],
        });

        expect(await IOUToken.balanceOf(signer1.address)).to.be.eq(3);
        expect(await IOUToken.ownerOf(0)).to.be.eq(signer1.address);
        expect(await IOUToken.ownerOf(1)).to.be.eq(signer1.address);
        expect(await IOUToken.ownerOf(2)).to.be.eq(signer1.address);

        await diamondStakingFacet.connect(signer1).withdraw(0, [0, 1, 2]);

        expect(await IOUToken.balanceOf(signer1.address)).to.be.eq(0);

        await diamondBoostersFacet.connect(signer1).unstakeItemsBatch(0, 1);

        await diamondStakingFacet.connect(signer2).withdraw(1, [3, 4]);
      });

      it("should claim correctly", async function () {
        await diamondBoostersFacet.connect(signer1).stakeItemsBatch(0, 1, {
          assetAddress: super721.address,
          id: [
            shiftedItemGroupId2.add(3),
            shiftedItemGroupId2.add(4),
            shiftedItemGroupId2.add(5),
          ],
          amounts: [1, 1, 1],
          IOUTokenId: [],
        });

        await diamondStakingFacet.connect(signer1).deposit(
          0,
          {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          },
          false
        );

        const startOfStaking = await (
          await ethers.provider.getBlock()
        ).timestamp;

        expect(await IOUToken.balanceOf(signer1.address)).to.be.eq(3);
        expect(await IOUToken.ownerOf(0)).to.be.eq(signer1.address);
        expect(await IOUToken.ownerOf(1)).to.be.eq(signer1.address);
        expect(await IOUToken.ownerOf(2)).to.be.eq(signer1.address);

        await network.provider.send("evm_setNextBlockTimestamp", [
          startOfStaking + 28,
        ]);
        await ethers.provider.send("evm_mine", []);

        await diamondStakingFacet.connect(signer1).claim(0, []);

        // expect(
        //   await rewardToken.connect(signer1).balanceOf(signer1.address)
        // ).to.be.closeTo(ethers.utils.parseEther("1.0"));
        // expect(await rewardToken.balanceOf(signer1.address)).to.be.closeTo(
        //   ethers.utils.parseEther("200"),
        //   ethers.utils.parseEther("0.01")
        // );

        await diamondBoostersFacet.connect(signer1).unstakeItemsBatch(0, 1);

        await diamondStakingFacet.connect(signer1).withdraw(0, [0, 1, 2]);

        //expect(await IOUToken.balanceOf(signer1.address)).to.be.eq(0);

        await network.provider.send("evm_increaseTime", [30]);
        await ethers.provider.send("evm_mine", []);

        await diamondStakingFacet.connect(signer1).claim(0, []);
      });

      // it("Reverts: checkpoints start time and end time must be same lengths", async function () {
      //   const blockTime = await utils.getCurrentTime();

      //   const signedDataHash = ethers.utils.solidityKeccak256(
      //     ["uint256[]", "uint256[]", "uint256[]"],
      //     [
      //       [blockTime - 1000, blockTime],
      //       [blockTime + 1, blockTime + 1000],
      //       [3000, 2000],
      //     ]
      //   );

      //   const bytesArray = ethers.utils.arrayify(signedDataHash);

      //   const flatSignature1 = await signer1.signMessage(bytesArray);

      //   const signature1 = ethers.utils.splitSignature(flatSignature1);

      //   let signedDataHashBytes = ethers.utils.hexZeroPad(
      //     ethers.utils.hexlify(signedDataHash),
      //     32
      //   );
      //   let vBytes = ethers.utils.hexZeroPad(
      //     ethers.utils.hexlify(signature1.v),
      //     32
      //   );
      //   let rBytes = ethers.utils.hexZeroPad(
      //     ethers.utils.hexlify(signature1.r),
      //     32
      //   );
      //   let sBytes = ethers.utils.hexZeroPad(
      //     ethers.utils.hexlify(signature1.s),
      //     32
      //   );

      //   let lengthBytes = ethers.utils.hexZeroPad(ethers.utils.hexlify(2), 32);

      //   let startTimeBytes1 = ethers.utils.hexZeroPad(
      //     ethers.utils.hexlify(blockTime - 1000),
      //     32
      //   );
      //   let startTimeBytes2 = ethers.utils.hexZeroPad(
      //     ethers.utils.hexlify(blockTime),
      //     32
      //   );
      //   let endTimeBytes1 = ethers.utils.hexZeroPad(
      //     ethers.utils.hexlify(blockTime + 1),
      //     32
      //   );
      //   let endTimeBytes2 = ethers.utils.hexZeroPad(
      //     ethers.utils.hexlify(blockTime + 1000),
      //     32
      //   );
      //   let balanceBytes1 = ethers.utils.hexZeroPad(
      //     ethers.utils.hexlify(3000),
      //     32
      //   );
      //   let balanceBytes2 = ethers.utils.hexZeroPad(
      //     ethers.utils.hexlify(2000),
      //     32
      //   );

      //   let callDataBytes = ethers.utils.hexConcat([
      //     signedDataHashBytes,
      //     vBytes,
      //     rBytes,
      //     sBytes,
      //     lengthBytes,
      //     startTimeBytes1,
      //     startTimeBytes2,
      //     endTimeBytes1,
      //     endTimeBytes2,
      //     balanceBytes1,
      //     balanceBytes2,
      //   ]);

      //   await expect(diamondStakingFacet.connect(signer1).claim(
      //     0,
      //     callDataBytes
      //     // signedDataHash,
      //     // {
      //     //   v: signature1.v,
      //     //   r: signature1.r,
      //     //   s: signature1.s,
      //     // },
      //     // {
      //     //   startTime: [blockTime - 1000, blockTime],
      //     //   endTime: [blockTime + 1, blockTime + 1000],
      //     //   balance: [3000, 2000, 1],
      //     // }
      //   )).to.be.revertedWith(
      //     "StakerV3FacetStaking::claim: mismatch of start time end time or balances arrays lengths."
      //   );
      // });

      it("Reverts: wrong signature", async function () {
        const blockTime = await utils.getCurrentTime();

        const signedDataHash = ethers.utils.solidityKeccak256(
          ["uint256[]", "uint256[]", "uint256[]"],
          [
            [blockTime - 1000, blockTime],
            [blockTime + 1, blockTime + 1000],
            [3000, 2000],
          ]
        );

        const bytesArray = ethers.utils.arrayify(signedDataHash);

        const flatSignature1 = await signer1.signMessage(bytesArray);

        const signature1 = ethers.utils.splitSignature(flatSignature1);

        let signedDataHashBytes = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(signedDataHash),
          32
        );
        let vBytes = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(signature1.v),
          32
        );
        let rBytes = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(signature1.r),
          32
        );
        let sBytes = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(signature1.s),
          32
        );

        let lengthBytes = ethers.utils.hexZeroPad(ethers.utils.hexlify(2), 32);

        let startTimeBytes1 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(blockTime - 1000),
          32
        );
        let startTimeBytes2 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(blockTime),
          32
        );
        let endTimeBytes1 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(blockTime + 1),
          32
        );
        let endTimeBytes2 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(blockTime + 1000),
          32
        );
        let balanceBytes1 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(3000),
          32
        );
        let balanceBytes2 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(2000),
          32
        );

        let callDataBytes = ethers.utils.hexConcat([
          signedDataHashBytes,
          vBytes,
          rBytes,
          sBytes,
          lengthBytes,
          startTimeBytes1,
          startTimeBytes2,
          endTimeBytes1,
          endTimeBytes2,
          balanceBytes1,
          balanceBytes2,
        ]);

        await expect(
          diamondStakingFacet.connect(signer1).claim(
            0,
            callDataBytes
            // signedDataHash,
            // {
            //   v: 0,
            //   r: signature1.r,
            //   s: signature1.s,
            // },
            // {
            //   startTime: [blockTime - 1000, blockTime],
            //   endTime: [blockTime + 1, blockTime + 1000],
            //   balance: [3000, 2000],
            // }
          )
        ).to.be.revertedWith("NotAnAdmin()");
      });

      it("Reverts: mismatch given arguments with hashed arguments", async function () {
        const blockTime = await utils.getCurrentTime();

        const signedDataHash = ethers.utils.solidityKeccak256(
          ["uint256[]", "uint256[]", "uint256[]"],
          [
            [blockTime - 1000, blockTime],
            [blockTime + 1, blockTime + 1000],
            [3000, 2000],
          ]
        );

        const bytesArray = ethers.utils.arrayify(signedDataHash);

        const flatSignature1 = await admin.signMessage(bytesArray);

        const signature1 = ethers.utils.splitSignature(flatSignature1);

        let signedDataHashBytes = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(signedDataHash),
          32
        );
        let vBytes = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(signature1.v),
          32
        );
        let rBytes = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(signature1.r),
          32
        );
        let sBytes = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(signature1.s),
          32
        );

        let lengthBytes = ethers.utils.hexZeroPad(ethers.utils.hexlify(2), 32);

        let startTimeBytes1 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(blockTime - 100),
          32
        );
        let startTimeBytes2 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(blockTime),
          32
        );
        let endTimeBytes1 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(blockTime + 1),
          32
        );
        let endTimeBytes2 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(blockTime + 1000),
          32
        );
        let balanceBytes1 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(3000),
          32
        );
        let balanceBytes2 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(2000),
          32
        );

        let callDataBytes = ethers.utils.hexConcat([
          signedDataHashBytes,
          vBytes,
          rBytes,
          sBytes,
          lengthBytes,
          startTimeBytes1,
          startTimeBytes2,
          endTimeBytes1,
          endTimeBytes2,
          balanceBytes1,
          balanceBytes2,
        ]);

        await expect(
          diamondStakingFacet.connect(admin).claim(
            0,
            callDataBytes
            // signedDataHash,
            // {
            //   v: signature1.v,
            //   r: signature1.r,
            //   s: signature1.s,
            // },
            // {
            //   startTime: [blockTime - 100, blockTime],
            //   endTime: [blockTime + 1, blockTime + 1000],
            //   balance: [3000, 2000],
            // }
          )
        ).to.be.revertedWith("MismatchArgumentsAndHash()");
      });

      it("Reverts: you can't use same hash", async function () {
        const blockTime = await utils.getCurrentTime();

        const signedDataHash = ethers.utils.solidityKeccak256(
          ["bytes32", "bytes32", "bytes32", "bytes32", "bytes32", "bytes32"],
          [
            ethers.utils.solidityKeccak256(
              ["uint256", "uint256"],
              [blockTime - 1000, blockTime]
            ),
            ethers.utils.solidityKeccak256(
              ["uint256", "uint256"],
              [blockTime + 1, blockTime + 1000]
            ),
            ethers.utils.solidityKeccak256(
              ["uint256", "uint256"],
              [3000, 2000]
            ),
            ethers.utils.solidityKeccak256(
              ["uint256", "uint256"],
              [3000, 2000]
            ),
            ethers.utils.solidityKeccak256(
              ["uint256", "uint256"],
              [
                ethers.utils.parseUnits("1.0", 12),
                ethers.utils.parseUnits("1.2", 12),
              ]
            ),
            ethers.utils.solidityKeccak256(
              ["uint256", "uint256"],
              [
                ethers.utils.parseUnits("1.0", 30),
                ethers.utils.parseUnits("1.2", 30),
              ]
            ),
          ]
        );

        const bytesArray = ethers.utils.arrayify(signedDataHash);

        const flatSignature1 = await admin.signMessage(bytesArray);

        const signature1 = ethers.utils.splitSignature(flatSignature1);

        let signedDataHashBytes = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(signedDataHash),
          32
        );
        let vBytes = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(signature1.v),
          32
        );
        let rBytes = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(signature1.r),
          32
        );
        let sBytes = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(signature1.s),
          32
        );

        let lengthBytes = ethers.utils.hexZeroPad(ethers.utils.hexlify(2), 32);

        let startTimeBytes1 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(blockTime - 1000),
          32
        );
        let startTimeBytes2 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(blockTime),
          32
        );
        let endTimeBytes1 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(blockTime + 1),
          32
        );
        let endTimeBytes2 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(blockTime + 1000),
          32
        );
        let tokensBalanceBytes1 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(3000),
          32
        );
        let tokensBalanceBytes2 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(2000),
          32
        );
        let pointsBalanceBytes1 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(3000),
          32
        );
        let pointsBalanceBytes2 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(2000),
          32
        );
        let tpsBytes1 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(ethers.utils.parseUnits("1.0", 12)),
          32
        );
        let tpsBytes2 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(ethers.utils.parseUnits("1.2", 12)),
          32
        );
        let ppsBytes1 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(ethers.utils.parseUnits("1.0", 30)),
          32
        );
        let ppsBytes2 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(ethers.utils.parseUnits("1.2", 30)),
          32
        );

        let callDataBytes = ethers.utils.hexConcat([
          signedDataHashBytes,
          vBytes,
          rBytes,
          sBytes,
          lengthBytes,
          startTimeBytes1,
          startTimeBytes2,
          endTimeBytes1,
          endTimeBytes2,
          tokensBalanceBytes1,
          tokensBalanceBytes2,
          pointsBalanceBytes1,
          pointsBalanceBytes2,
          tpsBytes1,
          tpsBytes2,
          ppsBytes1,
          ppsBytes2,
        ]);

        await diamondStakingFacet.connect(admin).claim(
          0,
          callDataBytes
          // signedDataHash,
          // {
          //   v: signature1.v,
          //   r: signature1.r,
          //   s: signature1.s,
          // },
          // {
          //   startTime: [blockTime - 1000, blockTime],
          //   endTime: [blockTime + 1, blockTime + 1000],
          //   balance: [3000, 2000],
          // }
        );

        await expect(
          diamondStakingFacet.connect(admin).claim(
            0,
            callDataBytes
            // signedDataHash,
            // {
            //   v: signature1.v,
            //   r: signature1.r,
            //   s: signature1.s,
            // },
            // {
            //   startTime: [blockTime - 1000, blockTime],
            //   endTime: [blockTime + 1, blockTime + 1000],
            //   balance: [3000, 2000],
            // }
          )
        ).to.be.revertedWith("HashUsed()");
      });

      it("should claim with checkpoints correctly", async function () {
        const blockTime = await utils.getCurrentTime();

        const signedDataHash = ethers.utils.solidityKeccak256(
          ["bytes32", "bytes32", "bytes32", "bytes32", "bytes32", "bytes32"],
          [
            ethers.utils.solidityKeccak256(
              ["uint256", "uint256"],
              [blockTime - 1000, blockTime]
            ),
            ethers.utils.solidityKeccak256(
              ["uint256", "uint256"],
              [blockTime + 1, blockTime + 1000]
            ),
            ethers.utils.solidityKeccak256(
              ["uint256", "uint256"],
              [3000, 2000]
            ),
            ethers.utils.solidityKeccak256(
              ["uint256", "uint256"],
              [3000, 2000]
            ),
            ethers.utils.solidityKeccak256(
              ["uint256", "uint256"],
              [
                ethers.utils.parseUnits("1.0", 12),
                ethers.utils.parseUnits("1.2", 12),
              ]
            ),
            ethers.utils.solidityKeccak256(
              ["uint256", "uint256"],
              [
                ethers.utils.parseUnits("1.0", 30),
                ethers.utils.parseUnits("1.2", 30),
              ]
            ),
          ]
        );

        const bytesArray = ethers.utils.arrayify(signedDataHash);

        const flatSignature1 = await admin.signMessage(bytesArray);

        const signature1 = ethers.utils.splitSignature(flatSignature1);

        let signedDataHashBytes = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(signedDataHash),
          32
        );
        let vBytes = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(signature1.v),
          32
        );
        let rBytes = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(signature1.r),
          32
        );
        let sBytes = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(signature1.s),
          32
        );

        let lengthBytes = ethers.utils.hexZeroPad(ethers.utils.hexlify(2), 32);

        let startTimeBytes1 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(blockTime - 1000),
          32
        );
        let startTimeBytes2 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(blockTime),
          32
        );
        let endTimeBytes1 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(blockTime + 1),
          32
        );
        let endTimeBytes2 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(blockTime + 1000),
          32
        );
        let tokensBalanceBytes1 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(3000),
          32
        );
        let tokensBalanceBytes2 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(2000),
          32
        );
        let pointsBalanceBytes1 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(3000),
          32
        );
        let pointsBalanceBytes2 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(2000),
          32
        );
        let tpsBytes1 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(ethers.utils.parseUnits("1.0", 12)),
          32
        );
        let tpsBytes2 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(ethers.utils.parseUnits("1.2", 12)),
          32
        );
        let ppsBytes1 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(ethers.utils.parseUnits("1.0", 30)),
          32
        );
        let ppsBytes2 = ethers.utils.hexZeroPad(
          ethers.utils.hexlify(ethers.utils.parseUnits("1.2", 30)),
          32
        );

        let callDataBytes = ethers.utils.hexConcat([
          signedDataHashBytes,
          vBytes,
          rBytes,
          sBytes,
          lengthBytes,
          startTimeBytes1,
          startTimeBytes2,
          endTimeBytes1,
          endTimeBytes2,
          tokensBalanceBytes1,
          tokensBalanceBytes2,
          pointsBalanceBytes1,
          pointsBalanceBytes2,
          tpsBytes1,
          tpsBytes2,
          ppsBytes1,
          ppsBytes2,
        ]);

        await network.provider.send("evm_increaseTime", [30]);
        await ethers.provider.send("evm_mine", []);

        await diamondStakingFacet.connect(signer1).claim(
          0,
          callDataBytes
          // signedDataHash,
          // {
          //   v: signature1.v,
          //   r: signature1.r,
          //   s: signature1.s,
          // },
          // {
          //   startTime: [blockTime - 1000, blockTime],
          //   endTime: [blockTime + 1, blockTime + 1000],
          //   balance: [3000, 2000],
          // }
        );
        // expect(await rewardToken.balanceOf(signer1.address)).to.be.gt(0);
      });
    });
    // describe("onERC721Received", function () {
    //   it("should work correctly", async function () {
    //     await stakerV3FacetStaking
    //       .connect(owner)
    //       .onERC721Received(owner.address, signer1.address, 1, [0x01, 0x02]);
    //   });
    // });

    describe("approvePointSpender spendPoints, getPendingPoints, getTotalPoints", function () {
      it("approve should work correctly", async function () {
        await diamondPointsFacet
          .connect(owner)
          .approvePointSpender(signer2.address, true);
      });

      it("Reverts: spender is not approved", async function () {
        await expect(
          diamondPointsFacet.connect(signer1).spendPoints(signer2.address, 10)
        ).to.be.revertedWith("NotApprovedPointSpender()");
      });

      it("Reverts: amount exceeds available points", async function () {
        await diamondPointsFacet
          .connect(owner)
          .approvePointSpender(signer2.address, true);

        await expect(
          diamondPointsFacet.connect(signer2).spendPoints(signer1.address, 10)
        ).to.be.revertedWith("InvalidAmount()");
      });

      it("spendPoints should work correctly ", async function () {
        await diamondCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );

        await diamondCoreFacet.connect(owner).configureBoostersBatch(
          [1, 2],
          [
            {
              multiplier: 2300,
              amountRequired: 3,
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

        await super721.connect(owner).configureGroup(itemGroupId2, {
          name: "PEPSI",
          supplyType: 0,
          supplyData: 10,
          burnType: 0,
          burnData: 0,
        });
        await super721
          .connect(owner)
          .mintBatch(
            signer1.address,
            [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
              shiftedItemGroupId2.add(3),
              shiftedItemGroupId2.add(4),
              shiftedItemGroupId2.add(5),
              shiftedItemGroupId2.add(6),
            ],
            DATA
          );
        await super721
          .connect(owner)
          .mintBatch(
            signer2.address,
            [
              shiftedItemGroupId2.add(7),
              shiftedItemGroupId2.add(8),
              shiftedItemGroupId2.add(9),
            ],
            DATA
          );
        await super721
          .connect(signer1)
          .setApprovalForAll(stakerV3dsProxy.address, true);
        await super721
          .connect(signer2)
          .setApprovalForAll(stakerV3dsProxy.address, true);

        await diamondPointsFacet
          .connect(owner)
          .approvePointSpender(signer2.address, true);

        await diamondStakingFacet.connect(signer1).deposit(
          0,
          {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          },
          false
        );

        await network.provider.send("evm_increaseTime", [30]);
        await ethers.provider.send("evm_mine", []);

        await diamondStakingFacet.connect(signer1).deposit(
          0,
          {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2.add(3),
              shiftedItemGroupId2.add(4),
              shiftedItemGroupId2.add(5),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          },
          false
        );

        await diamondPointsFacet
          .connect(signer2)
          .spendPoints(signer1.address, 10);
      });
    });
    describe("apply boost", function () {
      beforeEach(async function () {
        await diamondCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );

        await diamondCoreFacet.connect(owner).configureBoostersBatch(
          [1, 2],
          [
            {
              multiplier: 2300,
              amountRequired: 3,
              groupRequired: itemGroupId2,
              contractRequired: super721.address,
              boostType: 0,
              typeOfAsset: 1,
              historyOfTokenMultipliers: [],
              historyOfPointMultipliers: [],
            },
            {
              multiplier: 2000,
              amountRequired: 2,
              groupRequired: 0,
              contractRequired: super721.address,
              boostType: 1,
              typeOfAsset: 1,
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

        await super721.connect(owner).configureGroup(itemGroupId2, {
          name: "PEPSI",
          supplyType: 0,
          supplyData: 10,
          burnType: 0,
          burnData: 0,
        });
        await super721
          .connect(owner)
          .mintBatch(
            signer1.address,
            [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
              shiftedItemGroupId2.add(3),
              shiftedItemGroupId2.add(4),
              shiftedItemGroupId2.add(5),
              shiftedItemGroupId2.add(6),
            ],
            DATA
          );
        await super721
          .connect(owner)
          .mintBatch(
            signer2.address,
            [
              shiftedItemGroupId2.add(7),
              shiftedItemGroupId2.add(8),
              shiftedItemGroupId2.add(9),
            ],
            DATA
          );
        await super721
          .connect(signer1)
          .setApprovalForAll(stakerV3dsProxy.address, true);
        await super721
          .connect(signer2)
          .setApprovalForAll(stakerV3dsProxy.address, true);
      });
      it("should work correctly with different/without boosts", async function () {
        await diamondBoostersFacet.connect(signer1).stakeItemsBatch(0, 1, {
          assetAddress: super721.address,
          id: [
            shiftedItemGroupId2,
            shiftedItemGroupId2.add(1),
            shiftedItemGroupId2.add(2),
          ],
          amounts: [1, 1, 1],
          IOUTokenId: [],
        });

        await network.provider.send("evm_increaseTime", [30]);
        await ethers.provider.send("evm_mine", []);

        await diamondBoostersFacet.connect(signer1).stakeItemsBatch(0, 2, {
          assetAddress: super721.address,
          id: [shiftedItemGroupId2.add(3), shiftedItemGroupId2.add(4)],
          amounts: [1, 1],
          IOUTokenId: [],
        });

        await diamondStakingFacet.connect(signer1).deposit(
          0,
          {
            assetAddress: super721.address,
            id: [shiftedItemGroupId2.add(5), shiftedItemGroupId2.add(6)],
            amounts: [1, 1],
            IOUTokenId: [],
          },
          false
        );

        await diamondCoreFacet.connect(owner).addPool({
          id: 1,
          tokenStrength: 15000,
          pointStrength: 15000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          compoundInterestThreshold: ethers.utils.parseEther("1000"),
          compoundInterestMultiplier: 5000,
          boostInfo: [],
          assetAddress: super721.address,
          typeOfAsset: 1,
          lockPeriod: 0,
          lockAmount: 0,
          lockMultiplier: 0,
          timeLockTypeOfBoost: 0,
          compoundTypeOfBoost: 0,
          typeOfPool: 0,
        });

        await diamondStakingFacet.connect(signer2).deposit(
          1,
          {
            assetAddress: super721.address,
            id: [shiftedItemGroupId2.add(7)],
            amounts: [1],
            IOUTokenId: [],
          },
          false
        );
      });

      it("should get total points correctly", async function () {
        await diamondBoostersFacet.connect(signer1).stakeItemsBatch(0, 1, {
          assetAddress: super721.address,
          id: [
            shiftedItemGroupId2,
            shiftedItemGroupId2.add(1),
            shiftedItemGroupId2.add(2),
          ],
          amounts: [1, 1, 1],
          IOUTokenId: [],
        });

        await network.provider.send("evm_increaseTime", [30]);
        await ethers.provider.send("evm_mine", []);

        await diamondBoostersFacet.connect(signer1).stakeItemsBatch(0, 2, {
          assetAddress: super721.address,
          id: [shiftedItemGroupId2.add(3), shiftedItemGroupId2.add(4)],
          amounts: [1, 1],
          IOUTokenId: [],
        });

        await diamondStakingFacet.connect(signer1).deposit(
          0,
          {
            assetAddress: super721.address,
            id: [shiftedItemGroupId2.add(5), shiftedItemGroupId2.add(6)],
            amounts: [1, 1],
            IOUTokenId: [],
          },
          false
        );

        await diamondCoreFacet.connect(owner).addPool({
          id: 1,
          tokenStrength: 15000,
          pointStrength: 15000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          compoundInterestThreshold: ethers.utils.parseEther("1000"),
          compoundInterestMultiplier: 5000,
          boostInfo: [],
          assetAddress: super721.address,
          typeOfAsset: 1,
          lockPeriod: 0,
          lockAmount: 0,
          lockMultiplier: 0,
          timeLockTypeOfBoost: 0,
          compoundTypeOfBoost: 0,
          typeOfPool: 0,
        });

        await diamondStakingFacet.connect(signer2).deposit(
          1,
          {
            assetAddress: super721.address,
            id: [shiftedItemGroupId2.add(7)],
            amounts: [1],
            IOUTokenId: [],
          },
          false
        );
      });
    });
    describe("getPendingTokens", function () {
      beforeEach(async function () {
        await diamondCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );

        await diamondCoreFacet.connect(owner).configureBoostersBatch(
          [1, 2],
          [
            {
              multiplier: 2300,
              amountRequired: 3,
              groupRequired: itemGroupId2,
              contractRequired: super721.address,
              boostType: 0,
              typeOfAsset: 1,
              historyOfTokenMultipliers: [],
              historyOfPointMultipliers: [],
            },
            {
              multiplier: 2000,
              amountRequired: 2,
              groupRequired: 0,
              contractRequired: super721.address,
              boostType: 1,
              typeOfAsset: 1,
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

        await super721.connect(owner).configureGroup(itemGroupId2, {
          name: "PEPSI",
          supplyType: 0,
          supplyData: 10,
          burnType: 0,
          burnData: 0,
        });
        await super721
          .connect(owner)
          .mintBatch(
            signer1.address,
            [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
              shiftedItemGroupId2.add(3),
              shiftedItemGroupId2.add(4),
              shiftedItemGroupId2.add(5),
              shiftedItemGroupId2.add(6),
            ],
            DATA
          );
        await super721
          .connect(owner)
          .mintBatch(
            signer2.address,
            [
              shiftedItemGroupId2.add(7),
              shiftedItemGroupId2.add(8),
              shiftedItemGroupId2.add(9),
            ],
            DATA
          );
        await super721
          .connect(signer1)
          .setApprovalForAll(stakerV3dsProxy.address, true);
        await super721
          .connect(signer2)
          .setApprovalForAll(stakerV3dsProxy.address, true);

        await diamondBoostersFacet.connect(signer1).stakeItemsBatch(0, 1, {
          assetAddress: super721.address,
          id: [
            shiftedItemGroupId2,
            shiftedItemGroupId2.add(1),
            shiftedItemGroupId2.add(2),
          ],
          amounts: [1, 1, 1],
          IOUTokenId: [],
        });

        await diamondBoostersFacet.connect(signer1).stakeItemsBatch(0, 2, {
          assetAddress: super721.address,
          id: [shiftedItemGroupId2.add(3), shiftedItemGroupId2.add(4)],
          amounts: [1, 1],
          IOUTokenId: [],
        });

        await diamondStakingFacet.connect(signer1).deposit(
          0,
          {
            assetAddress: super721.address,
            id: [shiftedItemGroupId2.add(5), shiftedItemGroupId2.add(6)],
            amounts: [1, 1],
            IOUTokenId: [],
          },
          false
        );
      });

      it("getPendingTokens should work correctly", async function () {
        const stakingFacetABI = await hre.artifacts.readArtifact(
          "StakerV3FacetStaking"
        );

        await network.provider.send("evm_increaseTime", [30]);
        await ethers.provider.send("evm_mine", []);

        let getPendingTokens = await diamondStakingFacet
          .connect(owner)
          .getPendingTokens(0, signer1.address);

        expect(await getPendingTokens).be.closeTo(
          ethers.utils.parseEther("200"),
          10 ** 15
        );
      });

      it("getPendingPoints should work correctly", async function () {
        const stakingFacetABI = await hre.artifacts.readArtifact(
          "StakerV3FacetStaking"
        );

        await network.provider.send("evm_increaseTime", [30]);
        await ethers.provider.send("evm_mine", []);

        let getPendingPoints = await diamondStakingFacet
          .connect(owner)
          .getPendingPoints(0, signer1.address);

        expect(await getPendingPoints).be.closeTo(
          ethers.utils.parseEther("200"),
          10 ** 15
        );
      });

      it("getAvailablePoints and getTotalPoints should work correctly", async function () {
        let startOfStaking = await utils.getCurrentTime();
        const stakingFacetABI = await hre.artifacts.readArtifact(
          "StakerV3FacetStaking"
        );
        const pointsFacetABI = await hre.artifacts.readArtifact(
          "StakerV3FacetPoints"
        );
        await diamondPointsFacet
          .connect(owner)
          .approvePointSpender(signer2.address, true);

        await network.provider.send("evm_setNextBlockTimestamp", [
          startOfStaking + 29,
        ]);
        await ethers.provider.send("evm_mine", []);

        await diamondPointsFacet
          .connect(signer2)
          .spendPoints(signer1.address, ethers.utils.parseEther("50"));

        let getAvailablePoints = await diamondPointsFacet
          .connect(owner)
          .getAvailablePoints(signer1.address);

        expect(getAvailablePoints).be.closeTo(
          ethers.utils.parseEther("150"),
          10 ** 15
        );

        let getTotalPoints = await diamondPointsFacet
          .connect(owner)
          .getTotalPoints(signer1.address);

        expect(await getTotalPoints).be.closeTo(
          ethers.utils.parseEther("200"),
          10 ** 15
        );
      });
    });
    describe("some specific test cases with emission starts late", function () {
      it("getPendingPoints and getPendingTokens should work correctly with emission starts late", async function () {
        const stakingFacetABI = await hre.artifacts.readArtifact(
          "StakerV3FacetStaking"
        );

        await super721.connect(owner).configureGroup(itemGroupId2, {
          name: "PEPSI",
          supplyType: 0,
          supplyData: 10,
          burnType: 0,
          burnData: 0,
        });
        await super721
          .connect(owner)
          .mintBatch(
            signer1.address,
            [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
              shiftedItemGroupId2.add(3),
              shiftedItemGroupId2.add(4),
              shiftedItemGroupId2.add(5),
              shiftedItemGroupId2.add(6),
            ],
            DATA
          );

        await super721
          .connect(signer1)
          .setApprovalForAll(stakerV3dsProxy.address, true);
        await super721
          .connect(signer2)
          .setApprovalForAll(stakerV3dsProxy.address, true);

        await diamondCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: (await utils.getCurrentTime()) + 10000,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: (await utils.getCurrentTime()) + 10000,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );

        await diamondCoreFacet.connect(owner).addPool({
          id: 1,
          tokenStrength: 10000,
          pointStrength: 10000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          compoundInterestThreshold: ethers.utils.parseEther("1000"),
          compoundInterestMultiplier: 5000,
          boostInfo: [],
          assetAddress: super721.address,
          typeOfAsset: 1,
          lockPeriod: 0,
          lockAmount: 0,
          lockMultiplier: 0,
          timeLockTypeOfBoost: 0,
          compoundTypeOfBoost: 0,
          typeOfPool: 0,
        });

        //console.log(await utils.getCurrentTime());

        // await network.provider.send("evm_increaseTime", [35]);
        // await ethers.provider.send("evm_mine", []);
        //console.log(await utils.getCurrentTime());

        let getPendingTokens = await diamondStakingFacet
          .connect(owner)
          .getPendingTokens(1, signer1.address);

        expect(await getPendingTokens).be.closeTo(
          ethers.utils.parseEther("0"),
          10 ** 15
        );

        let getPendingPoints = await diamondStakingFacet
          .connect(owner)
          .getPendingPoints(1, signer1.address);

        expect(await getPendingPoints).be.closeTo(
          ethers.utils.parseEther("0"),
          10 ** 15
        );
      });

      it("getTotalEmittedTokens and getTotalEmittedPoints should work correctly with different emissions", async function () {
        await rewardToken.transfer(
          stakerV3dsProxy.address,
          ethers.utils.parseEther("500000")
        );
        await super721.connect(owner).configureGroup(itemGroupId2, {
          name: "PEPSI",
          supplyType: 0,
          supplyData: 10,
          burnType: 0,
          burnData: 0,
        });
        await super721
          .connect(owner)
          .mintBatch(
            signer1.address,
            [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
              shiftedItemGroupId2.add(3),
              shiftedItemGroupId2.add(4),
              shiftedItemGroupId2.add(5),
              shiftedItemGroupId2.add(6),
            ],
            DATA
          );

        await super721
          .connect(signer1)
          .setApprovalForAll(stakerV3dsProxy.address, true);
        await super721
          .connect(signer2)
          .setApprovalForAll(stakerV3dsProxy.address, true);

        await diamondCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
            {
              timeStamp: (await utils.getCurrentTime()) + 36,
              rate: ethers.utils.parseEther("2"),
            },
          ],
          [
            {
              timeStamp: await utils.getCurrentTime(),
              rate: ethers.utils.parseEther("6.6666666666"),
            },
            {
              timeStamp: (await utils.getCurrentTime()) + 30,
              rate: ethers.utils.parseEther("0.1"),
            },
          ]
        );

        await diamondCoreFacet.connect(owner).addPool({
          id: 1,
          tokenStrength: 10000,
          pointStrength: 10000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          compoundInterestThreshold: ethers.utils.parseEther("1000"),
          compoundInterestMultiplier: 5000,
          boostInfo: [],
          assetAddress: super721.address,
          typeOfAsset: 1,
          lockPeriod: 0,
          lockAmount: 0,
          lockMultiplier: 0,
          timeLockTypeOfBoost: 0,
          compoundTypeOfBoost: 0,
          typeOfPool: 0,
        });

        await diamondStakingFacet.connect(signer1).deposit(
          1,
          {
            id: [shiftedItemGroupId2, shiftedItemGroupId2.add(1)],
            amounts: [1, 1],
            assetAddress: super721.address,
            IOUTokenId: [],
          },
          false
        );

        await diamondStakingFacet.connect(signer1).claim(1, []);
        //console.log(await utils.getCurrentTime());

        await network.provider.send("evm_increaseTime", [30]);
        await ethers.provider.send("evm_mine", []);

        await diamondStakingFacet.connect(signer1).deposit(
          1,
          {
            id: [shiftedItemGroupId2.add(2), shiftedItemGroupId2.add(3)],
            amounts: [1, 1],
            assetAddress: super721.address,
            IOUTokenId: [],
          },
          false
        );

        // await diamondStakingFacet
        //   .connect(signer1)
        //   .deposit(1, 0, {
        //     id: [shiftedItemGroupId2, shiftedItemGroupId2.add(1)],
        //     amounts: [1, 1],
        //     assetAddress: super721.address,
        //     IOUTokenId: [],
        //   },
        // false);
      });
    });
  });
  //   describe("time lock deposits testing", function () {
  //     beforeEach(async function () {
  //       await diamondCoreFacet.connect(owner).setEmissions(
  //         [
  //           {
  //             timeStamp: await utils.getCurrentTime(),
  //             rate: ethers.utils.parseEther("10"),
  //           },
  //         ],
  //         [
  //           {
  //             timeStamp: await utils.getCurrentTime(),
  //             rate: ethers.utils.parseEther("10"),
  //           },
  //         ]
  //       );
  //

  //       await diamondCoreFacet
  //         .connect(owner)
  //         .configureBoostersBatch(
  //           [1, 2],
  //           [
  //             {
  //
  //               multiplier: 2300,
  //               amountRequired: 3,
  //               groupRequired: itemGroupId2,
  //               contractRequired: super721.address,
  //               boostType: 0,
  //               typeOfAsset: 1,
  //             },
  //             {
  //
  //               multiplier: 2000,
  //               amountRequired: 2,
  //               groupRequired: 0,
  //               contractRequired: super721.address,
  //               boostType: 1,
  //               typeOfAsset: 1,
  //             },
  //           ]
  //         );
  //

  //       await diamondCoreFacet.connect(owner).addPool({
  //         id: 0,
  //         tokenStrength: 10000,
  //         pointStrength: 10000,
  //         groupId: 0,
  //         tokensPerShare: 0,
  //         pointsPerShare: 0,
  //         compoundInterestThreshold: ethers.utils.parseEther("1000"),
  //         compoundInterestMultiplier: 5000,
  //         boostInfo: [1, 2],
  //         assetAddress: super721.address,
  //         typeOfAsset: 1,
  //         lockPeriod: 60,
  //         lockAmount: 2,
  //         lockMultiplier: 10000,
  //         timeLockTypeOfBoost: 2,
  //         compoundTypeOfBoost: 2,
  //         typeOfPool: 0,
  //       });
  //

  //       await super721.connect(owner).configureGroup(itemGroupId2, {
  //         name: "PEPSI",
  //         supplyType: 0,
  //         supplyData: 10,
  //         burnType: 0,
  //         burnData: 0,
  //       });
  //       await super721
  //         .connect(owner)
  //         .mintBatch(
  //           signer1.address,
  //           [
  //             shiftedItemGroupId2,
  //             shiftedItemGroupId2.add(1),
  //             shiftedItemGroupId2.add(2),
  //             shiftedItemGroupId2.add(3),
  //           ],
  //           DATA
  //         );
  //       await super721
  //         .connect(owner)
  //         .mintBatch(
  //           signer3.address,
  //           [
  //             shiftedItemGroupId2.add(4),
  //             shiftedItemGroupId2.add(5),
  //             shiftedItemGroupId2.add(6),
  //           ],
  //           DATA
  //         );
  //       await super721
  //         .connect(owner)
  //         .mintBatch(
  //           signer2.address,
  //           [
  //             shiftedItemGroupId2.add(7),
  //             shiftedItemGroupId2.add(8),
  //             shiftedItemGroupId2.add(9),
  //           ],
  //           DATA
  //         );
  //       await super721
  //         .connect(signer1)
  //         .setApprovalForAll(stakerV3dsProxy.address, true);
  //       await super721
  //         .connect(signer2)
  //         .setApprovalForAll(stakerV3dsProxy.address, true);
  //       await super721
  //         .connect(signer3)
  //         .setApprovalForAll(stakerV3dsProxy.address, true);

  //       // await diamondStakingFacet.connect(signer1).deposit(
  //       //   0,
  //       //   2,
  //       //   {
  //       //     assetAddress: super721.address,
  //       //     id: [shiftedItemGroupId2.add(3), shiftedItemGroupId2.add(4)],
  //       //     amounts: [1, 1],
  //       //     IOUTokenId: [],
  //       //   },
  //       //   false
  //       // );

  //       await rewardToken.transfer(
  //         stakerV3dsProxy.address,
  //         ethers.utils.parseEther("500000")
  //       );
  //     });

  //     it("Reverts: invalid amount to lock", async function () {
  //       await expect(diamondStakingFacet.connect(signer2).deposit(
  //         0,
  //         {
  //           assetAddress: super721.address,
  //           id: [shiftedItemGroupId2.add(7)],
  //           amounts: [1],
  //           IOUTokenId: [],
  //         },
  //         true
  //       )).to.be.revertedWith("InvalidAmountToLock()");
  //     });

  //     it("Reverts: tokens already locked", async function () {
  //       await diamondStakingFacet.connect(signer1).deposit(
  //         0,
  //         {
  //           assetAddress: super721.address,
  //           id: [shiftedItemGroupId2, shiftedItemGroupId2.add(1)],
  //           amounts: [1, 1],
  //           IOUTokenId: [],
  //         },
  //         true
  //       );

  //       await expect(diamondStakingFacet.connect(signer1).deposit(
  //         0,
  //         {
  //           assetAddress: super721.address,
  //           id: [shiftedItemGroupId2.add(2), shiftedItemGroupId2.add(3)],
  //           amounts: [1, 1],
  //           IOUTokenId: [],
  //         },
  //         true
  //       )).to.be.revertedWith("TokensAlreadyLocked()");
  //     });

  //     it("Reverts: can't withdraw tokens are locked", async function () {
  //       await diamondStakingFacet.connect(signer1).deposit(
  //         0,
  //         {
  //           assetAddress: super721.address,
  //           id: [shiftedItemGroupId2, shiftedItemGroupId2.add(1)],
  //           amounts: [1, 1],
  //           IOUTokenId: [],
  //         },
  //         true
  //       );

  //       let startOfStaking = await utils.getCurrentTime();

  //       await expect(diamondStakingFacet.connect(signer1).withdraw(
  //         0,
  //         {
  //           assetAddress: super721.address,
  //           id: [shiftedItemGroupId2.add(3), shiftedItemGroupId2.add(4)],
  //           amounts: [1, 1],
  //           IOUTokenId: [0, 1],
  //         }
  //       )).to.be.revertedWith("TokenLocked()");

  //       await diamondStakingFacet.connect(signer1).deposit(
  //         0,
  //         {
  //           assetAddress: super721.address,
  //           id: [shiftedItemGroupId2.add(2), shiftedItemGroupId2.add(3)],
  //           amounts: [1, 1],
  //           IOUTokenId: [],
  //         },
  //         false
  //       );

  //       await diamondStakingFacet.connect(signer1).withdraw(
  //         0,
  //         {
  //           assetAddress: super721.address,
  //           id: [shiftedItemGroupId2.add(3), shiftedItemGroupId2.add(4)],
  //           amounts: [1, 1],
  //           IOUTokenId: [2, 3],
  //         }
  //       );

  //       expect(await super721.ownerOf(shiftedItemGroupId2.add(3))).to.be.eq(
  //         signer1.address
  //       );

  //       await network.provider.send("evm_setNextBlockTimestamp", [
  //         startOfStaking + 70,
  //       ]);
  //       await ethers.provider.send("evm_mine", []);

  //       await diamondStakingFacet.connect(signer1).withdraw(
  //         0,
  //         {
  //           assetAddress: super721.address,
  //           id: [shiftedItemGroupId2.add(3), shiftedItemGroupId2.add(4)],
  //           amounts: [1, 1],
  //           IOUTokenId: [0, 1],
  //         }
  //       );

  //       expect(await super721.ownerOf(shiftedItemGroupId2.add(1))).to.be.eq(
  //         signer1.address
  //       );
  //     });

  //     it("should work with different types of time lock boosts correctly", async function () {
  //       await diamondCoreFacet.connect(owner).addPool({
  //         id: 1,
  //         tokenStrength: 10000,
  //         pointStrength: 10000,
  //         groupId: 0,
  //         tokensPerShare: 0,
  //         pointsPerShare: 0,
  //         compoundInterestThreshold: ethers.utils.parseEther("10"),
  //         compoundInterestMultiplier: 5000,
  //         boostInfo: [1, 2],
  //         assetAddress: super721.address,
  //         typeOfAsset: 1,
  //         lockPeriod: 60,
  //         lockAmount: 2,
  //         lockMultiplier: 10000,
  //         timeLockTypeOfBoost: 1,
  //         compoundTypeOfBoost: 1,
  //         typeOfPool: 0,
  //       });

  //       await diamondCoreFacet.connect(owner).addPool({
  //         id: 2,
  //         tokenStrength: 10000,
  //         pointStrength: 10000,
  //         groupId: 0,
  //         tokensPerShare: 0,
  //         pointsPerShare: 0,
  //         compoundInterestThreshold: ethers.utils.parseEther("1000"),
  //         compoundInterestMultiplier: 5000,
  //         boostInfo: [1, 2],
  //         assetAddress: super721.address,
  //         typeOfAsset: 1,
  //         lockPeriod: 60,
  //         lockAmount: 2,
  //         lockMultiplier: 10000,
  //         timeLockTypeOfBoost: 0,
  //         compoundTypeOfBoost: 0,
  //         typeOfPool: 0,
  //       });

  //       let startOfStaking = await utils.getCurrentTime();
  //       await diamondStakingFacet.connect(signer1).deposit(
  //         1,
  //         {
  //           assetAddress: super721.address,
  //           id: [shiftedItemGroupId2.add(2), shiftedItemGroupId2.add(3)],
  //           amounts: [1, 1],
  //           IOUTokenId: [],
  //         },
  //         true
  //       );

  //       await diamondStakingFacet.connect(signer1).deposit(
  //         2,
  //         {
  //           assetAddress: super721.address,
  //           id: [shiftedItemGroupId2, shiftedItemGroupId2.add(1)],
  //           amounts: [1, 1],
  //           IOUTokenId: [],
  //         },
  //         true
  //       );

  //       await network.provider.send("evm_setNextBlockTimestamp", [
  //         startOfStaking + 30,
  //       ]);
  //       await ethers.provider.send("evm_mine", []);

  //       await diamondStakingFacet
  //         .connect(signer1)
  //         .claim(1, []);
  //     });

  //     it("complex math tests of time locks with 3 users", async function () {
  //       let shares = {
  //         sig1: 0,
  //         sig2: 0,
  //         sig3: 0,
  //         sum: 0,
  //       };
  //       let rewardsPerSecond = BigNumber.from(ethers.utils.parseEther("10")),
  //         lockMultiplier = 2;

  //       await diamondStakingFacet.connect(signer2).deposit(
  //         0,
  //         {
  //           assetAddress: super721.address,
  //           id: [shiftedItemGroupId2.add(7), shiftedItemGroupId2.add(8)],
  //           amounts: [1, 1],
  //           IOUTokenId: [],
  //         },
  //         false
  //       );

  //       shares.sig2 = 2000;
  //       shares.sum = shares.sig1 + shares.sig2 + shares.sig3;
  //       let signer2DepTime = await utils.getCurrentTime();

  //       await diamondStakingFacet.connect(signer1).deposit(
  //        0,
  //        {
  //          assetAddress: super721.address,
  //          id: [shiftedItemGroupId2, shiftedItemGroupId2.add(1)],
  //          amounts: [1, 1],
  //          IOUTokenId: [],
  //        },
  //        true
  //       );
  //       // 2000 with time lock bonus multiplier x2
  //       shares.sig1 = 2000 * lockMultiplier;
  //       shares.sum = shares.sig1 + shares.sig2 + shares.sig3;
  //       let signer1DepTime = await utils.getCurrentTime();
  //       let signer2Rewards = BigNumber.from(
  //         rewardsPerSecond.mul(signer1DepTime - signer2DepTime)
  //       );

  //       await network.provider.send("evm_setNextBlockTimestamp", [
  //         startOfStaking + 30,
  //       ]);
  //       await ethers.provider.send("evm_mine", []);

  //       await diamondStakingFacet
  //         .connect(signer1)
  //         .claim(0, []);

  //       // helper var
  //       let someBig = ethers.utils.parseEther("1");
  //       // signer 1 share with time lock boost is 2/3 (4000/6000) * 10(rewards per second) *
  //       // * 30(time from start of signer1 staked) ~= 200
  //       let signer1Rewards = BigNumber.from(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig1).div(shares.sum))
  //           .mul((await utils.getCurrentTime()) - signer1DepTime)
  //           .div(someBig)
  //       );

  //       // expect(await rewardToken.balanceOf(signer1.address)).to.be.closeTo(
  //       //   signer1Rewards,
  //       //   10 ** 15
  //       // );
  //       let signer1FirstClaimTime = await (
  //         await ethers.provider.getBlock()
  //       ).timestamp;

  //       await diamondStakingFacet
  //         .connect(signer2)
  //         .claim(0, []);

  //       signer2Rewards = signer2Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig2).div(shares.sum))
  //           .mul((await utils.getCurrentTime()) - signer1DepTime)
  //           .div(someBig)
  //       );
  //       let signer2FirstClaimTime = await (
  //         await ethers.provider.getBlock()
  //       ).timestamp;
  //       // signer 2 share is 1/3 (2000/6000) * 10 * 31 (1 sec past from last tx) +
  //       // + 10(reward for 1 sec when singer2 deposited first) ~= 113.3333333
  //       // expect(await rewardToken.balanceOf(signer2.address)).to.be.closeTo(
  //       //   signer2Rewards,
  //       //   10 ** 15
  //       // );

  //       // 3 seconds have passed since the last claim
  //       await diamondStakingFacet.connect(signer3).deposit(
  //         0,
  //         {
  //           assetAddress: super721.address,
  //           id: [shiftedItemGroupId2.add(4)],
  //           amounts: [1],
  //           IOUTokenId: [],
  //         },
  //         false
  //       );
  //       let signer3DepTime = await utils.getCurrentTime();
  //       signer1Rewards = signer1Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig1).div(shares.sum))
  //           .mul(signer3DepTime - signer1FirstClaimTime)
  //           .div(someBig)
  //       );
  //       signer2Rewards = signer2Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig2).div(shares.sum))
  //           .mul(signer3DepTime - signer2FirstClaimTime)
  //           .div(someBig)
  //       );
  //       shares.sig3 = 1000;
  //       shares.sum = shares.sig1 + shares.sig2 + shares.sig3;

  //       // +1 second (4 overall)
  //       await diamondStakingFacet.connect(signer3).deposit(
  //         0,
  //         {
  //           assetAddress: super721.address,
  //           id: [shiftedItemGroupId2.add(5), shiftedItemGroupId2.add(6)],
  //           amounts: [1, 1],
  //           IOUTokenId: [],
  //         },
  //         true
  //       );

  //       let signer3TimeLockAt = await utils.getCurrentTime();
  //       signer1Rewards = signer1Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig1).div(shares.sum))
  //           .mul(signer3TimeLockAt - signer3DepTime)
  //           .div(someBig)
  //       );
  //       signer2Rewards = signer2Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig2).div(shares.sum))
  //           .mul(signer3TimeLockAt - signer3DepTime)
  //           .div(someBig)
  //       );
  //       let signer3Rewards = BigNumber.from(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig3).div(shares.sum))
  //           .mul(signer3TimeLockAt - signer3DepTime)
  //           .div(someBig)
  //       );

  //       shares.sig3 = 3000 * lockMultiplier;
  //       shares.sum = shares.sig1 + shares.sig2 + shares.sig3;

  //       await diamondStakingFacet
  //         .connect(signer1)
  //         .claim(0, []);

  //       let signer1SecondClaimTime = await utils.getCurrentTime();

  //       signer1Rewards = signer1Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig1).div(shares.sum))
  //           .mul(signer1SecondClaimTime - signer3TimeLockAt)
  //           .div(someBig)
  //       );

  //       // 200 + 10 * 2/3 * 4(time between 1st signer1 claim and 1st signer3 deposit) + 10 *
  //       // * 4/7(share of signer1 at signer3 1st deposit) * 1 + 1/3(share of signer1 at signer3 2nd deposit) *
  //       // * 1(second past until 2nd signer1 claim) ~= 235,714285714
  //       // expect(await rewardToken.balanceOf(signer1.address)).to.be.closeTo(
  //       //   signer1Rewards,
  //       //   10 ** 15
  //       // );

  //       await diamondStakingFacet
  //         .connect(signer2)
  //         .claim(0, []);

  //       let signer2SecondClaimTime = await utils.getCurrentTime();
  //       signer2Rewards = signer2Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig2).div(shares.sum))
  //           .mul(signer2SecondClaimTime - signer3TimeLockAt)
  //           .div(someBig)
  //       );

  //       // 113.333333 + 10 * 1/3 * 3(one less second) + 10 * 2/7 * 1 + 1/6 *
  //       // * 2(+1 second from last tx) ~= 129.52380949
  //       // expect(await rewardToken.balanceOf(signer2.address)).to.be.closeTo(
  //       //   signer2Rewards,
  //       //   10 ** 15
  //       // );

  //       // moving to 60 seconds after signer1 time locked
  //       await network.provider.send("evm_setNextBlockTimestamp", [
  //         startOfStaking + 60,
  //       ]);
  //       await ethers.provider.send("evm_mine", []);

  //       await diamondStakingFacet
  //         .connect(signer1)
  //         .claim(0, []);

  //       let signer1ThirdClaimTime = await utils.getCurrentTime();
  //       signer1Rewards = signer1Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig1).div(shares.sum))
  //           .mul(signer1ThirdClaimTime - signer1SecondClaimTime)
  //           .div(someBig)
  //       );

  //       // 235.714285 + 10 * 1/3 * 24(time from last signer1 claim) ~= 315.714285
  //       // expect(await rewardToken.balanceOf(signer1.address)).to.be.closeTo(
  //       //   signer1Rewards,
  //       //   10 ** 15
  //       // );

  //       signer2Rewards = signer2Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig2).div(shares.sum))
  //           .mul(signer1ThirdClaimTime - signer2SecondClaimTime)
  //           .div(someBig)
  //       );
  //       signer3Rewards = signer3Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig3).div(shares.sum))
  //           .mul(signer1ThirdClaimTime - signer3TimeLockAt)
  //           .div(someBig)
  //       );

  //       shares.sig1 = 2000;
  //       shares.sum = shares.sig1 + shares.sig2 + shares.sig3;

  //       await diamondStakingFacet
  //         .connect(signer2)
  //         .claim(0, []);

  //       let signer2ThirdClaimTime = await utils.getCurrentTime();
  //       signer2Rewards = signer2Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig2).div(shares.sum))
  //           .mul(signer2ThirdClaimTime - signer1ThirdClaimTime)
  //           .div(someBig)
  //       );

  //       // 129.52380949 + 10 * 1/6 * 23(time from last signer2 claim to unlock of signer1 deposit) +
  //       // 10 * 1/5 ~= 169.857142823
  //       // expect(await rewardToken.balanceOf(signer2.address)).to.be.closeTo(
  //       //   signer2Rewards,
  //       //   10 ** 15
  //       // );

  //       await diamondStakingFacet
  //         .connect(signer3)
  //         .claim(0, []);

  //       let signer3FirstClaimTime = await utils.getCurrentTime();
  //       signer3Rewards = signer3Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig3).div(shares.sum))
  //           .mul(signer3FirstClaimTime - signer1ThirdClaimTime)
  //           .div(someBig)
  //       );

  //       // 10 * 1/7 + 10 * 6/12 * 25(seconds from time lock of signer3 to unlock of signer1 deposit) + 10 *
  //       // * 6 / 10 * 2(time from signer1 unlock) ~=
  //       // 10 * 1/5 ~= 138.4285714
  //       // expect(await rewardToken.balanceOf(signer3.address)).to.be.closeTo(
  //       //   signer3Rewards,
  //       //   10 ** 15
  //       // );

  //       await diamondStakingFacet
  //         .connect(signer1)
  //         .claim(0, []);

  //       let signer1FourthClaimTime = await utils.getCurrentTime();
  //       signer1Rewards = signer1Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig1).div(shares.sum))
  //           .mul(signer1FourthClaimTime - signer1ThirdClaimTime)
  //           .div(someBig)
  //       );

  //       // 315.714285 + 10 * 2/10 * 3 ~= 321.714285714285
  //       // expect(await rewardToken.balanceOf(signer1.address)).to.be.closeTo(
  //       //   signer1Rewards,
  //       //   10 ** 15
  //       // );

  //       await diamondStakingFacet
  //         .connect(signer2)
  //         .claim(0, []);

  //       let signer2FourthClaimTime = await utils.getCurrentTime();
  //       signer2Rewards = signer2Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig2).div(shares.sum))
  //           .mul(signer2FourthClaimTime - signer2ThirdClaimTime)
  //           .div(someBig)
  //       );

  //       // 169.857142823 + 10 * 2/10 * 3 ~= 175.85714285714
  //       // expect(await rewardToken.balanceOf(signer2.address)).to.be.closeTo(
  //       //   signer2Rewards,
  //       //   10 ** 15
  //       // );

  //       await diamondStakingFacet
  //         .connect(signer3)
  //         .claim(0, []);

  //       let signer3SecondClaimTime = await utils.getCurrentTime();
  //       signer3Rewards = signer3Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig3).div(shares.sum))
  //           .mul(signer3SecondClaimTime - signer3FirstClaimTime)
  //           .div(someBig)
  //       );

  //       // 138.428571428571 + 10 * 6/10 * 3 ~= 156.428571429
  //       // expect(await rewardToken.balanceOf(signer3.address)).to.be.closeTo(
  //       //   signer3Rewards,
  //       //   10 ** 15
  //       // );

  //       // moving to 60 seconds after signer1 time locked
  //       await network.provider.send("evm_setNextBlockTimestamp", [
  //         signer3TimeLockAt + 60,
  //       ]);
  //       await ethers.provider.send("evm_mine", []);

  //       let signer3UnlockTime = await utils.getCurrentTime();
  //       signer1Rewards = signer1Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig1).div(shares.sum))
  //           .mul(signer3UnlockTime - signer1FourthClaimTime)
  //           .div(someBig)
  //       );
  //       signer2Rewards = signer2Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig2).div(shares.sum))
  //           .mul(signer3UnlockTime - signer2FourthClaimTime)
  //           .div(someBig)
  //       );
  //       signer3Rewards = signer3Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig3).div(shares.sum))
  //           .mul(signer3UnlockTime - signer3SecondClaimTime)
  //           .div(someBig)
  //       );

  //       shares.sig3 = 3000;
  //       shares.sum = shares.sig1 + shares.sig2 + shares.sig3;
  //       await network.provider.send("evm_setNextBlockTimestamp", [
  //         signer3TimeLockAt + 75,
  //       ]);
  //       await ethers.provider.send("evm_mine", []);

  //       await diamondStakingFacet
  //         .connect(signer1)
  //         .claim(0, []);

  //       let signer1FifthClaimTime = await utils.getCurrentTime();
  //       signer1Rewards = signer1Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig1).div(shares.sum))
  //           .mul(signer1FifthClaimTime - signer3UnlockTime)
  //           .div(someBig)
  //       );
  //       // expect(await rewardToken.balanceOf(signer1.address)).to.be.closeTo(
  //       //   signer1Rewards,
  //       //   10 ** 15
  //       // );

  //       await diamondStakingFacet
  //         .connect(signer2)
  //         .claim(0, []);

  //       let signer2FifthClaimTime = await utils.getCurrentTime();
  //       signer2Rewards = signer2Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig2).div(shares.sum))
  //           .mul(signer2FifthClaimTime - signer3UnlockTime)
  //           .div(someBig)
  //       );
  //       // expect(await rewardToken.balanceOf(signer2.address)).to.be.closeTo(
  //       //   signer2Rewards,
  //       //   10 ** 15
  //       // );

  //       await diamondStakingFacet
  //         .connect(signer3)
  //         .claim(0, []);

  //       let signer3ThirdClaimTime = await utils.getCurrentTime();
  //       signer3Rewards = signer3Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig3).div(shares.sum))
  //           .mul(signer3ThirdClaimTime - signer3UnlockTime)
  //           .div(someBig)
  //       );
  //       // expect(await rewardToken.balanceOf(signer3.address)).to.be.closeTo(
  //       //   signer3Rewards,
  //       //   10 ** 15
  //       // );
  //     });

  //     it("multiple unlocks should work correctly", async function () {
  //       let shares = {
  //         sig1: 0,
  //         sig2: 0,
  //         sig3: 0,
  //         sum: 0,
  //       };
  //       let rewardsPerSecond = BigNumber.from(ethers.utils.parseEther("10")),
  //         lockMultiplier = 2;

  //       await diamondStakingFacet.connect(signer2).deposit(
  //         0,
  //         {
  //           assetAddress: super721.address,
  //           id: [shiftedItemGroupId2.add(7), shiftedItemGroupId2.add(8)],
  //           amounts: [1, 1],
  //           IOUTokenId: [],
  //         },
  //         false
  //       );

  //       shares.sig2 = 2000;
  //       shares.sum = shares.sig1 + shares.sig2 + shares.sig3;
  //       let signer2DepTime = await utils.getCurrentTime();

  //       //deposit
  //       let startOfStaking = await utils.getCurrentTime();
  //       await diamondStakingFacet.connect(signer1).deposit(
  //         0,
  //         {
  //           assetAddress: super721.address,
  //           id: [shiftedItemGroupId2, shiftedItemGroupId2.add(1)],
  //           amounts: [1, 1],
  //           IOUTokenId: [],
  //         },
  //         true
  //       );

  //       // 2000 with time lock bonus multiplier x2
  //       shares.sig1 = 2000 * lockMultiplier;
  //       shares.sum = shares.sig1 + shares.sig2 + shares.sig3;
  //       let signer1DepTime = await utils.getCurrentTime();
  //       let signer2Rewards = BigNumber.from(
  //         rewardsPerSecond.mul(signer1DepTime - signer2DepTime)
  //       );

  //       await network.provider.send("evm_setNextBlockTimestamp", [
  //         startOfStaking + 30,
  //       ]);
  //       await ethers.provider.send("evm_mine", []);

  //       await diamondStakingFacet
  //         .connect(signer1)
  //         .claim(0, []);

  //       // helper var
  //       let someBig = ethers.utils.parseEther("1");
  //       // signer 1 share with time lock boost is 2/3 (4000/6000) * 10(rewards per second) *
  //       // * 30(time of signer1 staked) ~= 200
  //       let signer1Rewards = BigNumber.from(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig1).div(shares.sum))
  //           .mul((await utils.getCurrentTime()) - signer1DepTime)
  //           .div(someBig)
  //       );

  //       expect(await rewardToken.balanceOf(signer1.address)).to.be.closeTo(
  //         signer1Rewards,
  //         10 ** 15
  //       );
  //       let signer1FirstClaimTime = await (
  //         await ethers.provider.getBlock()
  //       ).timestamp;

  //       await diamondStakingFacet
  //         .connect(signer2)
  //         .claim(0, []);
  //       });
  //       signer2Rewards = signer2Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig2).div(shares.sum))
  //           .mul((await utils.getCurrentTime()) - signer1DepTime)
  //           .div(someBig)
  //       );
  //       let signer2FirstClaimTime = await (
  //         await ethers.provider.getBlock()
  //       ).timestamp;
  //       // signer 2 share is 1/3 (2000/6000) * 10 * 31 (1 sec past from last tx) +
  //       // + 10(reward for 1 sec when singer2 deposited first) ~= 113.3333333
  //       expect(await rewardToken.balanceOf(signer2.address)).to.be.closeTo(
  //         signer2Rewards,
  //         10 ** 15
  //       );

  //       // 3 seconds have passed since the last claim
  //       //deposit
  //       await diamondStakingFacet.connect(signer3).deposit(
  //         0,
  //         {
  //           assetAddress: super721.address,
  //           id: [shiftedItemGroupId2.add(4)],
  //           amounts: [1],
  //           IOUTokenId: [],
  //         },
  //         false
  //       );

  //       let signer3DepTime = await utils.getCurrentTime();
  //       signer1Rewards = signer1Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig1).div(shares.sum))
  //           .mul(signer3DepTime - signer1FirstClaimTime)
  //           .div(someBig)
  //       );
  //       signer2Rewards = signer2Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig2).div(shares.sum))
  //           .mul(signer3DepTime - signer2FirstClaimTime)
  //           .div(someBig)
  //       );
  //       shares.sig3 = 1000;
  //       shares.sum = shares.sig1 + shares.sig2 + shares.sig3;

  //       // +1 second (4 overall)
  //       await diamondStakingFacet.connect(signer3).deposit(
  //         0,
  //         {
  //           assetAddress: super721.address,
  //           id: [shiftedItemGroupId2.add(5), shiftedItemGroupId2.add(6)],
  //           amounts: [1, 1],
  //           IOUTokenId: [],
  //         },
  //         true
  //       );

  //       let signer3TimeLockAt = await utils.getCurrentTime();
  //       signer1Rewards = signer1Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig1).div(shares.sum))
  //           .mul(signer3TimeLockAt - signer3DepTime)
  //           .div(someBig)
  //       );
  //       signer2Rewards = signer2Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig2).div(shares.sum))
  //           .mul(signer3TimeLockAt - signer3DepTime)
  //           .div(someBig)
  //       );
  //       let signer3Rewards = BigNumber.from(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig3).div(shares.sum))
  //           .mul(signer3TimeLockAt - signer3DepTime)
  //           .div(someBig)
  //       );

  //       shares.sig3 = 3000 * lockMultiplier;
  //       shares.sum = shares.sig1 + shares.sig2 + shares.sig3;

  //       await network.provider.send("evm_setNextBlockTimestamp", [
  //         signer1DepTime + 200,
  //       ]);

  //       signer1Rewards = signer1Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig1).div(shares.sum))
  //           .mul(signer1DepTime + 60 - signer3TimeLockAt)
  //           .div(someBig)
  //       );
  //       signer2Rewards = signer2Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig2).div(shares.sum))
  //           .mul(signer1DepTime + 60 - signer3TimeLockAt)
  //           .div(someBig)
  //       );
  //       signer3Rewards = signer3Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig3).div(shares.sum))
  //           .mul(signer1DepTime + 60 - signer3TimeLockAt)
  //           .div(someBig)
  //       );

  //       shares.sig1 = 2000;
  //       shares.sum = shares.sig1 + shares.sig2 + shares.sig3;

  //       signer1Rewards = signer1Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig1).div(shares.sum))
  //           .mul(signer3TimeLockAt + 60 - (signer1DepTime + 60))
  //           .div(someBig)
  //       );
  //       signer2Rewards = signer2Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig2).div(shares.sum))
  //           .mul(signer3TimeLockAt + 60 - (signer1DepTime + 60))
  //           .div(someBig)
  //       );
  //       signer3Rewards = signer3Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig3).div(shares.sum))
  //           .mul(signer3TimeLockAt + 60 - (signer1DepTime + 60))
  //           .div(someBig)
  //       );

  //       shares.sig3 = 3000;
  //       shares.sum = shares.sig1 + shares.sig2 + shares.sig3;

  //       // move to signer1LockTime + 200 seconds
  //       await ethers.provider.send("evm_mine", []);

  //       await expect(IOUToken.ownerOf(2)).to.be.reverted;
  //       expect(await IOUToken.ownerOf(4)).to.be.eq(signer3.address);
  //       await expect(IOUToken.ownerOf(5)).to.be.reverted;

  //       await diamondStakingFacet
  //         .connect(signer1)
  //         .claim(0, []);
  //       });

  //       let signer1LastClaim = await utils.getCurrentTime();
  //       signer1Rewards = signer1Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig1).div(shares.sum))
  //           .mul(signer1LastClaim - (signer3TimeLockAt + 60))
  //           .div(someBig)
  //       );

  //       expect(await IOUToken.ownerOf(2)).to.be.eq(signer1.address);
  //       expect(await IOUToken.ownerOf(4)).to.be.eq(signer3.address);
  //       expect(await IOUToken.ownerOf(5)).to.be.eq(signer3.address);
  //       expect(await rewardToken.balanceOf(signer1.address)).to.be.closeTo(
  //         signer1Rewards,
  //         10 ** 15
  //       );

  //       await diamondStakingFacet
  //         .connect(signer2)
  //         .claim(0, []);
  //       });

  //       let signer2LastClaim = await utils.getCurrentTime();
  //       signer2Rewards = signer2Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig2).div(shares.sum))
  //           .mul(signer2LastClaim - (signer3TimeLockAt + 60))
  //           .div(someBig)
  //       );
  //       expect(await rewardToken.balanceOf(signer2.address)).to.be.closeTo(
  //         signer2Rewards,
  //         10 ** 15
  //       );

  //       await diamondStakingFacet
  //         .connect(signer3)
  //         .claim(0, []);
  //       });

  //       let signer3LastClaim = await utils.getCurrentTime();
  //       signer3Rewards = signer3Rewards.add(
  //         rewardsPerSecond
  //           .mul(someBig.mul(shares.sig3).div(shares.sum))
  //           .mul(signer3LastClaim - (signer3TimeLockAt + 60))
  //           .div(someBig)
  //       );
  //       expect(await rewardToken.balanceOf(signer3.address)).to.be.closeTo(
  //         signer3Rewards,
  //         10 ** 15
  //       );
  //     });
  //   });
  // });

  // describe("Compound interest testing", function () {
  //   it("Should work correctly with compound interest pools", async function () {
  //     await rewardToken.transfer(
  //       stakerV3dsProxy.address,
  //       ethers.utils.parseEther("500000")
  //     );

  //     await diamondCoreFacet.connect(owner).setEmissions(
  //       [
  //         {
  //           timeStamp: await utils.getCurrentTime(),
  //           rate: ethers.utils.parseEther("10"),
  //         },
  //       ],
  //       [
  //         {
  //           timeStamp: await utils.getCurrentTime(),
  //           rate: ethers.utils.parseEther("10"),
  //         },
  //       ]
  //     );

  //     await super721.connect(owner).configureGroup(itemGroupId2, {
  //       name: "PEPSI",
  //       supplyType: 0,
  //       supplyData: 10,
  //       burnType: 0,
  //       burnData: 0,
  //     });
  //     await super721
  //       .connect(owner)
  //       .mintBatch(
  //         signer1.address,
  //         [
  //           shiftedItemGroupId2,
  //           shiftedItemGroupId2.add(1),
  //           shiftedItemGroupId2.add(2),
  //           shiftedItemGroupId2.add(3),
  //         ],
  //         DATA
  //       );
  //     await super721
  //       .connect(signer1)
  //       .setApprovalForAll(stakerV3dsProxy.address, true);

  //     await diamondCoreFacet.connect(owner).addPool({
  //       id: 0,
  //       tokenStrength: 10000,
  //       pointStrength: 10000,
  //       groupId: 0,
  //       tokensPerShare: 0,
  //       pointsPerShare: 0,
  //       compoundInterestThreshold: ethers.utils.parseEther("500"),
  //       compoundInterestMultiplier: 5000,
  //       boostInfo: [1, 2],
  //       assetAddress: super721.address,
  //       typeOfAsset: 1,
  //       lockPeriod: 0,
  //       lockAmount: 0,
  //       lockMultiplier: 0,
  //       timeLockTypeOfBoost: 0,
  //       compoundTypeOfBoost: 0,
  //       typeOfPool: 0,
  //     });

  //     let signer1DepTime = await utils.getCurrentTime();

  //     await diamondStakingFacet.connect(signer1).deposit(
  //       0,
  //       {
  //         assetAddress: super721.address,
  //         id: [
  //           shiftedItemGroupId2,
  //           shiftedItemGroupId2.add(1),
  //           shiftedItemGroupId2.add(2),
  //         ],
  //         amounts: [1, 1, 1],
  //         IOUTokenId: [],
  //       },
  //       false
  //     );

  //     await network.provider.send("evm_setNextBlockTimestamp", [
  //       signer1DepTime + 30,
  //     ]);
  //     await ethers.provider.send("evm_mine", []);

  //     //claim
  //     await diamondStakingFacet
  //       .connect(signer1)
  //       .claim(0, []);

  //     // expect(await rewardToken.balanceOf(signer1.address)).to.be.closeTo(
  //     //   ethers.utils.parseEther("300"),
  //     //   10 ** 15
  //     // );

  //     await network.provider.send("evm_setNextBlockTimestamp", [
  //       signer1DepTime + 100,
  //     ]);
  //     await ethers.provider.send("evm_mine", []);

  //     await diamondStakingFacet
  //       .connect(signer1)
  //       .claim(0, []);

  //     // 300 + 10 * 50 + 10 * 20 * 1.5 = 1100
  //     // expect(await rewardToken.balanceOf(signer1.address)).to.be.closeTo(
  //     //   ethers.utils.parseEther("1100"),
  //     //   10 ** 15
  //     // );
  //   });
  // });

  describe("All", function () {
    it("stakerv3", async function () {
      let itemGroupId = ethers.BigNumber.from(1);
      let shiftedItemGroupId = itemGroupId.shl(128);
      let itemGroupId2 = ethers.BigNumber.from(2);
      let shiftedItemGroupId2 = itemGroupId2.shl(128);

      await depositToken.transfer(
        signer1.address,
        ethers.utils.parseEther("1000")
      );
      await depositToken.transfer(
        signer2.address,
        ethers.utils.parseEther("1000")
      );
      await rewardToken.transfer(
        stakerV3dsProxy.address,
        ethers.utils.parseEther("500000")
      );

      // addDeveloper()
      await diamondCoreFacet
        .connect(owner)
        .addDeveloper(developer.address, 1000);

      //await diamondCoreFacet.connect(owner).initialize(owner.address);

      // Note 10 per second is equivalent to 150 per 15 seconds(15 seconds = block time according to Blocks implementation)
      // Now the rewards must be set based on seconds

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
            amountRequired: 3,
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
        supplyData: 10,
        burnType: 0,
        burnData: 0,
      });
      await super721
        .connect(owner)
        .mintBatch(
          signer1.address,
          [
            shiftedItemGroupId2,
            shiftedItemGroupId2.add(1),
            shiftedItemGroupId2.add(2),
            shiftedItemGroupId2.add(3),
            shiftedItemGroupId2.add(4),
            shiftedItemGroupId2.add(5),
            shiftedItemGroupId2.add(6),
          ],
          DATA
        );
      await super721
        .connect(owner)
        .mintBatch(
          signer2.address,
          [
            shiftedItemGroupId2.add(7),
            shiftedItemGroupId2.add(8),
            shiftedItemGroupId2.add(9),
          ],
          DATA
        );
      await super721
        .connect(signer1)
        .setApprovalForAll(stakerV3dsProxy.address, true);
      await super721
        .connect(signer2)
        .setApprovalForAll(stakerV3dsProxy.address, true);

      // Mint ITEMS for Signer2
      await super1155.connect(owner).configureGroup(itemGroupId, {
        name: "PEPSI",
        supplyType: 0,
        supplyData: 100,
        itemType: 2,
        itemData: 20,
        burnType: 0,
        burnData: 0,
      });
      await super1155
        .connect(owner)
        .mintBatch(
          signer2.address,
          [shiftedItemGroupId, shiftedItemGroupId.add(1)],
          [20, 10],
          DATA
        );
      await super1155
        .connect(signer2)
        .setApprovalForAll(stakerV3dsProxy.address, true);

      //
      let startOfStaking = await utils.getCurrentTime();

      //User1-Deposit
      await diamondStakingFacet.connect(signer1).deposit(
        0,
        {
          assetAddress: super721.address,
          id: [
            shiftedItemGroupId2,
            shiftedItemGroupId2.add(1),
            shiftedItemGroupId2.add(2),
          ],
          amounts: [1, 1, 1],
          IOUTokenId: [],
        },
        false
      );

      await network.provider.send("evm_setNextBlockTimestamp", [
        startOfStaking + 30,
      ]);
      await ethers.provider.send("evm_mine", []);

      //User1-Claims
      await diamondStakingFacet.connect(signer1).claim(0, []);
      // expect(await rewardToken.balanceOf(signer1.address)).to.be.closeTo(
      //   ethers.utils.parseEther("297"),
      //   ethers.utils.parseEther("0.01")
      // );

      expect(await IOUToken.balanceOf(signer1.address)).to.be.eq(3);
      expect(await IOUToken.ownerOf(0)).to.be.eq(signer1.address);
      expect(await IOUToken.ownerOf(1)).to.be.eq(signer1.address);

      expect(await super721.ownerOf(shiftedItemGroupId2.add(3))).to.be.eq(
        signer1.address
      );

      // +300 rewars for signer1
      await network.provider.send("evm_setNextBlockTimestamp", [
        startOfStaking + 60,
      ]);
      await ethers.provider.send("evm_mine", []);

      //User1-StakeITEMS
      await diamondBoostersFacet.connect(signer1).stakeItemsBatch(0, 1, {
        assetAddress: super721.address,
        id: [
          shiftedItemGroupId2.add(3),
          shiftedItemGroupId2.add(4),
          shiftedItemGroupId2.add(5),
        ],
        amounts: [1, 1, 1],
        IOUTokenId: [],
      });

      expect(await super721.ownerOf(shiftedItemGroupId2.add(3))).to.be.eq(
        stakerV3dsProxy.address
      );
      expect(await super721.ownerOf(shiftedItemGroupId2.add(5))).to.be.eq(
        stakerV3dsProxy.address
      );

      //user2 stake items
      await diamondBoostersFacet.connect(signer2).stakeItemsBatch(0, 2, {
        assetAddress: super1155.address,
        id: [shiftedItemGroupId, shiftedItemGroupId.add(1)],
        amounts: [1, 1],
        IOUTokenId: [],
      });

      expect(
        await super1155.balanceOf(signer2.address, shiftedItemGroupId)
      ).to.be.eq(19);

      // +300 rewards for signer1 (900 summary) and signer 2 is starting staking
      await network.provider.send("evm_setNextBlockTimestamp", [
        startOfStaking + 90,
      ]);
      await ethers.provider.send("evm_mine", []);

      //User2-Deposit
      await diamondStakingFacet.connect(signer2).deposit(
        0,
        {
          assetAddress: super721.address,
          id: [
            shiftedItemGroupId2.add(7),
            shiftedItemGroupId2.add(8),
            shiftedItemGroupId2.add(9),
          ],
          amounts: [1, 1, 1],
          IOUTokenId: [],
        },
        false
      );

      // 900 + about 76 rewards for signer 1 - 1% for developer ~= 966.166
      await network.provider.send("evm_setNextBlockTimestamp", [
        startOfStaking + 105,
      ]);
      await ethers.provider.send("evm_mine", []);

      //User1-Claims
      await diamondStakingFacet.connect(signer1).claim(0, []);

      // expect(await rewardToken.balanceOf(signer1.address)).to.be.closeTo(
      //   ethers.utils.parseEther("966.166"),
      //   ethers.utils.parseEther("0.001")
      // );

      expect(await super721.ownerOf(shiftedItemGroupId2.add(5))).to.be.eq(
        stakerV3dsProxy.address
      );
      //User1-UnstakeITEMS
      await diamondBoostersFacet.connect(signer1).unstakeItemsBatch(0, 1);

      expect(await super721.ownerOf(shiftedItemGroupId2.add(5))).to.be.eq(
        signer1.address
      );

      await network.provider.send("evm_setNextBlockTimestamp", [
        startOfStaking + 120,
      ]);
      await ethers.provider.send("evm_mine", []);

      //User2-Withdraw
      await diamondStakingFacet.connect(signer2).withdraw(0, [3, 4, 5]);

      expect(await super721.ownerOf(shiftedItemGroupId2.add(5))).to.be.eq(
        signer1.address
      );

      await network.provider.send("evm_setNextBlockTimestamp", [
        startOfStaking + 135,
      ]);
      await ethers.provider.send("evm_mine", []);

      //User2-Claims
      await diamondStakingFacet.connect(signer2).claim(0, []);

      // its about 2 seconds until tx with user1 unstake booster will be mine,
      // so rewards of signer2 = ~74(150 * 3600 / 7290 at moment of first claim of signer1)
      // + 20 * 3600 / 7290(2 sec desc above) + 130 * 3600 / 6600 (after signer1 unstaked) ~= 154.859
      // - 1% for developer ~= 153.311
      // expect(await rewardToken.balanceOf(signer2.address)).to.be.closeTo(
      //   ethers.utils.parseEther("153.311"),
      //   ethers.utils.parseEther("0.01")
      // );

      // expect(await rewardToken.balanceOf(developer.address)).to.be.eq(
      //   ethers.utils.parseEther("13.5")
      // );

      //User2-UnstakeITEMS
      await diamondBoostersFacet.connect(signer2).unstakeItemsBatch(0, 2);

      // //User1-Deposit
      // await diamondStakingFacet
      //   .connect(signer1)
      //   .deposit(0, {
      //     assetAddress: super721.address,
      //     id: [
      //       shiftedItemGroupId2,
      //       shiftedItemGroupId2.add(1),
      //       shiftedItemGroupId2.add(2),
      //     ],
      //     amounts: [1, 1, 1],
      //     IOUTokenId: [],
      //   },
      // false);
    });
  });
});
