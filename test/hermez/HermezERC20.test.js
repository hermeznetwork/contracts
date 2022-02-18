const { expect } = require("chai");
const { ethers } = require("hardhat");
const SMTMemDB = require("circomlib").SMTMemDB;
const { time } = require("@openzeppelin/test-helpers");
const Scalar = require("ffjavascript").Scalar;

const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const {
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
  float40,
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
      ownerWallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", ethers.provider);
    }

    // const privateKeyhardhat =
    //   "0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122";
    // ownerWallet = new ethers.Wallet(
    //   privateKeyhardhat,
    //   ethers.provider
    // );
    //ownerWallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", ethers.provider);

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

    // deploy helpers
    let hardhatVerifierRollupHelper = await VerifierRollupHelper.deploy();
    let hardhatVerifierWithdrawHelper = await VerifierWithdrawHelper.deploy();

    let hardhatHermezAuctionTest = await HermezAuctionTest.deploy();

    // deploy hermez
    hardhatHermez = await Hermez.deploy();
    await hardhatHermez.deployed();

    hardhatWithdrawalDelayer = await WithdrawalDelayer.deploy(
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
  });

  describe("test tokens contract", function () {
    it("Should share tokens", async function () {
      await hardhatTokenERC20Mock.transfer(await id1.getAddress(), 50);
      const id1Balance = await hardhatTokenERC20Mock.balanceOf(
        await id1.getAddress()
      );
      expect(id1Balance).to.equal(50);

      await hardhatTokenERC20Mock.transfer(await id2.getAddress(), 50);

      const id2Balance = await hardhatTokenERC20Mock.balanceOf(
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
        hardhatHermez,
        token_zero_supply,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      )).to.be.revertedWith("TOTAL_SUPPLY_ZERO");

    });

    it("Add Token", async function () {
      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );

      expect(await hardhatHEZ.balanceOf(hermezGovernanceAddress))
        .to.be.equal(await hardhatHermez.feeAddToken());
    });
  });

  // You can nest describe calls to create subsections.
  describe("L1-user-Tx", function () {
    it("createAccountDeposit", async function () {
      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );

      const loadAmount = float40.round(1000);
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      await l1UserTxCreateAccountDeposit(
        loadAmount,
        tokenID,
        babyjub,
        owner,
        hardhatHermez,
        hardhatTokenERC20Mock
      );
    });

    it("deposit", async function () {
      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );

      // invalid operation in Hermez.sol, test purposes
      hardhatHermez.changeCurrentIdx(257);

      const loadAmount = float40.round(1000);
      const tokenID = 1;
      const fromIdx = 256;
      await l1UserTxDeposit(
        loadAmount,
        tokenID,
        fromIdx,
        owner,
        hardhatHermez,
        hardhatTokenERC20Mock
      );
    });
    it("depositTransfer", async function () {
      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );

      // invalid operation in Hermez.sol, test purposes
      hardhatHermez.changeCurrentIdx(257);

      const loadAmount = float40.round(1000);
      const tokenID = 1;
      const fromIdx = 256;
      const toIdx = 257;
      const amountF = float40.fix2Float(10);
      await l1UserTxDepositTransfer(
        loadAmount,
        tokenID,
        fromIdx,
        toIdx,
        amountF,
        owner,
        hardhatHermez,
        hardhatTokenERC20Mock
      );
    });
    it("createAccountDepositTransfer", async function () {
      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );

      // invalid operation in Hermez.sol, test purposes
      hardhatHermez.changeCurrentIdx(257);

      const loadAmount = float40.round(1000);
      const tokenID = 1;
      const toIdx = 257;
      const amountF = float40.fix2Float(10);
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      await l1UserTxCreateAccountDepositTransfer(
        loadAmount,
        tokenID,
        toIdx,
        amountF,
        babyjub,
        owner,
        hardhatHermez,
        hardhatTokenERC20Mock
      );
    });
    it("forceTransfer", async function () {
      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );

      // invalid operation in Hermez.sol, test purposes
      hardhatHermez.changeCurrentIdx(257);

      const tokenID = 1;
      const fromIdx = 256;
      const toIdx = 257;
      const amountF = float40.fix2Float(10);
      await l1UserTxForceTransfer(
        tokenID,
        fromIdx,
        toIdx,
        amountF,
        owner,
        hardhatHermez
      );
    });
    it("forceExit", async function () {
      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );

      // invalid operation in Hermez.sol, test purposes
      hardhatHermez.changeCurrentIdx(257);

      const tokenID = 1;
      const fromIdx = 256;
      const amountF = float40.fix2Float(10);
      await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, hardhatHermez);
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
        hardhatHermez.forgeBatch(
          newLastIdx,
          newStateRoot,
          newExitRoot,
          compressedL1CoordinatorTx,
          feeIdxCoordinator,
          verifierIdx,
          false,
          proofA,
          proofB,
          proofC
        )
      ).to.be.revertedWith("Hermez::forgeBatch: L1L2BATCH_REQUIRED");

      // must forge an L1 batch
      await hardhatHermez.forgeBatch(
        newLastIdx,
        newStateRoot,
        newExitRoot,
        compressedL1CoordinatorTx,
        feeIdxCoordinator,
        verifierIdx,
        true,
        proofA,
        proofB,
        proofC
      );
      // can continue forging l2 batches
      await hardhatHermez.forgeBatch(
        newLastIdx,
        newStateRoot,
        newExitRoot,
        compressedL1CoordinatorTx,
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
        hardhatHermez.forgeBatch(
          newLastIdx,
          newStateRoot,
          newExitRoot,
          compressedL1CoordinatorTx,
          feeIdxCoordinator,
          verifierIdx,
          false,
          proofA,
          proofB,
          proofC
        )
      ).to.be.revertedWith("Hermez::forgeBatch: L1L2BATCH_REQUIRED");
    });

    it("test feeIdxCoordinator", async function () {

      for (let i = 0; i < 65; i = i + 10) {
        // dummy batch
        const proofA = ["0", "0"];
        const proofB = [
          ["0", "0"],
          ["0", "0"],
        ];
        const proofC = ["0", "0"];

        const newLastIdx = 255;
        const newStateRoot = 0;
        const newExitRoot = 0;
        const compressedL1CoordinatorTx = "0x00";
        const verifierIdx = 0;
        const l1Batch = true;

        // test different paddings
        const feeIdxCoordinator = `0x${utils.padZeros(
          "",
          ((nLevels / 8) * 2) * i
        )}`;

        const tx = await hardhatHermez.calculateInputTest(
          newLastIdx,
          newStateRoot,
          newExitRoot,
          compressedL1CoordinatorTx,
          feeIdxCoordinator,
          l1Batch,
          verifierIdx
        );
        const receipt = await tx.wait();
        const input = receipt.events[0].args[0];

        // check that the padding of the SC works as expected!
        await expect(
          hardhatHermez.calculateInputTest(
            newLastIdx,
            newStateRoot,
            newExitRoot,
            compressedL1CoordinatorTx,
            "0x",
            l1Batch,
            verifierIdx
          )
        ).to.emit(hardhatHermez, "ReturnUint256")
          .withArgs(input);

        await hardhatHermez.forgeBatch(
          newLastIdx,
          newStateRoot,
          newExitRoot,
          compressedL1CoordinatorTx,
          feeIdxCoordinator,
          verifierIdx,
          l1Batch,
          proofA,
          proofB,
          proofC
        );
      }
    });

    it("handle L1 Coordinator Queue Test", async function () {
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const currentQueue = await hardhatHermez.nextL1ToForgeQueue();

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );
      const l1TxCoordiatorArray = [];
      // L1-Tx Coordinator with eth signature
      l1TxCoordiatorArray.push(
        await l1CoordinatorTxEth(tokenID, babyjub, owner, hardhatHermez, chainIDHex)
      );

      // L1-Tx Coordinator without eth signature:
      l1TxCoordiatorArray.push(
        await l1CoordinatorTxBjj(tokenID, babyjub, hardhatHermez)
      );

      let stringL1CoordinatorTx = "";
      for (let tx of l1TxCoordiatorArray) {
        stringL1CoordinatorTx =
          stringL1CoordinatorTx + tx.l1TxCoordinatorbytes.slice(2); // retireve the 0x
      }

      // simulate l1-tx batchbuilder:
      const fromEthAddrB = 160;
      const fromBjjCompressedB = 256;
      const f40B = 40;
      const tokenIDB = 32;
      const maxIdxB = 48;

      const L1TxB =
        fromEthAddrB + fromBjjCompressedB + 2 * maxIdxB + tokenIDB + 2 * f40B;

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
        hardhatHermez.handleL1QueueTest(
          0,
          0,
          0,
          `0x${stringL1CoordinatorTx}`,
          "0x",
          0,
          0,
          proofA,
          proofB,
          proofC
        )
      )
        .to.emit(hardhatHermez, "ReturnBytes")
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
        hardhatHermez,
        rollupDB
      );

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );

      l1TxCoordiatorArray.push(
        await l1CoordinatorTxEth(tokenID, babyjub, owner, hardhatHermez, chainIDHex)
      );

      l1TxCoordiatorArray.push(
        await l1CoordinatorTxBjj(tokenID, babyjub, hardhatHermez)
      );

      // forge Batch
      await forgerTest.forgeBatch(true, [], l1TxCoordiatorArray);

      // after forge, next queue is empty
      const currentQueue = await hardhatHermez.nextL1ToForgeQueue();
      expect("0x").to.equal(await hardhatHermez.mapL1TxQueue(currentQueue));
    });

    it("expect L1-Tx Queue same as batchbuilder ", async function () {
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float40.round(1000);
      const fromIdx = 256;
      const toIdx = 257;
      const amountF = float40.fix2Float(10);

      const l1TxCoordiatorArray = [];
      const l1TxUserArray = [];

      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        hardhatHermez,
        rollupDB
      );

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
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
        hardhatHermez,
        hardhatTokenERC20Mock,
        numAccounts
      );

      // add user l1 tx
      l1TxUserArray.push(
        await l1UserTxCreateAccountDeposit(
          loadAmount,
          tokenID,
          babyjub,
          owner,
          hardhatHermez,
          hardhatTokenERC20Mock
        )
      );
      l1TxUserArray.push(
        await l1UserTxDeposit(
          loadAmount,
          tokenID,
          fromIdx,
          owner,
          hardhatHermez,
          hardhatTokenERC20Mock
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
          hardhatHermez,
          hardhatTokenERC20Mock
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
          hardhatHermez,
          hardhatTokenERC20Mock
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceTransfer(
          tokenID,
          fromIdx,
          toIdx,
          amountF,
          owner,
          hardhatHermez
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, hardhatHermez)
      );

      // forge empty batch, now the current queue is filled with the L1-User-Tx
      await forgerTest.forgeBatch(true, [], []);

      // add L1-Tx Coordinator with eth signature
      const cordinatorTxEth = await l1CoordinatorTxEth(
        tokenID,
        babyjub,
        owner,
        hardhatHermez,
        chainIDHex
      );

      // add L1-Tx Coordinator without eth signature:
      const coordinatorTxBjj = await l1CoordinatorTxBjj(
        tokenID,
        babyjub,
        hardhatHermez
      );

      l1TxCoordiatorArray.push(cordinatorTxEth);
      l1TxCoordiatorArray.push(coordinatorTxBjj);

      const fromEthAddrB = 160;
      const fromBjjCompressedB = 256;
      const f40B = 40;
      const tokenIDB = 32;
      const maxIdxB = 48;

      const L1TxB =
        fromEthAddrB + fromBjjCompressedB + 2 * maxIdxB + tokenIDB + 2 * f40B;
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
        hardhatHermez.handleL1QueueTest(
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
        .to.emit(hardhatHermez, "ReturnBytes")
        .withArgs(simulateBatchbuilderL1TxData);
    });

    it("forge L1 user & Coordiator Tx batch", async function () {
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float40.round(1000);
      const fromIdx = 256;
      const toIdx = 257;
      const amountF = float40.fix2Float(10);

      const l1TxUserArray = [];

      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        hardhatHermez,
        rollupDB
      );

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
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
        hardhatHermez,
        hardhatTokenERC20Mock,
        numAccounts
      );

      // add user l1 tx
      l1TxUserArray.push(
        await l1UserTxCreateAccountDeposit(
          loadAmount,
          tokenID,
          babyjub,
          owner,
          hardhatHermez,
          hardhatTokenERC20Mock
        )
      );
      l1TxUserArray.push(
        await l1UserTxDeposit(
          loadAmount,
          tokenID,
          fromIdx,
          owner,
          hardhatHermez,
          hardhatTokenERC20Mock
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
          hardhatHermez,
          hardhatTokenERC20Mock
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
          hardhatHermez,
          hardhatTokenERC20Mock
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceTransfer(
          tokenID,
          fromIdx,
          toIdx,
          amountF,
          owner,
          hardhatHermez
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, hardhatHermez)
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      const l1TxCoordiatorArray = [];

      // add Coordiator tx
      l1TxCoordiatorArray.push(
        await l1CoordinatorTxEth(tokenID, babyjub, owner, hardhatHermez, chainIDHex)
      );

      l1TxCoordiatorArray.push(
        await l1CoordinatorTxBjj(tokenID, babyjub, hardhatHermez)
      );

      // forge batch with all the L1 tx
      await forgerTest.forgeBatch(true, l1TxUserArray, l1TxCoordiatorArray);
    });

    it("test instant withdraw circuit", async function () {
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float40.round(1000);
      const fromIdx = 256;
      const amount = 10;
      const amountF = float40.fix2Float(amount);

      const l1TxUserArray = [];

      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        hardhatHermez,
        rollupDB
      );

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
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
        hardhatHermez,
        hardhatTokenERC20Mock,
        numAccounts
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, hardhatHermez)
      );

      const initialOwnerBalance = await hardhatTokenERC20Mock.balanceOf(
        await owner.getAddress()
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      // perform withdraw
      const numExitRoot = await hardhatHermez.lastForgedBatch();
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
        hardhatHermez.withdrawCircuit(
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
        .to.emit(hardhatHermez, "WithdrawEvent")
        .withArgs(fromIdx, numExitRoot, instantWithdraw);
      const finalOwnerBalance = await hardhatTokenERC20Mock.balanceOf(
        await owner.getAddress()
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + amount
      );
    });
    it("test delayed withdraw circuit", async function () {
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float40.round(1000);
      const fromIdx = 256;
      const amount = 10;
      const amountF = float40.fix2Float(amount);

      const l1TxUserArray = [];

      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        hardhatHermez,
        rollupDB
      );

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
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
        hardhatHermez,
        hardhatTokenERC20Mock,
        numAccounts
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, hardhatHermez)
      );

      const initialOwnerBalance = await hardhatTokenERC20Mock.balanceOf(
        hardhatWithdrawalDelayer.address
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      // perform withdraw
      const numExitRoot = await hardhatHermez.lastForgedBatch();
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
        hardhatHermez.withdrawCircuit(
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
        .to.emit(hardhatHermez, "WithdrawEvent")
        .withArgs(fromIdx, numExitRoot, instantWithdraw);

      const finalOwnerBalance = await hardhatTokenERC20Mock.balanceOf(
        hardhatWithdrawalDelayer.address
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + amount
      );
    });
    it("test instant withdraw merkle proof", async function () {
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float40.round(1000);
      const fromIdx = 256;
      const amount = 10;
      const amountF = float40.fix2Float(amount);

      const l1TxUserArray = [];

      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        hardhatHermez,
        rollupDB
      );

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
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
        hardhatHermez,
        hardhatTokenERC20Mock,
        numAccounts
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, hardhatHermez)
      );

      const initialOwnerBalance = await hardhatTokenERC20Mock.balanceOf(
        await owner.getAddress()
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      // perform withdraw
      const numExitRoot = await hardhatHermez.lastForgedBatch();
      const instantWithdraw = true;
      const state = await rollupDB.getStateByIdx(256);
      const exitInfo = await rollupDB.getExitTreeInfo(256, numExitRoot);
      await expect(
        hardhatHermez.withdrawMerkleProof(
          tokenID,
          amount,
          babyjub,
          numExitRoot,
          exitInfo.siblings,
          fromIdx,
          instantWithdraw
        )
      )
        .to.emit(hardhatHermez, "WithdrawEvent")
        .withArgs(fromIdx, numExitRoot, instantWithdraw);
      const finalOwnerBalance = await hardhatTokenERC20Mock.balanceOf(
        await owner.getAddress()
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + amount
      );
    });
    it("test delayed withdraw merkle proof", async function () {
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float40.round(1000);
      const fromIdx = 256;
      const amount = 10;
      const amountF = float40.fix2Float(amount);

      const l1TxUserArray = [];

      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        hardhatHermez,
        rollupDB
      );

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
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
        hardhatHermez,
        hardhatTokenERC20Mock,
        numAccounts
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, hardhatHermez)
      );

      const initialOwnerBalance = await hardhatTokenERC20Mock.balanceOf(
        hardhatWithdrawalDelayer.address
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      // perform withdraw
      const numExitRoot = await hardhatHermez.lastForgedBatch();
      const instantWithdraw = false;
      const state = await rollupDB.getStateByIdx(256);
      const exitInfo = await rollupDB.getExitTreeInfo(256, numExitRoot);

      await expect(
        hardhatHermez.withdrawMerkleProof(
          tokenID,
          amount,
          babyjub,
          numExitRoot,
          exitInfo.siblings,
          fromIdx,
          instantWithdraw
        )
      )
        .to.emit(hardhatHermez, "WithdrawEvent")
        .withArgs(fromIdx, numExitRoot, instantWithdraw);
      const finalOwnerBalance = await hardhatTokenERC20Mock.balanceOf(
        hardhatWithdrawalDelayer.address
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + amount
      );
    });

    it("test instant withdraw merkle proof with more leafs", async function () {
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float40.round(1000);
      const fromIdx = 256;
      const amount = 10;
      const amountF = float40.fix2Float(amount);

      const l1TxUserArray = [];

      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        hardhatHermez,
        rollupDB
      );

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
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
        hardhatHermez,
        hardhatTokenERC20Mock,
        numAccounts
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, hardhatHermez)
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(
          tokenID,
          fromIdx + 1,
          amountF,
          owner,
          hardhatHermez
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(
          tokenID,
          fromIdx + 2,
          amountF,
          owner,
          hardhatHermez
        )
      );
      const initialOwnerBalance = await hardhatTokenERC20Mock.balanceOf(
        await owner.getAddress()
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      // perform withdraw
      const numExitRoot = await hardhatHermez.lastForgedBatch();
      const instantWithdraw = true;
      const state = await rollupDB.getStateByIdx(256);
      const exitInfo = await rollupDB.getExitTreeInfo(256, numExitRoot);
      await expect(
        hardhatHermez.withdrawMerkleProof(
          tokenID,
          amount,
          babyjub,
          numExitRoot,
          exitInfo.siblings,
          fromIdx,
          instantWithdraw
        )
      )
        .to.emit(hardhatHermez, "WithdrawEvent")
        .withArgs(fromIdx, numExitRoot, instantWithdraw);
      const finalOwnerBalance = await hardhatTokenERC20Mock.balanceOf(
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

      expect(await hardhatHermez.forgeL1L2BatchTimeout()).to.equal(
        forgeL1L2BatchTimeout
      );

      await expect(
        hardhatHermez
          .connect(governance)
          .updateForgeL1L2BatchTimeout(newForgeL1Timeout)
      )
        .to.emit(hardhatHermez, "UpdateForgeL1L2BatchTimeout")
        .withArgs(newForgeL1Timeout);
      expect(await hardhatHermez.forgeL1L2BatchTimeout()).to.equal(
        newForgeL1Timeout
      );

      await expect(
        hardhatHermez.connect(governance).updateForgeL1L2BatchTimeout(241)
      ).to.be.revertedWith("Hermez::updateForgeL1L2BatchTimeout: MAX_FORGETIMEOUT_EXCEED");
    });

    it("update FeeAddToken", async function () {
      const newFeeAddToken = 100;

      expect(await hardhatHermez.feeAddToken()).to.equal(feeAddToken);

      await expect(
        hardhatHermez.connect(governance).updateFeeAddToken(newFeeAddToken)
      )
        .to.emit(hardhatHermez, "UpdateFeeAddToken")
        .withArgs(newFeeAddToken);
      expect(await hardhatHermez.feeAddToken()).to.equal(newFeeAddToken);
    });
  });
});
