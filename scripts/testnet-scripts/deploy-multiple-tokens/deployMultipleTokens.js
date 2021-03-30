require("dotenv").config();
const path = require("path");
const fs = require("fs");
const bre = require("hardhat");
const { ethers } = require("hardhat");
const utils = require("./utils");

const pathDeployParameters = path.join(__dirname, "./deploy_parameters.json");
const deployParameters = require(pathDeployParameters);
const pathOutputJson = deployParameters.pathOutputJson || path.join(__dirname, "./deploy_output.json");

const defaultTokenInitialAmount = ethers.utils.parseEther("1000000");

async function main() {
  // compìle contracts
  await bre.run("compile");


  // check environment variables
  utils.checkEnvVariables();

  // load Mnemonic accounts
  const signersArray = await ethers.getSigners();
  const deployer = signersArray[process.env.INDEX];
  const deployerAddress = await deployer.getAddress();
  const deployerBalance = ethers.utils.formatEther((await deployer.getBalance()).toString());

  console.log("<=============================>");
  console.log("<========DEPLOYER INFO========>");
  console.log("<=============================>");
  console.log(`address: ${deployerAddress}`);
  console.log(`balance: ${deployerBalance} ETH\n\n`);


  console.log("<====================================>");
  console.log("<===========DEPLOY TOKENS============>");
  console.log("<====================================>");

  const outputJson = {};
  const instanceToken = await (await ethers.getContractFactory("ERC20MockDecimals")).connect(deployer);
  for (let i = 0; i < deployParameters.length; i++) {
    const currentToken = deployParameters[i];

    if(!currentToken.tokenInitalAmount) {
      currentToken.tokenInitalAmount = defaultTokenInitialAmount;
      console.log("Initial amount not defined, use default initial amount instead");
    }

    if(!currentToken.initialAccount) {
      console.log("Initial account not defined, use deployer address as initial account");
      currentToken.initialAccount = deployerAddress;
    }

    console.log("Info token paramneters:");
    console.log("   tokenName: ",currentToken.name);
    console.log("   tokenSymbol: ", currentToken.symbol);
    console.log("   InitialAccount: ",  currentToken.initialAccount);
    console.log("   tokenInitalAmount: ",   currentToken.tokenInitalAmount);
    console.log("   tokenDecimals: ", currentToken.decimals);

    const deployToken = await instanceToken.deploy(
      currentToken.name,
      currentToken.symbol,
      currentToken.initialAccount || deployerAddress,
      currentToken.tokenInitalAmount || defaultTokenInitialAmount,
      currentToken.decimals,
    );
    console.log("Token is being deployed...");

    await deployToken.deployed();
    const deployTokenAddress = deployToken.address;
    console.log(`Token deployed at: ${deployTokenAddress}\n\n`);
    outputJson[currentToken.name] = deployTokenAddress;
  }

  fs.writeFileSync(pathOutputJson, JSON.stringify(outputJson, null, 1));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
