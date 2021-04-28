// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

/**
  @title A token vesting contract for streaming claims.
  @author SuperFarm

  This vesting contract allows users to claim vested tokens with every block.
*/
contract VestStream {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;
  using Address for address;

  /// The token to disburse in vesting.
  IERC20 public token;

  // Information for a particular token claim.
  // - creator: the address which created the particular claim.
  // - beneficiary: the address to whom claimed tokens are sent.
  // - totalAmount: the total size of the token claim.
  // - startTime: the timestamp in seconds when the vest begins.
  // - endTime: the timestamp in seconds when the vest completely matures.
  // - lastCLaimTime: the timestamp in seconds of the last time the claim was utilized.
  // - amountClaimed: the total amount claimed from the entire claim.
  struct Claim {
    address creator;
    address beneficiary;
    uint256 totalAmount;
    uint256 startTime;
    uint256 endTime;
    uint256 lastClaimTime;
    uint256 amountClaimed;
  }

  /// An array of claims processed by this smart contract.
  Claim[] private claims;

  /// A mapping of addresses to the array of indices for claims they created.
  mapping(address => uint256[]) private _creatorClaims;

  /// A mapping of addresses to the array of indices for claims they receive.
  mapping(address => uint256[]) private _beneficiaryClaims;

  /// An event for tracking the creation of a token vest claim.
  event ClaimCreated(address creator, address beneficiary, uint256 index);

  /// An event for tracking a user claiming some of their vested tokens.
  event Claimed(address creator, address beneficiary, uint256 amount, uint256 index);

  /**
    Construct a new VestStream by providing it a token to disburse.

    @param _token The token to vest to claimants in this contract.
  */
  constructor(IERC20 _token) public {
    token = _token;
  }

  /**
    A function which allows the caller to retrieve information about a specific
    creator via the claim indices they created.

    @param creator the creator to query claims for.
  */
  function creatorClaims(address creator) external view returns (uint256[] memory) {
    require(creator != address(0), "The zero address may not be a claim creator.");
    return _creatorClaims[creator];
  }

  /**
    A function which allows the caller to retrieve information about a specific
    beneficiary via the claim indices they will receive vests for.

    @param beneficiary the beneficiary to query claims for.
  */
  function beneficiaryClaims(address beneficiary) external view returns (uint256[] memory) {
    require(beneficiary != address(0), "The zero address may not be a claim beneficiary.");
    return _beneficiaryClaims[beneficiary];
  }

  /**
    A function which allows the caller to retrieve information about a specific
    claim via its index.

    @param index the index of a particular claim.
  */
  function getClaim(uint256 index) external view returns (Claim memory) {
    return claims[index];
  }

  /**
    A function which allows the caller to retrieve information about a specific
    claim's remaining claimable amount.

    @param index the index of a particular claim.
  */
  function claimableAmount(uint256 index) public view returns (uint256) {
    Claim storage claim = claims[index];

    // Calculate the current releasable token amount.
    uint256 currentTimestamp = block.timestamp > claim.endTime ? claim.endTime : block.timestamp;
    uint256 claimPercent = currentTimestamp.sub(claim.startTime).mul(1e18).div(claim.endTime.sub(claim.startTime));
    uint256 claimAmount = claim.totalAmount.mul(claimPercent).div(1e18);

    // Reduce the unclaimed amount by the amount already claimed.
    uint256 unclaimedAmount = claimAmount.sub(claim.amountClaimed);
    return unclaimedAmount;
  }

  /**
    A function which allows the caller to create toke vesting claims for some
    beneficiaries. The disbursement token will be taken from the claim creator.

    @param _beneficiaries an array of addresses to construct token claims for.
    @param _startTime a timestamp when this claim is to begin vesting.
    @param _endTime a timestamp when this claim is to reach full maturity.
    @param _totalAmount the total amount of tokens to be disbursed in this claim.
  */
  function createClaim(address[] memory _beneficiaries, uint256 _startTime, uint256 _endTime, uint256 _totalAmount) external {
    require(_beneficiaries.length > 0, "You must specify at least one beneficiary for a claim.");
    require(_endTime >= _startTime, "You may not create a claim which ends before it starts.");
    require(_totalAmount > 0, "You may not create a zero-token claim.");

    // Transfer all of the tokens needed to fulfill this claim from the creator.
    token.safeTransferFrom(msg.sender, address(this), _totalAmount.mul(_beneficiaries.length));

    // After validating the details for this token claim, initialize a claim for
    // each specified beneficiary.
    for (uint256 i = 0; i < _beneficiaries.length; i++) {
      address _beneficiary = _beneficiaries[i];
      require(_beneficiary != address(0), "The zero address may not be a beneficiary.");

      // Establish a claim for this particular beneficiary.
      Claim memory claim = Claim({
        creator: msg.sender,
        beneficiary: _beneficiary,
        totalAmount: _totalAmount,
        startTime: _startTime,
        endTime: _endTime,
        lastClaimTime: _startTime,
        amountClaimed: 0
      });
      claims.push(claim);
      uint256 index = claims.length.sub(1);

      // Map the claim index to its creator and beneficiary.
      _creatorClaims[msg.sender].push(index);
      _beneficiaryClaims[_beneficiary].push(index);
      emit ClaimCreated(msg.sender, _beneficiary, index);
    }
  }

  /**
    A function which allows the caller to send a claim's unclaimed amount to the
    beneficiary of the claim.

    @param index the index of a particular claim.
  */
  function claim(uint256 index) external {
    Claim storage claim = claims[index];

    // Verify that the claim is still active.
    require(claim.lastClaimTime < claim.endTime, "This claim has already been completely claimed.");

    // Calculate the current releasable token amount.
    uint256 currentTimestamp = block.timestamp > claim.endTime ? claim.endTime : block.timestamp;
    uint256 claimPercent = currentTimestamp.sub(claim.startTime).mul(1e18).div(claim.endTime.sub(claim.startTime));
    uint256 claimAmount = claim.totalAmount.mul(claimPercent).div(1e18);

    // Reduce the unclaimed amount by the amount already claimed.
    uint256 unclaimedAmount = claimAmount.sub(claim.amountClaimed);

    // Update the amount currently claimed by the user.
    claim.amountClaimed = claimAmount;

    // Verify that there is an unclaimed balance.
    require(unclaimedAmount > 0, "There is no unclaimed balance.");

    // Transfer the unclaimed tokens to the beneficiary.
    token.safeTransferFrom(address(this), claim.beneficiary, unclaimedAmount);

    // Update the last time the claim was utilized.
    claim.lastClaimTime = currentTimestamp;

    // Emit an event for this token claim.
    emit Claimed(claim.creator, claim.beneficiary, unclaimedAmount, index);
  }
}
