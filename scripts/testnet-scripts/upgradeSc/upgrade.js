const {expect} = require("chai");
require("dotenv").config();
const path = require("path");
const bre = require("hardhat");
const { ethers, upgrades } = require("hardhat");
const { getAdminAddress } = require("@openzeppelin/upgrades-core");
const ProxyAdmin = require("@openzeppelin/upgrades-core/artifacts/ProxyAdmin.json");

const pathDeployOutputParameters = path.join(__dirname, "./deploy_output.json");
const deployOutputParameters = require(pathDeployOutputParameters);

const yargs = require("yargs");
const options = yargs
  .usage("Usage: node upgrade.js -v <boolean>")
  .option("v", { alias: "verbose", describe: "print transaction data instead of send tx", type: "boolean", demandOption: false, default:false })
  .argv;

 
async function main() {
  // compìle contracts
  await bre.run("compile");

  const HermezV2 = await ethers.getContractFactory("HermezCircuitUpgrade"); //HermezCircuitUpgrade

  const hermezAddress = deployOutputParameters.hermezAddress;

  const hermezV2 = await upgrades.prepareUpgrade(hermezAddress, HermezV2, {
    unsafeAllowCustomTypes: true
  });
  const AdminFactory = await ethers.getContractFactory(ProxyAdmin.abi, ProxyAdmin.bytecode);
  const admin = AdminFactory.attach(await getAdminAddress(ethers.provider, hermezAddress));

  if(options.v) {
    // log transaction data
    const txDataUpgrade = await admin.populateTransaction.upgrade(hermezAddress, hermezV2);
    const txGasUpgrade = await admin.estimateGas.upgrade(hermezAddress, hermezV2);
    console.log({txDataUpgrade}, {gas:txGasUpgrade.toNumber()});
  } else {
    // send tx
    const txUpgrade = await admin.upgrade(hermezAddress, hermezV2);
    await txUpgrade.wait();
  }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
