// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../../base/Sweepableds.sol";
import "../../interfaces/ISuperGeneric.sol";
// import "../../assets/erc721/interfaces/ISuper721.sol";

import "./StakerV3Blueprint.sol";

/**
  @title An asset staking contract.
  @author Tim Clancy
  @author Qazawat Zirak
  @author Nikita Elunin
  This staking contract disburses tokens from its internal reservoir according
  to a fixed emission schedule. Assets can be assigned varied staking weights.
  It also supports Items staking for boosts on native ERC20 staking rewards.
  The item staking supports Fungible, Non-Fungible and Semi-Fungible staking.
  This code is inspired by and modified from Sushi's Master Chef contract.
  https://github.com/sushiswap/sushiswap/blob/master/contracts/MasterChef.sol
*/
contract StakerV3FacetCore is Sweepableds, ReentrancyGuard, ERC1155Holder, IERC721Receiver {
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.UintSet;

  /** 
    A function that needs to be called immediately after deployment.
    Sets the owner of the newly deployed proxy.
  */
  function initialize(address _owner) external initializer {
    
    __Ownable_init_unchained();
    transferOwnership(_owner);
  }

  /**
    Add a new developer to the StakerV2 or overwrite an existing one.
    This operation requires that developer address addition is not locked.
    @param _developerAddress the additional developer's address.
    @param _share the share in 1/1000th of a percent of each token emission sent
      to this new developer.
  */
  function addDeveloper(address _developerAddress, uint256 _share) external hasValidPermit(UNIVERSAL, StakerV3Blueprint.ADD_DEVELOPER) {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();

    require(b.canAlterDevelopers,
      "0x1A");
    b.developerAddresses.push(_developerAddress);
    b.developerShares[_developerAddress] = _share;
  }

  /**
    Permanently forfeits owner ability to alter the state of StakerV2 developers.
    Once called, this function is intended to give peace of mind to the StakerV2's
    developers and community that the fee structure is now immutable.
  */
  function lockDevelopers() external hasValidPermit(UNIVERSAL, StakerV3Blueprint.LOCK_DEVELOPERS) {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();

    b.canAlterDevelopers = false;
  }

  /**
    A developer may at any time update their address or voluntarily reduce their
    share of emissions by calling this function from their current address.
    Note that updating a developer's share to zero effectively removes them.
    @param _newDeveloperAddress an address to update this developer's address.
    @param _newShare the new share in 1/1000th of a percent of each token
      emission sent to this developer.
  */
  function updateDeveloper(address _newDeveloperAddress, uint256 _newShare) external {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();

    uint256 developerShare = b.developerShares[msg.sender];
    require(developerShare > 0,
      "0x2A");
    require(_newShare <= developerShare,
      "0x3A");
    b.developerShares[msg.sender] = 0;
    b.developerAddresses.push(_newDeveloperAddress);
    b.developerShares[_newDeveloperAddress] = _newShare;
  }

  /**
    Set new emission details to the StakerV2 or overwrite existing ones.
    This operation requires that emission schedule alteration is not locked.
    @param _tokenSchedule an array of EmissionPoints defining the token schedule.
    @param _pointSchedule an array of EmissionPoints defining the point schedule.
  */
  function setEmissions(StakerV3Blueprint.EmissionPoint[] memory _tokenSchedule, StakerV3Blueprint.EmissionPoint[] memory _pointSchedule) external hasValidPermit(UNIVERSAL, StakerV3Blueprint.SET_EMISSIONS) {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();

    if (_tokenSchedule.length > 0) {
      require(b.canAlterTokenEmissionSchedule,
        "0x1B");
      b.tokenEmissionEventsCount = _tokenSchedule.length;
      for (uint256 i = 0; i < b.tokenEmissionEventsCount; i++) {
        b.tokenEmissionEvents[i] = _tokenSchedule[i];
        if (b.earliestTokenEmissionEvent > _tokenSchedule[i].timeStamp) {
          b.earliestTokenEmissionEvent = _tokenSchedule[i].timeStamp;
        }
      }
    }
    require(b.tokenEmissionEventsCount > 0,
      "0x2B");

    if (_pointSchedule.length > 0) {
      require(b.canAlterPointEmissionSchedule,
        "0x3B");
      b.pointEmissionEventsCount = _pointSchedule.length;
      for (uint256 i = 0; i < b.pointEmissionEventsCount; i++) {
        b.pointEmissionEvents[i] = _pointSchedule[i];
        if (b.earliestPointEmissionEvent > _pointSchedule[i].timeStamp) {
        b.earliestPointEmissionEvent = _pointSchedule[i].timeStamp;
        }
      }
    }
    require(b.pointEmissionEventsCount > 0,
      "0x4B");
  }

  /**
    Permanently forfeits owner ability to alter the emission schedule.
    Once called, this function is intended to give peace of mind to the StakerV2's
    developers and community that the inflation rate is now immutable.
  */
  function lockTokenEmissions() external hasValidPermit(UNIVERSAL, StakerV3Blueprint.LOCK_TOKEN_EMISSIONS) {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();

    b.canAlterTokenEmissionSchedule = false;
  }

  /**
    Permanently forfeits owner ability to alter the emission schedule.
    Once called, this function is intended to give peace of mind to the StakerV2's
    developers and community that the inflation rate is now immutable.
  */
  function lockPointEmissions() external hasValidPermit(UNIVERSAL, StakerV3Blueprint.LOCK_POINT_EMISSIONS) {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();

    b.canAlterPointEmissionSchedule = false;
  }

  /** 
    Create or edit boosters in batch with boost parameters
    @param _ids array of booster IDs.
    @param _boostInfo array of boostInfo.

    Should not be reconfigured if it was made public for staking Items.
  */
  function configureBoostersBatch(uint256[] memory _ids, StakerV3Blueprint.BoostInfo[] memory _boostInfo) external hasValidPermit(UNIVERSAL, StakerV3Blueprint.CONFIGURE_BOOSTERS) {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();

    require(_boostInfo.length > 0, 
      "0x1C");
    require(_ids.length == _boostInfo.length, 
      "0x1Z");

    for (uint256 i = 0; i < _boostInfo.length; i++) {
      require(_boostInfo[i].multiplier != 0 || _boostInfo[i].amountRequired != 0 || _boostInfo[i].contractRequired != address(0), "0x1C");

      if (b.boostInfo[i].multiplier == 0 && _boostInfo[i].multiplier != 0) {
        b.activeBoosters++;
      }

      b.boostInfo[_ids[i]] = StakerV3Blueprint.BoostInfo({ 
          multiplier: _boostInfo[i].multiplier,
          amountRequired: _boostInfo[i].amountRequired,
          groupRequired: _boostInfo[i].groupRequired,
          contractRequired: _boostInfo[i].contractRequired,
          assetType: _boostInfo[i].assetType
      });
    }
  }
  
  /**
    Allows the contract owner to add a new asset pool to the Staker or overwrite
    an existing one.
    @param _addPoolStruct struct, which we use to create new pool
  */
  function addPool(StakerV3Blueprint.AddPoolStruct memory _addPoolStruct) external hasValidPermit(UNIVERSAL, StakerV3Blueprint.ADD_POOL) {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();

    require(b.tokenEmissionEventsCount > 0 && b.pointEmissionEventsCount > 0,
      "0x1D");
    require(address(_addPoolStruct.assetAddress) != address(b.token), 
      "0x2D");
    require(_addPoolStruct.tokenStrength > 0 && _addPoolStruct.pointStrength > 0, 
      "0x3D");

    uint256 lastTokenRewardTime = block.timestamp > b.earliestTokenEmissionEvent ? block.timestamp : b.earliestTokenEmissionEvent;
    uint256 lastPointRewardTime = block.timestamp > b.earliestPointEmissionEvent ? block.timestamp : b.earliestPointEmissionEvent;
    uint256 lastRewardEvent = lastTokenRewardTime > lastPointRewardTime ? lastTokenRewardTime : lastPointRewardTime;
    if (address(b.poolInfo[_addPoolStruct.id].assetAddress) == address(0)) {
      b.poolAssets.push(_addPoolStruct.assetAddress);
      b.totalTokenStrength = b.totalTokenStrength + _addPoolStruct.tokenStrength;
      b.totalPointStrength = b.totalPointStrength + _addPoolStruct.pointStrength;
      b.poolInfo[_addPoolStruct.id] = StakerV3Blueprint.PoolInfo({
        assetAddress: _addPoolStruct.assetAddress,
        tokenStrength: _addPoolStruct.tokenStrength,
        tokenBoostedDeposit: 0,
        tokensPerShare: _addPoolStruct.tokensPerShare,
        pointStrength: _addPoolStruct.pointStrength,
        pointBoostedDeposit: 0,
        pointsPerShare: _addPoolStruct.pointsPerShare,
        lastRewardEvent: lastRewardEvent,
        boostInfo: _addPoolStruct.boostInfo
      });
      b.lastPoolId++;
    } else {
      b.totalTokenStrength = (b.totalTokenStrength - b.poolInfo[_addPoolStruct.id].tokenStrength) + _addPoolStruct.tokenStrength;
      b.poolInfo[_addPoolStruct.id].tokenStrength = _addPoolStruct.tokenStrength;
      b.totalPointStrength = (b.totalPointStrength - b.poolInfo[_addPoolStruct.id].pointStrength) + _addPoolStruct.pointStrength;
      b.poolInfo[_addPoolStruct.id].pointStrength = _addPoolStruct.pointStrength;

      // Append boosters by avoid writing to storage directly in a loop to avoid costs
      uint256[] memory boosters = new uint256[](b.poolInfo[_addPoolStruct.id].boostInfo.length + _addPoolStruct.boostInfo.length);
      for (uint256 i = 0; i < b.poolInfo[_addPoolStruct.id].boostInfo.length; i++) {
        boosters[i] = b.poolInfo[_addPoolStruct.id].boostInfo[i];
      }
      for (uint256 i = 0; i < _addPoolStruct.boostInfo.length; i++) {
        boosters[i + b.poolInfo[_addPoolStruct.id].boostInfo.length] = _addPoolStruct.boostInfo[i];
      }
      StakerV3Blueprint.PoolInfo storage pool = b.poolInfo[_addPoolStruct.id];
      pool.boostInfo = boosters; // Appended boosters
    }
  }


  function onERC721Received(
      address operator,
      address from,
      uint256 tokenId,
      bytes calldata data
  ) external override returns (bytes4) {

    return this.onERC721Received.selector;
  }
}