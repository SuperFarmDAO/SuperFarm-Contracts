import {ethers, network} from "hardhat";

export const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export async function getCurrentTime(){
    return (
      await ethers.provider.getBlock(await ethers.provider.getBlockNumber())
    ).timestamp;
}

export async function evm_increaseTime(seconds){
    await network.provider.send("evm_increaseTime", [seconds]);
    await network.provider.send("evm_mine");
}

/*=======================MARKETPLACE===========================*/
export const replacementPatternBuy = "0x00000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
export const replacementPatternSell = "0x000000000000000000000000000000000000000000000000000000000000000000000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000000000000000000000000000000000000000000000000000000000000000";
export const mint = {
    weth: {
        bob: ethers.utils.parseEther("100"),
        alice: ethers.utils.parseEther("10")
    },
    exchangeToken:{
        bob: ethers.utils.parseEther("1000"),
        alice: ethers.utils.parseEther("2000")
    },
    erc721:{
        bob: 1,
        alice: 2
    },
    erc1155:{
        bob: {
            id: 1,
            amount: 5,
            data: 0x0
        },
        alice:{
            id: 2,
            amount: 3,
            data: 0x0
        }
    }
}
export function makeOrder(
    _basePrice,
    _paymentToken,
    _exchangeToken,
    _listingTime,
    _salt,
    _feeRecipient,
    _exchange,
    _maker,
    _taker,
    _target,
    _data,
    _replacementPattern,
    _side, 
    _saleKind
    ){
    return {
        basePrice: _basePrice,
        extra: 0,
        listingTime: _listingTime,
        expirationTime: _listingTime+6000,
        salt: _salt,
        makerRelayerFee: 0,
        takerRelayerFee: 0,
        makerProtocolFee: 0,
        takerProtocolFee: 0,
        exchange: _exchange,
        feeMethod: 0,
        maker: _maker,
        side: _side,
        taker: _taker,
        saleKind: _saleKind,
        feeRecipient: _feeRecipient,
        callType: 0,
        target: _target,
        staticTarget: NULL_ADDRESS,
        paymentToken: _paymentToken,
        data: _data,
        replacementPattern: _replacementPattern,
        staticExtradata: 0x0
    }
}
async function withTestTokens(){
    const TestERC1155 = await ethers.getContractFactory("TestERC1155");
    const TestERC721 = await ethers.getContractFactory("TestERC721");
    const TestExchangeToken = await ethers.getContractFactory("TestExchangeToken");
    const TestWrappedEther = await ethers.getContractFactory("TestWETH");

    const erc1155 = await TestERC1155.deploy();
    await erc1155.deployed()
    const erc721 = await TestERC721.deploy();
    await erc721.deployed()
    const exchangeToken = await TestExchangeToken.deploy();
    await exchangeToken.deployed()
    const weth = await TestWrappedEther.deploy();
    await weth.deployed()

    return [erc1155, erc721, exchangeToken, weth]
}

async function withProxies(){
    const Registry = await ethers.getContractFactory("SuperProxyRegistry");
    const TokenTransferProxy = await ethers.getContractFactory("SuperTokenTransferProxy");

    const registry = await Registry.deploy();
    await registry.deployed()
    const transferProxy = await TokenTransferProxy.deploy(registry.address);
    await transferProxy.deployed()

    return [registry, transferProxy]
}

export const withContracts = async function(protocolFeeRecipient, chainId){
    const [erc1155, erc721, exchangeToken, weth] = await withTestTokens();
    const[registry, transferProxy] = await withProxies();

    const Marketplace = await ethers.getContractFactory("SuperMarketplace");

    const marketplace = await Marketplace.deploy(
        chainId,
        [registry.address],
        ethers.utils.defaultAbiCoder.encode(["string"],["\x19Ethereum Signed Message:\n"]),
        exchangeToken.address,
        transferProxy.address,
        protocolFeeRecipient
    );
    await marketplace.deployed()

    return [marketplace, registry, transferProxy, erc1155, erc721, exchangeToken, weth]
}
/*=======================MARKETPLACE===========================*/