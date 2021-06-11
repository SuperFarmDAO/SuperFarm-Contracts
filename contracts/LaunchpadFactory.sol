// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.7.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./SelfStarterV2.sol";

contract LaunchpadFactory is Ownable, ReentrancyGuard {
  string public version = "v0.0";
  bool public whitelistEnforced;
  mapping (address => bool) public whitelistedOperators;

  // owner => launchpads[]
  mapping (address => address[]) public launchpads;
  //launchpad => launch timestamp
  mapping (address => uint256) public launchIndex;
  // launchpad => owner
  mapping (address => address) public operator;

  event LaunchpadDeployed(address indexed launchpadAddress, address indexed creator);

  constructor(string memory _version) {
    version = _version;
  }

  function launch(string memory _launchpadTitle) external returns (SelfStarterV2) {
    if(whitelistEnforced){
      require(whitelistedOperators[msg.sender], "FACTORY: OPERATOR NOT WHITELISTED");
    }
    SelfStarterV2 launchpad = new SelfStarterV2(_launchpadTitle);
    launchpad.transferOwnership(msg.sender);
    address launchpadAddress = address(launchpad);
    launchpads[msg.sender].push(launchpadAddress);
    operator[launchpadAddress] = msg.sender;
    launchIndex[launchpadAddress] = block.timestamp;
    emit LaunchpadDeployed(launchpadAddress, msg.sender);
    return launchpad;
  }

  function getLaunchpadCount(address _user) external view returns (uint256) {
    return launchpads[_user].length;
  }

  function toggleListEnforcement(bool _state) external onlyOwner {
    whitelistEnforced = _state;
  }

  function modWhiteList(address[] calldata _whiteList, bool _state) external onlyOwner {
    for (uint256 i = 0; i < _whiteList.length; ++i) {
      whitelistedOperators[_whiteList[i]] = _state;
    }
  }
}
