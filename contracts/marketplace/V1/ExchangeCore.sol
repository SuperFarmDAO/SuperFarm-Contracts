pragma solidity ^0.8.8;
 
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "../../access/PermitControl.sol";
import "../../interfaces/IProxyRegistry.sol";
import "../../proxy/OwnableMutableDelegateProxy.sol";
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
abstract contract ExchangeCore is ReentrancyGuard, EIP712, PermitControl {

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

    bytes4 constant internal EIP_1271_MAGICVALUE = 0x20c13b0b;

    /** Token transfer proxy. */
    address public tokenTransferProxy;

    /** User registry. */
    address public registry;

    Fees internal fees;

    /** Trusted proxy registry contracts. */
    mapping(address => bool) public registries;

    /** Cancelled / finalized orders, by hash. */
    mapping(bytes32 => bool) public cancelledOrFinalized;

    /** Orders verified by on-chain approval (alternative to ECDSA signatures so that smart contracts can place orders directly). */
    mapping(bytes32 => bool) public approvedOrders;

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

    struct Fees {
        /** The royalty fee for this platform. */
        uint minimumPlatformFee; 
        /** The protocol fee for this platform. */
        uint minimumProtocolFee;  
        /** The protocol fee address of the platform */
        address protocolFeeAddress;
        /** The royalty fee address of the platform */
        address platformFeeAddress;
    }

    event OrderApproved(bytes32 indexed hash, address indexed maker, address indexed taker, bytes data, bool orderbookInclusionDesired);
    event OrderCancelled(bytes32 indexed hash, address indexed maker, bytes data);
    event OrdersMatched (bytes32 buyHash, bytes32 sellHash, address indexed maker, address indexed taker, bytes data);
    
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
     * @dev Validate order parameters (does *not* check signature validity)
     * @param order Order to validate
     */
    function _validateOrderParameters(Order memory order)
        internal
        view
        returns (bool)
    {
        /** Order must be targeted at this platform version (this Exchange contract). */
        if (order.outline.exchange != address(this)) {
            return false;
        }
        /** Target must exist (prevent malicious selfdestructs just prior to order settlement). */
        if(!Address.isContract(order.outline.target)){
            return false;
        }

        /** Order must possess valid sale kind parameter combination. */
        if(!Sales.canSettleOrder(order.outline.listingTime, order.outline.expirationTime)){
            return false;
        }

        if (!Sales.validateParameters(order.outline.saleKind, order.outline.expirationTime)) {
            return false;
        }

        return true;
    }

    /**
     * @dev Validate a provided previously approved / signed order, hash, and signature.
     * @param hash Order hash (already calculated, passed to avoid recalculation)
     * @param maker order maker
     * @param sig ECDSA signature
     */
    function authenticateOrder(bytes32 hash, address maker, Sig memory sig) 
        internal
        view
        returns (bool)
    {   
        /** Order is cancelled or executed in the past.*/
        if (cancelledOrFinalized[hash]) {
            return false;
        }
        /** Order maker initiated transaction. */
        if (maker == msg.sender){
            return true;
        }
        /** Order is previously approved. */
        if (approvedOrders[hash]) {
            return true;
        }

        /** Contract-only authentication: EIP/ERC 1271. */
        if (Address.isContract(maker)) {
            bytes memory signature = abi.encodePacked(sig.r, sig.s, sig.v);
            if (ERC1271(maker).isValidSignature(abi.encodePacked(hash), signature) == EIP_1271_MAGICVALUE) {
                return true;
            }
            return false;
        }

        /** Account-only authentication: ECDSA-signed by maker. */
        if (ecrecover(hash, sig.v, sig.r, sig.s) == maker) {
            return true;
        }

        return false;
    }

    /**
     * @dev Execute all ERC20 token / Ether transfers associated with an order match (fees and buyer => seller transfer)
     * @param buy Buy-side order
     * @param sell Sell-side order
     */
    function executeFundsTransfer(Order memory buy, Order memory sell)
        internal
        returns (uint)
    {
        /** Calculate match price. */
        uint requiredAmount = _calculateMatchPrice(buy, sell);

        /** Calculate amount for seller to receive */
        uint receiveAmount =  requiredAmount;
        uint fee;
        uint plFee = (requiredAmount * fees.minimumPlatformFee) / 10000;
        uint prFee = (requiredAmount * fees.minimumProtocolFee) / 10000;

        if (requiredAmount > 0){
            /** If paying using a token (not Ether), transfer tokens. */
            if (sell.outline.paymentToken != address(0)){
                require(msg.value == 0);
                {   
                    if(fees.platformFeeAddress != address(0)) {
                        transferTokens(buy.outline.paymentToken, buy.outline.maker, fees.platformFeeAddress, plFee);
                    }
                     if(fees.protocolFeeAddress != address(0)) {
                        transferTokens(buy.outline.paymentToken, buy.outline.maker, fees.protocolFeeAddress, prFee);
                    }
                    receiveAmount -= prFee + plFee;
                }
                    for(uint256 i = 0; i < sell.addresses.length; i++){
                        fee = (requiredAmount*sell.fees[i])/10000;
                        if (fee != 0 || sell.addresses[i] != address(0) ){
                            receiveAmount -= fee;
                            transferTokens(buy.outline.paymentToken, buy.outline.maker, sell.addresses[i], fee);
                        }
                    }
                
                transferTokens(sell.outline.paymentToken, buy.outline.maker, sell.outline.maker, receiveAmount);
            } else {
                /** Special-case Ether, order must be matched by buyer. */
                require(msg.value >= requiredAmount);
                {
                    if (fees.platformFeeAddress != address(0)) {
                        payable(fees.platformFeeAddress).transfer(plFee);
                    }
                    if (fees.protocolFeeAddress != address(0)) {
                        payable(fees.protocolFeeAddress).transfer(prFee);
                    }
                    receiveAmount -= prFee + prFee;
                }

                /** transfer fees */
                
                for(uint256 i = 0; i < sell.addresses.length; i++){
                    fee = (requiredAmount*sell.fees[i])/10000;
                    if (fee != 0 || sell.addresses[i] != address(0) ){
                        receiveAmount -= fee;
                        payable(sell.addresses[i]).transfer(fee);
                    }
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
    function _ordersMatch(Order memory buy, Order memory sell)
        internal
        pure
        returns (bool)
    {
            /** Must be opposite-side. */
            if(!(buy.outline.side == Sales.Side.Buy && sell.outline.side == Sales.Side.Sell)){ 
                return false;
            }     
            /** Must use same payment token. */
            if(!(buy.outline.paymentToken == sell.outline.paymentToken)){
                return false;
            }
            /** Must match maker/taker addresses. */
            if(!(sell.outline.taker == address(0) || sell.outline.taker == buy.outline.maker)){
                return false;
            }
            if(!(buy.outline.taker == address(0) || buy.outline.taker == sell.outline.maker)){
                return false;
            }
            /** Must match target. */
            if(!(buy.outline.target == sell.outline.target)){
                return false;
            }
            /** Must match callType. */
            if(!(buy.outline.callType == sell.outline.callType)){
                return false;
            }
            return true;
    }

    /**
     * @dev Atomically match two orders, ensuring validity of the match, and execute all associated state transitions. Protected against reentrancy by a contract-global lock.
     * @param buy Buy-side order.
     * @param sigBuy Buy-side order signature.
     * @param sell Sell-side order.
     * @param sigSell Sell-side order signature.
     * @param additionalSales Additional sell-orders to invalidate.
     * @param sigs Signatures for additional sales.
     */
    function _atomicMatch(Order memory buy, Sig memory sigBuy, Order memory sell, Sig memory sigSell, Order[] calldata additionalSales, Sig[] calldata sigs )
        internal
    {   
        /** CHECKS */

        /** Orders should match. */
        require(_ordersMatch(buy, sell), "Marketplace: orders do not match.");

        /** Get buy order hash. */
        bytes32 buyHash = _hashToSign(buy);

        /** Validate buy order. */
        require(_validateOrderParameters(buy), "Marketplace: buy order invalid.");

        /** Get sell order hash. */
        bytes32 sellHash = _hashToSign(sell);

        /** Validate sell order. */
        require(_validateOrderParameters(sell), "Marketplace: sell order invalid.");

        /** Prevent self-matching. */
        require(buyHash != sellHash, "Marketplace: self-matching is prohibited.");

        /** Authenticate buy order. */
        require(authenticateOrder(buyHash, buy.outline.maker, sigBuy), "Marketplace: can not autheticate buy order.");

        /** Authenticate sell order. */
        require(authenticateOrder(sellHash, sell.outline.maker, sigSell), "Marketplace: can not autheticate buy order.");
   
        /** Must match calldata after replacement, if specified. */
        if (buy.replacementPattern.length > 0) {
            ArrayUtils.guardedArrayReplace(buy.data, sell.data, buy.replacementPattern);
        }
        if (sell.replacementPattern.length > 0) {
            ArrayUtils.guardedArrayReplace(sell.data, buy.data, sell.replacementPattern);
        }
        require(ArrayUtils.arrayEq(buy.data, sell.data), "Marketplace: orders function call is not matched.");
        
        /** Retrieve delegateProxy contract. */
        address delegateProxy = IProxyRegistry(registry).proxies(sell.outline.maker);

        /** Proxy must exist. */
        require(Address.isContract(delegateProxy));

        /** Assert implementation. */
        require(OwnableDelegateProxy(payable(delegateProxy)).implementation() == IProxyRegistry(registry).delegateProxyImplementation());
        
        /** Access the passthrough AuthenticatedProxy. */
        AuthenticatedProxy proxy= AuthenticatedProxy(payable(delegateProxy));
        
    
        /** INTERACTIONS */

        /** Execute asset transfer call through proxy. */
        require(proxy.call(sell.outline.target, sell.outline.callType, sell.data));

        /** Execute funds transfer and pay fees. */
        uint price = executeFundsTransfer(buy, sell);

        /** Static calls are intentionally done after the effectful call so they can check resulting state. */

        /** Handle buy-side static call if specified. */
        if (buy.staticTarget != address(0)) {
            require(staticCall(buy.staticTarget, sell.data, buy.staticExtradata));
        }

        /** Handle sell-side static call if specified. */
        if (sell.staticTarget != address(0)) {
            require(staticCall(sell.staticTarget, sell.data, sell.staticExtradata));
        }

         /** EFFECTS */

        /** Mark previously signed or approved orders as finalized. */
        cancelledOrFinalized[buyHash] = true;
        cancelledOrFinalized[sellHash] = true;

        /** Invalidate parallel listings */
        if (additionalSales.length > 0){
            require(additionalSales.length == sigs.length, "Marketplace: wrong arguments for invalidation.");
            for(uint i; i < additionalSales.length; i++){
                _cancelOrder(additionalSales[i], sigs[i]);
            }
        }

        /** Log match */
        bytes memory settledParameters = abi.encode(price, sell.outline.target, buy.data);

        emit OrdersMatched(buyHash, sellHash,sell.outline.maker, buy.outline.maker, settledParameters);
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
     * @dev Approve an order and optionally mark it for orderbook inclusion. Must be called by the maker of the order
     * @param order Order to approve
     */
    function _approveOrder(Order calldata order, bool orderbookInclusionDesired)
        internal
    {
        /** CHECKS */

        /** Assert sender is authorized to approve order. */
        require(msg.sender == order.outline.maker);

        require(order.outline.taker != address(0));

        /** Calculate order hash. */
        bytes32 hash = _hashToSign(order);

        /** Assert order has not already been approved. */
        require(!approvedOrders[hash]);

        /** EFFECTS */

        approvedOrders[hash] = true;
  
        emit OrderApproved(hash, order.outline.maker, order.outline.taker, order.data, orderbookInclusionDesired);
    }

    /**
     * @dev Cancel an order, preventing it from being matched. Must be called by the maker of the order
     * @param order Order to cancel
     * @param sig ECDSA signature
     */
    function _cancelOrder(Order calldata order, Sig calldata sig) 
        internal
    {
        /** CHECKS */

        /** Calculate order hash. */
        bytes32 hash = _hashToSign(order);
        
        /** Assert sender is authorized to cancel order. */
        require(msg.sender == order.outline.maker || authenticateOrder(hash, order.outline.maker, sig), "Marketplace: you don't have rights to cancel this order.");

        /** EFFECTS */
      
        /** Mark order as cancelled, preventing it from being matched. */
        if (!cancelledOrFinalized[hash]){

            cancelledOrFinalized[hash] = true;

             /** Log cancel event. */
            emit OrderCancelled(hash, msg.sender, order.data);
        }
    }
}