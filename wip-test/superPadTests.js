const { expect } = require("chai");
const { BigNumber } = require("ethers");


describe("SuperPad Pools with Token to Token", function () {
	it("Should set the correct contract owner after initialize", async function () {
		const SuperPad = await ethers.getContractFactory("SuperPad");
		const superPad = await SuperPad.deploy();

		await superPad.deployed();
		const superPadInit = await superPad.initialize();

		expect(await superPad.owner()).to.equal("0x186e446fbd41dD51Ea2213dB2d3ae18B05A05ba8");
	});
	it("Should create pool successfully", async function () {
		const amount = "10000000000000000000000000000000";
		this.signers = await ethers.getSigners();
		this.minter = this.signers[0];
		this.alice = this.signers[1];
		this.bob = this.signers[2];
		this.carol = this.signers[3];

		//Deploying superpad and initializing
		const SuperPad = await ethers.getContractFactory("SuperPad");
		const superPad = await SuperPad.deploy();
		await superPad.deployed();
		await superPad.initialize();

		const erc20 = await ethers.getContractFactory("MockERC20")

		//minting tokens
		const token1 = await erc20.deploy('Gogen', 'GGN', '100000000000000000000000000000000000000')
		const token2 = await erc20.deploy('Vlad', 'VLD', '1000000000000000000000000000000000000000')

		//trying to get approve
		await token1.connect(this.minter).approve(superPad.address, amount);


		const CreatePool = await superPad.createPool(
			token1.address,
			token2.address,
			'3912500000000000000000',
			'1250000000000',
			false,
			false,
			'1125000000000000000000'
		)
		const poolObject = await superPad.pools(0)
		const poolsLength = await superPad.poolsLength()
		expect(poolsLength).to.equal(1);
		expect(poolObject.isWhiteList).to.equal(false);
		expect(poolObject.onlyHolder).to.equal(false);
	});
	it("Should revert if token transfer bigger than cap", async function () {
		const amount = "100000000000000000000000000000000000";
		this.signers = await ethers.getSigners();
		this.minter = this.signers[0];
		this.alice = this.signers[1];
		this.bob = this.signers[2];
		this.carol = this.signers[3];

		const SuperPad = await ethers.getContractFactory("SuperPad");
		const superPad = await SuperPad.deploy();
		await superPad.deployed();
		await superPad.initialize();

		const erc20 = await ethers.getContractFactory("MockERC20")
		const ERC = await erc20.deploy('Gogen', 'GGN', '60')
		const token2 = await erc20.connect(this.alice).deploy('Vlad', 'VLD', '120')

		await ERC.connect(this.minter).approve(superPad.address, amount);

		const participantBalanceBefore = await token2.connect(this.alice).balanceOf(this.alice.address)
		const participantBalanceBeforePool = BigNumber.from(participantBalanceBefore).toString()

		await token2.connect(this.alice).transfer(this.bob.address, "60")
		const secondPartBalanceBefore = await token2.connect(this.bob).balanceOf(this.bob.address)
		const secondPartBalanceBeforePool = BigNumber.from(secondPartBalanceBefore).toString()

		const minterBalanceBefore = await token2.connect(this.minter).balanceOf(this.minter.address)
		const minterBalanceBeforePool = BigNumber.from(minterBalanceBefore).toString()

		const CreatePool = await superPad.createPool(
			ERC.address,
			token2.address,
			'20',
			(10e7).toString(),
			false,
			false,
			'20'
		)
		await superPad.startPool(0);
		await token2.connect(this.alice).approve(superPad.address, amount);
		await token2.connect(this.bob).approve(superPad.address, amount);



		await superPad.connect(this.alice).swap(0, "20")

		const aliceNewInitBalance = await token2.connect(this.alice).balanceOf(this.alice.address)
		const aliceNewInitNumberBalance = BigNumber.from(aliceNewInitBalance).toString()

		const minterBalance = await token2.connect(this.minter).balanceOf(this.minter.address)
		const newBalance = BigNumber.from(minterBalance).toString()

		await expect(superPad.connect(this.bob).swap(0, "1")).to.be.reverted
	})
	it("Should transfer to contract owner correct amount of tokens if cap is getting reached during swap", async function () {
		const amount = "100000000000000000000000000000000000";
		this.signers = await ethers.getSigners();
		this.minter = this.signers[0];
		this.alice = this.signers[1];
		this.bob = this.signers[2];
		this.carol = this.signers[3];

		const SuperPad = await ethers.getContractFactory("SuperPad");
		const superPad = await SuperPad.deploy();
		await superPad.deployed();
		await superPad.initialize();

		const erc20 = await ethers.getContractFactory("MockERC20")
		const ERC = await erc20.deploy('Gogen', 'GGN', '60')
		const token2 = await erc20.connect(this.alice).deploy('Vlad', 'VLD', '120')

		await ERC.connect(this.minter).approve(superPad.address, amount);

		const participantBalanceBefore = await token2.connect(this.alice).balanceOf(this.alice.address)
		const participantBalanceBeforePool = BigNumber.from(participantBalanceBefore).toString()

		await token2.connect(this.alice).transfer(this.bob.address, "60")
		const secondPartBalanceBefore = await token2.connect(this.bob).balanceOf(this.bob.address)
		const secondPartBalanceBeforePool = BigNumber.from(secondPartBalanceBefore).toString()

		const minterBalanceBefore = await token2.connect(this.minter).balanceOf(this.minter.address)
		const minterBalanceBeforePool = BigNumber.from(minterBalanceBefore).toString()

		const CreatePool = await superPad.createPool(
			ERC.address,
			token2.address,
			'20',
			(10e7).toString(),
			false,
			false,
			'20'
		)
		await superPad.startPool(0);
		await token2.connect(this.alice).approve(superPad.address, amount);
		await token2.connect(this.bob).approve(superPad.address, amount);



		await superPad.connect(this.alice).swap(0, "19")
		superPad.connect(this.bob).swap(0, "40")


		const aliceNewInitBalance = await token2.connect(this.alice).balanceOf(this.alice.address)
		const aliceNewInitNumberBalance = BigNumber.from(aliceNewInitBalance).toString()

		const minterBalance = await token2.connect(this.minter).balanceOf(this.minter.address)
		const newBalance = BigNumber.from(minterBalance).toString()

		expect(newBalance).to.equal('20')
	})
	it("Should successfuly swap tokens without whiteList or onlyHolder", async function () {
		const amount = "100000000000000000000000000000000000";
		this.signers = await ethers.getSigners();
		this.minter = this.signers[0];
		this.alice = this.signers[1];
		this.bob = this.signers[2];
		this.carol = this.signers[3];

		const SuperPad = await ethers.getContractFactory("SuperPad");
		const superPad = await SuperPad.deploy();
		await superPad.deployed();
		await superPad.initialize();

		const erc20 = await ethers.getContractFactory("MockERC20")
		const ERC = await erc20.deploy('Gogen', 'GGN', '3912500000000000000000')
		const token2 = await erc20.connect(this.alice).deploy('Vlad', 'VLD', '100000000')
		await ERC.connect(this.minter).approve(superPad.address, amount);
		const participantBalanceBefore = await token2.connect(this.alice).balanceOf(this.alice.address)
		const participantBalanceBeforePool = BigNumber.from(participantBalanceBefore).toString()

		const CreatePool = await superPad.createPool(
			ERC.address,
			token2.address,
			'20',
			"1",
			false,
			false,
			'20'
		)
		await superPad.startPool(0);
		await token2.connect(this.alice).approve(superPad.address, amount);

		await superPad.connect(this.alice).swap(0, "100000000")
		const aliceNewInitBalance = await token2.connect(this.alice).balanceOf(this.alice.address)
		const aliceNewInitNumberBalance = BigNumber.from(aliceNewInitBalance).toString()
		const minterBalance = await token2.connect(this.minter).balanceOf(this.minter.address)
		const newBalance = BigNumber.from(minterBalance).toString()
		expect(newBalance).to.equal(participantBalanceBeforePool)
		expect(aliceNewInitNumberBalance).to.equal('0')
	})
	it("Should let whitelist wallets to swap, and NOT let non-whitelist wallets to swap, if pool is whitelisted", async function () {
		const amount = "100000000000000000000000000000000000";
		this.signers = await ethers.getSigners();
		this.minter = this.signers[0];
		this.alice = this.signers[1];
		this.bob = this.signers[2];
		this.carol = this.signers[3];

		const SuperPad = await ethers.getContractFactory("SuperPad");
		const superPad = await SuperPad.deploy();
		await superPad.deployed();
		await superPad.initialize();

		const erc20 = await ethers.getContractFactory("MockERC20")
		const ERC = await erc20.deploy('Gogen', 'GGN', '60')
		const token2 = await erc20.connect(this.alice).deploy('Vlad', 'VLD', '120')

		await ERC.connect(this.minter).approve(superPad.address, amount);

		const participantBalanceBefore = await token2.connect(this.alice).balanceOf(this.alice.address)
		const participantBalanceBeforePool = BigNumber.from(participantBalanceBefore).toString()

		await token2.connect(this.alice).transfer(this.bob.address, "60")
		const secondPartBalanceBefore = await token2.connect(this.bob).balanceOf(this.bob.address)
		const secondPartBalanceBeforePool = BigNumber.from(secondPartBalanceBefore).toString()

		const minterBalanceBefore = await token2.connect(this.minter).balanceOf(this.minter.address)
		const minterBalanceBeforePool = BigNumber.from(minterBalanceBefore).toString()

		const CreatePool = await superPad.createPool(
			ERC.address,
			token2.address,
			'20',
			(10e7).toString(),
			true,
			false,
			'20'
		)
		await superPad.startPool(0);
		await token2.connect(this.alice).approve(superPad.address, amount);

		await superPad.addWhiteList(0, [this.alice.address], ["20"])

		await superPad.connect(this.alice).swap(0, "19")

		const aliceNewInitBalance = await token2.connect(this.alice).balanceOf(this.alice.address)
		const aliceNewInitNumberBalance = BigNumber.from(aliceNewInitBalance).toString()

		const minterBalance = await token2.connect(this.minter).balanceOf(this.minter.address)
		const newBalance = BigNumber.from(minterBalance).toString()

		expect(newBalance).to.equal('19')
		await expect(superPad.connect(this.bob).swap(0, "1")).to.be.reverted
});
it("Should let Super Token holders to swap, and NOT let users without Super Token to swap, if pool is onlyHolder", async function () {
	const amount = "100000000000000000000000000000000000";
	this.signers = await ethers.getSigners();
	this.minter = this.signers[0];
	this.alice = this.signers[1];
	this.bob = this.signers[2];
	this.carol = this.signers[3];

	const SuperPad = await ethers.getContractFactory("SuperPad");
	const superPad = await SuperPad.deploy();
	await superPad.deployed();
	await superPad.initialize();

	const erc20 = await ethers.getContractFactory("MockERC20")
	const ERC = await erc20.deploy('Gogen', 'GGN', '60')
	const token2 = await erc20.connect(this.alice).deploy('Vlad', 'VLD', '120')
	const superT = await erc20.connect(this.alice).deploy('Super', 'SPR', '500')

	await ERC.connect(this.minter).approve(superPad.address, amount);

	const participantBalanceBefore = await token2.connect(this.alice).balanceOf(this.alice.address)
	const participantBalanceBeforePool = BigNumber.from(participantBalanceBefore).toString()

	await token2.connect(this.alice).transfer(this.bob.address, "60")
	const secondPartBalanceBefore = await token2.connect(this.bob).balanceOf(this.bob.address)
	const secondPartBalanceBeforePool = BigNumber.from(secondPartBalanceBefore).toString()

	const minterBalanceBefore = await token2.connect(this.minter).balanceOf(this.minter.address)
	const minterBalanceBeforePool = BigNumber.from(minterBalanceBefore).toString()

	const CreatePool = await superPad.createPool(
		ERC.address,
		token2.address,
		'20',
		(10e7).toString(),
		false,
		true,
		'20'
	)
	await superPad.startPool(0);
	await token2.connect(this.alice).approve(superPad.address, amount);
	//await token2.connect(this.bob).approve(superPad.address, amount);

	await superPad.setSuperToken(superT.address);
	await superPad.setMinSuper("1")

	await superPad.connect(this.alice).swap(0, "19")
	//superPad.connect(this.bob).swap(0,"1")


	const aliceNewInitBalance = await token2.connect(this.alice).balanceOf(this.alice.address)
	const aliceNewInitNumberBalance = BigNumber.from(aliceNewInitBalance).toString()

	const minterBalance = await token2.connect(this.minter).balanceOf(this.minter.address)
	const newBalance = BigNumber.from(minterBalance).toString()

	expect(newBalance).to.equal('19')
	await expect(superPad.connect(this.bob).swap(0,"1")).to.be.reverted
});
it("Should claim correct amount of tokens", async function () {
const amount = "100000000000000000000000000000000000";
		this.signers = await ethers.getSigners();
		this.minter = this.signers[0];
		this.alice = this.signers[1];
		this.bob = this.signers[2];
		this.carol = this.signers[3];

		const SuperPad = await ethers.getContractFactory("SuperPad");
		const superPad = await SuperPad.deploy();
		await superPad.deployed();
		await superPad.initialize();

		const erc20 = await ethers.getContractFactory("MockERC20")
		const ERC = await erc20.deploy('Gogen', 'GGN', '60')
		const token2 = await erc20.connect(this.alice).deploy('Vlad', 'VLD', '120')

		await ERC.connect(this.minter).approve(superPad.address, amount);

		const participantBalanceBefore = await token2.connect(this.alice).balanceOf(this.alice.address)
		const participantBalanceBeforePool = BigNumber.from(participantBalanceBefore).toString()

		await token2.connect(this.alice).transfer(this.bob.address, "60")
		const secondPartBalanceBefore = await token2.connect(this.bob).balanceOf(this.bob.address)
		const secondPartBalanceBeforePool = BigNumber.from(secondPartBalanceBefore).toString()

		const minterBalanceBefore = await token2.connect(this.minter).balanceOf(this.minter.address)
		const minterBalanceBeforePool = BigNumber.from(minterBalanceBefore).toString()

		const CreatePool = await superPad.createPool(
			ERC.address,
			token2.address,
			'20',
			(10e7).toString(),
			false,
			false,
			'20'
		)
		await superPad.startPool(0);
		await token2.connect(this.alice).approve(superPad.address, amount);
		await token2.connect(this.bob).approve(superPad.address, amount);



		await superPad.connect(this.alice).swap(0, "19")
		superPad.connect(this.bob).swap(0, "40")


		const aliceNewInitBalance = await token2.connect(this.alice).balanceOf(this.alice.address)
		const aliceNewInitNumberBalance = BigNumber.from(aliceNewInitBalance).toString()

		const minterBalance = await token2.connect(this.minter).balanceOf(this.minter.address)
		const newBalance = BigNumber.from(minterBalance).toString()

		await superPad.finishPool('0')

		await superPad.connect(this.alice).claim(0)
		await superPad.connect(this.bob).claim(0)

		const swapToken1 = await ERC.connect(this.alice).balanceOf(this.alice.address)
		const swapToken2 = await ERC.connect(this.bob).balanceOf(this.bob.address)

		expect(BigNumber.from(swapToken1).toString()).to.equal('19')
		expect(BigNumber.from(swapToken2).toString()).to.equal('1')
	})
	it("Should not let claim tokens if pool isn't closed", async function () {
		const amount = "100000000000000000000000000000000000";
				this.signers = await ethers.getSigners();
				this.minter = this.signers[0];
				this.alice = this.signers[1];
				this.bob = this.signers[2];
				this.carol = this.signers[3];

				const SuperPad = await ethers.getContractFactory("SuperPad");
				const superPad = await SuperPad.deploy();
				await superPad.deployed();
				await superPad.initialize();

				const erc20 = await ethers.getContractFactory("MockERC20")
				const ERC = await erc20.deploy('Gogen', 'GGN', '60')
				const token2 = await erc20.connect(this.alice).deploy('Vlad', 'VLD', '120')

				await ERC.connect(this.minter).approve(superPad.address, amount);

				const participantBalanceBefore = await token2.connect(this.alice).balanceOf(this.alice.address)
				const participantBalanceBeforePool = BigNumber.from(participantBalanceBefore).toString()

				await token2.connect(this.alice).transfer(this.bob.address, "60")
				const secondPartBalanceBefore = await token2.connect(this.bob).balanceOf(this.bob.address)
				const secondPartBalanceBeforePool = BigNumber.from(secondPartBalanceBefore).toString()

				const minterBalanceBefore = await token2.connect(this.minter).balanceOf(this.minter.address)
				const minterBalanceBeforePool = BigNumber.from(minterBalanceBefore).toString()

				const CreatePool = await superPad.createPool(
					ERC.address,
					token2.address,
					'20',
					(10e7).toString(),
					false,
					false,
					'20'
				)
				await superPad.startPool(0);
				await token2.connect(this.alice).approve(superPad.address, amount);
				await token2.connect(this.bob).approve(superPad.address, amount);



				await superPad.connect(this.alice).swap(0, "19")
				superPad.connect(this.bob).swap(0, "40")


				const aliceNewInitBalance = await token2.connect(this.alice).balanceOf(this.alice.address)
				const aliceNewInitNumberBalance = BigNumber.from(aliceNewInitBalance).toString()

				const minterBalance = await token2.connect(this.minter).balanceOf(this.minter.address)
				const newBalance = BigNumber.from(minterBalance).toString()

				await expect(superPad.connect(this.alice).claim(0)).to.be.reverted
				await expect(superPad.connect(this.bob).claim(0)).to.be.reverted
			})
			it("Should not let claim tokens if user never participated in the pool", async function () {
				const amount = "100000000000000000000000000000000000";
						this.signers = await ethers.getSigners();
						this.minter = this.signers[0];
						this.alice = this.signers[1];
						this.bob = this.signers[2];
						this.carol = this.signers[3];

						const SuperPad = await ethers.getContractFactory("SuperPad");
						const superPad = await SuperPad.deploy();
						await superPad.deployed();
						await superPad.initialize();

						const erc20 = await ethers.getContractFactory("MockERC20")
						const ERC = await erc20.deploy('Gogen', 'GGN', '60')
						const token2 = await erc20.connect(this.alice).deploy('Vlad', 'VLD', '120')

						await ERC.connect(this.minter).approve(superPad.address, amount);

						const participantBalanceBefore = await token2.connect(this.alice).balanceOf(this.alice.address)
						const participantBalanceBeforePool = BigNumber.from(participantBalanceBefore).toString()

						await token2.connect(this.alice).transfer(this.bob.address, "60")
						const secondPartBalanceBefore = await token2.connect(this.bob).balanceOf(this.bob.address)
						const secondPartBalanceBeforePool = BigNumber.from(secondPartBalanceBefore).toString()

						const minterBalanceBefore = await token2.connect(this.minter).balanceOf(this.minter.address)
						const minterBalanceBeforePool = BigNumber.from(minterBalanceBefore).toString()

						const CreatePool = await superPad.createPool(
							ERC.address,
							token2.address,
							'20',
							(10e7).toString(),
							false,
							false,
							'20'
						)
						await superPad.startPool(0);
						await token2.connect(this.alice).approve(superPad.address, amount);
						await token2.connect(this.bob).approve(superPad.address, amount);



						await superPad.connect(this.alice).swap(0, "19")

						const aliceNewInitBalance = await token2.connect(this.alice).balanceOf(this.alice.address)
						const aliceNewInitNumberBalance = BigNumber.from(aliceNewInitBalance).toString()

						const minterBalance = await token2.connect(this.minter).balanceOf(this.minter.address)
						const newBalance = BigNumber.from(minterBalance).toString()

						await superPad.finishPool('0')

						await superPad.connect(this.alice).claim(0)

						const swapToken1 = await ERC.connect(this.alice).balanceOf(this.alice.address)

						expect(BigNumber.from(swapToken1).toString()).to.equal('19')
						await expect(superPad.connect(this.bob).claim(0)).to.be.reverted
					})
});

