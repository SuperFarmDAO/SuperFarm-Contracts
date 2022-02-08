// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.8;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "../../assets/erc1155/interfaces/ISuper1155.sol";
import "../../assets/erc721/interfaces/ISuper721.sol";
import "../../interfaces/ISuperGeneric.sol";


/**
  @title TokenRedeemer: a contract for redeeming ERC-1155 token claims with
    optional burns.
  @author 0xthrpw
  @author Tim Clancy

  This contract allows a specific ERC-1155 token of a given group ID to be
  redeemed or burned in exchange for a new token from a new group in an
  optionally-new ERC-1155 token contract.
*/
contract TokenRedeemerV3 is Ownable, ReentrancyGuard {

  /// The smart contract being used in redemptions.
  ISuper721 public super721;

  /// The address being used as a custom burn address.
  address public burnAddress;

  bool public customBurn;

  /**
  */
  struct RedemptionConfig {
    uint256 groupIdOut;
    uint256 amountOut;
    bool burnOnRedemption;
    // address[] requirements;
    // ReedeemNftType nftType;
    Requirement[] requirements;
  }

  struct Requirement {
      address collection;
      uint256[] tokenId;
  }

//   enum ReedeemNftType {
//       ERC721,
//       ERC1155
//   }

  // groupIdIn => collection out => config
  mapping (uint256 => mapping(address => RedemptionConfig)) public redemptionConfigs;

  // collection out => round in => address of redeemer
  mapping (address => mapping (uint256 => address)) public redeemer;

  /**
  */
  event TokenRedemption(address indexed user, uint256 indexed groupId, address indexed contractOut, uint256[] tokensOut);

  /**
  */
  event ConfigUpdate(uint256 groupIdIn, uint256 groupIdOut, address tokenOut, uint256 amountOut, bool burnOnRedemption);

  /**
    On deployment, set `_super1155` as the collection to redeem,  set the burn
    address as `_burnTarget` and enable use of a custom burn address by setting
    `_customBurn`.

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
    Redeem a token for n number of tokens in return.  This function parses the
    tokens group id, determines the appropriate exchange token and amount, if
    necessary burns the deposited token and mints the receipt token(s)

    @param _tokenIds The array of 721 token ids
    @param _tokenOut The address of the token being received
    @param _groupIdIn The round or group id of the token being received
  */
  function redeem(uint256[] calldata _tokenIds, address _tokenOut, uint256 _groupIdIn) public nonReentrant {
    RedemptionConfig memory config = redemptionConfigs[_groupIdIn][_tokenOut];
    uint256 redemptionAmount = config.amountOut;
    uint256 groupIdOut = config.groupIdOut;

    uint256 mintCount = ISuper721(_tokenOut).groupMintCount(groupIdOut);
    require(checkBalances(config.requirements), "TokenRedeemer::redeem: msg sender is not token owner");

    {
      require(_tokenIds.length == config.requirements.length, "TokenRedeemer::redeem: length mismatch");

      for(uint i = 0; i < _tokenIds.length; ++i){
        require(redeemer[_tokenOut][_groupIdIn] == address(0), "TokenRedeemer::redeem: token has already been redeemed for this group" );

        require(groupIdOut != uint256(0), "TokenRedeemer::redeem: invalid group id from token");
        require(redemptionAmount != uint256(0), "TokenRedeemer::redeem: invalid redemption amount");
        require(config.requirements[i].collection != address(0), "TokenRedeemer::redeem: required token cannot be zero");

        // uint256 balanceOfSender = ISuperGeneric(config.requirements[i].collection).balanceOf(msg.sender, _tokenIds[i]);
        // require(balanceOfSender != 0, "TokenRedeemer::redeem: msg sender is not token owner");

      }

      redeemer[_tokenOut][_groupIdIn] = msg.sender;
    }

    uint256[] memory ids = new uint256[](redemptionAmount);


    for(uint256 i = 0; i < redemptionAmount; i++) {
      ids[i] = mintCount + i + 1;
    }

    // if (config.burnOnRedemption) {
    //   if (customBurn) {
    //     super1155.safeTransferFrom(msg.sender, burnAddress, _tokenId, 1, "");
    //   } else {
    //     super1155.burnBatch(msg.sender, _asSingletonArray(_tokenId), _asSingletonArray(1));
    //   }
    // }

    ISuper721(_tokenOut).mintBatch(msg.sender, ids, "");

    emit TokenRedemption(msg.sender, _groupIdIn, _tokenOut, ids);
  }

  function checkBalances(Requirement[] memory requirements) internal view returns (bool) {
      for (uint256 i = 0; i < requirements.length; i++) {
           for (uint256 j = 0; j < requirements[i].tokenId.length; j++) {
                uint256 balanceOfSender = ISuperGeneric(requirements[i].collection).balanceOf(msg.sender, requirements[i].tokenId[j]);
                if (balanceOfSender == 0) return false;
           }
      }
      return true;
  }

  /**
    Redeem a specific set of tokens `_tokenIds` for a set of token `_tokenOut`
    from group `_groupIdOut`

    @param _tokenIds An array of bitpacked 1155 token ids
    @param _tokenOuts The address of the token to receive
    @param _groupIdsIn The group ids of the token to redeem
  */
  function redeemMult(uint256[][] calldata _tokenIds, address[] calldata _tokenOuts, uint256[] calldata _groupIdsIn) external {
    for(uint256 n = 0; n < _tokenIds.length; n++){
      redeem(_tokenIds[n], _tokenOuts[n], _groupIdsIn[n]);
    }
  }

  /**
    Configure redemption amounts for each group.  ONE token of _groupIdin results
    in _amountOut number of _groupIdOut tokens

    @param _groupIdIn The group ID of the token being redeemed
    @param _groupIdIn The group ID of the token being received
    @param _data The redemption config data input.
  */

  function setRedemptionConfig(uint256 _groupIdIn, address _tokenOut, RedemptionConfig calldata _data) external onlyOwner {
    require(_data.groupIdOut != 0, "TokenRedeemer::setRedemptionConfig: group id cannot be zero");
    require(_groupIdIn != 0, "TokenRedeemer::setRedemptionConfig: group id cannot be zero");

    require(_tokenOut != address(0), "TokenRedeemer::setRedemptionConfig: token out cannot be zero address");
    require(_data.requirements.length > 0, "TokenRedeemer::setRedemptionConfig: must specify requirements");

    redemptionConfigs[_groupIdIn][_tokenOut] = RedemptionConfig({
      groupIdOut: _data.groupIdOut,
      amountOut: _data.amountOut,
      burnOnRedemption: _data.burnOnRedemption,
      requirements: _data.requirements
    });

    emit ConfigUpdate(_groupIdIn, _data.groupIdOut, _tokenOut, _data.amountOut, _data.burnOnRedemption);
  }

  /**
    This private helper function converts a number into a single-element array.

    @param _element The element to convert to an array.
    @return The array containing the single `_element`.
  */
  // function _asSingletonArray(uint256 _element) private pure returns (uint256[] memory) {
  //   uint256[] memory array = new uint256[](1);
  //   array[0] = _element;
  //   return array;
  // }
}