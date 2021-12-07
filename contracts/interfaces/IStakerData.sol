// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

interface IStakerData {
  function getAvailablePoints ( address _user ) external view returns ( uint256 );
  function getSpentPoints ( address _user ) external view returns ( uint256 );
  function getTotalPoints ( address _user ) external view returns ( uint256 );
  function userPoints ( address ) external view returns ( uint256 );
  function userSpentPoints ( address ) external view returns ( uint256 );
  function canAlterDevelopers (  ) external view returns ( bool );
  function canAlterPointEmissionSchedule (  ) external view returns ( bool );
  function canAlterTokenEmissionSchedule (  ) external view returns ( bool );
  function getDeveloperCount (  ) external view returns ( uint256 );
  function getPoolCount (  ) external view returns ( uint256 );
  function getRemainingToken (  ) external view returns ( uint256 );
  function tokenEmissionBlockCount (  ) external view returns ( uint256 );
  function totalPointStrength (  ) external view returns ( uint256 );
  function totalTokenDeposited (  ) external view returns ( uint256 );
  function totalTokenDisbursed (  ) external view returns ( uint256 );
  function totalTokenStrength (  ) external view returns ( uint256 );
  function pointEmissionBlockCount (  ) external view returns ( uint256 );
  function token (  ) external view returns ( address );
  function name (  ) external view returns ( string memory );
  function getPendingPoints ( address _token, address _user ) external view returns ( uint256 );
  function getPendingTokens ( address _token, address _user ) external view returns ( uint256 );
  function getTotalEmittedPoints ( uint256 _fromBlock, uint256 _toBlock ) external view returns ( uint256 );
  function getTotalEmittedTokens ( uint256 _fromBlock, uint256 _toBlock ) external view returns ( uint256 );
  function tokenEmissionBlocks ( uint256 ) external view returns ( uint256 blockNumber, uint256 rate );
  function pointEmissionBlocks ( uint256 ) external view returns ( uint256 blockNumber, uint256 rate );
  function poolTokens ( uint256 ) external view returns ( address );
  function poolInfo ( address ) external view returns ( address _token, uint256 _tokenStrength, uint256 _tokensPerShare, uint256 _pointStrength, uint256 _pointsPerShare, uint256 _lastRewardBlock );
  function userInfo ( address, address ) external view returns ( uint256 amount, uint256 tokenPaid, uint256 pointPaid );
}