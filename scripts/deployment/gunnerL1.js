require("dotenv").config();

const bre = require("@nomiclabs/buidler");
const ethers = bre.ethers;

const {
  l1UserTxCreateAccountDeposit,
  AddToken,
  l1UserTxForceExit,
  l1UserTxForceTransfer
} = require("../../test/hermez/helpers/helpers");
const path = require("path");
const crypto = require('crypto');
const utilsScalar = require("ffjavascript").utils;

const pathDeploymentOutputJson = path.join(__dirname, "./deploy_output.json");
const deploymentOutputJson = require(pathDeploymentOutputJson);
const tokenInitialAmount = ethers.BigNumber.from(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
);

const {
  float16,
} = require("@hermeznetwork/commonjs");

const {argv} = require("yargs") // eslint-disable-line
  .version()
  .usage(
    `
node gunnerL1.js <options>
--numCreateAccounts or --acc <number>
    Number of createAccounts Tx. Default: 0
--numTransfer or --tr <number>
    Number of forceTransfer Tx. Default: 0
--numExits or --ext <number>
    Number of forceExit Tx. Default: 0
`
  )
  .help("h")
  .alias("acc", "numCreateAccounts")
  .alias("tr", "numTransfer")
  .alias("ext", "numExits");

async function main() {
  // compìle contracts
  await bre.run("compile");

  // load create tokens params
  const numCreateAccounts = argv.numCreateAccounts ? argv.numCreateAccounts : 0;
  const numTransfer = argv.numTransfer ? argv.numTransfer : 0;
  const numExits = argv.numExits ? argv.numExits : 0;

  console.log({numCreateAccounts});
  [owner, ...addrs] = await ethers.getSigners();

  const Hermez = await ethers.getContractFactory("HermezTest");

  const buidlerHermez = Hermez.attach(deploymentOutputJson.hermezAddress);

  // get ERC777 factory
  const ERC777Factory = await ethers.getContractFactory("ERC777Mock");

  // load HEZ token
  const buidlerHeZToken = ERC777Factory.attach(
    deploymentOutputJson.HEZTokenAddress
  );

  const feeAddtoken = await buidlerHermez.feeAddToken();
  // deploy all the ERC777

  const buidlerERC777 = await ERC777Factory.deploy(
    await owner.getAddress(),
    tokenInitialAmount,
    "ERC777_",
    "777_",
    []
  );
  await buidlerERC777.deployed();

  const tokenIndex = await AddToken(
    buidlerHermez,
    buidlerERC777,
    buidlerHeZToken,
    await owner.getAddress(),
    feeAddtoken
  );
  console.log(
    `Token added to Hermez with index: ${tokenIndex} and address: ${buidlerERC777.address}`
  );



  // if hermez test set the last idx, temporally solution 
  if (process.env.TEST == "true") {
    const newLastIdx = 1000;
    await buidlerHermez.setLastIdx(newLastIdx);
    // forge boot coordinator
    // advence to genesis block

    // // forge fake batch for set up gunner enviroment, must bid first
    // await buidlerHermez.forgeBatch(
    // const newStRoot = 0;
    // const newExitRoot = '0x10a89d5fe8d488eda1ba371d633515739933c706c210c604f5bd209180daa43b';
    // const encodedL1CoordinatorTx = "0x"
    // const l2TxsData = "0x"
    // const feeIdxCoordinator = "0x"
    // const verifierIdx = 0;
    // const l1Batch = true;
    // const proofA = ["0", "0"];
    // const proofB = [
    //   ["0", "0"],
    //   ["0", "0"],
    // ];
    // const proofC = ["0", "0"];
    // await buidlerHermez.forgeBatch(
    //   newLastIdx,
    //   newStRoot,
    //   newExitRoot,
    //   encodedL1CoordinatorTx,
    //   l2TxsData,
    //   feeIdxCoordinator,
    //   verifierIdx,
    //   l1Batch,
    //   proofA,
    //   proofB,
    //   proofC
    // );
  }
  // create accounts
  for (let i = 0; i < numCreateAccounts; i++) {
    const tokenID = tokenIndex;
    const babyjub = "0x001021212123";
    const isERC777 = true;
    const loadAmount = 10;
    await l1UserTxCreateAccountDeposit(
      loadAmount,
      tokenID,
      babyjub,
      owner,
      buidlerHermez,
      buidlerERC777,
      isERC777
    );
    console.log("account created! " + i);
  }

  // suppose 1000 accounts are already created
  const maxIdx = 1000; // check on contract maxIDx!
  const minIdx = 255;

  // force transfers
  for (let i = 0; i < numTransfer; i++) {
    const tokenID = tokenIndex;
    const fromIdx =  crypto.randomInt(minIdx, maxIdx);
    const toIdx =  crypto.randomInt(minIdx, maxIdx);
    const amount = utilsScalar.leBuff2int(crypto.randomBytes(14)); // 192 bits (24 bytes) deberia, pero solo agaunta 14.5 
    const amountF = float16.fix2Float(amount);
    const isERC777 = true;

    await l1UserTxForceTransfer(
      tokenID,
      fromIdx,
      toIdx,
      amountF,
      owner,
      buidlerHermez,
      isERC777
    );
    console.log("force transfer!" + i);
  }
  // force exits
  for (let i = 0; i < numExits; i++) {
    const tokenID = tokenIndex;
    const fromIdx =  crypto.randomInt(minIdx, maxIdx);;
    const amount = utilsScalar.leBuff2int(crypto.randomBytes(14)); // 192 bits
    const amountF = float16.fix2Float(amount);
    await l1UserTxForceExit(
      tokenID,
      fromIdx,
      amountF,
      owner,
      buidlerHermez,
    );
    console.log("force exit! " + i);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
