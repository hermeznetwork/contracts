const {expect} = require("chai");
const {ethers} = require("../../node_modules/@nomiclabs/buidler");
const SMTMemDB = require("circomlib").SMTMemDB;
const {time} = require("@openzeppelin/test-helpers");
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
  registerERC1820,
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

const babyjub0 = 0;
const fromIdx0 = 0;
const loadAmountF0 = 0;
const amountF0 = 0;
const tokenID0 = 0;
const toIdx0 = 0;

describe("Hermez ETH test", function () {
  let buidlerTokenERC20Mock;
  let buidlerHermez;
  let buidlerWithdrawalDelayer;
  let buidlerHEZ;
  let owner;
  let id1;
  let id2;
  let addrs;
  let hermezGovernanceDAOAddress;

  const accounts = [];
  for (let i = 0; i < 10; i++) {
    accounts.push(new HermezAccount());
  }
  const tokenInitialAmount = 1000000;
  const maxL1Tx = 256;
  const maxTx = 512;
  const nLevels = 32;
  const forgeL1L2BatchTimeout = 10;
  let chainID;
  const feeAddToken = 10;
  const withdrawalDelay = 60 * 60 * 24 * 7 * 2; // 2 weeks

  beforeEach(async function () {
    [
      owner,
      governance,
      safetyAddress,
      id1,
      id2,
      ...addrs
    ] = await ethers.getSigners();

    hermezGovernanceDAOAddress = governance.getAddress();

    // factory helpers
    const TokenERC20Mock = await ethers.getContractFactory("ERC20Mock");
    const TokenERC777Mock = await ethers.getContractFactory("ERC777Mock");

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

    // deploy registry erc1820
    await registerERC1820(owner);

    // factory hermez
    const Hermez = await ethers.getContractFactory("HermezTest");

    // deploy tokens
    buidlerTokenERC20Mock = await TokenERC20Mock.deploy(
      "tokenname",
      "TKN",
      await owner.getAddress(),
      tokenInitialAmount
    );

    buidlerHEZ = await TokenERC777Mock.deploy(
      await owner.getAddress(),
      tokenInitialAmount,
      "tokenname",
      "TKN",
      []
    );

    let buidlerVerifierRollupHelper = await VerifierRollupHelper.deploy();
    let buidlerVerifierWithdrawHelper = await VerifierWithdrawHelper.deploy();

    let buidlerHermezAuctionTest = await HermezAuctionTest.deploy();

    // deploy hermez
    buidlerHermez = await Hermez.deploy();
    await buidlerHermez.deployed();

    buidlerWithdrawalDelayer = await WithdrawalDelayer.deploy(
      0,
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
      buidlerHEZ.address,
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
    await buidlerTokenERC20Mock.deployed();

    const chainSC = await buidlerHermez.getChainID();
    chainID = chainSC.toNumber();
  });

  // You can nest describe calls to create subsections.
  describe("L1-user-Tx", function () {
    it("createAccountDeposit", async function () {
      await AddToken(
        buidlerHermez,
        buidlerTokenERC20Mock,
        buidlerHEZ,
        await owner.getAddress(),
        feeAddToken
      );
      const loadAmount = float16.float2Fix(float16.fix2Float(1000));
      const tokenID = 0;
      const babyjub = `0x${accounts[0].bjjCompressed}`;

      // revert msg.value less than loadAmount
      const loadAmountF = float16.fix2Float(loadAmount);
      await expect(
        buidlerHermez.addL1Transaction(
          babyjub,
          fromIdx0,
          loadAmountF,
          amountF0,
          tokenID,
          toIdx0,
          {
            value: loadAmount - Scalar.e(1),
            gasPrice: 0,
          }
        )
      ).to.be.revertedWith("loadAmount != msg.value");

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
        await owner.getAddress(),
        feeAddToken
      );
      // invalid operation in Hermez.sol, test purposes
      buidlerHermez.changeCurrentIdx(257);

      const loadAmount = float16.float2Fix(float16.fix2Float(1000));
      const tokenID = 0;
      const fromIdx = 256;

      // revert msg.value less than loadAmount
      const loadAmountF = float16.fix2Float(loadAmount);
      await expect(
        buidlerHermez.addL1Transaction(
          babyjub0,
          fromIdx,
          loadAmountF,
          amountF0,
          tokenID,
          toIdx0,
          {
            value: loadAmount - Scalar.e(1),
            gasPrice: 0,
          }
        )
      ).to.be.revertedWith("loadAmount != msg.value");

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
        await owner.getAddress(),
        feeAddToken
      );
      // invalid operation in Hermez.sol, test purposes
      buidlerHermez.changeCurrentIdx(257);

      const loadAmount = float16.float2Fix(float16.fix2Float(1000));
      const tokenID = 0;
      const fromIdx = 256;
      const toIdx = 257;
      const amountF = float16.fix2Float(10);

      // revert msg.value less than loadAmount
      const loadAmountF = float16.fix2Float(loadAmount);
      await expect(
        buidlerHermez.addL1Transaction(
          babyjub0,
          fromIdx,
          loadAmountF,
          amountF,
          tokenID,
          toIdx,
          {
            value: loadAmount - Scalar.e(1),
            gasPrice: 0,
          }
        )
      ).to.be.revertedWith("loadAmount != msg.value");

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
        await owner.getAddress(),
        feeAddToken
      );
      // invalid operation in Hermez.sol, test purposes
      buidlerHermez.changeCurrentIdx(257);

      const loadAmount = float16.float2Fix(float16.fix2Float(1000));
      const tokenID = 0;
      const toIdx = 257;
      const amountF = float16.fix2Float(10);
      const babyjub = `0x${accounts[0].bjjCompressed}`;

      // revert msg.value less than loadAmount
      const loadAmountF = float16.fix2Float(loadAmount);
      await expect(
        buidlerHermez.addL1Transaction(
          babyjub,
          fromIdx0,
          loadAmountF,
          amountF,
          tokenID,
          toIdx,
          {
            value: loadAmount - Scalar.e(1),
            gasPrice: 0,
          }
        )
      ).to.be.revertedWith("loadAmount != msg.value");

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
  });

  describe("Forge Batch", function () {
    it("forge L1 user & Coordiator Tx batch", async function () {
      const tokenID = 0;
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
        await owner.getAddress(),
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
        await l1CoordinatorTxEth(tokenID, babyjub, owner, buidlerHermez)
      );

      l1TxCoordiatorArray.push(
        await l1CoordinatorTxBjj(tokenID, babyjub, buidlerHermez)
      );

      // forge batch with all the L1 tx
      await forgerTest.forgeBatch(true, l1TxUserArray, l1TxCoordiatorArray);
    });

    it("test instant withdraw circuit", async function () {
      const tokenID = 0;
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
        await owner.getAddress(),
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
      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      const initialOwnerBalance = await owner.getBalance();

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
          instantWithdraw,
          {
            gasPrice: 0,
          }
        )
      )
        .to.emit(buidlerHermez, "WithdrawEvent")
        .withArgs(fromIdx, numExitRoot, instantWithdraw);
      const finalOwnerBalance = await owner.getBalance();

      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + amount
      );
    });

    it("test delayed withdraw circuit with ether", async function () {
      const tokenID = 0;
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

      // Create account and exit some funds
      const numAccounts = 1;
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        owner,
        buidlerHermez,
        null, // token contract but ether is used
        numAccounts
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, buidlerHermez)
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      const provider = owner.provider;
      const initialWithdrawalBalance = await provider.getBalance(
        buidlerWithdrawalDelayer.address
      );

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
          instantWithdraw,
          {
            gasPrice: 0,
          }
        )
      )
        .to.emit(buidlerHermez, "WithdrawEvent")
        .withArgs(fromIdx, numExitRoot, instantWithdraw);

      const finalWithdrawalBalance = await provider.getBalance(
        buidlerWithdrawalDelayer.address
      );

      expect(parseInt(finalWithdrawalBalance)).to.equal(
        parseInt(initialWithdrawalBalance) + amount
      );
    });
    it("test instant withdraw merkle proof with ether", async function () {
      const tokenID = 0;
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

      // Create account and exit some funds
      const numAccounts = 1;
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        owner,
        buidlerHermez,
        null, // token contract but ether is used
        numAccounts
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, buidlerHermez)
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      const initialOwnerBalance = await owner.getBalance();

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
          instantWithdraw,
          {
            gasPrice: 0,
          }
        )
      )
        .to.emit(buidlerHermez, "WithdrawEvent")
        .withArgs(fromIdx, numExitRoot, instantWithdraw);

      const finalOwnerBalance = await owner.getBalance();

      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + amount
      );
    });

    it("test delayed withdraw merkle proof with ether", async function () {
      const tokenID = 0;
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

      // Create account and exit some funds
      const numAccounts = 1;
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        owner,
        buidlerHermez,
        null, // token contract but ether is used
        numAccounts
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, buidlerHermez)
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      const provider = owner.provider;

      const initialWithdrawalBalance = await provider.getBalance(
        buidlerWithdrawalDelayer.address
      );

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
          instantWithdraw,
          {
            gasPrice: 0,
          }
        )
      )
        .to.emit(buidlerHermez, "WithdrawEvent")
        .withArgs(fromIdx, numExitRoot, instantWithdraw);

      const finalWithdrawalBalance = await provider.getBalance(
        buidlerWithdrawalDelayer.address
      );

      expect(parseInt(finalWithdrawalBalance)).to.equal(
        parseInt(initialWithdrawalBalance) + amount
      );
    });
  });
});
