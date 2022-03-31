const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { ethers } = require('hardhat');
const Web3 = require('web3');


let snapshotId;
let currentTime;

///////////////////////////////////////////////////////////
// SEE https://hardhat.org/tutorial/testing-contracts.html
// FOR HELP WRITING TESTS
// USE https://github.com/gnosis/mock-contract FOR HELP
// WITH MOCK CONTRACT
///////////////////////////////////////////////////////////

// Start test block
describe('===Super1155Lite===', function () {

    let deployer, owner, signer1, signer2, signer3;
    let UNIVERSAL,
        SET_URI_RIGHT,
        LOCK_URI_RIGHT,
        LOCK_ITEM_URI_RIGHT,
        MINT_RIGHT,
        SET_METADATA_RIGHT,
        LOCK_CREATION_RIGHT;
    let super1155Lite;
    let proxyRegistry;
    let totalSupply = 100;
    let batchSize = 98;
    const metadataUri = "://ipfs/uri/";
    const contractUri = "://ipfs/uri/";

    before(async function () {
        this.Super1155Lite = await ethers.getContractFactory("Super1155Lite");
        this.ProxyRegistry = await ethers.getContractFactory("MockProxyRegistry");
    })

    beforeEach(async function () {
        [deployer, owner, signer1, signer2, signer3] = await ethers.getSigners();
        
        proxyRegistry = await this.ProxyRegistry.deploy();
        await proxyRegistry.deployed();

        super1155Lite = await this.Super1155Lite.deploy(
            owner.address, 
            "Super1155Lite",
            metadataUri, 
            contractUri,
            proxyRegistry.address
        );

        UNIVERSAL = await super1155Lite.UNIVERSAL();
        SET_URI_RIGHT = await super1155Lite.SET_URI();
        LOCK_URI_RIGHT = await super1155Lite.LOCK_URI();
        LOCK_ITEM_URI_RIGHT = await super1155Lite.LOCK_ITEM_URI();
        MINT_RIGHT = await super1155Lite.MINT();
        SET_METADATA_RIGHT = await super1155Lite.SET_METADATA();
        LOCK_CREATION_RIGHT = await super1155Lite.LOCK_CREATION();
        
    })

    beforeEach(async function () {
        currentTime = await (await ethers.provider.getBlock()).timestamp;
		snapshotId = await network.provider.send("evm_snapshot");
    })

    afterEach( async function () {
		await network.provider.send("evm_revert", [snapshotId]);
    })

    ////////////////////////////
    // TEST CASES
    ////////////////////////////
    describe("Constructor", function () {
        it('initialized values as expected', async function () {
            expect(await super1155Lite.owner()).to.equal(owner.address);
            expect(await super1155Lite.name()).to.equal("Super1155Lite");
            expect(await super1155Lite.uri(0)).to.equal(metadataUri);
            expect(await super1155Lite.contractURI()).to.equal(contractUri);
            expect(await super1155Lite.proxyRegistryAddress()).to.equal(proxyRegistry.address);
            expect(await super1155Lite.version()).to.equal(1);
        });
    });

    describe("setURI", function () {
        it('reverts when there is not a valid permit for sender', async function () {
            await expect(
                super1155Lite.setURI("://ipfs/newuri/{id}")
            ).to.be.revertedWith('P1');
            expect(await super1155Lite.metadataUri()).to.equal(metadataUri);
        });

        it('reverts when the collection has been locked', async function () {
            await super1155Lite.connect(owner).lockURI();

            await expect(
                super1155Lite.connect(owner).setURI("://ipfs/newuri/")
            ).to.be.revertedWith('CollectionURIHasBeenLocked');

            expect(await super1155Lite.metadataUri()).to.equal(metadataUri);
        });

        it('sets the metadataUri when there is a valid permit', async function () {
            await super1155Lite.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                SET_URI_RIGHT,
                ethers.constants.MaxUint256
            );
            await super1155Lite.setURI("://ipfs/newuri/");
            expect(await super1155Lite.metadataUri()).to.equal("://ipfs/newuri/");
            expect(await super1155Lite.uriLocked()).to.equal(false);
        });
    });

    describe("lockURI", function () {
        it('reverts when there is not a valid permit for sender', async function () {
            await expect(
                super1155Lite.lockURI()
            ).to.be.revertedWith('P1');
            expect(await super1155Lite.metadataUri()).to.equal(metadataUri);
        });

        it('sets the metadataUri and locks it when there is a valid permit', async function () {
            await super1155Lite.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                LOCK_URI_RIGHT,
                ethers.constants.MaxUint256
            );
            await super1155Lite.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                SET_URI_RIGHT,
                ethers.constants.MaxUint256
            );
            await super1155Lite.connect(deployer).setURI("://ipfs/lockeduri/{id}");
            await super1155Lite.connect(deployer).lockURI();
            expect(await super1155Lite.metadataUri()).to.equal("://ipfs/lockeduri/{id}");
            expect(await super1155Lite.uriLocked()).to.equal(true);
        });
    });

    describe('setContractUri', function () {
        it('reverts if contract already locked', async function () {
            await super1155Lite.connect(owner).lockContractUri();
            await expect(
                super1155Lite.connect(owner).setContractUri(
                    "uri"
                )
            ).to.be.revertedWith('ContractURIHasBeenLocked')
        });

        it('set new Uri', async function () {
            await super1155Lite.connect(owner).setContractUri("newUri")

            expect(await super1155Lite.contractURI()).to.equal("newUri");
        });
    });

    describe('setMetadata', function () {
       
        beforeEach(async () => {
            let amounts = [2,2];
            let ids = [0,1];
        
            await super1155Lite.connect(owner).mintBatch(
                signer1.address,
                ids,
                amounts,
                ethers.utils.id('a')
            );
            
            await super1155Lite.connect(owner).mintBatch(
                signer2.address,
                ids,
                amounts,
                ethers.utils.id('a')
            );

            expect(await super1155Lite.balanceOf(signer1.address, ids[0]))
                .to.be.equal(amounts[0]);
            expect(await super1155Lite.balanceOf(signer2.address, ids[0]))
                .to.be.equal(amounts[0]);
        });     

        it('check work of balanceOfBatch function', async function() {
            // test balanceOfBatch
            await expect(super1155Lite.balanceOfBatch(
                [signer1.address, signer2.address],
                [0]
            )).to.be.revertedWith('AccountsAndIdsLengthMismatched');
            
            await expect(super1155Lite.balanceOf(
                ethers.constants.AddressZero,
                [0]
            )).to.be.revertedWith('BalanceQueryForZeroAddress');


            let balances = await super1155Lite.balanceOfBatch(
                [signer1.address, signer2.address],
                [0, 0]
            );

            console.log(balances);
            expect(balances[0]).to.be.equal("2")
            expect(balances[1]).to.be.equal("2")
        })


        it('revert if sender has no rigth', async function () {
            await expect(super1155Lite.connect(signer2).setMetadata(
                1,
                'mettaDatum'
            )).to.be.revertedWith(
                "DoNotHaveRigthToSetMetadata"
            );
        });

        it('revert if signer has not rights to lock item URI', async function () {
            await expect( super1155Lite.connect(signer1).lockItemURI("", 1))
                .to.be.revertedWith('DoNotHaveRigthToLockURI');   // CHECK uri shit
            
        });

        it('revert if uri is locked', async function() {
            await super1155Lite.connect(owner).lockItemURI("", 1);   // CHECK uri shit
            expect(await super1155Lite.metadataFrozen(1))
                .to.be.equal(true);
            await expect(super1155Lite.connect(owner).setMetadata(
                1,
                'mettaDatum'
            )).to.be.revertedWith(
                "CanNotEditMetadateThatFrozen"
            );
        });

        it('revert if uri is locked or metadata is frozen', async function() {
            await super1155Lite.connect(owner).lockURI();
            expect(await super1155Lite.uriLocked()).to.be.equal(true);

            await expect(super1155Lite.connect(owner).setMetadata(
                1,
                'mettaDatum'
            )).to.be.revertedWith(
                "CanNotEditMetadateThatFrozen"
            );
        });

        it('new metadata for id is setted', async function() {
            await super1155Lite.connect(owner).setMetadata(
                1,
                'mettaDatum'
            );

            expect (await super1155Lite.metadata(1))
                .to.be.equal('mettaDatum');
        })
    });

    describe("approve", function () {
        beforeEach(async () => {
            let amounts = [2,2];
            let ids = [0,1];
        
            await super1155Lite.connect(owner).mintBatch(
                signer1.address,
                ids,
                amounts,
                ethers.utils.id('a')
            );
            
            await super1155Lite.connect(owner).mintBatch(
                signer2.address,
                ids,
                amounts,
                ethers.utils.id('a')
            );

            expect(await super1155Lite.balanceOf(signer1.address, ids[0]))
                .to.be.equal(amounts[0]);
            expect(await super1155Lite.balanceOf(signer2.address, ids[0]))
                .to.be.equal(amounts[0]);
        });

        it('reverts if setting approval for self', async function() {
            await expect(super1155Lite.connect(signer1).setApprovalForAll(
                signer1.address,
                true
            )).to.be.revertedWith('SettingApprovalStatusForSelf')
        })

        it('should approve token', async function () {
            await super1155Lite.connect(signer1).setApprovalForAll(
                signer2.address,
                true
            );

            expect(await super1155Lite.isApprovedForAll(
                signer1.address, 
                signer2.address
            )).to.be.equal(true);            
        })
    });


    describe("supportsInterface", function (){
        it('should return right value', async () => {
            expect(await super1155Lite.supportsInterface("0xd9b67a26"))
                .to.equal(true);
            expect(await super1155Lite.supportsInterface("0x0e89341c"))
                .to.equal(true);
            expect(await super1155Lite.supportsInterface("0x228c58cd"))
                .to.equal(false);
        })
    })

    describe("lock", function () {
        it('Reverts: permit is not valid unless owner is sender', async () => {
            await expect(
                super1155Lite.lock()
            ).to.be.revertedWith("P1");

            expect(await super1155Lite.locked()).to.equal(false);
            await super1155Lite.connect(owner).lock();
            expect(await super1155Lite.locked()).to.equal(true);
        });

        it('sets locked to true when the permit is valid', async () => {
            let currentBlockNumber = await ethers.provider.getBlockNumber();
            let block = await ethers.provider.getBlock(currentBlockNumber);
            let expiration = block.timestamp + 10000;

            await super1155Lite.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                LOCK_CREATION_RIGHT,
                expiration
            );

            expect(await super1155Lite.locked()).to.equal(false);
            await super1155Lite.lock();
            expect(await super1155Lite.locked()).to.equal(true);
        });
    });

    describe("isApprovedForAll", function () {
        it('Reverts: setting approval status for self', async () => {
            await expect(
                super1155Lite.setApprovalForAll(deployer.address, true)
            ).to.be.revertedWith('SettingApprovalStatusForSelf');
        });

        it('uses operatorApprovals except when the operator is registered in the proxyRegistry', async () => {
            expect(await super1155Lite.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
            await super1155Lite.setApprovalForAll(signer1.address, true);
            expect(await super1155Lite.isApprovedForAll(deployer.address, signer1.address)).to.equal(true);
            await super1155Lite.setApprovalForAll(signer1.address, false);
            expect(await super1155Lite.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
        });

        it('returns true when proxyRegistry.proxies(_owner) == operator', async () => {
            expect(await super1155Lite.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
            expect(await proxyRegistry.proxies(deployer.address)).to.equal(ethers.constants.AddressZero);
            await proxyRegistry.connect(deployer).setProxy(deployer.address, signer1.address);
            expect(await proxyRegistry.proxies(deployer.address)).to.equal(signer1.address);
            expect(await super1155Lite.isApprovedForAll(deployer.address, signer1.address)).to.equal(true);
            await proxyRegistry.connect(deployer).setProxy(deployer.address, ethers.constants.AddressZero);
            expect(await proxyRegistry.proxies(deployer.address)).to.equal(ethers.constants.AddressZero);
            expect(await super1155Lite.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
        });
    });

    describe("safeBatchTransferFrom", function () {
        it('Reverts: if address is zero', async () => {
            let amounts = [2,2];
            let ids = [0,1];
            await expect( super1155Lite.connect(owner).mintBatch(
                ethers.constants.AddressZero,
                ids,
                amounts,
                ethers.utils.id('a')
            )).to.be.revertedWith('MintToZeroAddress')
        });

        it('Reverts: if user has not right to mint', async () => {
            let amounts = [2,2];
            let ids = [0,1];
            await expect( super1155Lite.connect(signer1).mintBatch(
                signer1.address,
                ids,
                amounts,
                ethers.utils.id('a')
            )).to.be.revertedWith('DoNotHaveRigthToMintThatItem')
        });

        it('Reverts: if ids and amounts length mismatch', async () => {
            let amounts = [2,2,4];
            let ids = [0,1];
            
            await expect( super1155Lite.connect(owner).mintBatch(
                signer1.address,
                ids,
                amounts,
                ethers.utils.id('a')
            )).to.be.revertedWith('MintIdsAndAmountsLengthsMismatch')
        });

        
        it('Reverts: transfer to the 0 address', async () => {
            await expect(
                super1155Lite.safeBatchTransferFrom(
                    signer1.address,
                    ethers.constants.AddressZero,
                    [1],
                    [1],
                    ethers.utils.id('a'))
            ).to.be.revertedWith('TransferToZeroAddress');
        });


        it('Reverts: caller is not owner nor approved', async () => {
            await expect(
                super1155Lite.connect(signer3).safeBatchTransferFrom(
                    signer1.address,
                    super1155Lite.address,
                    [1],
                    [1],
                    ethers.utils.id('a'))
            ).to.be.revertedWith('CallerIsNotOwnerOrApproved');
        });

        it('Reverts: ids and amounts lenghts mismatch', async () => {
            await expect(
                super1155Lite.connect(signer3).safeBatchTransferFrom(
                    signer1.address,
                    super1155Lite.address,
                    [1],
                    [1],
                    ethers.utils.id('a'))
            ).to.be.revertedWith('CallerIsNotOwnerOrApproved');
        });

        it('Reverts: insuffficient balance for transfer', async () => {
            let amounts = [2,2];
            let ids = [0,1];
        
            await super1155Lite.connect(owner).mintBatch(
                signer1.address,
                ids,
                amounts,
                ethers.utils.id('a')
            );

            await super1155Lite.connect(signer1).setApprovalForAll(
                signer2.address,
                true);

            await expect( 
                super1155Lite.connect(signer1).safeBatchTransferFrom(
                    signer1.address,
                    signer1.address,
                    [0,1],
                    [3,2],
                    ethers.utils.id('a')
                )
            ).to.be.revertedWith('InsufficientBalanceForTransfer');
        })

        it('Reverts: ids and amounts leghts mismatch', async () => {
            let amounts = [2,2];
            let ids = [0,1];
        
            await super1155Lite.connect(owner).mintBatch(
                signer1.address,
                ids,
                amounts,
                ethers.utils.id('a')
            );

            await super1155Lite.connect(signer1).setApprovalForAll(
                signer2.address,
                true);

            await expect( 
                super1155Lite.connect(signer1).safeBatchTransferFrom(
                    signer1.address,
                    signer1.address,
                    [0],
                    [3,2],
                    ethers.utils.id('a')
                )
            ).to.be.revertedWith('IdsAndAmountsLengthsMismatch');
        })

        it('transfers in batches, safely', async () => {
            let amounts = [2,2];
            let ids = [0,1];
        
            await super1155Lite.connect(owner).mintBatch(
                signer1.address,
                ids,
                amounts,
                ethers.utils.id('a')
            );
            
            await super1155Lite.connect(signer1).setApprovalForAll(
                signer2.address,
                true
            );
            
            await super1155Lite.connect(signer1).safeBatchTransferFrom(
                signer1.address,
                signer2.address,
                [0,1],
                [1,1],
                ethers.utils.id('a')
            )
            expect(await super1155Lite.balanceOf(signer2.address, 0))
                .to.be.equal(1);
            expect(await super1155Lite.balanceOf(signer1.address, 1))
                .to.be.equal(1);
        });

        it('calling safeTransferFrom', async ()=>{
            let amounts = [2,2];
            let ids = [0,1];
        
            await super1155Lite.connect(owner).mintBatch(
                signer1.address,
                ids,
                amounts,
                ethers.utils.id('a')
            );
            
            await super1155Lite.connect(signer1).setApprovalForAll(
                signer2.address,
                true
            );
            
            await super1155Lite.connect(signer1).safeTransferFrom(
                signer1.address,
                signer2.address,
                0,
                1, 
                ethers.utils.id('a')
            );
            expect(await super1155Lite.balanceOf(signer2.address, 0))
                .to.be.equal(1);
            expect(await super1155Lite.balanceOf(signer1.address, 0))
                .to.be.equal(1);
        });
    });

        
    describe('setProxyRegistry', function () {
        it('should set another proxy registry', async () => {
            await super1155Lite.connect(owner).setProxyRegistry(deployer.address);
            expect(await super1155Lite.proxyRegistryAddress())
                .to.be.equal(deployer.address);
        })
    })
});