// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../../base/Sweepable.sol";
import "../../interfaces/ISuperGeneric.sol";
// import "../../assets/erc721/interfaces/ISuper721.sol";


/**
  @title An asset staking contract.
  @author Tim Clancy
  @author Qazawat Zirak
  This staking contract disburses tokens from its internal reservoir according
  to a fixed emission schedule. Assets can be assigned varied staking weights.
  It also supports Items staking for boosts on native ERC20 staking rewards.
  The item staking supports Fungible, Non-Fungible and Semi-Fungible staking.
  This code is inspired by and modified from Sushi's Master Chef contract.
  https://github.com/sushiswap/sushiswap/blob/master/contracts/MasterChef.sol
*/
contract StakerV3 is Sweepable, ReentrancyGuard, IERC721Receiver, ERC1155Holder {
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.UintSet;

  /// The public identifier for the right to add developer.
  bytes32 public constant ADD_DEVELOPER = keccak256("ADD_DEVELOPER");

  /// The public identifier for the right to lock developers.
  bytes32 public constant LOCK_DEVELOPERS = keccak256("LOCK_DEVELOPERS");

  /// The public identifier for the right to set emissions.
  bytes32 public constant SET_EMISSIONS = keccak256("SET_EMISSIONS");

  /// The public identifier for the right to lock token emissions.
  bytes32 public constant LOCK_TOKEN_EMISSIONS = keccak256("LOCK_TOKEN_EMISSIONS");

  /// The public identifier for the right to lock point emissions.
  bytes32 public constant LOCK_POINT_EMISSIONS = keccak256("LOCK_POINT_EMISSIONS");

  /// The public identifier for the right to configure boosters.
  bytes32 public constant CONFIGURE_BOOSTERS = keccak256("CONFIGURE_BOOSTERS");

  /// The public identifier for the right to add pools.
  bytes32 public constant ADD_POOL = keccak256("ADD_POOL");

  /// The public identifier for the right to approve point spender.
  bytes32 public constant APPROVE_POINT_SPENDER = keccak256("APPROVE_POINT_SPENDER");

  /// ERC721 interface ID to detect external contracts for Items staking.
  bytes4 private constant INTERFACE_ERC721 = 0x80ac58cd;

  /// ERC1155 interface ID to detect external contracts for Items staking.
  bytes4 private constant INTERFACE_ERC1155 = 0xd9b67a26;

  /// Address of admin user for verify purposes
  address public admin;

  /// IOU token address
  address public immutable IOUTokenAddress;

  /// The next available ID to be assumed by the next IOUToken minted.
  uint256 public nextIOUTokenId;

  /// Token to disburse to stakers.
  address public token;

  /// Flag for allowing contract owner to add or set developers.
  bool public canAlterDevelopers;

  /// Developer addresses for finding shares in the 'developerShares'.
  address[] public developerAddresses;

  /**  
    @dev A mapping of developer addresses to their percent share of emissions.
    Share percentages are represented as 1/1000th of a percent. That is, a 1%
    share of emissions should map an address to 1000.
  */
  mapping (address => uint256) public developerShares;

  /// Flag for allowing contract owner to alter token emissions.
  bool public canAlterTokenEmissionSchedule;

  /// Flag for allowing contract owner to alter point emissions.
  bool public canAlterPointEmissionSchedule;

  /**  
    This emission schedule maps a timestamp to the amount of tokens or points 
    that should be disbursed starting at that timestamp per-second onwards.
    @param timeStamp if current time reaches timestamp, the rate is applied.
    @param rate measure of points or tokens emitted per-second.
  */
  struct EmissionPoint {
    uint256 timeStamp;
    uint256 rate;
  }

  /// The total number of 'EmissionPoint' as token emission events in the schedule.
  uint256 public tokenEmissionEventsCount;

  /// The total number of 'EmissionPoint' as point emission events in the schedule.
  uint256 public pointEmissionEventsCount;

  /// Schedule of token 'EmissionPoint' for finding emission rate changes.
  mapping (uint256 => EmissionPoint) public tokenEmissionEvents;

  /// Schedule of point 'EmissionPoint' for finding emission rate changes.
  mapping (uint256 => EmissionPoint) public pointEmissionEvents;

  /// @dev A max uint256 value that represents earliest timestamp for quick reference.
  uint256 private MAX_INT = 2**256 - 1;

  /// Earliest possible token emission timestamp.
  uint256 internal earliestTokenEmissionEvent;

  /// Earliest possible point emission timestamp.
  uint256 internal earliestPointEmissionEvent;

  /**  
    A struct containing the pool info.
    @param asset The structure stores information about which asset should be staked into the pool
    @param tokenStrength the relative token emission strength of this pool.
    @param tokenBoostedDeposit amount of tokens after boosts are applied.
    @param tokensPerShare accumulated tokens per share times 1e12.
    @param pointStrength the relative point emission strength of this pool.
    @param pointBoostedDeposit amount of points after boosts are applied.
    @param pointsPerShare accumulated points per share times 1e12.
    @param lastRewardEvent record of the time of the last disbursement.
    @param boostInfo boosters applied to the pool rewards when eligible.

    'tokenBoostedDeposit' and 'pointBoostedDeposit' do not change emission
    rate, but used to calculate perShare amount when there are boosters.
  */
  struct PoolInfo {
    AssetConfigurationInfo asset;
    uint256 tokenStrength;
    uint256 tokenBoostedDeposit;
    uint256 tokensPerShare;
    uint256 pointStrength;
    uint256 pointBoostedDeposit;
    uint256 pointsPerShare;
    uint256 lastRewardEvent;
    uint256[] boostInfo;
  }

  enum StakingAssetType {
    ERC1155, 
    ERC721,
    ERC20
  }

  /**
    An auxiliary structure that is used to create or configure an existing pool
   */
  struct AddPoolStruct {
    uint256 id;
    uint256 tokenStrength;
    uint256 pointStrength;
    uint256 groupId;
    uint256 tokensPerShare;
    uint256 pointsPerShare;
    uint256[] boostInfo;
    AssetConfigurationInfo asset;
  }

  /**
    The structure stores information about which asset should be staked into the pool
    @param assetAddress Address of asset
    @param assetType Type of asset
   */
  struct AssetConfigurationInfo {
    address assetAddress;
    StakingAssetType assetType;
  }

  /// Array for enumeration of the pools.
  AssetConfigurationInfo[] public poolAssets;

  /// Mapping of pools to 'PoolInfo' based on their id.
  mapping (uint256 => PoolInfo) public poolInfo;

  struct Sig {
    /* v parameter */
    uint8 v;
    /* r parameter */
    bytes32 r;
    /* s parameter */
    bytes32 s;
  }

  /**
    The structure stores the checkpoints when the user held the NFT

    @param startTime Beginning of holding
    @param endTime Ending of holding
    @param balance Holding balance
    @param sig User's signature
    @param hash User's hashed message
   */
  struct Checkpoint {
    uint256[] startTime;
    uint256[] endTime;
    uint256[] balance;
    // Sig sig;
    // bytes32 hash;
  }

  /**  
    A struct containing the Fungible Token Staker information.
    @param amount amount of the pool asset being provided by the user.
    @param tokenBoostedAmount tokens amount after boosts are applied.
    @param pointBoostedAmount points amount after boosts are applied.
    @param tokenRewards amount of token rewards accumulated to be claimed.
    @param pointRewards amount of point rewards accumulated to be claimed.
    @param tokenPaid value of user's total token earnings paid out. 
      pending reward = (user.amount * pool.tokensPerShare) - user.rewardDebt.
    @param pointPaid value of user's total point earnings paid out.
    @param asset The structure stores information about what assets the user has staked
  */
  struct UserInfo {
    uint256 amount;
    uint256 tokenBoostedAmount;
    uint256 pointBoostedAmount;
    uint256 tokenRewards;
    uint256 pointRewards;
    uint256 tokenPaid;
    uint256 pointPaid;
    StakedAsset asset;
  }

  /**
    The structure stores information about what assets the user has staked
    @param assetAddress Address of asset
    @param id Array of id's
    @param amounts Array of amounts
    @param IOUTokenId Arrays of id's of IOUtoken 
   */
  struct StakedAsset {
    address assetAddress;
    uint256[] id;
    uint256[] amounts;
    uint256[] IOUTokenId;
  }

  /// Stored information for each user staking in each pool.
  mapping (uint256 => mapping (address => UserInfo)) public userInfo;

  /// The total sum of the token strength of all pools.
  uint256 public totalTokenStrength;

  /// The total sum of the point strength of all pools.
  uint256 public totalPointStrength;

  /// The total amount of the disbursed token ever emitted by this StakerV2.
  uint256 public totalTokenDisbursed;

  /// Users additionally accrue non-token points for participating via staking.
  mapping (address => uint256) public userPoints;

  /// The amount of points belonging to a user already spent.
  mapping (address => uint256) public userSpentPoints;

  /// A map of all external addresses that are permitted to spend user points.
  mapping (address => bool) public approvedPointSpenders;

  /**
    The type of asset on which the boost is applied.
    @param Tokens boost is applied on the disburse token.
    @param Points boost is applied on the points.
    @param Both boost is applied on both.
  */
  enum BoosterAssetType {
    Tokens,
    Points,
    Both
  }

  /** 
    A booster struct, which stores information on the boost requirements.
    @param multiplier the rate which will act as a boost on basis points.
      A multiplier of Zero means, the booster is not set.
    @param amountRequired number of Items required from the contract.
    @param groupRequired (optional) specifies a group from Items contract 
      as requirement for the boost. If 0, then any group or item.
    @param contractRequired contract that the required assets belong to.
    @param assetType enum that specifies Tokens/Points to boost or both.
  */
  struct BoostInfo {
    uint256 multiplier;
    uint256 amountRequired;
    uint256 groupRequired;
    address contractRequired;
    BoosterAssetType assetType;
  }

  /// Mapping of Booster ID to its 'BoostInfo'.
  mapping (uint256 => BoostInfo) public boostInfo;

  /// Number of boosters that are active.
  uint256 public activeBoosters;

  /**
    A struct containing the Items staker information.
    @param totalItems total Items staked in this contract by Items staker.
    @param tokenIds actual ids of tokens mapped to booster Id.
    @param amounts amount of Items per tokenId.
    @param boosterIds enumerable booster Ids the user has staked Items in.

    Contract address at the time of unstaking is retreived from boostInfo.
   */
  struct ItemUserInfo {
    uint256 totalItems;
    mapping(uint256 => EnumerableSet.UintSet) tokenIds;
    mapping(uint256 => uint256) amounts;
    EnumerableSet.UintSet boosterIds;
  }

  /**
    A struct as return parameter to get token Ids against a booster Id of
    a staker. Needed since EnumerableSets cannot have getters by default.
    @param boostersIds the booster Id to check the Items for.
    @param tokenIds the token Ids that are staked in that booster.
    @param amounts amount per token Id staked in a booster.
    @param totalItems total Items staked in this contract by Items staker.
   */
  struct GetItemUserInfo {
    uint256 boosterId;
    uint256[] tokenIds;
    uint256[] amounts;
    uint256 totalItems;
  }

  /// Collection of Item stakers
  mapping(address => ItemUserInfo) private itemUserInfo;

  /// Items staked in this contract.
  uint256 public totalItemStakes;

  /// Event for depositing Fungible assets.
  event DepositERC20(address indexed user, uint256 indexed _poolId, uint256 amount);

  /// Event for depositing NonFungible assets.
  event DepositNFT(address indexed user, uint256 indexed _poolId, uint256[] amount, uint256[] itemIds, address collection);

  /// Event for withdrawing Fungible assets.
  event WithdrawERC20(address indexed user, uint256 indexed _poolId, uint256 amount);

    /// Event for withdrawing NonFungible assets.
  event WithdrawNFT(address indexed user, uint256 indexed _poolId, uint256[] amount, uint256[] itemIds, address collection);

  /// Event for claiming rewards from Fungible assets.
  event Claim(address indexed user, uint256 indexed _poolId, uint256 tokenRewards, uint256 pointRewards);

  /// Event for staking non fungible items for boosters.
  event StakeItemBatch(address indexed user, uint256 indexed _poolId, uint256 boosterId);

  /// Event for unstaking non fungible items from boosters.
  event UnstakeItemBatch(address indexed user, uint256 indexed _poolId, uint256 boosterId);

  /// An event for tracking when a user has spent points.
  event SpentPoints(address indexed source, address indexed user, uint256 amount);

  /**
    Deploy a new StakerV2 contract with a name and the token to disburse.
    @param _token the token to reward stakers in this contract with.
  */
  constructor(address _owner, address _token, address _admin, address _IOUTokenAddress) {

    if (_owner != owner()) {
      transferOwnership(_owner);
    }

    IOUTokenAddress = _IOUTokenAddress;
    admin = _admin;
    token = _token;
    canAlterDevelopers = true;
    canAlterTokenEmissionSchedule = true;
    canAlterPointEmissionSchedule = true;
    earliestTokenEmissionEvent = MAX_INT;
    earliestPointEmissionEvent = MAX_INT;
  }

  /**
    Add a new developer to the StakerV2 or overwrite an existing one.
    This operation requires that developer address addition is not locked.
    @param _developerAddress the additional developer's address.
    @param _share the share in 1/1000th of a percent of each token emission sent
      to this new developer.
  */
  function addDeveloper(address _developerAddress, uint256 _share) external hasValidPermit(UNIVERSAL, ADD_DEVELOPER) {

    require(canAlterDevelopers,
      "Devs locked.");
    developerAddresses.push(_developerAddress);
    developerShares[_developerAddress] = _share;
  }

  /**
    Permanently forfeits owner ability to alter the state of StakerV2 developers.
    Once called, this function is intended to give peace of mind to the StakerV2's
    developers and community that the fee structure is now immutable.
  */
  function lockDevelopers() external hasValidPermit(UNIVERSAL, LOCK_DEVELOPERS) {

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
    Set new emission details to the StakerV2 or overwrite existing ones.
    This operation requires that emission schedule alteration is not locked.
    @param _tokenSchedule an array of EmissionPoints defining the token schedule.
    @param _pointSchedule an array of EmissionPoints defining the point schedule.
  */
  function setEmissions(EmissionPoint[] memory _tokenSchedule, EmissionPoint[] memory _pointSchedule) external hasValidPermit(UNIVERSAL, SET_EMISSIONS) {

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
    Once called, this function is intended to give peace of mind to the StakerV2's
    developers and community that the inflation rate is now immutable.
  */
  function lockTokenEmissions() external hasValidPermit(UNIVERSAL, LOCK_TOKEN_EMISSIONS) {

    canAlterTokenEmissionSchedule = false;
  }

  /**
    Permanently forfeits owner ability to alter the emission schedule.
    Once called, this function is intended to give peace of mind to the StakerV2's
    developers and community that the inflation rate is now immutable.
  */
  function lockPointEmissions() external hasValidPermit(UNIVERSAL, LOCK_POINT_EMISSIONS) {

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

    return poolAssets.length;
  }

  /**
    Returns the amount of token that has not been disbursed by the StakerV2 yet.
    @return the amount of token that has not been disbursed by the StakerV2 yet.
  */
  function getRemainingToken() external view returns (uint256) {

    return IERC20(token).balanceOf(address(this));
  }

   /** 
    Create or edit boosters in batch with boost parameters
    @param _ids array of booster IDs.
    @param _boostInfo array of boostInfo.

    Should not be reconfigured if it was made public for staking Items.
  */
  function configureBoostersBatch(uint256[] memory _ids, BoostInfo[] memory _boostInfo) external hasValidPermit(UNIVERSAL, CONFIGURE_BOOSTERS) {

    require(_boostInfo.length > 0, 
      "0 BoostInfo.");
    require(_ids.length == _boostInfo.length, 
      "Length mismatch.");

    for (uint256 i = 0; i < _boostInfo.length; i++) {
      if (_boostInfo[i].multiplier == 0) {
        revert("0 Multiplier.");
      } else if (_boostInfo[i].amountRequired == 0) {
        revert("0 Amount.");
      } else if (_boostInfo[i].contractRequired == address(0)) {
        revert("0 address.");
      }

      if (boostInfo[i].multiplier == 0 && _boostInfo[i].multiplier != 0) {
        activeBoosters++;
      }

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
    @param _addPoolStruct struct, which we use to create new pool
  */
  function addPool(AddPoolStruct calldata _addPoolStruct) external hasValidPermit(UNIVERSAL, ADD_POOL) {

    require(tokenEmissionEventsCount > 0 && pointEmissionEventsCount > 0,
      "Emissions required.");
    require(address(_addPoolStruct.asset.assetAddress) != address(token), 
      "Disburse token.");
    require(_addPoolStruct.tokenStrength > 0 && _addPoolStruct.pointStrength > 0, 
      "Strength/s are Zero.");

    uint256 lastTokenRewardTime = block.timestamp > earliestTokenEmissionEvent ? block.timestamp : earliestTokenEmissionEvent;
    uint256 lastPointRewardTime = block.timestamp > earliestPointEmissionEvent ? block.timestamp : earliestPointEmissionEvent;
    uint256 lastRewardEvent = lastTokenRewardTime > lastPointRewardTime ? lastTokenRewardTime : lastPointRewardTime;
    if (address(poolInfo[_addPoolStruct.id].asset.assetAddress) == address(0)) {
      poolAssets.push(_addPoolStruct.asset);
      totalTokenStrength = totalTokenStrength + _addPoolStruct.tokenStrength;
      totalPointStrength = totalPointStrength + _addPoolStruct.pointStrength;
      poolInfo[_addPoolStruct.id] = PoolInfo({
        asset: _addPoolStruct.asset,
        tokenStrength: _addPoolStruct.tokenStrength,
        tokenBoostedDeposit: 0,
        tokensPerShare: _addPoolStruct.tokensPerShare,
        pointStrength: _addPoolStruct.pointStrength,
        pointBoostedDeposit: 0,
        pointsPerShare: _addPoolStruct.pointsPerShare,
        lastRewardEvent: lastRewardEvent,
        boostInfo: _addPoolStruct.boostInfo
      });
    } else {
      addPool(_addPoolStruct.id, _addPoolStruct.boostInfo, _addPoolStruct.tokenStrength, _addPoolStruct.pointStrength);
    }
  }

  function addPool(uint256 _id, uint256[] calldata _boostInfo, uint256 _tokenStrength, uint256 _pointStrength) private {
      totalTokenStrength = (totalTokenStrength - poolInfo[_id].tokenStrength) + _tokenStrength;
      poolInfo[_id].tokenStrength = _tokenStrength;
      totalPointStrength = (totalPointStrength - poolInfo[_id].pointStrength) + _pointStrength;
      poolInfo[_id].pointStrength = _pointStrength;

      // Append boosters by avoid writing to storage directly in a loop to avoid costs
      uint256[] memory boosters = new uint256[](poolInfo[_id].boostInfo.length + _boostInfo.length);
      for (uint256 i = 0; i < poolInfo[_id].boostInfo.length; i++) {
        boosters[i] = poolInfo[_id].boostInfo[i];
      }
      for (uint256 i = 0; i < _boostInfo.length; i++) {
        boosters[i + poolInfo[_id].boostInfo.length] = _boostInfo[i];
      }
      PoolInfo storage pool = poolInfo[_id];
      pool.boostInfo = boosters; // Appended boosters
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
    @param _id The id of a particular staking pool asset to check for a
      pending reward.
    @param _user the user address to check for a pending reward.
    @return the pending reward token amount.
  */
  function getPendingTokens(uint256 _id, address _user) public view returns (uint256) {

    PoolInfo storage pool = poolInfo[_id];
    UserInfo storage user = userInfo[_id][_user];
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
    @param _id The address of a particular staking pool asset to check for a
      pending reward.
    @param _user The user address to check for a pending reward.
    @return the pending reward token amount.
  */
  function getPendingPoints(uint256 _id, address _user) public view returns (uint256) {

    PoolInfo storage pool = poolInfo[_id];
    UserInfo storage user = userInfo[_id][_user];
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
    for (uint256 i = 0; i < poolAssets.length; ++i) {
      uint256 _pendingPoints = getPendingPoints(i, _user);
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
    for (uint256 i = 0; i < poolAssets.length; ++i) {
      uint256 _pendingPoints = getPendingPoints(i, _user);
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

  function checkBalance(AssetConfigurationInfo memory _asset, address account) internal view returns (uint256) {
      if (_asset.assetType == StakingAssetType.ERC20) {
          return IERC20(_asset.assetAddress).balanceOf(account);
      } else if (_asset.assetType == StakingAssetType.ERC1155) {
          return ISuperGeneric(_asset.assetAddress).balanceOf(account);
      } else if (_asset.assetType == StakingAssetType.ERC721) {
          return ISuperGeneric(_asset.assetAddress).balanceOf(account);
      }
      return 0;
  }


  /**
    Private function for the correct transfer of assets to the user

    @param _poolId Pool id
    @param _asset The structure in which the information about the asset is stored
    @param user User information
   */
  function genericTransfer(uint256 _poolId, StakedAsset memory _asset, UserInfo storage user) internal {
      // UserInfo storage user = userInfo[_poolId][msg.sender];
      PoolInfo memory pool = poolInfo[_poolId];
      // StakedNFT memory stakedNft;

      if (pool.asset.assetType == StakingAssetType.ERC20) {
          IERC20(_asset.assetAddress).transfer(msg.sender, _asset.amounts[0]);
          emit WithdrawERC20(msg.sender, _poolId, _asset.amounts[0]);
      } else if (pool.asset.assetType == StakingAssetType.ERC1155) {
          ISuperGeneric(_asset.assetAddress).safeBatchTransferFrom(address(this), msg.sender, user.asset.id, user.asset.amounts, "");
          ISuperGeneric(IOUTokenAddress).burnBatch(msg.sender, user.asset.IOUTokenId);
          emit WithdrawNFT(msg.sender, _poolId, user.asset.amounts, user.asset.id, user.asset.assetAddress);
          delete user.asset;
      } else if (pool.asset.assetType == StakingAssetType.ERC721) {
          require(ISuperGeneric(IOUTokenAddress).balanceOf(msg.sender) > 0, "Balance of IOU token must be > 0");
          ISuperGeneric(_asset.assetAddress).safeBatchTransferFrom(address(this), msg.sender, user.asset.id, "");
          ISuperGeneric(IOUTokenAddress).burnBatch(msg.sender, user.asset.IOUTokenId);
          emit WithdrawNFT(msg.sender, _poolId, user.asset.amounts, user.asset.id, user.asset.assetAddress);
          delete user.asset;
          // require(ISuperGeneric(IOUTokenAddress).balanceOf(msg.sender) > 0, "Balance of IOU token must be > 0");

      }
  }


  /**
    Private function for the correct transfer of assets from the user

    @param _poolId Pool id
    @param _asset The structure in which the information about the asset is stored
    @param user User information
   */
  function genericTransferFrom(uint256 _poolId, StakedAsset memory _asset, UserInfo storage user) internal {
      // UserInfo storage user = userInfo[_poolId][msg.sender];
      PoolInfo memory pool = poolInfo[_poolId];

      // StakedNFT memory stakedNft;
      if (pool.asset.assetType == StakingAssetType.ERC20) {
          IERC20(_asset.assetAddress).transferFrom(msg.sender, address(this), _asset.amounts[0]);
          user.asset = _asset;
          emit DepositERC20(msg.sender, _poolId, _asset.amounts[0]);
      } else if (pool.asset.assetType == StakingAssetType.ERC1155) {
          ISuperGeneric(_asset.assetAddress).safeBatchTransferFrom(msg.sender, address(this), _asset.id, _asset.amounts, "");
          _asset.IOUTokenId = new uint[](_asset.amounts.length);
          for (uint i = 0; i < _asset.amounts.length; i++) {
            _asset.IOUTokenId[i] = nextIOUTokenId;
            nextIOUTokenId++;
          }
          ISuperGeneric(IOUTokenAddress).mintBatch(msg.sender, _asset.IOUTokenId, "");
          user.asset = _asset;
          emit DepositNFT(msg.sender, _poolId, _asset.amounts, _asset.id, _asset.assetAddress);


      } else if (pool.asset.assetType == StakingAssetType.ERC721) {
        ISuperGeneric(_asset.assetAddress).safeBatchTransferFrom(msg.sender, address(this), _asset.id, "");
        _asset.IOUTokenId = new uint[](_asset.amounts.length);

        for (uint i = 0; i < _asset.amounts.length; i++) {
          _asset.IOUTokenId[i] = nextIOUTokenId;
          nextIOUTokenId++;
        }
        ISuperGeneric(IOUTokenAddress).mintBatch(msg.sender, _asset.IOUTokenId, "");
        user.asset = _asset;        
        emit DepositNFT(msg.sender, _poolId, _asset.amounts, _asset.id, _asset.assetAddress);

      }
  }

   /**
    Update the pool corresponding to the specified token address.
    @param _id the id of pool to update the corresponding pool for.
  */
  function updatePool(uint256 _id, uint256 _startTime, uint256 _endTime) internal {

    PoolInfo storage pool = poolInfo[_id];
    if (block.timestamp <= pool.lastRewardEvent) {
      return;
    }

    if (_startTime == 0 || _endTime == 0) {
        _startTime = pool.lastRewardEvent;
        _endTime = block.timestamp;
    }

    uint256 poolTokenSupply = checkBalance(pool.asset, address(this));
    if (poolTokenSupply <= 0) {
      pool.lastRewardEvent = block.timestamp;
      return;
    }

    // Calculate token and point rewards for this pool.
    uint256 totalEmittedTokens = getTotalEmittedTokens(_startTime, _endTime);
    uint256 tokensReward = ((totalEmittedTokens * pool.tokenStrength) / totalTokenStrength) * 1e12;
    uint256 totalEmittedPoints = getTotalEmittedPoints(_startTime, _endTime);
    uint256 pointsReward = ((totalEmittedPoints * pool.pointStrength) / totalPointStrength) * 1e30;

    // Directly pay developers their corresponding share of tokens and points.
    for (uint256 i = 0; i < developerAddresses.length; ++i) {
      address developer = developerAddresses[i];
      uint256 share = developerShares[developer];
      uint256 devTokens = (tokensReward * share) / 100000;
      tokensReward = tokensReward - devTokens;
      uint256 devPoints = (pointsReward * share) / 100000;
      pointsReward = pointsReward - devPoints;
      IERC20(token).safeTransfer(developer, devTokens / 1e12);
      userPoints[developer] = userPoints[developer] + (devPoints / 1e30);
    }

    // Update the pool rewards per share to pay users the amount remaining.
    pool.tokensPerShare = pool.tokensPerShare + (tokensReward / poolInfo[_id].tokenBoostedDeposit);
    pool.pointsPerShare = pool.pointsPerShare + (pointsReward / poolInfo[_id].pointBoostedDeposit);
    pool.lastRewardEvent = block.timestamp;
  }

  /**
    Private helper function to update the deposits based on new shares.
    @param _amount base amount of the new boosted amounts.
    @param _id the pool id.
    @param _pool the pool, the deposit of which is to be updated.
    @param _user the user, the amount of whom is to be updated.
    @param _isDeposit flag that represents the caller function. 0 is for deposit,
      1 is for withdraw, other value represents no amount update.
   */
  function updateDeposits(uint256 _amount, uint256 _id, PoolInfo storage _pool, UserInfo storage _user, uint8 _isDeposit) private {
    
    if (_user.amount > 0) {
      uint256 pendingTokens = ((_user.tokenBoostedAmount * _pool.tokensPerShare) / 1e12) - _user.tokenPaid;
      uint256 pendingPoints = ((_user.pointBoostedAmount * _pool.pointsPerShare) / 1e30) - _user.pointPaid;
      _user.tokenRewards += pendingTokens;
      _user.pointRewards += pendingPoints;
      totalTokenDisbursed = totalTokenDisbursed + pendingTokens;
      _pool.tokenBoostedDeposit -= _user.tokenBoostedAmount;
      _pool.pointBoostedDeposit -= _user.pointBoostedAmount;
    }

    if (_isDeposit == 0) { // Flag for Deposit
      _user.amount += _amount;
    } else if(_isDeposit == 1) { // Flag for Withdraw
      _user.amount -= _amount;
    }
    
    _user.tokenBoostedAmount = applyBoosts(_user.amount, _id, true);
    _user.pointBoostedAmount = applyBoosts(_user.amount, _id, false);
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

    if (_unboosted <= 0) {
        return 0;
    } else if (poolInfo[_id].boostInfo.length == 0) {
        return _unboosted;
    } else if (itemUserInfo[_msgSender()].boosterIds.length() == 0) {
        return _unboosted;
    }

    _boosted = _unboosted;
    BoostInfo memory booster;
    PoolInfo memory pool = poolInfo[_id];
    ItemUserInfo storage staker =  itemUserInfo[_msgSender()];

    // Iterate through all the boosters that the pool supports
    for(uint256 i = 0; i < pool.boostInfo.length; i++) {
      booster = boostInfo[pool.boostInfo[i]];
      if (staker.boosterIds.contains(pool.boostInfo[i])) {
        if (booster.assetType == BoosterAssetType.Tokens && _isToken) {
          _boosted += (_unboosted * booster.multiplier)/10000;
        } else if (booster.assetType == BoosterAssetType.Points && !_isToken) {
          _boosted += (_unboosted * booster.multiplier)/10000;
        } else if (booster.assetType == BoosterAssetType.Both) {
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
  function deposit(uint256 _poolId, StakedAsset calldata _asset) external nonReentrant {

    PoolInfo storage pool = poolInfo[_poolId];
    // StakedAsset storage asset = _asset;
    require(pool.tokenStrength > 0 || pool.pointStrength > 0,
      "Inactive pool.");
    uint256 amount = calculateAmounts(_asset.amounts);

    require(pool.asset.assetAddress == _asset.assetAddress, "Wrong collection");
    UserInfo storage user = userInfo[_poolId][msg.sender];

    updatePool(_poolId, 0, 0);

    // pool.token.safeTransferFrom(msg.sender, address(this), _amount);
    genericTransferFrom(_poolId, _asset, user);

    updateDeposits(amount, _poolId, pool, user, 0);

    // emit Deposit(msg.sender, _poolId, _asset._amount[0]);
  }

  /**
    Withdraw some particular assets from a particular pool on the Staker.
    @param _id the id of pool, withdraw tokens from.
    @param _asset asset user wants to withdraw
  */
  function withdraw(uint256 _id, StakedAsset calldata _asset) external nonReentrant {

    PoolInfo storage pool = poolInfo[_id];
    UserInfo storage user = userInfo[_id][msg.sender];
    uint256 amount = calculateAmounts(_asset.amounts);
    require(user.amount >= amount,
      "Invalid amount.");

    updatePool(_id, 0, 0);

    // pool.token.safeTransfer(msg.sender, _amount);
    genericTransfer(_id, _asset, user);
    updateDeposits(amount, _id, pool, user, 1);

    // emit Withdraw(msg.sender, _id, _amount);
  }

  function calculateAmounts(uint256[] calldata _amounts) pure private returns (uint256 amount) {
    for (uint256 i = 0; i < _amounts.length; i++) {
      amount += _amounts[i];
    }
  }

  /**
    Claim accumulated token and point rewards from the Staker.
    @param _id The id of pool to claim rewards from.
   */
  function claim(uint256 _id) external nonReentrant {
    UserInfo storage user = userInfo[_id][msg.sender];
    PoolInfo storage pool = poolInfo[_id];
    uint256 pendingTokens;
    uint256 pendingPoints;

    updatePool(_id, 0, 0);
    if (user.amount > 0) {
      pendingTokens = ((user.tokenBoostedAmount * pool.tokensPerShare) / 1e12) - user.tokenPaid;
      pendingPoints = ((user.pointBoostedAmount * pool.pointsPerShare) / 1e30) - user.pointPaid;
      totalTokenDisbursed = totalTokenDisbursed + pendingTokens;
    }
    uint256 _tokenRewards = user.tokenRewards + pendingTokens;
    uint256 _pointRewards = user.pointRewards + pendingPoints;
    IERC20(token).safeTransfer(msg.sender, _tokenRewards);
    userPoints[msg.sender] = userPoints[msg.sender] + _pointRewards;
    user.tokenRewards = 0;
    user.pointRewards = 0;

    user.tokenPaid = (user.tokenBoostedAmount * pool.tokensPerShare) / 1e12;
    user.pointPaid = (user.pointBoostedAmount * pool.pointsPerShare) / 1e30;
    emit Claim(msg.sender, _id, _tokenRewards, _pointRewards);
  }

  // mapping (address => uint256) claimedAt;

  struct Checkpoint2 {
    uint256[] startTime;
    uint256[] endTime;
    uint256[] balance;
  }

  /**
    Claim accumulated token and point rewards from the Staker.
    @param _id The id of pool to claim rewards from.
    @param _checkpoints Information about what time intervals to count rewards
   */
  function claim(uint256 _id, bytes32 _hash, Sig calldata sig, Checkpoint calldata _checkpoints) external {
    require(_checkpoints.startTime.length == _checkpoints.endTime.length);
    UserInfo storage user = userInfo[_id][msg.sender];
    // PoolInfo storage pool = poolInfo[_id];
    // NftHoldingInfo memory holdingInfo = pool.holdingInfo;
    uint256 pendingTokens;
    uint256 pendingPoints;
    // uint256 endTime;
    // claimedAt[msg.sender]
    require(admin == ecrecover(_hash, sig.v, sig.r, sig.s), "Signed not by admin");
    bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", checkpointsHash(_checkpoints)));
    require(messageHash == _hash, "Invalid hashed message");


    // for (uint256 i = 0; i < _checkpoints.length; i++) {
    //   require(admin == ecrecover(_checkpoints[i].hash, _checkpoints[i].sig.v, _checkpoints[i].sig.r, _checkpoints[i].sig.s), "Signed not by admin");

    //   bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(_checkpoints[i].startTime, _checkpoints[i].endTime, _checkpoints[i].balance))));
    //   require(messageHash == _checkpoints[i].hash, "Invalid hashed message");

    //   endTime = _checkpoints[i].endTime == 0 ? block.timestamp : _checkpoints[i].endTime;
     

    //   updatePool(_id, _checkpoints[i].startTime, endTime);

      
    //   pendingTokens = pendingTokens + (((_checkpoints[i].balance * pool.tokensPerShare) / 1e12));
    //   pendingPoints = pendingPoints + (((_checkpoints[i].balance * pool.pointsPerShare) / 1e30));
    // }
    
    (pendingTokens, pendingTokens) = calculateRewardsForHolders(_checkpoints, _id);
    pendingTokens = pendingTokens - user.tokenPaid;
    pendingPoints = pendingPoints - user.pointPaid;
    totalTokenDisbursed = totalTokenDisbursed + pendingTokens;
    
    uint256 _tokenRewards = user.tokenRewards + pendingTokens;
    uint256 _pointRewards = user.pointRewards + pendingPoints;
    IERC20(token).safeTransfer(msg.sender, _tokenRewards);
    userPoints[msg.sender] = userPoints[msg.sender] + _pointRewards;
    user.tokenRewards = 0;
    user.pointRewards = 0;
    // claimedAt[msg.sender] = _checkpoints[length-1].endTime;
    // user.tokenPaid = (_amountStaked * pool.tokensPerShare) / 1e12;
    user.tokenPaid += user.tokenPaid + pendingTokens;
    // user.pointPaid = (_amountStaked * pool.pointsPerShare) / 1e30;
    user.pointPaid += user.pointPaid + pendingPoints;
    emit Claim(msg.sender, _id, _tokenRewards, _pointRewards);
  }

  function calculateRewardsForHolders(Checkpoint calldata _checkpoints, uint256 _poolId) internal returns (uint256 pendingTokens, uint256 pendingPoints) {
    uint256 endTime;
    PoolInfo memory pool = poolInfo[_poolId];

    for (uint256 i = 0; i < _checkpoints.startTime.length; i++) {
      endTime = _checkpoints.endTime[i] == 0 ? block.timestamp : _checkpoints.endTime[i];
      updatePool(_poolId, _checkpoints.startTime[i], endTime);
      pendingTokens = pendingTokens + (((_checkpoints.balance[i] * pool.tokensPerShare) / 1e12));
      pendingPoints = pendingPoints + (((_checkpoints.balance[i] * pool.pointsPerShare) / 1e30));
    }
  }

  function checkpointsHash(Checkpoint calldata _checkpoints) pure internal returns (bytes32 hash_) {
    return keccak256(abi.encodePacked(keccak256(abi.encode(_checkpoints.startTime)), keccak256(abi.encode(_checkpoints.endTime)), keccak256(abi.encode(_checkpoints.balance))));
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

    BoostInfo memory booster = boostInfo[_boosterId];
    uint256 totalAmount = 0;

    for (uint256 i = 0; i < _amounts.length; i++) {
      totalAmount += _amounts[i];
    }
    if (booster.multiplier == 0) { // Inactive
      return false;
    } else if (_contract != booster.contractRequired) { // Different contract
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
    Stake a collection of items for booster from a ERC721 or ERC1155 contract.
    @param _ids the ids collection of Items from a contract.
    @param _amounts the amount per token Id.
    @param _contract the external contract of the Items.
    @param _poolId the pool that will be staked in.
    @param _boosterId the booster that accepts these Items.
  */
  function stakeItemsBatch(uint256[] calldata _ids, uint256[] calldata _amounts, address _contract, uint256 _poolId, uint256 _boosterId) external nonReentrant {

    require(_ids.length == _amounts.length, 
      "Length Mismatch");
    bool exists = false;
    for (uint256 i = 0; i < poolInfo[_poolId].boostInfo.length; i++) {
        if (poolInfo[_poolId].boostInfo[i] == _boosterId) {
            exists = true;
            break;
        }
    }
    if (!exists) {
        revert("Invalid pool/booster.");
    } else if (!eligible(_ids, _amounts, _contract, _boosterId)) {
        revert("Ineligible.");
    }
        
    PoolInfo storage pool = poolInfo[_poolId];
    UserInfo storage user = userInfo[_poolId][msg.sender];

    if (ISuperGeneric(_contract).supportsInterface(INTERFACE_ERC721)) {
        ISuperGeneric(_contract).safeBatchTransferFrom(_msgSender(), address(this), _ids, "");
    } else if (ISuperGeneric(_contract).supportsInterface(INTERFACE_ERC1155)) {
        ISuperGeneric(_contract).safeBatchTransferFrom(_msgSender(), address(this), _ids, _amounts, "");
    } else {
        revert("Unsupported Contract.");
    }
    
    ItemUserInfo storage staker = itemUserInfo[msg.sender];
    staker.totalItems += _ids.length;
    for (uint256 i = 0; i < _ids.length; i++) {
      staker.tokenIds[_boosterId].add(_ids[i]);
      staker.amounts[_ids[i]] += _amounts[i];
    }
    staker.boosterIds.add(_boosterId);

    totalItemStakes += _ids.length;

    updatePool(_poolId, 0, 0);
    updateDeposits(0, _poolId, pool, user, 2); // 2 = PlaceHolder

    emit StakeItemBatch(msg.sender, _poolId, _boosterId);
  }

  

  /**
    Unstake collection of items from booster to ERC721 or ERC1155 contract.
    @param _poolId the pool that was previously staked in.
    @param _boosterId the booster that accepted these Items.
  */
  function unstakeItemsBatch(uint256 _poolId, uint256 _boosterId) external nonReentrant {
    require(itemUserInfo[msg.sender].boosterIds.contains(_boosterId),
        "No stakes.");

    ItemUserInfo storage staker = itemUserInfo[msg.sender];
    PoolInfo storage pool = poolInfo[_poolId];
    UserInfo storage user = userInfo[_poolId][msg.sender];
    address externalContract = boostInfo[_boosterId].contractRequired;

    uint256[] memory _ids = new uint256[](staker.tokenIds[_boosterId].length());
    uint256[] memory _amounts = new uint256[](_ids.length);
    for (uint256 i = 0; i < _ids.length; i++) {
      _ids[i] = staker.tokenIds[_boosterId].at(i);
      _amounts[i] = staker.amounts[_ids[i]];
    }

    if (ISuperGeneric(externalContract).supportsInterface(INTERFACE_ERC721)) {
        ISuperGeneric(externalContract).safeBatchTransferFrom(address(this), _msgSender(), _ids, "");
    } else if (ISuperGeneric(externalContract).supportsInterface(INTERFACE_ERC1155)) {
        ISuperGeneric(externalContract).safeBatchTransferFrom(address(this), _msgSender(), _ids, _amounts, "");
    } else {
        revert("Unsupported Contract.");
    }

    staker.totalItems -= _ids.length;
    for (uint256 i = 0; i <  _ids.length; i++) {
        staker.tokenIds[_boosterId].remove(_ids[i]);
        staker.amounts[_ids[i]] = 0;
    }
    staker.boosterIds.remove(_boosterId);

    totalItemStakes -= _ids.length;

    updatePool(_poolId, 0, 0);
    updateDeposits(0, _poolId, pool, user, 2); // 2 = PlaceHolder

    emit UnstakeItemBatch(msg.sender, _poolId, _boosterId);
  }

  /**
    Allows to get information about tokens staked in a booster for Items staker address.
    @param _itemUserAddress the user address to check.
    @param _boosterId the booster Id to check the tokens staked for.
    @return a struct containing the information.
   */
  function getItemsUserInfo(address _itemUserAddress, uint256 _boosterId) external view returns(GetItemUserInfo memory) {
    
    uint256 length = itemUserInfo[_itemUserAddress].tokenIds[_boosterId].length();
    uint256[] memory _tokenIds = new uint256[](length);
    uint256[] memory _amounts = new uint256[](length);
    for (uint256 i = 0; i < length; i++) {
      _tokenIds[i] = itemUserInfo[_itemUserAddress].tokenIds[_boosterId].at(i);
      _amounts[i] = itemUserInfo[_itemUserAddress].amounts[_tokenIds[i]];
    }

    GetItemUserInfo memory _userInfo = GetItemUserInfo({
      boosterId: _boosterId,
      tokenIds: _tokenIds,
      amounts: _amounts,
      totalItems: itemUserInfo[_itemUserAddress].totalItems
    });
    return _userInfo;
  }

  /**
    Allows the owner of this Staker to grant or remove approval to an external
    spender of the points that users accrue from staking resources.
    @param _spender The external address allowed to spend user points.
    @param _approval The updated user approval status.
  */
  function approvePointSpender(address _spender, bool _approval) external hasValidPermit(UNIVERSAL, APPROVE_POINT_SPENDER) {

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

  function onERC721Received(
      address operator,
      address from,
      uint256 tokenId,
      bytes calldata data
  ) external override returns (bytes4) {

    return this.onERC721Received.selector;
  }

  /**
    This private helper function converts a number into a single-element array.s
    @param _element The element to convert to an array.
    @return The array containing the single `_element`.
  */
  function _asSingletonArray(uint256 _element) private pure
    returns (uint256[] memory) {
    uint256[] memory array = new uint256[](1);
    array[0] = _element;
    return array;
  }
}