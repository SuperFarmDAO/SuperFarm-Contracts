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
    _extra,
    _listingTime,
    _expirationTime, 
    _salt,
    _fees, 
    _addresses, 
    _exchange, 
    _maker,
    _side,
    _taker, 
    _saleKind,
    _callType,
    _target,
    _staticTarget,
    _paymentToken,
    _data,
    _replacementPattern,
    _staticExtraData,
    ){
    return {
        basePrice: _basePrice,
        extra: _extra,
        listingTime: _listingTime,
        expirationTime: _expirationTime,
        salt: _salt,
        fees: _fees,
        addresses: _addresses,
        exchange: _exchange,
        maker: _maker,
        side: _side,
        taker: _taker,
        saleKind: _saleKind,
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
    const TestWrappedEther = await ethers.getContractFactory("TestWETH");

    const erc1155 = await TestERC1155.deploy();
    await erc1155.deployed()
    const erc721 = await TestERC721.deploy();
    await erc721.deployed()
    const weth = await TestWrappedEther.deploy();
    await weth.deployed()

    return [erc1155, erc721, weth]
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

export const withContracts = async function(chainId, platformFeeAddress, minimumPlatformFee){
    const [erc1155, erc721, weth] = await withTestTokens();
    const[registry, transferProxy] = await withProxies();

    const Marketplace = await ethers.getContractFactory("SuperMarketplace");

    const marketplace = await Marketplace.deploy(
        chainId,
        [registry.address],
        ethers.utils.defaultAbiCoder.encode(["string"],["\x19Ethereum Signed Message:\n"]),
        transferProxy.address,
        platformFeeAddress,
        minimumPlatformFee
    );
    await marketplace.deployed()

    return [marketplace, registry, transferProxy, erc1155, erc721, weth]
}
/*=======================MARKETPLACE===========================*/

/*=======================MERKLE UTILS (with allowances)===========================*/

export const expandLeaves = function (balances) {
    var addresses = Object.keys(balances)
    addresses.sort(function(a, b) {
        var al = a.toLowerCase(), bl = b.toLowerCase();
        if (al < bl) { return -1; }
        if (al > bl) { return 1; }
        return 0;
    });

    return addresses.map(function(a, i) { return { address: a, index: i, allowance: balances[a]}; });
}


export const hash = function(index, address, allowance) {
    return ethers.utils.solidityKeccak256(["uint256", "address", "uint256"], [index, address, allowance]);

}

// Get hashes of leaf nodes
export const getLeaves = function(balances) {
    var leaves = expandLeaves(balances);
    
    return leaves.map(function(leaf) {
        return ethers.utils.solidityKeccak256(["uint256", "address", "uint256"], [leaf.index, leaf.address, leaf.allowance]);
    });
}

export const computeRootHash = function(balances) {
    var leaves = getLeaves(balances);
    // console.log(leaves)
    while (leaves.length > 1) {
        reduceMerkleBranches(leaves);
    }

    return leaves[0];
}


export const computeMerkleProof = function(index, address) {
    var leaves = getLeaves(address);

    if (index == null) { throw new Error('address not found'); }

    var path = index;

    var proof = [ ];
    while (leaves.length > 1) {
        if ((path % 2) == 1) {
            proof.push(leaves[path - 1])
        } else {
            if (typeof leaves[path + 1] != "undefined")
                proof.push(leaves[path + 1])
            else
                proof.push(leaves[path])
        }

        // Reduce the merkle tree one level
        reduceMerkleBranches(leaves);

        // Move up
        path = parseInt(path / 2);
    }
    // console.log(proof)
    return proof;
}

export const reduceMerkleBranches = function(leaves) {
    var output = [];

    while (leaves.length) {
        var left = leaves.shift();
        var right = (leaves.length === 0) ? left: leaves.shift();
        output.push(ethers.utils.solidityKeccak256(["bytes32", "bytes32"], [left, right]));
    }
    output.forEach(function(leaf) {
        leaves.push(leaf);
    });
}


export const getIndex = function(balances, address) {
    // address = address.toLowerCase();

    var leaves = expandLeaves(balances);

    var index = null;
    for (var i = 0; i < leaves.length; i++) {
        if (i != leaves[i].index) { throw new Error('bad index mapping'); }
        if (leaves[i].address === address) { return leaves[i].index; }
    }

    throw new Error('address not found');
}

/*=======================MERKLE UTILS (with allowances)===========================*/
