import { ethers, network } from "hardhat";

export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

export async function getCurrentTime() {
  return (
    await ethers.provider.getBlock(await ethers.provider.getBlockNumber())
  ).timestamp;
}

export async function evm_increaseTime(seconds) {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
}

/*=======================MARKETPLACE===========================*/
export const replacementPatternBuy =
  "0x00000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
export const replacementPatternSell =
  "0x000000000000000000000000000000000000000000000000000000000000000000000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000000000000000000000000000000000000000000000000000000000000000";
export const mint = {
  weth: {
    bob: ethers.utils.parseEther("100"),
    alice: ethers.utils.parseEther("10"),
  },
  erc721: {
    bob: 1,
    alice: 2,
  },
  erc1155: {
    bob: {
      id: 1,
      amount: 5,
      data: 0x0,
    },
    alice: {
      id: 2,
      amount: 3,
      data: 0x0,
    },
  },
};

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
  _staticExtraData
) {
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
      paymentToken: _paymentToken,
    },
    extra: _extra,
    salt: _salt,
    fees: _fees,
    addresses: _addresses,
    staticTarget: _staticTarget,
    data: _data,
    replacementPattern: _replacementPattern,
    staticExtradata: _staticExtraData,
  };
}

async function withTestTokens() {
  const TestERC1155 = await ethers.getContractFactory("TestERC1155");
  const TestERC721 = await ethers.getContractFactory("TestERC721");
  const TestWrappedEther = await ethers.getContractFactory("wETH");

  const erc1155 = await TestERC1155.deploy();
  await erc1155.deployed();
  const erc721 = await TestERC721.deploy();
  await erc721.deployed();
  const weth = await TestWrappedEther.deploy();
  await weth.deployed();

  return [erc1155, erc721, weth];
}

async function withProxies() {
  const Registry = await ethers.getContractFactory("SuperProxyRegistry");
  const TokenTransferProxy = await ethers.getContractFactory(
    "SuperTokenTransferProxy"
  );

  const registry = await Registry.deploy();
  await registry.deployed();
  const transferProxy = await TokenTransferProxy.deploy(registry.address);
  await transferProxy.deployed();

  return [registry, transferProxy];
}

export const withContracts = async function (
  platformFeeAddress,
  minimumPlatformFee
) {
  const [erc1155, erc721, weth] = await withTestTokens();
  const [registry, transferProxy] = await withProxies();

  const Marketplace = await ethers.getContractFactory("SuperMarketplace");

  const marketplace = await Marketplace.deploy(
    registry.address,
    ethers.utils.defaultAbiCoder.encode(
      ["string"],
      ["\x19Ethereum Signed Message:\n"]
    ),
    transferProxy.address,
    platformFeeAddress,
    minimumPlatformFee
  );
  await marketplace.deployed();

  return [marketplace, registry, transferProxy, erc1155, erc721, weth];
};

export const OrderType = {
  Order: [
    {
      name: "outline",
      type: "Outline",
    },
    {
      name: "extra",
      type: "uint256[]",
    },
    {
      name: "salt",
      type: "uint256",
    },
    {
      name: "fees",
      type: "uint256[]",
    },
    {
      name: "addresses",
      type: "address[]",
    },
    {
      name: "staticTarget",
      type: "address",
    },
    {
      name: "data",
      type: "bytes",
    },
    {
      name: "replacementPattern",
      type: "bytes",
    },
    {
      name: "staticExtradata",
      type: "bytes",
    },
  ],
  Outline: [
    {
      name: "basePrice",
      type: "uint256",
    },
    {
      name: "listingTime",
      type: "uint256",
    },
    {
      name: "expirationTime",
      type: "uint256",
    },
    {
      name: "exchange",
      type: "address",
    },
    {
      name: "maker",
      type: "address",
    },
    {
      name: "side",
      type: "uint8",
    },
    {
      name: "taker",
      type: "address",
    },
    {
      name: "saleKind",
      type: "uint8",
    },
    {
      name: "target",
      type: "address",
    },
    {
      name: "callType",
      type: "uint8",
    },
    {
      name: "paymentToken",
      type: "address",
    },
  ],
};
/*=======================MARKETPLACE===========================*/

/*=======================MERKLE UTILS (with allowances)===========================*/

export const expandLeaves = function (balances) {
  var addresses = Object.keys(balances);
  addresses.sort(function (a, b) {
    var al = a.toLowerCase(),
      bl = b.toLowerCase();
    if (al < bl) {
      return -1;
    }
    if (al > bl) {
      return 1;
    }
    return 0;
  });

  return addresses.map(function (a, i) {
    return { address: a, index: i, allowance: balances[a] };
  });
};

export const hash = function (index, address, allowance) {
  return ethers.utils.solidityKeccak256(
    ["uint256", "address", "uint256"],
    [index, address, allowance]
  );
};

// Get hashes of leaf nodes
export const getLeaves = function (balances) {
  var leaves = expandLeaves(balances);

  return leaves.map(function (leaf) {
    return ethers.utils.solidityKeccak256(
      ["uint256", "address", "uint256"],
      [leaf.index, leaf.address, leaf.allowance]
    );
  });
};

export const computeRootHash = function (balances) {
  var leaves = getLeaves(balances);
  // console.log(leaves)
  while (leaves.length > 1) {
    reduceMerkleBranches(leaves);
  }

  return leaves[0];
};

