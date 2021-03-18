// Configure environment variables.
require('dotenv').config();

// Include Babel so that we may use some newer JavaScript syntax.
require('@babel/register');

// Include Waffle with Ethers as our preferred engine for testing.
require('@nomiclabs/hardhat-waffle');

// Include the Ganache plugin to automatically start Ganache for some tests.
require('@nomiclabs/hardhat-ganache');

// Include the detailed gas usage reporter for tests.
require('hardhat-gas-reporter');

// Include the contract size output display.
require('hardhat-contract-sizer');

// Include coverage checking for unit tests.
require('solidity-coverage');

// Export a configuration for Hardhat to use when working with our contracts.
module.exports = {
	solidity: {
		compilers: [
			{
				version: '0.4.15'
			},
			{
				version: '0.6.12',
				settings: {
					optimizer: {
						enabled: true
					}
				}
			}
		]
	},

	// Target exclusively test cases that are tagged as using Ganache.
	mocha: {
		grep: '; using Ganache'
	}
};
