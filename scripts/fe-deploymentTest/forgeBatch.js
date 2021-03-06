require("dotenv").config();
const bre = require("hardhat");
const {expect} = require("chai");
const {ethers} = require("hardhat");
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
  // compìle contracts
  await bre.run("compile");

  
  [owner, ...addrs] = await ethers.getSigners();

  const maxL1Tx = 256;
  const maxTx = 512;
  const nLevels = 32;
  const l1TxBytes = 72;
  const network = await owner.provider.getNetwork();
  const chainID = network.chainId;
  const rollupDB = await RollupDB(new SMTMemDB(), chainID);

  const Hermez = await ethers.getContractFactory("HermezTest");

  hardhatHermez = Hermez.attach(process.env.HERMEZ_ADDRESS);

  // sync previous l1 tx
  const currentQueue = await hardhatHermez.nextL1ToForgeQueue();
  for (let i = 0; i < currentQueue; i++) {
    const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

    // filter L1UserTxEvent for queueIndex
    const filter = hardhatHermez.filters.L1UserTxEvent(i, null, null);
    let events = await hardhatHermez.queryFilter(filter, 0, "latest");
    events.forEach((e) => {
      bb.addTx(txUtils.decodeL1TxFull(e.args.l1UserTx));
    });
    await bb.build();
    await rollupDB.consolidate(bb);
  }

  // build current batch with current L1Tx queue
  const bbCurrent = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);
  const l1TxForged = [];
  //await hardhatHermez.createAccountDeposit(0, 0, 0);
  let SCL1TxData = await hardhatHermez.mapL1TxQueue(currentQueue);
  SCL1TxData = SCL1TxData.slice(2);
  // 1 byte, 2 characters in hex String
  const l1TxLen = SCL1TxData.length / (l1TxBytes * 2);
  for (let i = 0; i < l1TxLen; i++) {
    const lastChar = i * l1TxBytes * 2;
    const currentHexChar = (i + 1) * l1TxBytes * 2;
    const currenTx = SCL1TxData.slice(lastChar, currentHexChar);
    const decodedTx = txUtils.decodeL1Tx(currenTx);
    l1TxForged.push(decodedTx);
    bbCurrent.addTx(decodedTx);
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
  const compressedL1CoordinatorTx = "0x";
  const L2TxsData = bbCurrent.getL2TxsDataSM();
  const feeIdxCoordinator = bbCurrent.getFeeTxsDataSM();
  const verifierIdx = 0;
  const l1Batch = true;
  await expect(
    hardhatHermez.calculateInputTest(
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
    .to.emit(hardhatHermez, "ReturnUint256")
    .withArgs(bbCurrent.getHashInputs());

  const tx = await hardhatHermez.forgeBatch(
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

  await rollupDB.consolidate(bbCurrent);
  
  const batchFoged = rollupDB.lastBatch;

  console.log(`batch ${batchFoged} forged!`);
  console.log(`${l1TxForged.length} transactions forged`);
  if (l1TxForged.length != 0) {
    for(let i = 0; i < l1TxForged.length; i++ )
    {
      console.log(l1TxForged[i]);
      if(l1TxForged[i].toIdx == 1) {
        const exitInfo = await rollupDB.getExitTreeInfo(l1TxForged[i].fromIdx, batchFoged);
        console.log("/////////////////////////////////////////////////////////////////");
        console.log("withdraw con be performed with the following params:");
        console.log("numExitRoot:" + batchFoged);
        console.log("sibilings: ", exitInfo.siblings);
        console.log("/////////////////////////////////////////////////////////////////");

      }
    }
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
