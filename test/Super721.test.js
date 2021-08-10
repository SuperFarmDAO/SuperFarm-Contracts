const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { ethers } = require('hardhat');
const Web3 = require('web3');

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const DECIMALS = 2;

const AMT = 150

///////////////////////////////////////////////////////////
// SEE https://hardhat.org/tutorial/testing-contracts.html
// FOR HELP WRITING TESTS
// USE https://github.com/gnosis/mock-contract FOR HELP
// WITH MOCK CONTRACT
///////////////////////////////////////////////////////////

// Start test block
describe('Super721', function () {
    let deployer, owner, signer1, signer2, signer3;
    let setUriRight,
        lockUriRight,
        lockItemUriRight,
        mintRight,
        setMetadataRight,
        lockCreationRight,
        setProxyRegistryRight;
    let UNIVERSAL;
    let super721;
    let erc721Receiver;
    let proxyRegistry;
    const originalUri = "://ipfs/uri/{id}";
    let itemGroupId = ethers.BigNumber.from(1);
    let shiftedItemGroupId = itemGroupId.shl(128);
    let itemGroupId2 = ethers.BigNumber.from(2);
    let shiftedItemGroupId2 = itemGroupId2.shl(128);

    before(async function () {
        this.Super721 = await ethers.getContractFactory("Super721");
        this.ProxyRegistry = await ethers.getContractFactory("MockProxyRegistry");
        this.ERC721Receiver = await ethers.getContractFactory("BadERC721Receiver");
    });

    beforeEach(async function () {
        [deployer, owner, signer1, signer2, signer3] = await ethers.getSigners();

        erc721Receiver = await this.ERC721Receiver.deploy();
        await erc721Receiver.deployed();

        proxyRegistry = await this.ProxyRegistry.deploy();
        await proxyRegistry.deployed();

        super721 = await this.Super721.deploy(
            owner.address,
            "Super721",
            "S721",
            originalUri,
            proxyRegistry.address
        );
        await super721.deployed();

        setUriRight = await super721.SET_URI();
        lockUriRight = await super721.LOCK_URI();
        lockItemUriRight = await super721.LOCK_ITEM_URI();
        mintRight = await super721.MINT();
        setProxyRegistryRight = await super721.SET_PROXY_REGISTRY();
        setMetadataRight = await super721.SET_METADATA();
        lockCreationRight = await super721.LOCK_CREATION();
        UNIVERSAL = await super721.UNIVERSAL();
    });

    // Test cases

    //////////////////////////////
    //       Constructor
    //////////////////////////////
    describe("Constructor", function () {
        it('initialized values as expected', async function () {
            expect(await super721.owner()).to.equal(owner.address);
            expect(await super721.name()).to.equal('Super721');
            expect(await super721.metadataUri()).to.equal(originalUri);
            expect(await super721.proxyRegistryAddress()).to.equal(proxyRegistry.address);
        });
    });

    describe("uri", function () {
        it('returns the metadataUri', async function () {
            expect(await super721.uri(1)).to.equal(originalUri);
        });
    });

    describe("setURI", function () {
        it('reverts when there is not a valid permit for sender', async function () {
            await expect(
                super721.setURI("://ipfs/newuri/{id}")
            ).to.be.revertedWith('PermitControl: sender does not have a valid permit');
            expect(await super721.uri(1)).to.equal(originalUri);
        });

        it('reverts when the collection has been locked', async function () {
            await super721.connect(owner).lockURI('hi');

            await expect(
                super721.connect(owner).setURI("://ipfs/newuri/{id}")
            ).to.be.revertedWith("Super721::setURI: the collection URI has been permanently locked");

            expect(await super721.uri(1)).to.equal('hi');
        });

        it('sets the metadataUri when there is a valid permit', async function () {
            await super721.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setUriRight,
                ethers.constants.MaxUint256
            );
            await super721.setURI("://ipfs/newuri/{id}");
            expect(await super721.uri(1)).to.equal("://ipfs/newuri/{id}");
            expect(await super721.uriLocked()).to.equal(false);
        });
    });

    describe("lockURI", function () {
        it('reverts when there is not a valid permit for sender', async function () {
            await expect(
                super721.lockURI("://ipfs/lockeduri/{id}")
            ).to.be.revertedWith('PermitControl: sender does not have a valid permit');
            expect(await super721.uri(1)).to.equal(originalUri);
        });

        it('sets the metadataUri and locks it when there is a valid permit', async function () {
            await super721.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                lockUriRight,
                ethers.constants.MaxUint256
            );
            await super721.lockURI("://ipfs/lockeduri/{id}");
            expect(await super721.uri(1)).to.equal("://ipfs/lockeduri/{id}");
            expect(await super721.uriLocked()).to.equal(true);
        });
    });

    describe("lockItemGroupURI", function () {
        it('reverts when there is not a valid permit for sender', async function () {
            expect(await super721.metadataFrozen(1)).to.equal(false);
            await expect(
                super721.lockItemGroupURI("://ipfs/lockeduri/{id}", 1)
            ).to.be.revertedWith('Super721::hasItemRight: _msgSender does not have the right to perform that action');
            expect(await super721.metadataFrozen(1)).to.equal(false);
        });

        it('sets the metadataUri and locks it when there is a valid permit', async function () {
            await super721.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                lockItemUriRight,
                ethers.constants.MaxUint256
            );
            expect(await super721.metadataFrozen(1)).to.equal(false);
            await super721.lockItemGroupURI("://ipfs/lockeduri/{id}", 1);
            expect(await super721.metadataFrozen(1)).to.equal(true);
            // expect(await super721.uri(1)).to.equal("://ipfs/uri/{id}");
            // expect(await super721.uriLocked()).to.equal(false);
        });
    });

    describe("setProxyRegistry", function () {
        it('Reverts: no setProxyRegistry permissions', async () => {
            await expect(
                super721.setProxyRegistry(signer1.address)
            ).to.be.revertedWith("PermitControl: sender does not have a valid permit");
        });

        it('allows setProxyRegistry when permissions', async () => {
            let currentBlockNumber = await ethers.provider.getBlockNumber();
            let block = await ethers.provider.getBlock(currentBlockNumber);
            let expiration = block.timestamp + 10000;

            await super721.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setProxyRegistryRight,
                expiration
            );
            expect(await super721.proxyRegistryAddress()).to.equal(proxyRegistry.address);
            await super721.setProxyRegistry(signer1.address);
            expect(await super721.proxyRegistryAddress()).to.equal(signer1.address);
        });
    });

    describe("balanceOfGroup", function () {
        it('Reverts: querying balance of address(0)', async () => {
            await expect(
                super721.balanceOfGroup(NULL_ADDRESS, 1)
            ).to.be.revertedWith("Super721::balanceOf: balance query for the zero address");
        });

        it('returns the balanceOfGroup other addresses', async () => {
            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(0);

            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });
            await super721.connect(owner).mintBatch(
                signer1.address,
                [shiftedItemGroupId],
                [1],
                ethers.utils.id('a')
            );

            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721.balanceOfGroup(signer2.address, shiftedItemGroupId)).to.equal(0);
        });
    });

    describe("lock", function () {
        it('Reverts: permit is not valid unless owner is sender', async () => {
            await expect(
                super721.lock()
            ).to.be.revertedWith("PermitControl: sender does not have a valid permit");

            expect(await super721.locked()).to.equal(false);
            await super721.connect(owner).lock();
            expect(await super721.locked()).to.equal(true);
        });

        it('sets locked to true when the permit is valid', async () => {
            let currentBlockNumber = await ethers.provider.getBlockNumber();
            let block = await ethers.provider.getBlock(currentBlockNumber);
            let expiration = block.timestamp + 10000;

            await super721.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                lockCreationRight,
                expiration
            );

            expect(await super721.locked()).to.equal(false);
            await super721.lock();
            expect(await super721.locked()).to.equal(true);
        });
    });

    describe("isApprovedForAll", function () {
        it('Reverts: setting approval status for self', async () => {
            await expect(
                super721.setApprovalForAll(deployer.address, true)
            ).to.be.revertedWith("Super721::balanceOf: setting approval status for self");
        });

        it('uses operatorApprovals except when the operator is registered in the proxyRegistry', async () => {
            expect(await super721.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
            await super721.setApprovalForAll(signer1.address, true);
            expect(await super721.isApprovedForAll(deployer.address, signer1.address)).to.equal(true);
            await super721.setApprovalForAll(signer1.address, false);
            expect(await super721.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
        });

        it('returns true when proxyRegistry.proxies(_owner) == operator', async () => {
            expect(await super721.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
            expect(await proxyRegistry.proxies(deployer.address)).to.equal(NULL_ADDRESS);
            await proxyRegistry.connect(deployer).setProxy(deployer.address, signer1.address);
            expect(await proxyRegistry.proxies(deployer.address)).to.equal(signer1.address);
            expect(await super721.isApprovedForAll(deployer.address, signer1.address)).to.equal(true);
            await proxyRegistry.connect(deployer).setProxy(deployer.address, NULL_ADDRESS);
            expect(await proxyRegistry.proxies(deployer.address)).to.equal(NULL_ADDRESS);
            expect(await super721.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
        });
    });

    describe("safeBatchTransferFrom", function () {
        it('Reverts: when then ERC721Receiver does not return onERC721Received.selector', async () => {
            let itemGroupIdTransferException = ethers.BigNumber.from(999);
            let shiftedItemGroupIdTransferException = itemGroupIdTransferException.shl(128);

            await super721.connect(owner).configureGroup(itemGroupIdTransferException, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 1,
                itemData: 0,
                burnType: 1,
                burnData: 100
            });

            await super721.connect(owner).mintBatch(
                signer1.address,
                [shiftedItemGroupIdTransferException],
                [3],
                ethers.utils.id('a')
            );

            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupIdTransferException)).to.equal(3);

            // trigger fail with arbitrary fail value ([2])
            await expect(
                super721.connect(signer1).safeBatchTransferFrom(
                    signer1.address,
                    erc721Receiver.address,
                    [shiftedItemGroupIdTransferException],
                    [2],
                    ethers.utils.id(''))
            ).to.be.revertedWith("Super721::_doSafeTransferAcceptanceCheck: ERC721Receiver rejected tokens");

            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupIdTransferException)).to.equal(3);

            // happy path

            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken2',
                supplyType: 0,
                supplyData: 20000,
                itemType: 1,
                itemData: 0,
                burnType: 1,
                burnData: 100
            });

            await super721.connect(owner).mintBatch(
                signer1.address,
                [shiftedItemGroupId],
                [3],
                ethers.utils.id('a')
            );
            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(3);
            expect(await super721.balanceOfGroup(erc721Receiver.address, shiftedItemGroupId)).to.equal(0);
            await super721.connect(signer1).safeBatchTransferFrom(
                signer1.address,
                erc721Receiver.address,
                [shiftedItemGroupId],
                [1],
                ethers.utils.id('b')
            );

            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(2);
            expect(await super721.balanceOfGroup(erc721Receiver.address, shiftedItemGroupId)).to.equal(1);
        });
        it('Reverts: when insufficient balance for transfer', async () => {
            // trigger fail with arbitrary fail value ([2])
            await expect(
                super721.connect(signer1).safeBatchTransferFrom(
                    signer1.address,
                    erc721Receiver.address,
                    [2],
                    [2],
                    ethers.utils.id('b'))
            ).to.be.revertedWith("Super721::safeBatchTransferFrom: insufficient balance for transfer");
        });
        it('Reverts: ids and amounts length mismatch', async () => {
            await expect(
                super721.safeBatchTransferFrom(signer1.address, signer2.address, [1], [1, 2], ethers.utils.id('a'))
            ).to.be.revertedWith("Super721::safeBatchTransferFrom: ids and amounts length mismatch");
        });
        it('Reverts: transfer to the 0 address', async () => {
            await expect(
                super721.safeBatchTransferFrom(signer1.address, NULL_ADDRESS, [1], [1], ethers.utils.id('a'))
            ).to.be.revertedWith("Super721::safeBatchTransferFrom: transfer to the zero address");
        });
        it('Reverts: call is not owner nor approved', async () => {
            // not owner
            await expect(
                super721.safeBatchTransferFrom(signer1.address, super721.address, [1], [1], ethers.utils.id('a'))
            ).to.be.revertedWith("Super721::safeBatchTransferFrom: caller is not owner nor approved");

            // not approved
            await expect(
                super721.safeBatchTransferFrom(signer1.address, super721.address, [1], [1], ethers.utils.id('a'))
            ).to.be.revertedWith("Super721::safeBatchTransferFrom: caller is not owner nor approved");
        });
        it('transfers in batches, safely', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 100
            });

            // configure group2 and mint both
            await super721.connect(owner).configureGroup(itemGroupId2, {
                name: 'FungibleToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 1,
                itemData: 0,
                burnType: 1, // what if 0/none?
                burnData: 100
            });

            await expect(
                super721.connect(owner).burnBatch(signer1.address, [shiftedItemGroupId2], [1])
            ).to.be.revertedWith("Super721::burn: burn amount exceeds balance");

            // MINT
            await super721.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId, shiftedItemGroupId2], [1, 10], ethers.utils.id('a'));

            expect(await super721.balanceOfGroup(deployer.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721.groupBalances(itemGroupId, deployer.address)).to.equal(1);
            expect(await super721.totalBalances(deployer.address)).to.equal(11);
            expect(await super721.balanceOfGroup(deployer.address, shiftedItemGroupId2)).to.equal(10);
            expect(await super721.groupBalances(itemGroupId2, deployer.address)).to.equal(10);
            expect(await super721.totalBalances(deployer.address)).to.equal(11);

            // caller is owner
            await super721.safeBatchTransferFrom(
                deployer.address,
                signer2.address,
                [shiftedItemGroupId, shiftedItemGroupId2],
                [1, 5],
                ethers.utils.id('a')
            );

            expect(await super721.balanceOfGroup(deployer.address, itemGroupId)).to.equal(0);
            expect(await super721.groupBalances(shiftedItemGroupId, deployer.address)).to.equal(0);
            expect(await super721.balanceOfGroup(deployer.address, shiftedItemGroupId2)).to.equal(5);
            expect(await super721.groupBalances(itemGroupId2, deployer.address)).to.equal(5);
            expect(await super721.totalBalances(deployer.address)).to.equal(5);

            expect(await super721.balanceOfGroup(signer2.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721.groupBalances(itemGroupId, signer2.address)).to.equal(1);
            expect(await super721.balanceOfGroup(signer2.address, shiftedItemGroupId2)).to.equal(5);
            expect(await super721.groupBalances(itemGroupId2, signer2.address)).to.equal(5);
            expect(await super721.totalBalances(signer2.address)).to.equal(6);

            // caller is approved
            await super721.setApprovalForAll(signer1.address, true);
            await super721.connect(signer1).safeBatchTransferFrom(
                deployer.address,
                signer3.address,
                [shiftedItemGroupId2],
                [3],
                ethers.utils.id('a')
            );
            expect(await super721.balanceOfGroup(deployer.address, shiftedItemGroupId2)).to.equal(2);
            expect(await super721.groupBalances(itemGroupId2, deployer.address)).to.equal(2);
            expect(await super721.totalBalances(deployer.address)).to.equal(2);
            expect(await super721.balanceOfGroup(signer3.address, shiftedItemGroupId2)).to.equal(3);
            expect(await super721.groupBalances(itemGroupId2, signer3.address)).to.equal(3);
            expect(await super721.totalBalances(signer3.address)).to.equal(3);

            // to address is a contract
            await super721.safeBatchTransferFrom(
                deployer.address,
                erc721Receiver.address,
                [shiftedItemGroupId2],
                [1],
                ethers.utils.id('a')
            );
            expect(await super721.balanceOfGroup(deployer.address, shiftedItemGroupId2)).to.equal(1);
            expect(await super721.groupBalances(itemGroupId2, deployer.address)).to.equal(1);
            expect(await super721.totalBalances(deployer.address)).to.equal(1);
            expect(await super721.balanceOfGroup(erc721Receiver.address, shiftedItemGroupId2)).to.equal(1);
            expect(await super721.groupBalances(itemGroupId2, erc721Receiver.address)).to.equal(1);
            expect(await super721.totalBalances(erc721Receiver.address)).to.equal(1);
        });
    });

    // describe("safeTransferFrom", function () {
    //     it('Reverts: when then ERC721Receiver does not return onERC721Received.selector', async () => {
    //         let itemGroupIdTransferException = ethers.BigNumber.from(999);
    //         let shiftedItemGroupIdTransferException = itemGroupIdTransferException.shl(128);

    //         await super721.connect(owner).configureGroup(itemGroupIdTransferException, {
    //             name: 'GenericToken',
    //             supplyType: 0,
    //             supplyData: 20000,
    //             itemType: 1,
    //             itemData: 0,
    //             burnType: 1,
    //             burnData: 100
    //         });
    //         await super721.connect(owner).mintBatch(
    //             signer1.address,
    //             [shiftedItemGroupIdTransferException],
    //             [2],
    //             ethers.utils.id('a')
    //         );

    //         // fungible items get .add(1)
    //         expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupIdTransferException.add(1))).to.equal(2);

    //         // trigger fail with arbitrary fail value (2)
    //         await expect(
    //             super721.connect(signer1).safeTransferFrom(
    //                 signer1.address,
    //                 erc721Receiver.address,
    //                 2,
    //                 ethers.utils.id('b'))
    //         ).to.be.revertedWith("ERC721: ERC721Receiver rejected tokens");

    //         await super721.connect(signer1).safeTransferFrom(
    //             signer1.address,
    //             erc721Receiver.address,
    //             1,
    //             ethers.utils.id('b')
    //         );

    //         expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupIdTransferException.add(1))).to.equal(1);
    //     });
    //     it('Reverts: transfer to the 0 address', async () => {
    //         await expect(
    //             super721.safeTransferFrom(signer1.address, NULL_ADDRESS, 1, ethers.utils.id('a'))
    //         ).to.be.revertedWith("ERC721: transfer to the zero address");
    //     });
    //     it('Reverts: call is not owner nor approved', async () => {
    //         // not owner
    //         await expect(
    //             super721.safeTransferFrom(signer1.address, super721.address, 1, ethers.utils.id('a'))
    //         ).to.be.revertedWith("ERC721: caller is not owner nor approved");

    //         // not approved
    //         await expect(
    //             super721.safeTransferFrom(signer1.address, super721.address, 1, ethers.utils.id('a'))
    //         ).to.be.revertedWith("ERC721: caller is not owner nor approved");
    //     });
    //     it('transfers in batches, safely', async () => {
    //         await super721.connect(owner).configureGroup(itemGroupId, {
    //             name: 'GenericToken',
    //             supplyType: 0,
    //             supplyData: 20000,
    //             itemType: 0,
    //             itemData: 0,
    //             burnType: 1,
    //             burnData: 100
    //         });

    //         // configure group2 and mint both
    //         await super721.connect(owner).configureGroup(itemGroupId2, {
    //             name: 'FungibleToken',
    //             supplyType: 0,
    //             supplyData: 20000,
    //             itemType: 1,
    //             itemData: 0,
    //             burnType: 1, // what if 0/none?
    //             burnData: 100
    //         });

    //         await expect(
    //             super721.connect(owner).burnBatch(signer1.address, [shiftedItemGroupId2], [1])
    //         ).to.be.revertedWith("Super721::burn: burn amount exceeds balance");

    //         // MINT
    //         await super721.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId, shiftedItemGroupId2], [1, 10], ethers.utils.id('a'));

    //         expect(await super721.balanceOfGroup(deployer.address, shiftedItemGroupId)).to.equal(1);
    //         expect(await super721.groupBalances(itemGroupId, deployer.address)).to.equal(1);
    //         expect(await super721.totalBalances(deployer.address)).to.equal(11);
    //         expect(await super721.balanceOfGroup(deployer.address, shiftedItemGroupId2)).to.equal(10);
    //         expect(await super721.groupBalances(itemGroupId2, deployer.address)).to.equal(10);
    //         expect(await super721.totalBalances(deployer.address)).to.equal(11);

    //         // caller is owner
    //         await super721.safeTransferFrom(
    //             deployer.address,
    //             signer2.address,
    //             5,
    //             ethers.utils.id('a')
    //         );

    //         // adds one to shifted if for fungible items...
    //         expect(await super721.balanceOfGroup(deployer.address, shiftedItemGroupId2.add(1))).to.equal(5);
    //         expect(await super721.groupBalances(itemGroupId2, deployer.address)).to.equal(5);
    //         expect(await super721.totalBalances(deployer.address)).to.equal(6);

    //         // adds one to shifted if for fungible items...
    //         expect(await super721.balanceOfGroup(signer2.address, shiftedItemGroupId2.add(1))).to.equal(5);
    //         expect(await super721.groupBalances(itemGroupId2, signer2.address)).to.equal(5);
    //         expect(await super721.totalBalances(signer2.address)).to.equal(5);

    //         // caller is approved
    //         await super721.setApprovalForAll(signer1.address, true);
    //         await super721.connect(signer1).safeTransferFrom(
    //             deployer.address,
    //             signer3.address,
    //             3,
    //             ethers.utils.id('a')
    //         );
    //         expect(await super721.balanceOfGroup(deployer.address, shiftedItemGroupId2.add(1))).to.equal(2);
    //         expect(await super721.groupBalances(itemGroupId2, deployer.address)).to.equal(2);
    //         expect(await super721.totalBalances(deployer.address)).to.equal(3);
    //         expect(await super721.balanceOfGroup(signer3.address, shiftedItemGroupId2.add(1))).to.equal(3);
    //         expect(await super721.groupBalances(itemGroupId2, signer3.address)).to.equal(3);
    //         expect(await super721.totalBalances(signer3.address)).to.equal(3);

    //         // to address is a contract
    //         // TODO: this
    //     });
    // });

    describe("burnBatch", function () {
        it('Reverts: no right', async () => {
            await expect(
                super721.burnBatch(signer1.address, [1], [10])
            ).to.be.revertedWith("Super721::burnBatch: you do not have the right to burn that item");
        });
        it('Reverts: non-existent group', async () => {
            await expect(
                super721.connect(owner).burnBatch(signer1.address, [1], [10])
            ).to.be.revertedWith("Super721::_burnChecker: you cannot burn a non-existent item group");
        });
        it('Reverts: burn limit exceeded', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 0
            });

            await expect(
                super721.connect(owner).burnBatch(signer1.address, [shiftedItemGroupId], [10])
            ).to.be.revertedWith("Super721::_burnChecker you may not exceed the burn limit on this item group");
        });
        it('burns in batches', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 100
            });

            // configure group2 and mint both
            await super721.connect(owner).configureGroup(itemGroupId2, {
                name: 'FungibleToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 1,
                itemData: 0,
                burnType: 1, // what if 0/none?
                burnData: 100
            });

            await expect(
                super721.connect(owner).burnBatch(signer1.address, [shiftedItemGroupId, shiftedItemGroupId2], [1, 5])
            ).to.be.revertedWith("Super721::burn: burn amount exceeds balance");

            // MINT
            await super721.connect(owner).mintBatch(
                signer1.address, [shiftedItemGroupId, shiftedItemGroupId2], [1, 10], ethers.utils.id('a')
            );

            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(1);
            expect(await super721.groupBalances(itemGroupId, signer1.address)).to.equal(1);
            expect(await super721.totalBalances(signer1.address)).to.equal(11);
            expect(await super721.circulatingSupply(shiftedItemGroupId)).to.equal(1);
            expect(await super721.burnCount(shiftedItemGroupId)).to.equal(0);
            let genericTokensGroup = await super721.itemGroups(itemGroupId);
            expect(genericTokensGroup[6]).to.equal(1); // circulatingSupply;
            expect(genericTokensGroup[8]).to.equal(0); // burnCount;

            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId2)).to.equal(10);
            expect(await super721.groupBalances(itemGroupId2, signer1.address)).to.equal(10);
            expect(await super721.totalBalances(signer1.address)).to.equal(11);
            expect(await super721.circulatingSupply(shiftedItemGroupId2)).to.equal(10);
            expect(await super721.burnCount(shiftedItemGroupId2)).to.equal(0);
            let fungibleTokenGroup = await super721.itemGroups(itemGroupId2);
            expect(fungibleTokenGroup[6]).to.equal(10); // circulatingSupply;
            expect(fungibleTokenGroup[8]).to.equal(0); // burnCount;

            // BURN
            await super721.connect(owner).burnBatch(
                signer1.address,
                [shiftedItemGroupId, shiftedItemGroupId2],
                [1, 5]
            );

            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(0);
            expect(await super721.groupBalances(itemGroupId, signer1.address)).to.equal(0);
            expect(await super721.totalBalances(signer1.address)).to.equal(5);
            genericTokensGroup = await super721.itemGroups(itemGroupId);
            expect(genericTokensGroup[6]).to.equal(0); // circulatingSupply;
            expect(genericTokensGroup[8]).to.equal(1); // burnCount;
            expect(await super721.circulatingSupply(shiftedItemGroupId)).to.equal(0);
            expect(await super721.burnCount(shiftedItemGroupId)).to.equal(1);

            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId2)).to.equal(5);
            expect(await super721.groupBalances(itemGroupId2, signer1.address)).to.equal(5);
            expect(await super721.totalBalances(signer1.address)).to.equal(5);
            expect(await super721.circulatingSupply(shiftedItemGroupId2)).to.equal(5);
            expect(await super721.burnCount(shiftedItemGroupId2)).to.equal(5);
            fungibleTokenGroup = await super721.itemGroups(itemGroupId2);
            expect(fungibleTokenGroup[6]).to.equal(5); // circulatingSupply;
            expect(fungibleTokenGroup[8]).to.equal(5); // burnCount;
        });
    });

    describe("configureGroup", function () {
        it('Reverts: groupId is 0', async () => {
            await expect(
                super721.connect(owner).configureGroup(ethers.BigNumber.from(0), {
                    name: 'FrenBurgers',
                    supplyType: 0,
                    supplyData: 20000,
                    itemType: 0,
                    itemData: 0,
                    burnType: 1,
                    burnData: 20000
                })
            ).to.be.revertedWith("Super721::configureGroup: group ID 0 is invalid");
        });

        it('Reverts: sender does not have the right', async () => {
            await expect(
                super721.configureGroup(itemGroupId, {
                    name: 'FrenBurgers',
                    supplyType: 0,
                    supplyData: 20000,
                    itemType: 0,
                    itemData: 0,
                    burnType: 1,
                    burnData: 20000
                })
            ).to.be.revertedWith("Super721::hasItemRight: _msgSender does not have the right to perform that action");
        });

        it('initializes a group and allows reconfiguration', async () => {
            // struct ItemGroupInput {
            //     string name;
            //     SupplyType supplyType;
            //     uint256 supplyData;
            //     BurnType burnType;
            //     uint256 burnData;
            //   }

            await super721.connect(owner).configureGroup(itemGroupId, {
                    name: 'FrenBurgers',
                    supplyType: 1,
                    supplyData: 20000,
                    burnType: 0,
                    burnData: 10000
            });

            let frenBurgersGroup = await super721.itemGroups(itemGroupId);
            expect(frenBurgersGroup[0]).to.equal(true); // initialized;
            expect(frenBurgersGroup[1]).to.equal('FrenBurgers'); // name;
            expect(frenBurgersGroup[2]).to.equal(1); // supplyType;
            expect(frenBurgersGroup[3]).to.equal(20000); // supplyData;
            expect(frenBurgersGroup[4]).to.equal(0); // burnType;
            expect(frenBurgersGroup[5]).to.equal(10000); // burnData;
            expect(frenBurgersGroup[6]).to.equal(0); // circulatingSupply;
            expect(frenBurgersGroup[7]).to.equal(0); // mintCount;
            expect(frenBurgersGroup[8]).to.equal(0); // burnCount;

            // reconfiguring before minting
            // ItemType can be changed from NonFungible to Fungible when the count is <= 1
            // SupplyType can be changed from NOT Capped to anything
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'BestFrenBurgers',
                supplyType: 0,
                supplyData: 20000,
                burnType: 0, // TODO: do we want
                burnData: 10000
            });

            frenBurgersGroup = await super721.itemGroups(itemGroupId);
            expect(frenBurgersGroup[0]).to.equal(true); // initialized;
            expect(frenBurgersGroup[1]).to.equal('BestFrenBurgers'); // name;
            expect(frenBurgersGroup[2]).to.equal(0); // supplyType;
            expect(frenBurgersGroup[3]).to.equal(20000); // supplyData;
            expect(frenBurgersGroup[4]).to.equal(0); // burnType; // TODO: change this?
            expect(frenBurgersGroup[5]).to.equal(10000); // burnData;
            expect(frenBurgersGroup[6]).to.equal(0); // circulatingSupply;
            expect(frenBurgersGroup[7]).to.equal(0); // mintCount;
            expect(frenBurgersGroup[8]).to.equal(0); // burnCount;


            // minting an item and then reconfiguring
            await super721.connect(owner).setPermit(
                signer1.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );
            await super721.connect(signer1).mintBatch(signer1.address, [shiftedItemGroupId], [1], ethers.utils.id('a'));
            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(1);

            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'BestFrenBurgers',
                supplyType: 0,
                supplyData: 1,
                burnType: 0,
                burnData: 10000
            });

            frenBurgersGroup = await super721.itemGroups(itemGroupId);
            expect(frenBurgersGroup[0]).to.equal(true); // initialized;
            expect(frenBurgersGroup[1]).to.equal('BestFrenBurgers'); // name;
            expect(frenBurgersGroup[2]).to.equal(0); // supplyType;
            expect(frenBurgersGroup[3]).to.equal(1); // supplyData;
            expect(frenBurgersGroup[4]).to.equal(0); // burnType; // TODO: change this?
            expect(frenBurgersGroup[5]).to.equal(10000); // burnData;
            expect(frenBurgersGroup[6]).to.equal(1); // circulatingSupply;
            expect(frenBurgersGroup[7]).to.equal(1); // mintCount;
            expect(frenBurgersGroup[8]).to.equal(0); // burnCount;
        });
    });

    describe("tokenByIndex", function () {
        it('returns the token at a given index', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });

            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], [1], ethers.utils.id('a'));
            expect(await super721.tokenByIndex(0)).to.equal(shiftedItemGroupId);
            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId.add(1)], [1], ethers.utils.id('a'));
            expect(await super721.tokenByIndex(1)).to.equal(shiftedItemGroupId.add(1));

            await expect(
                super721.tokenByIndex(2)
            ).to.be.revertedWith("EnumerableMap: index out of bounds");
        });
    });

    describe("totalSupply", function () {
        it('returns the totalSupply of tokens', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });

            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], [1], ethers.utils.id('a'));
            expect(await super721.totalSupply()).to.equal(1);
            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId.add(1)], [1], ethers.utils.id('a'));

            expect(await super721.totalSupply()).to.equal(2);

            await super721.connect(owner).configureGroup(itemGroupId2, {
                name: 'GenericToken2',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });
            // here
            // TODO: see 2 vs 1.. amount not right
            await super721.connect(owner).mintBatch(
                signer1.address,
                [shiftedItemGroupId2.add(1), shiftedItemGroupId2.add(2), shiftedItemGroupId2.add(3)],
                [2, 1, 1],
                ethers.utils.id('a')
            );
            expect(await super721.totalSupply()).to.equal(5);
            expect(await super721.balanceOf(signer1.address)).to.equal(6);
        });
    });

    describe("balanceOf", function () {
        it('returns the balanceOf of tokens for an address', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });

            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], [1], ethers.utils.id('a'));
            expect(await super721.balanceOf(signer1.address)).to.equal(1);
            expect(await super721.balanceOf(signer2.address)).to.equal(0);
            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId.add(1)], [1], ethers.utils.id('a'));
            expect(await super721.balanceOf(signer1.address)).to.equal(2);
            expect(await super721.balanceOf(signer2.address)).to.equal(0)


            await super721.connect(owner).configureGroup(itemGroupId2, {
                name: 'GenericToken2',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });

            await super721.connect(owner).mintBatch(
                signer2.address,
                [shiftedItemGroupId2.add(1), shiftedItemGroupId2.add(2), shiftedItemGroupId2.add(3)],
                [1, 1, 1],
                ethers.utils.id('a')
            );
            expect(await super721.totalSupply()).to.equal(5);

            expect(await super721.balanceOf(signer1.address)).to.equal(2);
            expect(await super721.balanceOf(signer2.address)).to.equal(3);
        });
    });

    describe("balanceOfBatch", function () {
        it('returns the balanceOf of tokens for arrays addresses and indexes', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });

            expect((await super721.balanceOfBatch([signer1.address], [shiftedItemGroupId]))[0]).to.equal(0);
            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], [1], ethers.utils.id('a'));
            expect((await super721.balanceOfBatch([signer1.address], [shiftedItemGroupId]))[0]).to.equal(1);
            expect((await super721.balanceOfBatch([signer2.address], [shiftedItemGroupId]))[0]).to.equal(0);
            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId.add(1)], [1], ethers.utils.id('a'));
            expect((await super721.balanceOfBatch([signer1.address], [shiftedItemGroupId]))[0]).to.equal(1);
            expect((await super721.balanceOfBatch([signer1.address], [shiftedItemGroupId.add(1)]))[0]).to.equal(1);
            expect((await super721.balanceOfBatch([signer2.address], [shiftedItemGroupId]))[0]).to.equal(0);


            await super721.connect(owner).configureGroup(itemGroupId2, {
                name: 'GenericToken2',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });

            await super721.connect(owner).mintBatch(
                signer2.address,
                [shiftedItemGroupId2.add(1), shiftedItemGroupId2.add(2), shiftedItemGroupId2.add(3)],
                [1, 1, 1],
                ethers.utils.id('a')
            );

            expect((await super721.balanceOfBatch([signer2.address], [shiftedItemGroupId2.add(1)]))[0]).to.equal(1);
            expect((await super721.balanceOfBatch([signer2.address], [shiftedItemGroupId2.add(2)]))[0]).to.equal(1);
            expect((await super721.balanceOfBatch([signer2.address], [shiftedItemGroupId2.add(3)]))[0]).to.equal(1);
            expect((await super721.balanceOfBatch([signer2.address], [shiftedItemGroupId]))[0]).to.equal(0);
        });
    });

    describe("approve", function () {
        let tokenId;

        beforeEach(async function () {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });

            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], [1], ethers.utils.id('a'));
            tokenId = super721.tokenOfOwnerByIndex(signer1.address, 0);
        });

        it('Reverts: sender is not current owner', async () => {
            await expect(
                super721.approve(signer2.address, tokenId)
            ).to.be.revertedWith("Super721::approve: approve caller is not owner nor approved for all");
        });

        it('Reverts: sender is not current owner', async () => {
            await expect(
                super721.connect(signer1).approve(signer1.address, tokenId)
            ).to.be.revertedWith("Super721::approve: approval to current owner");
        });

        it('approves when owner approves another address', async () => {
            expect(await super721.getApproved(tokenId)).to.equal(NULL_ADDRESS);
            await super721.connect(signer1).approve(signer2.address, tokenId);
            expect(await super721.getApproved(tokenId)).to.equal(signer2.address);
        });
    });

    describe("version", function () {
        it('returns 1', async () => {
            expect(await super721.version()).to.equal(1);
        });
    });

    describe("ownerOf", function () {
        it('returns the ownerOf a given token based on tokenId', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });

            await super721.connect(owner).setPermit(
                signer1.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );

            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], [1], ethers.utils.id('a'));
            let tokenId = super721.tokenOfOwnerByIndex(signer1.address, 0);
            expect(await super721.ownerOf(tokenId)).to.equal(signer1.address);

            // configuring another ItemGroup and minting more
            await super721.connect(owner).configureGroup(itemGroupId2, {
                name: 'FungibleFungus',
                supplyType: 0,
                supplyData: 20000,
                itemType: 1,
                itemData: 0,
                burnType: 0,
                burnData: 20000
            });

            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId2], [2], ethers.utils.id('a'));
            let tokenId2 = super721.tokenOfOwnerByIndex(signer1.address, 1);
            expect(await super721.ownerOf(tokenId2)).to.equal(signer1.address);

            // await super721.connect(signer1).transferFrom(
            //     signer1.address,
            //     signer2.address,
            //     tokenId2
            // );

            // expect(await super721.ownerOf(tokenId2)).to.equal(signer2.address);
        });
    });

    describe("mintBatch", function () {
        it('Reverts: mintBatch to address(0)', async () => {
            await expect(
                super721.mintBatch(NULL_ADDRESS, [shiftedItemGroupId], [1], ethers.utils.id('a'))
            ).to.be.revertedWith("Super721::mintBatch: mint to the zero address");
        });

        it('Reverts: ids and amounts length mismatch', async () => {
            await expect(
                super721.mintBatch(signer1.address, [shiftedItemGroupId], [1, 2], ethers.utils.id('a'))
            ).to.be.revertedWith("Super721::mintBatch: ids and amounts length mismatch");
        });

        it('Reverts: token already exists"', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });

            await super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], [1], ethers.utils.id('a'));

            await expect(
                super721.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], [1], ethers.utils.id('a'))
            ).to.be.revertedWith("Super721::_mintChecker: token already exists");
        });

        it('allows mintBatch when rights and proper config', async () => {
            await super721.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });

            await expect(
                super721.connect(signer1).mintBatch(signer1.address, [shiftedItemGroupId], [10], ethers.utils.id('a'))
            ).to.be.revertedWith("Super721::mintBatch: you do not have the right to mint that item");

            await super721.connect(owner).setPermit(
                signer1.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );

            let originalBalance = await super721.balanceOfGroup(signer1.address, shiftedItemGroupId);
            let originalGroupBalance = await super721.groupBalances(itemGroupId, signer1.address);
            let originalTotalBalance = await super721.totalBalances(signer1.address);
            let originalCirculatingSupply = (await super721.itemGroups(itemGroupId))[6];
            let originalMintCount = (await super721.itemGroups(itemGroupId))[7];
            expect(originalBalance).to.equal(0);
            expect(originalGroupBalance).to.equal(0);
            expect(originalTotalBalance).to.equal(0);
            expect(originalCirculatingSupply).to.equal(0);
            await super721.connect(signer1).mintBatch(signer1.address, [shiftedItemGroupId], [1], ethers.utils.id('a'));
            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId)).to.equal(originalBalance.add(1));
            expect((await super721.itemGroups(itemGroupId))[6]).to.equal(originalCirculatingSupply.add(1));
            expect((await super721.itemGroups(itemGroupId))[7]).to.equal(originalMintCount.add(1));

            expect(
                await super721.groupBalances(itemGroupId, signer1.address)
            ).to.equal(originalGroupBalance.add(1));

            expect(
                await super721.totalBalances(signer1.address)
            ).to.equal(originalTotalBalance.add(1));

            // configuring another ItemGroup and minting more
            await super721.connect(owner).configureGroup(itemGroupId2, {
                name: 'FungibleFungus',
                supplyType: 0,
                supplyData: 20000,
                itemType: 1,
                itemData: 0,
                burnType: 0,
                burnData: 20000
            });

            await expect(
                super721.connect(signer2).mintBatch(signer1.address, [shiftedItemGroupId2], [10], ethers.utils.id('a'))
            ).to.be.revertedWith("Super721::mintBatch: you do not have the right to mint that item");

            await super721.connect(owner).setPermit(
                signer2.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );

            let originalBalance2 = await super721.balanceOfGroup(signer1.address, shiftedItemGroupId2);
            let originalGroupBalance2 = await super721.groupBalances(itemGroupId2, signer1.address);
            let originalTotalBalance2 = await super721.totalBalances(signer1.address);
            let originalCirculatingSupply2 = (await super721.itemGroups(itemGroupId2))[6];
            let originalMintCount2 = (await super721.itemGroups(itemGroupId2))[7];
            expect(originalBalance2).to.equal(0);
            expect(originalGroupBalance2).to.equal(0);
            expect(originalTotalBalance2).to.equal(1);
            expect(originalCirculatingSupply2).to.equal(0);
            await super721.connect(signer2).mintBatch(signer1.address, [shiftedItemGroupId2], [10], ethers.utils.id('a'));
            expect(await super721.balanceOfGroup(signer1.address, shiftedItemGroupId2)).to.equal(originalBalance2.add(10));
            expect((await super721.itemGroups(itemGroupId2))[6]).to.equal(originalCirculatingSupply2.add(10));
            expect((await super721.itemGroups(itemGroupId2))[7]).to.equal(originalMintCount2.add(10));
        });
    });

    describe("setMetadata", function () {
        it('Reverts: no setMetadata permissions', async () => {
            await expect(
                super721.setMetadata(1, 'mettaDatum')
            ).to.be.revertedWith("Super721::hasItemRight: _msgSender does not have the right to perform that action");
        });

        it('Reverts: global lockURI', async () => {
            await super721.connect(owner).lockURI('lockedURI');

            await expect(
                super721.connect(owner).setMetadata(1, 'mettaDatum')
            ).to.be.revertedWith("Super721::setMetadata: you cannot edit this metadata because it is frozen");
        });

        // NOTE: allows setMetadata for groups that aren't configured ¯\_(ツ)_/¯
        it('allows setMetadata when permission', async () => {
            let currentBlockNumber = await ethers.provider.getBlockNumber();
            let block = await ethers.provider.getBlock(currentBlockNumber);
            let expiration = block.timestamp + 10000;

            await super721.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setMetadataRight,
                expiration
            );
            expect(await super721.metadata(1)).to.equal('');
            await super721.setMetadata(1, 'mettaDatum');
            expect(await super721.metadata(1)).to.equal('mettaDatum');
        });
    });
});
