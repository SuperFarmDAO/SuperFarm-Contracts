'use strict';
const { expect } = require('chai');
import 'chai/register-should';
// import { ethers } from 'ethers';
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
            200,
            multicall.address
        );

        super1155 = await Super1155.deploy(
            owner.address,
            "Super1155",
            "0/00",
            "0/00",
            NULL_ADDRESS
        );
        let balanceOf1155ABI = ["function balanceOf (address _owner, uint256 _id) external view returns (uint256)"];
        let ifaceBalanceOf = new ethers.utils.Interface(balanceOf1155ABI);
        let calldata1 = ifaceBalanceOf.encodeFunctionData("balanceOf", [  NULL_ADDRESS, 22 ]);



        let ABItotalBalances = ["function totalBalances (address) external view returns (uint256)"];
        // console.log(1);
        let ifaceTotalBalances = new ethers.utils.Interface(ABItotalBalances);
        // console.log(ifaceTotalBalances)
        // console.log(2);
        // let callData2 = ifaceTotalBalances.encodeFunctionData("totalBalances", [ NULL_ADDRESS ]);
        let calldata2 = ifaceTotalBalances.encodeFunctionData("totalBalances", [  NULL_ADDRESS ]);

        // console.log(3);


        await mintShop.setItems([super1155.address]);
        let call1 = [
            {
                target: super1155.address,
                callData: calldata1
            },
            {
                target: super1155.address,
                callData: calldata2
            }
        ];

        console.log(calldata1.length, calldata2.length)
        // console.log(call1);
        
        let latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
        // console.log(6);

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
                requiredId: [],
                calls: call1
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
        // console.log(4);


    });

    it ("Shoud get data", async function() {
        // console.log(15)
        // let ABIgetPools = ["function getPools(uint256[] calldata _ids, uint256 _itemIndex) external view returns (PoolOutput[] memory)"];
        // let iface = new ethers.utils.Interface(ABIgetPools);
        // // let encodedData = await ethers.utils.defaultAbiCoder.encode([ "uint[]", "uint" ], [ [ 0 ], 0])
        // let test = iface.getSighash("getPools");
        // console.log(test);

        // let encodedData = iface.encodeFunctionData("getPools", [  [ 0 ], 0 ]);
        // console.log(mintShop.address);
        // let call = {
        //     target: mintShop.address,
        //     callData: encodedData
        // }
        // let ABItotalBalances = ["function totalBalances (address) external view returns (uint256)"];
        // let balanceOf1155ABI = ["function balanceOf (address _owner, uint256 _id) external view returns (uint256)"];
        // let ifaceTotalBalances = new ethers.utils.Interface(ABItotalBalances);
        // let ifaceBalanceOf = new ethers.utils.Interface(balanceOf1155ABI);


        // let selectorTotalBalances = ifaceTotalBalances.getSighash("totalBalances");
        // let selectorBalanceOf = ifaceBalanceOf.getSighash("balanceOf");

        // let call = [
        //     { 
        //         target: super1155.address,
        //         callData: selectorBalanceOf,
        //         id: 0
        //     }, 
        //     { 
        //         target: super1155.address,
        //         callData: selectorTotalBalances,
        //         id: ethers.constants.MaxUint256
        //     }
        // ]


        // let result = await multicall.test(call, owner.address);

        // console.log(result)
        console.log(5);

        let res = await mintShop.checkRequirments(0);
        console.log(res)

    });
});