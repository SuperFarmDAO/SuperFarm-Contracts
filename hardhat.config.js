'use strict';

// Configure environment variables.
require('dotenv').config();

// Include Babel so that we may use some newer JavaScript syntax.
require('@babel/register');

// Include Waffle with Ethers as our preferred engine for testing.
require('@nomiclabs/hardhat-waffle');

// Include the detailed gas usage reporter for tests.
require('hardhat-gas-reporter');

// Include the contract size output display.
require('hardhat-contract-sizer');

// Include coverage checking for unit tests.
require('solidity-coverage');

// Include the Etherscan contract verifier.
require('@nomiclabs/hardhat-etherscan');

// Retrieve sensitive node and private key details from environment variables.
const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID;
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

// Export a configuration for Hardhat to use when working with our contracts.
module.exports = {
	solidity: {
		compilers: [
			{
				version: '0.4.16'
			},
			{
				version: '0.6.12',
				settings: {
					optimizer: {
						enabled: true,
						runs: 0
					}
				}
			},
			{
				version: '0.7.3',
				settings: {
					optimizer: {
						enabled: true
					}
				}
			},
			{
				version: '0.7.6',
				settings: {
					optimizer: {
						enabled: true,
						runs: 0
					}
				}
			}
		]
	},
	networks: {
		hardhat: {
			forking: {
				url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
				blockNumber: 12883802
			}
		},
		mainnet: {
			url: `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`,
			accounts: [ `0x${DEPLOYER_PRIVATE_KEY}` ]
		},
		rinkeby: {
			url: `https://rinkeby.infura.io/v3/${INFURA_PROJECT_ID}`,
			accounts: [ `0x${DEPLOYER_PRIVATE_KEY}` ]
		},
		ropsten: {
			url: `https://ropsten.infura.io/v3/${INFURA_PROJECT_ID}`,
			accounts: [ `0x${DEPLOYER_PRIVATE_KEY}` ]
		},
		kovan: {
			url: `https://kovan.infura.io/v3/${INFURA_PROJECT_ID}`,
			accounts: [ `0x${DEPLOYER_PRIVATE_KEY}` ]
		},
		goerli: {
			url: `https://goerli.infura.io/v3/${INFURA_PROJECT_ID}`,
			accounts: [ `0x${DEPLOYER_PRIVATE_KEY}` ]
		}
	},
	etherscan: {
		apiKey: process.env.ETHERSCAN_API_KEY
	},
	mocha: {
		grep: '^(?!.*; using Ganache).*'
	}
};
