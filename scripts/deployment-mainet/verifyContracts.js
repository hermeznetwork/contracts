require("dotenv").config();
const path = require("path");
const bre = require("hardhat");
const openzeppelinUpgrade = require(`./.openzeppelin/${process.env.HARDHAT_NETWORK}.json`);
const pathDeployParameters = path.join(__dirname, "./deploy_parameters.json");
const deployParameters = require(pathDeployParameters);
const {expect} = require("chai");

const pathDeployOutputParameters = path.join(__dirname, "./deploy_output.json");
const deployOutputParameters = require(pathDeployOutputParameters);

async function main() {

  // verify Verifiers
  try {
    //forge verifiers
    for (let i = 0; i < deployOutputParameters.libVerifiersAddress.length; i++) {
      const address = deployOutputParameters.libVerifiersAddress[i];
      await bre.run("verify:verify",{address});
    }
  } catch (error) {
    expect(error.message).to.be.equal("Contract source code already verified");
  }

  try {
    // withdraw verifier
    await bre.run("verify:verify",{address:deployOutputParameters.libverifiersWithdrawAddress});
  } catch (error) {
    expect(error.message).to.be.equal("Contract source code already verified");
  }


  // verify Withdrawal Delayer
  try {
    await bre.run("verify:verify",
      {
        address: deployOutputParameters.withdrawalDelayeAddress,
        constructorArguments: [
          (deployParameters.initialWithdrawalDelay).toString(),
          deployOutputParameters.hermezAddress,
          deployOutputParameters.hermezGovernanceAddress,
          deployOutputParameters.emergencyCouncilAddress
        ]
      }
    );
  } catch (error) {
    expect(error.message).to.be.equal("Contract source code already verified");
  }

  try {
  // verify governance
    await bre.run("verify:verify",
      {
        address:deployOutputParameters.hermezGovernanceAddress,
        constructorArguments: [
          deployOutputParameters.communitCouncilAddress
        ]
      }
    );
  } catch (error) {
    expect(error.message).to.be.equal("Contract source code already verified");
  }

  try {
    // verify timeLock
    await bre.run("verify:verify",
      {
        address:deployOutputParameters.timeLockAddress,
        constructorArguments: [
          deployOutputParameters.hermezGovernanceAddress,
          deployParameters.timeLockDelay,
        ]
      }
    );
  } catch (error) {
    expect(error.message).to.be.equal("Contract source code already verified");
  }
    
  // verify upgradable SC (hermez and Auction)
  for (const property in openzeppelinUpgrade.impls) {
    const address = openzeppelinUpgrade.impls[property].address;
    try {
      await bre.run("verify:verify",{address});
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

