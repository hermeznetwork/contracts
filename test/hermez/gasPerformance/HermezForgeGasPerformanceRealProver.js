const { expect } = require("chai");
const { ethers } = require("hardhat");
const SMTMemDB = require("circomlib").SMTMemDB;
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const axios = require("axios");
const {
  l1UserTxCreateAccountDeposit,
  l1UserTxDeposit,
  l1UserTxDepositTransfer,
  l1UserTxCreateAccountDepositTransfer,
  l1UserTxForceTransfer,
  l1UserTxForceExit,
  l1CoordinatorTxBjj,
  l1CoordinatorTxEth,
  AddToken,
  ForgerTest,
  calculateInputMaxTxLevels
} = require("../helpers/helpers");
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
const INITIAL_DELAY = 0;
const { stringifyBigInts, unstringifyBigInts } = require("ffjavascript").utils;


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe("Hermez gas performance", function () {
  let hardhatTokenERC20Mock;
  let hardhatHermez;
  let hardhatWithdrawalDelayer;
  let hardhatHEZ;
  let owner;
  let id1;
  let id2;
  let addrs;
  let hermezGovernanceAddress;
  let ownerWallet;

  let chainID;
  let chainIDHex;
  let forgerTest;
  
  const accounts = [];
  for (let i = 0; i < 10; i++) {
    accounts.push(new HermezAccount());
  }
  const tokenInitialAmount = 1000000;
  const maxL1Tx = 256;
  const maxTx = 376;
  const nLevels = 32;
  const forgeL1L2BatchTimeout = 10;
  const feeAddToken = 10;
  const withdrawalDelay = 60 * 60 * 24 * 7 * 2; // 2 weeks

  beforeEach(async function () {
    [
      owner,
      governance,
      id1,
      id2,
      ...addrs
    ] = await ethers.getSigners();

    hermezGovernanceAddress = governance.getAddress();

    const chainIdProvider = (await ethers.provider.getNetwork()).chainId;
    if (chainIdProvider == 1337) { // solcover, must be a jsonRPC wallet
      const mnemonic = "explain tackle mirror kit van hammer degree position ginger unfair soup bonus";
      let ownerWalletTest = ethers.Wallet.fromMnemonic(mnemonic);
      // ownerWalletTest = ownerWallet.connect(ethers.provider);
      ownerWallet = owner;
      ownerWallet.privateKey = ownerWalletTest.privateKey;
    }
    else {
      ownerWallet = new ethers.Wallet(ethers.provider._hardhatProvider._genesisAccounts[0].privateKey, ethers.provider);
    }

    // factory helpers
    const TokenERC20Mock = await ethers.getContractFactory("ERC20Mock");
    const TokenERC20PermitMock = await ethers.getContractFactory("ERC20PermitMock");

    const VerifierRollupHelper = await ethers.getContractFactory(
      "Verifier"
    );
    const VerifierWithdrawHelper = await ethers.getContractFactory(
      "VerifierWithdrawHelper"
    );
    const HermezAuctionTest = await ethers.getContractFactory(
      "HermezAuctionTest"
    );
    const WithdrawalDelayer = await ethers.getContractFactory(
      "WithdrawalDelayerTest"
    );
    const Poseidon2Elements = new ethers.ContractFactory(
      poseidonUnit.generateABI(2),
      poseidonUnit.createCode(2),
      owner
    );

    const Poseidon3Elements = new ethers.ContractFactory(
      poseidonUnit.generateABI(3),
      poseidonUnit.createCode(3),
      owner
    );
    const Poseidon4Elements = new ethers.ContractFactory(
      poseidonUnit.generateABI(4),
      poseidonUnit.createCode(4),
      owner
    );
    const hardhatPoseidon2Elements = await Poseidon2Elements.deploy();
    const hardhatPoseidon3Elements = await Poseidon3Elements.deploy();
    const hardhatPoseidon4Elements = await Poseidon4Elements.deploy();

    const poseidonAddr2 = hardhatPoseidon2Elements.address;
    const poseidonAddr3 = hardhatPoseidon3Elements.address;
    const poseidonAddr4 = hardhatPoseidon4Elements.address;



    // factory hermez
    const Hermez = await ethers.getContractFactory("HermezTest");

    // deploy tokens
    hardhatTokenERC20Mock = await TokenERC20Mock.deploy(
      "tokenname",
      "TKN",
      await owner.getAddress(),
      tokenInitialAmount
    );

    hardhatHEZ = await TokenERC20PermitMock.deploy(
      "tokenname",
      "TKN",
      await owner.getAddress(),
      tokenInitialAmount
    );

    let hardhatVerifierRollupHelper = await VerifierRollupHelper.deploy();
    let hardhatVerifierWithdrawHelper = await VerifierWithdrawHelper.deploy();
    let hardhatHermezAuctionTest = await HermezAuctionTest.deploy();

    // deploy hermez
    hardhatHermez = await Hermez.deploy();
    await hardhatHermez.deployed();
    hardhatWithdrawalDelayer = await WithdrawalDelayer.deploy();
    await hardhatWithdrawalDelayer.withdrawalDelayerInitializer(
      INITIAL_DELAY,
      hardhatHermez.address,
      hermezGovernanceAddress,
      hermezGovernanceAddress
    );

    // deploy hermez

    await hardhatHermez.initializeHermez(
      [hardhatVerifierRollupHelper.address],
      calculateInputMaxTxLevels([maxTx], [nLevels]),
      hardhatVerifierWithdrawHelper.address,
      hardhatHermezAuctionTest.address,
      hardhatHEZ.address,
      forgeL1L2BatchTimeout,
      feeAddToken,
      poseidonAddr2,
      poseidonAddr3,
      poseidonAddr4,
      hermezGovernanceAddress,
      withdrawalDelay,
      hardhatWithdrawalDelayer.address
    );

    // wait until is deployed
    await hardhatTokenERC20Mock.deployed();
    const chainSC = await hardhatHermez.getChainID();
    chainID = chainSC.toNumber();
    chainIDHex = chainSC.toHexString();
    const rollupDB = await RollupDB(new SMTMemDB(), chainID);
    forgerTest = new ForgerTestGas(
      maxTx,
      maxL1Tx,
      nLevels,
      hardhatHermez,
      rollupDB,
      true
    );
  });

  describe("Test Queue", function () {
    it("Gas report l1 operator tx", async function () {
      this.timeout(0);
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const l1TxCoordiatorArray = [];

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );

      const SCGasArray = [];
      const wastedGasarray = [];

      await forgerTest.forgeBatch(true, [], []);

      console.log(
        "|   SC gas left    | Decrement | wastedGas | Increment | operatorTx |"
      );
      console.log(
        "| -------- | --------- | --------- | --------- | ---------- |"
      );

      for (let i = 0; i < 124; i++) {
        if (i != 0) {
          await l1TxCoordiatorArray.push(
            await l1CoordinatorTxEth(tokenID, babyjub, owner, hardhatHermez, chainIDHex)
          );
        }

        let tx = await forgerTest.forgeBatch(true, [], l1TxCoordiatorArray);
        const receipt = await tx.wait();
        SCGasArray.push(receipt.events[1].args[0].toNumber());
        wastedGasarray.push(receipt.gasUsed.toNumber());

        // hackmd table
        let log = `|  ${SCGasArray[i]}    |`;
        log += ` ${(SCGasArray[i - 1] ? SCGasArray[i - 1] : SCGasArray[i]) -
          SCGasArray[i]
        }   |`;
        log += ` ${wastedGasarray[i]}   |`;
        log += ` ${wastedGasarray[i] -
          (wastedGasarray[i - 1] ? wastedGasarray[i - 1] : wastedGasarray[i])
        }   |`;
        log += ` ${i}   |`;
        console.log(log);
      }
    });

    it("Gas report l1 user creataccount tx", async function () {
      this.timeout(0);
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float16.float2Fix(float16.fix2Float(1));

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );

      const SCGasArray = [];
      const wastedGasarray = [];

      console.log(
        "|   SC gas left    | Decrement | wastedGas | Increment | user-tx-createAccount |"
      );
      console.log(
        "| -------- | --------- | --------- | --------- | ---------- |"
      );

      for (let i = 0; i < 124; i++) {
        const l1TxUserArray = [];

        for (let j = 0; j < i; j++) {
          l1TxUserArray.push(await l1UserTxCreateAccountDeposit(
            loadAmount,
            tokenID,
            babyjub,
            ownerWallet,
            hardhatHermez,
            hardhatTokenERC20Mock
          ));
        }


        await forgerTest.forgeBatch(true, [], []);
        const tx = await forgerTest.forgeBatch(true, l1TxUserArray, []);

        const receipt = await tx.wait();
        SCGasArray.push(receipt.events[1].args[0].toNumber());
        wastedGasarray.push(receipt.gasUsed.toNumber());

        // hackmd table
        let log = `|  ${SCGasArray[i]}    |`;
        log += ` ${(SCGasArray[i - 1] ? SCGasArray[i - 1] : SCGasArray[i]) -
          SCGasArray[i]
        }   |`;
        log += ` ${wastedGasarray[i]}   |`;
        log += ` ${wastedGasarray[i] -
          (wastedGasarray[i - 1] ? wastedGasarray[i - 1] : wastedGasarray[i])
        }   |`;
        log += ` ${i}   |`;
        console.log(log);
      }
    });
  });
});



