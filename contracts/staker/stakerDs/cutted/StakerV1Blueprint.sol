// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Blueprint library for StakerV1.
 * @author Qazawat Zirak
 * This library acts as a blueprint for storage mechanim in the proxy contract.
 * The library defines state variables in form of structs. It also defines the
 * storage location of the variables using KECCAK256 to avoid memory collision.
 * The state is stored in Proxy contract, which does a delegate call.
 * 9th Feb, 2022.
 */
library StakerV1Blueprint {
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
     * This struct defines the state variables for StakerV1Proxy.
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
    struct StakerV1StateVariables {
        address admin;
        mapping(bytes4 => address) implementations;
        address IOUTokenAddress;
        uint256 nextIOUTokenId;
        IERC20 token;
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
        uint256 earliestTokenEmissionTime;
        uint256 earliestPointEmissionTime;
        address[] poolAssets;
        mapping(IERC20 => PoolInfo) poolInfo;
        mapping(IERC20 => mapping(address => UserInfo)) userInfo;
        uint256 totalTokenStrength;
        uint256 totalPointStrength;
        uint256 totalTokenDisbursed;
        mapping(address => uint256) userPoints;
        mapping(address => uint256) userSpentPoints;
        mapping(address => bool) approvedPointSpenders;
        //mapping(uint256 => BoostInfo) boostInfo;
        uint256 activeBoosters;
        mapping(bytes32 => bool) hashes;
        //mapping(address => ItemUserInfo) itemUserInfo;
        uint256 totalItemStakes;
        //mapping(uint256 => StakedAsset) IOUIdToStakedAsset;
        IERC20[] poolTokens;
        string name;
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
     * @param token address of the ERC20 asset that is being staked in the pool.
     * @param tokenStrength the relative token emission strength of this pool.
     * @param tokensPerShare accumulated tokens per share times 1e12.
     * @param pointStrength the relative point emission strength of this pool.
     * @param pointsPerShare accumulated points per share times 1e12.
     * @param lastRewardTime record of the time of the last disbursement.
     */
    struct PoolInfo {
        IERC20 token;
        uint256 tokenStrength;
        uint256 tokensPerShare;
        uint256 pointStrength;
        uint256 pointsPerShare;
        uint256 lastRewardTime;
    }

    /**
     * A struct containing the user info tracked in storage.
     *
     * @param amount amount of the pool asset being provided by the user.
     * @param tokenPaid value of user's total token earnings paid out.
     * pending reward = (user.amount * pool.tokensPerShare) - user.rewardDebt.
     * @param tokenRewards amount of token rewards accumulated to be claimed.
     * @param pointPaid value of user's total point earnings paid out.
     * @param pointRewards amount of point rewards accumulated to be claimed.
     */
    struct UserInfo {
        uint256 amount;
        uint256 tokenRewards;
        uint256 pointRewards;
        uint256 tokenPaid;
        uint256 pointPaid;
    }

    // Storage Locations
    function stakerV1StateVariables()
        internal
        pure
        returns (StakerV1StateVariables storage _StakerV1StateVariables)
    {
        bytes32 storagePosition = keccak256("diamond.storage.StateVariables");
        assembly {
            _StakerV1StateVariables.slot := storagePosition
        }
    }
}
