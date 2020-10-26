require("dotenv").config();

const bre = require("@nomiclabs/buidler");
const {expect} = require("chai");
const {ethers} = require("../../node_modules/@nomiclabs/buidler");
const {BigNumber} = require("ethers");
const SMTMemDB = require("circomlib").SMTMemDB;
const {
  l1UserTxForceExit,
} = require("../../test/hermez/helpers/helpers");

const isERC20Permit = true;

async function main() {
  // compìle contracts
  await bre.run("compile");

  [owner, ...addrs] = await ethers.getSigners();

  const Hermez = await ethers.getContractFactory("HermezTest");

  buidlerHermez = Hermez.attach(process.env.HERMEZ_ADDRESS);

  // get token contract
  let buidlerToken;
  if (isERC20Permit) {
    const TokenFactory = await ethers.getContractFactory("ERC20PermitMock");
    buidlerToken = TokenFactory.attach(process.env.ERC20PERMIT_ADDRESS);
  } else {
    const TokenFactory = await ethers.getContractFactory("ERC20Mock");
    buidlerToken = TokenFactory.attach(process.env.ERC20_ADDRESS);
  }

  const fromIdx = 256;
  const tokenID = 1 + isERC20Permit; // tokenID 1 is ERC20, tokenID 2 is ERC20Permit
  const amountF = 10;
  
  await l1UserTxForceExit(
    tokenID,
    fromIdx,
    amountF,
    owner,
    buidlerHermez
  );
  console.log("exit succed!");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
