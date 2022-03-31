// Exclude the legacy compiler MultiSigWallet.sol file from instrumentation.
module.exports = {
  skipFiles: [ 'MultiSigWallet.sol' ],
  configureYulOptimizer: true 
};
