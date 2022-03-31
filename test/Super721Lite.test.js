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
describe('===Super721Lite===', function () {

    let deployer, owner, signer1, signer2, signer3;
    let UNIVERSAL,
        SET_URI_RIGHT,
        LOCK_URI_RIGHT,
        LOCK_ITEM_URI_RIGHT,
        MINT_RIGHT,
        SET_METADATA_RIGHT,
        LOCK_CREATION_RIGHT;
    let super721Lite;
    let proxyRegistry;
    let totalSupply = 100;
    let batchSize = 98;
    const metadataUri = "://ipfs/uri/";
    const contractUri = "://ipfs/uri/";

    before(async function () {
        this.Super721Lite = await ethers.getContractFactory("Super721Lite");
        this.ProxyRegistry = await ethers.getContractFactory("MockProxyRegistry");
    })

    beforeEach(async function () {
        [deployer, owner, signer1, signer2, signer3] = await ethers.getSigners();
        
        proxyRegistry = await this.ProxyRegistry.deploy();
        await proxyRegistry.deployed();

        super721Lite = await this.Super721Lite.deploy(
            owner.address, 
            "Super721Lite",
            "S721L",
            totalSupply, 
            batchSize,
            metadataUri, 
            contractUri,
            proxyRegistry.address
        );

        UNIVERSAL = await super721Lite.UNIVERSAL();
        SET_URI_RIGHT = await super721Lite.SET_URI();
        LOCK_URI_RIGHT = await super721Lite.LOCK_URI();
        LOCK_ITEM_URI_RIGHT = await super721Lite.LOCK_ITEM_URI();
        MINT_RIGHT = await super721Lite.MINT();
        SET_METADATA_RIGHT = await super721Lite.SET_METADATA();
        LOCK_CREATION_RIGHT = await super721Lite.LOCK_CREATION();
        
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
            expect(await super721Lite.owner()).to.equal(owner.address);
            expect(await super721Lite.name()).to.equal("Super721Lite");
            expect(await super721Lite.symbol()).to.equal("S721L");
            expect(await super721Lite.metadataUri()).to.equal(metadataUri);
            expect(await super721Lite.contractURI()).to.equal(contractUri);
            expect(await super721Lite.totalSupply()).to.equal(totalSupply);
            expect(await super721Lite.batchSize()).to.equal(batchSize);
            expect(await super721Lite.proxyRegistryAddress()).to.equal(proxyRegistry.address);
            expect(await super721Lite.version()).to.equal(1);
        });
    });

    describe("setURI", function () {
        it('reverts when there is not a valid permit for sender', async function () {
            await expect(
                super721Lite.setURI("://ipfs/newuri/{id}")
            ).to.be.revertedWith('P1');
            expect(await super721Lite.metadataUri()).to.equal(metadataUri);
        });

        it('reverts when the collection has been locked', async function () {
            await super721Lite.connect(owner).lockURI();

            await expect(
                super721Lite.connect(owner).setURI("://ipfs/newuri/")
            ).to.be.revertedWith('CollectionURILocked');

            expect(await super721Lite.metadataUri()).to.equal(metadataUri);
        });

        it('sets the metadataUri when there is a valid permit', async function () {
            await super721Lite.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                SET_URI_RIGHT,
                ethers.constants.MaxUint256
            );
            await super721Lite.setURI("://ipfs/newuri/");
            expect(await super721Lite.metadataUri()).to.equal("://ipfs/newuri/");
            expect(await super721Lite.uriLocked()).to.equal(false);
        });
    });

    describe("lockURI", function () {
        it('reverts when there is not a valid permit for sender', async function () {
            await expect(
                super721Lite.lockURI()
            ).to.be.revertedWith('P1');
            expect(await super721Lite.metadataUri()).to.equal(metadataUri);
        });

        it('sets the metadataUri and locks it when there is a valid permit', async function () {
            await super721Lite.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                LOCK_URI_RIGHT,
                ethers.constants.MaxUint256
            );
            await super721Lite.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                SET_URI_RIGHT,
                ethers.constants.MaxUint256
            );
            await super721Lite.connect(deployer).setURI("://ipfs/lockeduri/{id}");
            await super721Lite.connect(deployer).lockURI();
            expect(await super721Lite.metadataUri()).to.equal("://ipfs/lockeduri/{id}");
            expect(await super721Lite.uriLocked()).to.equal(true);
        });
    });

    describe('setContractURI', function () {
        it('reverts if contract already locked', async function () {
            await super721Lite.connect(owner).lockContractUri();
            await expect(
                super721Lite.connect(owner).setContractURI(
                    "uri"
                )
            ).to.be.revertedWith('ContractURILocked')
        });

        it('set new Uri', async function () {
            await super721Lite.connect(owner).setContractURI("newUri")

            expect(await super721Lite.contractURI()).to.equal("newUri");
        });
    });

    describe('setMetadata', function () {
       
        beforeEach(async () => {
            let quantity = 2;
            let quantity2 = 3;
            await super721Lite.connect(owner).mintBatch(
                signer1.address,
                quantity,
                ethers.utils.id('a')
            );
            
            await super721Lite.connect(owner).mintBatch(
                signer2.address,
                quantity2,
                ethers.utils.id('a')
            );

            expect(await super721Lite.balanceOf(signer1.address))
                .to.be.equal(2);

            let balances = await super721Lite.balanceOfBatch(
                [signer1.address, signer2.address]
            )
            expect(balances[0]).to.be.equal(2)
            expect(balances[1]).to.be.equal(3)
        })

        it('revert if sender has no rigth', async function () {
            await expect(super721Lite.connect(signer2).setMetadata(
                1,
                'mettaDatum'
            )).to.be.revertedWith(
                "Super721: caller has no right for that action"
            );
        });

        it('revert if uri is locked', async function() {
            await super721Lite.connect(owner).lockItemURI("", 1);   // CHECK uri shit
            expect(await super721Lite.metadataFrozen(1))
                .to.be.equal(true);
            await expect(super721Lite.connect(owner).setMetadata(
                1,
                'mettaDatum'
            )).to.be.revertedWith(
                "MetadataIsFrozen"
            );
        });

        it('revert if uri is locked or metadata is frozen', async function() {
            await super721Lite.connect(owner).lockURI();
            expect(await super721Lite.uriLocked()).to.be.equal(true);

            await expect(super721Lite.connect(owner).setMetadata(
                1,
                'mettaDatum'
            )).to.be.revertedWith(
                "MetadataIsFrozen"
            );
        });

        it('new metadata for id is setted', async function() {
            await super721Lite.connect(owner).setMetadata(
                1,
                'mettaDatum'
            );

            expect (await super721Lite.metadata(1))
                .to.be.equal('mettaDatum');

            let tokenURI = await super721Lite.tokenURI(1);
            console.log("token uri is", tokenURI);
        })
    });

    describe("tokenOfOwnerByIndex", function () {
        beforeEach(async () => {
            let quantity = 2;
            await super721Lite.connect(owner).mintBatch(
                signer1.address,
                quantity,
                ethers.utils.id('a')
            );
            
            expect(await super721Lite.balanceOf(signer1.address))
                .to.be.equal(2);

            await expect(super721Lite.balanceOf(
                ethers.constants.AddressZero
            )).to.be.revertedWith('BalanceQueryForZeroAddress');

            expect(await super721Lite.ownerOf(1))
                .to.be.equal(signer1.address);
            await expect(super721Lite.ownerOf(2))
                .to.be.revertedWith('OwnerQueryForNonExistentToken');
        });

        it('reverts if owner is zero address', async function() {
            await expect(super721Lite.tokenOfOwnerByIndex(
                ethers.constants.AddressZero,
                1
            )).to.be.revertedWith('InvalidOwnerAddress');
        });

        it('reverts if index is out of bounds', async function() {
            await expect(super721Lite.tokenOfOwnerByIndex(
                signer1.address,
                228
            )).to.be.revertedWith('OwnerIndexOutOfBounds')
        });

        it('should return tokenOfOwnerByIndex', async function() {
            let value = await super721Lite.tokenOfOwnerByIndex(
                signer1.address,
                1
            );
            console.log(value);
        });

        it('revert if index bigger than totalSupply', async function () {
            await expect(super721Lite.tokenByIndex(totalSupply))
                .to.be.revertedWith('IndexOutOfBounds')
        })

        it('some index', async function() {
            expect(await super721Lite.tokenByIndex(totalSupply-1))
                .to.be.equal(totalSupply-1);
        })
    });

    describe("approve", function () {
        beforeEach(async () => {
            let quantity = 2;
            await super721Lite.connect(owner).mintBatch(
                signer1.address,
                quantity,
                ethers.utils.id('a')
            );
            
            await super721Lite.connect(owner).mintBatch(
                signer2.address,
                quantity,
                ethers.utils.id('a')
            );
            
            expect(await super721Lite.balanceOf(signer1.address))
                .to.be.equal(2);
        });

        it('reverts if to is equal to owner', async function() {
            await expect(super721Lite.connect(signer1).approve(
                signer1.address,
                1
            )).to.be.revertedWith('ApproveToCurrrentOwner')
        })

        it('revert if sender is not owner or approved for all', async function() {
            await expect(super721Lite.connect(signer2).approve(
                signer2.address,
                1
            )).to.be.revertedWith('ApproveCallerIsNotOwnerOrApproved')
        })

        it('should approve token', async function () {
            await super721Lite.connect(signer1).approve(
                signer2.address,
                1
            );

            expect(await super721Lite.tokenApprovals(1))
                .to.be.equal(signer2.address)
            expect(await super721Lite.getApproved(1))
                .to.be.equal(signer2.address)
            
        })

        it('revert if token not exist', async function () {
            await expect( super721Lite.getApproved(7)).to.be.revertedWith(
                'GetApprovedQueryNonExictentToken'
            );
        })
    });

    describe("supportsInterface", function (){
        it('should return right value', async () => {
            expect(await super721Lite.supportsInterface("0x80ac58cd"))
                .to.equal(true);
            expect(await super721Lite.supportsInterface("0x5b5e139f"))
                .to.equal(true);
            expect(await super721Lite.supportsInterface("0x780e9d63"))
                .to.equal(true);
            expect(await super721Lite.supportsInterface("0x228c58cd"))
                .to.equal(false);
        })
    })

    describe("lock", function () {
        it('Reverts: permit is not valid unless owner is sender', async () => {
            await expect(
                super721Lite.lock()
            ).to.be.revertedWith("P1");

            expect(await super721Lite.locked()).to.equal(false);
            await super721Lite.connect(owner).lock();
            expect(await super721Lite.locked()).to.equal(true);
        });

        it('sets locked to true when the permit is valid', async () => {
            let currentBlockNumber = await ethers.provider.getBlockNumber();
            let block = await ethers.provider.getBlock(currentBlockNumber);
            let expiration = block.timestamp + 10000;

            await super721Lite.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                LOCK_CREATION_RIGHT,
                expiration
            );

            expect(await super721Lite.locked()).to.equal(false);
            await super721Lite.lock();
            expect(await super721Lite.locked()).to.equal(true);
        });
    });

    describe("isApprovedForAll", function () {
        it('Reverts: setting approval status for self', async () => {
            await expect(
                super721Lite.setApprovalForAll(deployer.address, true)
            ).to.be.revertedWith('SetApprovalForSelf');
        });

        it('uses operatorApprovals except when the operator is registered in the proxyRegistry', async () => {
            expect(await super721Lite.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
            await super721Lite.setApprovalForAll(signer1.address, true);
            expect(await super721Lite.isApprovedForAll(deployer.address, signer1.address)).to.equal(true);
            await super721Lite.setApprovalForAll(signer1.address, false);
            expect(await super721Lite.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
        });

        it('returns true when proxyRegistry.proxies(_owner) == operator', async () => {
            expect(await super721Lite.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
            expect(await proxyRegistry.proxies(deployer.address)).to.equal(ethers.constants.AddressZero);
            await proxyRegistry.connect(deployer).setProxy(deployer.address, signer1.address);
            expect(await proxyRegistry.proxies(deployer.address)).to.equal(signer1.address);
            expect(await super721Lite.isApprovedForAll(deployer.address, signer1.address)).to.equal(true);
            await proxyRegistry.connect(deployer).setProxy(deployer.address, ethers.constants.AddressZero);
            expect(await proxyRegistry.proxies(deployer.address)).to.equal(ethers.constants.AddressZero);
            expect(await super721Lite.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
        });
    });

    describe("safeBatchTransferFrom", function () {
        let quantity = batchSize / 2;
        
        it('Reverts: if address is zero', async () => {
            await expect( super721Lite.connect(owner).mintBatch(
                ethers.constants.AddressZero,
                quantity,
                ethers.utils.id('a')
            )).to.be.revertedWith('MintToZeroAddress')
        });

        it('Reverts: if quantity is bigger than batch size', async () => {
            let quantity = batchSize + 1;
        
            await expect( super721Lite.connect(owner).mintBatch(
                signer1.address,
                quantity,
                ethers.utils.id('a')
            )).to.be.revertedWith('MintQuantityTooHigh')
        });

        it('Reverts: if address is mint index and quantity bigger than totalSupply', async () => {
            let quantity = batchSize - 2;
            
            await super721Lite.connect(owner).mintBatch(
                signer1.address,
                quantity,
                ethers.utils.id('a')
            );

            expect(await super721Lite.balanceOf(signer1.address))
                .to.be.equal(quantity);
            
            await expect( super721Lite.connect(owner).mintBatch(
                signer1.address,
                quantity,
                ethers.utils.id('a')
            )).to.be.revertedWith('MintCapReached')
        });
        
        it('Reverts: transfer to the 0 address', async () => {
            await expect(
                super721Lite.safeBatchTransferFrom(
                    signer1.address, 
                    ethers.constants.AddressZero, 
                    [1], 
                    ethers.utils.id('a'
            ))).to.be.revertedWith('TransferToZeroAddress');
        });


        it('Reverts: caller is not owner nor approved', async () => {
            let quantity = 2;
            await super721Lite.connect(owner).mintBatch(
                signer1.address,
                quantity,
                ethers.utils.id('a')
            );
            // not owner or approved
            await expect(
                super721Lite.connect(signer3).safeBatchTransferFrom(
                    signer1.address, 
                    super721Lite.address, 
                    [1], 
                    ethers.utils.id('a'
                )
            )).to.be.revertedWith('TransferCallerNotApproved');
        });

        it('reverts: transfer from incorrectOwner', async () => {
            let quantity = 2;
            await super721Lite.connect(owner).mintBatch(
                signer1.address,
                quantity,
                ethers.utils.id('a')
            );
            
            await super721Lite.connect(owner).mintBatch(
                signer2.address,
                quantity,
                ethers.utils.id('a')
            );

            await super721Lite.connect(signer1).approve(signer2.address, 0);
            await super721Lite.connect(signer1).approve(signer2.address, 1);

            await expect( 
                super721Lite.connect(signer1).safeBatchTransferFrom(
                    signer2.address,
                    signer1.address,
                    [0,1],
                    ethers.utils.id('a')
                )
            ).to.be.revertedWith('TransferFromIncorrectOwner');
        })

        it('reverts: non existent token id', async () => {
            let quantity = 2;
            await super721Lite.connect(owner).mintBatch(
                signer1.address,
                quantity,
                ethers.utils.id('a')
            );
            
            await super721Lite.connect(owner).mintBatch(
                signer2.address,
                quantity,
                ethers.utils.id('a')
            );

            await super721Lite.connect(signer1).approve(signer2.address, 0);
            // await super721Lite.connect(signer1).approve(signer2.address, 1);
    
            await expect( 
                super721Lite.connect(signer1).safeBatchTransferFrom(
                    signer1.address,
                    signer1.address,
                    [4,5],
                    ethers.utils.id('a')
                )
            ).to.be.revertedWith('NonExistentTokenID');
        })

        it('transfers in batches, safely', async () => {
            let quantity = 2;
            await super721Lite.connect(owner).mintBatch(
                signer1.address,
                quantity,
                ethers.utils.id('a')
            );
            
            await super721Lite.connect(owner).mintBatch(
                signer2.address,
                quantity,
                ethers.utils.id('a')
            );

            await super721Lite.connect(signer1).approve(signer2.address, 0);
            await super721Lite.connect(signer1).approve(signer2.address, 1);

            await super721Lite.connect(signer1).safeBatchTransferFrom(
                signer1.address,
                signer2.address,
                [0,1],
                ethers.utils.id('a')
            )
            expect(await super721Lite.balanceOf(signer2.address))
                .to.be.equal(4);
            expect(await super721Lite.balanceOf(signer1.address))
                .to.be.equal(0);
        });

        it('calling transferFrom', async ()=>{
            let quantity = 2;
            await super721Lite.connect(owner).mintBatch(
                signer1.address,
                quantity,
                ethers.utils.id('a')
            );
            
            await super721Lite.connect(owner).mintBatch(
                signer2.address,
                quantity,
                ethers.utils.id('a')
            );

            await super721Lite.connect(signer1).approve(signer2.address, 0);
            await super721Lite.connect(signer1).approve(signer2.address, 1);

            await super721Lite.connect(signer1).transferFrom(
                signer1.address,
                signer2.address,
                0
            );
            expect(await super721Lite.balanceOf(signer2.address))
                .to.be.equal(3);
            expect(await super721Lite.balanceOf(signer1.address))
                .to.be.equal(1);
        });

        it('calling safeTransferFrom', async ()=>{
            let quantity = 2;
            await super721Lite.connect(owner).mintBatch(
                signer1.address,
                quantity,
                ethers.utils.id('a')
            );
            
            await super721Lite.connect(owner).mintBatch(
                signer2.address,
                quantity,
                ethers.utils.id('a')
            );

            await super721Lite.connect(signer1).approve(signer2.address, 0);
            await super721Lite.connect(signer1).approve(signer2.address, 1);

            await super721Lite.connect(signer1)["safeTransferFrom(address,address,uint256,bytes)"](
                signer1.address,
                signer2.address,
                0, 
                ethers.utils.id('a')
            );
            expect(await super721Lite.balanceOf(signer2.address))
                .to.be.equal(3);
            expect(await super721Lite.balanceOf(signer1.address))
                .to.be.equal(1);
        });

        it('calling safeTransferFrom', async ()=>{
            let quantity = 2;
            await super721Lite.connect(owner).mintBatch(
                signer1.address,
                quantity,
                ethers.utils.id('a')
            );
            
            await super721Lite.connect(owner).mintBatch(
                signer2.address,
                quantity,
                ethers.utils.id('a')
            );

            await super721Lite.connect(signer1).approve(signer2.address, 0);
            await super721Lite.connect(signer1).approve(signer2.address, 1);

            await super721Lite.connect(signer1)["safeTransferFrom(address,address,uint256)"](
                signer1.address,
                signer2.address,
                0
            )
            expect(await super721Lite.balanceOf(signer2.address))
                .to.be.equal(3);
            expect(await super721Lite.balanceOf(signer1.address))
                .to.be.equal(1);
        });
    });
        
    describe('setProxyRegistry', function () {
        it('should set another proxy registry', async () => {
            await super721Lite.connect(owner).setProxyRegistry(deployer.address);
            expect(await super721Lite.proxyRegistryAddress())
                .to.be.equal(deployer.address);
        })
    })
})