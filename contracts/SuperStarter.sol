// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract SuperStarter is Initializable, ContextUpgradeable, OwnableUpgradeable {
    using SafeMath for uint256;
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
        address creator,
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

    event Claim(uint256 id, address claimer, uint256 amount);
    event PoolFinished(uint256 id);
    event PoolStarted(uint256 id);
    event WhiteList(uint256 id);

    uint256[50] private __gap;

    function initialize() public initializer {
        __Ownable_init();
    }

    modifier onlyCreator(uint256 id) {
        require(pools[id].creator == msg.sender, "Should be creator");
        _;
    }

    function addWhiteList(uint256 id, address[] calldata _whiteList, uint256[] calldata _caps) external onlyOwner {
        for (uint256 i = 0; i < _whiteList.length; ++i) {
            whiteList[id][_whiteList[i]] = _caps[i];
        }
        emit WhiteList(id);
    }

    function setMinSuper(uint256 _minSuper) external onlyOwner {
        minSuper = _minSuper;
    }

    function setSuperToken(address _superToken) external onlyOwner {
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
        uint256 id = pools.length;
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
        IERC20(token).transferFrom(msg.sender, address(this), cap);
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
        uint256 left = pool.cap.sub(poolsSold[id]);
        uint256 curLocked = lockedTokens[id][msg.sender];
        if (left > pool.maxCap.sub(curLocked)) {
            left = pool.maxCap.sub(curLocked);
        }
        if (pool.isWhiteList && left > whiteList[id][msg.sender].sub(curLocked)) {
            left = whiteList[id][msg.sender].sub(curLocked);
        }
        require(left > 0, "Not enough tokens for swap");
        uint256 amt = pool.price.mul(amount).div(scaleFactor);
        uint256 back = 0;
        if (left < amt) {
            amt = left;
            uint256 newAmount = amt.mul(scaleFactor).div(pool.price);
            back = amount.sub(newAmount);
            amount = newAmount;
        }
        lockedTokens[id][msg.sender] = curLocked.add(amt);
        poolsSold[id] = poolsSold[id].add(amt);
        if (pool.swapToken == address(0)) {
            (bool success, ) = payable(pool.creator).call{value: amount}("");
            require(success, "Should transfer ethers to the pool creator");
            if (back > 0) {
                (success, ) = payable(msg.sender).call{value: back}("");
                require(success, "Should transfer left ethers back to the user");
            }
        } else {
            IERC20(pool.swapToken).transferFrom(
                msg.sender,
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
        emit PoolStarted(id);
    }

    function finishPool(uint256 id) external onlyCreator(id) {
        require(pools[id].enabled, "Pool is not enabled");
        require(!pools[id].finished, "Pool is already completed");
        pools[id].enabled = false;
        pools[id].finished = true;
        emit PoolFinished(id);
    }

    function claim(uint256 id) external {
        require(pools[id].finished, "Cannot claim until pool is finished");
        require(lockedTokens[id][msg.sender] > 0, "Should have tokens to claim");
        uint256 amount = lockedTokens[id][msg.sender];
        lockedTokens[id][msg.sender] = 0;
        IERC20(pools[id].token).transfer(msg.sender, amount);
        emit Claim(id, msg.sender, amount);
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
