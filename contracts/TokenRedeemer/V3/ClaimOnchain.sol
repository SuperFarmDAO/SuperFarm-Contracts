// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.8;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "../../access/PermitControl.sol";

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
abstract contract ClaimOnchain is PermitControl, ReentrancyGuard {
    /// The smart contract being used in redemptions.
    ISuper721 public super721;

    bytes32 public constant CREATE_CONFIG = keccak256("CREATE_CONFIG");

    /// The address being used as a custom burn address.
    address public immutable burnAddress;

    bytes4 private constant INTERFACE_ERC721 = 0x80ac58cd;

    /**
     */
    struct RedemptionConfig {
        uint256 groupIdOut;
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
    event TokenRedemption(
        address indexed user,
        uint256 configId,
        uint256 timestamp
    );

    // /**
    // */
    event ConfigUpdate(uint256 indexed configId, address tokenOut);

    /**
    On deployment, set `_super1155` as the collection to redeem,  set the burn
    address as `_burnTarget` and enable use of a custom burn address by setting
    `_customBurn`.

    @param _burnAddress The address that will be used for burning tokens.
  */
    constructor(address _burnAddress) {
        burnAddress = _burnAddress;
    }

    function setRedemptionConfig(
        RedemptionConfigStructCreation calldata _data,
        uint256 _configId
    ) public hasValidPermit(UNIVERSAL, CREATE_CONFIG) {
        require(
            _data.groupIdOut != 0,
            "TokenRedeemer::setRedemptionConfig: group id cannot be zero"
        );
        require(
            _data.tokenOut != address(0),
            "TokenRedeemer::setRedemptionConfig: token out cannot be zero address"
        );
        require(
            _data.requirements.length > 0,
            "TokenRedeemer::setRedemptionConfig: must specify requirements"
        );

        for (uint256 i = 0; i < _data.requirements.length; i++) {
            require(
                _data.requirements[i].collection != address(0),
                "TokenRedeemer::redeem: required token cannot be zero"
            );
            require(_data.requirements[i].tokenId.length > 0);
            require(
                _data.requirements[i].amounts.length ==
                    _data.requirements[i].tokenId.length
            );
            redemptionConfigs[_configId].requirements.push(
                _data.requirements[i]
            );
        }
        redemptionConfigs[_configId].groupIdOut = _data.groupIdOut;
        redemptionConfigs[_configId].burnOnRedemption = _data.burnOnRedemption;
        redemptionConfigs[_configId].customBurn = _data.customBurn;
        redemptionConfigs[_configId].tokenOut = _data.tokenOut;

        emit ConfigUpdate(_configId, _data.tokenOut);
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
        bool allowed;
        uint256 mintableAmount;

        (allowed, mintableAmount) = checkBalances(req);
        require(
            allowed,
            "TokenRedeemer::redeem: msg sender is not token owner"
        );
        uint256[] memory tokenToBurnIds;
        uint256[] memory tokenToBurnAmounts;
        for (uint256 i = 0; i < req.length; i++) {
            tokenToBurnIds = req[i].tokenId;
            tokenToBurnAmounts = req[i].amounts;
            address tokenToBurn = req[i].collection;

            if (burnOnRedemption) {
                if (customBurn) {
                    genericTransfer(
                        msg.sender,
                        burnAddress,
                        tokenToBurn,
                        tokenToBurnIds,
                        tokenToBurnAmounts
                    );
                } else {
                    genericBurn(
                        tokenToBurn,
                        tokenToBurnIds,
                        tokenToBurnAmounts
                    );
                }
            }
        }

        uint256 mintCount = ISuper721(config.tokenOut).groupMintCount(
            config.groupIdOut
        );
        uint256[] memory ids = new uint256[](mintableAmount);

        for (uint256 i = 0; i < mintableAmount; i++) {
            ids[i] = mintCount + i + 1;
            // amounts[i] = uint256(1);
        }
        config.redeemed[msg.sender] = true;
        ISuper721(config.tokenOut).mintBatch(msg.sender, ids, "");

        emit TokenRedemption(msg.sender, _configId, block.timestamp);
    }

    function checkBalances(Requirement[] memory requirements)
        private
        view
        returns (bool allowed, uint256 amount)
    {
        // uint256[] memory amounts = new uint256[](requirements.length);
        allowed = true;
        amount = requirements[0].amounts[0];
        for (uint256 i = 0; i < requirements.length; i++) {
            for (uint256 j = 0; j < requirements[i].tokenId.length; j++) {
                uint256 balanceOfSender = ISuperGeneric(
                    requirements[i].collection
                ).balanceOf(msg.sender, requirements[i].tokenId[j]);
                if (balanceOfSender < requirements[i].amounts[j]) {
                    allowed = false;
                    break;
                } else if (amount < balanceOfSender) amount = balanceOfSender;
            }
        }
    }

    function genericBurn(
        address _assetAddress,
        uint256[] memory _ids,
        uint256[] memory _amounts
    ) private returns (bool) {
        bool isErc721 = ISuperGeneric(_assetAddress).supportsInterface(
            INTERFACE_ERC721
        )
            ? true
            : false;
        if (!isErc721) {
            ISuperGeneric(_assetAddress).burnBatch(
                address(this),
                _ids,
                _amounts
            );
            return true;
        } else if (isErc721) {
            ISuperGeneric(_assetAddress).burnBatch(address(this), _ids);
            return true;
        }
        return false;
    }

    function genericTransfer(
        address _from,
        address _to,
        address _assetAddress,
        uint256[] memory _ids,
        uint256[] memory _amounts
    ) private returns (bool) {
        bool isErc721 = ISuperGeneric(_assetAddress).supportsInterface(
            INTERFACE_ERC721
        )
            ? true
            : false;
        if (!isErc721) {
            ISuperGeneric(_assetAddress).safeBatchTransferFrom(
                _from,
                _to,
                _ids,
                _amounts,
                ""
            );
            return true;
        } else if (isErc721) {
            ISuperGeneric(_assetAddress).safeBatchTransferFrom(
                _from,
                _to,
                _ids,
                ""
            );
            return true;
        }
        return false;
    }
}
