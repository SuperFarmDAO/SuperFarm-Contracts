// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../assets/erc721/interfaces/ISuper721.sol";
import "../assets/erc1155/interfaces/ISuper1155.sol";
import "../base/Sweepable.sol";

/**
  @title Token claiming contract, for holders of particular nft.
  @author Nikita Elunin
*/
contract HolderClaiming is Sweepable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant CREATE_POOL = keccak256("CREATE_POOL");


    address immutable public service;



    /**
    A structure characterizing the pool from which users will be branded.

    @param startTime Start time of the pool
    @param endTime End time of the pool
    @param rewardPerSec Amount of rewards the user receives in 1 second
    @param totalAmountClaimed The total Amount of rewards taken by users
    @param rewardTokenAmount Amount of rewards to be distributed to holders
    @param hashes mapping (hash => bool) Used hashes
    @param rewardToken Reward token address
    */
    struct Pool {
        uint256 startTime;
        uint256 endTime;
        uint256 rewardPerSec; 
        uint256 totalAmountClaimed;
        uint256 rewardTokenAmount;
        mapping(bytes32 => bool) hashes;
        IERC20 rewardToken;
    }

    /**
    The structure that is used to create the pool
    */
    struct PoolCreationStruct {
        uint256 startTime;
        uint256 endTime;
        uint256 rewardPerSec;
        uint256 rewardTokenAmount;
        IERC20 rewardToken;
    }

    /**
    The structure stores the checkpoints when the user held the NFT
    
    @param startTime Beginning of holding
    @param endTime Ending of holding
    @param balance Holding balance
    */
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

    // A mapping of id's to pool
    mapping(uint256 => Pool) private pools;


    /// An event for tracking a user claiming some of their vested tokens.
    event Claim(address indexed beneficiary, uint256 amount, uint256 timestamp);


    /**
    @param _service Admin's address
    */
    constructor(address _service) {
        service = _service;
    }

    function version() external virtual override pure returns (uint256) {
        return 1;
    }


    /**
    The function is used to create a new pool

    @param _struct The structure that is used to create the pool
     */
    function addPool(PoolCreationStruct calldata _struct) external hasValidPermit(UNIVERSAL, CREATE_POOL) {

        pools[nextPoolId].startTime = _struct.startTime;
        pools[nextPoolId].endTime = _struct.endTime;
        pools[nextPoolId].rewardPerSec = _struct.rewardPerSec;
        pools[nextPoolId].rewardTokenAmount = _struct.rewardTokenAmount;
        pools[nextPoolId].rewardToken = _struct.rewardToken;

        nextPoolId++;
        _struct.rewardToken.safeTransferFrom(msg.sender, address(this), _struct.rewardTokenAmount);
    }

    /**
    The function is used to claim

    @param _poolId Id of pool
    @param _hash Message signed by admin
    @param sig Signature
    @param _checkpoints See struct Checkpoint.

    */

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
        pool.rewardToken.safeTransfer(msg.sender, rewardAmount);

        emit Claim(msg.sender, rewardAmount, block.timestamp);
    }

    /**
    Internal function for verifying purposes
     */
    function prefixedHash(bytes32 _hash) pure internal returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _hash));
    }
}