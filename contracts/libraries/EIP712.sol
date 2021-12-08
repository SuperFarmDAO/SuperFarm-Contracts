pragma solidity ^0.8.8;

abstract contract EIP712 {

    struct EIP712Domain {
        string  name;
        string  version;
        uint256 chainId;
        address verifyingContract;
    }

    bytes32 constant EIP712DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    bytes internal personalSignPrefix = "\x19Ethereum Signed Message:\n";

    bytes32 constant public ORDER_TYPEHASH = keccak256(
      "Order(uint256 basePrice,uint256[] extra,uint256 listingTime,uint256 salt,uint256[] fees,address[] addresses,address exchange,address maker,uint8 side,address taker,uint8 saleKind,uint8 callType,address target,address staticTarget,address paymentToken,bytes data,bytes replacementPattern,bytes staticExtradata)"
      );

    bytes32 immutable public DOMAIN_SEPARATOR;
    
    constructor(string memory name, string memory version, uint chainId){
        DOMAIN_SEPARATOR = hash(EIP712Domain({
            name              : name,
            version           : version,
            chainId           : chainId,
            verifyingContract : address(this)
        }));
    }

    function hash(EIP712Domain memory eip712Domain)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(
            EIP712DOMAIN_TYPEHASH,
            keccak256(bytes(eip712Domain.name)),
            keccak256(bytes(eip712Domain.version)),
            eip712Domain.chainId,
            eip712Domain.verifyingContract
        ));
    }

}