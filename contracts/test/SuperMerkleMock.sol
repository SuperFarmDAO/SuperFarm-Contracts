// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "../libraries/merkle/SuperMerkleAccess.sol";

/**
  @title A merkle tree based access control.
  @author Qazawat Zirak

  This contract replaces the traditional whitelists for access control
  by using a merkle tree, storing the root on-chain instead of all the 
  addressses. The merkle tree alongside the whitelist is kept off-chain 
  for lookups and creating proofs to validate an access.
  This code is inspired by and modified from incredible work of RicMoo.
  https://github.com/ricmoo/ethers-airdrop/blob/master/AirDropToken.sol

  October 12th, 2021.
*/
contract SuperMerkleAccessMock is SuperMerkleAccess {}