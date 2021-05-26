require("dotenv").config();
const path = require("path");
const bre = require("hardhat");
const openzeppelinUpgrade = require(`./.openzeppelin/${process.env.HARDHAT_NETWORK}.json`);
const {expect} = require("chai");

const pathDeployOutputParameters = path.join(__dirname, "./deploy_output.json");
const deployOutputParameters = require(pathDeployOutputParameters);

async function main() {
  // verify upgradable SC (hermez and Auction)
  for (const property in openzeppelinUpgrade.impls) {
    const address = openzeppelinUpgrade.impls[property].address;
    try {
      await bre.run("verify:verify",{address});
    } catch (error) {
      // expect(error.message).to.be.equal("Contract source code already verified");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

