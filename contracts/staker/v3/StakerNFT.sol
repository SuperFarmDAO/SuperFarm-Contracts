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
  @author Nikita Elunin
  This staking contract disburses tokens from its internal reservoir according
  to a fixed emission schedule. Assets can be assigned varied staking weights.
  It also supports Items staking for boosts on native ERC20 staking rewards.
  The item staking supports Fungible, Non-Fungible and Semi-Fungible staking.
  This code is inspired by and modified from Sushi's Master Chef contract.
  https://github.com/sushiswap/sushiswap/blob/master/contracts/MasterChef.sol
*/
contract StakerNFT is
    Sweepable,
    ReentrancyGuard,
    IERC721Receiver,
    ERC1155Holder
{
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    /// The public identifier for the right to add developer.
    bytes32 public constant ADD_DEVELOPER = keccak256("ADD_DEVELOPER");

    /// The public identifier for the right to lock developers.
    bytes32 public constant LOCK_DEVELOPERS = keccak256("LOCK_DEVELOPERS");

    /// The public identifier for the right to set emissions.
    bytes32 public constant SET_EMISSIONS = keccak256("SET_EMISSIONS");

    /// The public identifier for the right to lock token emissions.
    bytes32 public constant LOCK_TOKEN_EMISSIONS =
        keccak256("LOCK_TOKEN_EMISSIONS");

    /// The public identifier for the right to lock point emissions.
    bytes32 public constant LOCK_POINT_EMISSIONS =
        keccak256("LOCK_POINT_EMISSIONS");

    /// The public identifier for the right to configure boosters.
    bytes32 public constant CONFIGURE_BOOSTERS =
        keccak256("CONFIGURE_BOOSTERS");

    /// The public identifier for the right to add pools.
    bytes32 public constant ADD_POOL = keccak256("ADD_POOL");

    /// The public identifier for the right to approve point spender.
    bytes32 public constant APPROVE_POINT_SPENDER =
        keccak256("APPROVE_POINT_SPENDER");

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
    mapping(address => uint256) public developerShares;

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

    // actual pool id
    uint256 lastPoolId;

    /// The total number of 'EmissionPoint' as token emission events in the schedule.
    uint256 public tokenEmissionEventsCount;

    /// The total number of 'EmissionPoint' as point emission events in the schedule.
    uint256 public pointEmissionEventsCount;

    /// Schedule of token 'EmissionPoint' for finding emission rate changes.
    mapping(uint256 => EmissionPoint) public tokenEmissionEvents;

    /// Schedule of point 'EmissionPoint' for finding emission rate changes.
    mapping(uint256 => EmissionPoint) public pointEmissionEvents;

    /// @dev A max uint256 value that represents earliest timestamp for quick reference.
    // uint256 private MAX_INT = 2**256 - 1;

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
    @param boostInfo boosters applied to the pool rewards when eligible. !Must start with 1!

    'tokenBoostedDeposit' and 'pointBoostedDeposit' do not change emission
    rate, but used to calculate perShare amount when there are boosters.
  */
    struct PoolInfo {
        uint256 tokenStrength;
        uint256 tokenBoostedDeposit;
        uint256 tokensPerShare;
        uint256 pointStrength;
        uint256 pointBoostedDeposit;
        uint256 pointsPerShare;
        uint256 lastRewardEvent;
        address assetAddress;
        uint256[] boostInfo;
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
        address assetAddress;
    }

    /// Array for enumeration of the pools.
    address[] public poolAssets;

    /// Mapping of pools to 'PoolInfo' based on their id.
    mapping(uint256 => PoolInfo) public poolInfo;

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
    @param balance Holding balance. 1000 = 1
   */
    struct Checkpoint {
        uint256[] startTime;
        uint256[] endTime;
        uint256[] balance;
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
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    /// The total sum of the token strength of all pools.
    uint256 public totalTokenStrength;

    /// The total sum of the point strength of all pools.
    uint256 public totalPointStrength;

    /// The total amount of the disbursed token ever emitted by this StakerV2.
    uint256 public totalTokenDisbursed;

    /// Users additionally accrue non-token points for participating via staking.
    mapping(address => uint256) public userPoints;

    /// The amount of points belonging to a user already spent.
    mapping(address => uint256) public userSpentPoints;

    /// A map of all external addresses that are permitted to spend user points.
    mapping(address => bool) public approvedPointSpenders;

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
    mapping(uint256 => BoostInfo) public boostInfo;

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

    mapping(bytes32 => bool) hashes;

    /// Collection of Item stakers
    mapping(address => ItemUserInfo) private itemUserInfo;

    /// Items staked in this contract.
    uint256 public totalItemStakes;

    /// Event for depositing NonFungible assets.
    event Deposit(
        address indexed user,
        uint256 indexed _poolId,
        uint256[] amount,
        uint256[] itemIds,
        address collection
    );

    /// Event for withdrawing NonFungible assets.
    event Withdraw(
        address indexed user,
        uint256 indexed _poolId,
        uint256[] amount,
        uint256[] itemIds,
        address collection
    );

    /// Event for claiming rewards from Fungible assets.
    event Claim(
        address indexed user,
        uint256 indexed _poolId,
        uint256 tokenRewards,
        uint256 pointRewards
    );

    /// Event for staking non fungible items for boosters.
    event StakeItemBatch(
        address indexed user,
        uint256 indexed _poolId,
        uint256 boosterId
    );

    /// Event for unstaking non fungible items from boosters.
    event UnstakeItemBatch(
        address indexed user,
        uint256 indexed _poolId,
        uint256 boosterId
    );

    /// An event for tracking when a user has spent points.
    event SpentPoints(
        address indexed source,
        address indexed user,
        uint256 amount
    );

    /**
    Deploy a new StakerV2 contract with a name and the token to disburse.
    @param _token the token to reward stakers in this contract with.
  */
    constructor(
        address _owner,
        address _token,
        address _admin,
        address _IOUTokenAddress
    ) {
        if (_owner != owner()) {
            transferOwnership(_owner);
        }

        IOUTokenAddress = _IOUTokenAddress;
        admin = _admin;
        token = _token;
        canAlterDevelopers = true;
        canAlterTokenEmissionSchedule = true;
        canAlterPointEmissionSchedule = true;
        earliestTokenEmissionEvent = 2**256 - 1;
        earliestPointEmissionEvent = 2**256 - 1;
    }

    /**
    Add a new developer to the StakerV2 or overwrite an existing one.
    This operation requires that developer address addition is not locked.
    @param _developerAddress the additional developer's address.
    @param _share the share in 1/1000th of a percent of each token emission sent
      to this new developer.
  */
    function addDeveloper(address _developerAddress, uint256 _share)
        external
        hasValidPermit(UNIVERSAL, ADD_DEVELOPER)
    {
        require(canAlterDevelopers, "0x1A");
        developerAddresses.push(_developerAddress);
        developerShares[_developerAddress] = _share;
    }

    /**
    Permanently forfeits owner ability to alter the state of StakerV2 developers.
    Once called, this function is intended to give peace of mind to the StakerV2's
    developers and community that the fee structure is now immutable.
  */
    function lockDevelopers()
        external
        hasValidPermit(UNIVERSAL, LOCK_DEVELOPERS)
    {
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
    function updateDeveloper(address _newDeveloperAddress, uint256 _newShare)
        external
    {
        uint256 developerShare = developerShares[msg.sender];
        require(developerShare > 0, "0x2A");
        require(_newShare <= developerShare, "0x3A");
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
    function setEmissions(
        EmissionPoint[] memory _tokenSchedule,
        EmissionPoint[] memory _pointSchedule
    ) external hasValidPermit(UNIVERSAL, SET_EMISSIONS) {
        if (_tokenSchedule.length > 0) {
            require(canAlterTokenEmissionSchedule, "0x1B");
            tokenEmissionEventsCount = _tokenSchedule.length;
            for (uint256 i = 0; i < tokenEmissionEventsCount; i++) {
                tokenEmissionEvents[i] = _tokenSchedule[i];
                if (earliestTokenEmissionEvent > _tokenSchedule[i].timeStamp) {
                    earliestTokenEmissionEvent = _tokenSchedule[i].timeStamp;
                }
            }
        }
        require(tokenEmissionEventsCount > 0, "0x2B");

        if (_pointSchedule.length > 0) {
            require(canAlterPointEmissionSchedule, "0x3B");
            pointEmissionEventsCount = _pointSchedule.length;
            for (uint256 i = 0; i < pointEmissionEventsCount; i++) {
                pointEmissionEvents[i] = _pointSchedule[i];
                if (earliestPointEmissionEvent > _pointSchedule[i].timeStamp) {
                    earliestPointEmissionEvent = _pointSchedule[i].timeStamp;
                }
            }
        }
        require(pointEmissionEventsCount > 0, "0x4B");
    }

    /**
    Permanently forfeits owner ability to alter the emission schedule.
    Once called, this function is intended to give peace of mind to the StakerV2's
    developers and community that the inflation rate is now immutable.
  */
    function lockTokenEmissions()
        external
        hasValidPermit(UNIVERSAL, LOCK_TOKEN_EMISSIONS)
    {
        canAlterTokenEmissionSchedule = false;
    }

    /**
    Permanently forfeits owner ability to alter the emission schedule.
    Once called, this function is intended to give peace of mind to the StakerV2's
    developers and community that the inflation rate is now immutable.
  */
    function lockPointEmissions()
        external
        hasValidPermit(UNIVERSAL, LOCK_POINT_EMISSIONS)
    {
        canAlterPointEmissionSchedule = false;
    }

    /**
    Returns the length of the staking pool array.
    @return the length of the staking pool array.
  */
    function getPoolCount() external view returns (uint256) {
        return poolAssets.length;
    }

    /** 
    Create or edit boosters in batch with boost parameters
    @param _ids array of booster IDs.
    @param _boostInfo array of boostInfo.

    Should not be reconfigured if it was made public for staking Items.
  */
    function configureBoostersBatch(
        uint256[] memory _ids,
        BoostInfo[] memory _boostInfo
    ) external hasValidPermit(UNIVERSAL, CONFIGURE_BOOSTERS) {
        require(_boostInfo.length > 0, "0x1C");
        require(_ids.length == _boostInfo.length, "0x1Z");

        for (uint256 i = 0; i < _boostInfo.length; i++) {
            require(
                _boostInfo[i].multiplier != 0 ||
                    _boostInfo[i].amountRequired != 0 ||
                    _boostInfo[i].contractRequired != address(0),
                "0x1C"
            );

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
    function addPool(AddPoolStruct memory _addPoolStruct)
        external
        hasValidPermit(UNIVERSAL, ADD_POOL)
    {
        require(
            tokenEmissionEventsCount > 0 && pointEmissionEventsCount > 0,
            "0x1D"
        );
        require(address(_addPoolStruct.assetAddress) != address(token), "0x2D");
        require(
            _addPoolStruct.tokenStrength > 0 &&
                _addPoolStruct.pointStrength > 0,
            "0x3D"
        );

        uint256 lastTokenRewardTime = block.timestamp >
            earliestTokenEmissionEvent
            ? block.timestamp
            : earliestTokenEmissionEvent;
        uint256 lastPointRewardTime = block.timestamp >
            earliestPointEmissionEvent
            ? block.timestamp
            : earliestPointEmissionEvent;
        uint256 lastRewardEvent = lastTokenRewardTime > lastPointRewardTime
            ? lastTokenRewardTime
            : lastPointRewardTime;
        if (address(poolInfo[_addPoolStruct.id].assetAddress) == address(0)) {
            poolAssets.push(_addPoolStruct.assetAddress);
            totalTokenStrength =
                totalTokenStrength +
                _addPoolStruct.tokenStrength;
            totalPointStrength =
                totalPointStrength +
                _addPoolStruct.pointStrength;
            poolInfo[_addPoolStruct.id] = PoolInfo({
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
            lastPoolId++;
        } else {
            totalTokenStrength =
                (totalTokenStrength -
                    poolInfo[_addPoolStruct.id].tokenStrength) +
                _addPoolStruct.tokenStrength;
            poolInfo[_addPoolStruct.id].tokenStrength = _addPoolStruct
                .tokenStrength;
            totalPointStrength =
                (totalPointStrength -
                    poolInfo[_addPoolStruct.id].pointStrength) +
                _addPoolStruct.pointStrength;
            poolInfo[_addPoolStruct.id].pointStrength = _addPoolStruct
                .pointStrength;

            // Append boosters by avoid writing to storage directly in a loop to avoid costs
            uint256[] memory boosters = new uint256[](
                poolInfo[_addPoolStruct.id].boostInfo.length +
                    _addPoolStruct.boostInfo.length
            );
            for (
                uint256 i = 0;
                i < poolInfo[_addPoolStruct.id].boostInfo.length;
                i++
            ) {
                boosters[i] = poolInfo[_addPoolStruct.id].boostInfo[i];
            }
            for (uint256 i = 0; i < _addPoolStruct.boostInfo.length; i++) {
                boosters[
                    i + poolInfo[_addPoolStruct.id].boostInfo.length
                ] = _addPoolStruct.boostInfo[i];
            }
            PoolInfo storage pool = poolInfo[_addPoolStruct.id];
            pool.boostInfo = boosters; // Appended boosters
        }
    }

    /**
    Uses the emission schedule to calculate the total amount of staking reward
    token that was emitted between two specified timestamps.
    @param _fromTime the time to begin calculating emissions from.
    @param _toTime the time to calculate total emissions up to.
  */
    function getTotalEmittedTokens(uint256 _fromTime, uint256 _toTime)
        internal
        view
        returns (uint256)
    {
        require(_toTime > _fromTime, "0x1Z");
        uint256 totalEmittedTokens = 0;
        uint256 workingRate = 0;
        uint256 workingTime = _fromTime;
        uint256 tokenEmissionEventsCountMemory = tokenEmissionEventsCount;
        for (uint256 i = 0; i < tokenEmissionEventsCountMemory; ++i) {
            uint256 emissionTime = tokenEmissionEvents[i].timeStamp;
            uint256 emissionRate = tokenEmissionEvents[i].rate;
            if (_toTime < emissionTime) {
                totalEmittedTokens =
                    totalEmittedTokens +
                    ((_toTime - workingTime) * workingRate);
                return totalEmittedTokens;
            } else if (workingTime < emissionTime) {
                totalEmittedTokens =
                    totalEmittedTokens +
                    ((emissionTime - workingTime) * workingRate);
                workingTime = emissionTime;
            }
            workingRate = emissionRate;
        }
        if (workingTime < _toTime) {
            totalEmittedTokens =
                totalEmittedTokens +
                ((_toTime - workingTime) * workingRate);
        }
        return totalEmittedTokens;
    }

    /**
    Uses the emission schedule to calculate the total amount of points
    emitted between two specified timestamps.
    @param _fromTime the time to begin calculating emissions from.
    @param _toTime the time to calculate total emissions up to.
  */
    function getTotalEmittedPoints(uint256 _fromTime, uint256 _toTime)
        public
        view
        returns (uint256)
    {
        require(_toTime > _fromTime, "0x1Z");
        uint256 totalEmittedPoints = 0;
        uint256 workingRate = 0;
        uint256 workingTime = _fromTime;
        uint256 pointEmissionEventsCountMemory = pointEmissionEventsCount;
        for (uint256 i = 0; i < pointEmissionEventsCountMemory; ++i) {
            uint256 emissionTime = pointEmissionEvents[i].timeStamp;
            uint256 emissionRate = pointEmissionEvents[i].rate;
            if (_toTime < emissionTime) {
                totalEmittedPoints =
                    totalEmittedPoints +
                    ((_toTime - workingTime) * workingRate);
                return totalEmittedPoints;
            } else if (workingTime < emissionTime) {
                totalEmittedPoints =
                    totalEmittedPoints +
                    ((emissionTime - workingTime) * workingRate);
                workingTime = emissionTime;
            }
            workingRate = emissionRate;
        }
        if (workingTime < _toTime) {
            totalEmittedPoints =
                totalEmittedPoints +
                ((_toTime - workingTime) * workingRate);
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
    function getPendingTokens(uint256 _id, address _user)
        public
        view
        returns (uint256)
    {
        PoolInfo memory pool = poolInfo[_id];
        UserInfo memory user = userInfo[_id][_user];
        uint256 tokensPerShare = pool.tokensPerShare;
        uint256 tokenBoostedDeposit = pool.tokenBoostedDeposit;

        if (block.timestamp > pool.lastRewardEvent && tokenBoostedDeposit > 0) {
            uint256 totalEmittedTokens = getTotalEmittedTokens(
                pool.lastRewardEvent,
                block.timestamp
            );
            uint256 tokensReward = ((totalEmittedTokens * pool.tokenStrength) /
                totalTokenStrength) * 1e12;
            tokensPerShare =
                tokensPerShare +
                (tokensReward / tokenBoostedDeposit);
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
    function getPendingPoints(uint256 _id, address _user)
        public
        view
        returns (uint256)
    {
        PoolInfo memory pool = poolInfo[_id];
        UserInfo memory user = userInfo[_id][_user];
        uint256 pointsPerShare = pool.pointsPerShare;
        uint256 pointBoostedDeposit = pool.pointBoostedDeposit;

        if (block.timestamp > pool.lastRewardEvent && pointBoostedDeposit > 0) {
            uint256 totalEmittedPoints = getTotalEmittedPoints(
                pool.lastRewardEvent,
                block.timestamp
            );
            uint256 pointsReward = ((totalEmittedPoints * pool.pointStrength) /
                totalPointStrength) * 1e30;
            pointsPerShare =
                pointsPerShare +
                (pointsReward / pointBoostedDeposit);
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
        for (uint256 i = 0; i < lastPoolId; ++i) {
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
        for (uint256 i = 0; i < lastPoolId; ++i) {
            uint256 _pendingPoints = getPendingPoints(i, _user);
            pendingTotal = pendingTotal + _pendingPoints;
        }
        return concreteTotal + pendingTotal;
    }

    function genericTransfer(
        address _from,
        address _to,
        address _assetAddress,
        uint256[] memory _ids,
        uint256[] memory _amounts
    ) internal returns (bool) {
        bool isErc721 = ISuperGeneric(_assetAddress).supportsInterface(
            INTERFACE_ERC721
        )
            ? true
            : false;
        if (!isErc721) {
            ISuperGeneric(_assetAddress).safeBatchTransferFrom(
                _from,
                _to,
                _ids,
                _amounts,
                ""
            );
            return true;
        } else if (isErc721) {
            ISuperGeneric(_assetAddress).safeBatchTransferFrom(
                _from,
                _to,
                _ids,
                ""
            );
            return true;
        }
        return false;
    }

    /**
    Update the pool corresponding to the specified token address.
    @param _id the id of pool to update the corresponding pool for.
  */
    function updatePool(uint256 _id) internal {
        PoolInfo storage pool = poolInfo[_id];
        if (block.timestamp <= pool.lastRewardEvent) {
            return;
        }

        uint256 poolTokenSupply = ISuperGeneric(pool.assetAddress).balanceOf(
            address(this)
        );
        if (poolTokenSupply <= 0) {
            pool.lastRewardEvent = block.timestamp;
            return;
        }

        // Calculate token and point rewards for this pool.
        uint256 totalEmittedTokens = getTotalEmittedTokens(
            pool.lastRewardEvent,
            block.timestamp
        );
        uint256 tokensReward = ((totalEmittedTokens * pool.tokenStrength) /
            totalTokenStrength) * 1e12;
        uint256 totalEmittedPoints = getTotalEmittedPoints(
            pool.lastRewardEvent,
            block.timestamp
        );
        uint256 pointsReward = ((totalEmittedPoints * pool.pointStrength) /
            totalPointStrength) * 1e30;

        // Directly pay developers their corresponding share of tokens and points.
        uint256 developerAddressLength = developerAddresses.length;
        for (uint256 i = 0; i < developerAddressLength; ++i) {
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
        pool.tokensPerShare =
            pool.tokensPerShare +
            (tokensReward / poolInfo[_id].tokenBoostedDeposit);
        pool.pointsPerShare =
            pool.pointsPerShare +
            (pointsReward / poolInfo[_id].pointBoostedDeposit);
        pool.lastRewardEvent = block.timestamp;
    }

    /**
    Private helper function to update the deposits based on new shares.
    @param _amount base amount of the new boosted amounts.
    @param _poolId the pool id, the deposit of which is to be updated.
    @param _isDeposit flag that represents the caller function. 0 is for deposit,
      1 is for withdraw, other value represents no amount update.
   */
    function updateDeposits(
        uint256 _amount,
        uint256 _poolId,
        uint8 _isDeposit
    ) private {
        PoolInfo storage _pool = poolInfo[_poolId];
        UserInfo storage _user = userInfo[_poolId][msg.sender];
        if (_user.amount > 0) {
            uint256 pendingTokens = ((_user.tokenBoostedAmount *
                _pool.tokensPerShare) / 1e12) - _user.tokenPaid;
            uint256 pendingPoints = ((_user.pointBoostedAmount *
                _pool.pointsPerShare) / 1e30) - _user.pointPaid;
            _user.tokenRewards += pendingTokens / 1000;
            _user.pointRewards += pendingPoints / 1000;
            totalTokenDisbursed = totalTokenDisbursed + pendingTokens;
            _pool.tokenBoostedDeposit -= _user.tokenBoostedAmount;
            _pool.pointBoostedDeposit -= _user.pointBoostedAmount;
        }

        if (_isDeposit == 0) {
            // Flag for Deposit
            _user.amount += _amount * 1000;
        } else if (_isDeposit == 1) {
            // Flag for Withdraw
            _user.amount -= _amount * 1000;
        }

        _user.tokenBoostedAmount = applyBoosts(_user.amount, _poolId, true);
        _user.pointBoostedAmount = applyBoosts(_user.amount, _poolId, false);
        _pool.tokenBoostedDeposit += _user.tokenBoostedAmount;
        _pool.pointBoostedDeposit += _user.pointBoostedAmount;

        _user.tokenPaid =
            (_user.tokenBoostedAmount * _pool.tokensPerShare) /
            1e12;
        _user.pointPaid =
            (_user.pointBoostedAmount * _pool.pointsPerShare) /
            1e30;
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
    function applyBoosts(
        uint256 _unboosted,
        uint256 _id,
        bool _isToken
    ) internal view returns (uint256 _boosted) {
        PoolInfo memory pool = poolInfo[_id];
        ItemUserInfo storage staker = itemUserInfo[msg.sender];

        if (_unboosted <= 0) {
            return 0;
        } else if (pool.boostInfo.length == 0) {
            return _unboosted;
        } else if (staker.boosterIds.length() == 0) {
            return _unboosted;
        }

        _boosted = _unboosted;
        BoostInfo memory booster;

        // Iterate through all the boosters that the pool supports
        for (uint256 i = 0; i < pool.boostInfo.length; i++) {
            booster = boostInfo[pool.boostInfo[i]];
            if (staker.boosterIds.contains(pool.boostInfo[i])) {
                if (booster.assetType == BoosterAssetType.Tokens && _isToken) {
                    _boosted += (_unboosted * booster.multiplier) / 10000;
                } else if (
                    booster.assetType == BoosterAssetType.Points && !_isToken
                ) {
                    _boosted += (_unboosted * booster.multiplier) / 10000;
                } else if (booster.assetType == BoosterAssetType.Both) {
                    _boosted += (_unboosted * booster.multiplier) / 10000;
                }
            }
        }
    }

    /**
    Deposit some particular assets to a particular pool on the Staker.
    @param _poolId the pool id.
    @param _asset asset user wants to deposit
  */
    function deposit(
        uint256 _poolId,
        uint256 _boosterId,
        StakedAsset memory _asset
    ) external nonReentrant {
        PoolInfo memory pool = poolInfo[_poolId];
        if (_boosterId != 0) {
            bool exists;
            for (uint256 i = 0; i < pool.boostInfo.length; i++) {
                if (pool.boostInfo[i] == _boosterId) {
                    exists = true;
                    break;
                }
            }
            require(
                exists &&
                    eligible(
                        _asset.id,
                        _asset.amounts,
                        _asset.assetAddress,
                        _boosterId
                    ),
                "0x4Z"
            );

            ItemUserInfo storage staker = itemUserInfo[msg.sender];
            staker.totalItems += _asset.id.length;
            for (uint256 i = 0; i < _asset.id.length; i++) {
                staker.tokenIds[_boosterId].add(_asset.id[i]);
                staker.amounts[_asset.id[i]] += _asset.amounts[i];
            }
            staker.boosterIds.add(_boosterId);

            totalItemStakes += _asset.id.length;
            updatePool(_poolId);
            updateDeposits(0, _poolId, 2); // 2 = PlaceHolder
            emit StakeItemBatch(msg.sender, _poolId, _boosterId);
        } else {
            require(pool.tokenStrength > 0 || pool.pointStrength > 0, "0x1E");
            UserInfo storage user = userInfo[_poolId][msg.sender];
            uint256 amount;

            for (uint256 i = 0; i < _asset.amounts.length; i++) {
                amount += _asset.amounts[i];
                user.asset.amounts.push(_asset.amounts[i]);
                user.asset.id.push(_asset.id[i]);
                user.asset.IOUTokenId.push(nextIOUTokenId);
                nextIOUTokenId++;
            }
            ISuperGeneric(IOUTokenAddress).mintBatch(
                msg.sender,
                _asset.IOUTokenId,
                ""
            );
            // user.asset = _asset;
            updatePool(_poolId);
            updateDeposits(amount, _poolId, 0);
            emit Deposit(
                msg.sender,
                _poolId,
                _asset.amounts,
                _asset.id,
                pool.assetAddress
            );
        }
        require(
            genericTransfer(
                msg.sender,
                address(this),
                _asset.assetAddress,
                _asset.id,
                _asset.amounts
            ),
            "0x9E"
        );
    }

    /**
    Withdraw some particular assets from a particular pool on the Staker.
    @param _poolId the id of pool, withdraw tokens from.
    @param _asset asset user wants to withdraw
  */
    function withdraw(
        uint256 _poolId,
        StakedAsset memory _asset,
        uint256 _boosterId
    ) external nonReentrant {
        address transferAddress;
        uint256[] memory ids;
        uint256[] memory amounts;
        if (_boosterId != 0) {
            require(
                itemUserInfo[msg.sender].boosterIds.contains(_boosterId),
                "0x1G"
            );
            ItemUserInfo storage staker = itemUserInfo[msg.sender];

            uint256[] memory _ids = new uint256[](
                staker.tokenIds[_boosterId].length()
            );
            uint256[] memory _amounts = new uint256[](_ids.length);
            for (uint256 i = 0; i < _ids.length; i++) {
                _ids[i] = staker.tokenIds[_boosterId].at(i);
                _amounts[i] = staker.amounts[_ids[i]];
            }
            transferAddress = boostInfo[_boosterId].contractRequired;
            ids = _ids;
            amounts = _amounts;

            staker.totalItems -= _ids.length;
            for (uint256 i = 0; i < _ids.length; i++) {
                staker.tokenIds[_boosterId].remove(_ids[i]);
                staker.amounts[_ids[i]] = 0;
            }
            staker.boosterIds.remove(_boosterId);

            totalItemStakes -= _ids.length;
            updatePool(_poolId);
            updateDeposits(0, _poolId, 2);
        } else {
            PoolInfo storage pool = poolInfo[_poolId];
            UserInfo storage user = userInfo[_poolId][msg.sender];
            uint256 amount;
            for (uint256 i = 0; i < _asset.amounts.length; i++) {
                amount += _asset.amounts[i];
            }
            require(user.amount / 1000 >= amount, "0x1Z");

            // pool.token.safeTransfer(msg.sender, _amount);
            require(
                ISuperGeneric(IOUTokenAddress).balanceOf(msg.sender) > 0,
                "0x2E"
            );
            transferAddress = pool.assetAddress;
            ids = user.asset.id;
            amounts = user.asset.amounts;

            ISuperGeneric(IOUTokenAddress).burnBatch(
                msg.sender,
                user.asset.IOUTokenId
            );
            updatePool(_poolId);
            updateDeposits(amount, _poolId, 1);

            emit Withdraw(
                msg.sender,
                _poolId,
                user.asset.amounts,
                user.asset.id,
                pool.assetAddress
            );
            delete user.asset;
        }

        require(
            genericTransfer(
                address(this),
                msg.sender,
                transferAddress,
                ids,
                amounts
            ),
            "0x9E"
        );
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

        updatePool(_id);
        if (user.amount > 0) {
            pendingTokens =
                ((user.tokenBoostedAmount * pool.tokensPerShare) / 1e12) -
                user.tokenPaid;
            pendingPoints =
                ((user.pointBoostedAmount * pool.pointsPerShare) / 1e30) -
                user.pointPaid;
            totalTokenDisbursed = totalTokenDisbursed + pendingTokens;
        }
        uint256 _tokenRewards = user.tokenRewards + pendingTokens / 1000;
        uint256 _pointRewards = user.pointRewards + pendingPoints / 1000;
        IERC20(token).safeTransfer(msg.sender, _tokenRewards);
        userPoints[msg.sender] = userPoints[msg.sender] + _pointRewards;
        user.tokenRewards = 0;
        user.pointRewards = 0;

        user.tokenPaid =
            ((user.tokenBoostedAmount * pool.tokensPerShare) / 1e12) /
            1000;
        user.pointPaid =
            ((user.pointBoostedAmount * pool.pointsPerShare) / 1e30) /
            1000;
        emit Claim(msg.sender, _id, _tokenRewards, _pointRewards);
    }

    /**
    Claim accumulated token and point rewards from the Staker.
    @param _id The id of pool to claim rewards from.
    @param _checkpoints Information about what time intervals to count rewards
   */
    function claim(
        uint256 _id,
        bytes32 _hash,
        Sig calldata sig,
        Checkpoint memory _checkpoints
    ) external {
        require(_checkpoints.startTime.length == _checkpoints.endTime.length);
        UserInfo storage user = userInfo[_id][msg.sender];
        PoolInfo storage pool = poolInfo[_id];

        uint256 pendingTokens;
        uint256 pendingPoints;

        require(admin == ecrecover(_hash, sig.v, sig.r, sig.s), "0x1F");

        require(
            keccak256(
                abi.encodePacked(
                    keccak256(abi.encode(_checkpoints.startTime)),
                    keccak256(abi.encode(_checkpoints.endTime)),
                    keccak256(abi.encode(_checkpoints.balance))
                )
            ) == _hash,
            "0x2F"
        );

        require(!hashes[_hash], "0x3F");

        for (uint256 i = 0; i < _checkpoints.startTime.length; i++) {
            pendingTokens =
                pendingTokens +
                (((_checkpoints.balance[i] * pool.tokensPerShare) / 1e12));
            pendingPoints =
                pendingPoints +
                (((_checkpoints.balance[i] * pool.pointsPerShare) / 1e30));

            // TODO: user.tokenPaid maybe should calculate here.
        }
        pendingTokens = pendingTokens - user.tokenPaid;
        pendingPoints = pendingPoints - user.pointPaid;
        totalTokenDisbursed = totalTokenDisbursed + pendingTokens;

        uint256 _tokenRewards = user.tokenRewards + pendingTokens;
        uint256 _pointRewards = user.pointRewards + pendingPoints;
        IERC20(token).safeTransfer(msg.sender, _tokenRewards);
        userPoints[msg.sender] = userPoints[msg.sender] + _pointRewards;
        user.tokenRewards = 0;
        user.pointRewards = 0;
        hashes[_hash] = true;
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
    function eligible(
        uint256[] memory _ids,
        uint256[] memory _amounts,
        address _contract,
        uint256 _boosterId
    ) private view returns (bool) {
        BoostInfo memory booster = boostInfo[_boosterId];
        uint256 totalAmount = 0;

        for (uint256 i = 0; i < _amounts.length; i++) {
            totalAmount += _amounts[i];
        }
        if (booster.multiplier == 0) {
            // Inactive
            return false;
        } else if (_contract != booster.contractRequired) {
            // Different contract
            return false;
        } else if (totalAmount < booster.amountRequired) {
            // Insufficient amount
            return false;
        } else if (booster.groupRequired != 0) {
            for (uint256 i = 0; i < _ids.length; i++) {
                if (_ids[i] >> 128 != booster.groupRequired) {
                    // Wrong group item
                    return false;
                }
            }
        }
        return true;
    }

    /**
    Allows to get information about tokens staked in a booster for Items staker address.
    @param _itemUserAddress the user address to check.
    @param _boosterId the booster Id to check the tokens staked for.
    @return a struct containing the information.
   */
    function getItemsUserInfo(address _itemUserAddress, uint256 _boosterId)
        external
        view
        returns (GetItemUserInfo memory)
    {
        uint256 length = itemUserInfo[_itemUserAddress]
            .tokenIds[_boosterId]
            .length();
        uint256[] memory _tokenIds = new uint256[](length);
        uint256[] memory _amounts = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            _tokenIds[i] = itemUserInfo[_itemUserAddress]
                .tokenIds[_boosterId]
                .at(i);
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
    function approvePointSpender(address _spender, bool _approval)
        external
        hasValidPermit(UNIVERSAL, APPROVE_POINT_SPENDER)
    {
        approvedPointSpenders[_spender] = _approval;
    }

    /**
    Allows an approved spender of points to spend points on behalf of a user.
    @param _user The user whose points are being spent.
    @param _amount The amount of the user's points being spent.
  */
    function spendPoints(address _user, uint256 _amount) external {
        require(approvedPointSpenders[msg.sender], "0x3E");
        // uint256 _userPoints = getAvailablePoints(_user);
        require(getAvailablePoints(_user) >= _amount, "0x4E");
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
}