export const computeMerkleProof = function (index, address) {
  var leaves = getLeaves(address);

  if (index == null) {
    throw new Error("address not found");
  }

  var path = index;

  var proof = [];
  while (leaves.length > 1) {
    if (path % 2 == 1) {
      proof.push(leaves[path - 1]);
    } else {
      if (typeof leaves[path + 1] != "undefined") proof.push(leaves[path + 1]);
      else proof.push(leaves[path]);
    }

    // Reduce the merkle tree one level
    reduceMerkleBranches(leaves);

    // Move up
    path = parseInt(path / 2);
  }
  // console.log(proof)
  return proof;
};

export const reduceMerkleBranches = function (leaves) {
  var output = [];

  while (leaves.length) {
    var left = leaves.shift();
    var right = leaves.length === 0 ? left : leaves.shift();
    output.push(
      ethers.utils.solidityKeccak256(["bytes32", "bytes32"], [left, right])
    );
  }
  output.forEach(function (leaf) {
    leaves.push(leaf);
  });
};

export const getIndex = function (balances, address) {
  // address = address.toLowerCase();

  var leaves = expandLeaves(balances);

  var index = null;
  for (var i = 0; i < leaves.length; i++) {
    if (i != leaves[i].index) {
      throw new Error("bad index mapping");
    }
    if (leaves[i].address === address) {
      return leaves[i].index;
    }
  }

  throw new Error("address not found");
};

/*=======================MERKLE UTILS (with allowances)===========================*/

/*=======================MULTICALL=================================*/
export const decodeResult = function (contractABI, func, result) {
  var functionABI = contractABI.abi.find((abiItem) => {
    return abiItem.name == func;
  });
  var abiCoder = ethers.utils.defaultAbiCoder;
  var decoded = abiCoder.decode(functionABI.outputs, String(result));
  return decoded;
};

export const encodeCall = function (address, contractABI, func, param) {
  var functionABI = contractABI.abi.find((abiItem) => {
    return abiItem.name == func;
  });
  var iface = new ethers.utils.Interface([functionABI]);
  var encodedData = iface.encodeFunctionData(func, param);
  var call = {
    target: address,
    callData: encodedData,
  };
  return [call];
};

// decodeResults and encodeCalls fucntions
export const decodeResults = function (contractABIs, funcs, results) {
  // iterate over ABIs and funcs to extract result for each call from common
  var decoded = [];
  for (var i = 0; i < funcs.length; i++) {
    var result = decodeResult(contractABIs[i], funcs[i], results[i]);
    decoded = decoded.concat(result);
  }
  return decoded;
};

export const encodeCalls = function (addresses, contractABIs, funcs, params) {
  var encoded = [];
  for (var i = 0; i < addresses.length; i++) {
    var call = encodeCall(addresses[i], contractABIs[i], funcs[i], params[i]);
    encoded = encoded.concat(call);
  }
  return encoded;
};

/*=======================MULTICALL=================================*/

/*===============================DIAMOND UTILS=================================== */

//
export const universal =
  "0xffffffffffffffffffffffffffffffff00000000000000000000000000000000";
export const mintRights =
  "0xfdf81848136595c31bb5f76217767372bc4bf906663038eb38381131ea27ecba";

// get function selectors from ABI
export const getSelectors = function (contract) {
  const signatures = Object.keys(contract.interface.functions);
  const selectors = signatures.reduce((acc, val) => {
    if (val !== "init(bytes)") {
      acc.push(contract.interface.getSighash(val));
    }
    return acc;
  }, []);
  selectors.contract = contract;
  selectors.remove = remove;
  selectors.get = get;
  return selectors;
};

// get function selector from function signature
export const getSelector = function (func) {
  const abiInterface = new ethers.utils.Interface([func]);
  return abiInterface.getSighash(ethers.utils.Fragment.from(func));
};

// used with getSelectors to remove selectors from an array of selectors
// functionNames argument is an array of function signatures
function remove(functionNames) {
  const selectors = this.filter((v) => {
    for (const functionName of functionNames) {
      if (v === this.contract.interface.getSighash(functionName)) {
        return false;
      }
    }
    return true;
  });
  selectors.contract = this.contract;
  selectors.remove = this.remove;
  selectors.get = this.get;
  return selectors;
}

// used with getSelectors to get selectors from an array of selectors
// functionNames argument is an array of function signatures
function get(functionNames) {
  const selectors = this.filter((v) => {
    for (const functionName of functionNames) {
      if (v === this.contract.interface.getSighash(functionName)) {
        return true;
      }
    }
    return false;
  });
  selectors.contract = this.contract;
  selectors.remove = this.remove;
  selectors.get = this.get;
  return selectors;
}

// remove selectors using an array of signatures
function removeSelectors(selectors, signatures) {
  const iface = new ethers.utils.Interface(
    signatures.map((v) => "function " + v)
  );
  const removeSelectors = signatures.map((v) => iface.getSighash(v));
  selectors = selectors.filter((v) => !removeSelectors.includes(v));
  return selectors;
}

// find a particular address position in the return value of diamondLoupeFacet.facets()
function findAddressPositionInFacets(facetAddress, facets) {
  for (let i = 0; i < facets.length; i++) {
    if (facets[i].facetAddress === facetAddress) {
      return i;
    }
  }
}

/*===============================DIAMOND UTILS=================================== */
