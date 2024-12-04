'use strict';

// Imports.
const hre = require('hardhat');
const fs = require('fs').promises;
const ethers = hre.ethers;

async function appendStringToFile(filename, string) {
    try {
        await fs.appendFile(filename, string, { flag: 'a' });
    } catch (error) {
        console.error('Error appending to file:', error);
    }
}

async function getEvents (_contract, _firstBlock, _lastBlock, _eventName) {
  let ranges = [ [ _firstBlock, _lastBlock ] ];
  let events = [];
  while (ranges.length > 0) {
    let [ start, end ] = ranges.shift();
    console.log(start, end);
    try {
      const subEvents = await _contract.queryFilter(_eventName, start, end);
      events = events.concat(subEvents);
    } catch (error) {
      const midBlock = start + Math.floor((end - start) / 2);
      ranges.push([start, midBlock], [midBlock + 1, end]);
    }
  }
  return events;
}

// Audit the claims of the particular user.
async function main () {
	const signers = await ethers.getSigners();
	const addresses = await Promise.all(signers.map(async signer => signer.getAddress()));
	const deployer = { provider: signers[0].provider, signer: signers[0], address: addresses[0] };

  // Get the current block.
	let currentBlockNumber = (await deployer.provider.getBlock()).number;
  console.log(`Snapshot at block ${currentBlockNumber}...`)

	// Get old stakers in the gem farm.
	let farm = new ethers.Contract(
    '0xf35A92585CeEE7251388e14F268D9065F5206207',
    [
{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"contract IERC20","name":"token","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Deposit","type":"event"},
{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"contract IERC20","name":"token","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Withdraw","type":"event"},
{"inputs":[{"internalType":"contract IERC20","name":"_token","type":"address"},{"internalType":"address","name":"_user","type":"address"}],"name":"getPendingTokens","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
{"inputs":[{"internalType":"contract IERC20","name":"_token","type":"address"},{"internalType":"address","name":"_user","type":"address"}],"name":"getPendingTokens","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
    ],
    deployer.signer
  );
  let depositEvents = await getEvents(farm, 0, currentBlockNumber, 'Deposit');
  let users = { };
  let lpUsers = { };
  for (let depositEvent of depositEvents) {
    const user = depositEvent.args.user;
    const token = depositEvent.args.token;
    const amount = depositEvent.args.amount;
    if (token === '0xe53EC727dbDEB9E2d5456c3be40cFF031AB40A55' && amount.gt(0)) {
      if (!users.hasOwnProperty(user)) {
        users[user] = amount;
      } else {
        users[user] = users[user].add(amount);
      }
    }
    if (token === '0x25647E01Bd0967C1B9599FA3521939871D1d0888' && amount.gt(0)) {
      if (!lpUsers.hasOwnProperty(user)) {
        lpUsers[user] = amount;
      } else {
        lpUsers[user] = lpUsers[user].add(amount);
      }
    }
  }
  
  console.log('Total Depositors', Object.keys(users).length);
  console.log('Total LP Depositors', Object.keys(lpUsers).length);

  let withdrawEvents = await getEvents(farm, 0, currentBlockNumber, 'Withdraw');
  for (let withdrawEvent of withdrawEvents) {
    const user = withdrawEvent.args.user;
    const token = withdrawEvent.args.token;
    const amount = withdrawEvent.args.amount;
    if (token === '0xe53EC727dbDEB9E2d5456c3be40cFF031AB40A55' && amount.gt(0)) {
      if (!users.hasOwnProperty(user)) {
        console.log('weird user', user)
      } else {
        users[user] = users[user].sub(amount);
        if (users[user].eq(0)) {
          delete users[user];
        }
      }
    }
    if (token === '0x25647E01Bd0967C1B9599FA3521939871D1d0888' && amount.gt(0)) {
      if (!lpUsers.hasOwnProperty(user)) {
        console.log('weird user', user)
      } else {
        lpUsers[user] = lpUsers[user].sub(amount);
        if (lpUsers[user].eq(0)) {
          delete lpUsers[user];
        }
      }
    }
  }

  console.log('Remaining Depositors', Object.keys(users).length);
  console.log('Remaining LP Depositors', Object.keys(lpUsers).length);

  let missingPrincipal = ethers.BigNumber.from(0);
  for (let user of Object.keys(users)) {
    missingPrincipal = missingPrincipal.add(users[user]);
  }
  console.log('Principal', missingPrincipal.toString())

  let pendingLPRewards = ethers.BigNumber.from(0);
  let lpTotal = ethers.BigNumber.from(0);
  for (let user of Object.keys(lpUsers)) {
    let pendingTokens = await farm.getPendingTokens('0x25647E01Bd0967C1B9599FA3521939871D1d0888', user);
    pendingLPRewards = pendingLPRewards.add(pendingTokens);
    lpTotal = lpTotal.add(lpUsers[user]);
  }
  console.log('LP Total', lpTotal.toString());
  console.log('Pending LP Rewards', pendingLPRewards.toString());
}

// Execute the script and catch errors.
main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
