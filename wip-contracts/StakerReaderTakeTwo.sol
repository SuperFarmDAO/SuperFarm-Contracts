// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./token/erc20/IERC20Detailed.sol";

/**
  @title An asset staking contract.
  @author Tim Clancy

  This staking contract disburses tokens from its internal reservoir according
  to a fixed emission schedule. Assets can be assigned varied staking weights.
  This code is inspired by and modified from Sushi's Master Chef contract.
  https://github.com/sushiswap/sushiswap/blob/master/contracts/MasterChef.sol
*/
contract StakerReaderTakeTwo is Ownable, ReentrancyGuard {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  // A user-specified, descriptive name for this Staker.
  string public name;

  // The token to disburse.
  IERC20 public token;

  // The amount of the disbursed token deposited by users. This is used for the
  // special case where a staking pool has been created for the disbursed token.
  // This is required to prevent the Staker itself from reducing emissions.
  uint256 public totalTokenDeposited;

  // A flag signalling whether the contract owner can add or set developers.
  bool public canAlterDevelopers;

  // An array of developer addresses for finding shares in the share mapping.
  address[] public developerAddresses;

  // A mapping of developer addresses to their percent share of emissions.
  // Share percentages are represented as 1/1000th of a percent. That is, a 1%
  // share of emissions should map an address to 1000.
  mapping (address => uint256) public developerShares;

  // A flag signalling whether or not the contract owner can alter emissions.
  bool public canAlterTokenEmissionSchedule;
  bool public canAlterPointEmissionSchedule;

  // The token emission schedule of the Staker. This emission schedule maps a
  // block number to the amount of tokens or points that should be disbursed with every
  // block beginning at said block number.
  struct EmissionPoint {
    uint256 blockNumber;
    uint256 rate;
  }

  // An array of emission schedule key blocks for finding emission rate changes.
  uint256 public tokenEmissionBlockCount;
  mapping (uint256 => EmissionPoint) public tokenEmissionBlocks;
  uint256 public pointEmissionBlockCount;
  mapping (uint256 => EmissionPoint) public pointEmissionBlocks;

  // Store the very earliest possible emission block for quick reference.
  uint256 MAX_INT = 2**256 - 1;
  uint256 internal earliestTokenEmissionBlock;
  uint256 internal earliestPointEmissionBlock;

  // Information for each pool that can be staked in.
  // - token: the address of the ERC20 asset that is being staked in the pool.
  // - strength: the relative token emission strength of this pool.
  // - lastRewardBlock: the last block number where token distribution occurred.
  // - tokensPerShare: accumulated tokens per share times 1e12.
  // - pointsPerShare: accumulated points per share times 1e12.
  struct PoolInfo {
    IERC20 token;
    uint256 tokenStrength;
    uint256 tokensPerShare;
    uint256 pointStrength;
    uint256 pointsPerShare;
    uint256 lastRewardBlock;
  }

  IERC20[] public poolTokens;

  // Stored information for each available pool per its token address.
  mapping (IERC20 => PoolInfo) public poolInfo;

  // Information for each user per staking pool:
  // - amount: the amount of the pool asset being provided by the user.
  // - tokenPaid: the value of the user's total earning that has been paid out.
  // -- pending reward = (user.amount * pool.tokensPerShare) - user.rewardDebt.
  // - pointPaid: the value of the user's total point earnings that has been paid out.
  struct UserInfo {
    uint256 amount;
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

  struct RewardToken {
    string name;
    string symbol;
    address token;
  }

  function _buildRewardToken() internal view returns (RewardToken memory) {
    IERC20Detailed _ft = IERC20Detailed(address(token));

    return RewardToken({
      name: _ft.name(),
      token: address(_ft),
      symbol: _ft.symbol()
    });
  }

  struct PoolTokenOutput {
    IERC20 poolToken;
    uint256 valueWeth;
    string poolTokenName;
    string poolTokenSymbol;
    uint256 tokenStrength;
    uint256 tokensPerShare;
    uint256 pointStrength;
    uint256 pointsPerShare;
    uint256 lastRewardBlock;
    uint256 poolTotalSupply;
  }

  struct UserInfoOutput {
    uint256 amount;
    uint256 userWalletBalance;
    uint256 tokenPaid;
    uint256 pointPaid;
    uint256 pendingRewards;
    uint256 pendingPoints;
    uint256 userAllowance;
  }

  function _calcWethValue(IERC20 _weth, IERC20 _pt, IERC20 _ft) internal view returns (uint256) {
    uint256 wethBalance = _weth.balanceOf(address(_ft));
    uint256 lpSupply = _pt.totalSupply();
    return wethBalance.mul(2).mul(1000000).div(lpSupply);
  }

  function _buildPoolData(IERC20Detailed _pt, address rewardToken, IERC20 _weth) internal view returns (PoolTokenOutput memory) {
    PoolInfo memory _poolInfo = poolInfo[IERC20(address(_pt))];
    return PoolTokenOutput({
      poolToken: IERC20(address(_pt)),
      valueWeth: _calcWethValue(_weth, IERC20(address(_pt)), IERC20(rewardToken)),
      poolTokenName: _pt.name(),
      poolTokenSymbol: _pt.symbol(),
      tokenStrength: _poolInfo.tokenStrength,
      tokensPerShare: _poolInfo.tokensPerShare,
      pointStrength: _poolInfo.pointStrength,
      pointsPerShare: _poolInfo.pointsPerShare,
      lastRewardBlock: _poolInfo.lastRewardBlock,
      poolTotalSupply: (address(_poolInfo.token) == rewardToken) ? totalTokenDeposited : _pt.balanceOf(rewardToken)
    });
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
    if (address(_token) == address(token)) {
      poolTokenSupply = totalTokenDeposited;
    }

    if (block.number > pool.lastRewardBlock && poolTokenSupply > 0) {
      uint256 totalEmittedTokens = getTotalEmittedTokens(pool.lastRewardBlock, block.number);
      uint256 tokensReward = totalEmittedTokens.mul(pool.tokenStrength).div(totalTokenStrength).mul(1e12);
      tokensPerShare = tokensPerShare.add(tokensReward.div(poolTokenSupply));
    }

    return user.amount.mul(tokensPerShare).div(1e12).sub(user.tokenPaid);
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
    if (address(_token) == address(token)) {
      poolTokenSupply = totalTokenDeposited;
    }

    if (block.number > pool.lastRewardBlock && poolTokenSupply > 0) {
      uint256 totalEmittedPoints = getTotalEmittedPoints(pool.lastRewardBlock, block.number);
      uint256 pointsReward = totalEmittedPoints.mul(pool.pointStrength).div(totalPointStrength).mul(1e30);
      pointsPerShare = pointsPerShare.add(pointsReward.div(poolTokenSupply));
    }

    return user.amount.mul(pointsPerShare).div(1e30).sub(user.pointPaid);
  }

  function _buildUserInfo(IERC20 _pt, address _user) internal view returns (UserInfoOutput memory) {
    UserInfo memory _userInfo = userInfo[_pt][_user];
    return UserInfoOutput({
      amount: _userInfo.amount,
      userWalletBalance: _pt.balanceOf(_user),
      tokenPaid: _userInfo.tokenPaid,
      pointPaid: _userInfo.pointPaid,
      pendingRewards: getPendingTokens(IERC20(address(_pt)), _user),
      pendingPoints: getPendingPoints(IERC20(address(_pt)), _user),
      userAllowance: _pt.allowance(_user, address(this))
    });
  }

  /**
    Uses the emission schedule to calculate the total amount of staking reward
    token that was emitted between two specified block numbers.

    @param _fromBlock The block to begin calculating emissions from.
    @param _toBlock The block to calculate total emissions up to.
  */
  function getTotalEmittedTokens(uint256 _fromBlock, uint256 _toBlock) public view returns (uint256) {
    require(_toBlock >= _fromBlock,
      "Tokens cannot be emitted from a higher block to a lower block.");
    uint256 totalEmittedTokens = 0;
    uint256 workingRate = 0;
    uint256 workingBlock = _fromBlock;
    for (uint256 i = 0; i < tokenEmissionBlockCount; ++i) {
      uint256 emissionBlock = tokenEmissionBlocks[i].blockNumber;
      uint256 emissionRate = tokenEmissionBlocks[i].rate;
      if (_toBlock < emissionBlock) {
        totalEmittedTokens = totalEmittedTokens.add(_toBlock.sub(workingBlock).mul(workingRate));
        return totalEmittedTokens;
      } else if (workingBlock < emissionBlock) {
        totalEmittedTokens = totalEmittedTokens.add(emissionBlock.sub(workingBlock).mul(workingRate));
        workingBlock = emissionBlock;
      }
      workingRate = emissionRate;
    }
    if (workingBlock < _toBlock) {
      totalEmittedTokens = totalEmittedTokens.add(_toBlock.sub(workingBlock).mul(workingRate));
    }
    return totalEmittedTokens;
  }

  /**
    Uses the emission schedule to calculate the total amount of points
    emitted between two specified block numbers.

    @param _fromBlock The block to begin calculating emissions from.
    @param _toBlock The block to calculate total emissions up to.
  */
  function getTotalEmittedPoints(uint256 _fromBlock, uint256 _toBlock) public view returns (uint256) {
    require(_toBlock >= _fromBlock,
      "Points cannot be emitted from a higher block to a lower block.");
    uint256 totalEmittedPoints = 0;
    uint256 workingRate = 0;
    uint256 workingBlock = _fromBlock;
    for (uint256 i = 0; i < pointEmissionBlockCount; ++i) {
      uint256 emissionBlock = pointEmissionBlocks[i].blockNumber;
      uint256 emissionRate = pointEmissionBlocks[i].rate;
      if (_toBlock < emissionBlock) {
        totalEmittedPoints = totalEmittedPoints.add(_toBlock.sub(workingBlock).mul(workingRate));
        return totalEmittedPoints;
      } else if (workingBlock < emissionBlock) {
        totalEmittedPoints = totalEmittedPoints.add(emissionBlock.sub(workingBlock).mul(workingRate));
        workingBlock = emissionBlock;
      }
      workingRate = emissionRate;
    }
    if (workingBlock < _toBlock) {
      totalEmittedPoints = totalEmittedPoints.add(_toBlock.sub(workingBlock).mul(workingRate));
    }
    return totalEmittedPoints;
  }

  struct FarmData {
    address stakerContract;
    string farmName;
    RewardToken rewardToken;
    PoolTokenOutput[] poolTokens;
    UserInfoOutput[] poolUserData;
    uint256 totalTokenStrength;
    uint256 totalPointStrength;
    uint256 currentTokenRate;
    uint256 currentPointRate;
  }

  /**
    TODO
  */
  function getFarmData(address _user, IERC20 _weth) external view returns (FarmData memory) {
    RewardToken memory rToken = _buildRewardToken();

    PoolTokenOutput[] memory pts;
    UserInfoOutput[] memory poolUserData;

    for (uint256 i = 0; i < poolTokens.length; i++) {
      IERC20 _pt = IERC20(poolTokens[i]);
      pts[i] = _buildPoolData(IERC20Detailed(address(_pt)), rToken.token, _weth); //pt;

      if(_user != address(0)){
        poolUserData[i] = _buildUserInfo(_pt, _user);
      }
    }

    return FarmData({
      stakerContract: address(this),
      farmName: name,
      rewardToken: rToken,
      poolUserData: poolUserData,
      poolTokens: pts,
      totalTokenStrength: totalTokenStrength,
      totalPointStrength: totalPointStrength,
      currentTokenRate: getTotalEmittedTokens(block.number, block.number + 1),
      currentPointRate: getTotalEmittedPoints(block.number, block.number + 1)
    });
  }
}
