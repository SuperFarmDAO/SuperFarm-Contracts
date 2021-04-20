pragma solidity ^0.6.2;

// REMIX
// import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/solc-0.6/contracts/token/ERC20/ERC20.sol";
// import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/solc-0.6/contracts/math/SafeMath.sol";
// import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/solc-0.6/contracts/utils/Address.sol";

// TRUFFLE
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract SuperVestStream {
    using SafeMath for uint256;
    using Address for address;

    address public tokenAddress;

    event Claimed(
        address owner,
        address beneficiary,
        uint256 amount,
        uint256 index
    );
    event ClaimCreated(address owner, address beneficiary, uint256 index);

    struct Claim {
        address owner;
        address beneficiary;
        uint256[] timePeriods;
        uint256[] tokenAmounts;
        uint256 totalAmount;
        uint256 amountClaimed;
        uint256 periodsClaimed;
    }
    Claim[] private claims;

    mapping(address => uint256[]) private _ownerClaims;
    mapping(address => uint256[]) private _beneficiaryClaims;

    constructor(address _tokenAddress) public {
        tokenAddress = _tokenAddress;
    }

    /**
     * Get Owner Claims
     *
     * @param owner - Claim Owner Address
     */
    function ownerClaims(address owner)
        external
        view
        returns (uint256[] memory)
    {
        require(owner != address(0), "Owner address cannot be 0");
        return _ownerClaims[owner];
    }

    /**
     * Get Beneficiary Claims
     *
     * @param beneficiary - Claim Owner Address
     */
    function beneficiaryClaims(address beneficiary)
        external
        view
        returns (uint256[] memory)
    {
        require(beneficiary != address(0), "Beneficiary address cannot be 0");
        return _beneficiaryClaims[beneficiary];
    }

    /**
     * Get Amount Claimed
     *
     * @param index - Claim Index
     */
    function claimed(uint256 index) external view returns (uint256) {
        return claims[index].amountClaimed;
    }

    /**
     * Get Total Claim Amount
     *
     * @param index - Claim Index
     */
    function totalAmount(uint256 index) external view returns (uint256) {
        return claims[index].totalAmount;
    }

    /**
     * Get Time Periods of Claim
     *
     * @param index - Claim Index
     */
    function timePeriods(uint256 index)
        external
        view
        returns (uint256[] memory)
    {
        return claims[index].timePeriods;
    }

    /**
     * Get Token Amounts of Claim
     *
     * @param index - Claim Index
     */
    function tokenAmounts(uint256 index)
        external
        view
        returns (uint256[] memory)
    {
        return claims[index].tokenAmounts;
    }

    /**
     * Create a Claim - To Vest Tokens to Beneficiary
     *
     * @param _beneficiary - Tokens will be claimed by _beneficiary
     * @param _startBlock - Block Number to start vesting from
     * @param _stopBlock - Block Number to end vesting at (Release all tokens)
     * @param _totalAmount - Total Amount to be Vested
     * @param _blockTime - Block Time (used for predicting _timePeriods)
     */
    function createClaim(
        address _beneficiary,
        uint256 _startBlock,
        uint256 _stopBlock,
        uint256 _totalAmount,
        uint256 _blockTime
    ) external returns (bool) {
        require(
            _stopBlock > _startBlock,
            "_stopBlock must be greater than _startBlock"
        );
        require(tokenAddress.isContract(), "Invalid tokenAddress");
        require(_beneficiary != address(0), "Cannot Vest to address 0");
        require(_totalAmount > 0, "Provide Token Amounts to Vest");
        require(
            ERC20(tokenAddress).allowance(msg.sender, address(this)) >=
                _totalAmount,
            "Provide token allowance to SuperVestStream contract"
        );
        // Calculate estimated epoch for _startBlock
        uint256 startTime;
        // ==================================
        // Commented code can be used if we want
        // startTime to be now in the event of
        // _startBlock being behind current block
        // ==================================
        //
        // if ((_startBlock - block.number) <= 0) {
        //     startTime = block.timestamp;
        // } else {
        startTime =
            block.timestamp +
            (_blockTime * (_startBlock - block.number));
        // }
        // Calculate _timePeriods & _tokenAmounts
        uint256 diff = _stopBlock - _startBlock;
        uint256 amountPerBlock = _totalAmount / diff;
        uint256[] memory _timePeriods = new uint256[](diff);
        uint256[] memory _tokenAmounts = new uint256[](diff);
        _timePeriods[0] = startTime;
        _tokenAmounts[0] = amountPerBlock;
        for (uint256 i = 1; i < diff; i++) {
            _timePeriods[i] = _timePeriods[i - 1] + _blockTime;
            _tokenAmounts[i] = amountPerBlock;
        }
        // Transfer Tokens to SuperVestStream
        ERC20(tokenAddress).transferFrom(
            msg.sender,
            address(this),
            _totalAmount
        );
        // Create Claim
        Claim memory claim =
            Claim({
                owner: msg.sender,
                beneficiary: _beneficiary,
                timePeriods: _timePeriods,
                tokenAmounts: _tokenAmounts,
                totalAmount: _totalAmount,
                amountClaimed: 0,
                periodsClaimed: 0
            });
        claims.push(claim);
        uint256 index = claims.length - 1;
        // Map Claim Index to Owner & Beneficiary
        _ownerClaims[msg.sender].push(index);
        _beneficiaryClaims[_beneficiary].push(index);
        emit ClaimCreated(msg.sender, _beneficiary, index);
        return true;
    }

    /**
     * Claim Tokens
     *
     * @param index - Index of the Claim
     */
    function claim(uint256 index) external {
        Claim storage claim = claims[index];
        // Check if msg.sender is the beneficiary
        require(
            claim.beneficiary == msg.sender,
            "Only beneficiary can claim tokens"
        );
        // Check if anything is left to release
        require(
            claim.periodsClaimed < claim.timePeriods.length,
            "Nothing to release"
        );
        // Calculate releasable amount
        uint256 amount = 0;
        for (
            uint256 i = claim.periodsClaimed;
            i < claim.timePeriods.length;
            i++
        ) {
            if (claim.timePeriods[i] <= block.timestamp) {
                amount = amount.add(claim.tokenAmounts[i]);
                claim.periodsClaimed = claim.periodsClaimed.add(1);
            } else {
                break;
            }
        }
        // If there is any amount to release
        require(amount > 0, "Nothing to release");
        // Transfer Tokens from Owner to Beneficiary
        ERC20(tokenAddress).transfer(claim.beneficiary, amount);
        claim.amountClaimed = claim.amountClaimed.add(amount);
        emit Claimed(claim.owner, claim.beneficiary, amount, index);
    }

    /**
     * Get Amount of tokens that can be claimed
     *
     * @param index - Index of the Claim
     */
    function claimableAmount(uint256 index) public view returns (uint256) {
        Claim storage claim = claims[index];
        // Calculate Claimable Amount
        uint256 amount = 0;
        for (
            uint256 i = claim.periodsClaimed;
            i < claim.timePeriods.length;
            i++
        ) {
            if (claim.timePeriods[i] <= block.timestamp) {
                amount = amount.add(claim.tokenAmounts[i]);
            } else {
                break;
            }
        }
        return amount;
    }
}
