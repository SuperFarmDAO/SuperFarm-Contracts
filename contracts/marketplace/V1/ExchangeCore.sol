pragma solidity ^0.8.8;
 
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "../../access/PermitControl.sol";
import "../../interfaces/IProxyRegistry.sol";
import "../../proxy/TokenTransferProxy.sol";
import "../../proxy/AuthenticatedProxy.sol";
import "../../utils/Utils.sol";
import "../../libraries/Sales.sol";
import "../../libraries/EIP712.sol";
import "../../libraries/EIP1271.sol";

/**
    @title modified ExchangeCore of ProjectWyvernV2
    @author Project Wyvern Developers
    @author Rostislav Khlebnikov
 */
abstract contract ExchangeCore is ReentrancyGuard, ERC1271, EIP712, PermitControl {

    /**  The public identifier for the right to set new items. */
    bytes32 public constant FEE_CONFIG = keccak256("FEE_CONFIG");

    bytes32 public constant OUTLINE_TYPEHASH =
        keccak256(
            "Outline(uint256 basePrice,uint256 listingTime,uint256 expirationTime,address exchange,address maker,uint8 side,address taker,uint8 saleKind,address target,uint8 callType,address paymentToken)"
        );
    bytes32 public constant ORDER_TYPEHASH =
        keccak256(
            "Order(Outline outline,uint256[] extra,uint256 salt,uint256[] fees,address[] addresses,address staticTarget,bytes data,bytes replacementPattern,bytes staticExtradata)Outline(uint256 basePrice,uint256 listingTime,uint256 expirationTime,address exchange,address maker,uint8 side,address taker,uint8 saleKind,address target,uint8 callType,address paymentToken)"
        );

    /** Token transfer proxy. */
    address public tokenTransferProxy;

    /** User registry. */
    address public registry;

    /** Trusted proxy registry contracts. */
    mapping(address => bool) public registries;

    /** Cancelled / finalized orders, by hash. */
    mapping(bytes32 => bool) public cancelledOrFinalized;

    /** Orders verified by on-chain approval (alternative to ECDSA signatures so that smart contracts can place orders directly). */
    mapping(bytes32 => bool) public approvedOrders;

    /** The royalty fee for this platform. */
    uint public minimumPlatformFee; 

    /** The royalty fee address of the platform */
    address public platformFeeAddress;

    /** Inverse basis point. */
    uint public constant INVERSE_BASIS_POINT = 10000;

     /* An ECDSA signature. */ 
    struct Sig {
        /* v parameter */
        uint8 v;
        /* r parameter */
        bytes32 r;
        /* s parameter */
        bytes32 s;
    }

    /** supporting struct for order to avoid stack too deep */
    struct Outline{
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
        /** Royalty fees*/ 
        uint256[] fees;
        /** Royalty fees receivers*/ 
        address[] addresses; 
        /** Static call target, zero-address for no static call. */
        address staticTarget;
        /** Calldata. */
        bytes data;
        /** Calldata replacement pattern, or an empty byte array for no replacement. */
        bytes replacementPattern;
        /** Static call extra data. */
        bytes staticExtradata;
    }

    event OrderApprovedPartOne    (bytes32 indexed hash, address exchange, address indexed maker, address taker, uint platformFee, address indexed feeRecipient, Sales.Side side, Sales.SaleKind saleKind, address target);
    event OrderApprovedPartTwo    (bytes32 indexed hash, AuthenticatedProxy.CallType callType, bytes data, bytes replacementPattern, address staticTarget, bytes staticExtradata, address paymentToken, uint basePrice, uint[] extra, uint listingTime, uint expirationTime, uint salt, bool orderbookInclusionDesired);
    event OrderCancelled                    (bytes32 indexed hash);
    event OrdersMatched                    (bytes32 buyHash, bytes32 sellHash, address indexed maker, address indexed taker, uint price, bytes32 indexed metadata);
    
    constructor(string memory name, string memory version) EIP712(name, version){}

    /**
     * @dev Transfer tokens
     * @param token Token to transfer
     * @param from Address to charge fees
     * @param to Address to receive fees
     * @param amount Amount of platform tokens to charge
     */
    function transferTokens(address token, address from, address to, uint amount)
        internal
    {
        if (amount > 0) {
            require(TokenTransferProxy(tokenTransferProxy).transferFrom(token, from, to, amount));
        }
    }

    /**
     * @dev Execute a STATICCALL (introduced with Ethereum Metropolis, non-state-modifying external call)
     * @param target Contract to call
     * @param data Calldata (appended to extradata)
     * @param extradata Base data for STATICCALL (probably function selector and argument encoding)
     * @return result The result of the call (success or failure)
     */
    function staticCall(address target, bytes memory data, bytes memory extradata)
        public
        view
        returns (bool result)
    {
        bytes memory combined = new bytes(data.length + extradata.length);
        uint index;
        assembly {
            index := add(combined, 0x20)
        }
        index = ArrayUtils.unsafeWriteBytes(index, extradata);
        ArrayUtils.unsafeWriteBytes(index, data);
        assembly {
            result := staticcall(gas(), target, add(combined, 0x20), mload(combined), mload(0x40), 0)
        }
        return result;
    }

    function isValidSignature(bytes memory _data, bytes memory _signature) public view override returns (bytes4){

    }
    /**
     * @dev Hash an order, returning the canonical order hash, without the message prefix
     * @param order Order to hash
     * @return hash Hash of order
     */
    function _hash(Order memory order)
        internal
        pure
        returns (bytes32){
        return keccak256(
            abi.encode(
                ORDER_TYPEHASH,
                _hash(order.outline),
                keccak256(abi.encodePacked(order.extra)),
                order.salt,
                keccak256(abi.encodePacked(order.fees)),
                keccak256(abi.encodePacked(order.addresses)),
                order.staticTarget,
                keccak256(order.data),
                keccak256(order.replacementPattern),
                keccak256(order.staticExtradata)
            ));
    }

    function _hash(Outline memory outline)
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
    

    /**
     * @dev Hash an order, returning the hash that a client must sign, including the standard message prefix
     * @param order Order to hash
     * @return Hash of message prefix and order hash per Ethereum format
     */
    function _hashToSign(Order memory order)
        internal
        view
        returns (bytes32)
    {
       return keccak256(abi.encodePacked(
            "\x19\x01",
            DOMAIN_SEPARATOR,
            _hash(order)
        ));
    }

    function recover(Order memory order, Sig memory sig) external view returns(address result){
        result = ecrecover(_hashToSign(order), sig.v, sig.r, sig.s);
        return result;
    }

    /**
     * @dev Assert an order is valid and return its hash
     * @param order Order to validate
     * @param sig ECDSA signature
     */
    function requireValidOrder(Order memory order,Sig memory sig)
        internal
        view
        returns (bytes32)
    {
        bytes32 hash = _hashToSign(order);
        require(_validateOrder(hash, order, sig));
        return hash;
    }

     /**
     * @dev Validate order parameters (does *not* check signature validity)
     * @param order Order to validate
     */
    function _validateOrderParameters(Order memory order)
        internal
        view
        returns (bool)
    {   // TODO (2) sell order must have fees as mandatory
        /** Order must be targeted at this platform version (this Exchange contract). */
        if (order.outline.exchange != address(this)) {
            return false;
        }
        /** Target must exist (prevent malicious selfdestructs just prior to order settlement). */
            require(Address.isContract(order.outline.target));

        /** Order must possess valid sale kind parameter combination. */
        if (!Sales.validateParameters(order.outline.saleKind, order.outline.expirationTime)) {
            return false;
        }

        return true;
    }

    /**
     * @dev Validate a provided previously approved / signed order, hash, and signature.
     * @param hash Order hash (already calculated, passed to avoid recalculation)
     * @param order Order to validate
     * @param sig ECDSA signature
     */
    function _validateOrder(bytes32 hash, Order memory order, Sig memory sig) 
        internal
        view
        returns (bool)
    {
        /* Not done in an if-conditional to prevent unnecessary ecrecover evaluation, which seems to happen even though it should short-circuit. */

        /* Order must have valid parameters. */
        if (!_validateOrderParameters(order)) {
            return false;
        }
        /* Order must have not been canceled or already filled. */
        if (cancelledOrFinalized[hash]) {
            return false;
        }
        /* Order authentication. Order must be either:
        /* (a) previously approved */
        if (approvedOrders[hash]) {
            return true;
        }

        /* Calculate hash which must be signed. */
        bytes32 calculatedHashToSign = _hashToSign(order);

        // bool isContract = Address.isContract(order.outline.maker);

        // /* (c): Contract-only authentication: EIP/ERC 1271. */
        // if (isContract) {
        //     if (ERC1271(order.outline.maker).isValidSignature(abi.encodePacked(_hashToSign(order)), signature) == EIP_1271_MAGICVALUE) {
        //         return true;
        //     }
        //     return false;
        // }

        // /* (d): Account-only authentication: ECDSA-signed by maker. */
        // (uint8 v, bytes32 r, bytes32 s) = abi.decode(signature, (uint8, bytes32, bytes32));
        
        // if (signature.length > 65 && signature[signature.length-1] == 0x03) { // EthSign byte
        //     /* (d.1): Old way: order hash signed by maker using the prefixed personal_sign */
        //     if (ecrecover(keccak256(abi.encodePacked(personalSignPrefix,"32",calculatedHashToSign)), v, r, s) == order.outline.maker) {
        //         return true;
        //     }
        // }
        /* (d.2): New way: order hash signed by maker using sign_typed_data */
        if (ecrecover(calculatedHashToSign, sig.v, sig.r, sig.s) == order.outline.maker) {
            return true;
        }
        return false;
    }


    /**
     * @dev Approve an order and optionally mark it for orderbook inclusion. Must be called by the maker of the order
     * @param order Order to approve
     * @param orderbookInclusionDesired Whether orderbook providers should include the order in their orderbooks
     */
    function _approveOrder(Order memory order, bool orderbookInclusionDesired)
        internal
    {
        /** CHECKS */

        /** Assert sender is authorized to approve order. */
        require(msg.sender == order.outline.maker);

        /** Calculate order hash. */
        bytes32 hash = _hashToSign(order);

        /** Assert order has not already been approved. */
        require(!approvedOrders[hash]);

        /** EFFECTS */
    
//         /** Mark order as approved. */
        approvedOrders[hash] = true;
  
        /** Log approval event. Must be split in two due to Solidity stack size limitations. */
        {
            emit OrderApprovedPartOne(hash, order.outline.exchange, order.outline.maker, order.outline.taker, order.fees[0], order.addresses[0], order.outline.side, order.outline.saleKind, order.outline.target);
        }
        {   
            emit OrderApprovedPartTwo(hash, order.outline.callType, order.data, order.replacementPattern, order.staticTarget, order.staticExtradata, order.outline.paymentToken, order.outline.basePrice, order.extra, order.outline.listingTime, order.outline.expirationTime, order.salt, orderbookInclusionDesired);
        }
    }

    /**
     * @dev Cancel an order, preventing it from being matched. Must be called by the maker of the order
     * @param order Order to cancel
     * @param sig ECDSA signature
     */
    function _cancelOrder(Order memory order, Sig memory sig) 
        internal
    {
        /** CHECKS */
        
        /** Assert sender is authorized to cancel order. */
        require(msg.sender == order.outline.maker);

        /** Calculate order hash. */
        bytes32 hash = requireValidOrder(order, sig);
  
        /** EFFECTS */
      
        /** Mark order as cancelled, preventing it from being matched. */
        cancelledOrFinalized[hash] = true;

        /** Log cancel event. */
        emit OrderCancelled(hash);
    }

    /**
     * @dev Calculate the current price of an order (convenience function)
     * @param order Order to calculate the price of
     * @return The current price of the order
     */
    function _calculateCurrentPrice (Order memory order)
        internal  
        view
        returns (uint)
    {
        return Sales.calculateFinalPrice(order.outline.saleKind, order.outline.basePrice, order.extra, order.outline.listingTime);
    }

   /**
     * @dev Calculate the price two orders would matchs at, if in fact they would match (otherwise fail)
     * @param buy Buy-side order
     * @param sell Sell-side order
     * @return Match price
     */
    function _calculateMatchPrice(Order memory buy, Order memory sell)
        view
        internal
        returns (uint)
    {
        /** Calculate sell price. */
        uint sellPrice = Sales.calculateFinalPrice(sell.outline.saleKind, sell.outline.basePrice, sell.extra, sell.outline.listingTime);

        /** Calculate buy price. */
        uint buyPrice = Sales.calculateFinalPrice(buy.outline.saleKind, buy.outline.basePrice, buy.extra, buy.outline.listingTime);

        /** Require price cross. */
        require(buyPrice >= sellPrice);

        /** Maker/taker priority. */
        if (sell.outline.saleKind == Sales.SaleKind.Auction || sell.outline.saleKind == Sales.SaleKind.Offer) {
            return buyPrice;
        } else {
            return sellPrice;
        }
    }

    /**
     * @dev Execute all ERC20 token / Ether transfers associated with an order match (fees and buyer => seller transfer)
     * @param buy Buy-side order
     * @param sell Sell-side order
     */
     //TODO
    function executeFundsTransfer(Order memory buy, Order memory sell)
        internal
        returns (uint)
    {
        /** Calculate match price. */
        uint requiredAmount = _calculateMatchPrice(buy, sell);

        /** Calculate amount for seller to receive */
        uint receiveAmount =  requiredAmount;

        if (requiredAmount > 0){
            /** If paying using a token (not Ether), transfer tokens. */
            if (sell.outline.paymentToken != address(0)){
                require(msg.value == 0);
                for(uint256 i = 0; i < sell.addresses.length; i++){
                    receiveAmount -= sell.fees[i];
                    transferTokens(buy.outline.paymentToken, buy.outline.maker, sell.addresses[i], sell.fees[i]);
                }
                transferTokens(sell.outline.paymentToken, buy.outline.maker, sell.outline.maker, receiveAmount);
            } else {
                /** Special-case Ether, order must be matched by buyer. */
                require(msg.value >= requiredAmount);
                /** transfer fees */
                for(uint256 i = 0; i < sell.addresses.length; i++){
                    receiveAmount -= sell.fees[i];
                    payable(sell.addresses[i]).transfer(sell.fees[i]);
                }
                payable(sell.outline.maker).transfer(receiveAmount);

                /** Allow overshoot for variable-price auctions, refund difference. */
                uint diff = msg.value - requiredAmount;
                if (diff > 0) {
                    payable(buy.outline.maker).transfer(diff);
                }
            }
        }   

        return requiredAmount;
    }

     /**
     * @dev Return whether or not two orders can be matched with each other by basic parameters (does not check order signatures / calldata or perform static calls)
     * @param buy Buy-side order
     * @param sell Sell-side order
     * @return Whether or not the two orders can be matched
     */
    function _ordersCanMatch(Order memory buy, Order memory sell)
        internal
        view
        returns (bool)
    {
        return (
            /** Must be opposite-side. */
            (buy.outline.side == Sales.Side.Buy && sell.outline.side == Sales.Side.Sell) &&     
            /** Must use same payment token. */
            (buy.outline.paymentToken == sell.outline.paymentToken) &&
            /** Must match maker/taker addresses. */
            (sell.outline.taker == address(0) || sell.outline.taker == buy.outline.maker) &&
            (buy.outline.taker == address(0) || buy.outline.taker == sell.outline.maker) &&
            /** Platform fees address is  */
            sell.addresses[0] == platformFeeAddress &&
            /** One must have platform fee on seller side */
            (sell.fees[0] >= minimumPlatformFee) &&
            /** Must match target. */
            (buy.outline.target == sell.outline.target) &&
            /** Must match callType. */
            (buy.outline.callType == sell.outline.callType) &&
            /** Buy-side order must be settleable. */
            Sales.canSettleOrder(buy.outline.listingTime, buy.outline.expirationTime) &&
            /** Sell-side order must be settleable. */
            Sales.canSettleOrder(sell.outline.listingTime, sell.outline.expirationTime)
        );
    }

    /**
     * @dev Atomically match two orders, ensuring validity of the match, and execute all associated state transitions. Protected against reentrancy by a contract-global lock.
     * @param buy Buy-side order
     * @param sigBuy Buy-side order signature
     * @param sell Sell-side order
     * @param sigSell Sell-side order signature
     */
    function _atomicMatch(Order memory buy, Sig memory sigBuy, Order memory sell, Sig memory sigSell, bytes32 metadata, Order[] calldata additionalSales, Sig[] calldata sigs )
        internal
    {   
        /// calculate buy order hash
        bytes32 buyHash = _hash(buy);
        ///calcylate sell order hash
        bytes32 sellHash = _hash(sell);

        /** Must be matchable. */
        require(_ordersCanMatch(buy, sell));

        /** CHECKS */
        {   
            /** Ensure buy order validity and calculate hash if necessary. */
            if (buy.outline.maker == msg.sender) {
                require(_validateOrderParameters(buy));
            } else {
                buyHash = requireValidOrder(buy, sigBuy);
            }

            /** Ensure sell order validity and calculate hash if necessary. */
            if (sell.outline.maker == msg.sender) {
                require(_validateOrderParameters(sell));
            } else {
                sellHash = requireValidOrder(sell, sigSell);
            }
        
        
            
            /** Must match calldata after replacement, if specified. */
            if (buy.replacementPattern.length > 0) {
                ArrayUtils.guardedArrayReplace(buy.data, sell.data, buy.replacementPattern);
            }
            if (sell.replacementPattern.length > 0) {
                ArrayUtils.guardedArrayReplace(sell.data, buy.data, sell.replacementPattern);
            }
            require(ArrayUtils.arrayEq(buy.data, sell.data));
        }

        helper(buy, sell, buyHash, sellHash, metadata);
            /** Retrieve delegateProxy contract. */

    }

    /**
    * Private function to avoid stack-too-deep error.
     */
    function helper(Order memory buy, Order memory sell, bytes32 buyHash, bytes32 sellHash, bytes32 metadata) private {
        address delegateProxy = IProxyRegistry(registry).proxies(sell.outline.maker);

        /** Proxy must exist. */
        require(Address.isContract(delegateProxy));

        /** Assert implementation. */
        require(OwnableDelegateProxy(payable(delegateProxy)).implementation() == IProxyRegistry(registry).delegateProxyImplementation());
        
//         /** Access the passthrough AuthenticatedProxy. */
        AuthenticatedProxy proxy= AuthenticatedProxy(payable(delegateProxy));
        
        /** EFFECTS */

        /** Mark previously signed or approved orders as finalized. */
        if (msg.sender != buy.outline.maker) {
            cancelledOrFinalized[buyHash] = true;
        }
        if (msg.sender != sell.outline.maker) {
            cancelledOrFinalized[sellHash] = true;
        }
        /** INTERACTIONS */

        /** Execute funds transfer and pay fees. */
        uint price = executeFundsTransfer(buy, sell);

        /** Execute specified call through proxy. */
        require(proxy.call(sell.outline.target, sell.outline.callType, sell.data));

        /** Static calls are intentionally done after the effectful call so they can check resulting state. */

        /** Handle buy-side static call if specified. */
        if (buy.staticTarget != address(0)) {
            require(staticCall(buy.staticTarget, sell.data, buy.staticExtradata));
        }

        /** Handle sell-side static call if specified. */
        if (sell.staticTarget != address(0)) {
            require(staticCall(sell.staticTarget, sell.data, sell.staticExtradata));
        }

        /** Log match event. */
        //TODO
        emit OrdersMatched(buyHash, sellHash, sell.addresses[0] != address(0) ? sell.outline.maker : buy.outline.maker, sell.addresses[0] != address(0) ? buy.outline.maker : sell.outline.maker, price, metadata);
    }

}