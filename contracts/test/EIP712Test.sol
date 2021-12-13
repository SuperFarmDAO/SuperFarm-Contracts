pragma solidity ^0.8.8;

import "../proxy/AuthenticatedProxy.sol";
import "../libraries/Sales.sol";
import "hardhat/console.sol";

contract EIP712Test {
    constructor() {}

    // bytes32 constant public ORDER_TYPEHASH = keccak256("Order(uint256 basePrice,uint256 listingTime,uint256 expirationTime,uint256 salt,address maker,uint8 saleKind,uint8 callType,OrderBody body)OrderBody(uint8 side,address taker,address target,address staticTarget,address paymentToken,bytes data,bytes replacementPattern,bytes staticExtradata,uint256[] extra,uint256[] fees,address[] addresses)");
    // bytes32 constant public ORDERBODY_TYPEHASH = keccak256("OrderBody(uint8 side,address taker,address target,address staticTarget,address paymentToken,bytes data,bytes replacementPattern,bytes staticExtradata,uint256[] extra,uint256[] fees,address[] addresses)");

    bytes32 public constant OUTLINE_TYPEHASH =
        keccak256(
            "Outline(uint256 basePrice,uint256 listingTime,uint256 expirationTime,address exchange,address maker,uint8 side,address taker,uint8 saleKind,address target,uint8 callType,address paymentToken)"
        );
    bytes32 public constant ORDER_TYPEHASH =
        keccak256(
            "Order(Outline outline,uint256[] extra,uint256 salt,uint256[] fees,address[] addresses,address staticTarget,bytes data,bytes replacementPattern,bytes staticExtradata)Outline(uint256 basePrice,uint256 listingTime,uint256 expirationTime,address exchange,address maker,uint8 side,address taker,uint8 saleKind,address target,uint8 callType,address paymentToken)"
        );
    bytes32 public constant ORDER_TYPEHASH2 =
        keccak256(
            "Order(uint256[] extra,uint256 salt,uint256[] fees,address[] addresses,address staticTarget,bytes data,bytes replacementPattern,bytes staticExtradata)"
        );
    /** supporting struct for order to avoid stack too deep */
    struct Outline {
        /** Base price of the order (in paymentTokens). */
        uint256 basePrice;
        /** Listing timestamp. */
        uint256 listingTime;
        /** Expiration timestamp - 0 for no expiry. */
        uint256 expirationTime;
        /** Exchange address, intended as a versioning mechanism. */
        address exchange;
        /** Order maker address. */
        address maker;
        /** Side (buy/sell). */
        Sales.Side side;
        /** Order taker address, if specified. */
        address taker;
        /** Kind of sale. */
        Sales.SaleKind saleKind;
        /** Target. */
        address target;
        /** callType. */
        AuthenticatedProxy.CallType callType;
        /** Token used to pay for the order, or the zero-address as a sentinel value for Ether. */
        address paymentToken;
    }

    /** An order on the exchange. */
    struct Order {
        /** order essentials */
        Outline outline;
        /** ending time + ending price.*/
        uint256[] extra;
        /** Order salt, used to prevent duplicate hashes. */
        uint256 salt;
        // /** Royalty fees*/
        uint256[] fees;
        // /** Royalty fees receivers*/
        address[] addresses;
        // /** Static call target, zero-address for no static call. */
        address staticTarget;
        /** Calldata. */
        bytes data;
        // /** Calldata replacement pattern, or an empty byte array for no replacement. */
        bytes replacementPattern;
        // /** Static call extra data. */
        bytes staticExtradata;
    }

    function recoverAddress(
        uint8 v,
        bytes32 r,
        bytes32 s,
        Order memory order
    ) external view returns (bool) {
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

        bytes32 hashStruct = keccak256(
            abi.encode(
                ORDER_TYPEHASH,
                hashOutline(order.outline),
                keccak256(abi.encodePacked(order.extra)),
                order.salt,
                keccak256(abi.encodePacked(order.fees)),
                keccak256(abi.encodePacked(order.addresses)),
                order.staticTarget,
                keccak256(order.data),
                keccak256(order.replacementPattern),
                keccak256(order.staticExtradata)
            )
        );

        bytes32 hash = keccak256(
            abi.encodePacked("\x19\x01", domainHash, hashStruct)
        );
        address signer = ecrecover(hash, v, r, s);
        console.logAddress(signer);
        return signer == msg.sender;
    }

    function hashOutline(Outline memory outline)
        private
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encode(
                    OUTLINE_TYPEHASH,
                    outline.basePrice,
                    outline.listingTime,
                    outline.expirationTime,
                    outline.exchange,
                    outline.maker,
                    outline.side,
                    outline.taker,
                    outline.saleKind,
                    outline.target,
                    outline.callType,
                    outline.paymentToken
                )
            );
    }

    function checkOutline(
        uint8 v,
        bytes32 r,
        bytes32 s,
        Outline memory outline
    ) external view returns (bool) {
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

        bytes32 hashStruct = keccak256(
            abi.encode(
                OUTLINE_TYPEHASH,
                outline.basePrice,
                outline.listingTime,
                outline.expirationTime,
                outline.exchange,
                outline.maker,
                outline.side,
                outline.taker,
                outline.saleKind,
                outline.target,
                outline.callType,
                outline.paymentToken
            )
        );
        bytes32 hash = keccak256(
            abi.encodePacked("\x19\x01", domainHash, hashStruct)
        );
        address signer = ecrecover(hash, v, r, s);
        console.logAddress(signer);
        return signer == msg.sender;
    }
}
