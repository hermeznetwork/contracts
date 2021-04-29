const {expect} = require("chai");
require("dotenv").config();
const path = require("path");
const bre = require("hardhat");
const { ethers, upgrades } = require("hardhat");
const { getAdminAddress } = require("@openzeppelin/upgrades-core");
const ProxyAdmin = require("@openzeppelin/upgrades-core/artifacts/ProxyAdmin.json");

const pathDeployOutputParameters = path.join(__dirname, "./deploy_output.json");
const deployOutputParameters = require(pathDeployOutputParameters);

var readline = require("readline");
var rl = readline.createInterface(process.stdin, process.stdout);   

const yargs = require("yargs");
const options = yargs
  .usage("Usage: node timeLockUpgrade.js -r <Role address>")
  .option("r", { alias: "roleAddress", describe: "Grant role to this address", type: "string", demandOption: false})
  .option("d", { alias: "delay", describe: "Delay TimeLock", type: "number", demandOption: true})
  .argv;

const roleAddress = options.r || deployOutputParameters.communitCouncilAddress;

async function main() {
  // compìle contracts
  await bre.run("compile");

  if (!options.r) {
    console.log("\n\nrole address don't specified, community Council address will be used from the deploy_output.json");
  }
  // load SC
  const HermezV2 = await ethers.getContractFactory("HermezVerifiersUpdate"); // HermezVerifiersUpdate 
  const Timelock = await ethers.getContractFactory("Timelock"); // TimeLock
  const Governance = await ethers.getContractFactory("HermezGovernance"); // Governance

  // load address
  const hermezAddress = deployOutputParameters.hermezAddress;
  const governanceAddress = deployOutputParameters.hermezGovernanceAddress;
  const timeLockAddress = deployOutputParameters.timeLockAddress;

  // load governance contract
  const governanceInstance = (Governance.attach(governanceAddress)).connect(deployOutputParameters.communitCouncilAddress);
  const timelockInstance = (Timelock.attach(timeLockAddress));

  // checks
  const timelockDelay = await timelockInstance.delay();

  const delayTimeLock = options.delay || timelockDelay; // add check
  
  if (delayTimeLock < timelockDelay.toNumber()) {
    console.log("Error, delay should be bigger than the delay in the smart contract");
    console.log("Delay introduced: ", delayTimeLock);
    console.log("Delay Smart contract: ", timelockDelay.toNumber());
    return;
  } else {
    console.log("Delay introduced: ", delayTimeLock);
    console.log("Minimum delay Smart contract: ", timelockDelay.toNumber());
    console.log("Are you sure you want to continue?");
  }
  
  if (!await promptYesNo()) {
    console.log("upgrade cancelled");
    return;
  }
  // deploy new implementatino contract
  const hermezV2 = await upgrades.prepareUpgrade(hermezAddress, HermezV2, {
    unsafeAllowCustomTypes: true
  });

  console.log("hermez V2 address: ", hermezV2); // new implementation address

  // get admin contract
  const AdminFactory = await ethers.getContractFactory(ProxyAdmin.abi, ProxyAdmin.bytecode);
  const adminAddress = await getAdminAddress(ethers.provider, hermezAddress);

  // give role transaction 
  const roleQueueTx = await getRole(timeLockAddress, Timelock.interface.getSighash("queueTransaction"));
  const txGrantRoleQueueTx = await governanceInstance.populateTransaction.grantRole(roleQueueTx, roleAddress);
  console.log("transaction grant role Queue Tx:");
  console.log(txGrantRoleQueueTx);
  console.log("");
  
  const roleExectueTx = await getRole(timeLockAddress, Timelock.interface.getSighash("executeTransaction"));
  const txGrantRoleExectueTx = await governanceInstance.populateTransaction.grantRole(roleExectueTx, roleAddress);
  console.log("transaction grant role Execute Tx:");
  console.log(txGrantRoleExectueTx);
  console.log("");

  // prepare timeLock transaction
  const ifaceAdmin = new ethers.utils.Interface(ProxyAdmin.abi);
  const currentBlockTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
  
  const value = 0;
  const signature = ""; // included in data
  const data = ifaceAdmin.encodeFunctionData("upgrade", [hermezAddress, hermezV2]);
  const eta = currentBlockTimestamp + delayTimeLock;

  const dataExecuteGovernanceQueueTimelock = Timelock.interface.encodeFunctionData("queueTransaction", [adminAddress, value, signature, data, eta]);
  const txExecuteQueueTx = await governanceInstance.populateTransaction.execute(timeLockAddress, 0, dataExecuteGovernanceQueueTimelock);
  console.log("transaction Execute Queue Tx:");
  console.log(txExecuteQueueTx);
  console.log("");


  const dataExecuteGovernanceExecuteTimeLock = Timelock.interface.encodeFunctionData("executeTransaction", [adminAddress, value, signature, data, eta]);
  const txExecuteExecuteTx = await governanceInstance.populateTransaction.execute(timeLockAddress, 0, dataExecuteGovernanceExecuteTimeLock);
  console.log("transaction Execute Execute Tx:");
  console.log(txExecuteExecuteTx);
  console.log("");

}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


function getRole(address, dataSignature) {
  return ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ["address", "bytes4"],
      [address, dataSignature]
    )
  );
}



function promptYesNo() {
  return new Promise((resolve) => {
    rl.question("Do you wand to continue? [no]/yes: ", function(answer) {
      if(answer == "yes" || answer == "y") {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}