const { expect } = require("chai");
const { BigNumber } = require("ethers");
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

const babyjub0 = 0;
const fromIdx0 = 0;
const loadAmountF0 = 0;
const amountF0 = 0;
const tokenID0 = 0;
const toIdx0 = 0;
const emptyPermit = "0x";
const INITIAL_DELAY = 0;

describe("Hermez ETH test", function () {
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
      const tokenID = 0;
      const babyjub = `0x${accounts[0].bjjCompressed}`;

      // revert msg.value less than loadAmount
      const loadAmountF = float40.fix2Float(loadAmount);
      await expect(
        hardhatHermez.addL1Transaction(
          babyjub,
          fromIdx0,
          loadAmountF,
          amountF0,
          tokenID,
          toIdx0,
          emptyPermit,
          {
            value: loadAmount - Scalar.e(1)
          }
        )
      ).to.be.revertedWith("Hermez::addL1Transaction: LOADAMOUNT_ETH_DOES_NOT_MATCH");

      await l1UserTxCreateAccountDeposit(
        loadAmount,
        tokenID,
        babyjub,
        ownerWallet,
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
      const tokenID = 0;
      const fromIdx = 256;

      // revert msg.value less than loadAmount
      const loadAmountF = float40.fix2Float(loadAmount);
      await expect(
        hardhatHermez.addL1Transaction(
          babyjub0,
          fromIdx,
          loadAmountF,
          amountF0,
          tokenID,
          toIdx0,
          emptyPermit,
          {
            value: loadAmount - Scalar.e(1)
          }
        )
      ).to.be.revertedWith("Hermez::addL1Transaction: LOADAMOUNT_ETH_DOES_NOT_MATCH");

      await l1UserTxDeposit(
        loadAmount,
        tokenID,
        fromIdx,
        ownerWallet,
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
      const tokenID = 0;
      const fromIdx = 256;
      const toIdx = 257;
      const amountF = float40.fix2Float(10);

      // revert msg.value less than loadAmount
      const loadAmountF = float40.fix2Float(loadAmount);
      await expect(
        hardhatHermez.addL1Transaction(
          babyjub0,
          fromIdx,
          loadAmountF,
          amountF,
          tokenID,
          toIdx,
          emptyPermit,
          {
            value: loadAmount - Scalar.e(1)
          }
        )
      ).to.be.revertedWith("Hermez::addL1Transaction: LOADAMOUNT_ETH_DOES_NOT_MATCH");

      await l1UserTxDepositTransfer(
        loadAmount,
        tokenID,
        fromIdx,
        toIdx,
        amountF,
        ownerWallet,
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
      const tokenID = 0;
      const toIdx = 257;
      const amountF = float40.fix2Float(10);
      const babyjub = `0x${accounts[0].bjjCompressed}`;

      // revert msg.value less than loadAmount
      const loadAmountF = float40.fix2Float(loadAmount);
      await expect(
        hardhatHermez.addL1Transaction(
          babyjub,
          fromIdx0,
          loadAmountF,
          amountF,
          tokenID,
          toIdx,
          emptyPermit,
          {
            value: loadAmount - Scalar.e(1),
          }
        )
      ).to.be.revertedWith("Hermez::addL1Transaction: LOADAMOUNT_ETH_DOES_NOT_MATCH");

      await l1UserTxCreateAccountDepositTransfer(
        loadAmount,
        tokenID,
        toIdx,
        amountF,
        babyjub,
        ownerWallet,
        hardhatHermez,
        hardhatTokenERC20Mock
      );
    });
  });

  describe("Forge Batch", function () {
    it("forge L1 user & Coordiator Tx batch", async function () {
      const tokenID = 0;
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
        ownerWallet,
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
          ownerWallet,
          hardhatHermez,
          hardhatTokenERC20Mock
        )
      );

      l1TxUserArray.push(
        await l1UserTxDeposit(
          loadAmount,
          tokenID,
          fromIdx,
          ownerWallet,
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
          ownerWallet,
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
          ownerWallet,
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
          ownerWallet,
          hardhatHermez
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, ownerWallet, hardhatHermez)
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      const l1TxCoordiatorArray = [];

      // add Coordiator tx
      l1TxCoordiatorArray.push(
        await l1CoordinatorTxEth(tokenID, babyjub, ownerWallet, hardhatHermez, chainIDHex)
      );

      l1TxCoordiatorArray.push(
        await l1CoordinatorTxBjj(tokenID, babyjub, hardhatHermez)
      );

      // forge batch with all the L1 tx
      await forgerTest.forgeBatch(true, l1TxUserArray, l1TxCoordiatorArray);
    });

    it("test instant withdraw circuit", async function () {
      const tokenID = 0;
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
        ownerWallet,
        hardhatHermez,
        hardhatTokenERC20Mock,
        numAccounts
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, ownerWallet, hardhatHermez)
      );
      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      const initialOwnerBalance = await owner.getBalance();

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

      let txRes;
      await expect(
        txRes = await hardhatHermez.withdrawCircuit(
          proofA,
          proofB,
          proofC,
          tokenID,
          amount,
          numExitRoot,
          fromIdx,
          instantWithdraw,
        )
      )
        .to.emit(hardhatHermez, "WithdrawEvent")
        .withArgs(fromIdx, numExitRoot, instantWithdraw);

      const txReceipt = await txRes.wait();

      const gasCost = BigNumber.from(txReceipt.gasUsed).mul(BigNumber.from(txRes.gasPrice));
      const finalOwnerBalance = await owner.getBalance();

      expect(finalOwnerBalance).to.equal(
        BigNumber.from(initialOwnerBalance).add(BigNumber.from(amount)).sub(gasCost)
      );
    });

    it("test delayed withdraw circuit with ether", async function () {
      const tokenID = 0;
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

      // Create account and exit some funds
      const numAccounts = 1;
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        ownerWallet,
        hardhatHermez,
        null, // token contract but ether is used
        numAccounts
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, ownerWallet, hardhatHermez)
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      const provider = owner.provider;
      const initialWithdrawalBalance = await provider.getBalance(
        hardhatWithdrawalDelayer.address
      );

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

      const finalWithdrawalBalance = await provider.getBalance(
        hardhatWithdrawalDelayer.address
      );

      expect(finalWithdrawalBalance).to.equal(
        BigNumber.from(initialWithdrawalBalance).add(BigNumber.from(amount))
      );
    });
    it("test instant withdraw merkle proof with ether", async function () {
      const tokenID = 0;
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

      // Create account and exit some funds
      const numAccounts = 1;
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        ownerWallet,
        hardhatHermez,
        null, // token contract but ether is used
        numAccounts
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, ownerWallet, hardhatHermez)
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      const initialOwnerBalance = await owner.getBalance();

      // perform withdraw
      const numExitRoot = await hardhatHermez.lastForgedBatch();
      const instantWithdraw = true;
      const state = await rollupDB.getStateByIdx(256);
      const exitInfo = await rollupDB.getExitTreeInfo(256, numExitRoot);

      let txRes;
      await expect(
        txRes = await hardhatHermez.withdrawMerkleProof(
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

      const txReceipt = await txRes.wait();

      const gasCost = BigNumber.from(txReceipt.gasUsed).mul(BigNumber.from(txRes.gasPrice));
      const finalOwnerBalance = await owner.getBalance();

      expect(finalOwnerBalance).to.equal(
        BigNumber.from(initialOwnerBalance).add(BigNumber.from(amount)).sub(gasCost)
      );
    });

    it("test delayed withdraw merkle proof with ether", async function () {
      const tokenID = 0;
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

      // Create account and exit some funds
      const numAccounts = 1;
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        ownerWallet,
        hardhatHermez,
        null, // token contract but ether is used
        numAccounts
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, ownerWallet, hardhatHermez)
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      const provider = owner.provider;

      const initialWithdrawalBalance = await provider.getBalance(
        hardhatWithdrawalDelayer.address
      );

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

      const finalWithdrawalBalance = await provider.getBalance(
        hardhatWithdrawalDelayer.address
      );

      expect(finalWithdrawalBalance).to.equal(
        BigNumber.from(initialWithdrawalBalance).add(BigNumber.from(amount))
      );
    });
  });
});
