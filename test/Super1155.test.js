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
describe('Super1155', function () {
    let deployer, owner, signer1, signer2, signer3;
    let setUriRight,
        lockUriRight,
        lockItemUriRight,
        mintRight,
        setMetadataRight,
        lockCreationRight,
        setProxyRegistryRight;
    let UNIVERSAL;
    let super1155;
    let erc1155Receiver;
    let proxyRegistry;
    const originalUri = "://ipfs/uri/{id}";
    let itemGroupId = ethers.BigNumber.from(1);
    let shiftedItemGroupId = itemGroupId.shl(128);
    let itemGroupId2 = ethers.BigNumber.from(2);
    let shiftedItemGroupId2 = itemGroupId2.shl(128);

    before(async function () {
        this.Super1155 = await ethers.getContractFactory("Super1155");
        this.ProxyRegistry = await ethers.getContractFactory("MockProxyRegistry");
        this.ERC1155Receiver = await ethers.getContractFactory("BadERC1155Receiver");
    });

    beforeEach(async function () {
        [deployer, owner, signer1, signer2, signer3] = await ethers.getSigners();

        erc1155Receiver = await this.ERC1155Receiver.deploy();
        await erc1155Receiver.deployed();

        proxyRegistry = await this.ProxyRegistry.deploy();
        await proxyRegistry.deployed();

        super1155 = await this.Super1155.deploy(
            owner.address,
            "Super1155",
            originalUri,
            proxyRegistry.address
        );
        await super1155.deployed();

        setUriRight = await super1155.SET_URI();
        lockUriRight = await super1155.LOCK_URI();
        lockItemUriRight = await super1155.LOCK_ITEM_URI();
        mintRight = await super1155.MINT();
        setProxyRegistryRight = await super1155.SET_PROXY_REGISTRY();
        setMetadataRight = await super1155.SET_METADATA();
        lockCreationRight = await super1155.LOCK_CREATION();
        UNIVERSAL = await super1155.UNIVERSAL();
    });

    // Test cases

    //////////////////////////////
    //       Constructor
    //////////////////////////////
    describe("Constructor", function () {
        it('initialized values as expected', async function () {
            expect(await super1155.owner()).to.equal(owner.address);
            expect(await super1155.name()).to.equal('Super1155');
            expect(await super1155.metadataUri()).to.equal(originalUri);
            expect(await super1155.proxyRegistryAddress()).to.equal(proxyRegistry.address);
        });
    });

    describe("uri", function () {
        it('returns the metadataUri', async function () {
            expect(await super1155.uri(1)).to.equal(originalUri);
        });
    });

    describe("setURI", function () {
        it('reverts when there is not a valid permit for sender', async function () {
            await expect(
                super1155.setURI("://ipfs/newuri/{id}")
            ).to.be.revertedWith('PermitControl: sender does not have a valid permit');
            expect(await super1155.uri(1)).to.equal(originalUri);
        });

        it('reverts when the collection has been locked', async function () {
            await super1155.connect(owner).lockURI('hi');

            await expect(
                super1155.connect(owner).setURI("://ipfs/newuri/{id}")
            ).to.be.revertedWith("Super1155: the collection URI has been permanently locked");

            expect(await super1155.uri(1)).to.equal('hi');
        });

        it('sets the metadataUri when there is a valid permit', async function () {
            await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setUriRight,
                ethers.constants.MaxUint256
            );
            await super1155.setURI("://ipfs/newuri/{id}");
            expect(await super1155.uri(1)).to.equal("://ipfs/newuri/{id}");
            expect(await super1155.uriLocked()).to.equal(false);
        });
    });

    describe("lockURI", function () {
        it('reverts when there is not a valid permit for sender', async function () {
            await expect(
                super1155.lockURI("://ipfs/lockeduri/{id}")
            ).to.be.revertedWith('PermitControl: sender does not have a valid permit');
            expect(await super1155.uri(1)).to.equal(originalUri);
        });

        it('sets the metadataUri and locks it when there is a valid permit', async function () {
            await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                lockUriRight,
                ethers.constants.MaxUint256
            );
            await super1155.lockURI("://ipfs/lockeduri/{id}");
            expect(await super1155.uri(1)).to.equal("://ipfs/lockeduri/{id}");
            expect(await super1155.uriLocked()).to.equal(true);
        });
    });

    describe("lockItemGroupURI", function () {
        it('reverts when there is not a valid permit for sender', async function () {
            expect(await super1155.metadataFrozen(1)).to.equal(false);
            await expect(
                super1155.lockItemGroupURI("://ipfs/lockeduri/{id}", 1)
            ).to.be.revertedWith('Super1155: _msgSender does not have the right to perform that action');
            expect(await super1155.metadataFrozen(1)).to.equal(false);
        });

        it('sets the metadataUri and locks it when there is a valid permit', async function () {
            await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                lockItemUriRight,
                ethers.constants.MaxUint256
            );
            expect(await super1155.metadataFrozen(1)).to.equal(false);
            await super1155.lockItemGroupURI("://ipfs/lockeduri/{id}", 1);
            expect(await super1155.metadataFrozen(1)).to.equal(true);
            // expect(await super1155.uri(1)).to.equal("://ipfs/uri/{id}");
            // expect(await super1155.uriLocked()).to.equal(false);
        });
    });

    describe("setProxyRegistry", function () {
        it('Reverts: no setProxyRegistry permissions', async () => {
            await expect(
                super1155.setProxyRegistry(signer1.address)
            ).to.be.revertedWith("PermitControl: sender does not have a valid permit");
        });

        it('allows setProxyRegistry when permissions', async () => {
            let currentBlockNumber = await ethers.provider.getBlockNumber();
            let block = await ethers.provider.getBlock(currentBlockNumber);
            let expiration = block.timestamp + 10000;

            await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setProxyRegistryRight,
                expiration
            );
            expect(await super1155.proxyRegistryAddress()).to.equal(proxyRegistry.address);
            await super1155.setProxyRegistry(signer1.address);
            expect(await super1155.proxyRegistryAddress()).to.equal(signer1.address);
        });
    });

    describe("balanceOf", function () {
        it('Reverts: querying balance of address(0)', async () => {
            await expect(
                super1155.balanceOf(NULL_ADDRESS, 1)
            ).to.be.revertedWith("ERC1155: balance query for the zero address");
        });

        it('returns the balanceOf other addresses', async () => {
            expect(await super1155.balanceOf(signer1.address, shiftedItemGroupId)).to.equal(0);

            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });
            await super1155.connect(owner).mintBatch(
                signer1.address,
                [shiftedItemGroupId],
                [1],
                ethers.utils.id('a')
            );

            expect(await super1155.balanceOf(signer1.address, shiftedItemGroupId)).to.equal(1);
            expect(await super1155.balanceOf(signer2.address, shiftedItemGroupId)).to.equal(0);
        });
    });

    describe("lock", function () {
        it('Reverts: permit is not valid unless owner is sender', async () => {
            await expect(
                super1155.lock()
            ).to.be.revertedWith("PermitControl: sender does not have a valid permit");

            expect(await super1155.locked()).to.equal(false);
            await super1155.connect(owner).lock();
            expect(await super1155.locked()).to.equal(true);
        });

        it('sets locked to true when the permit is valid', async () => {
            let currentBlockNumber = await ethers.provider.getBlockNumber();
            let block = await ethers.provider.getBlock(currentBlockNumber);
            let expiration = block.timestamp + 10000;

            await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                lockCreationRight,
                expiration
            );

            expect(await super1155.locked()).to.equal(false);
            await super1155.lock();
            expect(await super1155.locked()).to.equal(true);
        });
    });

    describe("isApprovedForAll", function () {
        it('Reverts: setting approval status for self', async () => {
            await expect(
                super1155.setApprovalForAll(deployer.address, true)
            ).to.be.revertedWith("ERC1155: setting approval status for self");
        });

        it('uses operatorApprovals except when the operator is registered in the proxyRegistry', async () => {
            expect(await super1155.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
            await super1155.setApprovalForAll(signer1.address, true);
            expect(await super1155.isApprovedForAll(deployer.address, signer1.address)).to.equal(true);
            await super1155.setApprovalForAll(signer1.address, false);
            expect(await super1155.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
        });

        it('returns true when proxyRegistry.proxies(_owner) == operator', async () => {
            expect(await super1155.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
            expect(await proxyRegistry.proxies(deployer.address)).to.equal(NULL_ADDRESS);
            await proxyRegistry.connect(deployer).setProxy(deployer.address, signer1.address);
            expect(await proxyRegistry.proxies(deployer.address)).to.equal(signer1.address);
            expect(await super1155.isApprovedForAll(deployer.address, signer1.address)).to.equal(true);
            await proxyRegistry.connect(deployer).setProxy(deployer.address, NULL_ADDRESS);
            expect(await proxyRegistry.proxies(deployer.address)).to.equal(NULL_ADDRESS);
            expect(await super1155.isApprovedForAll(deployer.address, signer1.address)).to.equal(false);
        });
    });

    describe("safeBatchTransferFrom", function () {
        it('Reverts: when then ERC1155Receiver does not return onERC1155Received.selector', async () => {
            let itemGroupIdTransferException = ethers.BigNumber.from(999);
            let shiftedItemGroupIdTransferException = itemGroupIdTransferException.shl(128);

            await super1155.connect(owner).configureGroup(itemGroupIdTransferException, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 1,
                itemData: 0,
                burnType: 1,
                burnData: 100
            });

            await super1155.connect(owner).mintBatch(
                signer1.address,
                [shiftedItemGroupIdTransferException],
                [2],
                ethers.utils.id('a')
            );

            // fungible items get .add(1)
            expect(await super1155.balanceOf(signer1.address, shiftedItemGroupIdTransferException.add(1))).to.equal(2);

            // trigger fail with arbitrary fail value ([2])
            await expect(
                super1155.connect(signer1).safeBatchTransferFrom(
                    signer1.address,
                    erc1155Receiver.address,
                    [shiftedItemGroupIdTransferException],
                    [2],
                    ethers.utils.id('b'))
            ).to.be.revertedWith("ERC1155: ERC1155Receiver rejected tokens");

            expect(await super1155.balanceOf(signer1.address, shiftedItemGroupIdTransferException.add(1))).to.equal(2);

            await super1155.connect(signer1).safeBatchTransferFrom(
                signer1.address,
                erc1155Receiver.address,
                [shiftedItemGroupIdTransferException],
                [1],
                ethers.utils.id('b')
            );

            expect(await super1155.balanceOf(signer1.address, shiftedItemGroupIdTransferException.add(1))).to.equal(1);
        });
        it('Reverts: ids and amounts length mismatch', async () => {
            await expect(
                super1155.safeBatchTransferFrom(signer1.address, signer2.address, [1], [1, 2], ethers.utils.id('a'))
            ).to.be.revertedWith("ERC1155: ids and amounts length mismatch");
        });
        it('Reverts: ids and amounts length mismatch', async () => {
            await expect(
                super1155.safeBatchTransferFrom(signer1.address, NULL_ADDRESS, [1], [1], ethers.utils.id('a'))
            ).to.be.revertedWith("ERC1155: transfer to the zero address");
        });
        it('Reverts: call is not owner nor approved', async () => {
            // not owner
            await expect(
                super1155.safeBatchTransferFrom(signer1.address, super1155.address, [1], [1], ethers.utils.id('a'))
            ).to.be.revertedWith("ERC1155: caller is not owner nor approved");

            // not approved
            await expect(
                super1155.safeBatchTransferFrom(signer1.address, super1155.address, [1], [1], ethers.utils.id('a'))
            ).to.be.revertedWith("ERC1155: caller is not owner nor approved");
        });
        it('transfers in batches, safely', async () => {
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 100
            });

            // configure group2 and mint both
            await super1155.connect(owner).configureGroup(itemGroupId2, {
                name: 'FungibleToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 1,
                itemData: 0,
                burnType: 1, // what if 0/none?
                burnData: 100
            });

            await expect(
                super1155.connect(owner).burn(signer1.address, shiftedItemGroupId2, 1)
            ).to.be.revertedWith("ERC1155: burn amount exceeds balance");

            // MINT
            await super1155.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId, shiftedItemGroupId2], [1, 10], ethers.utils.id('a'));

            expect(await super1155.balanceOf(deployer.address, shiftedItemGroupId)).to.equal(1);
            expect(await super1155.groupBalances(itemGroupId, deployer.address)).to.equal(1);
            expect(await super1155.totalBalances(deployer.address)).to.equal(11);
            // _mintCheck adds one for fungible items.
            expect(await super1155.balanceOf(deployer.address, shiftedItemGroupId2.add(1))).to.equal(10);
            expect(await super1155.groupBalances(itemGroupId2, deployer.address)).to.equal(10);
            expect(await super1155.totalBalances(deployer.address)).to.equal(11);

            // caller is owner
            await super1155.safeBatchTransferFrom(
                deployer.address,
                signer2.address,
                [shiftedItemGroupId, shiftedItemGroupId2],
                [1, 5],
                ethers.utils.id('a')
            );

            expect(await super1155.balanceOf(deployer.address, itemGroupId)).to.equal(0);
            expect(await super1155.groupBalances(shiftedItemGroupId, deployer.address)).to.equal(0);
            // adds one to shifted if for fungible items...
            expect(await super1155.balanceOf(deployer.address, shiftedItemGroupId2.add(1))).to.equal(5);
            expect(await super1155.groupBalances(itemGroupId2, deployer.address)).to.equal(5);
            expect(await super1155.totalBalances(deployer.address)).to.equal(5);

            // TODO: see why the ids shifted here...????
            expect(await super1155.balanceOf(signer2.address, shiftedItemGroupId)).to.equal(1);
            expect(await super1155.groupBalances(itemGroupId, signer2.address)).to.equal(1);
            // adds one to shifted if for fungible items...
            expect(await super1155.balanceOf(signer2.address, shiftedItemGroupId2.add(1))).to.equal(5);
            expect(await super1155.groupBalances(itemGroupId2, signer2.address)).to.equal(5);
            expect(await super1155.totalBalances(signer2.address)).to.equal(6);

            // caller is approved
            await super1155.setApprovalForAll(signer1.address, true);
            await super1155.connect(signer1).safeBatchTransferFrom(
                deployer.address,
                signer3.address,
                [shiftedItemGroupId2],
                [3],
                ethers.utils.id('a')
            );
            expect(await super1155.balanceOf(deployer.address, shiftedItemGroupId2.add(1))).to.equal(2);
            expect(await super1155.groupBalances(itemGroupId2, deployer.address)).to.equal(2);
            expect(await super1155.totalBalances(deployer.address)).to.equal(2);
            expect(await super1155.balanceOf(signer3.address, shiftedItemGroupId2.add(1))).to.equal(3);
            expect(await super1155.groupBalances(itemGroupId2, signer3.address)).to.equal(3);
            expect(await super1155.totalBalances(signer3.address)).to.equal(3);

            // to address is a contract
            await super1155.safeBatchTransferFrom(
                deployer.address,
                erc1155Receiver.address,
                [shiftedItemGroupId2],
                [1],
                ethers.utils.id('a')
            );
            expect(await super1155.balanceOf(deployer.address, shiftedItemGroupId2.add(1))).to.equal(1);
            expect(await super1155.groupBalances(itemGroupId2, deployer.address)).to.equal(1);
            expect(await super1155.totalBalances(deployer.address)).to.equal(1);
            expect(await super1155.balanceOf(erc1155Receiver.address, shiftedItemGroupId2.add(1))).to.equal(1);
            expect(await super1155.groupBalances(itemGroupId2, erc1155Receiver.address)).to.equal(1);
            expect(await super1155.totalBalances(erc1155Receiver.address)).to.equal(1);
        });
    });

    describe("safeTransferFrom", function () {
        it('Reverts: when then ERC1155Receiver does not return onERC1155Received.selector', async () => {
            let itemGroupIdTransferException = ethers.BigNumber.from(999);
            let shiftedItemGroupIdTransferException = itemGroupIdTransferException.shl(128);

            await super1155.connect(owner).configureGroup(itemGroupIdTransferException, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 1,
                itemData: 0,
                burnType: 1,
                burnData: 100
            });
            await super1155.connect(owner).mintBatch(
                signer1.address,
                [shiftedItemGroupIdTransferException],
                [2],
                ethers.utils.id('a')
            );

            // fungible items get .add(1)
            expect(await super1155.balanceOf(signer1.address, shiftedItemGroupIdTransferException.add(1))).to.equal(2);

            // trigger fail with arbitrary fail value (2)
            await expect(
                super1155.connect(signer1).safeTransferFrom(
                    signer1.address,
                    erc1155Receiver.address,
                    shiftedItemGroupIdTransferException,
                    2,
                    ethers.utils.id('b'))
            ).to.be.revertedWith("ERC1155: ERC1155Receiver rejected tokens");

            await super1155.connect(signer1).safeTransferFrom(
                signer1.address,
                erc1155Receiver.address,
                shiftedItemGroupIdTransferException,
                1,
                ethers.utils.id('b')
            );

            expect(await super1155.balanceOf(signer1.address, shiftedItemGroupIdTransferException.add(1))).to.equal(1);
        });
        it('Reverts: ids and amounts length mismatch', async () => {
            await expect(
                super1155.safeTransferFrom(signer1.address, NULL_ADDRESS, 1, 1, ethers.utils.id('a'))
            ).to.be.revertedWith("ERC1155: transfer to the zero address");
        });
        it('Reverts: call is not owner nor approved', async () => {
            // not owner
            await expect(
                super1155.safeTransferFrom(signer1.address, super1155.address, 1, 1, ethers.utils.id('a'))
            ).to.be.revertedWith("ERC1155: caller is not owner nor approved");

            // not approved
            await expect(
                super1155.safeTransferFrom(signer1.address, super1155.address, 1, 1, ethers.utils.id('a'))
            ).to.be.revertedWith("ERC1155: caller is not owner nor approved");
        });
        it('transfers in batches, safely', async () => {
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 100
            });

            // configure group2 and mint both
            await super1155.connect(owner).configureGroup(itemGroupId2, {
                name: 'FungibleToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 1,
                itemData: 0,
                burnType: 1, // what if 0/none?
                burnData: 100
            });

            await expect(
                super1155.connect(owner).burn(signer1.address, shiftedItemGroupId2, 1)
            ).to.be.revertedWith("ERC1155: burn amount exceeds balance");

            // MINT
            await super1155.connect(owner).mintBatch(deployer.address, [shiftedItemGroupId, shiftedItemGroupId2], [1, 10], ethers.utils.id('a'));

            expect(await super1155.balanceOf(deployer.address, shiftedItemGroupId)).to.equal(1);
            expect(await super1155.groupBalances(itemGroupId, deployer.address)).to.equal(1);
            expect(await super1155.totalBalances(deployer.address)).to.equal(11);
            // _mintCheck adds one for fungible items.
            expect(await super1155.balanceOf(deployer.address, shiftedItemGroupId2.add(1))).to.equal(10);
            expect(await super1155.groupBalances(itemGroupId2, deployer.address)).to.equal(10);
            expect(await super1155.totalBalances(deployer.address)).to.equal(11);

            // caller is owner
            await super1155.safeTransferFrom(
                deployer.address,
                signer2.address,
                shiftedItemGroupId2,
                5,
                ethers.utils.id('a')
            );

            // adds one to shifted if for fungible items...
            expect(await super1155.balanceOf(deployer.address, shiftedItemGroupId2.add(1))).to.equal(5);
            expect(await super1155.groupBalances(itemGroupId2, deployer.address)).to.equal(5);
            expect(await super1155.totalBalances(deployer.address)).to.equal(6);

            // adds one to shifted if for fungible items...
            expect(await super1155.balanceOf(signer2.address, shiftedItemGroupId2.add(1))).to.equal(5);
            expect(await super1155.groupBalances(itemGroupId2, signer2.address)).to.equal(5);
            expect(await super1155.totalBalances(signer2.address)).to.equal(5);

            // caller is approved
            await super1155.setApprovalForAll(signer1.address, true);
            await super1155.connect(signer1).safeTransferFrom(
                deployer.address,
                signer3.address,
                shiftedItemGroupId2,
                3,
                ethers.utils.id('a')
            );
            expect(await super1155.balanceOf(deployer.address, shiftedItemGroupId2.add(1))).to.equal(2);
            expect(await super1155.groupBalances(itemGroupId2, deployer.address)).to.equal(2);
            expect(await super1155.totalBalances(deployer.address)).to.equal(3);
            expect(await super1155.balanceOf(signer3.address, shiftedItemGroupId2.add(1))).to.equal(3);
            expect(await super1155.groupBalances(itemGroupId2, signer3.address)).to.equal(3);
            expect(await super1155.totalBalances(signer3.address)).to.equal(3);

            // to address is a contract
            // TODO: this
        });
    });

    describe("burn", function () {
        it('Reverts: no right', async () => {
            await expect(
                super1155.burn(signer1.address, 1, 10)
            ).to.be.revertedWith("Super1155: _msgSender does not have the right to perform that action");
        });
        it('Reverts: non-existent group', async () => {
            await expect(
                super1155.connect(owner).burn(signer1.address, 1, 10)
            ).to.be.revertedWith("Super1155: you cannot burn a non-existent item group");
        });
        it('Reverts: burn limit exceeded', async () => {
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 0
            });

            await expect(
                super1155.connect(owner).burn(signer1.address, shiftedItemGroupId, 10)
            ).to.be.revertedWith("Super1155: you may not exceed the burn limit on this item group");
        });
        it('burns', async () => {
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 100
            });

            await expect(
                super1155.connect(owner).burn(signer1.address, shiftedItemGroupId, 1)
            ).to.be.revertedWith("ERC1155: burn amount exceeds balance");

            // MINT
            await super1155.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], [1], ethers.utils.id('a'));

            expect(await super1155.balanceOf(signer1.address, shiftedItemGroupId)).to.equal(1);
            expect(await super1155.groupBalances(itemGroupId, signer1.address)).to.equal(1);
            expect(await super1155.totalBalances(signer1.address)).to.equal(1);
            expect(await super1155.circulatingSupply(shiftedItemGroupId)).to.equal(1);
            expect(await super1155.burnCount(shiftedItemGroupId)).to.equal(0);
            let genericTokensGroup = await super1155.itemGroups(itemGroupId);
            expect(genericTokensGroup[8]).to.equal(1); // circulatingSupply;
            expect(genericTokensGroup[10]).to.equal(0); // burnCount;

            // BURN
            await super1155.connect(owner).burn(signer1.address, shiftedItemGroupId, 1);

            expect(await super1155.balanceOf(signer1.address, shiftedItemGroupId)).to.equal(0);
            expect(await super1155.groupBalances(itemGroupId, signer1.address)).to.equal(0);
            expect(await super1155.totalBalances(signer1.address)).to.equal(0);
            genericTokensGroup = await super1155.itemGroups(itemGroupId);
            expect(genericTokensGroup[8]).to.equal(0); // circulatingSupply;
            expect(genericTokensGroup[10]).to.equal(1); // burnCount;
            expect(await super1155.circulatingSupply(shiftedItemGroupId)).to.equal(0);
            expect(await super1155.burnCount(shiftedItemGroupId)).to.equal(1);

            // configure group2 and mint both
            await super1155.connect(owner).configureGroup(itemGroupId2, {
                name: 'FungibleToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 1,
                itemData: 0,
                burnType: 1, // what if 0/none?
                burnData: 100
            });

            await expect(
                super1155.connect(owner).burn(signer1.address, shiftedItemGroupId2, 1)
            ).to.be.revertedWith("ERC1155: burn amount exceeds balance");

            // MINT
            await super1155.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId2], [10], ethers.utils.id('a'));

            // _mintChecker adds 1 to the shifted item id for fungible itemGroup ids.
            expect(await super1155.balanceOf(signer1.address, shiftedItemGroupId2.add(1))).to.equal(10);
            expect(await super1155.groupBalances(itemGroupId2, signer1.address)).to.equal(10);
            expect(await super1155.totalBalances(signer1.address)).to.equal(10);
            // _mintChecker adds 1 to the shifted item id for fungible itemGroup ids.
            expect(await super1155.circulatingSupply(shiftedItemGroupId2.add(1))).to.equal(10);
            expect(await super1155.burnCount(shiftedItemGroupId2)).to.equal(0);
            let fungibleTokenGroup = await super1155.itemGroups(itemGroupId2);
            expect(fungibleTokenGroup[8]).to.equal(10); // circulatingSupply;
            expect(fungibleTokenGroup[10]).to.equal(0); // burnCount;

            // BURN
            await super1155.connect(owner).burn(signer1.address, shiftedItemGroupId2, 5);

            // _burnChecker adds 1 to the shifted item id for fungible itemGroup ids.
            expect(await super1155.balanceOf(signer1.address, shiftedItemGroupId2.add(1))).to.equal(5);
            expect(await super1155.groupBalances(itemGroupId2, signer1.address)).to.equal(5);
            expect(await super1155.totalBalances(signer1.address)).to.equal(5);
            // _burnChecker adds 1 to the shifted item id for fungible itemGroup ids.
            expect(await super1155.circulatingSupply(shiftedItemGroupId2.add(1))).to.equal(5);
            // _burnChecker adds 1 to the shifted item id for fungible itemGroup ids.
            expect(await super1155.burnCount(shiftedItemGroupId2.add(1))).to.equal(5);
            fungibleTokenGroup = await super1155.itemGroups(itemGroupId2);
            expect(fungibleTokenGroup[8]).to.equal(5); // circulatingSupply;
            expect(fungibleTokenGroup[10]).to.equal(5); // burnCount;
        });
    });

    describe("burnBatch", function () {
        it('Reverts: no right', async () => {
            await expect(
                super1155.burnBatch(signer1.address, [1], [10])
            ).to.be.revertedWith("Super1155: you do not have the right to burn that item");
        });
        it('Reverts: non-existent group', async () => {
            await expect(
                super1155.connect(owner).burnBatch(signer1.address, [1], [10])
            ).to.be.revertedWith("Super1155: you cannot burn a non-existent item group");
        });
        it('Reverts: burn limit exceeded', async () => {
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 0
            });

            await expect(
                super1155.connect(owner).burnBatch(signer1.address, [shiftedItemGroupId], [10])
            ).to.be.revertedWith("Super1155: you may not exceed the burn limit on this item group");
        });
        it('burns in batches', async () => {
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 100
            });

            // configure group2 and mint both
            await super1155.connect(owner).configureGroup(itemGroupId2, {
                name: 'FungibleToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 1,
                itemData: 0,
                burnType: 1, // what if 0/none?
                burnData: 100
            });

            await expect(
                super1155.connect(owner).burnBatch(signer1.address, [shiftedItemGroupId, shiftedItemGroupId2], [1, 5])
            ).to.be.revertedWith("ERC1155: burn amount exceeds balance");

            // MINT
            await super1155.connect(owner).mintBatch(
                signer1.address, [shiftedItemGroupId, shiftedItemGroupId2], [1, 10], ethers.utils.id('a')
            );

            expect(await super1155.balanceOf(signer1.address, shiftedItemGroupId)).to.equal(1);
            expect(await super1155.groupBalances(itemGroupId, signer1.address)).to.equal(1);
            expect(await super1155.totalBalances(signer1.address)).to.equal(11);
            expect(await super1155.circulatingSupply(shiftedItemGroupId)).to.equal(1);
            expect(await super1155.burnCount(shiftedItemGroupId)).to.equal(0);
            let genericTokensGroup = await super1155.itemGroups(itemGroupId);
            expect(genericTokensGroup[8]).to.equal(1); // circulatingSupply;
            expect(genericTokensGroup[10]).to.equal(0); // burnCount;

            // _mintChecker adds 1 to the shifted item id for fungible itemGroup ids.
            expect(await super1155.balanceOf(signer1.address, shiftedItemGroupId2.add(1))).to.equal(10);
            expect(await super1155.groupBalances(itemGroupId2, signer1.address)).to.equal(10);
            expect(await super1155.totalBalances(signer1.address)).to.equal(11);
            // _mintChecker adds 1 to the shifted item id for fungible itemGroup ids.
            expect(await super1155.circulatingSupply(shiftedItemGroupId2.add(1))).to.equal(10);
            expect(await super1155.burnCount(shiftedItemGroupId2)).to.equal(0);
            let fungibleTokenGroup = await super1155.itemGroups(itemGroupId2);
            expect(fungibleTokenGroup[8]).to.equal(10); // circulatingSupply;
            expect(fungibleTokenGroup[10]).to.equal(0); // burnCount;

            // BURN
            await super1155.connect(owner).burnBatch(
                signer1.address,
                [shiftedItemGroupId, shiftedItemGroupId2],
                [1, 5]
            );

            expect(await super1155.balanceOf(signer1.address, shiftedItemGroupId)).to.equal(0);
            expect(await super1155.groupBalances(itemGroupId, signer1.address)).to.equal(0);
            expect(await super1155.totalBalances(signer1.address)).to.equal(5);
            genericTokensGroup = await super1155.itemGroups(itemGroupId);
            expect(genericTokensGroup[8]).to.equal(0); // circulatingSupply;
            expect(genericTokensGroup[10]).to.equal(1); // burnCount;
            expect(await super1155.circulatingSupply(shiftedItemGroupId)).to.equal(0);
            expect(await super1155.burnCount(shiftedItemGroupId)).to.equal(1);

            // _burnChecker adds 1 to the shifted item id for fungible itemGroup ids.
            expect(await super1155.balanceOf(signer1.address, shiftedItemGroupId2.add(1))).to.equal(5);
            expect(await super1155.groupBalances(itemGroupId2, signer1.address)).to.equal(5);
            expect(await super1155.totalBalances(signer1.address)).to.equal(5);
            // _burnChecker adds 1 to the shifted item id for fungible itemGroup ids.
            expect(await super1155.circulatingSupply(shiftedItemGroupId2.add(1))).to.equal(5);
            // _burnChecker adds 1 to the shifted item id for fungible itemGroup ids.
            expect(await super1155.burnCount(shiftedItemGroupId2.add(1))).to.equal(5);
            fungibleTokenGroup = await super1155.itemGroups(itemGroupId2);
            expect(fungibleTokenGroup[8]).to.equal(5); // circulatingSupply;
            expect(fungibleTokenGroup[10]).to.equal(5); // burnCount;
        });
    });

    describe("balanceOfBatch", function () {
        it('Reverts: accounts and ids length mismatch', async () => {
            await expect(
                super1155.balanceOfBatch([signer1.address], [2,3])
            ).to.be.revertedWith("ERC1155: accounts and ids length mismatch");
        });

        it('returns the batched balanaces of given itemGroups for the given accounts', async () => {
            let batchBalances = (await super1155.balanceOfBatch(
                [signer1.address, signer2.address], [shiftedItemGroupId, shiftedItemGroupId2])
            );
            expect(batchBalances[0]).to.equal({ "_hex": "0x00", "_isBigNumber": true });
            expect(batchBalances[1]).to.equal({ "_hex": "0x00", "_isBigNumber": true });
            expect(batchBalances.length).to.equal(2);

            // configure and mint
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });
            await super1155.connect(owner).mintBatch(
                signer1.address,
                [shiftedItemGroupId],
                [1],
                ethers.utils.id('a')
            );

            expect(await super1155.balanceOf(signer1.address, shiftedItemGroupId)).to.equal(1);
            batchBalances = (await super1155.balanceOfBatch(
                [signer1.address, signer2.address], [shiftedItemGroupId, shiftedItemGroupId2])
            );
            expect(batchBalances[0]).to.equal({ "_hex": "0x01", "_isBigNumber": true });
            expect(batchBalances[1]).to.equal({ "_hex": "0x00", "_isBigNumber": true });
            expect(batchBalances.length).to.equal(2);

            // TODO: configure group2
        });
    });

    describe("configureGroup", function () {
        it('Reverts: groupId is 0', async () => {
            await expect(
                super1155.connect(owner).configureGroup(ethers.BigNumber.from(0), {
                    name: 'FrenBurgers',
                    supplyType: 0,
                    supplyData: 20000,
                    itemType: 0,
                    itemData: 0,
                    burnType: 1,
                    burnData: 20000
                })
            ).to.be.revertedWith("Super1155: group ID 0 is invalid");
        });

        it('Reverts: sender does not have the right', async () => {
            await expect(
                super1155.configureGroup(itemGroupId, {
                    name: 'FrenBurgers',
                    supplyType: 0,
                    supplyData: 20000,
                    itemType: 0,
                    itemData: 0,
                    burnType: 1,
                    burnData: 20000
                })
            ).to.be.revertedWith("Super1155: _msgSender does not have the right to perform that action");
        });

        it('Reverts: updating a semifungible to nonsemifungible', async () => {
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'FrenBurgers',
                supplyType: 0,
                supplyData: 20000,
                itemType: 2,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });

            await expect(
                super1155.connect(owner).configureGroup(itemGroupId, {
                    name: 'FrenBurgers',
                    supplyType: 0,
                    supplyData: 20000,
                    itemType: 1,
                    itemData: 0,
                    burnType: 1,
                    burnData: 20000
                })
            ).to.be.revertedWith("Super1155: you may not alter semifungible item types");
        });

        it('Reverts: updating a fungible to semifungible, itemData must be less than circulating supply', async () => {
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'FrenBurgers',
                supplyType: 0,
                supplyData: 20000,
                itemType: 1,
                itemData: 1,
                burnType: 1,
                burnData: 20000
            });

            await super1155.connect(owner).mintBatch(signer1.address, [shiftedItemGroupId], [1], ethers.utils.id('a'));

            let frenBurgersGroup = await super1155.itemGroups(itemGroupId);
            expect(frenBurgersGroup[8]).to.equal(1); // circulatingSupply;

            await expect(
                super1155.connect(owner).configureGroup(itemGroupId, {
                    name: 'FrenBurgers',
                    supplyType: 0,
                    supplyData: 20000,
                    itemType: 2,
                    itemData: 0,
                    burnType: 1,
                    burnData: 20000
                })
            ).to.be.revertedWith("Super1155: the fungible item is not unique enough to change");
        });

        it('initializes a group and allows reconfiguration', async () => {
            await super1155.connect(owner).configureGroup(itemGroupId, {
                    name: 'FrenBurgers',
                    supplyType: 1,
                    supplyData: 20000,
                    itemType: 1,
                    itemData: 0,
                    burnType: 1,
                    burnData: 20000
            });

            let frenBurgersGroup = await super1155.itemGroups(itemGroupId);
            expect(frenBurgersGroup[0]).to.equal(true); // initialized;
            expect(frenBurgersGroup[1]).to.equal('FrenBurgers'); // name;
            expect(frenBurgersGroup[2]).to.equal(1); // supplyType;
            expect(frenBurgersGroup[3]).to.equal(20000); // supplyData;
            expect(frenBurgersGroup[4]).to.equal(1); // itemType;
            expect(frenBurgersGroup[5]).to.equal(0); // itemData;
            expect(frenBurgersGroup[6]).to.equal(1); // burnType;
            expect(frenBurgersGroup[7]).to.equal(20000); // burnData;
            expect(frenBurgersGroup[8]).to.equal(0); // circulatingSupply;
            expect(frenBurgersGroup[9]).to.equal(0); // mintCount;
            expect(frenBurgersGroup[10]).to.equal(0); // burnCount;

            // reconfiguring before minting
            // ItemType can be changed from NonFungible to Fungible when the count is <= 1
            // SupplyType can be changed from NOT Capped to anything
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'BestFrenBurgers',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });

            frenBurgersGroup = await super1155.itemGroups(itemGroupId);
            expect(frenBurgersGroup[0]).to.equal(true); // initialized;
            expect(frenBurgersGroup[1]).to.equal('BestFrenBurgers'); // name;
            expect(frenBurgersGroup[2]).to.equal(0); // supplyType;
            expect(frenBurgersGroup[3]).to.equal(20000); // supplyData;
            expect(frenBurgersGroup[4]).to.equal(0); // itemType;
            expect(frenBurgersGroup[5]).to.equal(0); // itemData;
            expect(frenBurgersGroup[6]).to.equal(1); // burnType;
            expect(frenBurgersGroup[7]).to.equal(20000); // burnData;
            expect(frenBurgersGroup[8]).to.equal(0); // circulatingSupply;
            expect(frenBurgersGroup[9]).to.equal(0); // mintCount;
            expect(frenBurgersGroup[10]).to.equal(0); // burnCount;

            // minting an item and then reconfiguring
            await super1155.connect(owner).setPermit(
                signer1.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );
            await super1155.connect(signer1).mintBatch(signer1.address, [shiftedItemGroupId], [1], ethers.utils.id('a'));
            expect(await super1155.balanceOf(signer1.address, shiftedItemGroupId)).to.equal(1);

            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'BestFrenBurgers',
                supplyType: 0,
                supplyData: 1,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });

            frenBurgersGroup = await super1155.itemGroups(itemGroupId);
            expect(frenBurgersGroup[0]).to.equal(true); // initialized;
            expect(frenBurgersGroup[1]).to.equal('BestFrenBurgers'); // name;
            expect(frenBurgersGroup[2]).to.equal(0); // supplyType;
            expect(frenBurgersGroup[3]).to.equal(1); // supplyData;
            expect(frenBurgersGroup[4]).to.equal(0); // itemType;
            expect(frenBurgersGroup[5]).to.equal(0); // itemData;
            expect(frenBurgersGroup[6]).to.equal(1); // burnType;
            expect(frenBurgersGroup[7]).to.equal(20000); // burnData;
            expect(frenBurgersGroup[8]).to.equal(1); // circulatingSupply;
            expect(frenBurgersGroup[9]).to.equal(1); // mintCount;
            expect(frenBurgersGroup[10]).to.equal(0); // burnCount;
        });
    });

    describe("mintBatch", function () {
        it('Reverts: mintBatch to address(0)', async () => {
            await expect(
                super1155.mintBatch(NULL_ADDRESS, [shiftedItemGroupId], [1], ethers.utils.id('a'))
            ).to.be.revertedWith("ERC1155: mint to the zero address");
        });

        it('Reverts: ids and amounts length mismatch', async () => {
            await expect(
                super1155.mintBatch(signer1.address, [shiftedItemGroupId], [1, 2], ethers.utils.id('a'))
            ).to.be.revertedWith("ERC1155: ids and amounts length mismatch");
        });

        it('allows mintBatch when rights and proper config', async () => {
            await super1155.connect(owner).configureGroup(itemGroupId, {
                name: 'GenericToken',
                supplyType: 0,
                supplyData: 20000,
                itemType: 0,
                itemData: 0,
                burnType: 1,
                burnData: 20000
            });

            await expect(
                super1155.connect(signer1).mintBatch(signer1.address, [shiftedItemGroupId], [10], ethers.utils.id('a'))
            ).to.be.revertedWith("Super1155: you do not have the right to mint that item");

            await super1155.connect(owner).setPermit(
                signer1.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );

            await expect(
                super1155.connect(signer1).mintBatch(signer1.address, [shiftedItemGroupId], [10], ethers.utils.id('a'))
            ).to.be.revertedWith("Super1155: you cannot mint more than a single nonfungible item");

            let originalBalance = await super1155.balanceOf(signer1.address, shiftedItemGroupId);
            let originalGroupBalance = await super1155.groupBalances(itemGroupId, signer1.address);
            let originalTotalBalance = await super1155.totalBalances(signer1.address);
            let originalCirculatingSupply = (await super1155.itemGroups(itemGroupId))[8];
            let originalMintCount = (await super1155.itemGroups(itemGroupId))[9];
            expect(originalBalance).to.equal(0);
            expect(originalGroupBalance).to.equal(0);
            expect(originalTotalBalance).to.equal(0);
            expect(originalCirculatingSupply).to.equal(0);
            await super1155.connect(signer1).mintBatch(signer1.address, [shiftedItemGroupId], [1], ethers.utils.id('a'));
            expect(await super1155.balanceOf(signer1.address, shiftedItemGroupId)).to.equal(originalBalance.add(1));
            expect((await super1155.itemGroups(itemGroupId))[8]).to.equal(originalCirculatingSupply.add(1));
            expect((await super1155.itemGroups(itemGroupId))[9]).to.equal(originalMintCount.add(1));

            expect(
                await super1155.groupBalances(itemGroupId, signer1.address)
            ).to.equal(originalGroupBalance.add(1));

            expect(
                await super1155.totalBalances(signer1.address)
            ).to.equal(originalTotalBalance.add(1));

            // configuring another ItemGroup and minting more
            await super1155.connect(owner).configureGroup(itemGroupId2, {
                name: 'FungibleFungus',
                supplyType: 0,
                supplyData: 20000,
                itemType: 1,
                itemData: 0,
                burnType: 0,
                burnData: 20000
            });

            await expect(
                super1155.connect(signer2).mintBatch(signer1.address, [shiftedItemGroupId2], [10], ethers.utils.id('a'))
            ).to.be.revertedWith("Super1155: you do not have the right to mint that item");

            await super1155.connect(owner).setPermit(
                signer2.address,
                UNIVERSAL,
                mintRight,
                ethers.constants.MaxUint256
            );

            let originalBalance2 = await super1155.balanceOf(signer1.address, shiftedItemGroupId2);
            let originalGroupBalance2 = await super1155.groupBalances(itemGroupId2, signer1.address);
            let originalTotalBalance2 = await super1155.totalBalances(signer1.address);
            let originalCirculatingSupply2 = (await super1155.itemGroups(itemGroupId2))[8];
            let originalMintCount2 = (await super1155.itemGroups(itemGroupId2))[9];
            expect(originalBalance2).to.equal(0);
            expect(originalGroupBalance2).to.equal(0);
            expect(originalTotalBalance2).to.equal(1);
            expect(originalCirculatingSupply2).to.equal(0);
            await super1155.connect(signer2).mintBatch(signer1.address, [shiftedItemGroupId2], [10], ethers.utils.id('a'));
            // Fungible items are coerced into the single group ID + index one slot.
            // TODO: ensure this is the behavior we want
            expect(await super1155.balanceOf(signer1.address, shiftedItemGroupId2.add(1))).to.equal(originalBalance2.add(10));
            expect((await super1155.itemGroups(itemGroupId2))[8]).to.equal(originalCirculatingSupply2.add(10));
            expect((await super1155.itemGroups(itemGroupId2))[9]).to.equal(originalMintCount2.add(10));
        });
    });

    describe("setMetadata", function () {
        it('Reverts: no setMetadata permissions', async () => {
            await expect(
                super1155.setMetadata(1, 'mettaDatum')
            ).to.be.revertedWith("Super1155: _msgSender does not have the right to perform that action");
        });

        it('Reverts: global lockURI', async () => {
            await super1155.connect(owner).lockURI('lockedURI');

            await expect(
                super1155.connect(owner).setMetadata(1, 'mettaDatum')
            ).to.be.revertedWith("Super1155: you cannot edit this metadata because it is frozen");
        });

        it('Reverts: lockItemGroupURI', async () => {
            await super1155.connect(owner).lockItemGroupURI('lockedURI', 1);

            await expect(
                super1155.connect(owner).setMetadata(1, 'mettaDatum')
            ).to.be.revertedWith("Super1155: you cannot edit this metadata because it is frozen");
        });

        // NOTE: allows setMetadata for groups that aren't configured ¯\_(ツ)_/¯
        it('allows setMetadata when permission', async () => {
            let currentBlockNumber = await ethers.provider.getBlockNumber();
            let block = await ethers.provider.getBlock(currentBlockNumber);
            let expiration = block.timestamp + 10000;

            await super1155.connect(owner).setPermit(
                deployer.address,
                UNIVERSAL,
                setMetadataRight,
                expiration
            );
            expect(await super1155.metadata(1)).to.equal('');
            await super1155.setMetadata(1, 'mettaDatum');
            expect(await super1155.metadata(1)).to.equal('mettaDatum');
        });
    });
});