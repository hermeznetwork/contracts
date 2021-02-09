require("dotenv").config();

const bre = require("hardhat");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const { BigNumber } = require("ethers");
const {
  calculateInputMaxTxLevels,
  AddToken,
} = require("../../test/hermez/helpers/helpers");

async function main() {
  // compìle contracts
  await bre.run("compile");

  let hardhatTokenERC20Mock;
  let hardhatHermez;
  let hardhatWithdrawalDelayer;
  let hardhatHEZ;
  let owner;
  let id1;
  let id2;
  let addrs;
  let hermezGovernanceAddress;

  const tokenInitialAmount = ethers.utils.parseEther("100000");
  const maxTx = 512;
  const nLevels = 32;

  const forgeL1L2BatchTimeout = 10;
  let chainID;
  const feeAddToken = 10;
  const withdrawalDelay = 60 * 60 * 24 * 7 * 2; // 2 weeks
  [
    owner,
    governance,
    id1,
    id2,
    ...addrs
  ] = await ethers.getSigners();

  hermezGovernanceAddress = governance.getAddress();

  // load default account 0 from hardhatEvm
  // Account #0: 0xc783df8a850f42e7f7e57013759c285caa701eb6 (10000 ETH)
  // Private Key: 0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122
  const privateKeyhardhat =
    "0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122";
  const ownerWallet = new ethers.Wallet(
    privateKeyhardhat,
    ethers.provider
  );

  // factory helpers
  const TokenERC20Mock = await ethers.getContractFactory("ERC20Mock");
  const TokenERC20PermitMock = await ethers.getContractFactory("ERC20PermitMock");

  const VerifierRollupHelper = await ethers.getContractFactory(
    "VerifierRollupHelper"
  );
  const VerifierWithdrawHelper = await ethers.getContractFactory(
    "VerifierWithdrawHelper"
  );

  const HermezAuctionTest = await ethers.getContractFactory(
    "HermezAuctionTest"
  );
  const WithdrawalDelayer = await ethers.getContractFactory(
    "WithdrawalDelayer"
  );
  const Poseidon2Elements = new ethers.ContractFactory(
    poseidonUnit.generateABI(2),
    poseidonUnit.createCode(2),
    owner
  );

  const Poseidon3Elements = new ethers.ContractFactory(
    poseidonUnit.generateABI(3),
    poseidonUnit.createCode(3),
    owner
  );

  const Poseidon4Elements = new ethers.ContractFactory(
    poseidonUnit.generateABI(4),
    poseidonUnit.createCode(4),
    owner
  );
  const hardhatPoseidon2Elements = await Poseidon2Elements.deploy();
  const hardhatPoseidon3Elements = await Poseidon3Elements.deploy();
  const hardhatPoseidon4Elements = await Poseidon4Elements.deploy();

  const poseidonAddr2 = hardhatPoseidon2Elements.address;
  const poseidonAddr3 = hardhatPoseidon3Elements.address;
  const poseidonAddr4 = hardhatPoseidon4Elements.address;

  // factory hermez
  const Hermez = await ethers.getContractFactory("HermezTest");

  // deploy tokens
  hardhatTokenERC20Mock = await TokenERC20Mock.deploy(
    "tokenname",
    "TKN",
    await owner.getAddress(),
    tokenInitialAmount
  );

  hardhatHEZ = await TokenERC20PermitMock.deploy(
    "tokenname",
    "TKN",
    await owner.getAddress(),
    tokenInitialAmount
  );

  // deploy helpers
  let hardhatVerifierRollupHelper = await VerifierRollupHelper.deploy();
  let hardhatVerifierWithdrawHelper = await VerifierWithdrawHelper.deploy();

  let hardhatHermezAuctionTest = await HermezAuctionTest.deploy();

  // deploy hermez
  hardhatHermez = await Hermez.deploy();
  await hardhatHermez.deployed();

  const delay = parseInt(process.env.DELAY ? process.env.DELAY : 60);

  buidlerWithdrawalDelayer = await WithdrawalDelayer.deploy(
    delay,
    hardhatHermez.address,
    hermezGovernanceAddress,
    hermezGovernanceAddress
  );
  await buidlerWithdrawalDelayer.deployed();

  // initialize hermez
  await hardhatHermez.initializeHermez(
    [hardhatVerifierRollupHelper.address],
    calculateInputMaxTxLevels([maxTx], [nLevels]),
    hardhatVerifierWithdrawHelper.address,
    hardhatHermezAuctionTest.address,
    hardhatHEZ.address,
    forgeL1L2BatchTimeout,
    feeAddToken,
    poseidonAddr2,
    poseidonAddr3,
    poseidonAddr4,
    hermezGovernanceAddress,
    withdrawalDelay,
    hardhatWithdrawalDelayer.address
  );

  // add tokens

  // wait until is deployed
  await hardhatTokenERC20Mock.deployed();
  await hardhatHEZ.deployed();

  await AddToken(
    hardhatHermez,
    hardhatTokenERC20Mock,
    hardhatHEZ,
    ownerWallet,
    feeAddToken
  );
  await AddToken(
    hardhatHermez,
    hardhatHEZ,
    hardhatHEZ,
    ownerWallet,
    feeAddToken
  );

  // wait until is deployed

  // transfer tokens and ether
  await hardhatTokenERC20Mock.transfer(
    process.env.ETH_ADDRESS,
    ethers.utils.parseEther("10000")
  );

  await hardhatHEZ.transfer(
    process.env.ETH_ADDRESS,
    ethers.utils.parseEther("10000")
  );

  let tx = {
    to: process.env.ETH_ADDRESS,
    value: ethers.utils.parseEther("1000.0"),
  };
  await owner.sendTransaction(tx);

  console.log(
    "/////////////////////////////////////////////////////////////////"
  );
  console.log(
    "/////////////////////////////////////////////////////////////////"
  );
  console.log();

  console.log(
    "note that if the blockchain is restarted the contracts will be deployed in the same address:"
  );
  console.log("account with tokens and funds:", process.env.ETH_ADDRESS);
  console.log("hermez SC deployed in; ", hardhatHermez.address);
  console.log("token ERC20 Contract Address: ", hardhatTokenERC20Mock.address);
  console.log("(ERC20Permit) HEZ deployed in; ", hardhatHEZ.address);
  console.log("withdrawal delayer deployed in; ", hardhatWithdrawalDelayer.address);
  console.log();
  console.log(
    "/////////////////////////////////////////////////////////////////"
  );
  console.log(
    "/////////////////////////////////////////////////////////////////"
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
