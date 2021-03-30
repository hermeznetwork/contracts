
function envVarCheck(envVar, nameVar) {
  if (typeof envVar === "undefined") {
    throw new Error(`${nameVar} has not been defined`);
  }
}

function checkEnvVariables() {

  envVarCheck(process.env.MNEMONIC, "MNEMONIC");
  envVarCheck(process.env.INDEX, "INDEX");
  envVarCheck(process.env.INFURA_PROJECT_ID, "INFURA_PROJECT_ID");
  envVarCheck(process.env.HARDHAT_NETWORK, "ETHERSCAN_API_KEY");
  envVarCheck(process.env.ETHERSCAN_API_KEY, "HARDHAT_NETWORK");

  return true;
}

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  checkEnvVariables,
  timeout
};