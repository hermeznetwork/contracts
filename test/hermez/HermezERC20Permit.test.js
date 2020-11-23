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
  calculateInputMaxTxLevels,
  createPermitSignature
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

const INITIAL_DELAY = 0;
const ABIbid = [
  "function permit(address,address,uint256,uint256,uint8,bytes32,bytes32)",
];

const iface = new ethers.utils.Interface(ABIbid);

describe("Hermez ERC20 Permit", function() {
  let buidlerTokenERC20PermitMock;
  let buidlerHermez;
  let buidlerWithdrawalDelayer;

  let owner;
  let id1;
  let id2;
  let addrs;
  let hermezGovernanceDAOAddress;
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
  const emptyPermit = "0x";

  beforeEach(async function() {
    [
      owner,
      governance,
      safetyAddress,
      id1,
      id2,
      ...addrs
    ] = await ethers.getSigners();

    hermezGovernanceDAOAddress = governance.getAddress();

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

    // factory helpers
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
      poseidonUnit.abi,
      poseidonUnit.createCode(2),
      owner
    );

    const Poseidon3Elements = new ethers.ContractFactory(
      poseidonUnit.abi,
      poseidonUnit.createCode(3),
      owner
    );

    const Poseidon4Elements = new ethers.ContractFactory(
      poseidonUnit.abi,
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

    buidlerTokenERC20PermitMock = await TokenERC20PermitMock.deploy(
      "tokenname",
      "TKN",
      await owner.getAddress(),
      tokenInitialAmount
    );

    // deploy helpers
    await buidlerTokenERC20PermitMock.deployed();
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
      hermezGovernanceDAOAddress,
      hermezGovernanceDAOAddress,
      hermezGovernanceDAOAddress
    );

    // deploy hermez
    await buidlerHermez.initializeHermez(
      [buidlerVerifierRollupHelper.address],
      calculateInputMaxTxLevels([maxTx], [nLevels]),
      buidlerVerifierWithdrawHelper.address,
      buidlerHermezAuctionTest.address,
      buidlerTokenERC20PermitMock.address,
      forgeL1L2BatchTimeout,
      feeAddToken,
      poseidonAddr2,
      poseidonAddr3,
      poseidonAddr4,
      hermezGovernanceDAOAddress,
      await safetyAddress.getAddress(),
      withdrawalDelay,
      buidlerWithdrawalDelayer.address
    );

    // wait until is deployed
    await buidlerTokenERC20PermitMock.deployed();

    const chainSC = await buidlerHermez.getChainID();
    chainID = chainSC.toNumber();
    chainIDHex = chainSC.toHexString();
  });

  describe("test tokens contract", function() {
    it("Should share tokens", async function() {
      await buidlerTokenERC20PermitMock.transfer(await id1.getAddress(), 50);
      const id1Balance = await buidlerTokenERC20PermitMock.balanceOf(
        await id1.getAddress()
      );
      expect(id1Balance).to.equal(50);

      await buidlerTokenERC20PermitMock.transfer(await id2.getAddress(), 50);

      const id2Balance = await buidlerTokenERC20PermitMock.balanceOf(
        await id2.getAddress()
      );
      expect(id2Balance).to.equal(50);
    });

  });

  describe("Utils", function() {
    it("Add Token", async function() {
      await AddToken(
        buidlerHermez,
        buidlerTokenERC20PermitMock,
        buidlerTokenERC20PermitMock,
        ownerWallet,
        feeAddToken
      );
    });

    it("Add Token of a token that does not exist", async function() {
      const fakeTokenAddress = "0xEEF9f339514298C6A857EfCfC1A762aF84438dEE";
      const addressOwner = await ownerWallet.getAddress();

      const deadline = ethers.constants.MaxUint256;
      const value = feeAddToken;
      const nonce = await buidlerTokenERC20PermitMock.nonces(addressOwner);
      const { v, r, s } = await createPermitSignature(
        buidlerTokenERC20PermitMock,
        ownerWallet,
        buidlerHermez.address,
        value,
        nonce,
        deadline
      );

      const data = iface.encodeFunctionData("permit", [
        await ownerWallet.getAddress(),
        buidlerHermez.address,
        value,
        deadline,
        v,
        r,
        s
      ]);

      // Send data and amount
      await expect(buidlerHermez.connect(ownerWallet).addToken(fakeTokenAddress, data))
        .to.be.reverted;
    });
  });

  // You can nest describe calls to create subsections.
  describe("L1-user-Tx", function() {

    it("createAccountDeposit should revert cause token is not added", async function() {
      const loadAmount = float16.float2Fix(float16.fix2Float(1000));
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;

      // using ERC20 approach: approve and transferFrom, shoudl revert
      await expect(
        buidlerTokenERC20PermitMock.approve(buidlerHermez.address, loadAmount)
      ).to.emit(buidlerTokenERC20PermitMock, "Approval");

      const fromIdx0 = 0;
      const amountF0 = 0;
      const toIdx0 = 0;

      await expect(
        buidlerHermez.addL1Transaction(
          babyjub,
          fromIdx0,
          loadAmount,
          amountF0,
          tokenID,
          toIdx0,
          emptyPermit
        )
      ).to.be.revertedWith("Hermez::addL1Transaction: TOKEN_NOT_REGISTERED");
    });

    it("createAccountDeposit", async function() {
      await AddToken(
        buidlerHermez,
        buidlerTokenERC20PermitMock,
        buidlerTokenERC20PermitMock,
        ownerWallet,
        feeAddToken
      );

      const loadAmount = float16.float2Fix(float16.fix2Float(1000));
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;

      // using erc20permit approach:
      await l1UserTxCreateAccountDeposit(
        loadAmount,
        tokenID,
        babyjub,
        ownerWallet,
        buidlerHermez,
        buidlerTokenERC20PermitMock,
        true
      );

      // using ERC20 approach: approve and transferFrom, shoudl revert
      await expect(
        buidlerTokenERC20PermitMock.approve(buidlerHermez.address, loadAmount)
      ).to.emit(buidlerTokenERC20PermitMock, "Approval");

      const fromIdx0 = 0;
      const amountF0 = 0;
      const toIdx0 = 0;

      await expect(
        buidlerHermez.addL1Transaction(
          babyjub,
          fromIdx0,
          loadAmount,
          amountF0,
          tokenID,
          toIdx0,
          emptyPermit
        )
      );
    });

    it("deposit", async function() {
      await AddToken(
        buidlerHermez,
        buidlerTokenERC20PermitMock,
        buidlerTokenERC20PermitMock,
        ownerWallet,
        feeAddToken
      );

      // invalid operation in Hermez.sol, test purposes
      buidlerHermez.changeCurrentIdx(257);

      const loadAmount = float16.float2Fix(float16.fix2Float(1000));
      const tokenID = 1;
      const fromIdx = 256;
      // using erc20permit approach:
      await l1UserTxDeposit(
        loadAmount,
        tokenID,
        fromIdx,
        ownerWallet,
        buidlerHermez,
        buidlerTokenERC20PermitMock,
        true
      );
    });
    it("depositTransfer", async function() {
      await AddToken(
        buidlerHermez,
        buidlerTokenERC20PermitMock,
        buidlerTokenERC20PermitMock,
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

      // using erc20permit approach:
      await l1UserTxDepositTransfer(
        loadAmount,
        tokenID,
        fromIdx,
        toIdx,
        amountF,
        ownerWallet,
        buidlerHermez,
        buidlerTokenERC20PermitMock,
        true
      );
    });
    it("createAccountDepositTransfer", async function() {
      await AddToken(
        buidlerHermez,
        buidlerTokenERC20PermitMock,
        buidlerTokenERC20PermitMock,
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

      // using erc20permit approach:
      await l1UserTxCreateAccountDepositTransfer(
        loadAmount,
        tokenID,
        toIdx,
        amountF,
        babyjub,
        ownerWallet,
        buidlerHermez,
        buidlerTokenERC20PermitMock,
        true
      );
    });
    it("forceTransfer", async function() {
      await AddToken(
        buidlerHermez,
        buidlerTokenERC20PermitMock,
        buidlerTokenERC20PermitMock,
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
        ownerWallet,
        buidlerHermez
      );
    });
    it("forceExit", async function() {
      await AddToken(
        buidlerHermez,
        buidlerTokenERC20PermitMock,
        buidlerTokenERC20PermitMock,
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

  describe("Forge Batch", function() {
    it("test L1 deadline", async function() {
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

    it("handle L1 Coordinator Queue Test", async function() {
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const currentQueue = await buidlerHermez.nextL1ToForgeQueue();

      await AddToken(
        buidlerHermez,
        buidlerTokenERC20PermitMock,
        buidlerTokenERC20PermitMock,
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

    it("forge L1-Coordiator-tx Batch ", async function() {
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
        buidlerTokenERC20PermitMock,
        buidlerTokenERC20PermitMock,
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

    it("expect L1-Tx Queue same as batchbuilder ", async function() {
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
        buidlerTokenERC20PermitMock,
        buidlerTokenERC20PermitMock,
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
        ownerWallet,
        buidlerHermez,
        buidlerTokenERC20PermitMock,
        numAccounts,
        true
      );

      // add user l1 tx
      l1TxUserArray.push(
        await l1UserTxCreateAccountDeposit(
          loadAmount,
          tokenID,
          babyjub,
          ownerWallet,
          buidlerHermez,
          buidlerTokenERC20PermitMock,
          true
        )
      );
      l1TxUserArray.push(
        await l1UserTxDeposit(
          loadAmount,
          tokenID,
          fromIdx,
          ownerWallet,
          buidlerHermez,
          buidlerTokenERC20PermitMock,
          true
        )
      );
      l1TxUserArray.push(
        await l1UserTxDepositTransfer(
          loadAmount,
          tokenID,
          fromIdx,
          toIdx,
          amountF,
          ownerWallet,
          buidlerHermez,
          buidlerTokenERC20PermitMock,
          true
        )
      );
      l1TxUserArray.push(
        await l1UserTxCreateAccountDepositTransfer(
          loadAmount,
          tokenID,
          toIdx,
          amountF,
          babyjub,
          ownerWallet,
          buidlerHermez,
          buidlerTokenERC20PermitMock,
          true
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceTransfer(
          tokenID,
          fromIdx,
          toIdx,
          amountF,
          ownerWallet,
          buidlerHermez
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, ownerWallet, buidlerHermez)
      );

      // forge empty batch, now the current queue is filled with the L1-User-Tx
      await forgerTest.forgeBatch(true, [], []);

      // add L1-Tx Coordinator with eth signature
      const cordinatorTxEth = await l1CoordinatorTxEth(
        tokenID,
        babyjub,
        ownerWallet,
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

    it("forge L1 user & Coordiator Tx batch", async function() {
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
        buidlerTokenERC20PermitMock,
        buidlerTokenERC20PermitMock,
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
        ownerWallet,
        buidlerHermez,
        buidlerTokenERC20PermitMock,
        numAccounts,
        true
      );

      // add user l1 tx
      l1TxUserArray.push(
        await l1UserTxCreateAccountDeposit(
          loadAmount,
          tokenID,
          babyjub,
          ownerWallet,
          buidlerHermez,
          buidlerTokenERC20PermitMock,
          true
        )
      );

      l1TxUserArray.push(
        await l1UserTxDeposit(
          loadAmount,
          tokenID,
          fromIdx,
          ownerWallet,
          buidlerHermez,
          buidlerTokenERC20PermitMock,
          true
        )
      );
      l1TxUserArray.push(
        await l1UserTxDepositTransfer(
          loadAmount,
          tokenID,
          fromIdx,
          toIdx,
          amountF,
          ownerWallet,
          buidlerHermez,
          buidlerTokenERC20PermitMock,
          true
        )
      );
      l1TxUserArray.push(
        await l1UserTxCreateAccountDepositTransfer(
          loadAmount,
          tokenID,
          toIdx,
          amountF,
          babyjub,
          ownerWallet,
          buidlerHermez,
          buidlerTokenERC20PermitMock,
          true
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceTransfer(
          tokenID,
          fromIdx,
          toIdx,
          amountF,
          ownerWallet,
          buidlerHermez
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, ownerWallet, buidlerHermez)
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      const l1TxCoordiatorArray = [];

      // add Coordiator tx
      l1TxCoordiatorArray.push(
        await l1CoordinatorTxEth(tokenID, babyjub, ownerWallet, buidlerHermez, chainIDHex)
      );

      l1TxCoordiatorArray.push(
        await l1CoordinatorTxBjj(tokenID, babyjub, buidlerHermez)
      );

      // forge batch with all the L1 tx
      await forgerTest.forgeBatch(true, l1TxUserArray, l1TxCoordiatorArray);
    });

    it("test instant withdraw circuit", async function() {
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
        buidlerTokenERC20PermitMock,
        buidlerTokenERC20PermitMock,
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
        ownerWallet,
        buidlerHermez,
        buidlerTokenERC20PermitMock,
        numAccounts,
        true
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, buidlerHermez)
      );

      const initialOwnerBalance = await buidlerTokenERC20PermitMock.balanceOf(
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
      const finalOwnerBalance = await buidlerTokenERC20PermitMock.balanceOf(
        await owner.getAddress()
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + amount
      );
    });
    it("test delayed withdraw circuit", async function() {
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
        buidlerTokenERC20PermitMock,
        buidlerTokenERC20PermitMock,
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
        ownerWallet,
        buidlerHermez,
        buidlerTokenERC20PermitMock,
        numAccounts,
        true
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, buidlerHermez)
      );

      const initialOwnerBalance = await buidlerTokenERC20PermitMock.balanceOf(
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

      const finalOwnerBalance = await buidlerTokenERC20PermitMock.balanceOf(
        buidlerWithdrawalDelayer.address
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + amount
      );
    });
    it("test instant withdraw merkle proof", async function() {
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
        buidlerTokenERC20PermitMock,
        buidlerTokenERC20PermitMock,
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
        ownerWallet,
        buidlerHermez,
        buidlerTokenERC20PermitMock,
        numAccounts,
        true
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, buidlerHermez)
      );

      const initialOwnerBalance = await buidlerTokenERC20PermitMock.balanceOf(
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
      const finalOwnerBalance = await buidlerTokenERC20PermitMock.balanceOf(
        await owner.getAddress()
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + amount
      );
    });
    it("test delayed withdraw merkle proof", async function() {
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
        buidlerTokenERC20PermitMock,
        buidlerTokenERC20PermitMock,
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
        ownerWallet,
        buidlerHermez,
        buidlerTokenERC20PermitMock,
        numAccounts,
        true
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, buidlerHermez)
      );

      const initialOwnerBalance = await buidlerTokenERC20PermitMock.balanceOf(
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
      const finalOwnerBalance = await buidlerTokenERC20PermitMock.balanceOf(
        buidlerWithdrawalDelayer.address
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + amount
      );
    });

    it("test instant withdraw merkle proof with more leafs", async function() {
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
        buidlerTokenERC20PermitMock,
        buidlerTokenERC20PermitMock,
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
        ownerWallet,
        buidlerHermez,
        buidlerTokenERC20PermitMock,
        numAccounts,
        true
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
      const initialOwnerBalance = await buidlerTokenERC20PermitMock.balanceOf(
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
      const finalOwnerBalance = await buidlerTokenERC20PermitMock.balanceOf(
        await owner.getAddress()
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + amount
      );
    });
  });
});
