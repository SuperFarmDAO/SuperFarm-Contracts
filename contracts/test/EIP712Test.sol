pragma solidity ^0.8.8;

import "../proxy/AuthenticatedProxy.sol";
import "../libraries/Sales.sol";
import "hardhat/console.sol";

contract EIP712Test {
    constructor() {}

    enum AssetsType{
        ETH,
        ERC20,
        ERC721, 
        ERC1155,
        Collection,
        Multiple
    }

    bytes32 constant ORDER_TYPEHASH = keccak256(
        "Order(Conditions conditions)Conditions(Assets give,Assets take,uint256 listingTime,uint256 expirationTime,address maker,address taker,uint8 saleKind)Assets(uint8 assetsType,address target,address staticTarget,bytes data,bytes replacementPattern,bytes staticExtradata)"
    );

    bytes32 constant ASSET_TYPEHASH = keccak256(
        "Assets(uint8 assetsType,address target,address staticTarget,bytes data,bytes replacementPattern,bytes staticExtradata)"
    );

    bytes32 constant CONDITIONS_TYPEHASH = keccak256(
        "Conditions(Assets give,Assets take,uint256 listingTime,uint256 expirationTime,address maker,address taker,uint8 saleKind)Assets(uint8 assetsType,address target,address staticTarget,bytes data,bytes replacementPattern,bytes staticExtradata)"
    );

    struct Assets{
        /** Type of assets to sell.*/
        AssetsType assetsType;
        /** Address of asset to traded. */
        address target;
        /** Static call target, zero-address for no static call. */
        address staticTarget;
        /** How to handle assets. */
        bytes data;
        /** Calldata replacement pattern, or an empty byte array for no replacement. */
        bytes replacementPattern;
        /** Static call extra data. */
        bytes staticExtradata;
    }
    /** supporting struct for order to avoid stack too deep */
    struct Conditions {
        /** Trade with assets. */
        Assets give;
        /** Trade for assets. */
        Assets take;
        /** Listing timestamp. */
        uint256 listingTime;
        /** Expiration timestamp - 0 for no expiry. */
        uint256 expirationTime;
        /** Order maker address. */
        address maker;
        /** Order taker address, if specified. */
        address taker;
        /** Kind of sale. */
        Sales.SaleKind saleKind;
    }

    /** An order on the exchange. */
    struct Order {
        /** order essentials */
       Conditions conditions;
        /** Exchange address, intended as a versioning mechanism. */
        // address exchange;
        // /** Side (buy/sell). */
        // Sales.Side side;
        // /** callType. */
        // AuthenticatedProxy.CallType callType;
        // /** Order salt, used to prevent duplicate hashes. */
        // uint256 salt;
        // /** Royalty fees*/
        // uint[] fees;
        // /** Royalty fees receivers*/
        // address[] feeReceivers;
    }

    function recoverAddress(
        bytes memory signature,
        Order memory order
    ) external view returns (bool) {
        // Divide the signature in r, s and v variables
        bytes32 r;
        bytes32 s;
        uint8 v;
        // Check the signature length
        if (signature.length != 65) {
            revert("ECDSA: invalid signature length");
        }
        // ecrecover takes the signature parameters, and the only way to get them
        // currently is to use assembly.
        // solhint-disable-next-line no-inline-assembly
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        bytes32 domainHash = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("TestEIP712")),
                keccak256(bytes("1")),
                chainId,
                address(this)
            )
        );

        bytes32 hash = keccak256(
            abi.encodePacked("\x19\x01", domainHash, _hash(order))
        );
        address signer = ecrecover(hash, v, r, s);
        console.logAddress(signer);
        return signer == msg.sender;
    }

    function _hash(Order memory order) internal pure returns (bytes32) {
        return keccak256(abi.encode(
                ORDER_TYPEHASH,
                _hash(order.conditions)
                // order.exchange,
                // order.side,
                // order.callType,
                // order.salt,
                // keccak256(abi.encodePacked(order.fees)),
                // keccak256(abi.encodePacked(order.feeReceivers))
            ));
    }


    function _hash(Conditions memory conditions) internal pure returns (bytes32) {
        return keccak256(abi.encode(
                CONDITIONS_TYPEHASH,
                _hash(conditions.give),
                _hash(conditions.take),
                conditions.listingTime,
                conditions.expirationTime,
                conditions.maker,
                conditions.taker,
                conditions.saleKind
            ));
    }

    function _hash(Assets memory assets) internal pure returns (bytes32) {
        return keccak256(abi.encode(
                ASSET_TYPEHASH,
                assets.assetsType,
                assets.target,
                assets.staticTarget,
                keccak256(assets.data),
                keccak256(assets.replacementPattern),
                keccak256(assets.staticExtradata)
            ));
    }
}
