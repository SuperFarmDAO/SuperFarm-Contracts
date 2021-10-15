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
describe('===SuperMerkleAccess===', function () {
    let deployer, owner, paymentReceiver, signer1, signer2, signer3;

    // These are all addresses of variables above ^
    /* Off-chain list of addresses and hashes
    0   0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266  hash =  0xe9707d0e6171f728f7473c24cc0432a9b07eaaf1efed6a137a4a8c12c79552d9  hash = 0xd23475cf57127790c97e39187b822dcff8f2746b545686570c611dbd95746be9  hash =  0xcbd7db216427a61297ec0d7f576a864376cbd4f9fcf02d3c789a7447ec08903c  Roothash = 0x7a07e10e49b7f7330d828cc83d25bfd22120da182f934c64b2e425d5ddfc8d70 
    1   0x70997970C51812dc3A010C7d01b50e0d17dc79C8  hash =  0x00314e565e0574cb412563df634608d76f5c59d9f817e85966100ec1d48005c0  

    2   0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC  hash =  0x8a3552d60a98e0ade765adddad0a2e420ca9b1eef5f326ba7ab860bb4ea72c94  hash = 0xc14b0ddb8e5ea5a2dab0fa169c7cda24f37cf5896c12a930a650d094eca2ae7f
    3   0x90F79bf6EB2c4f870365E785982E1f101E93b906  hash =  0x1ebaa930b8e9130423c183bf38b0564b0103180b7dad301013b18e59880541ae  

    4   0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65  hash =  0xf4ca8532861558e29f9858a3804245bb30f0303cc71e4192e41546237b6ce58b  hash = 0x475c5d26aa18ffb9161fadc3542fa0570c5ca4fc8a994f69219fd5157f2f7aa7  hash =  0x5b2c3d7800af447e7cbc229fcfdf4bfd17eda56c98f29e340490723cf95b82d1
    5   0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc  hash =  0xe5c951f74bc89efa166514ac99d872f6b7a3c11aff63f51246c3742dfa925c9b  
    */
    
    let sma;
    before(async function () {
        this.SuperMerkleAccess = await ethers.getContractFactory("SuperMerkleAccess");
        this.MockERC20 = await ethers.getContractFactory("MockERC20");

    });

    beforeEach(async function () {
        [deployer, owner, paymentReceiver, signer1, signer2, signer3] = await ethers.getSigners();

        sma = await this.SuperMerkleAccess.deploy();
        await sma.deployed();
    });

    // Test cases

    //////////////////////////////
    //       Constructor
    //////////////////////////////
    describe("Whitelist", function () {
        it('should check validity of caller', async function () {
            // console.log(deployer.address);
            // console.log(owner.address);
            // console.log(paymentReceiver.address);
            // console.log(signer1.address);
            // console.log(signer2.address);
            // console.log(signer3.address)

            // console.log(ethers.utils.solidityKeccak256(["address"], [deployer.address]));
            // console.log(ethers.utils.solidityKeccak256(["address"], [owner.address]));
            // console.log(ethers.utils.solidityKeccak256(["address"], [paymentReceiver.address]));
            // console.log(ethers.utils.solidityKeccak256(["address"], [signer1.address]));
            // console.log(ethers.utils.solidityKeccak256(["address"], [signer2.address]));
            // console.log(ethers.utils.solidityKeccak256(["address"], [signer3.address]));

            sma.connect(deployer).setAccessRound(0, "0x7a07e10e49b7f7330d828cc83d25bfd22120da182f934c64b2e425d5ddfc8d70", 0, 0);
            let merkleRoot = await sma.connect(deployer).merkleRoots(0);
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
});