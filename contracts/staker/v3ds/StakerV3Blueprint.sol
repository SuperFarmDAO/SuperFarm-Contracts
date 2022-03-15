// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title Blueprint library for StakerV3.
 * @author Qazawat Zirak
 * This library acts as a blueprint for storage mechanim in the proxy contract.
 * The library defines state variables in form of structs. It also defines the
 * storage location of the variables using KECCAK256 to avoid memory collision.
 * The state is stored in Proxy contract, which does a delegate call.
 * 9th Feb, 2022.
 */
library StakerV3Blueprint {
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;

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
    bytes4 public constant INTERFACE_ERC721 = 0x80ac58cd;

    /// ERC1155 interface ID to detect external contracts for Items staking.
    bytes4 public constant INTERFACE_ERC1155 = 0xd9b67a26;

    /// @dev A max uint256 value that represents earliest timestamp for quick reference.
    uint256 public constant MAX_INT = 2**256 - 1;

    /**
     * This struct defines the state variables for StakerV3Proxy.
     *
     * @param admin Address of admin user for verify purposes.
     * @param implementation Address of the logic contract corresponding to selector.
     * @param IOUTokenAddress IOU token address.
     * @param nextIOUTokenId The next available ID to be assumed by the next IOUToken minted.
     * @param token Token to disburse to stakers.
     * @param canAlterDevelopers Flag for allowing contract owner to add or set developers.
     * @param developerAddresses Developer addresses for finding shares in the 'developerShares'.
     * @param developerShares A mapping of developer addresses to their percent share of emissions.
     *   Share percentages are represented as 1/1000th of a percent. That is, a 1%
     *   share of emissions should map an address to 1000.
     * @param canAlterTokenEmissionSchedule Flag for allowing contract owner to alter token emissions.
     * @param canAlterPointEmissionSchedule Flag for allowing contract owner to alter point emissions.
     * @param lastPoolId actual pool id.
     * @param tokenEmissionEventsCount The total number of 'EmissionPoint' as token emission events in the schedule.
     * @param pointEmissionEventsCount The total number of 'EmissionPoint' as point emission events in the schedule.
     * @param tokenEmissionEvents Schedule of token 'EmissionPoint' for finding emission rate changes.
     * @param pointEmissionEvents Schedule of point 'EmissionPoint' for finding emission rate changes.
     * @param earliestTokenEmissionEvent Earliest possible token emission timestamp.
     * @param earliestPointEmissionEvent Earliest possible point emission timestamp.
     * @param poolAssets Array for enumeration of the pools.
     * @param poolInfo Mapping of pools to 'PoolInfo' based on their id.
     * @param userInfo Stored information for each user staking in each pool.
     * @param totalTokenStrength The total sum of the token strength of all pools.
     * @param totalPointStrength The total sum of the point strength of all pools.
     * @param totalTokenDisbursed The total amount of the disbursed token ever emitted by this StakerV2.
     * @param userPoints Users additionally accrue non-token points for participating via staking.
     * @param userSpentPoints The amount of points belonging to a user already spent.
     * @param approvedPointSpenders A map of all external addresses that are permitted to spend user points.
     * @param boostInfo Mapping of Booster ID to its 'BoostInfo'.
     * @param activeBoosters Number of boosters that are active.
     * @param hashes Signature hashes created for claim function.
     * @param itemUserInfo Collection of Item stakers.
     * @param totalItemStakes Items staked in this contract.
     */
    struct StakerV3StateVariables {
        address admin;
        mapping(bytes4 => address) implementations;
        address IOUTokenAddress;
        uint256 nextIOUTokenId;
        address token;
        bool canAlterDevelopers;
        EnumerableSet.AddressSet developerAddresses;
        mapping(address => uint256) developerShares;
        bool canAlterTokenEmissionSchedule;
        bool canAlterPointEmissionSchedule;
        uint256 lastPoolId;
        uint256 tokenEmissionEventsCount;
        uint256 pointEmissionEventsCount;
        mapping(uint256 => EmissionPoint) tokenEmissionEvents;
        mapping(uint256 => EmissionPoint) pointEmissionEvents;
        uint256 earliestTokenEmissionEvent;
        uint256 earliestPointEmissionEvent;
        address[] poolAssets;
        mapping(uint256 => PoolInfo) poolInfo;
        mapping(uint256 => mapping(address => UserInfo)) userInfo;
        uint256 totalTokenStrength;
        uint256 totalPointStrength;
        uint256 totalTokenDisbursed;
        mapping(address => uint256) userPoints;
        mapping(address => uint256) userSpentPoints;
        mapping(address => bool) approvedPointSpenders;
        mapping(uint256 => BoostInfo) boostInfo;
        uint256 activeBoosters;
        mapping(bytes32 => bool) hashes;
        mapping(address => ItemUserInfo) itemUserInfo;
        uint256 totalItemStakes;
        mapping(uint256 => StakedAsset) IOUIdToStakedAsset;
    }

    /**
     * This emission schedule maps a timestamp to the amount of tokens or points
     * that should be disbursed starting at that timestamp per-second onwards.
     * @param timeStamp if current time reaches timestamp, the rate is applied.
     * @param rate measure of points or tokens emitted per-second.
     */
    struct EmissionPoint {
        uint256 timeStamp;
        uint256 rate;
    }

    /**
     * A struct containing the pool info.
     * @param tokenStrength the relative token emission strength of this pool.
     * @param tokenBoostedDeposit amount of tokens after boosts are applied.
     * @param tokensPerShare accumulated tokens per share times 1e12.
     * @param pointStrength the relative point emission strength of this pool.
     * @param pointBoostedDeposit amount of points after boosts are applied.
     * @param pointsPerShare accumulated points per share times 1e12.
     * @param lastRewardEvent record of the time of the last disbursement.
     * @param assetAddress address of asset that should be staked into the pool.
     * @param boostInfo boosters applied to the pool rewards when eligible. !Must start with 1!
     *
     * 'tokenBoostedDeposit' and 'pointBoostedDeposit' do not change emission
     * rate, but used to calculate perShare amount when there are boosters.
     */
    struct PoolInfo {
        address assetAddress;
        PoolAssetType typeOfAsset;
        uint256 tokenStrength;
        uint256 tokenBoostedDeposit;
        uint256 tokensPerShare;
        uint256 pointStrength;
        uint256 pointBoostedDeposit;
        uint256 pointsPerShare;
        uint256 lastRewardEvent;
        uint256[] boostInfo;
    }

    /**
     * An auxiliary structure that is used to create or configure an existing pool
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
        PoolAssetType typeOfAsset;
    }

    /**
     * A struct which represents the V, R, S variables of a signature.
     */
    struct Sig {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    /**
     * The structure stores the checkpoints when the user held the NFT
     *
     * @param startTime Beginning of holding
     * @param endTime Ending of holding
     * @param balance Holding balance. 1000 = 1
     */
    struct Checkpoint {
        uint256[] startTime;
        uint256[] endTime;
        uint256[] balance;
    }

    /**
     * A struct containing the Fungible Token Staker information.
     * @param amount amount of the pool asset being provided by the user.
     * @param tokenBoostedAmount tokens amount after boosts are applied.
     * @param pointBoostedAmount points amount after boosts are applied.
     * @param tokenRewards amount of token rewards accumulated to be claimed.
     * @param pointRewards amount of point rewards accumulated to be claimed.
     * @param tokenPaid value of user's total token earnings paid out.
     *   pending reward = (user.amount * pool.tokensPerShare) - user.rewardDebt.
     * @param pointPaid value of user's total point earnings paid out.
     * @param asset The structure stores information about what assets the user has staked
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
     * The type of asset on which the boost is applied.
     * @param Tokens boost is applied on the disburse token.
     * @param Points boost is applied on the points.
     * @param Both boost is applied on both.
     */
    enum BoosterAssetType {
        Tokens,
        Points,
        Both
    }

    /**
     * The type of asset that available to stake in.
     * @param ERC20
     * @param ERC721
     * @param ERC1155
     */
    enum PoolAssetType {
        ERC20,
        ERC721,
        ERC1155
    }

    /**
     * A booster struct, which stores information on the boost requirements.
     * @param multiplier the rate which will act as a boost on basis points.
     *   A multiplier of Zero means, the booster is not set.
     * @param amountRequired number of Items required from the contract.
     * @param groupRequired (optional) specifies a group from Items contract
     *   as requirement for the boost. If 0, then any group or item.
     * @param contractRequired contract that the required assets belong to.
     * @param assetType enum that specifies Tokens/Points to boost or both.
     */
    struct BoostInfo {
        uint256 multiplier;
        uint256 amountRequired;
        uint256 groupRequired;
        address contractRequired;
        BoosterAssetType assetType;
        PoolAssetType typeOfAsset;
    }

    /**
     * The structure stores information about what assets the user has staked
     * @param assetAddress Address of asset
     * @param id Array of id's
     * @param amounts Array of amounts
     * @param IOUTokenId Arrays of id's of IOUtoken
     */
    struct StakedAsset {
        address assetAddress;
        uint256[] id;
        uint256[] amounts;
        uint256[] IOUTokenId;
    }

    /**
     * A struct containing the Items staker information.
     * @param totalItems total Items staked in this contract by Items staker.
     * @param tokenIds actual ids of tokens mapped to booster Id.
     * @param amounts amount of Items per tokenId.
     * @param boosterIds enumerable booster Ids the user has staked Items in.
     *
     * Contract address at the time of unstaking is retreived from boostInfo.
     */
    struct ItemUserInfo {
        uint256 totalItems;
        mapping(uint256 => EnumerableSet.UintSet) tokenIds;
        mapping(uint256 => uint256) amounts;
        EnumerableSet.UintSet boosterIds;
    }

    /**
     * A struct as return parameter to get token Ids against a booster Id of
     * a staker. Needed since EnumerableSets cannot have getters by default.
     * @param boostersIds the booster Id to check the Items for.
     * @param tokenIds the token Ids that are staked in that booster.
     * @param amounts amount per token Id staked in a booster.
     * @param totalItems total Items staked in this contract by Items staker.
     */
    struct GetItemUserInfo {
        uint256 boosterId;
        uint256[] tokenIds;
        uint256[] amounts;
        uint256 totalItems;
    }

    // Storage Locations
    function stakerV3StateVariables()
        internal
        pure
        returns (StakerV3StateVariables storage _stakerV3StateVariables)
    {
        bytes32 storagePosition = keccak256("diamond.storage.StateVariables");
        assembly {
            _stakerV3StateVariables.slot := storagePosition
        }
    }
}
