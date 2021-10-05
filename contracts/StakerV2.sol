// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "./ISuperGeneric.sol";

/**
  @title An asset staking contract.
  @author Tim Clancy
  @author Qazawat Zirak
  This staking contract disburses tokens from its internal reservoir according
  to a fixed emission schedule. Assets can be assigned varied staking weights.
  It also supports NFT staking for boosts on native ERC20 staking rewards.
  This code is inspired by and modified from Sushi's Master Chef contract.
  https://github.com/sushiswap/sushiswap/blob/master/contracts/MasterChef.sol
*/
contract StakerV2 is IERC721Receiver, IERC1155Receiver, Ownable, ReentrancyGuard {
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.UintSet;

  // Descriptive name for this contract.
  string public name;

  // Token to disburse to stakers.
  IERC20 public token;

  // If contract owner can add/set developers.
  bool public canAlterDevelopers;

  // Developer addresses for finding shares in the 'developerShares'.
  address[] public developerAddresses;

  /**  
    @dev A mapping of developer addresses to their percent share of emissions.
    Share percentages are represented as 1/1000th of a percent. That is, a 1%
    share of emissions should map an address to 1000.
  */
  mapping (address => uint256) public developerShares;

  // If contract owner can alter emissions.
  bool public canAlterTokenEmissionSchedule;
  bool public canAlterPointEmissionSchedule;

  /**  
    This emission schedule maps a timestamp to the amount of tokens or points 
    that should be disbursed starting at that timestamp per-second onwards.
    @param timeStamp if current time reaches timestamp, the rate is applied.
    @param rate measure of points/tokens emitted per-second.
  */
  struct EmissionPoint {
    uint256 timeStamp;
    uint256 rate;
  }

  // Array of emission schedule timestamps for finding emission rate changes.
  uint256 public tokenEmissionEventsCount;
  uint256 public pointEmissionEventsCount;
  mapping (uint256 => EmissionPoint) public tokenEmissionEvents;
  mapping (uint256 => EmissionPoint) public pointEmissionEvents;

  // Store the very earliest possible timestamp for quick reference.
  uint256 MAX_INT = 2**256 - 1;
  uint256 internal earliestTokenEmissionEvent;
  uint256 internal earliestPointEmissionEvent;

/**  
    A struct containing the pool info.
    @param token address of the ERC20 asset that is being staked in the pool.
    @param tokenStrength the relative token emission strength of this pool.
    @param tokenBoostedDeposit amount of tokens after boosts are applied.
    @param tokensPerShare accumulated tokens per share times 1e12.
    @param pointStrength the relative point emission strength of this pool.
    @param pointBoostedDeposit amount of points after boosts are applied.
    @param pointsPerShare accumulated points per share times 1e12.
    @param lastRewardEvent record of the time of the last disbursement.
    @param boostInfo boosters applied to the pool rewards when eligible.
    @notice tokenBoostedDeposit & pointBoostedDeposit do not change emission
    rate, but used to calculate perShare amount when there are boosters.
  */
  struct PoolInfo {
    IERC20 token;
    uint256 tokenStrength;
    uint256 tokenBoostedDeposit;
    uint256 tokensPerShare;
    uint256 pointStrength;
    uint256 pointBoostedDeposit;
    uint256 pointsPerShare;
    uint256 lastRewardEvent;
    uint256[] boostInfo;
  }

  // Array for enumeration of the pools.
  IERC20[] public poolTokens;

  // Mapping of pools to 'PoolInfo' based on their deposit tokens.
  mapping (IERC20 => PoolInfo) public poolInfo;

  /**  
    A struct containing the Fungible Token Staker information.
    @param amount amount of the pool asset being provided by the user.
    @param tokenBoostedAmount tokens amount after boosts.
    @param pointBoostedAmount points amount after boosts.
    @param tokenPaid value of user's total token earnings paid out. 
    pending reward = (user.amount * pool.tokensPerShare) - user.rewardDebt.
    @param pointPaid value of user's total point earnings paid out.
  */
  struct UserInfo {
    uint256 amount;
    uint256 tokenBoostedAmount;
    uint256 pointBoostedAmount;
    uint256 tokenPaid;
    uint256 pointPaid;
  }

  // Stored information for each user staking in each pool.
  mapping (IERC20 => mapping (address => UserInfo)) public userInfo;

  // The total sum of the strength of all pools.
  uint256 public totalTokenStrength;
  uint256 public totalPointStrength;

  // The total amount of the disbursed token ever emitted by this Staker.
  uint256 public totalTokenDisbursed;

  // Users additionally accrue non-token points for participating via staking.
  mapping (address => uint256) public userPoints;
  mapping (address => uint256) public userSpentPoints;

  // A map of all external addresses that are permitted to spend user points.
  mapping (address => bool) public approvedPointSpenders;

  /**
    The type of asset on which the boost is applied.
    @param Tokens boost is applied on the disburse token.
    @param Points boost is applied on the points.
    @param Both boost is applied on both.
  */
  enum AssetType {
    Tokens,
    Points,
    Both
  }

  /** 
    A booster struct, which stores information on the boost requirements.
    @param set if set, then the booster is active.
    @param multiplier the rate which will act as a boost on basis points.
    A multiplier of Zero means, the booster is not set.
    @param amountRequired number of NFTs required from the contract.
    @param groupRequired (optional) specifies a group from NFT contract 
      as requirement for the boost. If 0, then any group or item.
    @param contractRequired contract that the required assets belong to.
    @param assetType enum that specifies Tokens/Points to boost or both.
  */
  struct BoostInfo {
    uint256 multiplier;
    uint256 amountRequired;
    uint256 groupRequired;
    address contractRequired;
    AssetType assetType;
  }

  // Mapping of Booster ID to its 'BoostInfo'.
  mapping (uint256 => BoostInfo) public boostInfo;

  // Number of boosters that are active.
  uint256 public activeBoosters;

  /**
    A struct containing the NFT staker information.
    @param boosterIds enumerable booster Ids the user has staked NFTs in.
    @param tokenIds actual ids of tokens mapped to booster Id.
    @param totalNfts total NFTs staked in this contract by NFT staker.
    @notice contract information at the time of unstaking is retreived
    from the boostInfo.
   */
  struct NftUserInfo {
    EnumerableSet.UintSet boosterIds;
    mapping(uint256 => EnumerableSet.UintSet) tokenIds;
    uint256 totalNfts;
  }

  /**
    A struct as return parameter to get token Ids against a booster Id of
    a staker.
    @param boostersIds the booster Id to check the NFTs for.
    @param tokenIds the token Ids that are staked in that booster.
    @param totalNfts total NFTs staked in this contract by NFT staker.
   */
  struct GetNftUserInfo {
    uint256 boosterId;
    uint256[] tokenIds;
    uint256 totalNfts;
  }

  // Collection of NFT stakers
  mapping(address => NftUserInfo) private nftUserInfo;

  // NFTs staked in this contract.
  uint256 public totalNftStakes;

  // Events for depositing Fungible assets and later withdrawing them.
  event Deposit(address indexed user, IERC20 indexed token, uint256 amount);
  event Withdraw(address indexed user, IERC20 indexed token, uint256 amount);

  // Events for staking and unstaking non fungible items for boosters.
  event StakeNftBatch(address indexed user, IERC20 indexed token, uint256 boosterId);
  event UnstakeNftBatch(address indexed user, IERC20 indexed token, uint256 boosterId);

  // An event for tracking when a user has spent points.
  event SpentPoints(address indexed source, address indexed user, uint256 amount);

  /**
    Deploy a new SuperStaking contract with a name and the token to disburse.
    @param _name the name of the Staker contract.
    @param _token the token to reward stakers in this contract with.
  */
  constructor(string memory _name, IERC20 _token) {

    name = _name;
    token = _token;
    canAlterDevelopers = true;
    canAlterTokenEmissionSchedule = true;
    earliestTokenEmissionEvent = MAX_INT;
    canAlterPointEmissionSchedule = true;
    earliestPointEmissionEvent = MAX_INT;
  }

  /**
    Add a new developer to the Staker or overwrite an existing one.
    This operation requires that developer address addition is not locked.
    @param _developerAddress the additional developer's address.
    @param _share the share in 1/1000th of a percent of each token emission sent
    to this new developer.
  */
  function addDeveloper(address _developerAddress, uint256 _share) external onlyOwner {

    require(canAlterDevelopers,
      "Devs locked.");
    developerAddresses.push(_developerAddress);
    developerShares[_developerAddress] = _share;
  }

  /**
    Permanently forfeits owner ability to alter the state of Staker developers.
    Once called, this function is intended to give peace of mind to the Staker's
    developers and community that the fee structure is now immutable.
  */
  function lockDevelopers() external onlyOwner {

    canAlterDevelopers = false;
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

    uint256 developerShare = developerShares[msg.sender];
    require(developerShare > 0,
      "0 shares.");
    require(_newShare <= developerShare,
      "Increase unsupported.");
    developerShares[msg.sender] = 0;
    developerAddresses.push(_newDeveloperAddress);
    developerShares[_newDeveloperAddress] = _newShare;
  }

  /**
    Set new emission details to the Staker or overwrite existing ones.
    This operation requires that emission schedule alteration is not locked.
    @param _tokenSchedule an array of EmissionPoints defining the token schedule.
    @param _pointSchedule an array of EmissionPoints defining the point schedule.
  */
  function setEmissions(EmissionPoint[] memory _tokenSchedule, EmissionPoint[] memory _pointSchedule) external onlyOwner {

    if (_tokenSchedule.length > 0) {
      require(canAlterTokenEmissionSchedule,
        "Token emissions locked.");
      tokenEmissionEventsCount = _tokenSchedule.length;
      for (uint256 i = 0; i < tokenEmissionEventsCount; i++) {
        tokenEmissionEvents[i] = _tokenSchedule[i];
        if (earliestTokenEmissionEvent > _tokenSchedule[i].timeStamp) {
          earliestTokenEmissionEvent = _tokenSchedule[i].timeStamp;
        }
      }
    }
    require(tokenEmissionEventsCount > 0,
      "Set token emissions.");

    if (_pointSchedule.length > 0) {
      require(canAlterPointEmissionSchedule,
        "Point emissiosn locked.");
      pointEmissionEventsCount = _pointSchedule.length;
      for (uint256 i = 0; i < pointEmissionEventsCount; i++) {
        pointEmissionEvents[i] = _pointSchedule[i];
        if (earliestPointEmissionEvent > _pointSchedule[i].timeStamp) {
          earliestPointEmissionEvent = _pointSchedule[i].timeStamp;
        }
      }
    }
    require(pointEmissionEventsCount > 0,
      "Set point emissions.");
  }

  /**
    Permanently forfeits owner ability to alter the emission schedule.
    Once called, this function is intended to give peace of mind to the Staker's
    developers and community that the inflation rate is now immutable.
  */
  function lockTokenEmissions() external onlyOwner {

    canAlterTokenEmissionSchedule = false;
  }

  /**
    Permanently forfeits owner ability to alter the emission schedule.
    Once called, this function is intended to give peace of mind to the Staker's
    developers and community that the inflation rate is now immutable.
  */
  function lockPointEmissions() external onlyOwner {

    canAlterPointEmissionSchedule = false;
  }

  /**
    Returns the length of the developer address array.
    @return the length of the developer address array.
  */
  function getDeveloperCount() external view returns (uint256) {

    return developerAddresses.length;
  }

  /**
    Returns the length of the staking pool array.
    @return the length of the staking pool array.
  */
  function getPoolCount() external view returns (uint256) {

    return poolTokens.length;
  }

  /**
    Returns the amount of token that has not been disbursed by the Staker yet.
    @return the amount of token that has not been disbursed by the Staker yet.
  */
  function getRemainingToken() external view returns (uint256) {

    return token.balanceOf(address(this));
  }

   /** 
    Create or edit a booster with parameters
    @param _ids array of booster IDs.
    @param _boostInfo array of boostInfo.
    @notice should not be reconfigured if it was made public for staking NFTs.
  */
  function configureBoostersBatch(uint256[] memory _ids, BoostInfo[] memory _boostInfo) external onlyOwner {

    require(_boostInfo.length > 0, 
      "0 BoostInfo.");
    require(_ids.length == _boostInfo.length, 
      "Length mismatch.");

    for(uint256 i = 0; i < _boostInfo.length; i++){
      if(_boostInfo[i].multiplier == 0)
        revert("0 Multiplier.");
      else if(_boostInfo[i].amountRequired == 0)
        revert("0 Amount.");
      else if(_boostInfo[i].contractRequired == address(0))
        revert("0 address.");

      if(boostInfo[i].multiplier == 0 && _boostInfo[i].multiplier != 0)
        activeBoosters++;

      boostInfo[_ids[i]] = BoostInfo({ 
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
    @param _token the address of the asset to base this staking pool off of.
    @param _tokenStrength the relative strength of the new asset for earning token.
    @param _pointStrength the relative strength of the new asset for earning points.
    @param _boostInfo collection of boosters the pool supports.
  */
  function addPool(IERC20 _token, uint256 _tokenStrength, uint256 _pointStrength, uint256[] calldata _boostInfo) external onlyOwner {

    require(tokenEmissionEventsCount > 0 && pointEmissionEventsCount > 0,
      "Emissions required.");
    require(address(_token) != address(token), 
      "Disburse token.");
    require(_tokenStrength > 0 && _pointStrength > 0, 
      "Strength/s are Zero.");

    uint256 lastTokenRewardTime = block.timestamp > earliestTokenEmissionEvent ? block.timestamp : earliestTokenEmissionEvent;
    uint256 lastPointRewardTime = block.timestamp > earliestPointEmissionEvent ? block.timestamp : earliestPointEmissionEvent;
    uint256 lastRewardEvent = lastTokenRewardTime > lastPointRewardTime ? lastTokenRewardTime : lastPointRewardTime;
    if (address(poolInfo[_token].token) == address(0)) {
      poolTokens.push(_token);
      totalTokenStrength = totalTokenStrength + _tokenStrength;
      totalPointStrength = totalPointStrength + _pointStrength;
      poolInfo[_token] = PoolInfo({
        token: _token,
        tokenStrength: _tokenStrength,
        tokenBoostedDeposit: 0,
        tokensPerShare: 0,
        pointStrength: _pointStrength,
        pointBoostedDeposit: 0,
        pointsPerShare: 0,
        lastRewardEvent: lastRewardEvent,
        boostInfo: _boostInfo
      });
    } else {
      totalTokenStrength = (totalTokenStrength - poolInfo[_token].tokenStrength) + _tokenStrength;
      poolInfo[_token].tokenStrength = _tokenStrength;
      totalPointStrength = (totalPointStrength - poolInfo[_token].pointStrength) + _pointStrength;
      poolInfo[_token].pointStrength = _pointStrength;

      // Append boosters by avoid writing to storage directly in a loop to avoid costs
      uint256[] memory boosters = new uint256[](poolInfo[_token].boostInfo.length + _boostInfo.length);
      for(uint256 i = 0; i < poolInfo[_token].boostInfo.length; i++)
        boosters[i] = poolInfo[_token].boostInfo[i];
      for(uint256 i = 0; i < _boostInfo.length; i++)
        boosters[i + poolInfo[_token].boostInfo.length] = _boostInfo[i];
      PoolInfo storage pool = poolInfo[_token];
      pool.boostInfo = boosters; // Appended boosters
    }
  }

  /**
    Uses the emission schedule to calculate the total amount of staking reward
    token that was emitted between two specified timestamps.
    @param _fromTime the time to begin calculating emissions from.
    @param _toTime the time to calculate total emissions up to.
  */
  function getTotalEmittedTokens(uint256 _fromTime, uint256 _toTime) internal view returns (uint256) {

    require(_toTime > _fromTime,
      "Invalid order.");
    uint256 totalEmittedTokens = 0;
    uint256 workingRate = 0;
    uint256 workingTime = _fromTime;
    for (uint256 i = 0; i < tokenEmissionEventsCount; ++i) {
      uint256 emissionTime = tokenEmissionEvents[i].timeStamp;
      uint256 emissionRate = tokenEmissionEvents[i].rate;
      if (_toTime < emissionTime) {
        totalEmittedTokens = totalEmittedTokens + ((_toTime - workingTime) * workingRate);
        return totalEmittedTokens;
      } else if (workingTime < emissionTime) {
        totalEmittedTokens = totalEmittedTokens + ((emissionTime - workingTime) * workingRate);
        workingTime = emissionTime;
      }
      workingRate = emissionRate;
    }
    if (workingTime < _toTime) {
      totalEmittedTokens = totalEmittedTokens + ((_toTime - workingTime) * workingRate);
    }
    return totalEmittedTokens;
  }

  /**
    Uses the emission schedule to calculate the total amount of points
    emitted between two specified timestamps.
    @param _fromTime the time to begin calculating emissions from.
    @param _toTime the time to calculate total emissions up to.
  */
  function getTotalEmittedPoints(uint256 _fromTime, uint256 _toTime) public view returns (uint256) {

    require(_toTime > _fromTime,
      "Invalid order.");
    uint256 totalEmittedPoints = 0;
    uint256 workingRate = 0;
    uint256 workingTime = _fromTime;
    for (uint256 i = 0; i < pointEmissionEventsCount; ++i) {
      uint256 emissionTime = pointEmissionEvents[i].timeStamp;
      uint256 emissionRate = pointEmissionEvents[i].rate;
      if (_toTime < emissionTime) {
        totalEmittedPoints = totalEmittedPoints + ((_toTime - workingTime) * workingRate);
        return totalEmittedPoints;
      } else if (workingTime < emissionTime) {
        totalEmittedPoints = totalEmittedPoints + ((emissionTime - workingTime) * workingRate);
        workingTime = emissionTime;
      }
      workingRate = emissionRate;
    }
    if (workingTime < _toTime) {
      totalEmittedPoints = totalEmittedPoints + ((_toTime - workingTime) * workingRate);
    }
    return totalEmittedPoints;
  }

  /**
    A function to easily see the amount of token rewards pending for a user on a
    given pool. Returns the pending reward token amount.
    @param _token The address of a particular staking pool asset to check for a
    pending reward.
    @param _user the user address to check for a pending reward.
    @return the pending reward token amount.
  */
  function getPendingTokens(IERC20 _token, address _user) public view returns (uint256) {

    PoolInfo storage pool = poolInfo[_token];
    UserInfo storage user = userInfo[_token][_user];
    uint256 tokensPerShare = pool.tokensPerShare;
    uint256 tokenBoostedDeposit = pool.tokenBoostedDeposit;

    if (block.timestamp > pool.lastRewardEvent && tokenBoostedDeposit > 0) {
      uint256 totalEmittedTokens = getTotalEmittedTokens(pool.lastRewardEvent, block.timestamp);
      uint256 tokensReward = ((totalEmittedTokens * pool.tokenStrength) / totalTokenStrength) * 1e12;
      tokensPerShare = tokensPerShare + (tokensReward / tokenBoostedDeposit);
    }

    return ((user.amount * tokensPerShare) / 1e12) - user.tokenPaid;
  }

  /**
    A function to easily see the amount of point rewards pending for a user on a
    given pool. Returns the pending reward point amount.
    @param _token The address of a particular staking pool asset to check for a
    pending reward.
    @param _user The user address to check for a pending reward.
    @return the pending reward token amount.
  */
  function getPendingPoints(IERC20 _token, address _user) public view returns (uint256) {

    PoolInfo storage pool = poolInfo[_token];
    UserInfo storage user = userInfo[_token][_user];
    uint256 pointsPerShare = pool.pointsPerShare;
    uint256 pointBoostedDeposit = pool.pointBoostedDeposit;

    if (block.timestamp > pool.lastRewardEvent && pointBoostedDeposit > 0) {
      uint256 totalEmittedPoints = getTotalEmittedPoints(pool.lastRewardEvent, block.timestamp);
      uint256 pointsReward = ((totalEmittedPoints * pool.pointStrength) / totalPointStrength) * 1e30;
      pointsPerShare = pointsPerShare + (pointsReward / pointBoostedDeposit);
    }

    return ((user.amount * pointsPerShare) / 1e30) - user.pointPaid;
  }

  /**
    Return the number of points that the user has available to spend.
    @return the number of points that the user has available to spend.
  */
  function getAvailablePoints(address _user) public view returns (uint256) {

    uint256 concreteTotal = userPoints[_user];
    uint256 pendingTotal = 0;
    for (uint256 i = 0; i < poolTokens.length; ++i) {
      IERC20 poolToken = poolTokens[i];
      uint256 _pendingPoints = getPendingPoints(poolToken, _user);
      pendingTotal = pendingTotal + _pendingPoints;
    }
    uint256 spentTotal = userSpentPoints[_user];
    return (concreteTotal + pendingTotal) - spentTotal;
  }

  /**
    Return the total number of points that the user has ever accrued.
    @return the total number of points that the user has ever accrued.
  */
  function getTotalPoints(address _user) external view returns (uint256) {

    uint256 concreteTotal = userPoints[_user];
    uint256 pendingTotal = 0;
    for (uint256 i = 0; i < poolTokens.length; ++i) {
      IERC20 poolToken = poolTokens[i];
      uint256 _pendingPoints = getPendingPoints(poolToken, _user);
      pendingTotal = pendingTotal + _pendingPoints;
    }
    return concreteTotal + pendingTotal;
  }

  /**
    Return the total number of points that the user has ever spent.
    @return the total number of points that the user has ever spent.
  */
  function getSpentPoints(address _user) external view returns (uint256) {
    return userSpentPoints[_user];
  }

   /**
    Update the pool corresponding to the specified token address.
    @param _token the address of the asset to update the corresponding pool for.
  */
  function updatePool(IERC20 _token) internal {

    PoolInfo storage pool = poolInfo[_token];
    if (block.timestamp <= pool.lastRewardEvent) {
      return;
    }
    uint256 poolTokenSupply = pool.token.balanceOf(address(this));
    if (poolTokenSupply <= 0) {
      pool.lastRewardEvent = block.timestamp;
      return;
    }

    // Calculate token and point rewards for this pool.
    uint256 totalEmittedTokens = getTotalEmittedTokens(pool.lastRewardEvent, block.timestamp);
    uint256 tokensReward = ((totalEmittedTokens * pool.tokenStrength) / totalTokenStrength) * 1e12;
    uint256 totalEmittedPoints = getTotalEmittedPoints(pool.lastRewardEvent, block.timestamp);
    uint256 pointsReward = ((totalEmittedPoints * pool.pointStrength) / totalPointStrength) * 1e30;

    // Directly pay developers their corresponding share of tokens and points.
    for (uint256 i = 0; i < developerAddresses.length; ++i) {
      address developer = developerAddresses[i];
      uint256 share = developerShares[developer];
      uint256 devTokens = (tokensReward * share) / 100000;
      tokensReward = tokensReward - devTokens;
      uint256 devPoints = (pointsReward * share) / 100000;
      pointsReward = pointsReward - devPoints;
      token.safeTransfer(developer, devTokens / 1e12);
      userPoints[developer] = userPoints[developer] + (devPoints / 1e30);
    }

    // Update the pool rewards per share to pay users the amount remaining.
    pool.tokensPerShare = pool.tokensPerShare + (tokensReward / poolInfo[_token].tokenBoostedDeposit);
    pool.pointsPerShare = pool.pointsPerShare + (pointsReward / poolInfo[_token].pointBoostedDeposit);
    pool.lastRewardEvent = block.timestamp;
  }

  function updateDeposits(uint256 _amount, IERC20 _token, PoolInfo storage pool, UserInfo storage user, uint8 isDeposit) private {
    
    if (user.amount > 0){
      uint256 pendingTokens = ((user.tokenBoostedAmount * pool.tokensPerShare) / 1e12) - user.tokenPaid;
      token.safeTransfer(msg.sender, pendingTokens);
      totalTokenDisbursed = totalTokenDisbursed + pendingTokens;
      uint256 pendingPoints = ((user.pointBoostedAmount * pool.pointsPerShare) / 1e30) - user.pointPaid;
      userPoints[msg.sender] = userPoints[msg.sender] + pendingPoints;
      pool.tokenBoostedDeposit -= user.tokenBoostedAmount;
      pool.pointBoostedDeposit -= user.pointBoostedAmount;
    }

    if(isDeposit == 0) // Flag for Deposit
      user.amount += _amount;
    else if(isDeposit == 1) // Flag for Withdraw
      user.amount -= _amount;
    user.tokenBoostedAmount = applyBoosts(user.amount, _token, true);
    user.pointBoostedAmount = applyBoosts(user.amount, _token, false);
    pool.tokenBoostedDeposit += user.tokenBoostedAmount;
    pool.pointBoostedDeposit += user.pointBoostedAmount;

    user.tokenPaid = (user.tokenBoostedAmount * pool.tokensPerShare) / 1e12;
    user.pointPaid = (user.pointBoostedAmount * pool.pointsPerShare) / 1e30;
  }

  /**
    Private helper function that applies boosts on deposits for NFT staking.
    (amount * multiplier ) / 10000, where multiplier is in basis points.
    (20 * 20000) / 10000 = 40 => 2x boost
    @param _unboosted value that needs to have boosts applied to.
    @param _token the pool to which the booster is attached.
    @param _isToken is true if '_unboosted' argument is of token type.
    @return _boosted return value with applied boosts.
   */
  function applyBoosts(uint256 _unboosted, IERC20 _token, bool _isToken ) internal view returns(uint256 _boosted) {

    if(_unboosted <= 0)
        return 0;
    if(poolInfo[_token].boostInfo.length == 0)
        return _unboosted;
    if(nftUserInfo[_msgSender()].boosterIds.length() == 0)
        return _unboosted;

    _boosted = _unboosted;
    BoostInfo memory booster;
    PoolInfo memory pool = poolInfo[_token];
    NftUserInfo storage staker =  nftUserInfo[_msgSender()];

    // Iterate through all the boosters that the pool supports
    for(uint256 i = 0; i < pool.boostInfo.length; i++) {
      booster = boostInfo[pool.boostInfo[i]];
      if(staker.boosterIds.contains(pool.boostInfo[i])) 
        if(booster.assetType == AssetType.Tokens && _isToken)
          _boosted += (_unboosted * booster.multiplier)/10000;
        else if(booster.assetType == AssetType.Points && !_isToken)
          _boosted += (_unboosted * booster.multiplier)/10000;
        else if (booster.assetType == AssetType.Both)
           _boosted += (_unboosted * booster.multiplier)/10000;
    }
  }

  /**
    Deposit some particular assets to a particular pool on the Staker.
    @param _token the asset to stake into its corresponding pool.
    @param _amount the amount of the provided asset to stake.
  */
  function deposit(IERC20 _token, uint256 _amount) external nonReentrant {

    PoolInfo storage pool = poolInfo[_token];
    require(pool.tokenStrength > 0 || pool.pointStrength > 0,
      "Inactive pool.");
    UserInfo storage user = userInfo[_token][msg.sender];

    updatePool(_token);
    updateDeposits(_amount, _token, pool, user, 0);

    pool.token.safeTransferFrom(msg.sender, address(this), _amount);
    emit Deposit(msg.sender, _token, _amount);
  }

  /**
    Withdraw some particular assets from a particular pool on the Staker.
    @param _token the asset to withdraw from its corresponding staking pool.
    @param _amount the amount of the provided asset to withdraw.
  */
  function withdraw(IERC20 _token, uint256 _amount) external nonReentrant {

    PoolInfo storage pool = poolInfo[_token];
    UserInfo storage user = userInfo[_token][msg.sender];
    require(user.amount >= _amount,
      "Invalid amount.");

    updatePool(_token);
    updateDeposits(_amount, _token, pool, user, 1);

    pool.token.safeTransfer(msg.sender, _amount);
    emit Withdraw(msg.sender, _token, _amount);
  }

  /**
    Private helper function to check if NFT staker is eligible for a booster.
    @param _ids ids of NFTs required for a booster.
    @param _contract external contract from which NFTs are required.
    @param _boosterId the booster for which NFTs are being staked.
    @return return true if eligible.
   */
  function eligible(uint256[] memory _ids, address _contract, uint256 _boosterId) private view returns(bool) {

    BoostInfo memory booster = boostInfo[_boosterId];
    if(booster.multiplier == 0) // Inactive
      return false;
    else if(_contract != booster.contractRequired) // Different contract
      return false;
    else if(_ids.length < booster.amountRequired) // Insufficient amount
      return false;
    else if(booster.groupRequired != 0)
      for(uint256 i = 0; i < _ids.length; i++)
        if(_ids[i] >> 128 != booster.groupRequired) // Wrong group item
          return false;
    return true;
  }

  /**
    Stake a collection of NFTs from a Super721 or Super1155 contract.
    @param _ids the ids collection of NFTs from a contract.
    @param _contract the external contract of the NFTs.
    @param _token the pool that will be staked in.
    @param _boosterId the booster that accepts these NFTs.
  */
  function stakeNftBatch(uint256[] calldata _ids, address _contract, IERC20 _token, uint256 _boosterId) external nonReentrant {
    
    bool exists = false;
    for(uint256 i = 0; i < poolInfo[_token].boostInfo.length; i++)
        if(poolInfo[_token].boostInfo[i] == _boosterId){
            exists = true;
            break;
        }
    if(!exists)
        revert("Invalid pool/booster.");
    if(!eligible(_ids, _contract, _boosterId))
        revert("Ineligible.");
        
    PoolInfo storage pool = poolInfo[_token];
    UserInfo storage user = userInfo[_token][msg.sender];

    // Is Super721 with approval
    if(ISuperGeneric(_contract).supportsInterface(0x80ac58cd))
        ISuperGeneric(_contract).safeBatchTransferFrom(_msgSender(), address(this), _ids, "");
    // Is Super1155 with approval
    else if(ISuperGeneric(_contract).supportsInterface(0xd9b67a26)){
        uint256[] memory amounts = new uint256[](_ids.length);
        for(uint256 i = 0; i < _ids.length; i++)
            amounts[i] = 1;
        ISuperGeneric(_contract).safeBatchTransferFrom(_msgSender(), address(this), _ids, amounts, "");
    }
    else 
        revert("Unsupported Contract.");
    
    NftUserInfo storage staker = nftUserInfo[msg.sender];
    staker.totalNfts += _ids.length;
    for(uint256 i = 0; i < _ids.length; i++)
      staker.tokenIds[_boosterId].add(_ids[i]);
    staker.boosterIds.add(_boosterId);

    totalNftStakes += _ids.length;

    updatePool(_token);
    updateDeposits(0, _token, pool, user, 2); // 2 = PlaceHolder

    emit StakeNftBatch(msg.sender, _token, _boosterId);
  }

  /**
    Unstake collection of NFTs to ERC721 or ERC1155 contract.
    @param _token the pool that was previously staked in.
    @param _boosterId the booster that accepted these NFTs.
  */
  function unstakeNftBatch(IERC20 _token, uint256 _boosterId) external nonReentrant {
    
    require(address(_token) != address(0), 
        "0 address.");
    require(nftUserInfo[msg.sender].boosterIds.contains(_boosterId),
        "No stakes.");

    NftUserInfo storage staker = nftUserInfo[msg.sender];
    PoolInfo storage pool = poolInfo[_token];
    UserInfo storage user = userInfo[_token][msg.sender];
    address externalContract = boostInfo[_boosterId].contractRequired;

    uint256[] memory _ids = new uint256[](staker.tokenIds[_boosterId].length());
    for(uint256 i = 0; i < _ids.length; i++)
      _ids[i] = staker.tokenIds[_boosterId].at(i);

    // Is Super721 with approval
    if(ISuperGeneric(externalContract).supportsInterface(0x80ac58cd))
        ISuperGeneric(externalContract).safeBatchTransferFrom(address(this), _msgSender(), _ids, "");
    // Is Super1155 with approval
    else if(ISuperGeneric(externalContract).supportsInterface(0xd9b67a26)){
        uint256[] memory amounts = new uint256[](_ids.length);
        for(uint256 i = 0; i < _ids.length; i++)
            amounts[i] = 1;
        ISuperGeneric(externalContract).safeBatchTransferFrom(address(this), _msgSender(), _ids, amounts, "");
    }
    else 
        revert("Contract not supported.");

    staker.totalNfts -= _ids.length;
    for(uint256 i = 0; i <  _ids.length; i++)
        staker.tokenIds[_boosterId].remove(_ids[i]);
    staker.boosterIds.remove(_boosterId);

    totalNftStakes -= _ids.length;

    updatePool(_token);
    updateDeposits(0, _token, pool, user, 2); // 2 = PlaceHolder

    emit UnstakeNftBatch(msg.sender, _token, _boosterId);
  }

  /**
    Allows to get information about tokens staked in a booster for NFT staker address.
    @param _nftUserAddress the user address to check.
    @param _boosterId the booster Id to check the tokens staked for.
    @return a struct containing the information.
   */
  function getNftUserInfo(address _nftUserAddress, uint256 _boosterId) external view returns(GetNftUserInfo memory){
    uint256 length = nftUserInfo[_nftUserAddress].tokenIds[_boosterId].length();
    uint256[] memory _tokenIds = new uint256[](length);
    for(uint256 i = 0; i < length; i++)
      _tokenIds[i] = nftUserInfo[_nftUserAddress].tokenIds[_boosterId].at(i);

    GetNftUserInfo memory _userInfo = GetNftUserInfo({
      boosterId: _boosterId,
      tokenIds: _tokenIds,
      totalNfts: nftUserInfo[_nftUserAddress].totalNfts
    });
    return _userInfo;
  }

  /**
    Allows the owner of this Staker to grant or remove approval to an external
    spender of the points that users accrue from staking resources.
    @param _spender The external address allowed to spend user points.
    @param _approval The updated user approval status.
  */
  function approvePointSpender(address _spender, bool _approval) external onlyOwner {

    approvedPointSpenders[_spender] = _approval;
  }

  /**
    Allows an approved spender of points to spend points on behalf of a user.
    @param _user The user whose points are being spent.
    @param _amount The amount of the user's points being spent.
  */
  function spendPoints(address _user, uint256 _amount) external {

    require(approvedPointSpenders[msg.sender],
      "Not allowed.");
    uint256 _userPoints = getAvailablePoints(_user);
    require(_userPoints >= _amount,
      "Invalid amount.");
    userSpentPoints[_user] = userSpentPoints[_user] + _amount;
    emit SpentPoints(msg.sender, _user, _amount);
  }

  /**
    Sweep all of a particular ERC-20 token from the contract.
    @param _token The token to sweep the balance from.
  */
  function sweep(IERC20 _token) external onlyOwner {

    uint256 balance = _token.balanceOf(address(this));
    _token.safeTransfer(msg.sender, balance);
  }

  function onERC721Received(
      address operator,
      address from,
      uint256 tokenId,
      bytes calldata data
  ) external override returns (bytes4){
    return this.onERC721Received.selector;
  }

  function onERC1155Received(
      address operator,
      address from,
      uint256 id,
      uint256 value,
      bytes calldata data
  ) external override returns (bytes4){
      return this.onERC1155Received.selector;

  }

  function onERC1155BatchReceived(
      address operator,
      address from,
      uint256[] calldata ids,
      uint256[] calldata values,
      bytes calldata data
  ) external override returns (bytes4){
      return this.onERC1155BatchReceived.selector;
  }

  function supportsInterface(bytes4 interfaceId) external view override returns (bool){}
}