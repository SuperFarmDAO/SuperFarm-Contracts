// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../assets/erc721/interfaces/ISuper721.sol";
import "../assets/erc1155/interfaces/ISuper1155.sol";

/**
  @title A simple NFT auction contract which sells a single item for an owner to
    accept or decline via highest bid offer.
  @author thrpw;
  @author Tim Clancy

  This auction contract accepts on-chain bids before minting an NFT to the
  winner.
*/

/**
  @title A simple NFT auction contract which sells a single item on reserve.
  @author SuperFarm

  This auction contract accepts on-chain bids before minting an NFT to the
  winner.
*/

contract SuperAuction is Ownable, ReentrancyGuard {
    
    enum AssetType {
        Unminted721,
        Unminted1155,
        Minted721,
        Minted1155
    }

    /// The beneficiary of the auction sale.
    address payable public beneficiary;

    /// The original owner of the NFT contract.
    address public originalOwner;

    /// The item being auctioned.
    address public item;

    /// The type of NFT for auction 
    AssetType nft;      // CHECK more correct naming needed 

    /// The group ID within the item collection being auctioned for.
    uint256 public groupId;

    /// The time at which the auction ends.
    uint256 public auctionEndTime;

    /// The buffer duration within which we extend auctions.
    uint256 public bidBuffer;

    /// The buffer duration required to return the highest bid if no action taken.
    uint256 public receiptBuffer;

    /// The address of the current highest bidder.
    address public highestBidder;

    /// The current highest bid.
    uint256 public highestBid;

    /// The timestamp when the current highest bid was placed.
    uint256 public highestBidTime;

    /// The minimum bid allowed
    uint256 public minimumBid;

    /// The minimum price for the item sale.
    uint256 public reservePrice;

    /// Whether or not the auction has ended.
    bool public ended;

    /// A mapping of prior bids for users to withdraw.
    mapping(address => uint256) public pendingReturns;

    /// Record of all bids placed
    Bid[] public bidHistory;

    /// Bid storage
    struct Bid {
        address bidder;
        uint256 amount;
        uint256 timestamp;
    }

    /// An event to track an increase of the current highest bid.
    event HighestBidIncreased(
        address bidder,
        uint256 amount,
        uint256 timestamp
    );

    /// An event to track the auction ending.
    event AuctionEnded(
        address winner,
        uint256 amount,
        uint256 timestamp,
        bool success
    );

    /// An event to track the auction expiring.
    event AuctionExpired(address winner, uint256 amount, uint256 timestamp);

    /// An event to track the original item contract owner clawing back ownership.
    event OwnershipClawback();

    /// @dev a modifier which allows only `originalOwner` to call a function.
    modifier onlyOriginalOwner() {
        require(
            originalOwner == _msgSender(),
            "You are not the original owner of this contract."
        );
        _;
    }

    /**
    Construct a new auction by providing it with a beneficiary, NFT item, item
    group ID, and bidding time.

    @param _beneficiary An address for the auction beneficiary to receive funds.
    @param _item The Fee1155NFTLockable contract for the NFT collection being
      bid on.
    @param _groupId The group ID of the winning item within the NFT collection
      specified in `_item`.
    @param _duration The duration of the auction in seconds.
    @param _bidBuffer The buffer time at which a bid will extend the auction.
    @param _receiptBuffer The buffer time which the auction owner has to accept.
    @param _minimumBid The lowest starting bid for the auctioned item.
  */
    constructor(
        address payable _beneficiary,
        address _item,           // TODO 
        AssetType _nft,
        address _nftOwner,  // if assetType is minted
        uint256 _groupId,
        uint256 _duration,
        uint256 _bidBuffer,
        uint256 _receiptBuffer,
        uint256 _minimumBid,
        uint256 _reservePrice
    ) public {
        beneficiary = _beneficiary;
        originalOwner = _nftOwner;//_item.owner();
        item = _item;
        nft = _nft;
        groupId = _groupId;
        auctionEndTime = block.timestamp + _duration;
        bidBuffer = _bidBuffer;
        receiptBuffer = _receiptBuffer;
        minimumBid = _minimumBid;
        reservePrice = _reservePrice;
    }

    /**
    Bid on the auction with the value sent together with this transaction. The
    value will only be refunded if the auction is not won.
  */
    function bid() public payable nonReentrant {
        require(block.timestamp <= auctionEndTime, "Auction already ended.");
        require(msg.value > highestBid, "There already is a higher bid."); // CHECK may be error
        require(msg.value >= minimumBid, "Minimum bid amount not met.");

        // Extend the auction if a bid comes in within the ending buffer.
        uint256 timeRemaining = auctionEndTime - block.timestamp;
        if (timeRemaining < bidBuffer) {
            auctionEndTime = auctionEndTime + (bidBuffer);
        }

        // The previous highest bidder has been outbid. Return their bid.
        /// @dev We are intentionally not validating success on this payment call
        /// in order to prevent a potential attacker from halting the auction.
        if (highestBid != 0) {
            payable(highestBidder).call{value: highestBid}("");
        }

        // Update the highest bidder.
        highestBidder = msg.sender;
        highestBid = msg.value;
        highestBidTime = block.timestamp;
        emit HighestBidIncreased(msg.sender, msg.value, block.timestamp);
    }

    /**
    Accept the auction results. Send the highest bid to the beneficiary and mint
    the winner an NFT item.
  */
    function accept() public nonReentrant onlyOwner {
        require(block.timestamp >= auctionEndTime, "Auction not yet ended.");
        require(!ended, "The auction has already ended.");
        ended = true;

        // Take the highest bid (and any potential attacker dust) and mint the item.
        (bool success, ) = beneficiary.call{value: address(this).balance}("");
        require(success, "The beneficiary is unable to receive the bid.");

        // Mint the item.
        uint256[] memory itemIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        uint256 shiftedGroupId = groupId << 128;
        uint256 itemId = shiftedGroupId + 1;
        itemIds[0] = itemId;
        amounts[0] = 1;
        // CHECK put nothing in data 
        if (nft == AssetType.Unminted1155) {
            ISuper1155(item).mintBatch(highestBidder, itemIds, amounts, "");
        } else if (nft == AssetType.Unminted721) {
            ISuper721(item).mintBatch(highestBidder, itemIds, "");
        } else if (nft == AssetType.Minted1155) {
            ISuper1155(item).safeBatchTransferFrom(originalOwner, highestBidder, itemIds, amounts, "" );
        } else if (nft == AssetType.Minted721) {
            ISuper721(item).safeBatchTransferFrom(originalOwner, highestBidder, itemIds, "");
        }

        // The auction ended in a sale.
        emit AuctionEnded(highestBidder, highestBid, block.timestamp, true);
    }

    /**
    Decline the auction results and return the highest bid.
  */
    function decline() public nonReentrant onlyOwner {
        require(block.timestamp >= auctionEndTime, "Auction not yet ended.");
        require(!ended, "The auction has already ended.");
        ended = true;

        // Return the highest bidder their bid, plus any attacker dust.
        (bool bidderReturnSuccess, ) = payable(highestBidder).call{
            value: address(this).balance
        }("");

        // If the highest bidder is unable to receive their bid, send it to the
        // auction beneficiary to rescue.
        if (!bidderReturnSuccess) {
            (bool beneficiaryRescueSuccess, ) = beneficiary.call{
                value: address(this).balance
            }("");
            require(
                beneficiaryRescueSuccess,
                "The beneficiary is unable to rescue the bid."
            );
        }

        // The auction ended in failure.
        emit AuctionEnded(highestBidder, highestBid, block.timestamp, false);
    }

    /*
    The auction owner has not taken action to conclude the auction. After a set
    timeout period we allow anyone to conclude the auction.
  */
    function returnHighestBid() public nonReentrant {
        require(
            block.timestamp >= auctionEndTime + (receiptBuffer),
            "Auction not yet expired."
        );
        require(!ended, "The auction has already ended.");
        ended = true;

        // Return the highest bidder their bid and any potential attacker dust.
        (bool bidderReturnSuccess, ) = payable(highestBidder).call{
            value: address(this).balance
        }("");

        // If the highest bidder is unable to receive their bid, send it to the
        // auction beneficiary.
        if (!bidderReturnSuccess) {
            (bool beneficiaryRescueSuccess, ) = beneficiary.call{
                value: address(this).balance
            }("");
            require(
                beneficiaryRescueSuccess,
                "The beneficiary is unable to rescue the bid."
            );
        }

        // The auction expired.
        emit AuctionExpired(highestBidder, highestBid, block.timestamp);
    }

    /**
    Withdraw a bid that was defeated.
  */
    function withdraw() public nonReentrant returns (bool) {
        uint256 amount = pendingReturns[msg.sender];
        if (amount > 0) {
            pendingReturns[msg.sender] = 0;
            (bool withdrawSuccess, ) = payable(msg.sender).call{value: amount}(
                ""
            );
            if (!withdrawSuccess) {
                pendingReturns[msg.sender] = amount;
                return false;
            }
        }
        return true;
    }

    /**
    End the auction. Send the highest bid to the beneficiary and mint the winner
    an NFT item. If the reserve price was not met, return the highest bid.
  */
    function auctionEnd() public nonReentrant {
        require(block.timestamp >= auctionEndTime, "Auction not yet ended.");
        require(!ended, "The auction has already ended.");
        ended = true;

        // If the reserve price is not met, return the highest bid.
        if (reservePrice >= highestBid) {
            (bool bidderReturnSuccess, ) = payable(highestBidder).call{
                value: highestBid
            }("");

            // The auction ended in failure.
            emit AuctionEnded(
                highestBidder,
                highestBid,
                block.timestamp,
                false
            );

            // Otherwise, take the highest bid and mint the item.
        } else {
            (bool beneficiarySendSuccess, ) = payable(highestBidder).call{
                value: highestBid
            }("");

            // Mint the items.
            uint256[] memory itemIds = new uint256[](1);
            uint256[] memory amounts = new uint256[](1);
            uint256 shiftedGroupId = groupId << 128;
            uint256 itemId = shiftedGroupId + 1;
            itemIds[0] = itemId;
            amounts[0] = 1;
            
            if (nft == AssetType.Unminted1155) {
                ISuper1155(item).mintBatch(highestBidder, itemIds, amounts, "");
            } else if (nft == AssetType.Unminted721) {
                ISuper721(item).mintBatch(highestBidder, itemIds, "");
            } else if (nft == AssetType.Minted1155) {
                ISuper1155(item).safeBatchTransferFrom(originalOwner, highestBidder, itemIds, amounts, "" );
            } else if (nft == AssetType.Minted721) {
                ISuper721(item).safeBatchTransferFrom(originalOwner, highestBidder, itemIds, "");
            }
            // The auction ended in a sale.
            emit AuctionEnded(highestBidder, highestBid, block.timestamp, true);
        }
    }

    /**
    A function which allows the original owner of the item contract to revoke
    ownership from the launchpad.
  */
    //function ownershipClawback() external onlyOriginalOwner {
    //    item.transferOwnership(originalOwner);
//
    //    // Emit an event that the original owner of the item contract has clawed the contract back.
    //    emit OwnershipClawback();
    //}
}
