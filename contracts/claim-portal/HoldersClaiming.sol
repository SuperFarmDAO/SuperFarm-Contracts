// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../assets/erc721/interfaces/ISuper721.sol";
import "../assets/erc1155/interfaces/ISuper1155.sol";
import "../access/PermitControl.sol";
import "hardhat/console.sol";

/**
  @title A token vesting contract for streaming claims.
  @author SuperFarm
  @author Nikita Elunin
  This vesting contract allows users to claim vested tokens with every block.
*/
contract HolderClaiming is PermitControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant CREATE_POOL = keccak256("CREATE_POOL");

    address public service;

    /// The token to disburse in vesting.
    IERC20 public rewardToken;

    /// reward is reward per second
    struct Pool {
        uint256 startTime;
        uint256 endTime;
        uint256 rewardPerSec; 
        uint256 totalAmountClaimed;
        uint256 rewardTokenAmount;
        mapping(bytes32 => bool) hashes;
    }

    struct PoolCreationStruct {
        uint256 startTime;
        uint256 endTime;
        uint256 rewardPerSec;
        uint256 rewardTokenAmount;
    }

    struct Checkpoint {
        uint256[] startTime;
        uint256[] endTime;
        uint256[] balance;
    }

    struct Sig {
        /* v parameter */
        uint8 v;
        /* r parameter */
        bytes32 r;
        /* s parameter */
        bytes32 s;
    }

    /// PoolId, starting with 0
    uint256 nextPoolId;

    // A mapping of addresses to the claim received.
    mapping(uint256 => Pool) private pools;


    /// An event for tracking a user claiming some of their vested tokens.
    event Claim(address indexed beneficiary, uint256 amount, uint256 timestamp);

    /// An event that indicates that contract receives ether for rewards.
    event Receive(address caller, uint256 amount);

    /**
    Construct a new VestStream by providing it a token to disburse.
    @param _rewardToken The token to vest to claimants in this contract.
    */
    constructor(IERC20 _rewardToken, address _service) {
        rewardToken = _rewardToken;
        service = _service;
        // uint256 MAX_INT = 2**256 - 1;
        // rewardToken.approve(address(this), MAX_INT);
    }




    function addPool(PoolCreationStruct calldata _struct) external hasValidPermit(UNIVERSAL, CREATE_POOL) {
        
        // require();
        pools[nextPoolId].startTime = _struct.startTime;
        pools[nextPoolId].endTime = _struct.endTime;
        pools[nextPoolId].rewardPerSec = _struct.rewardPerSec;
        pools[nextPoolId].rewardTokenAmount = _struct.rewardTokenAmount;

        nextPoolId++;
        rewardToken.safeTransferFrom(msg.sender, address(this), _struct.rewardTokenAmount);
    }

    function claim(uint256 _poolId, bytes32 _hash, Sig calldata sig, Checkpoint memory _checkpoints) external nonReentrant {
        require(_poolId < nextPoolId, "Wrong pool id");
        Pool storage pool = pools[_poolId];
        require(block.timestamp >= pool.startTime && block.timestamp <= pool.endTime, "Pool is not running");
        uint256 rewardPerSec = pool.rewardPerSec;

        require(!pool.hashes[_hash], "Hash has already been used");
       
        require(service == ecrecover(prefixedHash(_hash), sig.v, sig.r, sig.s), "Signed not by trusted address");

        bytes32 messageHash = keccak256(abi.encodePacked(_checkpoints.startTime, _checkpoints.endTime, _checkpoints.balance));

        require(messageHash == _hash, "Wrong hash provided");

        uint256 rewardAmount;

        for (uint256 i = 0; i < _checkpoints.startTime.length; i++) {
            rewardAmount += (_checkpoints.endTime[i] - _checkpoints.startTime[i]) * (rewardPerSec * _checkpoints.balance[i]);
        }
        require(rewardAmount <= pool.rewardTokenAmount, "Not enough tokens for reward");

        pool.totalAmountClaimed += rewardAmount;
        pool.rewardTokenAmount -= rewardAmount;
        pool.hashes[_hash] = true;
        rewardToken.safeTransfer(msg.sender, rewardAmount);

        emit Claim(msg.sender, rewardAmount, block.timestamp);
    }

    function prefixedHash(bytes32 _hash) pure internal returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _hash));
    }


    

    /**
    Sweep all of a particular ERC-20 token from the contract.
    @param _token The token to sweep the balance from.
    */
    function sweep(IERC20 _token) external onlyOwner {
        uint256 balance = _token.balanceOf(address(this));
        _token.safeTransferFrom(address(this), msg.sender, balance);
    }
}