describe("SuperPad Pools with ETH to Token", function () {
	it("Should send correct amount of ether during swap", async function () {
		const amount = "100000000000000000000000000000000000";
		this.signers = await ethers.getSigners();
		this.minter = this.signers[0];
		this.alice = this.signers[1];
		this.bob = this.signers[2];
		this.carol = this.signers[3];

		const SuperPad = await ethers.getContractFactory("SuperPad");
		const superPad = await SuperPad.deploy();
		await superPad.deployed();
		await superPad.initialize();

		const erc20 = await ethers.getContractFactory("MockERC20")
		const token2 = await erc20.connect(this.minter).deploy('Vlad', 'VLD', '3912500000000000000000')

		await token2.connect(this.minter).approve(superPad.address, amount);

		const participantBalanceBefore = await token2.connect(this.alice).balanceOf(this.alice.address)
		const participantBalanceBeforePool = BigNumber.from(participantBalanceBefore).toString()

		const secondPartBalanceBefore = await token2.connect(this.bob).balanceOf(this.bob.address)
		const secondPartBalanceBeforePool = BigNumber.from(secondPartBalanceBefore).toString()

		const minterBalanceBefore = await token2.connect(this.minter).balanceOf(this.minter.address)
		const minterBalanceBeforePool = BigNumber.from(minterBalanceBefore).toString()

		const CreatePool = await superPad.createPool(
			token2.address,
			"0x0000000000000000000000000000000000000000",
			'3912500000000000000000',
			'125000000000',
			false,
			false,
			'1125000000000000000000'
		)
		await superPad.startPool(0);
		await token2.connect(this.alice).approve(superPad.address, amount);
		await token2.connect(this.bob).approve(superPad.address, amount);

		const aliceNewInitBalance = await token2.connect(this.alice).balanceOf(this.alice.address)
		const aliceNewInitNumberBalance = BigNumber.from(aliceNewInitBalance).toString()

		await expect(() => superPad.connect(this.alice).swap(0, '1125000000000000000000', {value: "1125000000000000000000"})).to.changeEtherBalance(this.minter, (1125000000000000000000/125000000000*10e7).toString())
	});

	it("Should transfer back extra ether if pool cap was reached during the transaction", async function () {
		const amount = "100000000000000000000000000000000000";
		this.signers = await ethers.getSigners();
		this.minter = this.signers[0];
		this.alice = this.signers[1];
		this.bob = this.signers[2];
		this.carol = this.signers[3];

		const SuperPad = await ethers.getContractFactory("SuperPad");
		const superPad = await SuperPad.deploy();
		await superPad.deployed();
		await superPad.initialize();

		const erc20 = await ethers.getContractFactory("MockERC20")
		const token2 = await erc20.connect(this.minter).deploy('Vlad', 'VLD', '3912500000000000000000')

		await token2.connect(this.minter).approve(superPad.address, amount);

		const CreatePool = await superPad.createPool(
			token2.address,
			"0x0000000000000000000000000000000000000000",
			'2125000000000000000000',
			'125000000000',
			false,
			false,
			'1125000000000000000000'
		)
		await superPad.startPool(0);
		await token2.connect(this.alice).approve(superPad.address, amount);
		await token2.connect(this.bob).approve(superPad.address, amount);

		await superPad.connect(this.alice).swap(0, '1125000000000000000000', {value: "1125000000000000000000"})
		await expect(() => superPad.connect(this.bob).swap(0, '1125000000000000000000', {value: "1125000000000000000000"}))
		.to.changeEtherBalance(this.bob, (-1000000000000000000000/125000000000*10e7).toString())
		//superPad.connect(this.bob).swap(0, '1125000000000000000000', {value: "1125000000000000000000"})
	})
})
