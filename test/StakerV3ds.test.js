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
    viewsSelectors,
    addressesForSelectors,
    allSelectors;

  let mockCoreFacet,
    mockStakingFacet,
    mockViewFacet,
    some721,
    some1155,
    rewardToken,
    depositToken,
    IOUToken,
    super721,
    super1155,
    proxyRegistry,
    stakerV3FacetCore,
    stakerV3FacetStaking,
    stakerV3FacetViews,
    stakerV3dsProxy;
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
    this.MockCoreFacet = await ethers.getContractFactory(
      "TestStakerV3FacetCore"
    );
    this.MockStakingFacet = await ethers.getContractFactory(
      "TestStakerV3FacetStaking"
    );
    this.MockViewFacet = await ethers.getContractFactory(
      "TestStakerV3FacetViews"
    );
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

    mockCoreFacet = await this.MockCoreFacet.deploy();
    await mockCoreFacet.deployed();

    mockStakingFacet = await this.MockStakingFacet.deploy();
    await mockStakingFacet.deployed();

    mockViewFacet = await this.MockViewFacet.deploy();
    await mockViewFacet.deployed();

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
    //console.log(coreSelectors);
    let counter = 0;
    for (counter; counter < coreSelectors.length; counter++) {
      addressesForSelectors.push(stakerV3FacetCore.address);
    }

    stakerV3FacetStaking = await this.StakerV3FacetStaking.deploy();
    await stakerV3FacetStaking.deployed();

    var oldCounter = counter;
    stakingSelectors = await utils.getSelectors(stakerV3FacetStaking);
    for (counter; counter < stakingSelectors.length + oldCounter; counter++) {
      addressesForSelectors.push(stakerV3FacetStaking.address);
    }

    oldCounter = counter;
    viewsSelectors = await utils.getSelectors(stakerV3FacetViews);
    for (counter; counter < viewsSelectors.length + oldCounter; counter++) {
      addressesForSelectors.push(stakerV3FacetViews.address);
    }

    allSelectors = [...coreSelectors, ...stakingSelectors, ...viewsSelectors];

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

        // generate data for sendTransaction
        // lockDevelopers()
        const testCallData1 = await mockCoreFacet
          .connect(owner)
          .lockDevelopers();
        const testCallData1String = testCallData1.data.toString();

        // addDeveloper
        const testCallData2 = await mockCoreFacet
          .connect(owner)
          .addDeveloper(developer.address, 500);
        const testCallData2String = testCallData2.data.toString();

        // execute lockDevelopers()
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        // execute addDeveloper()
        await expect(
          owner.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData2String,
          })
        ).to.be.revertedWith("CantAlterDevs");
      });

      it("Reverts: update developer by person with 0 share", async function () {
        // generate data for sendTransaction
        // updateDeveloper()
        const testCallData1 = await mockCoreFacet
          .connect(signer1)
          .updateDeveloper(signer2.address, 100);
        const testCallData1String = testCallData1.data.toString();

        // execute updateDeveloper()
        await expect(
          owner.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData1String,
          })
        ).to.be.revertedWith("ZeroDevShare()");
      });

      it("should add new developer", async function () {
        const developersShare = [500, 1500, 2500];

        const viewFacetABI = await hre.artifacts.readArtifact(
          "StakerV3FacetViews"
        );

        // generate data for sendTransaction
        // addDeveloper()
        const testCallData1 = await mockCoreFacet
          .connect(owner)
          .addDeveloper(developer.address, developersShare[0]);
        const testCallData1String = testCallData1.data.toString();

        // addDeveloper()
        const testCallData2 = await mockCoreFacet
          .connect(owner)
          .addDeveloper(signer1.address, developersShare[1]);
        const testCallData2String = testCallData2.data.toString();

        // addDeveloper()
        const testCallData3 = await mockCoreFacet
          .connect(owner)
          .addDeveloper(signer2.address, developersShare[2]);
        const testCallData3String = testCallData3.data.toString();

        // getDeveloperAddresses
        const getDevAddressesData = await mockViewFacet
          .connect(owner)
          .getDeveloperAddresses();
        const getDevAddressesDataString = getDevAddressesData.toString();

        // execute addDeveloper()
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        // execute addDeveloper()
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData2String,
        });

        // execute addDeveloper()
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData3String,
        });

        const devAddresses = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getDevAddressesDataString,
        });

        let decodedData = utils.decodeResults(
          [viewFacetABI],
          ["getDeveloperAddresses"],
          [devAddresses]
        );

        expect(decodedData[0][0]).to.be.eq(developer.address);
        expect(decodedData[0][1]).to.be.eq(signer1.address);
        expect(decodedData[0][2]).to.be.eq(signer2.address);

        // getDeveloperShare
        const getDevShares1Data = await mockViewFacet
          .connect(owner)
          .getDeveloperShare(decodedData[0][0]);
        const getDevShares1DataString = getDevShares1Data.toString();

        // getDeveloperShare
        const getDevShares2Data = await mockViewFacet
          .connect(owner)
          .getDeveloperShare(decodedData[0][1]);
        const getDevShares2DataString = getDevShares2Data.toString();

        // getDeveloperShare
        const getDevShares3Data = await mockViewFacet
          .connect(owner)
          .getDeveloperShare(decodedData[0][2]);
        const getDevShares3DataString = getDevShares3Data.toString();

        const shareCall1 = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getDevShares1DataString,
        });

        const shareCall2 = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getDevShares2DataString,
        });

        const shareCall3 = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getDevShares3DataString,
        });

        decodedData = utils.decodeResults(
          [viewFacetABI, viewFacetABI, viewFacetABI],
          ["getDeveloperShare", "getDeveloperShare", "getDeveloperShare"],
          [shareCall1, shareCall2, shareCall3]
        );

        expect(decodedData[0]).to.be.eq(developersShare[0]);
        expect(decodedData[1]).to.be.eq(developersShare[1]);
        expect(decodedData[2]).to.be.eq(developersShare[2]);
      });

      it("Reverts: can not increase share", async function () {
        // generate data for sendTransaction
        // addDeveloper()
        const testCallData1 = await mockCoreFacet
          .connect(owner)
          .addDeveloper(developer.address, 500);
        const testCallData1String = testCallData1.data.toString();

        // updateDeveloper()
        const testCallData2 = await mockCoreFacet
          .connect(developer)
          .updateDeveloper(developer.address, 1000);
        const testCallData2String = testCallData2.data.toString();

        // execute addDeveloper()
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        // execute updateDeveloper()
        await expect(
          developer.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData2String,
          })
        ).to.be.revertedWith("CantIncreaseDevShare()");
      });

      it("Reverts: can not update developer at address with greater then 0 share", async function () {
        // generate data for sendTransaction
        // addDeveloper()
        const testCallData1 = await mockCoreFacet
          .connect(owner)
          .addDeveloper(developer.address, 500);
        const testCallData1String = testCallData1.data.toString();

        // addDeveloper()
        const testCallData2 = await mockCoreFacet
          .connect(owner)
          .addDeveloper(signer1.address, 1000);
        const testCallData2String = testCallData2.data.toString();

        // updateDeveloper()
        const testCallData3 = await mockCoreFacet
          .connect(developer)
          .updateDeveloper(signer1.address, 100);
        const testCallData3String = testCallData3.data.toString();

        // execute addDeveloper()
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        // execute addDeveloper()
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData2String,
        });

        // execute updateDeveloper()
        await expect(
          developer.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData3String,
          })
        ).to.be.revertedWith("InvalidNewAddress()");
      });

      it("should update developer address correctly", async function () {
        const developersShare = [500, 1500, 2500];

        const viewFacetABI = await hre.artifacts.readArtifact(
          "StakerV3FacetViews"
        );

        // generate data for sendTransaction
        // addDeveloper()
        const addDevData1 = await mockCoreFacet
          .connect(owner)
          .addDeveloper(developer.address, developersShare[0]);
        const addDevData1String = addDevData1.data.toString();

        // addDeveloper()
        const addDevData2 = await mockCoreFacet
          .connect(owner)
          .addDeveloper(signer1.address, developersShare[1]);
        const addDevData2String = addDevData2.data.toString();

        // addDeveloper()
        const addDevData3 = await mockCoreFacet
          .connect(owner)
          .addDeveloper(signer2.address, developersShare[2]);
        const addDevData3String = addDevData3.data.toString();

        // updateDeveloper()
        const updateDevData1 = await mockCoreFacet
          .connect(developer)
          .updateDeveloper(developer.address, 0);
        const updateDevData1String = updateDevData1.data.toString();

        // updateDeveloper()
        const updateDevData2 = await mockCoreFacet
          .connect(signer1)
          .updateDeveloper(signer3.address, developersShare[1]);
        const updateDevData2String = updateDevData2.data.toString();

        // updateDeveloper()
        const updateDevData3 = await mockCoreFacet
          .connect(signer2)
          .updateDeveloper(signer2.address, developersShare[2] - 1000);
        const updateDevData3String = updateDevData3.data.toString();

        // updateDeveloper()
        const updateDevData4 = await mockCoreFacet
          .connect(signer2)
          .updateDeveloper(signer2.address, developersShare[2] - 1000);
        const updateDevData4String = updateDevData4.data.toString();

        // execute addDeveloper()
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: addDevData1String,
        });

        // execute addDeveloper()
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: addDevData2String,
        });

        // execute addDeveloper()
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: addDevData3String,
        });

        // execute updateDeveloper()
        await developer.sendTransaction({
          to: stakerV3dsProxy.address,
          data: updateDevData1String,
        });

        // execute updateDeveloper()
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: updateDevData2String,
        });

        // execute updateDeveloper()
        await signer2.sendTransaction({
          to: stakerV3dsProxy.address,
          data: updateDevData3String,
        });

        /**
         *
         *
         *          ASSERTING
         *
         *
         */

        // getDeveloperAddresses
        const getDevAddressesData = await mockViewFacet
          .connect(owner)
          .getDeveloperAddresses();
        const getDevAddressesDataString = getDevAddressesData.toString();

        const devAddresses = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getDevAddressesDataString,
        });

        let decodedData = utils.decodeResults(
          [viewFacetABI],
          ["getDeveloperAddresses"],
          [devAddresses]
        );

        expect(decodedData[0]).to.not.contain(developer.address);
        expect(decodedData[0][0]).to.be.eq(signer2.address);
        expect(decodedData[0][1]).to.be.eq(signer3.address);

        // getDeveloperShare
        const getDevShares1Data = await mockViewFacet
          .connect(owner)
          .getDeveloperShare(decodedData[0][0]);
        const getDevShares1DataString = getDevShares1Data.toString();

        // getDeveloperShare
        const getDevShares2Data = await mockViewFacet
          .connect(owner)
          .getDeveloperShare(decodedData[0][1]);
        const getDevShares2DataString = getDevShares2Data.toString();

        const shareCall1 = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getDevShares1DataString,
        });

        const shareCall2 = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getDevShares2DataString,
        });

        decodedData = utils.decodeResults(
          [viewFacetABI, viewFacetABI, viewFacetABI],
          ["getDeveloperShare", "getDeveloperShare"],
          [shareCall1, shareCall2]
        );

        expect(decodedData[0]).to.be.eq(developersShare[2] - 1000);
        expect(decodedData[1]).to.be.eq(developersShare[1]);

        // execute updateDeveloper()
        await signer2.sendTransaction({
          to: stakerV3dsProxy.address,
          data: updateDevData4String,
        });
      });
    });
    describe("setEmissions, lockTokenEmissions, lockPointEmissions", function () {
      it("Reverts: alteration of token emission is locked", async function () {
        // generate data for sendTransaction
        // lockTokenEmissions()
        const testCallData1 = await mockCoreFacet
          .connect(owner)
          .lockTokenEmissions();
        const testCallData1String = testCallData1.data.toString();

        // setEmissions()
        const testCallData2 = await mockCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );
        const testCallData2String = testCallData2.data.toString();

        // execute lockTokenEmissions()
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        //execute setEmissions
        await expect(
          owner.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData2String,
          })
        ).to.be.revertedWith("CantAlterTokenEmissionSchedule()");
      });

      it("Reverts: alteration of point emissions is locked", async function () {
        // generate data for sendTransaction
        // lockPointEmissions()
        const testCallData1 = await mockCoreFacet
          .connect(owner)
          .lockPointEmissions();
        const testCallData1String = testCallData1.data.toString();

        // setEmissions()
        const testCallData2 = await mockCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );
        const testCallData2String = testCallData2.data.toString();

        // execute lockPointEmissions()
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        //execute setEmissions
        await expect(
          owner.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData2String,
          })
        ).to.be.revertedWith("CantAlterPointEmissionSchedule()");
      });

      it("Reverts: token emission schedule must be set", async function () {
        // generate data for sendTransaction
        // setEmissions()
        const testCallData1 = await mockCoreFacet
          .connect(owner)
          .setEmissions([], []);
        const testCallData1String = testCallData1.data.toString();

        //execute setEmissions
        await expect(
          owner.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData1String,
          })
        ).to.be.revertedWith("ZeroTokenEmissionEvents()");
      });

      it("Reverts: point emission schedule must be set", async function () {
        // generate data for sendTransaction
        // setEmissions()
        const testCallData1 = await mockCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          []
        );
        const testCallData1String = testCallData1.data.toString();

        //execute setEmissions
        await expect(
          owner.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData1String,
          })
        ).to.be.revertedWith("ZeroPointEmissionEvents()");
      });

      it("should set emissions", async function () {
        // generate data for sendTransaction
        // setEmissions()
        const testCallData1 = await mockCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );
        const testCallData1String = testCallData1.data.toString();

        // execute setEmissions()
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });
      });

      it("should set emissions of staker where earliestTokenEmission/earliestPointEmission timestamps are less", async function () {
        // generate data for sendTransaction
        // setEmissions()
        const testCallData1 = await mockCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );
        const testCallData1String = testCallData1.data.toString();

        // execute setEmissions()
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        // Increase time so that the earliestTokenEmission/EarliestPointEmission timestamps are less
        await ethers.provider.send("evm_increaseTime", [70]);
        await ethers.provider.send("evm_mine", []);

        const testCallData2 = await mockCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );
        const testCallData2String = testCallData2.data.toString();

        // execute setEmissions()
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData2String,
        });
      });
    });
    describe("configureBoostersBatch, getBoostersCount, getBoosterInfo", function () {
      it("Reverts: boost info must be set", async function () {
        const testCallData1 = await mockCoreFacet
          .connect(owner)
          .configureBoostersBatch([1, 2], []);
        const testCallData1String = testCallData1.data.toString();

        //configureBoosterBatch
        await expect(
          owner.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData1String,
          })
        ).to.be.revertedWith("EmptyBoostInfoArray()");

        const testCallData2 = await mockCoreFacet
          .connect(owner)
          .configureBoostersBatch(
            [1],
            [
              {
                set: true,
                multiplier: 0,
                amountRequired: 0,
                groupRequired: 0,
                contractRequired: ethers.constants.AddressZero,
                assetType: 2,
                typeOfAsset: 0,
              },
            ]
          );
        const testCallData2String = testCallData2.data.toString();

        await expect(
          owner.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData2String,
          })
        ).to.be.revertedWith("InvalidConfBoostersInputs()");
      });

      it("Reverts: mismatch of ids and boost info arrays leghts", async function () {
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);

        const testCallData1 = await mockCoreFacet
          .connect(owner)
          .configureBoostersBatch(
            [1, 2, 3],
            [
              {
                set: true,
                multiplier: 2300,
                amountRequired: 3,
                groupRequired: itemGroupId2,
                contractRequired: super721.address,
                assetType: 2,
                typeOfAsset: 1,
              },
              {
                set: true,
                multiplier: 2000,
                amountRequired: 2,
                groupRequired: 0,
                contractRequired: super1155.address,
                assetType: 2,
                typeOfAsset: 2,
              },
            ]
          );
        const testCallData1String = testCallData1.data.toString();

        //configureBoosterBatch
        await expect(
          owner.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData1String,
          })
        ).to.be.revertedWith("InputLengthsMismatch()");
      });

      it("Reverts: you can not configure boost with id 0", async function () {
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);

        const testCallData1 = await mockCoreFacet
          .connect(owner)
          .configureBoostersBatch(
            [1, 0],
            [
              {
                set: true,
                multiplier: 2300,
                amountRequired: 3,
                groupRequired: itemGroupId2,
                contractRequired: super721.address,
                assetType: 2,
                typeOfAsset: 1,
              },
              {
                set: true,
                multiplier: 2000,
                amountRequired: 2,
                groupRequired: 0,
                contractRequired: super1155.address,
                assetType: 2,
                typeOfAsset: 2,
              },
            ]
          );
        const testCallData1String = testCallData1.data.toString();

        //configureBoosterBatch
        await expect(
          owner.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData1String,
          })
        ).to.be.revertedWith("BoosterIdZero()");
      });

      it("Reverts: you can't set ERC20 as asset for stake", async function () {
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);

        const testCallData1 = await mockCoreFacet
          .connect(owner)
          .configureBoostersBatch(
            [1, 2],
            [
              {
                set: true,
                multiplier: 2300,
                amountRequired: 3,
                groupRequired: itemGroupId2,
                contractRequired: super721.address,
                assetType: 2,
                typeOfAsset: 1,
              },
              {
                set: true,
                multiplier: 2000,
                amountRequired: 2,
                groupRequired: 0,
                contractRequired: depositToken.address,
                assetType: 2,
                typeOfAsset: 0,
              },
            ]
          );
        const testCallData1String = testCallData1.data.toString();

        //configureBoosterBatch
        await expect(
          owner.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData1String,
          })
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
            set: true,
            multiplier: 2300,
            amountRequired: 3,
            groupRequired: itemGroupId2,
            contractRequired: super721.address,
            assetType: 2,
            typeOfAsset: 1,
          },
          {
            set: true,
            multiplier: 2000,
            amountRequired: 2,
            groupRequired: 0,
            contractRequired: super1155.address,
            assetType: 2,
            typeOfAsset: 2,
          },
        ];

        const testCallData1 = await mockCoreFacet
          .connect(owner)
          .configureBoostersBatch([1, 2], configOfBoosters);
        const testCallData1String = testCallData1.data.toString();

        //configureBoosterBatch
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        const getBoosterCountData = await mockViewFacet
          .connect(owner)
          .getBoostersCount();
        const getBoosterCountDataString = getBoosterCountData.toString();

        const getBoosterInfo1Data = await mockViewFacet
          .connect(owner)
          .getBoosterInfo(1);
        const getBoosterInfo1DataString = getBoosterInfo1Data.toString();

        const getBoosterInfo2Data = await mockViewFacet
          .connect(owner)
          .getBoosterInfo(2);
        const getBoosterInfo2DataString = getBoosterInfo2Data.toString();

        const boostCall1 = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getBoosterInfo1DataString,
        });

        const boostCall2 = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getBoosterInfo2DataString,
        });

        const boostCountCall = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getBoosterCountDataString,
        });

        const decodedData = utils.decodeResults(
          [viewFacetABI, viewFacetABI, viewFacetABI],
          ["getBoosterInfo", "getBoosterInfo", "getBoostersCount"],
          [boostCall1, boostCall2, boostCountCall]
        );

        expect(await configOfBoosters[0].multiplier).to.be.eq(
          decodedData[0].multiplier
        );
        expect(await configOfBoosters[1].multiplier).to.be.eq(
          decodedData[1].multiplier
        );
        expect(await decodedData[2]).to.be.eq(2);
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
            set: true,
            multiplier: 2300,
            amountRequired: 3,
            groupRequired: itemGroupId2,
            contractRequired: super721.address,
            assetType: 2,
            typeOfAsset: 1,
          },
          {
            set: true,
            multiplier: 2000,
            amountRequired: 2,
            groupRequired: 0,
            contractRequired: super1155.address,
            assetType: 2,
            typeOfAsset: 2,
          },
        ];

        const testCallData1 = await mockCoreFacet
          .connect(owner)
          .configureBoostersBatch([1, 2], configOfBoosters);
        const testCallData1String = testCallData1.data.toString();

        //configureBoosterBatch
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        const testCallData2 = await mockCoreFacet
          .connect(owner)
          .configureBoostersBatch(
            [1],
            [
              {
                set: true,
                multiplier: 0,
                amountRequired: 3,
                groupRequired: itemGroupId2,
                contractRequired: super721.address,
                assetType: 2,
                typeOfAsset: 1,
              },
            ]
          );
        const testCallData2String = testCallData2.data.toString();

        const testCallData3 = await mockCoreFacet
          .connect(owner)
          .configureBoostersBatch(
            [2],
            [
              {
                set: true,
                multiplier: 26000,
                amountRequired: 2,
                groupRequired: 0,
                contractRequired: super1155.address,
                assetType: 2,
                typeOfAsset: 2,
              },
            ]
          );
        const testCallData3String = testCallData3.data.toString();

        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData2String,
        });

        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData3String,
        });

        const getBoosterCountData = await mockViewFacet
          .connect(owner)
          .getBoostersCount();
        const getBoosterCountDataString = getBoosterCountData.toString();

        const getBoosterInfo1Data = await mockViewFacet
          .connect(owner)
          .getBoosterInfo(1);
        const getBoosterInfo1DataString = getBoosterInfo1Data.toString();

        const getBoosterInfo2Data = await mockViewFacet
          .connect(owner)
          .getBoosterInfo(2);
        const getBoosterInfo2DataString = getBoosterInfo2Data.toString();

        const boostCall1 = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getBoosterInfo1DataString,
        });

        const boostCall2 = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getBoosterInfo2DataString,
        });

        const boostCountCall = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getBoosterCountDataString,
        });

        const decodedData = utils.decodeResults(
          [viewFacetABI, viewFacetABI, viewFacetABI],
          ["getBoosterInfo", "getBoosterInfo", "getBoostersCount"],
          [boostCall1, boostCall2, boostCountCall]
        );

        expect(await decodedData[0].multiplier).to.be.eq(0);
        expect(await decodedData[1].multiplier).to.be.eq(26000);
        expect(await decodedData[2]).to.be.eq(1);
      });
    });
    describe("addPool, overwrtite pool, getPoolCount", function () {
      it("Reverts: emission schedule not defined", async function () {
        const testCallData1 = await mockCoreFacet.connect(owner).addPool({
          id: 0,
          tokenStrength: 10000,
          pointStrength: 10000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          boostInfo: [1, 2],
          assetAddress: super721.address,
          typeOfAsset: 1,
        });
        const testCallData1String = testCallData1.data.toString();

        //addPool
        await expect(
          owner.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData1String,
          })
        ).to.be.revertedWith("EmissionNotSet()");
      });

      it("Reverts: pool token is ERC20 token", async function () {
        const testCallData1 = await mockCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );
        const testCallData1String = testCallData1.data.toString();

        //setEmissions
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        const testCallData2 = await mockCoreFacet.connect(owner).addPool({
          id: 0,
          tokenStrength: 10000,
          pointStrength: 10000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          boostInfo: [1, 2],
          assetAddress: rewardToken.address,
          typeOfAsset: 1,
        });
        const testCallData2String = testCallData2.data.toString();

        //addPool
        await expect(
          owner.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData2String,
          })
        ).to.be.reverted;
      });

      it("Reverts: mismatch typeOfAsset and real asset type", async function () {
        const testCallData1 = await mockCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );
        const testCallData1String = testCallData1.data.toString();

        //setEmissions
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        const testCallData2 = await mockCoreFacet.connect(owner).addPool({
          id: 0,
          tokenStrength: 10000,
          pointStrength: 10000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          boostInfo: [1, 2],
          assetAddress: super1155.address,
          typeOfAsset: 1,
        });
        const testCallData2String = testCallData2.data.toString();

        //addPool
        await expect(
          owner.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData2String,
          })
        ).to.be.revertedWith("InvalidAsset()");

        const testCallData3 = await mockCoreFacet.connect(owner).addPool({
          id: 0,
          tokenStrength: 10000,
          pointStrength: 10000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          boostInfo: [1, 2],
          assetAddress: super721.address,
          typeOfAsset: 2,
        });
        const testCallData3String = testCallData3.data.toString();

        //addPool
        await expect(
          owner.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData3String,
          })
        ).to.be.revertedWith("InvalidAsset()");
      });

      it("Reverts: token or point strength of the pool is set to 0 or less", async function () {
        const testCallData1 = await mockCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );
        const testCallData1String = testCallData1.data.toString();

        //setEmissions
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        const testCallData2 = await mockCoreFacet.connect(owner).addPool({
          id: 0,
          tokenStrength: 0,
          pointStrength: 10000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          boostInfo: [1, 2],
          assetAddress: super721.address,
          typeOfAsset: 1,
        });
        const testCallData2String = testCallData2.data.toString();

        //addPool
        await expect(
          owner.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData2String,
          })
        ).to.be.revertedWith("ZeroStrength()");
      });

      it("Reverts: ERC20 can't be as asset at pool for stake", async function () {
        const testCallData1 = await mockCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );
        const testCallData1String = testCallData1.data.toString();

        //setEmissions
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        const testCallData2 = await mockCoreFacet.connect(owner).addPool({
          id: 0,
          tokenStrength: 100,
          pointStrength: 10000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          boostInfo: [1, 2],
          assetAddress: depositToken.address,
          typeOfAsset: 0,
        });
        const testCallData2String = testCallData2.data.toString();

        //addPool
        await expect(
          owner.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData2String,
          })
        ).to.be.revertedWith("InvalidTypeOfAsset()");
      });

      it("should add a new pool, overwrite it and get pool count", async function () {
        const viewFacetABI = await hre.artifacts.readArtifact(
          "StakerV3FacetViews"
        );

        const testCallData1 = await mockCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );
        const testCallData1String = testCallData1.data.toString();

        //setEmissions
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        const testCallData2 = await mockCoreFacet.connect(owner).addPool({
          id: 0,
          tokenStrength: 10000,
          pointStrength: 10000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          boostInfo: [1],
          assetAddress: super721.address,
          typeOfAsset: 1,
        });
        const testCallData2String = testCallData2.data.toString();

        //addPool
        owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData2String,
        });

        const getPoolCount1Data = await mockViewFacet
          .connect(owner)
          .getPoolCount();
        const getPoolCount1DataString = getPoolCount1Data.toString();

        const getPoolCall1 = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getPoolCount1DataString,
        });

        let decodedData = utils.decodeResults(
          [viewFacetABI],
          ["getPoolCount"],
          [getPoolCall1]
        );
        expect(await decodedData[0]).to.be.eq(1);

        const testCallData3 = await mockCoreFacet.connect(owner).addPool({
          id: 0,
          tokenStrength: 12000,
          pointStrength: 12000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          boostInfo: [2],
          assetAddress: super721.address,
          typeOfAsset: 1,
        });
        const testCallData3String = testCallData3.data.toString();

        //addPool
        owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData3String,
        });

        const getPoolCount2Data = await mockViewFacet
          .connect(owner)
          .getPoolCount();
        const getPoolCount2DataString = getPoolCount2Data.toString();

        const getPoolCall2 = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getPoolCount2DataString,
        });

        decodedData = utils.decodeResults(
          [viewFacetABI],
          ["getPoolCount"],
          [getPoolCall2]
        );
        expect(await decodedData[0]).to.be.eq(1);
      });
    });
    describe("onERC721Received", function () {
      it("should work correctly", async function () {
        await stakerV3FacetCore
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
        await rewardToken.transfer(
          stakerV3dsProxy.address,
          ethers.utils.parseEther("500000")
        );

        //await stakerV3FacetCore.connect(owner).initialize(owner.address);

        // Note 6.6666666666 per second is equivalent to 100 per 15 seconds(15 seconds = block time according to Blocks implementation)
        // Now the rewards must be set based on seconds
        const testCallData1 = await mockCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );
        const testCallData1String = testCallData1.data.toString();

        //setEmissions
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        const testCallData2 = await mockCoreFacet
          .connect(owner)
          .configureBoostersBatch(
            [1, 2],
            [
              {
                set: true,
                multiplier: 2300,
                amountRequired: 3,
                groupRequired: itemGroupId2,
                contractRequired: super721.address,
                assetType: 2,
                typeOfAsset: 1,
              },
              {
                set: true,
                multiplier: 2000,
                amountRequired: 2,
                groupRequired: 0,
                contractRequired: super1155.address,
                assetType: 2,
                typeOfAsset: 2,
              },
            ]
          );
        const testCallData2String = testCallData2.data.toString();

        //configureBoosterBatch
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData2String,
        });

        const testCallData3 = await mockCoreFacet.connect(owner).addPool({
          id: 0,
          tokenStrength: 10000,
          pointStrength: 10000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          boostInfo: [1, 2],
          assetAddress: super721.address,
          typeOfAsset: 1,
        });
        const testCallData3String = testCallData3.data.toString();

        //addPool
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData3String,
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

      it("Reverts: Inactive pool", async function () {
        const testCallData1 = await mockStakingFacet
          .connect(signer1)
          .deposit(5, 0, {
            assetAddress: super721.address,
            id: [1, 2, 3],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          });
        const testCallData1String = testCallData1.data.toString();

        //setEmissions
        await expect(
          signer1.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData1String,
          })
        ).to.be.revertedWith("IncativePool()");
      });

      it("Reverts: wrong asset deposited", async function () {
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);

        const testCallData1 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 0, {
            assetAddress: some721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 2, 3],
            IOUTokenId: [],
          });
        const testCallData1String = testCallData1.data.toString();

        //deposit
        await expect(
          signer1.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData1String,
          })
        ).to.be.revertedWith("InvalidAssetToStake()");
      });
      it("Reverts: you can't deposit erc721 amounts other than 1", async function () {
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);

        const testCallData1 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 0, {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 2, 3],
            IOUTokenId: [],
          });
        const testCallData1String = testCallData1.data.toString();

        //deposit
        await expect(
          signer1.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData1String,
          })
        ).to.be.revertedWith(
          "StakerV3FacetStaking::deposit: invalid amount value."
        );
      });

      it("should deposit at pool correctly", async function () {
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);

        const testCallData1 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 0, {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          });
        const testCallData1String = testCallData1.data.toString();

        //deposit
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

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

        const testCallData1 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 10, {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          });
        const testCallData1String = testCallData1.data.toString();

        //deposit
        await expect(
          signer1.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData1String,
          })
        ).to.be.revertedWith("InvalidInfoStakeForBoost()");
      });

      it("Reverts: mismatch of id and amounts arrays lentghs", async function () {
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);

        const testCallData1 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 1, {
            assetAddress: some721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1],
            IOUTokenId: [],
          });
        const testCallData1String = testCallData1.data.toString();

        //deposit
        await expect(
          signer1.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData1String,
          })
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
        const testCallData1 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 1, {
            assetAddress: some721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          });
        const testCallData1String = testCallData1.data.toString();

        //deposit
        await expect(
          signer1.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData1String,
          })
        ).to.be.revertedWith("InvalidInfoStakeForBoost()");

        // incorrect amounts
        const testCallData2 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 1, {
            assetAddress: super721.address,
            id: [shiftedItemGroupId2, shiftedItemGroupId2.add(1)],
            amounts: [1, 1],
            IOUTokenId: [],
          });
        const testCallData2String = testCallData2.data.toString();

        //deposit
        await expect(
          signer1.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData2String,
          })
        ).to.be.revertedWith("InvalidInfoStakeForBoost()");

        // incorrect group id
        const testCallData3 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 1, {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId3,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId3.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          });
        const testCallData3String = testCallData3.data.toString();

        //deposit
        await expect(
          signer1.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData3String,
          })
        ).to.be.revertedWith("InvalidInfoStakeForBoost()");

        // setting booster multiplier to 0
        const testCallData4 = await mockCoreFacet
          .connect(owner)
          .configureBoostersBatch(
            [1],
            [
              {
                set: true,
                multiplier: 0,
                amountRequired: 3,
                groupRequired: itemGroupId2,
                contractRequired: super721.address,
                assetType: 2,
                typeOfAsset: 1,
              },
            ]
          );
        const testCallData4String = testCallData4.data.toString();

        //deposit
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData4String,
        });

        // cant stake for booster with multiplier 0
        const testCallData5 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 1, {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          });
        const testCallData5String = testCallData5.data.toString();

        //deposit
        await expect(
          signer1.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData5String,
          })
        ).to.be.revertedWith("InvalidInfoStakeForBoost()");
      });

      it("should stake items at pool for boosters correctly", async function () {
        let itemGroupId = ethers.BigNumber.from(1);
        let shiftedItemGroupId = itemGroupId.shl(128);
        let itemGroupId2 = ethers.BigNumber.from(2);
        let shiftedItemGroupId2 = itemGroupId2.shl(128);

        const testCallData1 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 1, {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          });
        const testCallData1String = testCallData1.data.toString();

        //deposit
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        expect(await super721.balanceOf(signer1.address)).to.be.eq(7);
        expect(await super721.ownerOf(shiftedItemGroupId2)).to.be.eq(
          stakerV3dsProxy.address
        );
        expect(await super721.ownerOf(shiftedItemGroupId2.add(1))).to.be.eq(
          stakerV3dsProxy.address
        );

        expect(await IOUToken.balanceOf(signer1.address)).to.be.eq(0);

        const getItemsUserInfoData = await mockViewFacet
          .connect(owner)
          .getItemsUserInfo(signer1.address, 1);
        const getItemsUserInfoDataString = getItemsUserInfoData.toString();

        const getItemsUserInfo = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getItemsUserInfoDataString,
        });

        let decodedData = utils.decodeResults(
          [viewFacetABI],
          ["getItemsUserInfo"],
          [getItemsUserInfo]
        );

        expect(await decodedData[0].tokenIds[0]).to.be.eq(shiftedItemGroupId2);
        expect(await decodedData[0].tokenIds[1]).to.be.eq(
          shiftedItemGroupId2.add(1)
        );
        expect(await decodedData[0].tokenIds[2]).to.be.eq(
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
        const testCallData1 = await mockCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );
        const testCallData1String = testCallData1.data.toString();

        //setEmissions
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        const testCallData2 = await mockCoreFacet
          .connect(owner)
          .configureBoostersBatch(
            [1, 2],
            [
              {
                set: true,
                multiplier: 2300,
                amountRequired: 3,
                groupRequired: itemGroupId2,
                contractRequired: super721.address,
                assetType: 2,
                typeOfAsset: 1,
              },
              {
                set: true,
                multiplier: 2000,
                amountRequired: 2,
                groupRequired: 0,
                contractRequired: super1155.address,
                assetType: 2,
                typeOfAsset: 2,
              },
            ]
          );
        const testCallData2String = testCallData2.data.toString();

        //configureBoosterBatch
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData2String,
        });

        const testCallData3 = await mockCoreFacet.connect(owner).addPool({
          id: 0,
          tokenStrength: 10000,
          pointStrength: 10000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          boostInfo: [1, 2],
          assetAddress: super721.address,
          typeOfAsset: 1,
        });
        const testCallData3String = testCallData3.data.toString();

        //addPool
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData3String,
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
        const testCallData1 = await mockStakingFacet.connect(owner).withdraw(
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
          1
        );
        const testCallData1String = testCallData1.data.toString();

        //withdraw
        await expect(
          owner.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData1String,
          })
        ).to.be.revertedWith("NotStaked()");
      });

      it("Reverts: withdraw amount exceeds user's amount on staking", async function () {
        const testCallData1 = await mockStakingFacet.connect(owner).withdraw(
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
          0
        );
        const testCallData1String = testCallData1.data.toString();

        //withdraw
        await expect(
          owner.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData1String,
          })
        ).to.be.revertedWith("InvalidAmount()");
      });

      // it("Reverts: withdraw amount exceeds user's amount on staking", async function () {
      //   const testCallData1 = await mockStakingFacet.connect(owner).withdraw(
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
      //     },
      //     0
      //   );
      //   const testCallData1String = testCallData1.data.toString();

      //   //withdraw
      //   await expect(
      //     owner.sendTransaction({
      //       to: stakerV3dsProxy.address,
      //       data: testCallData1String,
      //     })
      //   ).to.be.revertedWith("InvalidAmount()");
      // });

      // it("Reverts: balance of IOU token is zero", async function () {
      //   const testCallData1 = await mockStakingFacet.connect(owner).withdraw(
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
      //     },
      //     0
      //   );
      //   const testCallData1String = testCallData1.data.toString();

      //   //withdraw
      //   await expect(
      //     owner.sendTransaction({
      //       to: stakerV3dsProxy.address,
      //       data: testCallData1String,
      //     })
      //   ).to.be.revertedWith("0x2E");
      // });

      it("Reverts: trying to withdraw with incorrect IOUToken id", async function () {
        const testCallData1 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 0, {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          });

        const testCallData1String = testCallData1.data.toString();

        //deposit
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        const testCallData2 = await mockStakingFacet.connect(owner).withdraw(
          0,
          {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [0],
          },
          0
        );
        const testCallData2String = testCallData2.data.toString();

        await IOUToken.connect(signer1).transferFrom(
          signer1.address,
          signer2.address,
          0
        );

        //withdraw
        await expect(
          signer1.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData2String,
          })
        ).to.be.revertedWith("NotAnOwnerOfIOUToken()");
      });

      it("Reverts: trying to withdraw with IOUToken related to other asset", async function () {
        const addPoolCallData = await mockCoreFacet.connect(owner).addPool({
          id: 1,
          tokenStrength: 10000,
          pointStrength: 10000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          boostInfo: [1, 2],
          assetAddress: super1155.address,
          typeOfAsset: 2,
        });
        const addPoolCallDataString = addPoolCallData.data.toString();

        //addPool
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: addPoolCallDataString,
        });

        const testCallData1 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 0, {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          });

        const testCallData1String = testCallData1.data.toString();

        //deposit
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        const testCallData2 = await mockStakingFacet
          .connect(signer2)
          .deposit(1, 0, {
            assetAddress: super1155.address,
            id: [shiftedItemGroupId, shiftedItemGroupId.add(1)],
            amounts: [1, 1],
            IOUTokenId: [],
          });

        const testCallData2String = testCallData2.data.toString();

        //deposit
        await signer2.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData2String,
        });

        IOUToken.connect(signer1).transferFrom(
          signer1.address,
          signer2.address,
          0
        );

        const testCallData3 = await mockStakingFacet.connect(signer2).withdraw(
          1,
          {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [],
            IOUTokenId: [0],
          },
          0
        );
        const testCallData3String = testCallData3.data.toString();

        //withdraw
        await expect(
          signer2.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData3String,
          })
        ).to.be.revertedWith("IOUTokenFromDifferentPool()");
      });

      it("should withdraw correctly", async function () {
        const testCallData1 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 0, {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          });

        const testCallData1String = testCallData1.data.toString();

        //deposit
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        const testCallData2 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 1, {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2.add(3),
              shiftedItemGroupId2.add(4),
              shiftedItemGroupId2.add(5),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          });

        const testCallData2String = testCallData2.data.toString();

        //deposit
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData2String,
        });

        expect(await IOUToken.balanceOf(signer1.address)).to.be.eq(3);
        expect(await IOUToken.ownerOf(0)).to.be.eq(signer1.address);
        expect(await IOUToken.ownerOf(1)).to.be.eq(signer1.address);
        expect(await IOUToken.ownerOf(2)).to.be.eq(signer1.address);

        const testCallData3 = await mockStakingFacet.connect(owner).withdraw(
          0,
          {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [0, 0, 0],
            IOUTokenId: [0, 1, 2],
          },
          0
        );
        const testCallData3String = testCallData3.data.toString();

        //withdraw
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData3String,
        });

        expect(await IOUToken.balanceOf(signer1.address)).to.be.eq(0);

        const testCallData4 = await mockStakingFacet.connect(owner).withdraw(
          0,
          {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [0, 0, 0],
            IOUTokenId: [0, 1, 2],
          },
          1
        );
        const testCallData4String = testCallData4.data.toString();

        //withdraw
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData4String,
        });
      });

      it("should claim correctly", async function () {
        const testCallData2 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 1, {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2.add(3),
              shiftedItemGroupId2.add(4),
              shiftedItemGroupId2.add(5),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          });

        const startOfStaking = await (
          await ethers.provider.getBlock()
        ).timestamp;

        const testCallData2String = testCallData2.data.toString();

        //deposit
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData2String,
        });

        const testCallData1 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 0, {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          });

        const testCallData1String = testCallData1.data.toString();

        //deposit
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        expect(await IOUToken.balanceOf(signer1.address)).to.be.eq(3);
        expect(await IOUToken.ownerOf(0)).to.be.eq(signer1.address);
        expect(await IOUToken.ownerOf(1)).to.be.eq(signer1.address);
        expect(await IOUToken.ownerOf(2)).to.be.eq(signer1.address);

        await network.provider.send("evm_setNextBlockTimestamp", [
          startOfStaking + 31,
        ]);
        await ethers.provider.send("evm_mine", []);

        const testCallData3 = await mockStakingFacet
          .connect(owner)
          .claim(0, []);
        const testCallData3String = testCallData3.data.toString();

        //claim
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData3String,
        });

        // expect(
        //   await rewardToken.connect(signer1).balanceOf(signer1.address)
        // ).to.be.closeTo(ethers.utils.parseEther("1.0"));
        expect(await rewardToken.balanceOf(signer1.address)).to.be.closeTo(
          ethers.utils.parseEther("0.2"),
          ethers.utils.parseEther("0.01")
        );

        const testCallData4 = await mockStakingFacet.connect(owner).withdraw(
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
          1
        );
        const testCallData4String = testCallData4.data.toString();

        //withdraw
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData4String,
        });

        const testCallData5 = await mockStakingFacet.connect(owner).withdraw(
          0,
          {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [0, 1, 2],
          },
          0
        );
        const testCallData5String = testCallData5.data.toString();

        //withdraw
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData5String,
        });

        //expect(await IOUToken.balanceOf(signer1.address)).to.be.eq(0);

        await network.provider.send("evm_increaseTime", [30]);
        await ethers.provider.send("evm_mine", []);

        const testCallData6 = await mockStakingFacet
          .connect(owner)
          .claim(0, []);
        const testCallData6String = testCallData6.data.toString();

        //claim
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData6String,
        });
      });

      // it("Reverts: checkpoints start time and end time must be same lengths", async function () {
      //   const blockTime = await (await ethers.provider.getBlock()).timestamp;

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

      //   const testCallData1 = await mockStakingFacet.connect(signer1).claim(
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
      //   );

      //   const testCallData1String = testCallData1.data.toString();

      //   //claim
      //   await expect(
      //     signer1.sendTransaction({
      //       to: stakerV3dsProxy.address,
      //       data: testCallData1String,
      //     })
      //   ).to.be.revertedWith(
      //     "StakerV3FacetStaking::claim: mismatch of start time end time or balances arrays lengths."
      //   );
      // });

      it("Reverts: wrong signature", async function () {
        const blockTime = await (await ethers.provider.getBlock()).timestamp;

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

        const testCallData1 = await mockStakingFacet.connect(signer1).claim(
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
        );

        const testCallData1String = testCallData1.data.toString();

        //claim
        await expect(
          signer1.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData1String,
          })
        ).to.be.revertedWith("NotAnAdmin()");
      });

      it("Reverts: mismatch given arguments with hashed arguments", async function () {
        const blockTime = await (await ethers.provider.getBlock()).timestamp;

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

        const testCallData1 = await mockStakingFacet.connect(admin).claim(
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
        );

        const testCallData1String = testCallData1.data.toString();

        //claim
        await expect(
          admin.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData1String,
          })
        ).to.be.revertedWith("MismatchArgumentsAndHash()");
      });

      it("Reverts: you can't use same hash", async function () {
        const blockTime = await (await ethers.provider.getBlock()).timestamp;

        const signedDataHash = ethers.utils.solidityKeccak256(
          ["bytes", "bytes", "bytes"],
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

        const testCallData1 = await mockStakingFacet.connect(admin).claim(
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

        const testCallData1String = testCallData1.data.toString();

        //claim

        admin.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        const testCallData2 = await mockStakingFacet.connect(admin).claim(
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

        const testCallData2String = testCallData2.data.toString();

        //claim

        await expect(
          admin.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData2String,
          })
        ).to.be.revertedWith("HashUsed()");
      });

      it("should claim with checkpoints correctly", async function () {
        const blockTime = await (await ethers.provider.getBlock()).timestamp;

        const signedDataHash = ethers.utils.solidityKeccak256(
          ["bytes32", "bytes32", "bytes32"],
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

        const testCallData1 = await mockStakingFacet.connect(signer1).claim(
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

        const testCallData1String = testCallData1.data.toString();

        //claim

        signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        // expect(await rewardToken.balanceOf(signer1.address)).to.be.gt(0);
      });
    });
    describe("onERC721Received", function () {
      it("should work correctly", async function () {
        await stakerV3FacetStaking
          .connect(owner)
          .onERC721Received(owner.address, signer1.address, 1, [0x01, 0x02]);
      });
    });

    describe("approvePointSpender spendPoints, getPendingPoints, getTotalPoints", function () {
      it("approve should work correctly", async function () {
        const testCallData1 = await mockStakingFacet
          .connect(owner)
          .approvePointSpender(signer2.address, true);

        const testCallData1String = testCallData1.data.toString();

        //approvePointSpender
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });
      });

      it("Reverts: spender is not approved", async function () {
        const testCallData1 = await mockStakingFacet
          .connect(signer1)
          .spendPoints(signer2.address, 10);

        const testCallData1String = testCallData1.data.toString();

        //approvePointSpender
        await expect(
          signer1.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData1String,
          })
        ).to.be.revertedWith("NotApprovedPointSpender()");
      });

      it("Reverts: amount exceeds available points", async function () {
        const testCallData1 = await mockStakingFacet
          .connect(owner)
          .approvePointSpender(signer2.address, true);

        const testCallData1String = testCallData1.data.toString();

        //approvePointSpender
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        const testCallData2 = await mockStakingFacet
          .connect(signer2)
          .spendPoints(signer1.address, 10);

        const testCallData2String = testCallData2.data.toString();

        //approvePointSpender
        await expect(
          signer2.sendTransaction({
            to: stakerV3dsProxy.address,
            data: testCallData2String,
          })
        ).to.be.revertedWith("InvalidAmount()");
      });

      it("spendPoints should work correctly ", async function () {
        const testCallData1 = await mockCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );
        const testCallData1String = testCallData1.data.toString();

        //setEmissions
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        const testCallData2 = await mockCoreFacet
          .connect(owner)
          .configureBoostersBatch(
            [1, 2],
            [
              {
                set: true,
                multiplier: 2300,
                amountRequired: 3,
                groupRequired: itemGroupId2,
                contractRequired: super721.address,
                assetType: 2,
                typeOfAsset: 1,
              },
              {
                set: true,
                multiplier: 2000,
                amountRequired: 2,
                groupRequired: 0,
                contractRequired: super1155.address,
                assetType: 2,
                typeOfAsset: 2,
              },
            ]
          );
        const testCallData2String = testCallData2.data.toString();

        //configureBoosterBatch
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData2String,
        });

        const testCallData3 = await mockCoreFacet.connect(owner).addPool({
          id: 0,
          tokenStrength: 10000,
          pointStrength: 10000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          boostInfo: [1, 2],
          assetAddress: super721.address,
          typeOfAsset: 1,
        });
        const testCallData3String = testCallData3.data.toString();

        //addPool
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData3String,
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

        const testCallData4 = await mockStakingFacet
          .connect(owner)
          .approvePointSpender(signer2.address, true);

        const testCallData4String = testCallData4.data.toString();

        //approvePointSpender
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData4String,
        });

        const testCallData5 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 0, {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          });

        const testCallData5String = testCallData5.data.toString();

        //deposit
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData5String,
        });

        await network.provider.send("evm_increaseTime", [30]);
        await ethers.provider.send("evm_mine", []);

        const testCallData6 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 0, {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2.add(3),
              shiftedItemGroupId2.add(4),
              shiftedItemGroupId2.add(5),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          });

        const testCallData6String = testCallData6.data.toString();

        //deposit
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData6String,
        });

        const testCallData7 = await mockStakingFacet
          .connect(signer2)
          .spendPoints(signer1.address, 10);

        const testCallData7String = testCallData7.data.toString();

        //spendPoints

        signer2.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData7String,
        });
      });
    });
    describe("apply boost", function () {
      beforeEach(async function () {
        const testCallData1 = await mockCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );
        const testCallData1String = testCallData1.data.toString();

        //setEmissions
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        const testCallData2 = await mockCoreFacet
          .connect(owner)
          .configureBoostersBatch(
            [1, 2],
            [
              {
                set: true,
                multiplier: 2300,
                amountRequired: 3,
                groupRequired: itemGroupId2,
                contractRequired: super721.address,
                assetType: 0,
                typeOfAsset: 1,
              },
              {
                set: true,
                multiplier: 2000,
                amountRequired: 2,
                groupRequired: 0,
                contractRequired: super721.address,
                assetType: 1,
                typeOfAsset: 1,
              },
            ]
          );
        const testCallData2String = testCallData2.data.toString();

        //configureBoosterBatch
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData2String,
        });

        const testCallData3 = await mockCoreFacet.connect(owner).addPool({
          id: 0,
          tokenStrength: 10000,
          pointStrength: 10000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          boostInfo: [1, 2],
          assetAddress: super721.address,
          typeOfAsset: 1,
        });
        const testCallData3String = testCallData3.data.toString();

        //addPool
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData3String,
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
        const testCallData1 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 1, {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          });

        const testCallData1String = testCallData1.data.toString();

        //deposit
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        await network.provider.send("evm_increaseTime", [30]);
        await ethers.provider.send("evm_mine", []);

        const testCallData2 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 2, {
            assetAddress: super721.address,
            id: [shiftedItemGroupId2.add(3), shiftedItemGroupId2.add(4)],
            amounts: [1, 1],
            IOUTokenId: [],
          });

        const testCallData2String = testCallData2.data.toString();

        //deposit
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData2String,
        });

        const testCallData3 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 0, {
            assetAddress: super721.address,
            id: [shiftedItemGroupId2.add(5), shiftedItemGroupId2.add(6)],
            amounts: [1, 1],
            IOUTokenId: [],
          });

        const testCallData3String = testCallData3.data.toString();

        //deposit
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData3String,
        });

        const testCallData4 = await mockCoreFacet.connect(owner).addPool({
          id: 1,
          tokenStrength: 15000,
          pointStrength: 15000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          boostInfo: [],
          assetAddress: super721.address,
          typeOfAsset: 1,
        });
        const testCallData4String = testCallData4.data.toString();

        //deposit
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData4String,
        });

        const testCallData5 = await mockStakingFacet
          .connect(signer2)
          .deposit(1, 0, {
            assetAddress: super721.address,
            id: [shiftedItemGroupId2.add(7)],
            amounts: [1],
            IOUTokenId: [],
          });

        const testCallData5String = testCallData5.data.toString();

        //deposit
        await signer2.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData5String,
        });
      });

      it("should get total points correctly", async function () {
        const testCallData1 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 1, {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          });

        const testCallData1String = testCallData1.data.toString();

        //deposit
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        await network.provider.send("evm_increaseTime", [30]);
        await ethers.provider.send("evm_mine", []);

        const testCallData2 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 2, {
            assetAddress: super721.address,
            id: [shiftedItemGroupId2.add(3), shiftedItemGroupId2.add(4)],
            amounts: [1, 1],
            IOUTokenId: [],
          });

        const testCallData2String = testCallData2.data.toString();

        //deposit
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData2String,
        });

        const testCallData3 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 0, {
            assetAddress: super721.address,
            id: [shiftedItemGroupId2.add(5), shiftedItemGroupId2.add(6)],
            amounts: [1, 1],
            IOUTokenId: [],
          });

        const testCallData3String = testCallData3.data.toString();

        //deposit
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData3String,
        });

        const testCallData4 = await mockCoreFacet.connect(owner).addPool({
          id: 1,
          tokenStrength: 15000,
          pointStrength: 15000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          boostInfo: [],
          assetAddress: super721.address,
          typeOfAsset: 1,
        });
        const testCallData4String = testCallData4.data.toString();

        //deposit
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData4String,
        });

        const testCallData5 = await mockStakingFacet
          .connect(signer2)
          .deposit(1, 0, {
            assetAddress: super721.address,
            id: [shiftedItemGroupId2.add(7)],
            amounts: [1],
            IOUTokenId: [],
          });

        const testCallData5String = testCallData5.data.toString();

        //deposit
        await signer2.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData5String,
        });
      });
    });
    describe("getPendingTokens", function () {
      beforeEach(async function () {
        const testCallData1 = await mockCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );
        const testCallData1String = testCallData1.data.toString();

        //setEmissions
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        const testCallData2 = await mockCoreFacet
          .connect(owner)
          .configureBoostersBatch(
            [1, 2],
            [
              {
                set: true,
                multiplier: 2300,
                amountRequired: 3,
                groupRequired: itemGroupId2,
                contractRequired: super721.address,
                assetType: 0,
                typeOfAsset: 1,
              },
              {
                set: true,
                multiplier: 2000,
                amountRequired: 2,
                groupRequired: 0,
                contractRequired: super721.address,
                assetType: 1,
                typeOfAsset: 1,
              },
            ]
          );
        const testCallData2String = testCallData2.data.toString();

        //configureBoosterBatch
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData2String,
        });

        const testCallData3 = await mockCoreFacet.connect(owner).addPool({
          id: 0,
          tokenStrength: 10000,
          pointStrength: 10000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          boostInfo: [1, 2],
          assetAddress: super721.address,
          typeOfAsset: 1,
        });
        const testCallData3String = testCallData3.data.toString();

        //addPool
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData3String,
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

        const testCallData4 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 1, {
            assetAddress: super721.address,
            id: [
              shiftedItemGroupId2,
              shiftedItemGroupId2.add(1),
              shiftedItemGroupId2.add(2),
            ],
            amounts: [1, 1, 1],
            IOUTokenId: [],
          });

        const testCallData4String = testCallData4.data.toString();

        //deposit
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData4String,
        });

        const testCallData5 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 2, {
            assetAddress: super721.address,
            id: [shiftedItemGroupId2.add(3), shiftedItemGroupId2.add(4)],
            amounts: [1, 1],
            IOUTokenId: [],
          });

        const testCallData5String = testCallData5.data.toString();

        //deposit
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData5String,
        });

        const testCallData6 = await mockStakingFacet
          .connect(signer1)
          .deposit(0, 0, {
            assetAddress: super721.address,
            id: [shiftedItemGroupId2.add(5), shiftedItemGroupId2.add(6)],
            amounts: [1, 1],
            IOUTokenId: [],
          });

        const testCallData6String = testCallData6.data.toString();

        //deposit
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData6String,
        });
      });
      it("getPendingTokens should work correctly", async function () {
        const stakingFacetABI = await hre.artifacts.readArtifact(
          "StakerV3FacetStaking"
        );

        await network.provider.send("evm_increaseTime", [30]);
        await ethers.provider.send("evm_mine", []);

        const getPendingTokens = await mockStakingFacet
          .connect(owner)
          .getPendingTokens(0, signer1.address);
        const getPendingTokensString = getPendingTokens.toString();

        const getPendingTokensCall = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getPendingTokens,
        });

        const decodedData = utils.decodeResults(
          [stakingFacetABI],
          ["getPendingTokens"],
          [getPendingTokensCall]
        );

        expect(await decodedData[0]).be.closeTo(
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

        const getPendingTokens = await mockStakingFacet
          .connect(owner)
          .getPendingPoints(0, signer1.address);
        const getPendingTokensString = getPendingTokens.toString();

        const getPendingTokensCall = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getPendingTokens,
        });

        const decodedData = utils.decodeResults(
          [stakingFacetABI],
          ["getPendingPoints"],
          [getPendingTokensCall]
        );

        expect(await decodedData[0]).be.closeTo(
          ethers.utils.parseEther("200"),
          10 ** 15
        );
      });

      it("getAvailablePoints and getTotalPoints should work correctly", async function () {
        let startOfStaking = await (await ethers.provider.getBlock()).timestamp;
        const stakingFacetABI = await hre.artifacts.readArtifact(
          "StakerV3FacetStaking"
        );
        const testCallData1 = await mockStakingFacet
          .connect(owner)
          .approvePointSpender(signer2.address, true);

        const testCallData1String = testCallData1.data.toString();

        //approvePointSpender
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        const testCallData2 = await mockStakingFacet
          .connect(signer2)
          .spendPoints(signer1.address, ethers.utils.parseEther("50"));

        const testCallData2String = testCallData2.data.toString();

        //spendPoints
        signer2.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData2String,
        });

        await network.provider.send("evm_setNextBlockTimestamp", [
          startOfStaking + 29,
        ]);
        await ethers.provider.send("evm_mine", []);

        const getAvailablePoints = await mockStakingFacet
          .connect(owner)
          .getAvailablePoints(signer1.address);
        const getAvailablePointsString = getAvailablePoints.toString();

        const getAvailablePointsCall = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getAvailablePoints,
        });

        let decodedData = utils.decodeResults(
          [stakingFacetABI],
          ["getAvailablePoints"],
          [getAvailablePointsCall]
        );

        expect(await decodedData[0]).be.closeTo(
          ethers.utils.parseEther("150"),
          10 ** 15
        );

        const getTotalPoints = await mockStakingFacet
          .connect(owner)
          .getTotalPoints(signer1.address);
        const getTotalPointsString = getTotalPoints.toString();

        const getTotalPointsCall = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getTotalPoints,
        });

        decodedData = utils.decodeResults(
          [stakingFacetABI],
          ["getTotalPoints"],
          [getTotalPointsCall]
        );

        expect(await decodedData[0]).be.closeTo(
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

        const testCallData1 = await mockCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp:
                (await (await ethers.provider.getBlock()).timestamp) + 10000,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ],
          [
            {
              timeStamp:
                (await (await ethers.provider.getBlock()).timestamp) + 10000,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
          ]
        );

        // setEmissions
        const testCallData1String = testCallData1.data.toString();
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        const testCallData2 = await mockCoreFacet.connect(owner).addPool({
          id: 1,
          tokenStrength: 10000,
          pointStrength: 10000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          boostInfo: [],
          assetAddress: super721.address,
          typeOfAsset: 1,
        });
        const testCallData2String = testCallData2.data.toString();

        //addPool
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData2String,
        });

        //console.log(await (await ethers.provider.getBlock()).timestamp);

        // await network.provider.send("evm_increaseTime", [35]);
        // await ethers.provider.send("evm_mine", []);
        //console.log(await (await ethers.provider.getBlock()).timestamp);

        const getPendingTokens = await mockStakingFacet
          .connect(owner)
          .getPendingTokens(1, signer1.address);
        const getPendingTokensString = getPendingTokens.toString();

        const getPendingTokensCall = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getPendingTokens,
        });

        let decodedData = utils.decodeResults(
          [stakingFacetABI],
          ["getPendingPoints"],
          [getPendingTokensCall]
        );

        expect(await decodedData[0]).be.closeTo(
          ethers.utils.parseEther("0"),
          10 ** 15
        );

        const getPendingPoints = await mockStakingFacet
          .connect(owner)
          .getPendingPoints(1, signer1.address);
        const getPendingPointsString = getPendingPoints.toString();

        const getPendingPointsCall = await ethers.provider.call({
          to: stakerV3dsProxy.address,
          data: getPendingPoints,
        });

        decodedData = utils.decodeResults(
          [stakingFacetABI],
          ["getPendingPoints"],
          [getPendingPointsCall]
        );

        expect(await decodedData[0]).be.closeTo(
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

        const testCallData1 = await mockCoreFacet.connect(owner).setEmissions(
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
            {
              timeStamp:
                (await (await ethers.provider.getBlock()).timestamp) + 36,
              rate: ethers.utils.parseEther("2"),
            },
          ],
          [
            {
              timeStamp: await (await ethers.provider.getBlock()).timestamp,
              rate: ethers.utils.parseEther("6.6666666666"),
            },
            {
              timeStamp:
                (await (await ethers.provider.getBlock()).timestamp) + 30,
              rate: ethers.utils.parseEther("0.1"),
            },
          ]
        );

        // setEmissions
        const testCallData1String = testCallData1.data.toString();
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData1String,
        });

        const testCallData2 = await mockCoreFacet.connect(owner).addPool({
          id: 1,
          tokenStrength: 10000,
          pointStrength: 10000,
          groupId: 0,
          tokensPerShare: 0,
          pointsPerShare: 0,
          boostInfo: [],
          assetAddress: super721.address,
          typeOfAsset: 1,
        });
        const testCallData2String = testCallData2.data.toString();

        //addPool
        await owner.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData2String,
        });

        const testCallData3 = await mockStakingFacet
          .connect(signer1)
          .deposit(1, 0, {
            id: [shiftedItemGroupId2, shiftedItemGroupId2.add(1)],
            amounts: [1, 1],
            assetAddress: super721.address,
            IOUTokenId: [],
          });
        const testCallData3String = testCallData3.data.toString();

        //deposit
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData3String,
        });

        const testCallData4 = await mockStakingFacet
          .connect(signer1)
          .claim(1, []);
        const testCallData4String = testCallData4.data.toString();

        //claim
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData4String,
        });
        //console.log(await (await ethers.provider.getBlock()).timestamp);

        await network.provider.send("evm_increaseTime", [30]);
        await ethers.provider.send("evm_mine", []);

        const testCallData5 = await mockStakingFacet
          .connect(signer1)
          .deposit(1, 0, {
            id: [shiftedItemGroupId2.add(2), shiftedItemGroupId2.add(3)],
            amounts: [1, 1],
            assetAddress: super721.address,
            IOUTokenId: [],
          });
        const testCallData5String = testCallData5.data.toString();

        //deposit
        await signer1.sendTransaction({
          to: stakerV3dsProxy.address,
          data: testCallData5String,
        });

        // const testCallData3 = await mockStakingFacet
        //   .connect(signer1)
        //   .deposit(1, 0, {
        //     id: [shiftedItemGroupId2, shiftedItemGroupId2.add(1)],
        //     amounts: [1, 1],
        //     assetAddress: super721.address,
        //     IOUTokenId: [],
        //   });
        // const testCallData3String = testCallData3.data.toString();

        // //deposit
        // await signer1.sendTransaction({
        //   to: stakerV3dsProxy.address,
        //   data: testCallData3String,
        // });
      });
    });
  });

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
      const addDevCallData = await mockCoreFacet
        .connect(owner)
        .addDeveloper(developer.address, 1000);
      const addDevCallDataString = addDevCallData.data.toString();

      // execute addDeveloper
      await owner.sendTransaction({
        to: stakerV3dsProxy.address,
        data: addDevCallDataString,
      });

      //await stakerV3FacetCore.connect(owner).initialize(owner.address);

      // Note 6.6666666666 per second is equivalent to 100 per 15 seconds(15 seconds = block time according to Blocks implementation)
      // Now the rewards must be set based on seconds
      const testCallData1 = await mockCoreFacet.connect(owner).setEmissions(
        [
          {
            timeStamp: await (await ethers.provider.getBlock()).timestamp,
            rate: ethers.utils.parseEther("6.6666666666"),
          },
        ],
        [
          {
            timeStamp: await (await ethers.provider.getBlock()).timestamp,
            rate: ethers.utils.parseEther("6.6666666666"),
          },
        ]
      );
      const testCallData1String = testCallData1.data.toString();

      //setEmissions
      await owner.sendTransaction({
        to: stakerV3dsProxy.address,
        data: testCallData1String,
      });

      const testCallData2 = await mockCoreFacet
        .connect(owner)
        .configureBoostersBatch(
          [1, 2],
          [
            {
              set: true,
              multiplier: 2300,
              amountRequired: 3,
              groupRequired: itemGroupId2,
              contractRequired: super721.address,
              assetType: 2,
              typeOfAsset: 1,
            },
            {
              set: true,
              multiplier: 2000,
              amountRequired: 2,
              groupRequired: 0,
              contractRequired: super1155.address,
              assetType: 2,
              typeOfAsset: 2,
            },
          ]
        );
      const testCallData2String = testCallData2.data.toString();

      //configureBoosterBatch
      await owner.sendTransaction({
        to: stakerV3dsProxy.address,
        data: testCallData2String,
      });

      const testCallData3 = await mockCoreFacet.connect(owner).addPool({
        id: 0,
        tokenStrength: 10000,
        pointStrength: 10000,
        groupId: 0,
        tokensPerShare: 0,
        pointsPerShare: 0,
        boostInfo: [1, 2],
        assetAddress: super721.address,
        typeOfAsset: 1,
      });
      const testCallData3String = testCallData3.data.toString();

      //addPool
      await owner.sendTransaction({
        to: stakerV3dsProxy.address,
        data: testCallData3String,
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
      //User1-Deposit
      const testCallData4 = await mockStakingFacet
        .connect(signer1)
        .deposit(0, 0, {
          assetAddress: super721.address,
          id: [
            shiftedItemGroupId2,
            shiftedItemGroupId2.add(1),
            shiftedItemGroupId2.add(2),
          ],
          amounts: [1, 1, 1],
          IOUTokenId: [],
        });

      const testCallData4String = testCallData4.data.toString();

      //deposit
      await signer1.sendTransaction({
        to: stakerV3dsProxy.address,
        data: testCallData4String,
      });

      expect(await IOUToken.balanceOf(signer1.address)).to.be.eq(3);
      expect(await IOUToken.ownerOf(0)).to.be.eq(signer1.address);
      expect(await IOUToken.ownerOf(1)).to.be.eq(signer1.address);
      await network.provider.send("evm_increaseTime", [30]);
      await ethers.provider.send("evm_mine", []);

      //User1-StakeITEMS
      const testCallData5 = await mockStakingFacet
        .connect(signer1)
        .deposit(0, 1, {
          assetAddress: super721.address,
          id: [
            shiftedItemGroupId2.add(3),
            shiftedItemGroupId2.add(4),
            shiftedItemGroupId2.add(5),
          ],
          amounts: [1, 1, 1],
          IOUTokenId: [],
        });

      const testCallData5String = testCallData5.data.toString();
      expect(await super721.ownerOf(shiftedItemGroupId2.add(3))).to.be.eq(
        signer1.address
      );

      //deposit
      await signer1.sendTransaction({
        to: stakerV3dsProxy.address,
        data: testCallData5String,
      });

      expect(await super721.ownerOf(shiftedItemGroupId2.add(3))).to.be.eq(
        stakerV3dsProxy.address
      );
      expect(await super721.ownerOf(shiftedItemGroupId2.add(5))).to.be.eq(
        stakerV3dsProxy.address
      );

      //user2 stake items
      const testCallData6 = await mockStakingFacet
        .connect(signer2)
        .deposit(0, 2, {
          assetAddress: super1155.address,
          id: [shiftedItemGroupId, shiftedItemGroupId.add(1)],
          amounts: [1, 1],
          IOUTokenId: [],
        });

      const testCallData6String = testCallData6.data.toString();

      //deposit
      await signer2.sendTransaction({
        to: stakerV3dsProxy.address,
        data: testCallData6String,
      });

      expect(
        await super1155.balanceOf(signer2.address, shiftedItemGroupId)
      ).to.be.eq(19);

      await network.provider.send("evm_increaseTime", [30]);
      await ethers.provider.send("evm_mine", []);

      //User2-Deposit
      const testCallData7 = await mockStakingFacet
        .connect(signer2)
        .deposit(0, 0, {
          assetAddress: super721.address,
          id: [
            shiftedItemGroupId2.add(7),
            shiftedItemGroupId2.add(8),
            shiftedItemGroupId2.add(9),
          ],
          amounts: [1, 1, 1],
          IOUTokenId: [],
        });

      const testCallData7String = testCallData7.data.toString();

      //deposit
      await signer2.sendTransaction({
        to: stakerV3dsProxy.address,
        data: testCallData7String,
      });
      await network.provider.send("evm_increaseTime", [15]);
      await ethers.provider.send("evm_mine", []);

      //User1-Claims
      const testCallData8 = await mockStakingFacet
        .connect(signer1)
        .claim(0, []);

      const testCallData8String = testCallData8.data.toString();

      //claim
      await signer1.sendTransaction({
        to: stakerV3dsProxy.address,
        data: testCallData8String,
      });

      expect(await super721.ownerOf(shiftedItemGroupId2.add(5))).to.be.eq(
        stakerV3dsProxy.address
      );
      //User1-UnstakeITEMS
      const testCallData9 = await mockStakingFacet.connect(signer1).withdraw(
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
        1
      );

      const testCallData9String = testCallData9.data.toString();

      //withdraw
      await signer1.sendTransaction({
        to: stakerV3dsProxy.address,
        data: testCallData9String,
      });

      expect(await super721.ownerOf(shiftedItemGroupId2.add(5))).to.be.eq(
        signer1.address
      );

      await network.provider.send("evm_increaseTime", [15]);
      await ethers.provider.send("evm_mine", []);

      //User2-Withdraw
      const testCallData10 = await mockStakingFacet.connect(signer2).withdraw(
        0,
        {
          assetAddress: super721.address,
          id: [],
          amounts: [1, 1, 1],
          IOUTokenId: [3, 4, 5],
        },
        0
      );

      const testCallData10String = testCallData10.data.toString();

      //withdraw
      await signer2.sendTransaction({
        to: stakerV3dsProxy.address,
        data: testCallData10String,
      });

      expect(await super721.ownerOf(shiftedItemGroupId2.add(5))).to.be.eq(
        signer1.address
      );
      await network.provider.send("evm_increaseTime", [15]);
      await ethers.provider.send("evm_mine", []);

      //   //User2-Claims
      const testCallData11 = await mockStakingFacet
        .connect(signer2)
        .claim(0, []);

      const testCallData11String = testCallData11.data.toString();

      //claim
      await signer2.sendTransaction({
        to: stakerV3dsProxy.address,
        data: testCallData11String,
      });

      //User2-UnstakeITEMS
      const testCallData12 = await mockStakingFacet.connect(signer2).withdraw(
        0,
        {
          assetAddress: super1155.address,
          id: [shiftedItemGroupId, shiftedItemGroupId.add(1)],
          amounts: [1, 1],
          IOUTokenId: [],
        },
        2
      );

      const testCallData12String = testCallData12.data.toString();

      //withdraw
      await signer2.sendTransaction({
        to: stakerV3dsProxy.address,
        data: testCallData12String,
      });

      // //User1-Deposit
      // const testCallData12 = await mockStakingFacet
      //   .connect(signer1)
      //   .deposit(0, 0, {
      //     assetAddress: super721.address,
      //     id: [
      //       shiftedItemGroupId2,
      //       shiftedItemGroupId2.add(1),
      //       shiftedItemGroupId2.add(2),
      //     ],
      //     amounts: [1, 1, 1],
      //     IOUTokenId: [],
      //   });

      // const testCallData12String = testCallData12.data.toString();

      // //deposit
      // await signer1.sendTransaction({
      //   to: stakerV3dsProxy.address,
      //   data: testCallData12String,
      // });
    });
  });
});
