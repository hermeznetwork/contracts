const { expect } = require("chai");
const { ethers } = require("hardhat");
const SMTMemDB = require("circomlib").SMTMemDB;
const { time } = require("@openzeppelin/test-helpers");
const Scalar = require("ffjavascript").Scalar;

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
} = require("@hermeznetwork/commonjsV1");

describe("Hermez Withdraw Multi Token", function () {
  let hardhatTokenERC20Mock;
  let hardhatTokenERC20Mock2;
  let hardhatTokenERC20Mock3;
  let hardhatTokenERC20Mock4;
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
      "VerifierMock"
    );
    const VerifierWithdrawHelper1 = await ethers.getContractFactory(
      "VerifierMock"
    );
    const VerifierWithdrawHelper2 = await ethers.getContractFactory(
      "VerifierMock"
    );
    const VerifierWithdrawHelper3 = await ethers.getContractFactory(
      "VerifierMock"
    );
    const VerifierWithdrawHelper4 = await ethers.getContractFactory(
      "VerifierMock"
    );

    const HermezAuctionTest = await ethers.getContractFactory(
      "HermezAuctionTest"
    );
    const WithdrawalDelayer = await ethers.getContractFactory(
      "WithdrawalDelayerTest"
    );

    // factory hermez
    const Hermez = await ethers.getContractFactory("HermezTestV2");

    // deploy tokens
    hardhatTokenERC20Mock = await TokenERC20Mock.deploy(
      "tokenname",
      "TKN",
      await owner.getAddress(),
      tokenInitialAmount
    );

    hardhatTokenERC20Mock2 = await TokenERC20Mock.deploy(
      "tokenname2",
      "TKN2",
      await owner.getAddress(),
      tokenInitialAmount
    );

    hardhatTokenERC20Mock3 = await TokenERC20Mock.deploy(
      "tokenname3",
      "TKN3",
      await owner.getAddress(),
      tokenInitialAmount
    );

    hardhatTokenERC20Mock4 = await TokenERC20Mock.deploy(
      "tokenname4",
      "TKN4",
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
    let hardhatVerifierWithdrawHelper1 = await VerifierWithdrawHelper1.deploy();
    let hardhatVerifierWithdrawHelper2 = await VerifierWithdrawHelper2.deploy();
    let hardhatVerifierWithdrawHelper3 = await VerifierWithdrawHelper3.deploy();
    let hardhatVerifierWithdrawHelper4 = await VerifierWithdrawHelper4.deploy();

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
      [hardhatVerifierWithdrawHelper1.address, hardhatVerifierWithdrawHelper2.address, hardhatVerifierWithdrawHelper3.address, hardhatVerifierWithdrawHelper4.address],
      hardhatHermezAuctionTest.address,
      hardhatHEZ.address,
      forgeL1L2BatchTimeout,
      feeAddToken,
      hermezGovernanceAddress,
      withdrawalDelay,
      hardhatWithdrawalDelayer.address
    );

    // wait until is deployed
    await hardhatTokenERC20Mock.deployed();
    await hardhatTokenERC20Mock2.deployed();
    await hardhatTokenERC20Mock3.deployed();
    await hardhatTokenERC20Mock4.deployed();

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
  describe("Withdraw", function () {
    it("test instant withdraw multi token nWithdraws = 1", async function () {
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
      const batchNum = await hardhatHermez.lastForgedBatch();
      const instantWithdraw = true;
      const amountWithdraw = amount / 2;
      const proofA = ["0", "0"];
      const proofB = [
        ["0", "0"],
        ["0", "0"],
      ];
      const proofC = ["0", "0"];

      await expect(
        hardhatHermez.withdrawMultiToken(
          proofA,
          proofB,
          proofC,
          [tokenID],
          [amount],
          [amountWithdraw],
          batchNum,
          [fromIdx],
          [instantWithdraw]
        )
      )
        .to.emit(hardhatHermez, "WithdrawEvent")
        .withArgs(amountWithdraw, fromIdx, instantWithdraw);

      expect(amountWithdraw).to.equal(
        await hardhatHermez.exitAccumulateMap(fromIdx)
      );

      await expect(
        hardhatHermez.withdrawMultiToken(
          proofA,
          proofB,
          proofC,
          [tokenID],
          [amount],
          [amountWithdraw * 2],
          batchNum,
          [fromIdx],
          [instantWithdraw]
        )
      )
        .to.be.revertedWith("Hermez::withdrawMultiToken: AMOUNT_WITHDRAW_LESS_THAN_ACCUMULATED");

      await expect(
        hardhatHermez.withdrawMultiToken(
          proofA,
          proofB,
          proofC,
          [tokenID],
          [amount],
          [amountWithdraw],
          batchNum,
          [fromIdx],
          [instantWithdraw]
        )
      )
        .to.emit(hardhatHermez, "WithdrawEvent")
        .withArgs(amountWithdraw, fromIdx, instantWithdraw);

      const finalOwnerBalance = await hardhatTokenERC20Mock.balanceOf(
        await owner.getAddress()
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + amount
      );

      expect(amount).to.equal(
        await hardhatHermez.exitAccumulateMap(fromIdx)
      );
    });

    it("test instant withdraw multi token nWithdraws = 2", async function () {
      const tokenID = [1, 2];
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float40.round(1000);
      const fromIdx = [256, 257];
      const amount = 100;
      const amount2 = amount * 2;
      const amountF = float40.fix2Float(amount);
      const amountF2 = float40.fix2Float(amount2)

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

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock2,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );

      // Create account and exit some funds
      const numAccounts = 1;
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID[0],
        babyjub,
        owner,
        hardhatHermez,
        hardhatTokenERC20Mock,
        numAccounts
      );
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID[1],
        babyjub,
        owner,
        hardhatHermez,
        hardhatTokenERC20Mock2,
        numAccounts
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID[0], fromIdx[0], amountF, owner, hardhatHermez)
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID[1], fromIdx[1], amountF2, owner, hardhatHermez)
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      // perform withdraw
      const batchNum = await hardhatHermez.lastForgedBatch();
      const instantWithdraw = true;
      const amountWithdraw = amount / 4;
      const amountWithdraw2 = amount2 / 4;
      const proofA = ["0", "0"];
      const proofB = [
        ["0", "0"],
        ["0", "0"],
      ];
      const proofC = ["0", "0"];

      await expect(
        hardhatHermez.withdrawMultiToken(
          proofA,
          proofB,
          proofC,
          [tokenID[0], tokenID[1]],
          [amount, amount2],
          [amountWithdraw, amountWithdraw2],
          batchNum,
          [fromIdx[0], fromIdx[1]],
          [instantWithdraw, instantWithdraw]
        )
      )
        .to.emit(hardhatHermez, "WithdrawEvent")
        .withArgs(amountWithdraw, fromIdx[0], instantWithdraw)
        .to.emit(hardhatHermez, "WithdrawEvent")
        .withArgs(amountWithdraw2, fromIdx[1], instantWithdraw);
    });

    it("test instant withdraw multi token nWithdraws = 3", async function () {
      const tokenID = [1, 2, 3];
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float40.round(1000);
      const fromIdx = [256, 257, 258];
      const amount = 100;
      const amount2 = amount * 2;
      const amountF = float40.fix2Float(amount);
      const amountF2 = float40.fix2Float(amount2)

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

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock2,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock3,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );

      // Create account and exit some funds
      const numAccounts = 1;
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID[0],
        babyjub,
        owner,
        hardhatHermez,
        hardhatTokenERC20Mock,
        numAccounts
      );
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID[1],
        babyjub,
        owner,
        hardhatHermez,
        hardhatTokenERC20Mock2,
        numAccounts
      );
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID[2],
        babyjub,
        owner,
        hardhatHermez,
        hardhatTokenERC20Mock3,
        numAccounts
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID[0], fromIdx[0], amountF, owner, hardhatHermez)
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID[1], fromIdx[1], amountF2, owner, hardhatHermez)
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID[2], fromIdx[2], amountF, owner, hardhatHermez)
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      // perform withdraw
      const batchNum = await hardhatHermez.lastForgedBatch();
      const instantWithdraw = true;
      const amountWithdraw = amount / 4;
      const amountWithdraw2 = amount2 / 4;
      const proofA = ["0", "0"];
      const proofB = [
        ["0", "0"],
        ["0", "0"],
      ];
      const proofC = ["0", "0"];

      await expect(
        hardhatHermez.withdrawMultiToken(
          proofA,
          proofB,
          proofC,
          [tokenID[0], tokenID[1], tokenID[2]],
          [amount, amount2, amount],
          [amountWithdraw, amountWithdraw2, amountWithdraw],
          batchNum,
          [fromIdx[0], fromIdx[1], fromIdx[2]],
          [instantWithdraw, instantWithdraw, instantWithdraw]
        )
      )
        .to.emit(hardhatHermez, "WithdrawEvent")
        .withArgs(amountWithdraw, fromIdx[0], instantWithdraw)
        .to.emit(hardhatHermez, "WithdrawEvent")
        .withArgs(amountWithdraw2, fromIdx[1], instantWithdraw)
        .to.emit(hardhatHermez, "WithdrawEvent")
        .withArgs(amountWithdraw, fromIdx[2], instantWithdraw);
    });

    it("test instant withdraw multi token nWithdraws = 4", async function () {
      const tokenID = [1, 2, 3, 4]
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float40.round(1000);
      const fromIdx = [256, 257, 258, 259]
      const amount = 100;
      const amount2 = amount * 2;
      const amountF = float40.fix2Float(amount);
      const amountF2 = float40.fix2Float(amount2)

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

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock2,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock3,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock4,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );

      // Create account and exit some funds
      const numAccounts = 1;
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID[0],
        babyjub,
        owner,
        hardhatHermez,
        hardhatTokenERC20Mock,
        numAccounts
      );
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID[1],
        babyjub,
        owner,
        hardhatHermez,
        hardhatTokenERC20Mock2,
        numAccounts
      );
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID[2],
        babyjub,
        owner,
        hardhatHermez,
        hardhatTokenERC20Mock3,
        numAccounts
      );
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID[3],
        babyjub,
        owner,
        hardhatHermez,
        hardhatTokenERC20Mock4,
        numAccounts
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID[0], fromIdx[0], amountF, owner, hardhatHermez)
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID[1], fromIdx[1], amountF2, owner, hardhatHermez)
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID[2], fromIdx[2], amountF2, owner, hardhatHermez)
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID[3], fromIdx[3], amountF2, owner, hardhatHermez)
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      // perform withdraw
      const batchNum = await hardhatHermez.lastForgedBatch();
      const instantWithdraw = true;
      const amountWithdraw = amount / 4;
      const amountWithdraw2 = amount2 / 4;
      const proofA = ["0", "0"];
      const proofB = [
        ["0", "0"],
        ["0", "0"],
      ];
      const proofC = ["0", "0"];

      await expect(
        hardhatHermez.withdrawMultiToken(
          proofA,
          proofB,
          proofC,
          [tokenID[0], tokenID[1], tokenID[2], tokenID[3]],
          [amount, amount2, amount, amount2],
          [amountWithdraw, amountWithdraw2, amountWithdraw, amountWithdraw2],
          batchNum,
          [fromIdx[0], fromIdx[1], fromIdx[2], fromIdx[3]],
          [instantWithdraw, instantWithdraw, instantWithdraw, instantWithdraw]
        )
      )
        .to.emit(hardhatHermez, "WithdrawEvent")
        .withArgs(amountWithdraw, fromIdx[0], instantWithdraw)
        .to.emit(hardhatHermez, "WithdrawEvent")
        .withArgs(amountWithdraw2, fromIdx[1], instantWithdraw)
        .to.emit(hardhatHermez, "WithdrawEvent")
        .withArgs(amountWithdraw, fromIdx[2], instantWithdraw)
        .to.emit(hardhatHermez, "WithdrawEvent")
        .withArgs(amountWithdraw2, fromIdx[3], instantWithdraw);
    });

    it("test instant withdraw multi token nWithdraws = 2 check errors", async function () {
      const tokenID = [1, 2];
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float40.round(1000);
      const fromIdx = [256, 257];
      const amount = 100;
      const amount2 = amount * 2;
      const amountF = float40.fix2Float(amount);
      const amountF2 = float40.fix2Float(amount2)

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

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock2,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );

      // Create account and exit some funds
      const numAccounts = 1;
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID[0],
        babyjub,
        owner,
        hardhatHermez,
        hardhatTokenERC20Mock,
        numAccounts
      );
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID[1],
        babyjub,
        owner,
        hardhatHermez,
        hardhatTokenERC20Mock2,
        numAccounts
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID[0], fromIdx[0], amountF, owner, hardhatHermez)
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID[1], fromIdx[1], amountF2, owner, hardhatHermez)
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID[0], fromIdx[0], amountF, owner, hardhatHermez)
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID[1], fromIdx[1], amountF2, owner, hardhatHermez)
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID[0], fromIdx[0], amountF, owner, hardhatHermez)
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      // perform withdraw
      const batchNum = await hardhatHermez.lastForgedBatch();
      const instantWithdraw = true;
      const amountWithdraw = amount / 4;
      const amountWithdraw2 = amount2 / 4;
      const proofA = ["0", "0"];
      const proofB = [
        ["0", "0"],
        ["0", "0"],
      ];
      const proofC = ["0", "0"];

      await expect(
        hardhatHermez.withdrawMultiToken(
          proofA,
          proofB,
          proofC,
          [tokenID[0], tokenID[1], tokenID[0], tokenID[1], tokenID[0]],
          [amount, amount2, amount, amount2, amount],
          [amountWithdraw, amountWithdraw2, amountWithdraw, amountWithdraw2, amountWithdraw],
          batchNum,
          [fromIdx[0], fromIdx[1], fromIdx[0], fromIdx[1], fromIdx[0]],
          [instantWithdraw, instantWithdraw, instantWithdraw, instantWithdraw, instantWithdraw]
        )
      )
        .to.be.revertedWith("Hermez::withdrawMultiToken: MAX_TOKEN_WITHDRAW_EXCEED")

      await expect(
        hardhatHermez.withdrawMultiToken(
          proofA,
          proofB,
          proofC,
          [tokenID[0], tokenID[1], tokenID[0], tokenID[1]],
          [amount, amount2, amount],
          [amountWithdraw, amountWithdraw2, amountWithdraw],
          batchNum,
          [fromIdx[0], fromIdx[1], fromIdx[0], fromIdx[1]],
          [instantWithdraw, instantWithdraw, instantWithdraw, instantWithdraw]
        )
      )
        .to.be.revertedWith("Hermez::withdrawMultiToken: SAME_ARRAY_LENGTH_REQUIRED")
    });
  });
});
