const bre = require("@nomiclabs/buidler");
const {expect} = require("chai");
require("dotenv").config();
const {ethers} = require("../../node_modules/@nomiclabs/buidler");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const {BigNumber} = require("ethers");
const {
  calculateInputMaxTxLevels,
  registerERC1820,
  AddToken,
} = require("../../test/hermez/helpers/helpers");

async function main() {
  let buidlerTokenERC20Mock;
  let buidlerHermez;
  let buidlerWithdrawalDelayer;
  let buidlerHEZ;
  let owner;
  let id1;
  let id2;
  let addrs;
  let hermezGovernanceDAOAddress;

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
    safetyAddress,
    id1,
    id2,
    ...addrs
  ] = await ethers.getSigners();

  hermezGovernanceDAOAddress = governance.getAddress();

  // factory helpers
  const TokenERC20Mock = await ethers.getContractFactory("ERC20Mock");
  const TokenERC777Mock = await ethers.getContractFactory("ERC777Mock");

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
    "WithdrawalDelayerTest"
  );
  const Poseidon2Elements = new ethers.ContractFactory(
    poseidonUnit.abi,
    poseidonUnit.createCode(2),
    owner
  );

  const Poseidon3Elements = new ethers.ContractFactory(
    poseidonUnit.abi,
    poseidonUnit.createCode(3),
    owner
  );

  const Poseidon4Elements = new ethers.ContractFactory(
    poseidonUnit.abi,
    poseidonUnit.createCode(4),
    owner
  );
  const buidlerPoseidon2Elements = await Poseidon2Elements.deploy();
  const buidlerPoseidon3Elements = await Poseidon3Elements.deploy();
  const buidlerPoseidon4Elements = await Poseidon4Elements.deploy();

  const poseidonAddr2 = buidlerPoseidon2Elements.address;
  const poseidonAddr3 = buidlerPoseidon3Elements.address;
  const poseidonAddr4 = buidlerPoseidon4Elements.address;

  // deploy registry erc1820
  await registerERC1820(owner);

  // factory hermez
  const Hermez = await ethers.getContractFactory("HermezTest");

  // deploy tokens
  buidlerTokenERC20Mock = await TokenERC20Mock.deploy(
    "tokenname",
    "TKN",
    await owner.getAddress(),
    tokenInitialAmount
  );

  buidlerHEZ = await TokenERC777Mock.deploy(
    await owner.getAddress(),
    tokenInitialAmount,
    "tokenname",
    "TKN",
    []
  );

  // deploy helpers
  let buidlerVerifierRollupHelper = await VerifierRollupHelper.deploy();
  let buidlerVerifierWithdrawHelper = await VerifierWithdrawHelper.deploy();

  let buidlerHermezAuctionTest = await HermezAuctionTest.deploy();

  // deploy hermez
  buidlerHermez = await Hermez.deploy();
  await buidlerHermez.deployed();

  buidlerWithdrawalDelayer = await WithdrawalDelayer.deploy(
    0,
    buidlerHermez.address,
    hermezGovernanceDAOAddress,
    hermezGovernanceDAOAddress,
    hermezGovernanceDAOAddress
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
    hermezGovernanceDAOAddress,
    await safetyAddress.getAddress(),
    withdrawalDelay,
    buidlerWithdrawalDelayer.address
  );

  // add tokens

  // wait until is deployed
  await buidlerTokenERC20Mock.deployed();
  await buidlerHEZ.deployed();
  const addressOwner = await owner.getAddress();

  await AddToken(
    buidlerHermez,
    buidlerTokenERC20Mock,
    buidlerHEZ,
    addressOwner,
    feeAddToken
  );
  await AddToken(
    buidlerHermez,
    buidlerHEZ,
    buidlerHEZ,
    addressOwner,
    feeAddToken
  );

  // wait until is deployed

  // transfer tokens and ether
  await buidlerTokenERC20Mock.transfer(
    process.env.ETH_ADDRESS,
    ethers.utils.parseEther("10000")
  );

  await buidlerHEZ.send(
    process.env.ETH_ADDRESS,
    ethers.utils.parseEther("10000"),
    ethers.utils.toUtf8Bytes("")
  );

  let tx = {
    to: process.env.ETH_ADDRESS,
    value: ethers.utils.parseEther("1000.0"),
  };
  await owner.sendTransaction(tx);

  // los
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
  console.log("(ERC777) HEZ deployed in; ", buidlerHEZ.address);
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
