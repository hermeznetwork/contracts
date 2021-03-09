require("dotenv").config();
const path = require("path");
const bre = require("hardhat");
const { ethers } = require("hardhat");

const fs = require("fs");

const tokenInitialAmount = ethers.BigNumber.from(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
);

const pathOutputJson = path.join(__dirname, "./deploy_outputV.json");

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

  const VerifierRollupHelper = await ethers.getContractFactory("VerifierRollupHelper");
  // deploy DAI (erc20Permit) token
  const hardhatVerifierRollup = await VerifierRollupHelper.deploy();
  await hardhatVerifierRollup.deployed();
  const VerifierAddress = hardhatVerifierRollup.address;
  console.log("VerifierRollupHelper deployed at: ", VerifierAddress);


  const outputJson = {
    VerifierAddress
  };

  fs.writeFileSync(pathOutputJson, JSON.stringify(outputJson, null, 1));
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
