// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../assets/erc721/interfaces/ISuper721.sol";
import "../assets/erc1155/interfaces/ISuper1155.sol";
import "../access/PermitControl.sol";

/**
  @title A token vesting contract for streaming claims.
  @author SuperFarm
  @author Nikita Elunin
  This vesting contract allows users to claim vested tokens with every block.
*/
contract VestStream is PermitControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant CREATE_CLAIM = keccak256("CREATE_CLAIM");

    /// The token to disburse in vesting.
    IERC20 public token;

    enum RewardType {
        Day,
        Minute,
        Second
    }

    struct Reward {
        uint256 amount;
        RewardType rewardType;
    }

    struct Requirment {
        address asset;
        uint256 amount;
        RequirmentType requirmentType;
        uint256[] ids;
    }

    enum RequirmentType {
        Eth,
        ERC20,
        ERC1155,
        ERC721
    }

    // Information for a particular token claim.
    // - totalAmount: the total size of the token claim.
    // - startTime: the timestamp in seconds when the vest begins.
    // - endTime: the timestamp in seconds when the vest completely matures.
    // - lastCLaimTime: the timestamp in seconds of the last time the claim was utilized.
    // - amountClaimed: the total amount claimed from the entire claim.
    struct Claim {
        uint256 startTime;
        uint256 endTime;
        Requirment requirment;
        Reward reward;
        bool isEth;
        mapping(address => uint256) lastClaimTime;
        mapping(address => uint256) amountsClaimed;
    }

    struct ClaimOutput {
        uint256 totalAmount;
        uint256 amountClaimed;
        uint256 startTime;
        uint256 endTime;
        uint256 lastClaimTime;
        // uint256 rewardPerDay;
        Reward reward;
        Requirment requirment;
    }

    // A mapping of addresses to the claim received.
    mapping(bytes => Claim) private claims;

    /// An event for tracking the creation of a token vest claim.
    event ClaimCreated(address creator, bytes indexed salt);

    /// An event for tracking a user claiming some of their vested tokens.
    event Claimed(address indexed beneficiary, uint256 amount);

    /// An event that indicates that contract receives ether for rewards.
    event Receive(address caller, uint256 amount);

    /**
    Construct a new VestStream by providing it a token to disburse.
    @param _token The token to vest to claimants in this contract.
  */
    constructor(IERC20 _token) {
        token = _token;
        uint256 MAX_INT = 2**256 - 1;
        token.approve(address(this), MAX_INT);
    }

    /**
    A function which allows the caller to retrieve information about a specific
    claim via its beneficiary.
    @param beneficiary the beneficiary to query claims for.
  */
    function getClaim(address beneficiary, bytes calldata salt)
        external
        view
        returns (ClaimOutput memory output)
    {
        require(
            beneficiary != address(0),
            "The zero address may not be a claim beneficiary."
        );
        Claim storage claim = claims[salt];
        output.amountClaimed = claim.amountsClaimed[beneficiary];
        output.startTime = claim.startTime;
        output.endTime = claim.endTime;
        output.lastClaimTime = claim.lastClaimTime[beneficiary];
        output.requirment = claim.requirment;
        output.reward = claim.reward;
        return output;
    }

    /**
    A function which allows the caller to retrieve information about a specific
    claim's remaining claimable amount.
    @param beneficiary the beneficiary to query claims for.
  */
    function claimableAmount(address beneficiary, bytes calldata salt)
        public
        view
        returns (uint256)
    {
        Claim storage claim = claims[salt];

        // Early-out if the claim has not started yet.
        if (claim.startTime == 0 || block.timestamp < claim.startTime) {
            return 0;
        }

        // Calculate the current releasable token amount.
        uint256 currentTimestamp = block.timestamp > claim.endTime
            ? claim.endTime
            : block.timestamp;

        uint256 reward = getRewardAmount(salt);
        uint256 time = currentTimestamp - claim.lastClaimTime[beneficiary];
        if (claim.lastClaimTime[beneficiary] == 0) {
            time = currentTimestamp - claim.startTime;
        }
        uint256 claimAmount = reward * time;

        // Reduce the unclaimed amount by the amount already claimed.
        return claimAmount;
    }

    function getRewardAmount(bytes calldata salt)
        private
        view
        returns (uint256)
    {
        Claim storage claim = claims[salt];
        if (claim.reward.rewardType == RewardType.Day) {
            return claim.reward.amount / 86400;
        }
        if (claim.reward.rewardType == RewardType.Minute) {
            return claim.reward.amount / 60;
        }
        if (claim.reward.rewardType == RewardType.Second) {
            return claim.reward.amount;
        }
        return 0;
    }

    /**
    Sweep all of a particular ERC-20 token from the contract.
    @param _token The token to sweep the balance from.
  */
    function sweep(IERC20 _token) external onlyOwner {
        uint256 balance = _token.balanceOf(address(this));
        _token.safeTransferFrom(address(this), msg.sender, balance);
    }

    /**
    A function which allows the caller to create toke vesting claims for some
    beneficiaries. The disbursement token will be taken from the claim creator.
    @param _beneficiaries an array of addresses to construct token claims for.
    @param _totalAmounts the total amount of tokens to be disbursed to each beneficiary.
    @param _startTime a timestamp when this claim is to begin vesting.
    @param _endTime a timestamp when this claim is to reach full maturity.
  */
    function createClaim(
        address[] calldata _beneficiaries,
        uint256[] calldata _totalAmounts,
        uint256 _startTime,
        uint256 _endTime,
        Requirment calldata _requirment,
        Reward calldata _rewards,
        bytes calldata salt,
        bool _isEth
    ) external hasValidPermit(UNIVERSAL, CREATE_CLAIM) {
        require(
            _beneficiaries.length > 0,
            "You must specify at least one beneficiary for a claim."
        );
        require(
            _beneficiaries.length == _totalAmounts.length,
            "Beneficiaries and their amounts may not be mismatched."
        );
        require(
            _endTime >= _startTime,
            "You may not create a claim which ends before it starts."
        );

        Claim storage claim = claims[salt];
        claim.startTime = _startTime;
        claim.endTime = _endTime;
        claim.requirment = _requirment;
        claim.isEth = _isEth;
        claim.reward = _rewards;

        emit ClaimCreated(msg.sender, salt);
    }

    /**
    A function which allows the caller to send a claim's unclaimed amount to the
    beneficiary of the claim.
    @param salt the salt to identify transaction .
  */
    function claim(bytes calldata salt) external nonReentrant {
        Claim storage _claim = claims[salt];

        require(claimCheck(msg.sender, salt));
        // Calculate the current releasable token amount.
        uint256 currentTimestamp = block.timestamp > _claim.endTime
            ? _claim.endTime
            : block.timestamp;

        uint256 amount = claimableAmount(msg.sender, salt);

        require(amount > 0, "Nothing to claim");
        // Transfer the unclaimed tokens to the beneficiary.

        if (_claim.isEth) {
            (bool success, ) = payable(msg.sender).call{value: amount}("");
            require(success, "Claim failed");
        } else {
            token.safeTransfer(msg.sender, amount);
        }

        // Update the amount currently claimed by the user.
        _claim.amountsClaimed[msg.sender] = amount;

        // Update the last time the claim was utilized.
        _claim.lastClaimTime[msg.sender] = currentTimestamp;

        // Update the claim structure being tracked.
        // claims[salt] = _claim;

        // Emit an event for this token claim.
        emit Claimed(msg.sender, amount);
    }

    function claimCheck(address beneficiary, bytes calldata salt)
        private
        view
        returns (bool)
    {
        Claim storage _claim = claims[salt];

        // Verify that the claim is still active.
        require(
            _claim.lastClaimTime[beneficiary] < _claim.endTime,
            "This claim has already been completely claimed."
        );
        if (_claim.requirment.requirmentType == RequirmentType.Eth) {
            require(
                beneficiary.balance >= _claim.requirment.amount,
                "Not enough ETH"
            );
        }
        if (_claim.requirment.requirmentType == RequirmentType.ERC20) {
            require(
                IERC20(_claim.requirment.asset).balanceOf(beneficiary) >=
                    _claim.requirment.amount,
                "Not enough ERC20"
            );
        }

        if (_claim.requirment.ids.length != 0) {
            if (_claim.requirment.requirmentType == RequirmentType.ERC1155) {
                require(
                    ISuper1155(_claim.requirment.asset).balanceOfBatch(
                        _asSingletonArray(beneficiary),
                        _claim.requirment.ids
                    )[0] >= _claim.requirment.amount,
                    "Not enough ERC1155 tokens"
                );
            }
            if (_claim.requirment.requirmentType == RequirmentType.ERC721) {
                require(
                    ISuper721(_claim.requirment.asset).balanceOfBatch(
                        _asSingletonArray(beneficiary),
                        _claim.requirment.ids
                    )[0] >= _claim.requirment.amount,
                    "Not enough ERC721 tokens"
                );
            }
        } else {
            if (_claim.requirment.requirmentType == RequirmentType.ERC1155) {
                require(
                    ISuper1155(_claim.requirment.asset).totalBalances(
                        beneficiary
                    ) >= _claim.requirment.amount,
                    "Not enough ERC1155 tokens"
                );
            }
            if (_claim.requirment.requirmentType == RequirmentType.ERC721) {
                require(
                    ISuper721(_claim.requirment.asset).balanceOf(beneficiary) >=
                        _claim.requirment.amount,
                    "Not enough ERC721 tokens"
                );
            }
        }

        return true;
    }

    /**
    This private helper function converts an address into a single-element array.
        @param _element The element to convert to an array.
        @return The array containing the single `_element`.
    */
    function _asSingletonArray(address _element)
        private
        pure
        returns (address[] memory)
    {
        address[] memory array = new address[](1);
        array[0] = _element;
        return array;
    }

    receive() external payable {
        emit Receive(msg.sender, msg.value);
    }
}