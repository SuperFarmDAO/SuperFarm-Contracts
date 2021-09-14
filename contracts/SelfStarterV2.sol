// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.7;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SelfStarterV2 is Ownable {
  using SafeERC20 for IERC20;


  struct Pool {
      uint256 cap;
      uint256 price;
      uint256 maxContribution;
      IERC20 token;
      bool isWhiteList;
      address onlyHolderToken;
      uint256 minHolderBalance;
      uint256 startTime;
      uint256 timespan;
      bool enabled;
      bool finished;
  }

  //uint256 private minHolderBalance = 1e19;
  uint32 private constant scaleFactor = 1e8;
  uint32 private constant sweepBuffer = 1e5;  //waiting period for sweep
  uint256 private constant minSpan = 1e5;

  string public idoTitle;

  Pool[] public pools;
  mapping(uint256 => uint256) public poolsSold;
  mapping(uint256 => mapping(address => uint256)) public lockedTokens;
  mapping(uint256 => mapping(address => uint256)) public whiteList;

  event NewSelfStarter(address creator, address instance, uint256 blockCreated, uint version);
  event NewPool(address owner, address listing, uint256 id);
  event Swap( uint256 id, uint256 roundID, address sender, uint256 amount, uint256 amt);
  event Claim(uint256 id, address claimer, uint256 amount);
  event PoolFinished(uint256 id);
  event PoolStarted(uint256 id);
  event WhiteList(uint256 id);

  constructor(string memory _title) {
    idoTitle = _title;
    emit NewSelfStarter(msg.sender, address(this), block.timestamp, uint(0));
  }

  modifier onlyPreLaunch(uint256 _id) {
    if(_isManual(_id)){
      require(!pools[_id].enabled, "Pool is already enabled");
      require(!pools[_id].finished, "Pool is already completed");
    }else{
      require(block.timestamp < pools[_id].startTime, "Pool start time has passed");
    }
    _;
  }

  //validators

  function _isOnlyHolder(uint256 _id) internal view returns(bool){
    return ( pools[_id].onlyHolderToken != address(0) &&  pools[_id].minHolderBalance > uint256(0));
  }

  function _isManual(uint256 _id) internal view returns(bool){
    return ( pools[_id].startTime == 0 && pools[_id].timespan == 0);
  }

  //setters

  function setMinHolderAmount(uint256 _id, uint256 _minHolderBalance) external onlyOwner onlyPreLaunch(_id) {
      pools[_id].minHolderBalance = _minHolderBalance;
  }

  function setHolderToken(uint256 _id, address _holderToken) external onlyOwner onlyPreLaunch(_id) {
      pools[_id].onlyHolderToken = _holderToken;
  }

  function setStartTime(uint256 _id, uint256 _startTime) external onlyOwner onlyPreLaunch(_id) {
      if(_startTime > 0){
        require(_startTime > block.timestamp, "Start time must be in future");
      }
      pools[_id].startTime = _startTime;
  }

  function setTimespan(uint256 _id, uint256 _timespan) external onlyOwner onlyPreLaunch(_id) {
      if(_timespan > 0){
        require((pools[_id].startTime + _timespan) > block.timestamp, "pool must end in the future, set start time");
      }
      require(pools[_id].startTime > 0, "Start time must be set first");
      uint256 computedTimespan = (pools[_id].startTime > 0 && _timespan < minSpan) ? minSpan : _timespan;
      pools[_id].timespan = computedTimespan;
  }
  //

  function setTitle(string memory _title) external onlyOwner{
      idoTitle = _title;
  }

  function addWhiteList(uint256 id, address[] calldata _whiteList, uint256[] calldata _caps) external onlyOwner onlyPreLaunch(id) {
      require(_whiteList.length == _caps.length, "whitelist array length mismatch");
      for (uint256 i = 0; i < _whiteList.length; ++i) {
          whiteList[id][_whiteList[i]] = _caps[i];
      }
      emit WhiteList(id);
  }

  function poolsLength() external view returns (uint256) {
      return pools.length;
  }

  function createPool(
      uint256 cap,
      uint256 price,
      uint256 maxContribution,
      IERC20 token,
      bool isWhiteList,
      address onlyHolderToken,
      uint256 minHolderBalance,
      uint256 startTime,
      uint256 timespan

  ) external onlyOwner returns (uint256) {
      require(cap <= token.balanceOf(msg.sender) && cap > 0, "Cap check");
      require(address(token) != address(0), "Pool token cannot be zero address");
      require(price > uint256(0), "Price must be greater than 0");
      if(startTime > 0){
        require(startTime > block.timestamp, "Start time must be in future");
      }
      uint256 computedTimespan = (startTime > 0 && timespan < minSpan) ? minSpan : timespan;
      Pool memory newPool =
          Pool(
              cap,
              price,
              maxContribution,
              token,
              isWhiteList,
              onlyHolderToken,
              minHolderBalance,
              startTime,
              computedTimespan,
              false,
              false
          );
      pools.push(newPool);
      token.transferFrom(msg.sender, address(this), cap);
      emit NewPool(msg.sender, address(this), pools.length);
      return pools.length;
  }

  function swap(uint256 id, uint256 amount) external payable {
      require(amount != 0, "Amount should not be zero");
      if(_isManual(id)){
        require(pools[id].enabled, "Pool must be enabled");
      }else{
        require(pools[id].startTime < block.timestamp && block.timestamp < pools[id].startTime + pools[id].timespan, "TIME: Pool not open");
      }
      if (_isOnlyHolder(id)) {
          require(IERC20(pools[id].onlyHolderToken).balanceOf(msg.sender) >= pools[id].minHolderBalance, "Miniumum balance not met");
      }
      if (pools[id].isWhiteList) {
          require(whiteList[id][msg.sender] > 0, "Should be white listed for the pool");
      }
      require(amount == msg.value, "Amount is not equal msg.value");

      Pool memory pool = pools[id];
      uint256 left = pool.cap - poolsSold[id];

      //console.log("left1", left);
      uint256 curLocked = lockedTokens[id][msg.sender];
      if (left > pool.maxContribution - curLocked) {
          left = pool.maxContribution - curLocked;
      }
      //console.log("left2", left);
      if (pools[id].isWhiteList && left >= whiteList[id][msg.sender] - curLocked) {
          left = whiteList[id][msg.sender] - curLocked;
      }
      //console.log("left3", left);
      //console.log("curLocked", curLocked, "allo", whiteList[id][msg.sender]);

      uint256 amt = (pool.price * amount) / scaleFactor;

      //console.log("amt", amt);
      require(left > 0, "Not enough tokens for swap");
      uint256 back = 0;
      if (left < amt) {
          //console.log("left", left);
          //console.log("amt_", amt);
          amt = left;
          uint256 newAmount = (amt * scaleFactor) / pool.price;
          back = amount - newAmount;
          amount = newAmount;
      }
      lockedTokens[id][msg.sender] = curLocked + amt;
      poolsSold[id] = poolsSold[id] + amt;

      (bool success, ) = payable(owner()).call{value: amount}("");
      require(success, "Should transfer ethers to the pool creator");
      if (back > 0) {
          (success, ) = payable(msg.sender).call{value: back}("");
          require(success, "Should transfer left ethers back to the user");
      }

      emit Swap(id, 0, msg.sender, amount, amt);
  }

  function startPool(uint256 id) external onlyOwner {
      //require(_isManual(id), "Pool is timed and not manual start");
      require(!pools[id].enabled, "Pool is already enabled");
      require(!pools[id].finished, "Pool is already completed");
      pools[id].enabled = true;
      emit PoolStarted(id);
  }

  function stopPool(uint256 id) external onlyOwner {
      //require(_isManual(id), "Pool is timed and not manual stop");
      require(pools[id].enabled, "Pool is not enabled");
      require(!pools[id].finished, "Pool is already completed");
      pools[id].enabled = false;
      pools[id].finished = true;
      emit PoolFinished(id);
  }

  function finalizePool(uint256 id) external onlyOwner {
    //require some time limit
    //sweep remaining tokens
  }

  function claim(uint256 id) external {
      if(_isManual(id)){
        require(pools[id].finished, "Cannot claim until pool is finished");
      }else{
        require(block.timestamp > pools[id].startTime + pools[id].timespan);
      }
      require(lockedTokens[id][msg.sender] > 0, "Should have tokens to claim");
      uint256 amount = lockedTokens[id][msg.sender];
      lockedTokens[id][msg.sender] = 0;
      pools[id].token.transfer(msg.sender, amount);
      emit Claim(id, msg.sender, amount);
  }



}