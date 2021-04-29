require("dotenv").config();
const path = require("path");
const bre = require("hardhat");
const { ethers } = require("hardhat");

const fs = require("fs");

const tokenInitialAmount = ethers.BigNumber.from(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
);

const pathOutputJson = path.join(__dirname, "./deploy_output_verifiers.json");

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

  const verifierFactory344 = await ethers.getContractFactory("Verifier344");
  const verifierFactory1912 = await ethers.getContractFactory("Verifier1912");
  const verifierFactoryWithdraw= await ethers.getContractFactory("VerifierWithdraw");

  // deploy verifier 344
  const verifierContract344 = await verifierFactory344.deploy();
  await verifierContract344.deployed();
  const verifier344Address = verifierContract344.address;
  console.log("verifierFactory344 deployed at: ", verifier344Address);


  // deploy verifier 1912
  const verifierContract1912 = await verifierFactory1912.deploy();
  await verifierContract1912.deployed();
  const verifier1912Address = verifierContract1912.address;
  console.log("verifierFactory1912 deployed at: ", verifier1912Address);

  // deploy verifier Withdraw
  const verifierContractWithdraw = await verifierFactoryWithdraw.deploy();
  await verifierContractWithdraw.deployed();
  const verifierWithdrawAddress = verifierContractWithdraw.address;
  console.log("verifierFactoryWithdraw deployed at: ", verifierWithdrawAddress);

  const outputJson = {
    verifier344Address,
    verifier1912Address,
    verifierWithdrawAddress
  };

  fs.writeFileSync(pathOutputJson, JSON.stringify(outputJson, null, 1));
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
