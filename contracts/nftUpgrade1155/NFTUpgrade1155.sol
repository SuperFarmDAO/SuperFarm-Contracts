// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./ISuper1155.sol";

/**
  @title NFTUpgrade1155: a contract for redeeming ERC-1155 token claims with
    optional burns.
  @author 0xthrpw
  @author Tim Clancy

  This contract allows a specific ERC-1155 token of a given group ID to be
  redeemed or burned in exchange for a new token from a new group in an
  optionally-new ERC-1155 token contract.
*/
contract NFTUpgrade1155 is Ownable, ReentrancyGuard {
  using SafeMath for uint256;

  /// The smart contract being used in redemptions.
  ISuper1155 public super1155;

  /// The address being used as a custom burn address.
  address public burnAddress;

  bool public customBurn;

  /**
  */
  struct RedemptionConfig {
    uint256 groupIdOut;
    uint256 amountOut;
    bool burnOnRedemption;
  }

  // collection in => collection out => groupId in => config
  mapping(address => mapping(address => mapping(uint256 => RedemptionConfig))) public redemptionConfigs;

  //[_tokenOut][groupIdOut][_tokenIn][_tokenId]
  // collection out => groupIdOut => collection in => tokenId in => address of redeemer
  mapping (address => mapping (uint256 => mapping(address => mapping(uint256 => address)))) public redeemer;

  /**
  */
  event TokenRedemption(address indexed user, address indexed tokenIn, uint256 tokenIdIn, address indexed tokenOut, uint256[] tokensOut);

  /**
  */
  event ConfigUpdate(address indexed tokenIn, uint256 indexed groupIdIn, uint256 groupIdOut, address indexed tokenOut, uint256 amountOut, bool burnOnRedemption);

  /**
    On deployment, set the burn address as `_burnTarget` and enable use of a
    custom burn address by setting `_customBurn`.

    @param _burnTarget The address that will be used for burning tokens.
    @param _customBurn Whether or not a custom burn address is used.
  */
  constructor(address _burnTarget, bool _customBurn) {
    customBurn = _customBurn;
    if (customBurn) {
      require(_burnTarget != address(0), "TokenRedeemer::constructor: Custom burn address cannot be 0 address");
      burnAddress = _burnTarget;
    }
  }

  /**
    Redeem a specific token `_tokenId` for a token from group `_groupIdOut`

    @param _tokenId The bitpacked 1155 token id
    @param _tokenIn The collection address of the redeemedable item
    @param _tokenOut The address of the token to receive
  */
  function redeem(
    uint256 _tokenId,
    address _tokenIn,
    address _tokenOut
  ) external nonReentrant {
    _redeemToken(_tokenId, _tokenIn, _tokenOut);
  }

  /**
    Redeem a specific set of tokens `_tokenIds` for a set of token from group `_groupIdOut`

    @param _tokenIds An array of bitpacked 1155 token ids
    @param _tokenIn The collection address of the redeemedable item
    @param _tokenOut The address of the token to receive
  */
  function redeemMult(
    uint256[] calldata _tokenIds,
    address _tokenIn,
    address _tokenOut
  ) external nonReentrant {
    for(uint256 n = 0; n < _tokenIds.length; n++){
      _redeemToken(_tokenIds[n], _tokenIn, _tokenOut);
    }
  }

  /**
    Redeem a token for n number of tokens in return.  This function parses the
    tokens group id, determines the appropriate exchange token and amount, if
    necessary burns the deposited token and mints the receipt token(s)

    @param _tokenId The bitpacked 1155 token id
    @param _tokenIn The collection address of the redeemedable item
    @param _tokenOut The collection address of the token being received
  */
  function _redeemToken(
    uint256 _tokenId,
    address _tokenIn,
    address _tokenOut
  ) internal {
    uint256 _groupIdIn = _tokenId >> 128;
    RedemptionConfig memory config = redemptionConfigs[_tokenIn][_tokenOut][_groupIdIn];
    uint256 redemptionAmount = config.amountOut;
    uint256 groupIdOut = config.groupIdOut;
    require(redeemer[_tokenOut][groupIdOut][_tokenIn][_tokenId] == address(0), "TokenRedeemer::redeem: token has already been redeemed for this group" );

    {
      require(groupIdOut != uint256(0), "TokenRedeemer::redeem: invalid group id from token");
      require(redemptionAmount != uint256(0), "TokenRedeemer::redeem: invalid redemption amount");

      uint256 balanceOfSender = ISuper1155(_tokenIn).balanceOf(_msgSender(), _tokenId);
      require(balanceOfSender != 0, "TokenRedeemer::redeem: msg sender is not token owner");
    }

    uint256 mintCount = ISuper1155(_tokenOut).groupMintCount(groupIdOut);
    uint256 nextId = mintCount.add(1);
    uint256[] memory ids = new uint256[](redemptionAmount);
    uint256[] memory amounts = new uint[](redemptionAmount);

    uint256 newgroupIdPrep = groupIdOut << 128;
    for(uint256 i = 0; i < redemptionAmount; i++) {
      ids[i] = newgroupIdPrep.add(nextId).add(i);
      amounts[i] = uint256(1);
    }

    redeemer[_tokenOut][groupIdOut][_tokenIn][_tokenId] = _msgSender();

    if (config.burnOnRedemption) {
      if (customBurn) {
        ISuper1155(_tokenIn).safeTransferFrom(_msgSender(), burnAddress, _tokenId, 1, "");
      } else {
        ISuper1155(_tokenIn).burnBatch(_msgSender(), _asSingletonArray(_tokenId), _asSingletonArray(1));
      }
    }

    ISuper1155(_tokenOut).mintBatch(_msgSender(), ids, amounts, "");

    emit TokenRedemption(_msgSender(), _tokenIn, _tokenId, _tokenOut, ids);
  }

  /**
    Configure redemption amounts for each group.  ONE token of _groupIdin from
    collection _tokenIn results in _amountOut number of _groupIdOut tokens from
    collection _tokenOut

    @param _tokenIn The collection address of the redeemedable item
    @param _groupIdIn The group ID of the token being redeemed
    @param _tokenOut The collection address of the item being received
    @param _data The redemption config data input.
  */

  function setRedemptionConfig(
    address _tokenIn,
    uint256 _groupIdIn,
    address _tokenOut,
    RedemptionConfig calldata _data
  ) external onlyOwner {
    redemptionConfigs[_tokenIn][_tokenOut][_groupIdIn] = RedemptionConfig({
      groupIdOut: _data.groupIdOut,
      amountOut: _data.amountOut,
      burnOnRedemption: _data.burnOnRedemption
    });

    emit ConfigUpdate(_tokenIn, _groupIdIn, _data.groupIdOut, _tokenOut, _data.amountOut, _data.burnOnRedemption);
  }

  /**
    This private helper function converts a number into a single-element array.

    @param _element The element to convert to an array.
    @return The array containing the single `_element`.
  */
  function _asSingletonArray(uint256 _element) private pure returns (uint256[] memory) {
    uint256[] memory array = new uint256[](1);
    array[0] = _element;
    return array;
  }
}
