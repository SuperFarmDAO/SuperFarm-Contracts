// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.8;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "../../assets/erc1155/interfaces/ISuper1155.sol";
import "../../assets/erc721/interfaces/ISuper721.sol";
import "../../interfaces/ISuperGeneric.sol";
import "hardhat/console.sol";


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
  address immutable public burnAddress;

  bytes4 private constant INTERFACE_ERC721 = 0x80ac58cd;


  /**
  */
  struct RedemptionConfig {
    uint256 groupIdOut;
    uint256 amountOut;
    address tokenOut;
    bool burnOnRedemption;
    bool customBurn;
    Requirement[] requirements;
    mapping(address => bool) redeemed;
  }

  struct Requirement {
      address collection;
      uint256[] tokenId;
      uint256[] amounts;
  }

  struct RedemptionConfigStructCreation {
    uint256 groupIdOut;
    uint256 amountOut;
    address tokenOut;
    bool burnOnRedemption;
    bool customBurn;
    Requirement[] requirements;
  }

  // groupIdIn => collection out => config
  // mapping (uint256 => mapping(address => RedemptionConfig)) public redemptionConfigs;
  mapping(uint256 => RedemptionConfig) public redemptionConfigs;

  // collection out => round in => address of redeemer
  // mapping (address => mapping (uint256 => address)) public redeemer;

  /**
  */
  event TokenRedemption(address indexed user, uint256 configId, uint256 timestamp);

  // /**
  // */
  event ConfigUpdate(uint256 groupIdIn, uint256 groupIdOut, address tokenOut, uint256 amountOut, bool burnOnRedemption);

  /**
    On deployment, set `_super1155` as the collection to redeem,  set the burn
    address as `_burnTarget` and enable use of a custom burn address by setting
    `_customBurn`.

    @param _burnAddress The address that will be used for burning tokens.
  */
  constructor(address _burnAddress) {
    burnAddress = _burnAddress;
  }

  function setRedemptionConfig(RedemptionConfigStructCreation calldata _data, uint256 _configId) public {
    require(_data.groupIdOut != 0, "TokenRedeemer::setRedemptionConfig: group id cannot be zero");
    require(_data.amountOut != 0, "TokenRedeemer::setRedemptionConfig: amount out cannot be zero");
    require(_data.tokenOut != address(0), "TokenRedeemer::setRedemptionConfig: token out cannot be zero address");
    require(_data.requirements.length > 0, "TokenRedeemer::setRedemptionConfig: must specify requirements");
    // uint256 length = _data.requirements.length;
    // Requirement[] memory reqs = new Requirement[](length);

    for(uint i = 0; i < _data.requirements.length; i++) {
        require(_data.requirements[i].collection != address(0), "TokenRedeemer::redeem: required token cannot be zero");
        require(_data.requirements[i].tokenId.length > 0);
        require(_data.requirements[i].amounts.length == _data.requirements[i].tokenId.length);
        redemptionConfigs[_configId].requirements.push(_data.requirements[i]);

      // for (uint j = 0; j < _data.requirements[i].amounts.length; j++) {
      //   redemptionConfigs[_configId].requirements[i].amounts.push(_data.requirements[i].amounts[j]);
      //   redemptionConfigs[_configId].requirements[i].tokenId.push(_data.requirements[i].tokenId[j]);
      // }
      }
    redemptionConfigs[_configId].groupIdOut = _data.groupIdOut;
    redemptionConfigs[_configId].amountOut = _data.amountOut;
    redemptionConfigs[_configId].burnOnRedemption = _data.burnOnRedemption;
    redemptionConfigs[_configId].customBurn = _data.customBurn;
    // redemptionConfigs[_configId].requirements = reqs;
    redemptionConfigs[_configId].tokenOut = _data.tokenOut;

   



    // emit ConfigUpdate(_groupIdIn, _data.groupIdOut, _tokenOut, _data.amountOut, _data.burnOnRedemption);
  }

  /**
    Redeem a token for n number of tokens in return.  This function parses the
    tokens group id, determines the appropriate exchange token and amount, if
    necessary burns the deposited token and mints the receipt token(s)

    @param _configId The address of the token being received
  */
  function redeem(uint256 _configId) external nonReentrant {


    RedemptionConfig storage config = redemptionConfigs[_configId];
    require(!config.redeemed[msg.sender]);
    Requirement[] memory req = config.requirements;
    bool burnOnRedemption = config.burnOnRedemption;
    bool customBurn = config.customBurn;

    require(checkBalances(req), "TokenRedeemer::redeem: msg sender is not token owner");
    uint256[] memory tokenToBurnIds;
    uint256[] memory tokenToBurnAmounts;
    for (uint i = 0; i < req.length; i++) {
      tokenToBurnIds = req[i].tokenId;
      tokenToBurnAmounts = req[i].amounts;
      address tokenToBurn = req[i].collection;

      if (burnOnRedemption) {
        if (customBurn) {
          genericTransfer(msg.sender, burnAddress, tokenToBurn, tokenToBurnIds, tokenToBurnAmounts);
        } else {
          genericBurn(tokenToBurn, tokenToBurnIds, tokenToBurnAmounts);
        }
      }

    }

    uint256 redemptionAmount = config.amountOut;
    uint256 mintCount = ISuper721(config.tokenOut).groupMintCount(config.groupIdOut);
    uint256[] memory ids = new uint256[](redemptionAmount);

    for(uint256 i = 0; i < redemptionAmount; i++) {
        ids[i] = mintCount + i + 1;
        // amounts[i] = uint256(1);
    }
    config.redeemed[msg.sender] = true;
    ISuper721(config.tokenOut).mintBatch(msg.sender, ids, "");

    // emit TokenRedemption(msg.sender, _groupIdIn, _tokenOut, ids);
  }

  function checkBalances(Requirement[] memory requirements) private view returns (bool) {
      for (uint256 i = 0; i < requirements.length; i++) {
           for (uint256 j = 0; j < requirements[i].tokenId.length; j++) {
                uint256 balanceOfSender = ISuperGeneric(requirements[i].collection).balanceOf(msg.sender, requirements[i].tokenId[j]);
                if (balanceOfSender == 0) return false;
           }
      }
      return true;
  }

  
  function genericBurn(address _assetAddress, uint256[] memory _ids, uint256[] memory _amounts) private returns (bool) {
    bool isErc721 = ISuperGeneric(_assetAddress).supportsInterface(INTERFACE_ERC721) ? true : false;
    if (!isErc721) {
       ISuperGeneric(_assetAddress).burnBatch(address(this), _ids, _amounts);
       return true;
    } else if (isErc721) {
      ISuperGeneric(_assetAddress).burnBatch(address(this), _ids);
      return true;
    }
    return false;
  }


  function genericTransfer(address _from, address _to, address _assetAddress, uint256[] memory _ids, uint256[] memory _amounts) private returns (bool) {
    bool isErc721 = ISuperGeneric(_assetAddress).supportsInterface(INTERFACE_ERC721) ? true : false;
    if (!isErc721) {
       ISuperGeneric(_assetAddress).safeBatchTransferFrom(_from, _to, _ids, _amounts, "");
       return true;
    } else if (isErc721) {
      ISuperGeneric(_assetAddress).safeBatchTransferFrom(_from, _to, _ids, "");
      return true;
    }
    return false;
  }

}