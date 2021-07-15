require("dotenv").config();
const path = require("path");
const bre = require("hardhat");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const pathDeployOutputParameters = path.join(__dirname, "./deploy_output.json");
const deployOutputParameters = require(pathDeployOutputParameters);

const pathDeployParameters = path.join(__dirname, "./deploy_parameters.json");
const deployParameters = require(pathDeployParameters);

const defaultTokenInitialAmount = ethers.utils.parseEther("100000");

async function main() {


  // load Mnemonic accounts
  const signersArray = await ethers.getSigners();
  const deployer = signersArray[process.env.INDEX];
  const deployerAddress = await deployer.getAddress();

  if (typeof process.env.ETHERSCAN_API_KEY === "undefined") {
    throw new Error("Etherscan API KEY has not been defined");
  }

  for (let i = 0; i < deployParameters.length; i++) {
    const currentToken = deployParameters[i];
    try {
      // verify governance
      await bre.run("verify:verify",
        {
          address: deployOutputParameters[currentToken.name],
          constructorArguments: [
            currentToken.name,
            currentToken.symbol,
            currentToken.initialAccount || deployerAddress,
            currentToken.tokenInitalAmount || defaultTokenInitialAmount,
            currentToken.decimals,
          ]
        }
      );
    } catch (error) {
      expect(error.message).to.be.equal("Contract source code already verified");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

