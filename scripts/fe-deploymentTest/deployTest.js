const bre = require("@nomiclabs/buidler");
const {expect} = require("chai");
require("dotenv").config();
const {ethers} = require("../../node_modules/@nomiclabs/buidler");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const {BigNumber} = require("ethers");
const {
  calculateInputMaxTxLevels,
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

  // factory hermez
  const Hermez = await ethers.getContractFactory("HermezTest");

  // deploy helpers
  buidlerTokenERC20Mock = await TokenERC20Mock.deploy(
    "tokenname",
    "TKN",
    await owner.getAddress(),
    tokenInitialAmount
  );

  let buidlerVerifierRollupHelper = await VerifierRollupHelper.deploy();
  let buidlerVerifierWithdrawHelper = await VerifierWithdrawHelper.deploy();

  let buidlerHermezAuctionTest = await HermezAuctionTest.deploy();

  buidlerWithdrawalDelayer = await WithdrawalDelayer.deploy(
    hermezGovernanceAddress,
    hermezGovernanceAddress,
    hermezGovernanceAddress,
    hermezGovernanceAddress,
    0
  );

  // deploy hermez
  buidlerHermez = await Hermez.deploy();
  await buidlerHermez.deployed();

  // deploy hermez
  await buidlerHermez.initializeHermez(
    [buidlerVerifierRollupHelper.address],
    [calculateInputMaxTxLevels(maxTx, nLevels)],
    buidlerVerifierWithdrawHelper.address,
    buidlerTokenERC20Mock.address,
    hermezGovernanceAddress,
    buidlerHermezAuctionTest.address,
    buidlerWithdrawalDelayer.address,
    poseidonAddr2,
    poseidonAddr3,
    poseidonAddr4,
    feeAddToken,
    forgeL1L2BatchTimeout,
    withdrawalDelay
  );

  // wait until is deployed
  await buidlerTokenERC20Mock.deployed();

  // add token

  const addressOwner = await owner.getAddress();
  const initialOwnerBalance = await buidlerTokenERC20Mock.balanceOf(
    addressOwner
  );

  await expect(
    buidlerTokenERC20Mock.approve(buidlerHermez.address, feeAddToken)
  ).to.emit(buidlerTokenERC20Mock, "Approval");

  const tokensAdded = await buidlerHermez.registerTokensCount();
  await expect(buidlerHermez.addToken(buidlerTokenERC20Mock.address))
    .to.emit(buidlerHermez, "AddToken")
    .withArgs(buidlerTokenERC20Mock.address, tokensAdded);

  const finalOwnerBalance = await buidlerTokenERC20Mock.balanceOf(addressOwner);
  expect(finalOwnerBalance).to.equal(
    BigNumber.from(initialOwnerBalance).sub(feeAddToken)
  );

  await buidlerTokenERC20Mock.transfer(
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
  console.log("token Contract Address: ", buidlerTokenERC20Mock.address);
  console.log("hermez deployed in; ", buidlerHermez.address);
  console.log("account with tokens and funds:", process.env.ETH_ADDRESS);

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
