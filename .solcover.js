// Exclude the legacy compiler MultiSigWallet.sol file from instrumentation.
module.exports = {
  skipFiles: ["MultiSigWallet.sol"],
  // configureYulOptimizer: true,
  // solcOptimizerDetails: {
  //   peephole: false,
  //   // inliner: false,
  //   jumpdestRemover: false,
  //   orderLiterals: true, // <-- TRUE! Stack too deep when false
  //   deduplicate: false,
  //   cse: false,
  //   constantOptimizer: false,
  //   yul: false,
  // },
};
