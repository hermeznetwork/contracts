require("dotenv").config();
const bre = require("hardhat");
const { ethers } = require("hardhat");

const utils = require("./utils");

async function main() {
  // compìle contracts
  await bre.run("compile");

  // load Mnemonic accounts
  const signersArray = await ethers.getSigners();

  // check environment variables
  utils.checkEnvVariables();

  const deployer = signersArray[process.env.INDEX];
  const deployerAddress = await deployer.getAddress();
  const deployerBalance = (await deployer.getBalance()).toString();

  console.log("<=============================>");
  console.log("<========DEPLOYER INFO========>");
  console.log("<=============================>");
  console.log(`address: ${deployerAddress}`);
  console.log(`balance: ${deployerBalance} ETH\n\n`);

  const instanceToken = await (await ethers.getContractFactory("ERC20MockDecimals")).connect(deployer);

  console.log("<=============================>");
  console.log("<===========DEPLOY============>");
  console.log("<=============================>");

  console.log("Info token paramneters:");
  console.log("   tokenName: ", process.env.TOKEN_NAME);
  console.log("   tokenSymbol: ", process.env.TOKEN_SYMBOL);
  console.log("   tokenDecimals: ", process.env.TOKEN_DECIMALS);
  console.log("   InitialAccount: ", process.env.INITIAL_ACCOUNT);

  const tokenInitialAmount = ethers.BigNumber.from(
    "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
  );
  console.log("Token is being deployed...");
  const deployToken = await instanceToken.deploy(
    process.env.TOKEN_NAME,
    process.env.TOKEN_SYMBOL,
    process.env.INITIAL_ACCOUNT,
    tokenInitialAmount,
    process.env.TOKEN_DECIMALS,
  );
  await deployToken.deployed();
  const deployTokenAddress = deployToken.address;
  console.log(`Token deployed at: ${deployTokenAddress}\n\n`);

  console.log("<=============================>");
  console.log("<===========VERIFY============>");
  console.log("<=============================>");

  const maxRetries = 10;
  const timeoutRetry = 60000;
  let numRetry = 0;
  let lastError;
  let success = false;

  while (numRetry < maxRetries && !success) {
    try {
      await bre.run("verify:verify",
        {
          address: deployTokenAddress,
          constructorArguments: [
            process.env.TOKEN_NAME,
            process.env.TOKEN_SYMBOL,
            process.env.INITIAL_ACCOUNT,
            tokenInitialAmount,
            process.env.TOKEN_DECIMALS,
          ]
        }
      );
      success = true;
    } catch (error) {
      numRetry += 1;
      lastError = error;
      await utils.timeout(timeoutRetry);
      console.log(`Trying verifying contract: ${numRetry}`);
    }
  }

  if (success) {
    console.log("Contract verified correctly");
  } else {
    console.log("Not able to verify contract");
    console.log(lastError);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
