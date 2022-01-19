pragma solidity ^0.8.8;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./MarketplaceEntities.sol";
import "./MarketplaceExecutor.sol";
import "../../../libraries/EIP712.sol";
import "../../../libraries/Signature.sol";
import "../../../interfaces/EIP1271.sol";

/**
    @title MarketplaceCore contract of SuperMarketplace second version.
    @author Rostislav Khlebnikov.
 */
abstract contract MarketplaceCore is
    MarketplaceExecutor,
    ReentrancyGuard,
    EIP712
{
    /** Storing state of the order: order hash => Fill. */
    mapping(bytes32 => Entity.Fill) public fills;

    /**
        @dev Emmited when order is cancelled.
        @param key hash of the order.
        @param maker order maker.
        @param executer who cancelled the order.
        @param salt order salt.
     */
    event OrderCanceled(
        bytes32 key,
        address maker,
        address executer,
        uint256 salt
    );

    event OrdersMatched(
        bytes32 firstHash,
        bytes32 secondHash,
        address leftMaker,
        address rightMaker,
        bool filledLeft,
        bool filledRights,
        uint256 leftSalt,
        uint256 rightSalt
    );

    constructor(
        address transferProxy,
        address payable platformFeeRecipient,
        uint256 platformFee,
        string memory name,
        string memory version
    )
        MarketplaceExecutor(transferProxy, platformFeeRecipient, platformFee)
        EIP712(name, version)
    {}

    /**
        @dev Returns result of order matching.
        @param first order to match with `second`.
        @param second order to match with `first`.
        @return result of the matching.
     */
    function ordersCanMatch(
        Entity.Order calldata first,
        Entity.Order calldata second
    ) public view returns (bool) {}

    /**
     * @dev Returns the hash that a client must sign, including the standard message prefix.
     * @param hash Order hash to sign.
     * @return hash Hash of message prefix and order hash per Ethereum format.
     */
    function _hashToSign(bytes32 hash) private view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, hash));
    }

    /**
        @dev Invalidates order.
        @param order Order to cancel.
     */
    function _cancelOrder(Entity.Order calldata order) internal {
        bytes32 key = Entity.hash(order);
        fills[key].current = type(uint256).max;
        emit OrderCanceled(key, order.maker, _msgSender(), order.salt);
    }

    /**
        @dev Validates orders and executes actions. One of the order makers has to be msg.sender.
        @param signature signature of one of the orders.
     */
    function _exchange(
        Entity.Order calldata first,
        Entity.Order calldata second,
        bytes calldata signature
    ) internal {}

    /**
     * @dev Validate a provided previously approved / signed order, hash, and signature.
     * @param hash Order hash (already calculated, passed to avoid recalculation)
     * @param maker order maker
     * @param signature ECDSA signature
     */
    function authenticateOrder(
        bytes32 hash,
        address maker,
        bytes memory signature
    ) internal view returns (bool) {
        /** Order is already cancelled or filled.*/
        if (
            fills[hash].current >= fills[hash].length && fills[hash].length > 0
        ) {
            return false;
        }
        /** Order maker initiated transaction. */
        if (maker == msg.sender) {
            return true;
        }

        /** Contract-only authentication: EIP 1271. */
        if (Address.isContract(maker)) {
            if (
                IERC1271(maker).isValidSignature(
                    abi.encodePacked(hash),
                    signature
                ) == 0x20c13b0b // bytes4(keccak256("isValidSignature(bytes,bytes)") = 0x20c13b0b;
            ) {
                return true;
            }
            return false;
        }

        /** Account-only authentication: ECDSA-signed by maker. */
        return Signature.unchecked_recover(hash, signature) == maker;
    }
}
