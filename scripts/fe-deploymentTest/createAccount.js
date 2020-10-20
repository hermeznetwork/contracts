require("dotenv").config();

const bre = require("@nomiclabs/buidler");
const {expect} = require("chai");
const {ethers} = require("../../node_modules/@nomiclabs/buidler");
const {BigNumber} = require("ethers");
const SMTMemDB = require("circomlib").SMTMemDB;
const {
  l1UserTxCreateAccountDeposit,
} = require("../../test/hermez/helpers/helpers");

const isERC20Permit = true;

async function main() {
  // compìle contracts
  await bre.run("compile");

  [owner, ...addrs] = await ethers.getSigners();

  const Hermez = await ethers.getContractFactory("HermezTest");

  buidlerHermez = Hermez.attach(process.env.HERMEZ_ADDRESS);
  
  // load default account 0 from buidlerEvm
  // Account #0: 0xc783df8a850f42e7f7e57013759c285caa701eb6 (10000 ETH)
  // Private Key: 0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122
  const privateKeyBuidler =
    "0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122";
  const ownerWallet = new ethers.Wallet(
    privateKeyBuidler,
    ethers.provider
  );

  // get token contract
  let buidlerToken;
  if (isERC20Permit) {
    const TokenFactory = await ethers.getContractFactory("ERC20PermitMock");
    buidlerToken = TokenFactory.attach(process.env.ERC20PERMIT_ADDRESS);
  } else {
    const TokenFactory = await ethers.getContractFactory("ERC20Mock");
    buidlerToken = TokenFactory.attach(process.env.ERC20_ADDRESS);
  }

  const loadAmount = 10;
  const tokenID = 1 + isERC20Permit; // tokenID 1 is ERC20, tokenID 2 is ERC20Permit
  const babyjub = "0x001021212123";

  await l1UserTxCreateAccountDeposit(
    loadAmount,
    tokenID,
    babyjub,
    ownerWallet,
    buidlerHermez,
    buidlerToken,
    isERC20Permit
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
