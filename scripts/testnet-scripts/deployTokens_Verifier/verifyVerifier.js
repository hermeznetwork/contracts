require("dotenv").config();
const path = require("path");
const bre = require("hardhat");
const {expect} = require("chai");
const { ethers } = require("hardhat");

const pathDeployOutputParameters = path.join(__dirname, "./deploy_outputV.json");
const deployOutputParameters = require(pathDeployOutputParameters);


const tokenInitialAmount = ethers.BigNumber.from(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
);
async function main() {
  // load Mnemonic accounts:
  const signersArray = await ethers.getSigners();

  // index 0 would use as the deployer address
  const [deployer] = signersArray;
  const deployerAddress = await deployer.getAddress();

  try {
  // verify governance
    await bre.run("verify:verify",
      {
        address:deployOutputParameters.VerifierAddress,
        contract: "contracts/hermez/test/VerifierRollupHelper.sol:VerifierRollupHelper"
      }
    );
  } catch (error) {
    expect(error.message).to.be.equal("Contract source code already verified");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

