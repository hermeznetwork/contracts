require("dotenv").config();
const bre = require("hardhat");
const openzeppelinUpgrade = require("./.openzeppelin/rinkeby.json");
const pathDeployParameters = path.join(__dirname, "./deploy_parameters.json");
const deployParameters = require(pathDeployParameters);
const { ethers } = require("@nomiclabs/buidler");

const pathDeployOutputParameters = path.join(__dirname, "./deploy_output.json");
const deployOutputParameters = require(pathDeployOutputParameters);

async function main() {
  
  const chainId = (await ethers.provider.getNetwork()).chainId;

  // verify Verifiers

  //forge verifiers
  for (let i = 0; i < deployOutputParameters.libVerifiersAddress; i++) {
    const address = deployOutputParameters.libVerifiersAddress[i];
    await bre.run("verify",{address});
  }

  // withdraw verifier
  await bre.run("verify",{address:deployOutputParameters.libverifiersWithdrawAddress});

  // verify Withdrawal Delayer
  await bre.run("verify",
    {
      address: deployOutputParameters.withdrawalDelayeAddress,
      constructorArguments: [
        (deployParameters[chainId].initialWithdrawalDelay).toString(),
        deployOutputParameters.hermezAddress,
        deployOutputParameters.hermezGovernanceAddress,
        deployOutputParameters.emergencyCouncilAddress
      ]
    }
  );

  // verify governance
  await bre.run("verify",
    {
      address:deployOutputParameters.hermezGovernanceAddress,
      constructorArguments: [
        deployOutputParameters.communitCouncilAddress
      ]
    }
  );

  // verify upgradable SC (hermez and Auction)
  for (const property in openzeppelinUpgrade.impls) {
    const address = openzeppelinUpgrade.impls[property].address;
    await bre.run("verify",{address});
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

