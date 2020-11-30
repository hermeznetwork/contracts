const { expect } = require("chai");
const { ethers } = require("../../node_modules/@nomiclabs/buidler");
const SMTMemDB = require("circomlib").SMTMemDB;
const { time } = require("@openzeppelin/test-helpers");
const Scalar = require("ffjavascript").Scalar;

const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const {
  signBjjAuth,
  l1UserTxCreateAccountDeposit,
  l1UserTxDeposit,
  l1UserTxDepositTransfer,
  l1UserTxCreateAccountDepositTransfer,
  l1UserTxForceTransfer,
  l1UserTxForceExit,
  l1CoordinatorTxEth,
  l1CoordinatorTxBjj,
  AddToken,
  createAccounts,
  ForgerTest,
  calculateInputMaxTxLevels
} = require("./helpers/helpers");
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

describe("Hermez ERC 20", function () {
  let buidlerTokenERC20Mock;
  let buidlerHermez;
  let buidlerWithdrawalDelayer;
  let buidlerHEZ;

  let owner;
  let id1;
  let id2;
  let addrs;
  let hermezGovernanceAddress;
  let ownerWallet;

  let chainID;
  let chainIDHex;

  const accounts = [];
  for (let i = 0; i < 10; i++) {
    accounts.push(new HermezAccount());
  }
  const tokenInitialAmount = 1000000;
  const maxL1Tx = 256;
  const maxTx = 512;
  const nLevels = 32;
  const forgeL1L2BatchTimeout = 10;
  const feeAddToken = 10;
  const withdrawalDelay = 60 * 60 * 24 * 7 * 2; // 2 weeks
  const INITIAL_DELAY = 0;

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
      ownerWallet = new ethers.Wallet(ethers.provider._buidlerProvider._genesisAccounts[0].privateKey, ethers.provider);
    }

    // const privateKeyBuidler =
    //   "0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122";
    // ownerWallet = new ethers.Wallet(
    //   privateKeyBuidler,
    //   ethers.provider
    // );
    //ownerWallet = new ethers.Wallet(ethers.provider._buidlerProvider._genesisAccounts[0].privateKey, ethers.provider);

    // factory helpers
    const TokenERC20Mock = await ethers.getContractFactory("ERC20Mock");
    const TokenERC20PermitMock = await ethers.getContractFactory("ERC20PermitMock");

    const VerifierRollupHelper = await ethers.getContractFactory(
      "VerifierRollupHelper"
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
    const buidlerPoseidon2Elements = await Poseidon2Elements.deploy();
    const buidlerPoseidon3Elements = await Poseidon3Elements.deploy();
    const buidlerPoseidon4Elements = await Poseidon4Elements.deploy();

    const poseidonAddr2 = buidlerPoseidon2Elements.address;
    const poseidonAddr3 = buidlerPoseidon3Elements.address;
    const poseidonAddr4 = buidlerPoseidon4Elements.address;



    // factory hermez
    const Hermez = await ethers.getContractFactory("HermezTest");

    // deploy tokens
    buidlerTokenERC20Mock = await TokenERC20Mock.deploy(
      "tokenname",
      "TKN",
      await owner.getAddress(),
      tokenInitialAmount
    );

    buidlerHEZ = await TokenERC20PermitMock.deploy(
      "tokenname",
      "TKN",
      await owner.getAddress(),
      tokenInitialAmount
    );

    // deploy helpers
    let buidlerVerifierRollupHelper = await VerifierRollupHelper.deploy();
    let buidlerVerifierWithdrawHelper = await VerifierWithdrawHelper.deploy();

    let buidlerHermezAuctionTest = await HermezAuctionTest.deploy();

    // deploy hermez
    buidlerHermez = await Hermez.deploy();
    await buidlerHermez.deployed();

    buidlerWithdrawalDelayer = await WithdrawalDelayer.deploy();
    await buidlerWithdrawalDelayer.withdrawalDelayerInitializer(
      INITIAL_DELAY,
      buidlerHermez.address,
      hermezGovernanceAddress,
      hermezGovernanceAddress
    );

    // deploy hermez
    await buidlerHermez.initializeHermez(
      [buidlerVerifierRollupHelper.address],
      calculateInputMaxTxLevels([maxTx], [nLevels]),
      buidlerVerifierWithdrawHelper.address,
      buidlerHermezAuctionTest.address,
      buidlerHEZ.address,
      forgeL1L2BatchTimeout,
      feeAddToken,
      poseidonAddr2,
      poseidonAddr3,
      poseidonAddr4,
      hermezGovernanceAddress,
      withdrawalDelay,
      buidlerWithdrawalDelayer.address
    );

    // wait until is deployed
    await buidlerTokenERC20Mock.deployed();

    const chainSC = await buidlerHermez.getChainID();
    chainID = chainSC.toNumber();
    chainIDHex = chainSC.toHexString();
  });

  describe("test tokens contract", function () {
    it("Should share tokens", async function () {
      await buidlerTokenERC20Mock.transfer(await id1.getAddress(), 50);
      const id1Balance = await buidlerTokenERC20Mock.balanceOf(
        await id1.getAddress()
      );
      expect(id1Balance).to.equal(50);

      await buidlerTokenERC20Mock.transfer(await id2.getAddress(), 50);

      const id2Balance = await buidlerTokenERC20Mock.balanceOf(
        await id2.getAddress()
      );
      expect(id2Balance).to.equal(50);
    });
  });

  describe("Utils", function () {
    it("should revert if token with 0 supply", async function () {

      const TokenERC20Mock = await ethers.getContractFactory("ERC20Mock");
      // deploy tokens
      const token_zero_supply = await TokenERC20Mock.deploy(
        "tokenname",
        "TKN",
        await owner.getAddress(),
        0
      );
      await expect(AddToken(
        buidlerHermez,
        token_zero_supply,
        buidlerHEZ,
        ownerWallet,
        feeAddToken
      )).to.be.revertedWith("TOTAL_SUPPLY_ZERO");

    });

    it("Add Token", async function () {
      await AddToken(
        buidlerHermez,
        buidlerTokenERC20Mock,
        buidlerHEZ,
        ownerWallet,
        feeAddToken
      );

      expect(await buidlerHEZ.balanceOf(hermezGovernanceAddress))
        .to.be.equal(await buidlerHermez.feeAddToken());
    });
  });

  // You can nest describe calls to create subsections.
  describe("L1-user-Tx", function () {
    it("createAccountDeposit", async function () {
      await AddToken(
        buidlerHermez,
        buidlerTokenERC20Mock,
        buidlerHEZ,
        ownerWallet,
        feeAddToken
      );

      const loadAmount = float16.float2Fix(float16.fix2Float(1000));
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      await l1UserTxCreateAccountDeposit(
        loadAmount,
        tokenID,
        babyjub,
        owner,
        buidlerHermez,
        buidlerTokenERC20Mock
      );
    });

    it("deposit", async function () {
      await AddToken(
        buidlerHermez,
        buidlerTokenERC20Mock,
        buidlerHEZ,
        ownerWallet,
        feeAddToken
      );

      // invalid operation in Hermez.sol, test purposes
      buidlerHermez.changeCurrentIdx(257);

      const loadAmount = float16.float2Fix(float16.fix2Float(1000));
      const tokenID = 1;
      const fromIdx = 256;
      await l1UserTxDeposit(
        loadAmount,
        tokenID,
        fromIdx,
        owner,
        buidlerHermez,
        buidlerTokenERC20Mock
      );
    });
    it("depositTransfer", async function () {
      await AddToken(
        buidlerHermez,
        buidlerTokenERC20Mock,
        buidlerHEZ,
        ownerWallet,
        feeAddToken
      );

      // invalid operation in Hermez.sol, test purposes
      buidlerHermez.changeCurrentIdx(257);

      const loadAmount = float16.float2Fix(float16.fix2Float(1000));
      const tokenID = 1;
      const fromIdx = 256;
      const toIdx = 257;
      const amountF = float16.fix2Float(10);
      await l1UserTxDepositTransfer(
        loadAmount,
        tokenID,
        fromIdx,
        toIdx,
        amountF,
        owner,
        buidlerHermez,
        buidlerTokenERC20Mock
      );
    });
    it("createAccountDepositTransfer", async function () {
      await AddToken(
        buidlerHermez,
        buidlerTokenERC20Mock,
        buidlerHEZ,
        ownerWallet,
        feeAddToken
      );

      // invalid operation in Hermez.sol, test purposes
      buidlerHermez.changeCurrentIdx(257);

      const loadAmount = float16.float2Fix(float16.fix2Float(1000));
      const tokenID = 1;
      const toIdx = 257;
      const amountF = float16.fix2Float(10);
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      await l1UserTxCreateAccountDepositTransfer(
        loadAmount,
        tokenID,
        toIdx,
        amountF,
        babyjub,
        owner,
        buidlerHermez,
        buidlerTokenERC20Mock
      );
    });
    it("forceTransfer", async function () {
      await AddToken(
        buidlerHermez,
        buidlerTokenERC20Mock,
        buidlerHEZ,
        ownerWallet,
        feeAddToken
      );

      // invalid operation in Hermez.sol, test purposes
      buidlerHermez.changeCurrentIdx(257);

      const tokenID = 1;
      const fromIdx = 256;
      const toIdx = 257;
      const amountF = float16.fix2Float(10);
      await l1UserTxForceTransfer(
        tokenID,
        fromIdx,
        toIdx,
        amountF,
        owner,
        buidlerHermez
      );
    });
    it("forceExit", async function () {
      await AddToken(
        buidlerHermez,
        buidlerTokenERC20Mock,
        buidlerHEZ,
        ownerWallet,
        feeAddToken
      );

      // invalid operation in Hermez.sol, test purposes
      buidlerHermez.changeCurrentIdx(257);

      const tokenID = 1;
      const fromIdx = 256;
      const amountF = float16.fix2Float(10);
      await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, buidlerHermez);
    });
  });

  describe("Forge Batch", function () {
    it("test L1 deadline", async function () {
      // dummy batch
      const proofA = ["0", "0"];
      const proofB = [
        ["0", "0"],
        ["0", "0"],
      ];
      const proofC = ["0", "0"];

      const newLastIdx = 255; // first idx
      const newStateRoot = 0;
      const newExitRoot = 0;
      const compressedL1CoordinatorTx = "0x00";
      const L2TxsData = "0x00";
      const feeIdxCoordinator = `0x${utils.padZeros(
        "",
        ((nLevels * 64) / 8) * 2
      )}`;
      const verifierIdx = 0;

      let currentBlock = await time.latestBlock();
      await time.advanceBlockTo(
        currentBlock.toNumber() + forgeL1L2BatchTimeout
      );
      // forgeL1L2BatchTimeout = 10

      await expect(
        buidlerHermez.forgeBatch(
          newLastIdx,
          newStateRoot,
          newExitRoot,
          compressedL1CoordinatorTx,
          L2TxsData,
          feeIdxCoordinator,
          verifierIdx,
          false,
          proofA,
          proofB,
          proofC
        )
      ).to.be.revertedWith("Hermez::forgeBatch: L1L2BATCH_REQUIRED");

      // must forge an L1 batch
      await buidlerHermez.forgeBatch(
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
      // can continue forging l2 batches
      await buidlerHermez.forgeBatch(
        newLastIdx,
        newStateRoot,
        newExitRoot,
        compressedL1CoordinatorTx,
        L2TxsData,
        feeIdxCoordinator,
        verifierIdx,
        false,
        proofA,
        proofB,
        proofC
      );
      currentBlock = await time.latestBlock();
      await time.advanceBlockTo(
        currentBlock.toNumber() + forgeL1L2BatchTimeout
      );
      await expect(
        buidlerHermez.forgeBatch(
          newLastIdx,
          newStateRoot,
          newExitRoot,
          compressedL1CoordinatorTx,
          L2TxsData,
          feeIdxCoordinator,
          verifierIdx,
          false,
          proofA,
          proofB,
          proofC
        )
      ).to.be.revertedWith("Hermez::forgeBatch: L1L2BATCH_REQUIRED");
    });

    it("handle L1 Coordinator Queue Test", async function () {
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const currentQueue = await buidlerHermez.nextL1ToForgeQueue();

      await AddToken(
        buidlerHermez,
        buidlerTokenERC20Mock,
        buidlerHEZ,
        ownerWallet,
        feeAddToken
      );
      const l1TxCoordiatorArray = [];
      // L1-Tx Coordinator with eth signature
      l1TxCoordiatorArray.push(
        await l1CoordinatorTxEth(tokenID, babyjub, owner, buidlerHermez, chainIDHex)
      );

      // L1-Tx Coordinator without eth signature:
      l1TxCoordiatorArray.push(
        await l1CoordinatorTxBjj(tokenID, babyjub, buidlerHermez)
      );

      let stringL1CoordinatorTx = "";
      for (let tx of l1TxCoordiatorArray) {
        stringL1CoordinatorTx =
          stringL1CoordinatorTx + tx.l1TxCoordinatorbytes.slice(2); // retireve the 0x
      }

      // simulate l1-tx batchbuilder:
      const fromEthAddrB = 160;
      const fromBjjCompressedB = 256;
      const f16B = 16;
      const tokenIDB = 32;
      const maxIdxB = 48;

      const L1TxB =
        fromEthAddrB + fromBjjCompressedB + 2 * maxIdxB + tokenIDB + 2 * f16B;

      let jsL1TxData = "";
      for (let tx of l1TxCoordiatorArray) {
        jsL1TxData = jsL1TxData + tx.l1TxBytes.slice(2);
      }
      const dataNopTx = utils.padZeros("", (maxL1Tx - 2) * (L1TxB / 4));
      const simulateBatchbuilderL1TxData = `0x${jsL1TxData + dataNopTx}`;

      const proofA = ["0", "0"];
      const proofB = [
        ["0", "0"],
        ["0", "0"],
      ];
      const proofC = ["0", "0"];

      await expect(
        buidlerHermez.handleL1QueueTest(
          0,
          0,
          0,
          `0x${stringL1CoordinatorTx}`,
          "0x",
          "0x",
          0,
          0,
          proofA,
          proofB,
          proofC
        )
      )
        .to.emit(buidlerHermez, "ReturnBytes")
        .withArgs(simulateBatchbuilderL1TxData);
    });

    it("forge L1-Coordiator-tx Batch ", async function () {
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;

      const l1TxCoordiatorArray = [];
      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        buidlerHermez,
        rollupDB
      );

      await AddToken(
        buidlerHermez,
        buidlerTokenERC20Mock,
        buidlerHEZ,
        ownerWallet,
        feeAddToken
      );

      l1TxCoordiatorArray.push(
        await l1CoordinatorTxEth(tokenID, babyjub, owner, buidlerHermez, chainIDHex)
      );

      l1TxCoordiatorArray.push(
        await l1CoordinatorTxBjj(tokenID, babyjub, buidlerHermez)
      );

      // forge Batch
      await forgerTest.forgeBatch(true, [], l1TxCoordiatorArray);

      // after forge, next queue is empty
      const currentQueue = await buidlerHermez.nextL1ToForgeQueue();
      expect("0x").to.equal(await buidlerHermez.mapL1TxQueue(currentQueue));
    });

    it("expect L1-Tx Queue same as batchbuilder ", async function () {
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float16.float2Fix(float16.fix2Float(1000));
      const fromIdx = 256;
      const toIdx = 257;
      const amountF = float16.fix2Float(10);

      const l1TxCoordiatorArray = [];
      const l1TxUserArray = [];

      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        buidlerHermez,
        rollupDB
      );

      await AddToken(
        buidlerHermez,
        buidlerTokenERC20Mock,
        buidlerHEZ,
        ownerWallet,
        feeAddToken
      );

      // In order to add all the possible l1tx we need 2 accounts created in batchbuilder and rollup:
      const numAccounts = 2;
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        owner,
        buidlerHermez,
        buidlerTokenERC20Mock,
        numAccounts
      );

      // add user l1 tx
      l1TxUserArray.push(
        await l1UserTxCreateAccountDeposit(
          loadAmount,
          tokenID,
          babyjub,
          owner,
          buidlerHermez,
          buidlerTokenERC20Mock
        )
      );
      l1TxUserArray.push(
        await l1UserTxDeposit(
          loadAmount,
          tokenID,
          fromIdx,
          owner,
          buidlerHermez,
          buidlerTokenERC20Mock
        )
      );
      l1TxUserArray.push(
        await l1UserTxDepositTransfer(
          loadAmount,
          tokenID,
          fromIdx,
          toIdx,
          amountF,
          owner,
          buidlerHermez,
          buidlerTokenERC20Mock
        )
      );
      l1TxUserArray.push(
        await l1UserTxCreateAccountDepositTransfer(
          loadAmount,
          tokenID,
          toIdx,
          amountF,
          babyjub,
          owner,
          buidlerHermez,
          buidlerTokenERC20Mock
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceTransfer(
          tokenID,
          fromIdx,
          toIdx,
          amountF,
          owner,
          buidlerHermez
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, buidlerHermez)
      );

      // forge empty batch, now the current queue is filled with the L1-User-Tx
      await forgerTest.forgeBatch(true, [], []);

      // add L1-Tx Coordinator with eth signature
      const cordinatorTxEth = await l1CoordinatorTxEth(
        tokenID,
        babyjub,
        owner,
        buidlerHermez,
        chainIDHex
      );

      // add L1-Tx Coordinator without eth signature:
      const coordinatorTxBjj = await l1CoordinatorTxBjj(
        tokenID,
        babyjub,
        buidlerHermez
      );

      l1TxCoordiatorArray.push(cordinatorTxEth);
      l1TxCoordiatorArray.push(coordinatorTxBjj);

      const fromEthAddrB = 160;
      const fromBjjCompressedB = 256;
      const f16B = 16;
      const tokenIDB = 32;
      const maxIdxB = 48;

      const L1TxB =
        fromEthAddrB + fromBjjCompressedB + 2 * maxIdxB + tokenIDB + 2 * f16B;
      // simulate l1-tx batchbuilder:
      let jsL1TxData = "";
      for (let tx of l1TxUserArray) {
        jsL1TxData = jsL1TxData + tx.slice(2);
      }
      for (let tx of l1TxCoordiatorArray) {
        jsL1TxData = jsL1TxData + tx.l1TxBytes.slice(2);
      }
      const dataNopTx = utils.padZeros(
        "",
        (maxL1Tx - l1TxUserArray.length - l1TxCoordiatorArray.length) *
        (L1TxB / 4)
      );
      const simulateBatchbuilderL1TxData = `0x${jsL1TxData + dataNopTx}`;

      let stringL1CoordinatorTx = "";
      for (let tx of l1TxCoordiatorArray) {
        stringL1CoordinatorTx =
          stringL1CoordinatorTx + tx.l1TxCoordinatorbytes.slice(2); // retireve the 0x
      }

      const proofA = ["0", "0"];
      const proofB = [
        ["0", "0"],
        ["0", "0"],
      ];
      const proofC = ["0", "0"];

      await expect(
        buidlerHermez.handleL1QueueTest(
          0,
          0,
          0,
          `0x${stringL1CoordinatorTx}`,
          "0x",
          "0x",
          0,
          true,
          proofA,
          proofB,
          proofC
        )
      )
        .to.emit(buidlerHermez, "ReturnBytes")
        .withArgs(simulateBatchbuilderL1TxData);
    });

    it("forge L1 user & Coordiator Tx batch", async function () {
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float16.float2Fix(float16.fix2Float(1000));
      const fromIdx = 256;
      const toIdx = 257;
      const amountF = float16.fix2Float(10);

      const l1TxUserArray = [];

      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        buidlerHermez,
        rollupDB
      );

      await AddToken(
        buidlerHermez,
        buidlerTokenERC20Mock,
        buidlerHEZ,
        ownerWallet,
        feeAddToken
      );

      // In order to add all the possible l1tx we need 2 accounts created in batchbuilder and rollup:
      const numAccounts = 2;
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        owner,
        buidlerHermez,
        buidlerTokenERC20Mock,
        numAccounts
      );

      // add user l1 tx
      l1TxUserArray.push(
        await l1UserTxCreateAccountDeposit(
          loadAmount,
          tokenID,
          babyjub,
          owner,
          buidlerHermez,
          buidlerTokenERC20Mock
        )
      );
      l1TxUserArray.push(
        await l1UserTxDeposit(
          loadAmount,
          tokenID,
          fromIdx,
          owner,
          buidlerHermez,
          buidlerTokenERC20Mock
        )
      );
      l1TxUserArray.push(
        await l1UserTxDepositTransfer(
          loadAmount,
          tokenID,
          fromIdx,
          toIdx,
          amountF,
          owner,
          buidlerHermez,
          buidlerTokenERC20Mock
        )
      );
      l1TxUserArray.push(
        await l1UserTxCreateAccountDepositTransfer(
          loadAmount,
          tokenID,
          toIdx,
          amountF,
          babyjub,
          owner,
          buidlerHermez,
          buidlerTokenERC20Mock
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceTransfer(
          tokenID,
          fromIdx,
          toIdx,
          amountF,
          owner,
          buidlerHermez
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, buidlerHermez)
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      const l1TxCoordiatorArray = [];

      // add Coordiator tx
      l1TxCoordiatorArray.push(
        await l1CoordinatorTxEth(tokenID, babyjub, owner, buidlerHermez, chainIDHex)
      );

      l1TxCoordiatorArray.push(
        await l1CoordinatorTxBjj(tokenID, babyjub, buidlerHermez)
      );

      // forge batch with all the L1 tx
      await forgerTest.forgeBatch(true, l1TxUserArray, l1TxCoordiatorArray);
    });

    it("test instant withdraw circuit", async function () {
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float16.float2Fix(float16.fix2Float(1000));
      const fromIdx = 256;
      const amount = 10;
      const amountF = float16.fix2Float(amount);

      const l1TxUserArray = [];

      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        buidlerHermez,
        rollupDB
      );

      await AddToken(
        buidlerHermez,
        buidlerTokenERC20Mock,
        buidlerHEZ,
        ownerWallet,
        feeAddToken
      );

      // Create account and exit some funds
      const numAccounts = 1;
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        owner,
        buidlerHermez,
        buidlerTokenERC20Mock,
        numAccounts
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, buidlerHermez)
      );

      const initialOwnerBalance = await buidlerTokenERC20Mock.balanceOf(
        await owner.getAddress()
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      // perform withdraw
      const numExitRoot = await buidlerHermez.lastForgedBatch();
      const instantWithdraw = true;
      const state = await rollupDB.getStateByIdx(256);
      const exitInfo = await rollupDB.getExitTreeInfo(256, numExitRoot);

      const proofA = ["0", "0"];
      const proofB = [
        ["0", "0"],
        ["0", "0"],
      ];
      const proofC = ["0", "0"];

      await expect(
        buidlerHermez.withdrawCircuit(
          proofA,
          proofB,
          proofC,
          tokenID,
          amount,
          numExitRoot,
          fromIdx,
          instantWithdraw
        )
      )
        .to.emit(buidlerHermez, "WithdrawEvent")
        .withArgs(fromIdx, numExitRoot, instantWithdraw);
      const finalOwnerBalance = await buidlerTokenERC20Mock.balanceOf(
        await owner.getAddress()
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + amount
      );
    });
    it("test delayed withdraw circuit", async function () {
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float16.float2Fix(float16.fix2Float(1000));
      const fromIdx = 256;
      const amount = 10;
      const amountF = float16.fix2Float(amount);

      const l1TxUserArray = [];

      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        buidlerHermez,
        rollupDB
      );

      await AddToken(
        buidlerHermez,
        buidlerTokenERC20Mock,
        buidlerHEZ,
        ownerWallet,
        feeAddToken
      );

      // Create account and exit some funds
      const numAccounts = 1;
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        owner,
        buidlerHermez,
        buidlerTokenERC20Mock,
        numAccounts
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, buidlerHermez)
      );

      const initialOwnerBalance = await buidlerTokenERC20Mock.balanceOf(
        buidlerWithdrawalDelayer.address
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      // perform withdraw
      const numExitRoot = await buidlerHermez.lastForgedBatch();
      const instantWithdraw = false;
      const state = await rollupDB.getStateByIdx(256);
      const exitInfo = await rollupDB.getExitTreeInfo(256, numExitRoot);

      const proofA = ["0", "0"];
      const proofB = [
        ["0", "0"],
        ["0", "0"],
      ];
      const proofC = ["0", "0"];

      await expect(
        buidlerHermez.withdrawCircuit(
          proofA,
          proofB,
          proofC,
          tokenID,
          amount,
          numExitRoot,
          fromIdx,
          instantWithdraw
        )
      )
        .to.emit(buidlerHermez, "WithdrawEvent")
        .withArgs(fromIdx, numExitRoot, instantWithdraw);

      const finalOwnerBalance = await buidlerTokenERC20Mock.balanceOf(
        buidlerWithdrawalDelayer.address
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + amount
      );
    });
    it("test instant withdraw merkle proof", async function () {
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float16.float2Fix(float16.fix2Float(1000));
      const fromIdx = 256;
      const amount = 10;
      const amountF = float16.fix2Float(amount);

      const l1TxUserArray = [];

      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        buidlerHermez,
        rollupDB
      );

      await AddToken(
        buidlerHermez,
        buidlerTokenERC20Mock,
        buidlerHEZ,
        ownerWallet,
        feeAddToken
      );

      // Create account and exit some funds
      const numAccounts = 1;
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        owner,
        buidlerHermez,
        buidlerTokenERC20Mock,
        numAccounts
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, buidlerHermez)
      );

      const initialOwnerBalance = await buidlerTokenERC20Mock.balanceOf(
        await owner.getAddress()
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      // perform withdraw
      const numExitRoot = await buidlerHermez.lastForgedBatch();
      const instantWithdraw = true;
      const state = await rollupDB.getStateByIdx(256);
      const exitInfo = await rollupDB.getExitTreeInfo(256, numExitRoot);
      await expect(
        buidlerHermez.withdrawMerkleProof(
          tokenID,
          amount,
          babyjub,
          numExitRoot,
          exitInfo.siblings,
          fromIdx,
          instantWithdraw
        )
      )
        .to.emit(buidlerHermez, "WithdrawEvent")
        .withArgs(fromIdx, numExitRoot, instantWithdraw);
      const finalOwnerBalance = await buidlerTokenERC20Mock.balanceOf(
        await owner.getAddress()
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + amount
      );
    });
    it("test delayed withdraw merkle proof", async function () {
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float16.float2Fix(float16.fix2Float(1000));
      const fromIdx = 256;
      const amount = 10;
      const amountF = float16.fix2Float(amount);

      const l1TxUserArray = [];

      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        buidlerHermez,
        rollupDB
      );

      await AddToken(
        buidlerHermez,
        buidlerTokenERC20Mock,
        buidlerHEZ,
        ownerWallet,
        feeAddToken
      );

      // Create account and exit some funds
      const numAccounts = 1;
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        owner,
        buidlerHermez,
        buidlerTokenERC20Mock,
        numAccounts
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, buidlerHermez)
      );

      const initialOwnerBalance = await buidlerTokenERC20Mock.balanceOf(
        buidlerWithdrawalDelayer.address
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      // perform withdraw
      const numExitRoot = await buidlerHermez.lastForgedBatch();
      const instantWithdraw = false;
      const state = await rollupDB.getStateByIdx(256);
      const exitInfo = await rollupDB.getExitTreeInfo(256, numExitRoot);

      await expect(
        buidlerHermez.withdrawMerkleProof(
          tokenID,
          amount,
          babyjub,
          numExitRoot,
          exitInfo.siblings,
          fromIdx,
          instantWithdraw
        )
      )
        .to.emit(buidlerHermez, "WithdrawEvent")
        .withArgs(fromIdx, numExitRoot, instantWithdraw);
      const finalOwnerBalance = await buidlerTokenERC20Mock.balanceOf(
        buidlerWithdrawalDelayer.address
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + amount
      );
    });

    it("test instant withdraw merkle proof with more leafs", async function () {
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float16.float2Fix(float16.fix2Float(1000));
      const fromIdx = 256;
      const amount = 10;
      const amountF = float16.fix2Float(amount);

      const l1TxUserArray = [];

      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        buidlerHermez,
        rollupDB
      );

      await AddToken(
        buidlerHermez,
        buidlerTokenERC20Mock,
        buidlerHEZ,
        ownerWallet,
        feeAddToken
      );

      // Create account and exit some funds
      const numAccounts = 3;
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        owner,
        buidlerHermez,
        buidlerTokenERC20Mock,
        numAccounts
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, buidlerHermez)
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(
          tokenID,
          fromIdx + 1,
          amountF,
          owner,
          buidlerHermez
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(
          tokenID,
          fromIdx + 2,
          amountF,
          owner,
          buidlerHermez
        )
      );
      const initialOwnerBalance = await buidlerTokenERC20Mock.balanceOf(
        await owner.getAddress()
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      // perform withdraw
      const numExitRoot = await buidlerHermez.lastForgedBatch();
      const instantWithdraw = true;
      const state = await rollupDB.getStateByIdx(256);
      const exitInfo = await rollupDB.getExitTreeInfo(256, numExitRoot);
      await expect(
        buidlerHermez.withdrawMerkleProof(
          tokenID,
          amount,
          babyjub,
          numExitRoot,
          exitInfo.siblings,
          fromIdx,
          instantWithdraw
        )
      )
        .to.emit(buidlerHermez, "WithdrawEvent")
        .withArgs(fromIdx, numExitRoot, instantWithdraw);
      const finalOwnerBalance = await buidlerTokenERC20Mock.balanceOf(
        await owner.getAddress()
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + amount
      );
    });
  });
  describe("Governance update aprameters", function () {
    it("update forgeL1L2BatchTimeout", async function () {
      const newForgeL1Timeout = 100;

      expect(await buidlerHermez.forgeL1L2BatchTimeout()).to.equal(
        forgeL1L2BatchTimeout
      );

      await expect(
        buidlerHermez
          .connect(governance)
          .updateForgeL1L2BatchTimeout(newForgeL1Timeout)
      )
        .to.emit(buidlerHermez, "UpdateForgeL1L2BatchTimeout")
        .withArgs(newForgeL1Timeout);
      expect(await buidlerHermez.forgeL1L2BatchTimeout()).to.equal(
        newForgeL1Timeout
      );

      await expect(
        buidlerHermez.connect(governance).updateForgeL1L2BatchTimeout(241)
      ).to.be.revertedWith("Hermez::updateForgeL1L2BatchTimeout: MAX_FORGETIMEOUT_EXCEED");
    });

    it("update FeeAddToken", async function () {
      const newFeeAddToken = 100;

      expect(await buidlerHermez.feeAddToken()).to.equal(feeAddToken);

      await expect(
        buidlerHermez.connect(governance).updateFeeAddToken(newFeeAddToken)
      )
        .to.emit(buidlerHermez, "UpdateFeeAddToken")
        .withArgs(newFeeAddToken);
      expect(await buidlerHermez.feeAddToken()).to.equal(newFeeAddToken);
    });
  });
});
