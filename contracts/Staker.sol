// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
  @title An asset staking contract.
  @author Tim Clancy
  @author Qazawat Zirak

  This staking contract disburses tokens from its internal reservoir according
  to a fixed emission schedule. Assets can be assigned varied staking weights.
  This code is inspired by and modified from Sushi's Master Chef contract.
  https://github.com/sushiswap/sushiswap/blob/master/contracts/MasterChef.sol
*/
contract Staker is Ownable, ReentrancyGuard {
  using SafeERC20 for IERC20;

  /// A user-specified, descriptive name for this Staker.
  string public name;

  /// The token to disburse.
  IERC20 public token;

  /// A flag signalling whether the contract owner can add or set developers.
  bool public canAlterDevelopers;

  /// An array of developer addresses for finding shares in the share mapping.
  address[] public developerAddresses;

  /**  
    @dev A mapping of developer addresses to their percent share of emissions.
    Share percentages are represented as 1/1000th of a percent. That is, a 1%
    share of emissions should map an address to 1000.
  */
  mapping (address => uint256) public developerShares;

  /// A flag signalling whether or not the contract owner can alter emissions.
  bool public canAlterTokenEmissionSchedule;
  bool public canAlterPointEmissionSchedule;

  /**  
    This emission schedule maps a timestamp to the amount of tokens or points 
    that should be disbursed starting at that timestamp.

    @param timeStamp If current time reaches timestamp, the rate is applied.
    @param rate Measure of points/tokens emitted.
  */
  struct EmissionPoint {
    uint256 timeStamp;
    uint256 rate;
  }

  /// Array of emission schedule timestamps for finding emission rate changes.
  uint256 public tokenEmissionEventsCount;
  mapping (uint256 => EmissionPoint) public tokenEmissionEvents;
  uint256 public pointEmissionEventsCount;
  mapping (uint256 => EmissionPoint) public pointEmissionEvents;

  /// Store the very earliest possible timestamp for quick reference.
  uint256 MAX_INT = 2**256 - 1;
  uint256 internal earliestTokenEmissionTime;
  uint256 internal earliestPointEmissionTime;

/**  
    A struct containing the pool info tracked in storage.

    @param token address of the ERC20 asset that is being staked in the pool.
    @param tokenStrength the relative token emission strength of this pool.
    @param tokensPerShare accumulated tokens per share times 1e12.
    @param pointStrength the relative point emission strength of this pool.
    @param pointsPerShare accumulated points per share times 1e12.
    @param lastRewardTime record of the time of the last disbursement.
  */
  struct PoolInfo {
    IERC20 token;
    uint256 tokenStrength;
    uint256 tokensPerShare;
    uint256 pointStrength;
    uint256 pointsPerShare;
    uint256 lastRewardTime;
  }

  IERC20[] public poolTokens;

  /// Stored information for each available pool per its token address.
  mapping (IERC20 => PoolInfo) public poolInfo;

  /**  
    A struct containing the user info tracked in storage.

    @param amount amount of the pool asset being provided by the user.
    @param tokenPaid value of user's total token earnings paid out. 
    pending reward = (user.amount * pool.tokensPerShare) - user.rewardDebt.
    @param tokenRewards amount of token rewards accumulated to be claimed.
    @param pointPaid value of user's total point earnings paid out.
    @param pointRewards amount of point rewards accumulated to be claimed.
  */
  struct UserInfo {
    uint256 amount;
    uint256 tokenPaid;
    uint256 tokenRewards;
    uint256 pointPaid;
    uint256 pointRewards;
  }

  /// Stored information for each user staking in each pool.
  mapping (IERC20 => mapping (address => UserInfo)) public userInfo;

  /// The total sum of the strength of all pools.
  uint256 public totalTokenStrength;
  uint256 public totalPointStrength;

  /// The total amount of the disbursed token ever emitted by this Staker.
  uint256 public totalTokenDisbursed;

  /// Users additionally accrue non-token points for participating via staking.
  mapping (address => uint256) public userPoints;
  mapping (address => uint256) public userSpentPoints;

  /// A map of all external addresses that are permitted to spend user points.
  mapping (address => bool) public approvedPointSpenders;

  /// Events for depositing assets into the Staker and later withdrawing them.
  event Deposit(address indexed user, IERC20 indexed token, uint256 amount);
  event Withdraw(address indexed user, IERC20 indexed token, uint256 amount);
  event Claim(address indexed user, IERC20 indexed token, uint256 tokensAmount, uint256 pointsAmount);

  /// An event for tracking when a user has spent points.
  event SpentPoints(address indexed source, address indexed user, uint256 amount);

  /**
    Construct a new Staker by providing it a name and the token to disburse.
    @param _name The name of the Staker contract.
    @param _token The token to reward stakers in this contract with.
  */
  constructor(string memory _name, IERC20 _token) {
    name = _name;
    token = _token;
    token.approve(address(this), MAX_INT);
    canAlterDevelopers = true;
    canAlterTokenEmissionSchedule = true;
    earliestTokenEmissionTime = MAX_INT;
    canAlterPointEmissionSchedule = true;
    earliestPointEmissionTime = MAX_INT;
  }

  /**
    Add a new developer to the Staker or overwrite an existing one.
    This operation requires that developer address addition is not locked.
    @param _developerAddress The additional developer's address.
    @param _share The share in 1/1000th of a percent of each token emission sent
    to this new developer.
  */
  function addDeveloper(address _developerAddress, uint256 _share) external onlyOwner {
    require(canAlterDevelopers,
      "This Staker has locked the addition of developers; no more may be added.");
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
    @param _newDeveloperAddress An address to update this developer's address.
    @param _newShare The new share in 1/1000th of a percent of each token
    emission sent to this developer.
  */
  function updateDeveloper(address _newDeveloperAddress, uint256 _newShare) external {
    uint256 developerShare = developerShares[msg.sender];
    require(developerShare > 0,
      "You are not a developer of this Staker.");
    require(_newShare <= developerShare,
      "You cannot increase your developer share.");
    developerShares[msg.sender] = 0;
    developerAddresses.push(_newDeveloperAddress);
    developerShares[_newDeveloperAddress] = _newShare;
  }

  /**
    Set new emission details to the Staker or overwrite existing ones.
    This operation requires that emission schedule alteration is not locked.

    @param _tokenSchedule An array of EmissionPoints defining the token schedule.
    @param _pointSchedule An array of EmissionPoints defining the point schedule.
  */
  function setEmissions(EmissionPoint[] memory _tokenSchedule, EmissionPoint[] memory _pointSchedule) external onlyOwner {
    if (_tokenSchedule.length > 0) {
      require(canAlterTokenEmissionSchedule,
        "This Staker has locked the alteration of token emissions.");
      tokenEmissionEventsCount = _tokenSchedule.length;
      for (uint256 i = 0; i < tokenEmissionEventsCount; i++) {
        tokenEmissionEvents[i] = _tokenSchedule[i];
        if (earliestTokenEmissionTime > _tokenSchedule[i].timeStamp) {
          earliestTokenEmissionTime = _tokenSchedule[i].timeStamp;
        }
      }
    }
    require(tokenEmissionEventsCount > 0,
      "You must set the token emission schedule.");

    if (_pointSchedule.length > 0) {
      require(canAlterPointEmissionSchedule,
        "This Staker has locked the alteration of point emissions.");
      pointEmissionEventsCount = _pointSchedule.length;
      for (uint256 i = 0; i < pointEmissionEventsCount; i++) {
        pointEmissionEvents[i] = _pointSchedule[i];
        if (earliestPointEmissionTime > _pointSchedule[i].timeStamp) {
          earliestPointEmissionTime = _pointSchedule[i].timeStamp;
        }
      }
    }
    require(pointEmissionEventsCount > 0,
      "You must set the point emission schedule.");
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
    Allows the contract owner to add a new asset pool to the Staker or overwrite
    an existing one.
    @param _token The address of the asset to base this staking pool off of.
    @param _tokenStrength The relative strength of the new asset for earning token.
    @param _pointStrength The relative strength of the new asset for earning points.
  */
  function addPool(IERC20 _token, uint256 _tokenStrength, uint256 _pointStrength) external onlyOwner {
    require(tokenEmissionEventsCount > 0 && pointEmissionEventsCount > 0,
      "Staking pools cannot be addded until an emission schedule has been defined.");
    require(address(_token) != address(token), 
      "Staking pool token can not be the same as reward token.");
    require(_tokenStrength > 0 && _pointStrength > 0, 
      "Staking pool token/point strength must be greater than 0.");

    uint256 lastTokenRewardTime = block.timestamp > earliestTokenEmissionTime ? block.timestamp : earliestTokenEmissionTime;
    uint256 lastPointRewardTime = block.timestamp > earliestPointEmissionTime ? block.timestamp : earliestPointEmissionTime;
    uint256 lastRewardTime = lastTokenRewardTime > lastPointRewardTime ? lastTokenRewardTime : lastPointRewardTime;
    if (address(poolInfo[_token].token) == address(0)) {
      poolTokens.push(_token);
      totalTokenStrength = totalTokenStrength + _tokenStrength;
      totalPointStrength = totalPointStrength + _pointStrength;
      poolInfo[_token] = PoolInfo({
        token: _token,
        tokenStrength: _tokenStrength,
        tokensPerShare: 0,
        pointStrength: _pointStrength,
        pointsPerShare: 0,
        lastRewardTime: lastRewardTime
      });
    } else {
      totalTokenStrength = (totalTokenStrength - poolInfo[_token].tokenStrength) + _tokenStrength;
      poolInfo[_token].tokenStrength = _tokenStrength;
      totalPointStrength = (totalPointStrength - poolInfo[_token].pointStrength) + _pointStrength;
      poolInfo[_token].pointStrength = _pointStrength;
    }
  }

  /**
    Uses the emission schedule to calculate the total amount of staking reward
    token that was emitted between two specified timestamps.

    @param _fromTime The time to begin calculating emissions from.
    @param _toTime The time to calculate total emissions up to.
  */
  function getTotalEmittedTokens(uint256 _fromTime, uint256 _toTime) public view returns (uint256) {
    require(_toTime >= _fromTime,
      "Tokens cannot be emitted from a higher timestsamp to a lower timestamp.");
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

    @param _fromTime The time to begin calculating emissions from.
    @param _toTime The time to calculate total emissions up to.
  */
  function getTotalEmittedPoints(uint256 _fromTime, uint256 _toTime) public view returns (uint256) {
    require(_toTime >= _fromTime,
      "Points cannot be emitted from a higher timestsamp to a lower timestamp.");
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
    Update the pool corresponding to the specified token address.
    @param _token The address of the asset to update the corresponding pool for.
  */
  function updatePool(IERC20 _token) internal {
    PoolInfo storage pool = poolInfo[_token];
    if (block.timestamp <= pool.lastRewardTime) {
      return;
    }
    uint256 poolTokenSupply = pool.token.balanceOf(address(this));
    if (poolTokenSupply <= 0) {
      pool.lastRewardTime = block.timestamp;
      return;
    }

    // Calculate token and point rewards for this pool.
    uint256 totalEmittedTokens = getTotalEmittedTokens(pool.lastRewardTime, block.timestamp);
    uint256 tokensReward = ((totalEmittedTokens * pool.tokenStrength) / totalTokenStrength) * 1e12;
    uint256 totalEmittedPoints = getTotalEmittedPoints(pool.lastRewardTime, block.timestamp);
    uint256 pointsReward = ((totalEmittedPoints * pool.pointStrength) / totalPointStrength) * 1e30;

    // Directly pay developers their corresponding share of tokens and points.
    for (uint256 i = 0; i < developerAddresses.length; ++i) {
      address developer = developerAddresses[i];
      uint256 share = developerShares[developer];
      uint256 devTokens = (tokensReward * share) / 100000;
      tokensReward = tokensReward - devTokens;
      uint256 devPoints = (pointsReward * share) / 100000;
      pointsReward = pointsReward - devPoints;
      token.safeTransferFrom(address(this), developer, devTokens / 1e12);
      userPoints[developer] = userPoints[developer] + (devPoints / 1e30);
    }

    // Update the pool rewards per share to pay users the amount remaining.
    pool.tokensPerShare = pool.tokensPerShare + (tokensReward / poolTokenSupply);
    pool.pointsPerShare = pool.pointsPerShare + (pointsReward / poolTokenSupply);
    pool.lastRewardTime = block.timestamp;
  }

  /**
    A function to easily see the amount of token rewards pending for a user on a
    given pool. Returns the pending reward token amount.
    @param _token The address of a particular staking pool asset to check for a
    pending reward.
    @param _user The user address to check for a pending reward.
    @return the pending reward token amount.
  */
  function getPendingTokens(IERC20 _token, address _user) public view returns (uint256) {
    PoolInfo storage pool = poolInfo[_token];
    UserInfo storage user = userInfo[_token][_user];
    uint256 tokensPerShare = pool.tokensPerShare;
    uint256 poolTokenSupply = pool.token.balanceOf(address(this));

    if (block.timestamp > pool.lastRewardTime && poolTokenSupply > 0) {
      uint256 totalEmittedTokens = getTotalEmittedTokens(pool.lastRewardTime, block.timestamp);
      uint256 tokensReward = ((totalEmittedTokens * pool.tokenStrength) / totalTokenStrength) * 1e12;
      tokensPerShare = tokensPerShare + (tokensReward / poolTokenSupply);
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
    uint256 poolTokenSupply = pool.token.balanceOf(address(this));

    if (block.timestamp > pool.lastRewardTime && poolTokenSupply > 0) {
      uint256 totalEmittedPoints = getTotalEmittedPoints(pool.lastRewardTime, block.timestamp);
      uint256 pointsReward = ((totalEmittedPoints * pool.pointStrength) / totalPointStrength) * 1e30;
      pointsPerShare = pointsPerShare + (pointsReward / poolTokenSupply);
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
    Deposit some particular assets to a particular pool on the Staker.
    @param _token The asset to stake into its corresponding pool.
    @param _amount The amount of the provided asset to stake.
  */
  function deposit(IERC20 _token, uint256 _amount) external nonReentrant {
    PoolInfo storage pool = poolInfo[_token];
    require(pool.tokenStrength > 0 || pool.pointStrength > 0,
      "You cannot deposit assets into an inactive pool.");
    UserInfo storage user = userInfo[_token][msg.sender];
    updatePool(_token);
    if (user.amount > 0) {
      uint256 pendingTokens = ((user.amount * pool.tokensPerShare) / 1e12) - user.tokenPaid;
      user.tokenRewards += pendingTokens;
      totalTokenDisbursed = totalTokenDisbursed + pendingTokens;
      uint256 pendingPoints = ((user.amount * pool.pointsPerShare) / 1e30) - user.pointPaid;
      user.pointRewards += pendingPoints;
    }
    pool.token.safeTransferFrom(address(msg.sender), address(this), _amount);
    user.amount = user.amount +_amount;
    user.tokenPaid = (user.amount * pool.tokensPerShare) / 1e12;
    user.pointPaid = (user.amount * pool.pointsPerShare) / 1e30;
    emit Deposit(msg.sender, _token, _amount);
  }

  /**
    Withdraw some particular assets from a particular pool on the Staker.
    @param _token The asset to withdraw from its corresponding staking pool.
    @param _amount The amount of the provided asset to withdraw.
  */
  function withdraw(IERC20 _token, uint256 _amount) external nonReentrant {
    PoolInfo storage pool = poolInfo[_token];
    UserInfo storage user = userInfo[_token][msg.sender];
    require(user.amount >= _amount,
      "You cannot withdraw that much of the specified token; you are not owed it.");
    updatePool(_token);
    uint256 pendingTokens = ((user.amount * pool.tokensPerShare) / 1e12) - user.tokenPaid;
    user.tokenRewards += pendingTokens;
    totalTokenDisbursed = totalTokenDisbursed + pendingTokens;
    uint256 pendingPoints = ((user.amount * pool.pointsPerShare) / 1e30) - user.pointPaid;
    user.pointRewards += pendingPoints;
    user.amount = user.amount - _amount;
    user.tokenPaid = (user.amount * pool.tokensPerShare) / 1e12;
    user.pointPaid = (user.amount * pool.pointsPerShare) / 1e30;
    pool.token.safeTransfer(address(msg.sender), _amount);
    emit Withdraw(msg.sender, _token, _amount);
  }

  /**
    Claim accumulated token and point rewards from the Staker.
    @param _token The asset to claim rewards from.
   */
  function claim(IERC20 _token) external nonReentrant {
    UserInfo storage user = userInfo[_token][msg.sender];
    PoolInfo storage pool = poolInfo[_token];
    uint256 pendingTokens;
    uint256 pendingPoints;

    updatePool(_token);
    if (user.amount > 0) {
      pendingTokens = ((user.amount * pool.tokensPerShare) / 1e12) - user.tokenPaid;
      pendingPoints = ((user.amount * pool.pointsPerShare) / 1e30) - user.pointPaid;
      totalTokenDisbursed = totalTokenDisbursed + pendingTokens;
    }
    uint256 _tokenRewards = user.tokenRewards + pendingTokens;
    uint256 _pointRewards = user.pointRewards + pendingPoints;
    token.safeTransferFrom(address(this), msg.sender, _tokenRewards);
    userPoints[msg.sender] = userPoints[msg.sender] + _pointRewards;
    user.tokenRewards = 0;
    user.pointRewards = 0;

    user.tokenPaid = (user.amount * pool.tokensPerShare) / 1e12;
    user.pointPaid = (user.amount * pool.pointsPerShare) / 1e30;
    emit Claim(msg.sender, token, _tokenRewards, _pointRewards);
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
      "You are not permitted to spend user points.");
    uint256 _userPoints = getAvailablePoints(_user);
    require(_userPoints >= _amount,
      "The user does not have enough points to spend the requested amount.");
    userSpentPoints[_user] = userSpentPoints[_user] + _amount;
    emit SpentPoints(msg.sender, _user, _amount);
  }

  /**
    Sweep all of a particular ERC-20 token from the contract.

    @param _token The token to sweep the balance from.
  */
  function sweep(IERC20 _token) external onlyOwner {
    uint256 balance = _token.balanceOf(address(this));
    _token.safeTransferFrom(address(this), msg.sender, balance);
  }
}