class ForgerTestGas {
  constructor(maxTx, maxL1Tx, nLevels, hardhatHermez, rollupDB, realVerifier) {
    this.rollupDB = rollupDB;
    this.maxTx = maxTx;
    this.maxL1Tx = maxL1Tx;
    this.nLevels = nLevels;
    this.hardhatHermez = hardhatHermez;
    this.realVerifier = realVerifier;

    this.L1TxB = 544;
  }

  async forgeBatch(l1Batch, l1TxUserArray, l1TxCoordiatorArray, l2txArray) {
    const bb = await this.rollupDB.buildBatch(
      this.maxTx,
      this.nLevels,
      this.maxL1Tx
    );

    let jsL1TxData = "";
    for (let tx of l1TxUserArray) {
      bb.addTx(txUtils.decodeL1TxFull(tx));
      jsL1TxData = jsL1TxData + tx.slice(2);
    }

    // check L1 user tx are the same in batchbuilder and contract
    const currentQueue = await this.hardhatHermez.nextL1ToForgeQueue();
    const SCL1TxData = await this.hardhatHermez.mapL1TxQueue(currentQueue);

    expect(SCL1TxData).to.equal(`0x${jsL1TxData}`);


    if (l1TxCoordiatorArray) {
      for (let tx of l1TxCoordiatorArray) {
        bb.addTx(txUtils.decodeL1TxFull(tx.l1TxBytes));
      }
    }


    if (l2txArray) {
      for (let tx of l2txArray) {
        bb.addTx(tx);
      }
    }

    await bb.build();

    let stringL1CoordinatorTx = "";
    for (let tx of l1TxCoordiatorArray) {
      stringL1CoordinatorTx =
        stringL1CoordinatorTx + tx.l1TxCoordinatorbytes.slice(2); // retireve the 0x
    }


    let proofA, proofB, proofC;

    if (this.realVerifier == true) {
      // real verifier
      const inputJson = stringifyBigInts(bb.getInput());
      await axios.post("http://ec2-3-139-54-168.us-east-2.compute.amazonaws.com:3000/api/input", inputJson);
      let response;
      do {
        await sleep(1000);
        response = await axios.get("http://ec2-3-139-54-168.us-east-2.compute.amazonaws.com:3000/api/status");
      } while (response.data.status == "busy");

      proofA = [JSON.parse(response.data.proof).pi_a[0],
        JSON.parse(response.data.proof).pi_a[1]
      ];
      proofB = [
        [
          JSON.parse(response.data.proof).pi_b[0][1],
          JSON.parse(response.data.proof).pi_b[0][0]
        ],
        [
          JSON.parse(response.data.proof).pi_b[1][1],
          JSON.parse(response.data.proof).pi_b[1][0]
        ]
      ];
      proofC =  [JSON.parse(response.data.proof).pi_c[0],
        JSON.parse(response.data.proof).pi_c[1]
      ];    

      const input = JSON.parse(response.data.pubData);
      expect(input[0]).to.equal(bb.getHashInputs().toString());

    } else {
      // mock verifier
      proofA = ["0", "0"];
      proofB = [
        ["0", "0"],
        ["0", "0"],
      ];
      proofC = ["0", "0"];
    }

    const newLastIdx = bb.getNewLastIdx();
    const newStateRoot = bb.getNewStateRoot();
    const newExitRoot = bb.getNewExitRoot();
    const compressedL1CoordinatorTx = `0x${stringL1CoordinatorTx}`;
    const L1L2TxsData = bb.getL1L2TxsDataSM();
    const feeIdxCoordinator = bb.getFeeTxsDataSM();
    const verifierIdx = 0;

    let tx = await this.hardhatHermez.forgeGasTest(
      newLastIdx,
      newStateRoot,
      newExitRoot,
      compressedL1CoordinatorTx,
      L1L2TxsData,
      feeIdxCoordinator,
      verifierIdx,
      l1Batch,
      proofA,
      proofB,
      proofC,
      { gasLimit: 12500000 }
    );
    await this.rollupDB.consolidate(bb);
    return tx;
  }
}