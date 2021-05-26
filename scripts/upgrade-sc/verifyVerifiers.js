require("dotenv").config();
const path = require("path");
const hre = require("hardhat");
const {expect} = require("chai");
const { ethers } = require("hardhat");

const pathDeployOutputParameters = path.join(__dirname, "./deploy_output_verifiers.json");
const deployOutputParameters = require(pathDeployOutputParameters);

async function main() {
  // load Mnemonic accounts:
  const signersArray = await ethers.getSigners();

  // index 0 would use as the deployer address
  const [deployer] = signersArray;
  const deployerAddress = await deployer.getAddress();

  try {
    // verify 400
    await hre.run("verify:verify",
      {
        address:deployOutputParameters.verifier400Address,
      }
    );
  } catch (error) {
    expect(error.message).to.be.equal("Contract source code already verified");
  }


  try {
  // verify 2048
    await hre.run("verify:verify",
      {
        address:deployOutputParameters.verifier2048Address,
      }
    );
  } catch (error) {
    expect(error.message).to.be.equal("Contract source code already verified");
  }


  try {
  // verify Withdraw
    await hre.run("verify:verify",
      {
        address:deployOutputParameters.verifierWithdrawAddress,
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

