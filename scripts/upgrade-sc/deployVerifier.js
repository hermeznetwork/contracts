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

  const verifierFactory400 = await ethers.getContractFactory("Verifier400");
  const verifierFactory2048 = await ethers.getContractFactory("Verifier2048");
  const verifierFactoryWithdraw= await ethers.getContractFactory("VerifierWithdraw");

  // deploy verifier 400
  const verifierContract400 = await verifierFactory400.deploy();
  await verifierContract400.deployed();
  const verifier400Address = verifierContract400.address;
  console.log("verifierFactory400 deployed at: ", verifier400Address);


  // deploy verifier 2048
  const verifierContract2048 = await verifierFactory2048.deploy();
  await verifierContract2048.deployed();
  const verifier2048Address = verifierContract2048.address;
  console.log("verifierFactory2048 deployed at: ", verifier2048Address);

  // deploy verifier Withdraw
  const verifierContractWithdraw = await verifierFactoryWithdraw.deploy();
  await verifierContractWithdraw.deployed();
  const verifierWithdrawAddress = verifierContractWithdraw.address;
  console.log("verifierFactoryWithdraw deployed at: ", verifierWithdrawAddress);

  const outputJson = {
    verifier400Address,
    verifier2048Address,
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
