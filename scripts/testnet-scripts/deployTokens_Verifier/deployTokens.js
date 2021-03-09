require("dotenv").config();
const path = require("path");
const bre = require("hardhat");
const { ethers } = require("hardhat");

const fs = require("fs");

const tokenInitialAmount = ethers.BigNumber.from(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
);

const pathOutputJson = path.join(__dirname, "./deploy_output.json");

async function main() {
  // compìle contracts
  await bre.run("compile");

  // load Mnemonic accounts:
  const signersArray = await ethers.getSigners();

  // index 0 would use as the deployer address
  const [deployer] = signersArray;
  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const DAIToken = await ethers.getContractFactory("ERC20PermitMock");
  const UNIToken = await ethers.getContractFactory("ERC20PermitMock");
  const LINKToken = await ethers.getContractFactory("ERC20PermitMock");

  // deploy DAI (erc20Permit) token
  hardhatDAIToken = await DAIToken.deploy(
    "Dai Stablecoin",
    "DAI",
    await deployer.getAddress(),
    tokenInitialAmount
  );
  await hardhatDAIToken.deployed();
  const DAITokenAddress = hardhatDAIToken.address;
  console.log("DAIToken deployed at: ", DAITokenAddress);

  // deploy UNI (erc20Permit) token
  hardhatUNIoken = await UNIToken.deploy(
    "Uniswap",
    "UNI",
    await deployer.getAddress(),
    tokenInitialAmount
  );
  await hardhatUNIoken.deployed();
  const UNITokenAddress = hardhatUNIoken.address;
  console.log("UNIoken deployed at: ", UNITokenAddress);

  // deploy LINK (erc20Permit) token
  hardhatLINKToken = await LINKToken.deploy(
    "ChainLink Token",
    "LINK",
    await deployer.getAddress(),
    tokenInitialAmount
  );
  await hardhatLINKToken.deployed();
  const LINKTokenAddress = hardhatLINKToken.address;
  console.log("LINKToken deployed at: ", LINKTokenAddress);


  // in case the mnemonic accounts are used, return the index, otherwise, return null
  const outputJson = {
    DAITokenAddress,
    UNITokenAddress,
    LINKTokenAddress
  };

  fs.writeFileSync(pathOutputJson, JSON.stringify(outputJson, null, 1));
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
