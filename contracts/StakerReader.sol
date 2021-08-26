// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./IStakerData.sol";

/**
*/
interface IERC20Detailed is IERC20 {
  function name() external view returns (string memory);
  function symbol() external view returns (string memory);
  function decimals() external view returns (uint8);
}

contract StakerReader {
  using SafeMath for uint256;

  struct stakerDevData {
    uint256 developerCount;
    uint256 poolCount;
    uint256 remainingToken;
    uint256 tokenEmissionBlockCount;
  }

  function readData(IStakerData _stakerContract) external view returns (stakerDevData memory) {
    IStakerData staker = _stakerContract;
    uint256 getDeveloperCount = staker.getDeveloperCount();
    uint256 getPoolCount = staker.getPoolCount();
    uint256 getRemainingToken = staker.getRemainingToken();
    uint256 tokenEmission = staker.tokenEmissionBlockCount();

    return stakerDevData({
      developerCount: getDeveloperCount,
      poolCount: getPoolCount,
      remainingToken: getRemainingToken,
      tokenEmissionBlockCount: tokenEmission
    });
  }

  struct FarmData {
    IStakerData stakerContract;
    string farmName;
    RewardToken rewardToken;
    PoolToken[] poolTokens;
    UserInfo[] poolUserData;
    uint256 totalTokenStrength;
    uint256 totalPointStrength;
    uint256 currentTokenRate;
    uint256 currentPointRate;
  }

  struct RewardToken {
    string name;
    string symbol;
    address token;
  }

  struct FarmPoint {
    string pointName;
    string pointSymbol;
  }

  struct PoolToken {
    address poolToken;
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

  struct UserInfo {
    uint256 amount;
    uint256 userWalletBalance;
    uint256 tokenPaid;
    uint256 pointPaid;
    uint256 pendingRewards;
    uint256 pendingPoints;
    uint256 userAllowance;
  }

  /**
  */
  function getFarmData(address _user, IStakerData _stakercontract, IERC20 _weth) external view returns (FarmData memory) {
    RewardToken memory rToken = _buildRewardToken(_stakercontract);
    PoolToken[] memory pts = new PoolToken[](_stakercontract.getPoolCount());
    UserInfo[] memory poolUserData = new UserInfo[](_stakercontract.getPoolCount());
    for (uint256 i = 0; i < _stakercontract.getPoolCount(); i++) {
      IERC20Detailed _pt = IERC20Detailed(_stakercontract.poolTokens(i));
      pts[i] = _buildPoolData(_stakercontract, _pt, rToken.token, _weth);
      if (_user != address(0)) {
        poolUserData[i] = _buildUserInfo(_pt, _stakercontract, _user);
      }
    }
    return FarmData({
      stakerContract: _stakercontract,
      farmName: _stakercontract.name(),
      rewardToken: rToken,
      poolUserData: poolUserData,
      poolTokens: pts,
      totalTokenStrength: _stakercontract.totalTokenStrength(),
      totalPointStrength: _stakercontract.totalPointStrength(),
      currentTokenRate: _stakercontract.getTotalEmittedTokens(block.number, block.number + 1),
      currentPointRate: _stakercontract.getTotalEmittedPoints(block.number, block.number + 1)
    });
  }

  function _calcWethValue(IERC20 _weth, IERC20 _pt, IERC20 _ft) internal view returns (uint256) {
    uint256 wethBalance = _weth.balanceOf(address(_ft));
    uint256 lpSupply = _pt.totalSupply();
    return wethBalance.mul(2).mul(1000000).div(lpSupply);
  }

  function _buildRewardToken(IStakerData _stakercontract) internal view returns (RewardToken memory) {
    IERC20Detailed _ft = IERC20Detailed(_stakercontract.token());
    return RewardToken({
      name: _ft.name(),
      token: address(_ft),
      symbol: _ft.symbol()
    });
  }

  function _buildPoolData(IStakerData _stakercontract, IERC20Detailed _pt, address rewardToken, IERC20 _weth) internal view returns (PoolToken memory) {
    (
      address _pToken,
      uint256 _tokenStrength,
      uint256 _tokensPerShare,
      uint256 _pointStrength,
      uint256 _pointsPerShare,
      uint256 _lastRewardBlock
    ) = _stakercontract.poolInfo(address(_pt));
    return PoolToken({
      poolToken: address(_pt),
      valueWeth: _calcWethValue(_weth, _pt, IERC20(rewardToken)),
      poolTokenName: _pt.name(),
      poolTokenSymbol: _pt.symbol(),
      tokenStrength: _tokenStrength,
      tokensPerShare: _tokensPerShare,
      pointStrength: _pointStrength,
      pointsPerShare: _pointsPerShare,
      lastRewardBlock: _lastRewardBlock,
      poolTotalSupply: (address(_pToken) == rewardToken) ? _stakercontract.totalTokenDeposited() : _pt.balanceOf(rewardToken)
    });
  }

  function _buildUserInfo(IERC20 _pt, IStakerData _stakercontract, address _user) internal view returns (UserInfo memory) {
    (
      uint256 _amount,
      uint256 _tokenPaid,
      uint256 _pointPaid
    ) = _stakercontract.userInfo(address(_pt), _user);
    return UserInfo({
      amount: _amount,
      userWalletBalance: _pt.balanceOf(_user),
      tokenPaid: _tokenPaid,
      pointPaid: _pointPaid,
      pendingRewards: _stakercontract.getPendingTokens(address(_pt), _user),
      pendingPoints: _stakercontract.getPendingPoints(address(_pt), _user),
      userAllowance: _pt.allowance(_user, address(_stakercontract))
    });
  }
}
