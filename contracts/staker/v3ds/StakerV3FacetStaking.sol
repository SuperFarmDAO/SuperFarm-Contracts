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
contract StakerV3FacetStaking is Sweepableds, ReentrancyGuard, ERC1155Holder, IERC721Receiver {
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.UintSet;
 
  /// Event for depositing NonFungible assets.
  event Deposit(address indexed user, uint256 indexed _poolId, uint256[] amount, uint256[] itemIds, address collection);

    /// Event for withdrawing NonFungible assets.
  event Withdraw(address indexed user, uint256 indexed _poolId, uint256[] amount, uint256[] itemIds, address collection);

  /// Event for claiming rewards from Fungible assets.
  event Claim(address indexed user, uint256 indexed _poolId, uint256 tokenRewards, uint256 pointRewards);

  /// Event for staking non fungible items for boosters.
  event StakeItemBatch(address indexed user, uint256 indexed _poolId, uint256 boosterId);

  /// Event for unstaking non fungible items from boosters.
  event UnstakeItemBatch(address indexed user, uint256 indexed _poolId, uint256 boosterId);

  /// An event for tracking when a user has spent points.
  event SpentPoints(address indexed source, address indexed user, uint256 amount);

  /**
    Uses the emission schedule to calculate the total amount of staking reward
    token that was emitted between two specified timestamps.
    @param _fromTime the time to begin calculating emissions from.
    @param _toTime the time to calculate total emissions up to.
  */
  function getTotalEmittedTokens(uint256 _fromTime, uint256 _toTime) internal view returns (uint256) {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();

    require(_toTime > _fromTime,
      "0x1Z");
    uint256 totalEmittedTokens = 0;
    uint256 workingRate = 0;
    uint256 workingTime = _fromTime;
    uint256 tokenEmissionEventsCountMemory = b.tokenEmissionEventsCount;
    for (uint256 i = 0; i < tokenEmissionEventsCountMemory; ++i) {
      uint256 emissionTime = b.tokenEmissionEvents[i].timeStamp;
      uint256 emissionRate = b.tokenEmissionEvents[i].rate;
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

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();

    require(_toTime > _fromTime,
      "0x1Z");
    uint256 totalEmittedPoints = 0;
    uint256 workingRate = 0;
    uint256 workingTime = _fromTime;
    uint256 pointEmissionEventsCountMemory = b.pointEmissionEventsCount;
    for (uint256 i = 0; i < pointEmissionEventsCountMemory; ++i) {
      uint256 emissionTime = b.pointEmissionEvents[i].timeStamp;
      uint256 emissionRate = b.pointEmissionEvents[i].rate;
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
    @param _id The id of a particular staking pool asset to check for a
      pending reward.
    @param _user the user address to check for a pending reward.
    @return the pending reward token amount.
  */
  function getPendingTokens(uint256 _id, address _user) public view returns (uint256) {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();

    StakerV3Blueprint.PoolInfo memory pool = b.poolInfo[_id];
    StakerV3Blueprint.UserInfo memory user = b.userInfo[_id][_user];
    uint256 tokensPerShare = pool.tokensPerShare;
    uint256 tokenBoostedDeposit = pool.tokenBoostedDeposit;

    if (block.timestamp > pool.lastRewardEvent && tokenBoostedDeposit > 0) {
      uint256 totalEmittedTokens = getTotalEmittedTokens(pool.lastRewardEvent, block.timestamp);
      uint256 tokensReward = ((totalEmittedTokens * pool.tokenStrength) / b.totalTokenStrength) * 1e12;
      tokensPerShare = tokensPerShare + (tokensReward / tokenBoostedDeposit);
    }

    return ((user.amount * tokensPerShare) / 1e12) - user.tokenPaid;
  }

  /**
    A function to easily see the amount of point rewards pending for a user on a
    given pool. Returns the pending reward point amount.
    @param _id The address of a particular staking pool asset to check for a
      pending reward.
    @param _user The user address to check for a pending reward.
    @return the pending reward token amount.
  */
  function getPendingPoints(uint256 _id, address _user) public view returns (uint256) {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();

    StakerV3Blueprint.PoolInfo memory pool = b.poolInfo[_id];
    StakerV3Blueprint.UserInfo memory user = b.userInfo[_id][_user];
    uint256 pointsPerShare = pool.pointsPerShare;
    uint256 pointBoostedDeposit = pool.pointBoostedDeposit;

    if (block.timestamp > pool.lastRewardEvent && pointBoostedDeposit > 0) {
      uint256 totalEmittedPoints = getTotalEmittedPoints(pool.lastRewardEvent, block.timestamp);
      uint256 pointsReward = ((totalEmittedPoints * pool.pointStrength) / b.totalPointStrength) * 1e30;
      pointsPerShare = pointsPerShare + (pointsReward / pointBoostedDeposit);
    }

    return ((user.amount * pointsPerShare) / 1e30) - user.pointPaid;
  }

  /**
    Return the number of points that the user has available to spend.
    @return the number of points that the user has available to spend.
  */
  function getAvailablePoints(address _user) public view returns (uint256) {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();

    uint256 concreteTotal = b.userPoints[_user];
    uint256 pendingTotal = 0;
    for (uint256 i = 0; i < b.lastPoolId; ++i) {
      uint256 _pendingPoints = getPendingPoints(i, _user);
      pendingTotal = pendingTotal + _pendingPoints;
    }
    uint256 spentTotal = b.userSpentPoints[_user];
    return (concreteTotal + pendingTotal) - spentTotal;
  }

  /**
    Return the total number of points that the user has ever accrued.
    @return the total number of points that the user has ever accrued.
  */
  function getTotalPoints(address _user) external view returns (uint256) {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();

    uint256 concreteTotal = b.userPoints[_user];
    uint256 pendingTotal = 0;
    for (uint256 i = 0; i < b.lastPoolId; ++i) {
      uint256 _pendingPoints = getPendingPoints(i, _user);
      pendingTotal = pendingTotal + _pendingPoints;
    }
    return concreteTotal + pendingTotal;
  }

  function genericTransfer(address _from, address _to, address _assetAddress, uint256[] memory _ids, uint256[] memory _amounts) internal returns (bool) {
    bool isErc721 = ISuperGeneric(_assetAddress).supportsInterface(StakerV3Blueprint.INTERFACE_ERC721) ? true : false;
    if (!isErc721) {
       ISuperGeneric(_assetAddress).safeBatchTransferFrom(_from, _to, _ids, _amounts, "");
       return true;
    } else if (isErc721) {
      ISuperGeneric(_assetAddress).safeBatchTransferFrom(_from, _to, _ids, "");
      return true;
    }
    return false;
  }

   /**
    Update the pool corresponding to the specified token address.
    @param _id the id of pool to update the corresponding pool for.
  */
  function updatePool(uint256 _id) internal {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();

    StakerV3Blueprint.PoolInfo storage pool = b.poolInfo[_id];
    if (block.timestamp <= pool.lastRewardEvent) {
      return;
    }

    uint256 poolTokenSupply = ISuperGeneric(pool.assetAddress).balanceOf(address(this));
    if (poolTokenSupply <= 0) {
      pool.lastRewardEvent = block.timestamp;
      return;
    }

    // Calculate token and point rewards for this pool.
    uint256 totalEmittedTokens = getTotalEmittedTokens(pool.lastRewardEvent, block.timestamp);
    uint256 tokensReward = ((totalEmittedTokens * pool.tokenStrength) / b.totalTokenStrength) * 1e12;
    uint256 totalEmittedPoints = getTotalEmittedPoints(pool.lastRewardEvent, block.timestamp);
    uint256 pointsReward = ((totalEmittedPoints * pool.pointStrength) / b.totalPointStrength) * 1e30;

    // Directly pay developers their corresponding share of tokens and points.
    uint256 developerAddressLength = b.developerAddresses.length;
    for (uint256 i = 0; i < developerAddressLength; ++i) {
      address developer = b.developerAddresses[i];
      uint256 share = b.developerShares[developer];
      uint256 devTokens = (tokensReward * share) / 100000;
      tokensReward = tokensReward - devTokens;
      uint256 devPoints = (pointsReward * share) / 100000;
      pointsReward = pointsReward - devPoints;
      IERC20(b.token).safeTransfer(developer, devTokens / 1e12);
      b.userPoints[developer] = b.userPoints[developer] + (devPoints / 1e30);
    }

    // Update the pool rewards per share to pay users the amount remaining.
    pool.tokensPerShare = pool.tokensPerShare + (tokensReward / b.poolInfo[_id].tokenBoostedDeposit);
    pool.pointsPerShare = pool.pointsPerShare + (pointsReward / b.poolInfo[_id].pointBoostedDeposit);
    pool.lastRewardEvent = block.timestamp;
  }

  /**
    Private helper function to update the deposits based on new shares.
    @param _amount base amount of the new boosted amounts.
    @param _poolId the pool id, the deposit of which is to be updated.
    @param _isDeposit flag that represents the caller function. 0 is for deposit,
      1 is for withdraw, other value represents no amount update.
   */
  function updateDeposits(uint256 _amount, uint256 _poolId, uint8 _isDeposit) private {

     StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();
      
    StakerV3Blueprint.PoolInfo storage _pool = b.poolInfo[_poolId];
    StakerV3Blueprint.UserInfo storage _user = b.userInfo[_poolId][msg.sender];
    if (_user.amount > 0) {
      uint256 pendingTokens = ((_user.tokenBoostedAmount * _pool.tokensPerShare) / 1e12) - _user.tokenPaid;
      uint256 pendingPoints = ((_user.pointBoostedAmount * _pool.pointsPerShare) / 1e30) - _user.pointPaid;
      _user.tokenRewards += pendingTokens / 1000;
      _user.pointRewards += pendingPoints / 1000;
      b.totalTokenDisbursed = b.totalTokenDisbursed + pendingTokens;
      _pool.tokenBoostedDeposit -= _user.tokenBoostedAmount;
      _pool.pointBoostedDeposit -= _user.pointBoostedAmount;
    }

    if (_isDeposit == 0) { // Flag for Deposit
      _user.amount += _amount * 1000;
    } else if(_isDeposit == 1) { // Flag for Withdraw
      _user.amount -= _amount * 1000;
    }
    
    _user.tokenBoostedAmount = applyBoosts(_user.amount, _poolId, true);
    _user.pointBoostedAmount = applyBoosts(_user.amount, _poolId, false);
    _pool.tokenBoostedDeposit += _user.tokenBoostedAmount;
    _pool.pointBoostedDeposit += _user.pointBoostedAmount;

    _user.tokenPaid = (_user.tokenBoostedAmount * _pool.tokensPerShare) / 1e12;
    _user.pointPaid = (_user.pointBoostedAmount * _pool.pointsPerShare) / 1e30;
  }

  /**
    Private helper function that applies boosts on deposits for Item staking.
    (amount * multiplier ) / 10000, where multiplier is in basis points.
    (20 * 20000) / 10000 = 40 => 2x boost
    @param _unboosted value that needs to have boosts applied to.
    @param _id Id of the pool.
    @param _isToken is true if '_unboosted' argument is of token type.
    @return _boosted return value with applied boosts.
   */
  function applyBoosts(uint256 _unboosted, uint256 _id, bool _isToken) internal view returns(uint256 _boosted) {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();

    StakerV3Blueprint.PoolInfo memory pool = b.poolInfo[_id];
    StakerV3Blueprint.ItemUserInfo storage staker = b.itemUserInfo[msg.sender];

    if (_unboosted <= 0) {
        return 0;
    } else if (pool.boostInfo.length == 0) {
        return _unboosted;
    } else if (staker.boosterIds.length() == 0) {
        return _unboosted;
    }

    _boosted = _unboosted;
    StakerV3Blueprint.BoostInfo memory booster;

    // Iterate through all the boosters that the pool supports
    for(uint256 i = 0; i < pool.boostInfo.length; i++) {
      booster = b.boostInfo[pool.boostInfo[i]];
      if (staker.boosterIds.contains(pool.boostInfo[i])) {
        if (booster.assetType == StakerV3Blueprint.BoosterAssetType.Tokens && _isToken) {
          _boosted += (_unboosted * booster.multiplier)/10000;
        } else if (booster.assetType == StakerV3Blueprint.BoosterAssetType.Points && !_isToken) {
          _boosted += (_unboosted * booster.multiplier)/10000;
        } else if (booster.assetType == StakerV3Blueprint.BoosterAssetType.Both) {
           _boosted += (_unboosted * booster.multiplier)/10000;
        }
      }
    }
  }

  /**
    Deposit some particular assets to a particular pool on the Staker.
    @param _poolId the pool id.
    @param _asset asset user wants to deposit
  */
  function deposit(uint256 _poolId, uint256 _boosterId ,StakerV3Blueprint.StakedAsset memory _asset) external nonReentrant {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();

    StakerV3Blueprint.PoolInfo memory pool = b.poolInfo[_poolId];
    if (_boosterId != 0) {
      bool exists;
      for (uint256 i = 0; i < pool.boostInfo.length; i++) {
        if (pool.boostInfo[i] == _boosterId) {
            exists = true;
            break;
        }
      }
      require(exists && eligible(_asset.id, _asset.amounts, _asset.assetAddress, _boosterId), "0x4Z");

      StakerV3Blueprint.ItemUserInfo storage staker = b.itemUserInfo[msg.sender];
      staker.totalItems += _asset.id.length;
      for (uint256 i = 0; i < _asset.id.length; i++) {
        staker.tokenIds[_boosterId].add(_asset.id[i]);
        staker.amounts[_asset.id[i]] += _asset.amounts[i];
      }
      staker.boosterIds.add(_boosterId);

      b.totalItemStakes += _asset.id.length;
      updatePool(_poolId);
      updateDeposits(0, _poolId, 2); // 2 = PlaceHolder
      emit StakeItemBatch(msg.sender, _poolId, _boosterId);

    } else {
      require(pool.tokenStrength > 0 || pool.pointStrength > 0,
        "0x1E");
      StakerV3Blueprint.UserInfo storage user = b.userInfo[_poolId][msg.sender];
      uint256 amount;
  
      for (uint256 i = 0; i < _asset.amounts.length; i++) {
        amount += _asset.amounts[i];
        user.asset.amounts.push(_asset.amounts[i]);
        user.asset.id.push(_asset.id[i]);
        user.asset.IOUTokenId.push(b.nextIOUTokenId);
        b.nextIOUTokenId++;
      }
      ISuperGeneric(b.IOUTokenAddress).mintBatch(msg.sender, _asset.IOUTokenId, "");
      // user.asset = _asset;
      updatePool(_poolId);
      updateDeposits(amount, _poolId, 0);
      emit Deposit(msg.sender, _poolId, _asset.amounts, _asset.id, pool.assetAddress);
    }
    require(genericTransfer(msg.sender, address(this), _asset.assetAddress, _asset.id, _asset.amounts), "0x9E");

  }

  /**
    Withdraw some particular assets from a particular pool on the Staker.
    @param _poolId the id of pool, withdraw tokens from.
    @param _asset asset user wants to withdraw
  */
  function withdraw(uint256 _poolId, StakerV3Blueprint.StakedAsset memory _asset, uint256 _boosterId) external nonReentrant {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();

    address transferAddress;
    uint256[] memory ids;
    uint256[] memory amounts;
    if (_boosterId != 0) {
      require(b.itemUserInfo[msg.sender].boosterIds.contains(_boosterId),
        "0x1G");
      StakerV3Blueprint.ItemUserInfo storage staker = b.itemUserInfo[msg.sender];
      
      uint256[] memory _ids = new uint256[](staker.tokenIds[_boosterId].length());
      uint256[] memory _amounts = new uint256[](_ids.length);
      for (uint256 i = 0; i < _ids.length; i++) {
        _ids[i] = staker.tokenIds[_boosterId].at(i);
        _amounts[i] = staker.amounts[_ids[i]];
      }
      transferAddress = b.boostInfo[_boosterId].contractRequired;
      ids = _ids;
      amounts = _amounts;

      staker.totalItems -= _ids.length;
      for (uint256 i = 0; i <  _ids.length; i++) {
          staker.tokenIds[_boosterId].remove(_ids[i]);
          staker.amounts[_ids[i]] = 0;
      }
      staker.boosterIds.remove(_boosterId);

      b.totalItemStakes -= _ids.length;
      updatePool(_poolId);
      updateDeposits(0, _poolId, 2);
      
      emit UnstakeItemBatch(msg.sender, _poolId, _boosterId);

    } else {
    StakerV3Blueprint.PoolInfo storage pool = b.poolInfo[_poolId];
    StakerV3Blueprint.UserInfo storage user = b.userInfo[_poolId][msg.sender];
      uint256 amount;
      for (uint256 i = 0; i < _asset.amounts.length; i++) {
        amount += _asset.amounts[i];
      }
      require(user.amount / 1000 >= amount,
        "0x1Z");


      // pool.token.safeTransfer(msg.sender, _amount);
      require(ISuperGeneric(b.IOUTokenAddress).balanceOf(msg.sender) > 0, "0x2E");
      transferAddress = pool.assetAddress;
      ids = user.asset.id;
      amounts = user.asset.amounts;

      
      ISuperGeneric(b.IOUTokenAddress).burnBatch(msg.sender, user.asset.IOUTokenId);
      updatePool(_poolId);
      updateDeposits(amount, _poolId, 1);

      emit Withdraw(msg.sender, _poolId, user.asset.amounts, user.asset.id, pool.assetAddress);
      delete user.asset;
    }

    require(genericTransfer(address(this), msg.sender, transferAddress, ids, amounts), "0x9E");

  }

  /**
    Claim accumulated token and point rewards from the Staker.
    @param _id The id of pool to claim rewards from.
   */
  function claim(uint256 _id) external nonReentrant {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();

    StakerV3Blueprint.UserInfo storage user = b.userInfo[_id][msg.sender];
    StakerV3Blueprint.PoolInfo storage pool = b.poolInfo[_id];
    uint256 pendingTokens;
    uint256 pendingPoints;

    updatePool(_id);
    if (user.amount > 0) {
      pendingTokens = ((user.tokenBoostedAmount * pool.tokensPerShare) / 1e12) - user.tokenPaid;
      pendingPoints = ((user.pointBoostedAmount * pool.pointsPerShare) / 1e30) - user.pointPaid;
      b.totalTokenDisbursed = b.totalTokenDisbursed + pendingTokens;
    }
    uint256 _tokenRewards = user.tokenRewards + pendingTokens / 1000;
    uint256 _pointRewards = user.pointRewards + pendingPoints / 1000;
    IERC20(b.token).safeTransfer(msg.sender, _tokenRewards);
    b.userPoints[msg.sender] = b.userPoints[msg.sender] + _pointRewards;
    user.tokenRewards = 0;
    user.pointRewards = 0;

    user.tokenPaid = ((user.tokenBoostedAmount * pool.tokensPerShare) / 1e12) / 1000;
    user.pointPaid = ((user.pointBoostedAmount * pool.pointsPerShare) / 1e30) / 1000;
    emit Claim(msg.sender, _id, _tokenRewards, _pointRewards);
  }

  /**
    Claim accumulated token and point rewards from the Staker.
    @param _id The id of pool to claim rewards from.
    @param _checkpoints Information about what time intervals to count rewards
   */
  function claim(uint256 _id, bytes32 _hash, StakerV3Blueprint.Sig calldata sig, StakerV3Blueprint.Checkpoint memory _checkpoints) external {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();

    require(_checkpoints.startTime.length == _checkpoints.endTime.length);
    StakerV3Blueprint.UserInfo storage user = b.userInfo[_id][msg.sender];
    StakerV3Blueprint.PoolInfo storage pool = b.poolInfo[_id];

    uint256 pendingTokens;
    uint256 pendingPoints;
   
    require(b.admin == ecrecover(_hash, sig.v, sig.r, sig.s), "0x1F");
  
    require(keccak256(abi.encodePacked(keccak256(abi.encode(_checkpoints.startTime)), keccak256(abi.encode(_checkpoints.endTime)), keccak256(abi.encode(_checkpoints.balance)))) == _hash, "0x2F");
    
    require(!b.hashes[_hash], "0x3F");
    
    for (uint256 i = 0; i < _checkpoints.startTime.length; i++) {
      pendingTokens = pendingTokens + (((_checkpoints.balance[i] * pool.tokensPerShare) / 1e12));
      pendingPoints = pendingPoints + (((_checkpoints.balance[i] * pool.pointsPerShare) / 1e30));
    }
    pendingTokens = pendingTokens - user.tokenPaid;
    pendingPoints = pendingPoints - user.pointPaid;
    b.totalTokenDisbursed = b.totalTokenDisbursed + pendingTokens;
    
    uint256 _tokenRewards = user.tokenRewards + pendingTokens;
    uint256 _pointRewards = user.pointRewards + pendingPoints;
    IERC20(b.token).safeTransfer(msg.sender, _tokenRewards);
    b.userPoints[msg.sender] = b.userPoints[msg.sender] + _pointRewards;
    user.tokenRewards = 0;
    user.pointRewards = 0;
    b.hashes[_hash] = true;
    user.tokenPaid += user.tokenPaid + pendingTokens;
    user.pointPaid += user.pointPaid + pendingPoints;
    emit Claim(msg.sender, _id, _tokenRewards, _pointRewards);
  }

  /**
    Private helper function to check if Item staker is eligible for a booster.
    @param _ids ids of Items required for a booster.
    @param _amounts amount per token Id.
    @param _contract external contract from which Items are required.
    @param _boosterId the booster for which Items are being staked.
    @return return true if eligible.
   */
  function eligible(uint256[] memory _ids, uint256[] memory _amounts, address _contract, uint256 _boosterId) private view returns(bool) {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();
      
    StakerV3Blueprint.BoostInfo memory booster = b.boostInfo[_boosterId];
    uint256 totalAmount = 0;

    for (uint256 i = 0; i < _amounts.length; i++) {
      totalAmount += _amounts[i];
    }
    if (booster.multiplier == 0) { // Inactive
      return false;
    } else if (_contract != booster.contractRequired) { // Different conatract
      return false;
    } else if (totalAmount < booster.amountRequired) { // Insufficient amount
      return false;
    } else if (booster.groupRequired != 0) {
      for (uint256 i = 0; i < _ids.length; i++) {
        if (_ids[i] >> 128 != booster.groupRequired) { // Wrong group item
          return false;
        }
      }
    }
    return true;
  }

  /**
    Allows the owner of this Staker to grant or remove approval to an external
    spender of the points that users accrue from staking resources.
    @param _spender The external address allowed to spend user points.
    @param _approval The updated user approval status.
  */
  function approvePointSpender(address _spender, bool _approval) external hasValidPermit(UNIVERSAL, StakerV3Blueprint.APPROVE_POINT_SPENDER) {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();
      
    b.approvedPointSpenders[_spender] = _approval;
  }

  /**
    Allows an approved spender of points to spend points on behalf of a user.
    @param _user The user whose points are being spent.
    @param _amount The amount of the user's points being spent.
  */
  function spendPoints(address _user, uint256 _amount) external {

    StakerV3Blueprint.StakerV3StateVariables
      storage b = StakerV3Blueprint.stakerV3StateVariables();

    require(b.approvedPointSpenders[msg.sender],
      "0x3E");
    // uint256 _userPoints = getAvailablePoints(_user);
    require(getAvailablePoints(_user) >= _amount,
      "0x4E");
    b.userSpentPoints[_user] = b.userSpentPoints[_user] + _amount;
    emit SpentPoints(msg.sender, _user, _amount);
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