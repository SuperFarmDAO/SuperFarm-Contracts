// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../../../base/Sweepableds.sol";
import "../../../interfaces/ISuperGeneric.sol";
// import "../../assets/erc721/interfaces/ISuper721.sol";

import "../StakerBlueprint.sol";

/**
 * @title An asset staking contract.
 * @author Tim Clancy
 * @author Qazawat Zirak
 * @author Nikita Elunin
 * This staking contract disburses tokens from its internal reservoir according
 * to a fixed emission schedule. Assets can be assigned varied staking weights.
 * It also supports Items staking for boosts on native ERC20 staking rewards.
 * The item staking supports Fungible, Non-Fungible and Semi-Fungible staking.
 * This code is inspired by and modified from Sushi's Master Chef contract.
 * https://github.com/sushiswap/sushiswap/blob/master/contracts/MasterChef.sol
 */
contract StakerV2FacetStaking is Sweepableds, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;

    /// Event for depositing NonFungible assets.
    event Deposit(address indexed user, IERC20 indexed token, uint256 amount);

    /// Event for withdrawing NonFungible assets.
    event Withdraw(address indexed user, IERC20 indexed token, uint256 amount);

    /// Event for claiming rewards from Fungible assets.
    event Claim(
        address indexed user,
        IERC20 indexed token,
        uint256 tokenRewards,
        uint256 pointRewards
    );

    /// Event for staking non fungible items for boosters.
    event StakeItemBatch(
        address indexed user,
        IERC20 indexed token,
        uint256 boosterId
    );

    /// Event for unstaking non fungible items from boosters.
    event UnstakeItemBatch(
        address indexed user,
        IERC20 indexed token,
        uint256 boosterId
    );

    /// An event for tracking when a user has spent points.
    event SpentPoints(
        address indexed source,
        address indexed user,
        uint256 amount
    );

    /**
     * Uses the emission schedule to calculate the total amount of staking reward
     * token that was emitted between two specified timestamps.
     * @param _fromTime the time to begin calculating emissions from.
     * @param _toTime the time to calculate total emissions up to.
     */
    function getTotalEmittedTokens(uint256 _fromTime, uint256 _toTime)
        internal
        view
        returns (uint256)
    {
        require(_toTime >= _fromTime, "Invalid order.");
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        uint256 totalEmittedTokens;
        uint256 workingRate;
        uint256 workingTime = _fromTime;
        for (uint256 i; i < b.tokenEmissionEventsCount; i++) {
            uint256 emissionTime = b.tokenEmissionEvents[i].timeStamp;
            uint256 emissionRate = b.tokenEmissionEvents[i].rate;
            if (_toTime < emissionTime) {
                totalEmittedTokens += ((_toTime - workingTime) * workingRate);
                return totalEmittedTokens;
            } else if (workingTime < emissionTime) {
                totalEmittedTokens += ((emissionTime - workingTime) *
                    workingRate);
                workingTime = emissionTime;
            }
            workingRate = emissionRate;
        }
        if (workingTime < _toTime) {
            totalEmittedTokens += ((_toTime - workingTime) * workingRate);
        }
        return totalEmittedTokens;
    }

    /**
     * Uses the emission schedule to calculate the total amount of points
     * emitted between two specified timestamps.
     * @param _fromTime the time to begin calculating emissions from.
     * @param _toTime the time to calculate total emissions up to.
     */
    function getTotalEmittedPoints(uint256 _fromTime, uint256 _toTime)
        internal
        view
        returns (uint256)
    {
        require(_toTime >= _fromTime, "Invalid order.");
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        uint256 totalEmittedPoints;
        uint256 workingRate;
        uint256 workingTime = _fromTime;
        for (uint256 i; i < b.pointEmissionEventsCount; i++) {
            uint256 emissionTime = b.pointEmissionEvents[i].timeStamp;
            uint256 emissionRate = b.pointEmissionEvents[i].rate;
            if (_toTime < emissionTime) {
                totalEmittedPoints += ((_toTime - workingTime) * workingRate);
                return totalEmittedPoints;
            } else if (workingTime < emissionTime) {
                totalEmittedPoints += ((emissionTime - workingTime) *
                    workingRate);
                workingTime = emissionTime;
            }
            workingRate = emissionRate;
        }
        if (workingTime < _toTime) {
            totalEmittedPoints += ((_toTime - workingTime) * workingRate);
        }
        return totalEmittedPoints;
    }

    /**
     * A function to easily see the amount of token rewards pending for a user on a
     * given pool. Returns the pending reward token amount.
     * @param _token The address of a particular staking pool asset to check for a
     * pending reward.
     * @param _user The user address to check for a pending reward.
     * @return the pending reward token amount.
     */
    function getPendingTokens(IERC20 _token, address _user)
        public
        view
        returns (uint256)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolInfo memory pool = b.poolInfo[_token];
        StakerBlueprint.UserInfo memory user = b.userInfo[_token][_user];
        uint256 tokensPerShare = pool.tokensPerShare;
        uint256 tokenBoostedDeposit = pool.tokenBoostedDeposit;

        if (block.timestamp > pool.lastRewardEvent && tokenBoostedDeposit > 0) {
            uint256 totalEmittedTokens = getTotalEmittedTokens(
                pool.lastRewardEvent,
                block.timestamp
            );
            uint256 tokensReward = ((totalEmittedTokens * pool.tokenStrength) /
                b.totalTokenStrength) * 1e12;
            tokensPerShare += (tokensReward / tokenBoostedDeposit);
        }

        return ((user.amount * tokensPerShare) / 1e12) - user.tokenPaid;
    }

    /**
     * A function to easily see the amount of point rewards pending for a user on a
     * given pool. Returns the pending reward point amount.
     *
     * @param _token The address of a particular staking pool asset to check for a
     * pending reward.
     * @param _user The user address to check for a pending reward.
     * @return the pending reward token amount.
     */
    function getPendingPoints(IERC20 _token, address _user)
        public
        view
        returns (uint256)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolInfo memory pool = b.poolInfo[_token];
        StakerBlueprint.UserInfo memory user = b.userInfo[_token][_user];
        uint256 pointsPerShare = pool.pointsPerShare;
        uint256 pointBoostedDeposit = pool.pointBoostedDeposit;

        if (block.timestamp > pool.lastRewardEvent && pointBoostedDeposit > 0) {
            uint256 totalEmittedPoints = getTotalEmittedPoints(
                pool.lastRewardEvent,
                block.timestamp
            );
            uint256 pointsReward = ((totalEmittedPoints * pool.pointStrength) /
                b.totalPointStrength) * 1e30;
            pointsPerShare += (pointsReward / pointBoostedDeposit);
        }

        return ((user.amount * pointsPerShare) / 1e30) - user.pointPaid;
    }

    /**
     * Return the number of points that the user has available to spend.
     * @return the number of points that the user has available to spend.
     */
    function getAvailablePoints(address _user) public view returns (uint256) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        uint256 pendingTotal = 0;
        for (uint256 i; i < b.poolTokens.length; i++) {
            IERC20 poolToken = b.poolTokens[i];
            uint256 _pendingPoints = getPendingPoints(poolToken, _user);
            pendingTotal = pendingTotal + _pendingPoints;
        }
        return (b.userPoints[_user] + pendingTotal) - b.userSpentPoints[_user];
    }

    /**
     * Return the total number of points that the user has ever accrued.
     * @return the total number of points that the user has ever accrued.
     */
    function getTotalPoints(address _user) external view returns (uint256) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        uint256 pendingTotal = 0;
        for (uint256 i; i < b.poolTokens.length; i++) {
            IERC20 poolToken = b.poolTokens[i];
            uint256 _pendingPoints = getPendingPoints(poolToken, _user);
            pendingTotal = pendingTotal + _pendingPoints;
        }
        return b.userPoints[_user] + pendingTotal;
    }

    /**
     * Update the pool corresponding to the specified token address.
     */
    function updatePool(IERC20 _token) internal {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolInfo storage pool = b.poolInfo[_token];
        if (block.timestamp <= pool.lastRewardEvent) {
            return;
        }

        uint256 poolTokenSupply = IERC20(pool.assetAddress).balanceOf(
            address(this)
        );
        if (poolTokenSupply == 0) {
            pool.lastRewardEvent = block.timestamp;
            return;
        }

        // Calculate token and point rewards for this pool.
        uint256 totalEmittedTokens = getTotalEmittedTokens(
            pool.lastRewardEvent,
            block.timestamp
        );
        uint256 tokensReward = ((totalEmittedTokens * pool.tokenStrength) /
            b.totalTokenStrength) * 1e12;

        uint256 totalEmittedPoints = getTotalEmittedPoints(
            pool.lastRewardEvent,
            block.timestamp
        );
        uint256 pointsReward = ((totalEmittedPoints * pool.pointStrength) /
            b.totalPointStrength) * 1e30;

        // Directly pay developers their corresponding share of tokens and points.
        uint256 developerAddressLength = b.developerAddresses.length();
        for (uint256 i; i < developerAddressLength; i++) {
            address developer = b.developerAddresses.at(i);
            uint256 share = b.developerShares[developer];
            uint256 devTokens = (tokensReward * share) / 100000;
            tokensReward -= devTokens;
            uint256 devPoints = (pointsReward * share) / 100000;
            pointsReward -= devPoints;
            IERC20(b.token).safeTransfer(developer, devTokens / 1e12);
            b.userPoints[developer] += (devPoints / 1e30);
        }

        // Update the pool rewards per share to pay users the amount remaining.
        pool.tokensPerShare += (tokensReward / pool.tokenBoostedDeposit);
        pool.pointsPerShare += (pointsReward / pool.pointBoostedDeposit);
        pool.lastRewardEvent = block.timestamp;
    }

    /**
     * Private helper function to update the deposits based on new shares.
     * @param _amount base amount of the new boosted amounts.
     * @param _token the deposit token of the pool.
     * @param _pool the pool, the deposit of which is to be updated.
     * @param _user the user, the amount of whom is to be updated.
     * @param _isDeposit flag that represents the caller function. 0 is for deposit,
     *   1 is for withdraw, other value represents no amount update.
     */
    function updateDeposits(
        uint256 _amount,
        IERC20 _token,
        StakerBlueprint.PoolInfo storage _pool,
        StakerBlueprint.UserInfo storage _user,
        uint8 _isDeposit
    ) private {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();
        if (_user.amount > 0) {
            uint256 pendingTokens = ((_user.tokenBoostedAmount *
                _pool.tokensPerShare) / 1e12) - _user.tokenPaid;
            uint256 pendingPoints = ((_user.pointBoostedAmount *
                _pool.pointsPerShare) / 1e30) - _user.pointPaid;
            _user.tokenRewards += pendingTokens;
            _user.pointRewards += pendingPoints;
            b.totalTokenDisbursed = b.totalTokenDisbursed + pendingTokens;
            _pool.tokenBoostedDeposit -= _user.tokenBoostedAmount;
            _pool.pointBoostedDeposit -= _user.pointBoostedAmount;
        }

        if (_isDeposit == 0) {
            // Flag for Deposit
            _user.amount += _amount;
        } else if (_isDeposit == 1) {
            // Flag for Withdraw
            _user.amount -= _amount;
        }

        _user.tokenBoostedAmount = applyBoosts(_user.amount, _token, true);
        _user.pointBoostedAmount = applyBoosts(_user.amount, _token, false);
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
     * Private helper function that applies boosts on deposits for Item staking.
     * (amount * multiplier ) / 10000, where multiplier is in basis points.
     * (20 * 20000) / 10000 = 40 => 2x boost
     * @param _unboosted value that needs to have boosts applied to.
     * @param _token the pool to which the booster is attached.
     * @param _isToken is true if '_unboosted' argument is of token type.
     * @return _boosted return value with applied boosts.
     */
    function applyBoosts(
        uint256 _unboosted,
        IERC20 _token,
        bool _isToken
    ) internal view returns (uint256 _boosted) {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();
        if (_unboosted <= 0) {
            return 0;
        } else if (b.poolInfo[_token].boostInfo.length == 0) {
            return _unboosted;
        } else if (b.itemUserInfo[_msgSender()].boosterIds.length() == 0) {
            return _unboosted;
        }

        _boosted = _unboosted;
        StakerBlueprint.BoostInfo memory booster;
        StakerBlueprint.PoolInfo memory pool = b.poolInfo[_token];
        StakerBlueprint.ItemUserInfo storage staker = b.itemUserInfo[
            _msgSender()
        ];

        // Iterate through all the boosters that the pool supports
        for (uint256 i = 0; i < pool.boostInfo.length; i++) {
            booster = b.boostInfo[pool.boostInfo[i]];
            if (staker.boosterIds.contains(pool.boostInfo[i])) {
                if (
                    booster.assetType ==
                    StakerBlueprint.BoosterAssetType.Tokens &&
                    _isToken
                ) {
                    _boosted += (_unboosted * booster.multiplier) / 10000;
                } else if (
                    booster.assetType ==
                    StakerBlueprint.BoosterAssetType.Points &&
                    !_isToken
                ) {
                    _boosted += (_unboosted * booster.multiplier) / 10000;
                } else if (
                    booster.assetType == StakerBlueprint.BoosterAssetType.Both
                ) {
                    _boosted += (_unboosted * booster.multiplier) / 10000;
                }
            }
        }
    }

    /**
     * Deposit some particular assets to a particular pool on the Staker.
     * @param _token The asset to stake into its corresponding pool.
     * @param _amount The amount of the provided asset to stake.
     */
    function deposit(IERC20 _token, uint256 _amount) external {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.PoolInfo storage pool = b.poolInfo[_token];
        require(
            pool.tokenStrength > 0 || pool.pointStrength > 0,
            "Inactive pool."
        );

        StakerBlueprint.UserInfo storage user = b.userInfo[_token][msg.sender];
        updatePool(_token);
        updateDeposits(_amount, _token, pool, user, 0);

        IERC20(pool.assetAddress).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
        emit Deposit(msg.sender, _token, _amount);
    }

    /**
     * Withdraw some particular assets from a particular pool on the Staker.
     * @param _token The asset to withdraw from its corresponding staking pool.
     * @param _amount The amount of the provided asset to withdraw.
     */
    function withdraw(IERC20 _token, uint256 _amount) external {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.UserInfo storage user = b.userInfo[_token][msg.sender];
        require(user.amount >= _amount, "Invalid amount.");
        StakerBlueprint.PoolInfo storage pool = b.poolInfo[_token];

        updatePool(_token);
        updateDeposits(_amount, _token, pool, user, 1);

        IERC20(pool.assetAddress).safeTransfer(msg.sender, _amount);
        emit Withdraw(msg.sender, _token, _amount);
    }

    /**
     * Claim accumulated token and point rewards from the Staker.
     * @param _token The asset to claim rewards from.
     */
    function claim(IERC20 _token) external {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        StakerBlueprint.UserInfo storage user = b.userInfo[_token][msg.sender];
        StakerBlueprint.PoolInfo storage pool = b.poolInfo[_token];
        uint256 pendingTokens;
        uint256 pendingPoints;

        updatePool(_token);
        if (user.amount > 0) {
            pendingTokens =
                ((user.tokenBoostedAmount * pool.tokensPerShare) / 1e12) -
                user.tokenPaid;
            pendingPoints =
                ((user.pointBoostedAmount * pool.pointsPerShare) / 1e30) -
                user.pointPaid;
            b.totalTokenDisbursed += pendingTokens;
        }
        uint256 _tokenRewards = user.tokenRewards + pendingTokens;
        uint256 _pointRewards = user.pointRewards + pendingPoints;
        user.tokenRewards = 0;
        user.pointRewards = 0;
        b.userPoints[msg.sender] += _pointRewards;

        user.tokenPaid = (user.tokenBoostedAmount * pool.tokensPerShare) / 1e12;
        user.pointPaid = (user.pointBoostedAmount * pool.pointsPerShare) / 1e30;
        IERC20(b.token).safeTransferFrom(
            address(this),
            msg.sender,
            _tokenRewards
        );
        emit Claim(msg.sender, IERC20(b.token), _tokenRewards, _pointRewards);
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
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();
        StakerBlueprint.BoostInfo memory booster = b.boostInfo[_boosterId];
        uint256 totalAmount = 0;

        for (uint256 i = 0; i < _amounts.length; ++i) {
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
     * Stake a collection of items for booster from a ERC721 or ERC1155 contract.
     * @param _ids the ids collection of Items from a contract.
     * @param _amounts the amount per token Id.
     * @param _contract the external contract of the Items.
     * @param _token the pool that will be staked in.
     * @param _boosterId the booster that accepts these Items.
     */
    function stakeItemsBatch(
        uint256[] calldata _ids,
        uint256[] calldata _amounts,
        address _contract,
        IERC20 _token,
        uint256 _boosterId
    ) external {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();
        require(_ids.length == _amounts.length, "Length Mismatch");
        bool exists = false;
        for (uint256 i = 0; i < b.poolInfo[_token].boostInfo.length; i++) {
            if (b.poolInfo[_token].boostInfo[i] == _boosterId) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            revert("Invalid pool/booster.");
        } else if (!eligible(_ids, _amounts, _contract, _boosterId)) {
            revert("Ineligible.");
        }

        StakerBlueprint.PoolInfo storage pool = b.poolInfo[_token];
        StakerBlueprint.UserInfo storage user = b.userInfo[_token][msg.sender];

        if (
            ISuperGeneric(_contract).supportsInterface(
                StakerBlueprint.INTERFACE_ERC721
            )
        ) {
            ISuperGeneric(_contract).safeBatchTransferFrom(
                _msgSender(),
                address(this),
                _ids,
                ""
            );
        } else if (
            ISuperGeneric(_contract).supportsInterface(
                StakerBlueprint.INTERFACE_ERC1155
            )
        ) {
            ISuperGeneric(_contract).safeBatchTransferFrom(
                _msgSender(),
                address(this),
                _ids,
                _amounts,
                ""
            );
        } else {
            revert("Unsupported Contract.");
        }

        StakerBlueprint.ItemUserInfo storage staker = b.itemUserInfo[
            msg.sender
        ];
        staker.totalItems += _ids.length;
        for (uint256 i = 0; i < _ids.length; i++) {
            staker.tokenIds[_boosterId].add(_ids[i]);
            staker.amounts[_ids[i]] += _amounts[i];
        }
        staker.boosterIds.add(_boosterId);

        b.totalItemStakes += _ids.length;

        updatePool(_token);
        updateDeposits(0, _token, pool, user, 2); // 2 = PlaceHolder

        emit StakeItemBatch(msg.sender, _token, _boosterId);
    }

    /**
     * Unstake collection of items from booster to ERC721 or ERC1155 contract.
     * @param _token the pool that was previously staked in.
     * @param _boosterId the booster that accepted these Items.
     */
    function unstakeItemsBatch(IERC20 _token, uint256 _boosterId) external {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();
        require(address(_token) != address(0), "0 address.");
        require(
            b.itemUserInfo[msg.sender].boosterIds.contains(_boosterId),
            "No stakes."
        );

        StakerBlueprint.ItemUserInfo storage staker = b.itemUserInfo[
            msg.sender
        ];
        StakerBlueprint.PoolInfo storage pool = b.poolInfo[_token];
        StakerBlueprint.UserInfo storage user = b.userInfo[_token][msg.sender];
        address externalContract = b.boostInfo[_boosterId].contractRequired;

        uint256[] memory _ids = new uint256[](
            staker.tokenIds[_boosterId].length()
        );
        uint256[] memory _amounts = new uint256[](_ids.length);
        for (uint256 i = 0; i < _ids.length; i++) {
            _ids[i] = staker.tokenIds[_boosterId].at(i);
            _amounts[i] = staker.amounts[_ids[i]];
        }

        if (
            ISuperGeneric(externalContract).supportsInterface(
                StakerBlueprint.INTERFACE_ERC721
            )
        ) {
            ISuperGeneric(externalContract).safeBatchTransferFrom(
                address(this),
                _msgSender(),
                _ids,
                ""
            );
        } else if (
            ISuperGeneric(externalContract).supportsInterface(
                StakerBlueprint.INTERFACE_ERC1155
            )
        ) {
            ISuperGeneric(externalContract).safeBatchTransferFrom(
                address(this),
                _msgSender(),
                _ids,
                _amounts,
                ""
            );
        } else {
            revert("Unsupported Contract.");
        }

        staker.totalItems -= _ids.length;
        for (uint256 i = 0; i < _ids.length; i++) {
            staker.tokenIds[_boosterId].remove(_ids[i]);
            staker.amounts[_ids[i]] = 0;
        }
        staker.boosterIds.remove(_boosterId);

        b.totalItemStakes -= _ids.length;

        updatePool(_token);
        updateDeposits(0, _token, pool, user, 2); // 2 = PlaceHolder

        emit UnstakeItemBatch(msg.sender, _token, _boosterId);
    }

    /**
     * Allows the owner of this Staker to grant or remove approval to an external
     * spender of the points that users accrue from staking resources.
     * @param _spender The external address allowed to spend user points.
     * @param _approval The updated user approval status.
     */
    function approvePointSpender(address _spender, bool _approval)
        external
        hasValidPermit(UNIVERSAL, StakerBlueprint.APPROVE_POINT_SPENDER)
    {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        b.approvedPointSpenders[_spender] = _approval;
    }

    /**
     * Allows an approved spender of points to spend points on behalf of a user.
     * @param _user The user whose points are being spent.
     * @param _amount The amount of the user's points being spent.
     */
    function spendPoints(address _user, uint256 _amount) external {
        StakerBlueprint.StakerStateVariables storage b = StakerBlueprint
            .stakerStateVariables();

        require(b.approvedPointSpenders[msg.sender], "Not allowed.");
        require(getAvailablePoints(_user) >= _amount, "Invalid amount.");

        b.userSpentPoints[_user] += _amount;
        emit SpentPoints(msg.sender, _user, _amount);
    }
}
