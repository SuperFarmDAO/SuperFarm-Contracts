'use strict';
const { expect } = require('chai');
import 'chai/register-should';
// import { ethers } from 'ethers';
let owner, user_one, user_two;
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
describe("Multicall", function () {
    let multicall, Multicall, mintShop, MintShop, super1155, Super1155;
    beforeEach(async () => {
        [owner, user_one, user_two] = await ethers.getSigners();
        Multicall = await ethers.getContractFactory('Multicall');
        MintShop = await ethers.getContractFactory("MintShop1155");
        Super1155 = await ethers.getContractFactory("Super1155");
        multicall = await Multicall.deploy();

        mintShop = await MintShop.deploy(
            owner.address,
            user_one.address,
            4,
            200
        );

        super1155 = await Super1155.deploy(
            owner.address,
            "Super1155",
            "0/00",
            "0/00",
            NULL_ADDRESS
        );

        await mintShop.setItems([super1155.address]);
        
        let latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
        await mintShop.connect(owner).addPool({
            name: "firstPool",
            startTime: latestBlock.timestamp,
            endTime: latestBlock.timestamp + 60,
            purchaseLimit: 5,
            singlePurchaseLimit: 2,
            requirement: {
                requiredType: 0,
                requiredAsset: [NULL_ADDRESS],
                requiredAmount: 1,
                whitelistId: 1,
                requiredId: []
            },
            collection: super1155.address
        }, [1, 2], [1, 1], [10, 1], [[{
            assetType: 1,
            asset: NULL_ADDRESS,
            price: 1
        }], [{
            assetType: 1,
            asset: NULL_ADDRESS,
            price: 1
        }]]);
    });

    it ("Shoud get data", async function() {
        let ABIgetPools = ["function getPools(uint256[] calldata _ids, uint256 _itemIndex) external view returns (PoolOutput[] memory)"];
        let iface = new ethers.utils.Interface(ABIgetPools);
        // let encodedData = await ethers.utils.defaultAbiCoder.encode([ "uint[]", "uint" ], [ [ 0 ], 0])

        let encodedData = iface.encodeFunctionData("getPools", [  [ 0 ], 0 ]);
        console.log(mintShop.address);
        let call = {
            target: mintShop.address,
            callData: encodedData
        }
        let result = await multicall.staticCall([call]);

        console.log(result)
    });
});