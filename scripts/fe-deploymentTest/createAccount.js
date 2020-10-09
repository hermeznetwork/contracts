// set enviroment variable for buidler
process.env.BUIDLER_NETWORK = "localhost";

const bre = require("@nomiclabs/buidler");
const {expect} = require("chai");
require("dotenv").config();
const {ethers} = require("../../node_modules/@nomiclabs/buidler");
const {BigNumber} = require("ethers");
const SMTMemDB = require("circomlib").SMTMemDB;
const {
  l1UserTxCreateAccountDeposit,
} = require("../../test/hermez/helpers/helpers");

const isERC777 = true;

async function main() {
  // compìle contracts
  await bre.run("compile");

  [owner, ...addrs] = await ethers.getSigners();

  const Hermez = await ethers.getContractFactory("HermezTest");

  buidlerHermez = Hermez.attach(process.env.HERMEZ_ADDRESS);

  // get token contract
  let buidlerToken;
  if (isERC777) {
    const TokenFactory = await ethers.getContractFactory("ERC777Mock");
    buidlerToken = TokenFactory.attach(process.env.ERC777_ADDRESS);
  } else {
    const TokenFactory = await ethers.getContractFactory("ERC20Mock");
    buidlerToken = TokenFactory.attach(process.env.ERC20_ADDRESS);
  }

  const loadAmount = 10;
  const tokenID = 1 + isERC777; // tokenID 1 is ERC20, tokenID 2 is ERC777
  const babyjub = "0x001021212123";

  await l1UserTxCreateAccountDeposit(
    loadAmount,
    tokenID,
    babyjub,
    owner,
    buidlerHermez,
    buidlerToken,
    isERC777
  );
  console.log("account created!");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
