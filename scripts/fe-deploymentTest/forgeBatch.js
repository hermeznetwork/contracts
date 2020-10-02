const bre = require("@nomiclabs/buidler");
const {expect} = require("chai");
require("dotenv").config();
const {ethers} = require("../../node_modules/@nomiclabs/buidler");
const {BigNumber} = require("ethers");
const SMTMemDB = require("circomlib").SMTMemDB;
const {
  float16,
  HermezAccount,
  txUtils,
  stateUtils,
  utils,
  feeTable,
  SMTTmpDb,
  Constants,
  RollupDB,
  BatchBuilder,
} = require("@hermeznetwork/commonjs");

async function main() {
  [owner, ...addrs] = await ethers.getSigners();

  const maxL1Tx = 256;
  const maxTx = 512;
  const nLevels = 32;
  const l1TxBytes = 72;
  const network = await owner.provider.getNetwork();
  const chainID = network.chainId;
  const rollupDB = await RollupDB(new SMTMemDB(), chainID);

  const Hermez = await ethers.getContractFactory("HermezTest");

  buidlerHermez = Hermez.attach(process.env.HERMEZ_ADDRESS);

  // check L1 user tx are the same in batchbuilder and contract
  const currentQueue = await buidlerHermez.nextL1ToForgeQueue();

  for (let i = 0; i < currentQueue; i++) {
    const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

    // filter for queueIndex
    const filter = buidlerHermez.filters.L1UserTxEvent(i, null, null);
    let events = await buidlerHermez.queryFilter(filter, 0, "latest");
    events.forEach((e) => {
      bb.addTx(txUtils.decodeL1Tx(e.args.l1UserTx));
    });
    await bb.build();
    await rollupDB.consolidate(bb);
  }

  const bbCurrent = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

  //await buidlerHermez.createAccountDeposit(0, 0, 0);
  let SCL1TxData = await buidlerHermez.mapL1TxQueue(currentQueue);
  SCL1TxData = SCL1TxData.slice(2);
  // 1 byte, 2 characters in hex String
  const l1TxLen = SCL1TxData.length / (l1TxBytes * 2);
  for (let i = 0; i < l1TxLen; i++) {
    const lastChar = i * l1TxBytes * 2;
    const currentHexChar = (i + 1) * l1TxBytes * 2;
    const currenTx = SCL1TxData.slice(lastChar, currentHexChar);
    bbCurrent.addTx(txUtils.decodeL1Tx(currenTx));
  }
  await bbCurrent.build();

  const proofA = ["0", "0"];
  const proofB = [
    ["0", "0"],
    ["0", "0"],
  ];
  const proofC = ["0", "0"];

  const newLastIdx = bbCurrent.getNewLastIdx();
  const newStateRoot = bbCurrent.getNewStateRoot();
  const newExitRoot = bbCurrent.getNewExitRoot();
  const compressedL1CoordinatorTx = `0x`;
  const L2TxsData = bbCurrent.getL2TxsDataSM();
  const feeIdxCoordinator = bbCurrent.getFeeTxsDataSM();
  const verifierIdx = 0;
  const l1Batch = true;
  await expect(
    buidlerHermez.calculateInputTest(
      newLastIdx,
      newStateRoot,
      newExitRoot,
      compressedL1CoordinatorTx,
      L2TxsData,
      feeIdxCoordinator,
      l1Batch,
      verifierIdx
    )
  )
    .to.emit(buidlerHermez, "ReturnUint256")
    .withArgs(bbCurrent.getHashInputs());

  const tx = await buidlerHermez.forgeBatch(
    newLastIdx,
    newStateRoot,
    newExitRoot,
    compressedL1CoordinatorTx,
    L2TxsData,
    feeIdxCoordinator,
    verifierIdx,
    true,
    proofA,
    proofB,
    proofC
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
