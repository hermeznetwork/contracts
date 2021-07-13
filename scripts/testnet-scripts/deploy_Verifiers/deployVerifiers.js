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

  const Verifier344 = await ethers.getContractFactory("Verifier344");
  const Verifier1912= await ethers.getContractFactory("Verifier1912");
  const VerifierWithdraw = await ethers.getContractFactory("VerifierWithdraw");

  const hardhatVerifier344 = await Verifier344.deploy();
  await hardhatVerifier344.deployed();
  const Verifier344Address = hardhatVerifier344.address;
  console.log("Verifier344Helper deployed at: ", Verifier344Address);

  const hardhatVerifier1912 = await Verifier1912.deploy();
  await hardhatVerifier1912.deployed();
  const Verifier1912Address = hardhatVerifier1912.address;
  console.log("Verifier1912Helper deployed at: ", Verifier1912Address);

  const hardhatVerifierWithdraw = await VerifierWithdraw.deploy();
  await hardhatVerifierWithdraw.deployed();
  const VerifierWithdrawAddress = hardhatVerifierWithdraw.address;
  console.log("VerifierWithdrawHelper deployed at: ", VerifierWithdrawAddress);

  const outputJson = {
    Verifier344Address,
    Verifier1912Address,
    VerifierWithdrawAddress
  };

  fs.writeFileSync(pathOutputJson, JSON.stringify(outputJson, null, 1));
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
