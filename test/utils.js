import {ethers, network} from 'hardhat';

export const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export async function getCurrentTime(){
    return (
      await ethers.provider.getBlock(await ethers.provider.getBlockNumber())
    ).timestamp;
}

export async function evm_increaseTime(seconds){
    await network.provider.send('evm_increaseTime', [seconds]);
    await network.provider.send('evm_mine');
}

/*=======================MARKETPLACE===========================*/
export const replacementPatternBuy = '0x00000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
export const replacementPatternSell = '0x000000000000000000000000000000000000000000000000000000000000000000000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000000000000000000000000000000000000000000000000000000000000000';
export const mint = {
    weth: {
        bob: ethers.utils.parseEther('100'),
        alice: ethers.utils.parseEther('10')
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
    _staticExtraData)
    {
    return {
            outline: {
            basePrice: _basePrice,
            listingTime: _listingTime,
            expirationTime: _expirationTime,
            exchange: _exchange,
            maker: _maker,
            side: _side,
            taker: _taker,
            saleKind: _saleKind,
            target: _target,
            callType: _callType,
            paymentToken: _paymentToken
        },
        extra: _extra,
        salt: _salt,
        fees: _fees,
        addresses: _addresses,
        staticTarget: _staticTarget,
        data: _data,
        replacementPattern: _replacementPattern,
        staticExtradata: _staticExtraData
    }
}

async function withTestTokens(){
    const TestERC1155 = await ethers.getContractFactory('TestERC1155');
    const TestERC721 = await ethers.getContractFactory('TestERC721');
    const TestWrappedEther = await ethers.getContractFactory('wETH');

    const erc1155 = await TestERC1155.deploy();
    await erc1155.deployed()
    const erc721 = await TestERC721.deploy();
    await erc721.deployed()
    const weth = await TestWrappedEther.deploy();
    await weth.deployed()

    return [erc1155, erc721, weth]
}

async function withProxies(){
    const Registry = await ethers.getContractFactory('SuperProxyRegistry');
    const TokenTransferProxy = await ethers.getContractFactory('SuperTokenTransferProxy');

    const registry = await Registry.deploy();
    await registry.deployed()
    const transferProxy = await TokenTransferProxy.deploy(registry.address);
    await transferProxy.deployed()

    return [registry, transferProxy]
}

export const withContracts = async function(platformFeeAddress, minimumPlatformFee, protocolFeeAddress, minimumProtocolFee){
    const [erc1155, erc721, weth] = await withTestTokens();
    const[registry, transferProxy] = await withProxies();

    const Marketplace = await ethers.getContractFactory('SuperMarketplace');

    const marketplace = await Marketplace.deploy(
        registry.address,
        ethers.utils.defaultAbiCoder.encode(['string'],['\x19Ethereum Signed Message:\n']),
        transferProxy.address,
        platformFeeAddress,
        minimumPlatformFee,
        protocolFeeAddress,
        minimumProtocolFee
    );
    await marketplace.deployed()

    return [marketplace, registry, transferProxy, erc1155, erc721, weth]
}

export const OrderType = {
    Order: [
        {
            name: 'outline',
            type: 'Outline'
        },
        {
            name: 'extra',
            type: 'uint256[]'
        },
        {
            name: 'salt',
            type: 'uint256'
        },
        {
            name: 'fees',
            type: 'uint256[]'
        },
        {
            name: 'addresses',
            type: 'address[]'
        },
        {
            name: 'staticTarget',
            type: 'address'
        },
        {
            name: 'data',
            type: 'bytes'
        },
        {
            name: 'replacementPattern',
            type: 'bytes'
        },
        {
            name: 'staticExtradata',
            type: 'bytes'
        }
    ],
    Outline: [
        {
            name: 'basePrice',
            type: 'uint256'
        },
        {
            name: 'listingTime',
            type: 'uint256'
        },
        {
            name: 'expirationTime',
            type: 'uint256'
        },
        {
            name: 'exchange',
            type: 'address'
        },
        {
            name: 'maker',
            type: 'address'
        },
        {
            name: 'side',
            type: 'uint8'
        },
        {
            name: 'taker',
            type: 'address'
        },
        {
            name: 'saleKind',
            type: 'uint8'
        },
        {
            name: 'target',
            type: 'address'
        },
        {
            name: 'callType',
            type: 'uint8'
        },
        {
            name: 'paymentToken',
            type: 'address'
        },
    ]
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
    return ethers.utils.solidityKeccak256(['uint256', 'address', 'uint256'], [index, address, allowance]);

}

// Get hashes of leaf nodes
export const getLeaves = function(balances) {
    var leaves = expandLeaves(balances);

    return leaves.map(function(leaf) {
        return ethers.utils.solidityKeccak256(['uint256', 'address', 'uint256'], [leaf.index, leaf.address, leaf.allowance]);
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
            if (typeof leaves[path + 1] != 'undefined')
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
        var right = (leaves.length === 0) ? left : leaves.shift();
        output.push(ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [left, right]));
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


/*=================================SUPER TOKENS===============================*/
export const withSuperTokens = async function(
    ownerAddress721,
    name721 = 'Super721',
    symbol721 = 'S721',
    metadataURI721 = '://ipfs/uri/',
    contractURI721 = '://ipfs/uri/',
    proxyRegistryAddress721 = ethers.constants.AddressZero,
    ownerAddress1155 = ownerAddress721,
    name1155 = 'Super1155',
    metadataURI_1155 = '://ipfs/uri/',
    contractURI_1155 = '://ipfs/uri/',
    proxyRegistryAddress1155 = ethers.constants.AddressZero
) {
    const Super721 = await ethers.getContractFactory('Super721');
    const Super1155 = await ethers.getContractFactory('Super1155');

    let super721 = await Super721.deploy(
        ownerAddress721,
        name721,
        symbol721,
        metadataURI721,
        contractURI721,
        proxyRegistryAddress721
    );
    let super1155 = await Super1155.deploy(
        ownerAddress1155,
        name1155,
        metadataURI_1155,
        contractURI_1155,
        proxyRegistryAddress1155
    );

    return [super721, super1155];
}

// ENUMS in Super721
const S721SupplyType = Object.freeze({
    Capped: 0,
    Uncapped: 1,
    Flexible: 2
});

const S721BurnType = Object.freeze({
    None: 0,
    Burnable: 1,
    Replenishable: 2
});

// ENUMS in Super1155
const S1155SupplyType = Object.freeze({
    Capped: 0 ,
    Uncapped: 1 ,
    Flexible: 2 
});

const S1155ItemType = Object.freeze({
    Nonfungible: 0,
    Fungible: 1,
    Semifungible: 2
  });

const S1155BurnType = Object.freeze({
    None: 0,
    Burnable: 1,
    Replenishable: 2
});
/*=================================SUPER TOKENS===============================*/