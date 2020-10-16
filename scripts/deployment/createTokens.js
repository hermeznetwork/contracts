require("dotenv").config();

const bre = require("@nomiclabs/buidler");
const ethers = bre.ethers;

const {AddToken} = require("../../test/hermez/helpers/helpers");
const fs = require("fs");
const path = require("path");

const tokenInitialAmount = ethers.BigNumber.from(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
);

const {argv} = require("yargs") // eslint-disable-line
  .version()
  .usage(
    `
node createTokens.js <options>
--numERC20PermitDeployments or --erc20Permit <number>
    Number of ERC20Permit tokens deployed. Default: 0
--numERC20Deployments or --erc20 <number>
    Number of ERC20 tokens deployed. Default: 0
--decimalsERC20 or --dec <number>
    Number of decimals of the ERC20, must be a uint8 (max value 255). Default: 18
--addTokensBool or --add <bool>
    Boolean, if "true" the token will be added to the rollup. Default: true
--numAccountsFund or --fund <number>
    Number of accounts, starting with index '0' of the mnemonic to fund with tokens of every token contract deployed. Default: 10
--tokenListPath or --tklist <path>
    Path of the tokenList. Default: ./tokenList.json
--deploymentOutputPath or --depout <path>
    Path of the deployment output. Default: ./deploy_output.json
`
  )
  .help("h")
  .alias("erc20p", "numERC20PermitDeployments")
  .alias("erc20", "numERC20Deployments")
  .alias("dec", "decimalsERC20")
  .alias("add", "addTokensBool")
  .alias("fund", "numAccountsFund")
  .alias("tklist", "tokenListPath")
  .alias("depout", "deploymentOutputPath");
async function main() {
  // compìle contracts
  await bre.run("compile");

  // load create tokens params
  const numERC20PermitDeployments = argv.numERC20PermitDeployments
    ? argv.numERC20PermitDeployments
    : 0;
  const numERC20Deployments = argv.numERC20Deployments
    ? argv.numERC20Deployments
    : 0;
  const decimalsERC20 = argv.decimalsERC20 ? argv.decimalsERC20 : 18;
  const addTokensBool = argv.addTokensBool ? argv.addTokensBool : true;
  const numAccountsFund = argv.numAccountsFund ? argv.numAccountsFund : 10;

  const pathtokenListJson = argv.tokenListPath ? argv.tokenListPath : path.join(__dirname, "./tokenList.json");
  const pathDeploymentOutputJson =  argv.deploymentOutputPath ? argv.deploymentOutputPath : path.join(__dirname, "./deploy_output.json");

  const deploymentOutputJson = require(pathDeploymentOutputJson);
  
  // get chain ID
  const chainId = (await ethers.provider.getNetwork()).chainId;

  // get signers
  [owner, ...addrs] = await ethers.getSigners();

  // // load outputTokens
  let tokenList = {};
  if (fs.existsSync(pathtokenListJson)) {
    tokenList = require(pathtokenListJson);
  }
  // load Hermez contract
  const Hermez = await ethers.getContractFactory("Hermez");
  const buidlerHermez = Hermez.attach(deploymentOutputJson.hermezAddress);

  // get ERC20Permit factory
  const ERC20PermitFactory = await ethers.getContractFactory("ERC20PermitMock");

  // load HEZ token
  const buidlerHeZToken = ERC20PermitFactory.attach(
    deploymentOutputJson.HEZTokenAddress
  );

  const feeAddtoken = await buidlerHermez.feeAddToken();
  // deploy all the ERC20Permit
  buidlerERC20Permit = [];
  for (let i = 0; i < numERC20PermitDeployments; i++) {
    buidlerERC20Permit[i] = await ERC20PermitFactory.deploy(
      "ERC20Permit_" + i,
      "20Permit_" + i,
      await owner.getAddress(),
      tokenInitialAmount,
    );
    await buidlerERC20Permit[i].deployed();

    // Send tokens to the other address
    for (let j = 0; j < numAccountsFund - 1; j++) {
      await buidlerERC20Permit[i].transfer(
        await addrs[j].getAddress(),
        ethers.utils.parseEther("10000")
      );
    }
    console.log("ERC20Permit Token deployed at: ", buidlerERC20Permit[i].address);
    //console.log({owner}, await ethers.provider.getNetwork());
    if (addTokensBool) {
      const tokenIndex = await AddToken(
        buidlerHermez,
        buidlerERC20Permit[i],
        buidlerHeZToken,
        owner,
        feeAddtoken
      );
      console.log(
        `Token added to Hermez with index: ${tokenIndex} and address: ${buidlerERC20Permit[i].address}`
      );
      tokenList[tokenIndex.toString()] = {};
      tokenList[tokenIndex.toString()].address = buidlerERC20Permit[i].address;
      tokenList[tokenIndex.toString()].type = "ERC20Permit";
    }
  }

  // get ERC20 factory
  const ERC20Factory = await ethers.getContractFactory("ERC20MockDecimals");
  // deploy all the ERC20
  buidlerERC20 = [];
  for (let i = 0; i < numERC20Deployments; i++) {
    buidlerERC20[i] = await ERC20Factory.deploy(
      "ERC20_" + i,
      "20_" + i,
      await owner.getAddress(),
      tokenInitialAmount,
      decimalsERC20
    );
    await buidlerERC20[i].deployed();

    // Send tokens to the other address
    for (let j = 0; j < numAccountsFund - 1; j++) {
      await buidlerERC20[i].transfer(
        await addrs[j].getAddress(),
        ethers.utils.parseEther("10000")
      );
    }
    console.log("ERC20 Token deployed at: ", buidlerERC20[i].address);
    if (addTokensBool) {
      const tokenIndex = await AddToken(
        buidlerHermez,
        buidlerERC20[i],
        buidlerHeZToken,
        owner,
        feeAddtoken
      );
      console.log(
        `Token added to Hermez with index: ${tokenIndex} and address: ${buidlerERC20[i].address}`
      );
      tokenList[tokenIndex.toString()] = {};
      tokenList[tokenIndex.toString()].address = buidlerERC20[i].address;
      tokenList[tokenIndex.toString()].type = "ERC20";
    }
  }
  fs.writeFileSync(pathtokenListJson, JSON.stringify(tokenList, null, 1));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
