// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../base/Sweepableds.sol";
import "../interfaces/ISuperGeneric.sol";
// import "../../assets/erc721/interfaces/ISuper721.sol";

import "../staker/stakerDs/StakerBlueprint.sol";
import "hardhat/console.sol";

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
contract TestStakerV3FacetStaking is
    Sweepableds,
    ReentrancyGuard,
    ERC1155Holder,
    IERC721Receiver
{
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

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
     * Uses the emission schedule to calculate the total amount of staking reward
     * token that was emitted between two specified timestamps.
     * @param _fromTime the time to begin calculating emissions from.
     * @param _toTime the time to calculate total emissions up to.
     */
    function getTotalEmittedTokens(uint256 _fromTime, uint256 _toTime)
        internal
        view
        returns (bytes memory)
    {
        return msg.data;
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
        returns (bytes memory)
    {
        return msg.data;
    }

    /**
     * A function to easily see the amount of token rewards pending for a user on a
     * given pool. Returns the pending reward token amount.
     * @param _poolId The id of a particular staking pool asset to check for a
     *   pending reward.
     * @param _user the user address to check for a pending reward.
     * @return the pending reward token amount.
     */
    function getPendingTokens(uint256 _poolId, address _user)
        public
        view
        returns (bytes memory)
    {
        return msg.data;
    }

    /**
     * A function to easily see the amount of point rewards pending for a user on a
     * given pool. Returns the pending reward point amount.
     * @param _poolId The address of a particular staking pool asset to check for a
     *   pending reward.
     * @param _user The user address to check for a pending reward.
     * @return the pending reward token amount.
     */
    function getPendingPoints(uint256 _poolId, address _user)
        public
        view
        returns (bytes memory)
    {
        return msg.data;
    }

    /**
     * Return the number of points that the user has available to spend.
     * @return the number of points that the user has available to spend.
     */
    function getAvailablePoints(address _user)
        public
        view
        returns (bytes memory)
    {
        return msg.data;
    }

    /**
     * Return the total number of points that the user has ever accrued.
     * @return the total number of points that the user has ever accrued.
     */
    function getTotalPoints(address _user)
        external
        view
        returns (bytes memory)
    {
        return msg.data;
    }

    /**
     * Private function for the correct transfer of assets from the user
     *
     * @param _from address from which transfer shuold be made.
     * @param _to address of receiver of transfered amount.
     * @param _assetAddress address of asset that should be transfered.
     * @param _ids array of ids of asset that should be transfered.
     * @param _amounts array of amounts of items that should be transfered.
     * @return flag that indicates an succesful of transfer.
     */
    function genericTransfer(
        address _from,
        address _to,
        address _assetAddress,
        uint256[] memory _ids,
        uint256[] memory _amounts
    ) internal returns (bytes memory) {
        return msg.data;
    }

    /**
     * Update the pool corresponding to the specified token address.
     * @param _poolId the id of pool to update the corresponding pool for.
     */
    function updatePool(uint256 _poolId) internal returns (bytes memory) {
        return msg.data;
    }

    /**
     * Private helper function to update the deposits based on new shares.
     * @param _amount base amount of the new boosted amounts.
     * @param _poolId the pool id, the deposit of which is to be updated.
     * @param _isDeposit flag that represents the caller function. True is for deposit,
     *   false is for withdraw.
     */
    function updateDeposits(
        uint256 _amount,
        uint256 _poolId,
        bool _isDeposit
    ) private returns (bytes memory) {
        return msg.data;
    }

    /**
     * Private helper function that applies boosts on deposits for Item staking.
     * (amount * multiplier ) / 10000, where multiplier is in basis points.
     * (20 * 20000) / 10000 = 40 => 2x boost
     * @param _unboosted value that needs to have boosts applied to.
     * @param _poolId Id of the pool.
     * @param _isToken is true if '_unboosted' argument is of token type.
     * @return _boosted return value with applied boosts.
     */
    function applyBoosts(
        uint256 _unboosted,
        uint256 _poolId,
        bool _isToken
    ) internal view returns (bytes memory) {
        return msg.data;
    }

    /**
     * Private helper function that applies boosts on deposits for Item staking.
     * (amount * multiplier ) / 10000, where multiplier is in basis points.
     * (20 * 20000) / 10000 = 40 => 2x boost
     * @param _unboostedTokens value that needs to have boosts applied to.
     * @param _unboostedPoints is true if '_unboosted' argument is of token type.
     * @param _poolId Id of the pool.
     */
    function applyBoostsV2(
        uint256 _unboostedTokens,
        uint256 _unboostedPoints,
        uint256 _poolId
    ) internal view returns (bytes memory) {
        return msg.data;
    }

    /**
     * Deposit some particular assets to a particular pool on the Staker.
     * @param _poolId the pool id.
     * @param _boosterId id of booster that you want to achieve.
     * @param _asset asset user wants to deposit
     */
    function deposit(
        uint256 _poolId,
        uint256 _boosterId,
        StakerBlueprint.StakedAsset memory _asset,
        bool isLocking
    ) external returns (bytes memory) {
        return msg.data;
    }

    /**
     * Withdraw some particular assets from a particular pool on the Staker.
     * @param _poolId the id of pool, withdraw tokens from.
     * @param _asset asset user wants to withdraw
     */
    function withdraw(
        uint256 _poolId,
        StakerBlueprint.StakedAsset memory _asset,
        uint256 _boosterId
    ) external returns (bytes memory) {
        return msg.data;
    }

    /**
     * Claim accumulated token and point rewards from the Staker.
     * @param _poolId The id of pool to claim rewards from.
     */
    function claim(uint256 _poolId, bytes memory _data)
        external
        returns (bytes memory)
    {
        return msg.data;
    }

    /**
     * Private helper function to check if Item staker is eligible for a booster.
     * @param _ids ids of Items required for a booster.
     * @param _amounts amount per token Id.
     * @param _contract external contract from which Items are required.
     * @param _boosterId the booster for which Items are being staked.
     * @return return true if eligible.
     */
    function eligible(
        uint256[] memory _ids,
        uint256[] memory _amounts,
        address _contract,
        uint256 _boosterId
    ) private view returns (bytes memory) {
        return msg.data;
    }

    /**
     * Allows the owner of this Staker to grant or remove approval to an external
     * spender of the points that users accrue from staking resources.
     * @param _spender The external address allowed to spend user points.
     * @param _approval The updated user approval status.
     */
    function approvePointSpender(address _spender, bool _approval)
        external
        returns (bytes memory)
    {
        return msg.data;
    }

    /**
     * Allows an approved spender of points to spend points on behalf of a user.
     * @param _user The user whose points are being spent.
     * @param _amount The amount of the user's points being spent.
     */
    function spendPoints(address _user, uint256 _amount)
        external
        returns (bytes memory)
    {
        return msg.data;
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
