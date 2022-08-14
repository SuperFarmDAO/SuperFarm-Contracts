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
				version: '0.4.24'
			},
			{
				version: '0.6.6',
				settings: {
					optimizer: {
						enabled: true
					}
				}
			},
			{
				version: '0.6.12',
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
						enabled: true
					}
				}
			},
			{
				version: '0.8.7',
				settings: {
					optimizer: {
						enabled: true
					}
				}
			},
			{
				version: '0.8.8',
				settings: {
					optimizer: {
						enabled: true
					}
				}
			},
			{
				version: '0.8.15',
				settings: {
					optimizer: {
						enabled: true
					}
				}
			},
			{
				version: '0.8.16',
				settings: {
					optimizer: {
						enabled: true
					}
				}
			}
		]
	},
	networks: {
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
		},
		bsc_testnet: {
			url: "https://data-seed-prebsc-1-s1.binance.org:8545",
			chainId: 97,
			gasPrice: "auto",
			accounts: [ `0x${DEPLOYER_PRIVATE_KEY}` ]
		},
		bsc_mainnet: {
			url: "https://bsc-dataseed.binance.org/",
			chainId: 56,
			gasPrice: "auto",
			accounts: [ `0x${DEPLOYER_PRIVATE_KEY}` ]
		},
		polygon: {
			url: "https://polygon-rpc.com",
			chainId: 137,
			gasPrice: "auto",
			accounts: [ `0x${DEPLOYER_PRIVATE_KEY}` ]
		},
		mumbai: {
			url: "https://rpc-mumbai.maticvigil.com",
			chainId: 80001,
			gasPrice: "auto",
			accounts: [ `0x${DEPLOYER_PRIVATE_KEY}` ]
		},
		avalanche: {
			url: "https://api.avax.network/ext/bc/C/rpc",
			chainId: 43114,
			gasPrice: "auto",
			accounts: [ `0x${DEPLOYER_PRIVATE_KEY}` ]
		},
		avalanche_fuji: {
			url: "https://api.avax-test.network/ext/bc/C/rpc",
			chainId: 43113,
			gasPrice: "auto",
			accounts: [ `0x${DEPLOYER_PRIVATE_KEY}` ]
		},
		fantom_testnet:{
			url: "https://rpc.testnet.fantom.network/",
			chainId: 4002,
			gasPrice: "auto",
			accounts: [ `0x${DEPLOYER_PRIVATE_KEY}` ]
		},
		fantom:{
			url: "https://rpc.ftm.tools/",
			chainId: 250,
			gasPrice: "auto",
			accounts: [ `0x${DEPLOYER_PRIVATE_KEY}` ]
		}
	},
	etherscan: {
		apiKey: process.env.ETHERSCAN_API_KEY
	},
	mocha: {
		grep: '^(?!.*; using Ganache).*'
	},
	gasReporter: {
    currency: 'USD',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false
  }
};
