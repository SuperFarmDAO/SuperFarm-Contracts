const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { mnemonicToSeed } = require('ethers/lib/utils');
const { ethers } = require('hardhat');
const Web3 = require('web3');

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const DATA = "0x02";

///////////////////////////////////////////////////////////
// SEE https://hardhat.org/tutorial/testing-contracts.html
// FOR HELP WRITING TESTS
// USE https://github.com/gnosis/mock-contract FOR HELP
// WITH MOCK CONTRACT
///////////////////////////////////////////////////////////

// Start test block
describe('===SuperMerkleAccess SuperMerkleDistributor===', function () {
    let deployer, owner, paymentReceiver, signer1, signer2, signer3;

    let sma, smd;
    let super1155, mintRight, UNIVERSAL;
    let itemGroupId = ethers.BigNumber.from(1);
    let shiftedItemGroupId = itemGroupId.shl(128);
    let itemGroupId2 = ethers.BigNumber.from(2);
    let shiftedItemGroupId2 = itemGroupId2.shl(128);
    before(async function () {
        this.SuperMerkleAccess = await ethers.getContractFactory("SuperMerkleAccess");
        this.SuperMerkleDistributor = await ethers.getContractFactory("SuperMerkleDistributor");
        this.Super1155 = await ethers.getContractFactory("Super1155");
    });

    beforeEach(async function () {
        [deployer, owner, paymentReceiver, signer1, signer2, signer3] = await ethers.getSigners();

        sma = await this.SuperMerkleAccess.deploy();
        await sma.deployed();

        smd = await this.SuperMerkleDistributor.deploy();
        await smd.deployed();

        super1155 = await this.Super1155.deploy(
            deployer.address,
            "Super1155",
            "://ipfs/uri/{id}",
            NULL_ADDRESS
        );
        await super1155.deployed();

        mintRight = await super1155.MINT();
        UNIVERSAL = await super1155.UNIVERSAL();
    });

    describe("SuperMerkleAccess", function () {
        it('should check validity', async function () {
            // console.log(ethers.utils.solidityKeccak256(["address"], [deployer.address]));
            // console.log(ethers.utils.solidityKeccak256(["address"], [owner.address]));
            // console.log(ethers.utils.solidityKeccak256(["address"], [paymentReceiver.address]));
            // console.log(ethers.utils.solidityKeccak256(["address"], [signer1.address]));
            // console.log(ethers.utils.solidityKeccak256(["address"], [signer2.address]));
            // console.log(ethers.utils.solidityKeccak256(["address"], [signer3.address]));

               /* Off-chain list of addresses and hashes (SuperMerkleAccess)
            Index   Address
            0       0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266  hash =  0xe9707d0e6171f728f7473c24cc0432a9b07eaaf1efed6a137a4a8c12c79552d9  hash = 0xd23475cf57127790c97e39187b822dcff8f2746b545686570c611dbd95746be9  hash =  0xcbd7db216427a61297ec0d7f576a864376cbd4f9fcf02d3c789a7447ec08903c  Roothash = 0x7a07e10e49b7f7330d828cc83d25bfd22120da182f934c64b2e425d5ddfc8d70 
            1       0x70997970C51812dc3A010C7d01b50e0d17dc79C8  hash =  0x00314e565e0574cb412563df634608d76f5c59d9f817e85966100ec1d48005c0  

            2       0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC  hash =  0x8a3552d60a98e0ade765adddad0a2e420ca9b1eef5f326ba7ab860bb4ea72c94  hash = 0xc14b0ddb8e5ea5a2dab0fa169c7cda24f37cf5896c12a930a650d094eca2ae7f
            3       0x90F79bf6EB2c4f870365E785982E1f101E93b906  hash =  0x1ebaa930b8e9130423c183bf38b0564b0103180b7dad301013b18e59880541ae  

            4       0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65  hash =  0xf4ca8532861558e29f9858a3804245bb30f0303cc71e4192e41546237b6ce58b  hash = 0x475c5d26aa18ffb9161fadc3542fa0570c5ca4fc8a994f69219fd5157f2f7aa7  hash =  0x5b2c3d7800af447e7cbc229fcfdf4bfd17eda56c98f29e340490723cf95b82d1
            5       0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc  hash =  0xe5c951f74bc89efa166514ac99d872f6b7a3c11aff63f51246c3742dfa925c9b  
            */

            let block = await ethers.provider.getBlock()
            sma.connect(deployer).setAccessRound(0, "0x7a07e10e49b7f7330d828cc83d25bfd22120da182f934c64b2e425d5ddfc8d70", block.timestamp, block.timestamp + 60);
            let merkleRoot = await sma.connect(deployer).accessRoots(0);
            await expect(
                merkleRoot.merkleRoot)
                .to.be.equal("0x7a07e10e49b7f7330d828cc83d25bfd22120da182f934c64b2e425d5ddfc8d70");

            await expect(await sma.connect(signer1).verify(
                0, // MerkleRoot maping Id
                2, // Index of Node in the list off-chain
                "0x8a3552d60a98e0ade765adddad0a2e420ca9b1eef5f326ba7ab860bb4ea72c94", // Node at that index
                ["0x1ebaa930b8e9130423c183bf38b0564b0103180b7dad301013b18e59880541ae", "0xd23475cf57127790c97e39187b822dcff8f2746b545686570c611dbd95746be9", "0x5b2c3d7800af447e7cbc229fcfdf4bfd17eda56c98f29e340490723cf95b82d1"])) // Related hashes from Off-chain
                .to.be.equal(true); 

            // Assuming wrong Node should revert. (Uncomment to check)
            // await sma.connect(signer1).verify(
            //     0, // MerkleRoot maping Id
            //     2, // Index of Node in the list off-chain
            //     "0x8a3552d60a98e0ade765adddad0a2e420ca9b1eef5f326ba7ab860bb4ea72c95", // Node at that index. (Changed the last number)
            //     ["0x1ebaa930b8e9130423c183bf38b0564b0103180b7dad301013b18e59880541ae", "0xd23475cf57127790c97e39187b822dcff8f2746b545686570c611dbd95746be9", "0x5b2c3d7800af447e7cbc229fcfdf4bfd17eda56c98f29e340490723cf95b82d1"]); // Related hashes from Off-chain
        });
    });
    
    describe("SuperMerkleDistributor", function () {
        it('should check validity of fungile distribution claim', async function () {
            // console.log(ethers.utils.solidityKeccak256(["uint256", "address", "uint256"], [0, deployer.address, ethers.utils.parseEther("10")]));
            // console.log(ethers.utils.solidityKeccak256(["uint256", "address", "uint256"], [1, owner.address, ethers.utils.parseEther("20")]));
            // console.log(ethers.utils.solidityKeccak256(["uint256", "address", "uint256"], [2, paymentReceiver.address, ethers.utils.parseEther("30")]));
            // console.log(ethers.utils.solidityKeccak256(["uint256", "address", "uint256"], [3, signer1.address, ethers.utils.parseEther("40")]));
            // console.log(ethers.utils.solidityKeccak256(["uint256", "address", "uint256"], [4, signer2.address, ethers.utils.parseEther("50")]));
            // console.log(ethers.utils.solidityKeccak256(["uint256", "address", "uint256"], [5, signer3.address, ethers.utils.parseEther("60")]));
                        
            /* Off-chain list of addresses and hashes
            Index   Address                                     Amount
            0       0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266  10      hash =  0x5918074afc15e9bab16521dabc53246600c388c85525f9e75506243451825406  hash = 0x480d00bdcaea899bbd9ba838debe68d15bcb80307fc0fb2f4d88b2052f6ee7e8  hash =  0x1a6a5182d27d87650d5234b9b2b228ef72f0a827df03350504971e8a415f9323  Roothash = 0xdd031be2b72c829a7244d171a84cc5a863ac690dc9dfc47152e3cf0e6af348b3 
            1       0x70997970C51812dc3A010C7d01b50e0d17dc79C8  20      hash =  0xa5e50f91592e918fc37296931af94b89ace9e46d99b9ef57b7be4bda8f9aab56  

            2       0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC  30      hash =  0xe8e2b107edd219e60c651619c8c384aa8f4a5695aa0228e3ff1ef598bf33e718  hash = 0x69a6f6cb77ea5e6e96695aa450b9dba6edee38f332724b0715cb1e6eee6e582a
            3       0x90F79bf6EB2c4f870365E785982E1f101E93b906  40      hash =  0x6f34a36253d471e720266ce6c5ed897aea1f924a4e62740eb79421fdebd43f6e  

            4       0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65  50      hash =  0x71a8e321d3c283547aa8aa471dc984e747230cedaff02e871e0078520d77151d  hash = 0x61f95108dbae27cb81ffb01ab8c44bf96768d5b0ccccd1e5702697e740e05139  hash =  0x9f9f84a76cb36c30f7de2460f8e98cf3fe47645fab7ff47ff041136b4f5ac4ab
            5       0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc  60      hash =  0x767aac3457726e30b98de04b4e1b178266da4403a0e4a4c3dd8faaa87da3c823  
            */

            let block = await ethers.provider.getBlock()
            await super1155.connect(deployer).setPermit(
                smd.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );

            await super1155.connect(deployer).configureGroup(itemGroupId, {
                name: 'PEPSI',
                    supplyType: 0,
                    supplyData: ethers.utils.parseEther("60"),
                    itemType: 1,
                    itemData: 0,
                    burnType: 1,
                    burnData: 6
                });

            smd.connect(deployer).setDistributionRound(itemGroupId, "0xdd031be2b72c829a7244d171a84cc5a863ac690dc9dfc47152e3cf0e6af348b3", block.timestamp, block.timestamp + 60, super1155.address, 0, 0);
            let merkleRoot = await smd.connect(deployer).distributionRoots(itemGroupId);
            await expect(
                merkleRoot.merkleRoot)
                .to.be.equal("0xdd031be2b72c829a7244d171a84cc5a863ac690dc9dfc47152e3cf0e6af348b3");

            await smd.connect(paymentReceiver).redeem(
                itemGroupId, // MerkleRoot maping Id
                2, // Index of Node in the list off-chain
                paymentReceiver.address, // Address at that index
                shiftedItemGroupId,
                ethers.utils.parseEther("30"),
                ["0x6f34a36253d471e720266ce6c5ed897aea1f924a4e62740eb79421fdebd43f6e", "0x480d00bdcaea899bbd9ba838debe68d15bcb80307fc0fb2f4d88b2052f6ee7e8", "0x9f9f84a76cb36c30f7de2460f8e98cf3fe47645fab7ff47ff041136b4f5ac4ab"]); // Related hashes from Off-chain 

            await expect(await super1155.balanceOf(paymentReceiver.address, shiftedItemGroupId.add(1)))
            .to.be.equal(ethers.utils.parseEther("30"));

        });
    });
});