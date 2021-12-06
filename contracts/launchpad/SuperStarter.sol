// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../base/Sweepable.sol";

contract SuperStarter is Ownable, ReentrancyGuard, Sweepable {
    using SafeERC20 for IERC20;

    struct Pool {
        uint256 cap;
        uint256 price;
        uint256 maxCap;
        address creator;
        address token;
        address swapToken;
        bool isWhiteList;
        bool onlyHolder;
        bool enabled;
        bool finished;
    }

    address public superToken;

    uint256 private minSuper = 1e19;

    uint256 private constant scaleFactor = 1e8;
    uint256 private constant defaultSpan = 1e5;

    Pool[] public pools;
    mapping(uint256 => uint256) public poolsSold;
    mapping(uint256 => mapping(address => uint256)) public lockedTokens;
    mapping(uint256 => mapping(address => uint256)) public whiteList;

    event NewPool(
        uint256 id,
        address indexed creator,
        address token,
        address swapToken,
        uint256 cap,
        uint256 price,
        bool isWhiteList,
        bool onlyHolder,
        uint256 maxCap
    );

    event Swap(
        uint256 id,
        uint256 roundID,
        address sender,
        uint256 amount,
        uint256 amt
    );

    event Claim(uint256 id, address indexed claimer, uint256 amount, uint256 timestamp);
    event PoolFinished(uint256 id, uint256 timestamp);
    event PoolStarted(uint256 id, uint256 timestamp);
    event WhiteList(uint256 id, uint256 timestamp);

    constructor(uint256 _minSuper, address _superToken) {
        minSuper = _minSuper;
        superToken = _superToken;
    }

    modifier onlyCreator(uint256 id) {
        require(pools[id].creator == msg.sender, "Should be creator");
        _;
    }

    function addWhiteListBatch(uint256 id, address[] calldata _whiteList, uint256[] calldata _caps) external onlyOwner {
        for (uint256 i = 0; i < _whiteList.length; ++i) {
            whiteList[id][_whiteList[i]] = _caps[i];
        }
        emit WhiteList(id, block.timestamp);
    }

    function addWhiteList(uint256 id, address _whiteList, uint256 _cap) external onlyOwner {
        whiteList[id][_whiteList] = _cap;
        emit WhiteList(id, block.timestamp);

    }

    function updateMinSuper(uint256 _minSuper) external onlyOwner {
        minSuper = _minSuper;
    }

    function updateSuperToken(address _superToken) external onlyOwner {
        superToken = _superToken;
    }

    function poolsLength() external view returns (uint256) {
        return pools.length;
    }

    function createPool(
        address token,
        address swapToken,
        uint256 cap,
        uint256 price,
        bool isWhiteList,
        bool onlyHolder,
        uint256 maxCap
    ) external onlyOwner returns (uint256) {
        require(cap <= IERC20(token).balanceOf(msg.sender) && cap > 0, "Cap check");
        require(token != address(0), "Pool token cannot be zero address");
        require(price > uint256(0), "Price must be greater than 0");
        Pool memory newPool =
            Pool(
                cap,
                price,
                maxCap,
                msg.sender,
                token,
                swapToken,
                isWhiteList,
                onlyHolder,
                false,
                false
            );
        pools.push(newPool);
        uint256 id = pools.length;
        IERC20(token).safeTransferFrom(msg.sender, address(this), cap);
        emit NewPool(
            id,
            msg.sender,
            token,
            swapToken,
            cap,
            price,
            isWhiteList,
            onlyHolder,
            maxCap
        );
        return id;
    }

    function swap(uint256 id, uint256 amount) external payable {
        require(amount != 0, "Amount should not be zero");
        require(pools[id].enabled, "Pool must be enabled");
        if (pools[id].onlyHolder) {
            require(IERC20(superToken).balanceOf(msg.sender) >= minSuper, "Miniumum for the pool");
        }
        if (pools[id].isWhiteList) {
            require(whiteList[id][msg.sender] > 0, "Should be white listed for the pool");
        }
        if (pools[id].swapToken == address(0)) {
            require(amount == msg.value, "Amount is not equal msg.value");
        }
        _simpleSwap(id, amount);
    }

    function _simpleSwap(uint256 id, uint256 amount) internal {
        Pool memory pool = pools[id];
        uint256 left = pool.cap - poolsSold[id];
        uint256 curLocked = lockedTokens[id][msg.sender];
        if (left > pool.maxCap - curLocked) {
            left = pool.maxCap - curLocked;
        }
        if (pool.isWhiteList && left > whiteList[id][msg.sender] - curLocked) {
            left = whiteList[id][msg.sender] - curLocked;
        }
        require(left > 0, "Not enough tokens for swap");
        uint256 amt = (pool.price * amount) / scaleFactor;

        uint256 back = 0;
        if (left < amt) {
            amt = left;
            uint256 newAmount = (amt * scaleFactor) / pool.price;

            back = amount - newAmount;
            amount = newAmount;
        }
        lockedTokens[id][msg.sender] = curLocked + amt;
        poolsSold[id] = poolsSold[id ]+ amt;
        if (pool.swapToken == address(0)) {
            (bool success, ) = payable(pool.creator).call{value: amount}("");
            require(success, "Should transfer ethers to the pool creator");
            if (back > 0) {
                (success, ) = payable(msg.sender).call{value: back}("");
                require(success, "Should transfer left ethers back to the user");
            }
        } else {
            IERC20(pool.swapToken).safeTransfer(
                pool.creator,
                amount
            );
        }
        emit Swap(id, 0, msg.sender, amount, amt);
    }

    function startPool(uint256 id) external onlyCreator(id) {
        require(!pools[id].enabled, "Pool is already enabled");
        require(!pools[id].finished, "Pool is already completed");
        pools[id].enabled = true;
        emit PoolStarted(id, block.timestamp);
    }

    function finishPool(uint256 id) external onlyCreator(id) {
        require(pools[id].enabled, "Pool is not enabled");
        require(!pools[id].finished, "Pool is already completed");
        pools[id].enabled = false;
        pools[id].finished = true;
        emit PoolFinished(id, block.timestamp);
    }

    function claim(uint256 id) external nonReentrant {
        require(pools[id].finished, "Cannot claim until pool is finished");
        require(lockedTokens[id][msg.sender] > 0, "Should have tokens to claim");
        uint256 amount = lockedTokens[id][msg.sender];
        lockedTokens[id][msg.sender] = 0;
        IERC20(pools[id].token).safeTransfer(msg.sender, amount);
        emit Claim(id, msg.sender, amount, block.timestamp);
    }
}