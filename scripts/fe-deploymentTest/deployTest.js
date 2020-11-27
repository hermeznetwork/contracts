require("dotenv").config();

const bre = require("@nomiclabs/buidler");
const { expect } = require("chai");
const { ethers } = require("../../node_modules/@nomiclabs/buidler");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const { BigNumber } = require("ethers");
const {
  calculateInputMaxTxLevels,
  AddToken,
} = require("../../test/hermez/helpers/helpers");

async function main() {
  // compìle contracts
  await bre.run("compile");

  let buidlerTokenERC20Mock;
  let buidlerHermez;
  let buidlerWithdrawalDelayer;
  let buidlerHEZ;
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

  // load default account 0 from buidlerEvm
  // Account #0: 0xc783df8a850f42e7f7e57013759c285caa701eb6 (10000 ETH)
  // Private Key: 0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122
  const privateKeyBuidler =
    "0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122";
  const ownerWallet = new ethers.Wallet(
    privateKeyBuidler,
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
  const buidlerPoseidon2Elements = await Poseidon2Elements.deploy();
  const buidlerPoseidon3Elements = await Poseidon3Elements.deploy();
  const buidlerPoseidon4Elements = await Poseidon4Elements.deploy();

  const poseidonAddr2 = buidlerPoseidon2Elements.address;
  const poseidonAddr3 = buidlerPoseidon3Elements.address;
  const poseidonAddr4 = buidlerPoseidon4Elements.address;

  // factory hermez
  const Hermez = await ethers.getContractFactory("HermezTest");

  // deploy tokens
  buidlerTokenERC20Mock = await TokenERC20Mock.deploy(
    "tokenname",
    "TKN",
    await owner.getAddress(),
    tokenInitialAmount
  );

  buidlerHEZ = await TokenERC20PermitMock.deploy(
    "tokenname",
    "TKN",
    await owner.getAddress(),
    tokenInitialAmount
  );

  // deploy helpers
  let buidlerVerifierRollupHelper = await VerifierRollupHelper.deploy();
  let buidlerVerifierWithdrawHelper = await VerifierWithdrawHelper.deploy();

  let buidlerHermezAuctionTest = await HermezAuctionTest.deploy();

  // deploy hermez
  buidlerHermez = await Hermez.deploy();
  await buidlerHermez.deployed();

  buidlerWithdrawalDelayer = await WithdrawalDelayer.deploy();
  await buidlerWithdrawalDelayer.deployed();

  const delay = parseInt(process.env.DELAY ? process.env.DELAY : 60);

  await buidlerWithdrawalDelayer.withdrawalDelayerInitializer(
    delay,
    buidlerHermez.address,
    hermezGovernanceAddress,
    hermezGovernanceAddress
  );


  // initialize hermez
  await buidlerHermez.initializeHermez(
    [buidlerVerifierRollupHelper.address],
    calculateInputMaxTxLevels([maxTx], [nLevels]),
    buidlerVerifierWithdrawHelper.address,
    buidlerHermezAuctionTest.address,
    buidlerHEZ.address,
    forgeL1L2BatchTimeout,
    feeAddToken,
    poseidonAddr2,
    poseidonAddr3,
    poseidonAddr4,
    hermezGovernanceAddress,
    withdrawalDelay,
    buidlerWithdrawalDelayer.address
  );

  // add tokens

  // wait until is deployed
  await buidlerTokenERC20Mock.deployed();
  await buidlerHEZ.deployed();

  await AddToken(
    buidlerHermez,
    buidlerTokenERC20Mock,
    buidlerHEZ,
    ownerWallet,
    feeAddToken
  );
  await AddToken(
    buidlerHermez,
    buidlerHEZ,
    buidlerHEZ,
    ownerWallet,
    feeAddToken
  );

  // wait until is deployed

  // transfer tokens and ether
  await buidlerTokenERC20Mock.transfer(
    process.env.ETH_ADDRESS,
    ethers.utils.parseEther("10000")
  );

  await buidlerHEZ.transfer(
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
  console.log("hermez SC deployed in; ", buidlerHermez.address);
  console.log("token ERC20 Contract Address: ", buidlerTokenERC20Mock.address);
  console.log("(ERC20Permit) HEZ deployed in; ", buidlerHEZ.address);
  console.log("withdrawal delayer deployed in; ", buidlerWithdrawalDelayer.address);
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
