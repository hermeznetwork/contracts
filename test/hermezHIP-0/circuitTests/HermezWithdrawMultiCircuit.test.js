const { expect } = require("chai");
const { ethers } = require("hardhat");
const SMTMemDB = require("circomlib").SMTMemDB;
const { time } = require("@openzeppelin/test-helpers");
const Scalar = require("ffjavascript").Scalar;
const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");

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
} = require("../helpers/helpers");
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
  withdrawMultiUtils,
} = require("@hermeznetwork/commonjsV1");

describe("Hermez Withdraw Multi Token Circuit", function () {
  this.timeout(800000);
  let hardhatTokenERC20Mock1;
  let hardhatTokenERC20Mock2;
  let hardhatTokenERC20Mock3;
  let hardhatTokenERC20Mock4;
  let hardhatTokenERC20Mock5;
  let hardhatTokenERC20Mock6;
  let hardhatTokenERC20Mock7;
  let hardhatTokenERC20Mock8;
  let hardhatTokenERC20Mocks;
  let hardhatHermez;
  let hardhatWithdrawalDelayer;
  let hardhatHEZ;
  let hardhatVerifierWithdrawHelper1;
  let hardhatVerifierWithdrawHelper2;
  let hardhatVerifierWithdrawHelper3;
  let hardhatVerifierWithdrawHelper4;
  let hardhatVerifierWithdrawHelper5;
  let hardhatVerifierWithdrawHelper6;
  let hardhatVerifierWithdrawHelper7;
  let hardhatVerifierWithdrawHelper8;

  let owner;
  let id1;
  let id2;
  let addrs;
  let hermezGovernanceAddress;
  let ownerWallet;

  let chainID;
  let chainIDHex;

  const accounts = [];
  for (let i = 0; i < 15; i++) {
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

    const VerifierBjjHelper = await ethers.getContractFactory(
      "VerifierMock"
    );
    const VerifierRollupHelper = await ethers.getContractFactory(
      "VerifierMock"
    );
    const VerifierWithdrawHelper1 = await ethers.getContractFactory(
      "VerifierWithdrawMultiToken1"
    );
    const VerifierWithdrawHelper2 = await ethers.getContractFactory(
      "VerifierWithdrawMultiToken2"
    );
    const VerifierWithdrawHelper3 = await ethers.getContractFactory(
      "VerifierWithdrawMultiToken3"
    );
    const VerifierWithdrawHelper4 = await ethers.getContractFactory(
      "VerifierWithdrawMultiToken4"
    );
    const VerifierWithdrawHelper5 = await ethers.getContractFactory(
      "VerifierWithdrawMultiToken5"
    );
    const VerifierWithdrawHelper6 = await ethers.getContractFactory(
      "VerifierWithdrawMultiToken6"
    );
    const VerifierWithdrawHelper7 = await ethers.getContractFactory(
      "VerifierWithdrawMultiToken7"
    );
    const VerifierWithdrawHelper8 = await ethers.getContractFactory(
      "VerifierWithdrawMultiToken8"
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
    hardhatTokenERC20Mock1 = await TokenERC20Mock.deploy(
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

    hardhatTokenERC20Mock5 = await TokenERC20Mock.deploy(
      "tokenname5",
      "TKN5",
      await owner.getAddress(),
      tokenInitialAmount
    );

    hardhatTokenERC20Mock6 = await TokenERC20Mock.deploy(
      "tokenname6",
      "TKN6",
      await owner.getAddress(),
      tokenInitialAmount
    );

    hardhatTokenERC20Mock7 = await TokenERC20Mock.deploy(
      "tokenname7",
      "TKN7",
      await owner.getAddress(),
      tokenInitialAmount
    );

    hardhatTokenERC20Mock8 = await TokenERC20Mock.deploy(
      "tokenname8",
      "TKN8",
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
    hardhatVerifierWithdrawHelper1 = await VerifierWithdrawHelper1.deploy();
    hardhatVerifierWithdrawHelper2 = await VerifierWithdrawHelper2.deploy();
    hardhatVerifierWithdrawHelper3 = await VerifierWithdrawHelper3.deploy();
    hardhatVerifierWithdrawHelper4 = await VerifierWithdrawHelper4.deploy();
    hardhatVerifierWithdrawHelper5 = await VerifierWithdrawHelper5.deploy();
    hardhatVerifierWithdrawHelper6 = await VerifierWithdrawHelper6.deploy();
    hardhatVerifierWithdrawHelper7 = await VerifierWithdrawHelper7.deploy();
    hardhatVerifierWithdrawHelper8 = await VerifierWithdrawHelper8.deploy();
    hardhatVerifierBjj = await VerifierBjjHelper.deploy();

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
      [hardhatVerifierWithdrawHelper1.address,
      hardhatVerifierWithdrawHelper2.address,
      hardhatVerifierWithdrawHelper3.address,
      hardhatVerifierWithdrawHelper4.address,
      hardhatVerifierWithdrawHelper5.address,
      hardhatVerifierWithdrawHelper6.address,
      hardhatVerifierWithdrawHelper7.address,
      hardhatVerifierWithdrawHelper8.address
      ],
      hardhatVerifierBjj.address,
      hardhatHermezAuctionTest.address,
      hardhatHEZ.address,
      forgeL1L2BatchTimeout,
      feeAddToken,
      hermezGovernanceAddress,
      withdrawalDelay,
      hardhatWithdrawalDelayer.address
    );

    // wait until is deployed
    await hardhatTokenERC20Mock1.deployed();
    await hardhatTokenERC20Mock2.deployed();
    await hardhatTokenERC20Mock3.deployed();
    await hardhatTokenERC20Mock4.deployed();
    await hardhatTokenERC20Mock5.deployed();
    await hardhatTokenERC20Mock6.deployed();
    await hardhatTokenERC20Mock7.deployed();
    await hardhatTokenERC20Mock8.deployed();

    const chainSC = await hardhatHermez.getChainID();
    chainID = chainSC.toNumber();
    chainIDHex = chainSC.toHexString();
    hardhatTokenERC20Mocks = [
      hardhatTokenERC20Mock1,
      hardhatTokenERC20Mock2,
      hardhatTokenERC20Mock3,
      hardhatTokenERC20Mock4,
      hardhatTokenERC20Mock5,
      hardhatTokenERC20Mock6,
      hardhatTokenERC20Mock7,
      hardhatTokenERC20Mock8
    ];
  });

  describe("test tokens contract", function () {
    it("Should share tokens", async function () {
      await hardhatTokenERC20Mock1.transfer(await id1.getAddress(), 50);
      const id1Balance = await hardhatTokenERC20Mock1.balanceOf(
        await id1.getAddress()
      );
      expect(id1Balance).to.equal(50);

      await hardhatTokenERC20Mock1.transfer(await id2.getAddress(), 50);

      const id2Balance = await hardhatTokenERC20Mock1.balanceOf(
        await id2.getAddress()
      );
      expect(id2Balance).to.equal(50);
    });
  });
  describe("Withdraw", function () {
    it("test instant withdraw multi token nWithdraws = 1", async function () {
      const tokenID = [1];
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float40.round(1000);
      const fromIdx = [256];
      const amount = 10;
      const amountF = float40.fix2Float(amount);

      const { proofA, proofB, proofC } = await createProof(tokenID, babyjub, loadAmount, fromIdx, amountF, 0);
      const batchNum = await hardhatHermez.lastForgedBatch();

      // perform withdraw
      const amountWithdraw = amount / 2;
      const instantWithdraw = true;
      await expect(
        hardhatHermez.withdrawMultiToken(
          proofA,
          proofB,
          proofC,
          [tokenID[0]],
          [amount],
          [amountWithdraw],
          batchNum,
          [fromIdx[0]],
          [instantWithdraw]
        )
      )
        .to.emit(hardhatHermez, "WithdrawEventNew")
        .withArgs(amountWithdraw, fromIdx[0], instantWithdraw);

      expect(amountWithdraw).to.equal(
        await hardhatHermez.exitAccumulateMap(fromIdx[0])
      );

      await expect(
        hardhatHermez.withdrawMultiToken(
          proofA,
          proofB,
          proofC,
          [tokenID[0]],
          [amount],
          [amountWithdraw * 2],
          batchNum,
          [fromIdx[0]],
          [instantWithdraw]
        )
      )
        .to.be.revertedWith("Hermez::withdrawMultiToken: AMOUNT_WITHDRAW_LESS_THAN_ACCUMULATED");

      await expect(
        hardhatHermez.withdrawMultiToken(
          proofA,
          proofB,
          proofC,
          [tokenID[0]],
          [amount],
          [amountWithdraw],
          batchNum,
          [fromIdx[0]],
          [instantWithdraw]
        )
      )
        .to.emit(hardhatHermez, "WithdrawEventNew")
        .withArgs(amountWithdraw, fromIdx[0], instantWithdraw);

      const finalOwnerBalance = await hardhatTokenERC20Mock.balanceOf(
        await owner.getAddress()
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + amount
      );

      expect(amount).to.equal(
        await hardhatHermez.exitAccumulateMap(fromIdx[0])
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
      const amountF2 = float40.fix2Float(amount2);

      const { proofA, proofB, proofC } = await createProof(tokenID, babyjub, loadAmount, fromIdx, amountF, amountF2);
      const batchNum = await hardhatHermez.lastForgedBatch();

      // perform withdraw
      const instantWithdraw = true;
      const amountWithdraw = amount / 4;
      const amountWithdraw2 = amount2 / 4;

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
        .to.emit(hardhatHermez, "WithdrawEventNew")
        .withArgs(amountWithdraw, fromIdx[0], instantWithdraw)
        .to.emit(hardhatHermez, "WithdrawEventNew")
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
      const amountF2 = float40.fix2Float(amount2);

      const { proofA, proofB, proofC } = await createProof(tokenID, babyjub, loadAmount, fromIdx, amountF, amountF2);
      const batchNum = await hardhatHermez.lastForgedBatch();

      // perform withdraw
      const instantWithdraw = true;
      const amountWithdraw = amount / 4;
      const amountWithdraw2 = amount2 / 4;

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
        .to.emit(hardhatHermez, "WithdrawEventNew")
        .withArgs(amountWithdraw, fromIdx[0], instantWithdraw)
        .to.emit(hardhatHermez, "WithdrawEventNew")
        .withArgs(amountWithdraw2, fromIdx[1], instantWithdraw)
        .to.emit(hardhatHermez, "WithdrawEventNew")
        .withArgs(amountWithdraw, fromIdx[2], instantWithdraw);
    });

    // it("test instant withdraw multi token nWithdraws = 4", async function () {
    //   const tokenID = [1, 2, 3, 4]
    //   const babyjub = `0x${accounts[0].bjjCompressed}`;
    //   const loadAmount = float40.round(1000);
    //   const fromIdx = [256, 257, 258, 259]
    //   const amount = 100;
    //   const amount2 = amount * 2;
    //   const amountF = float40.fix2Float(amount);
    //   const amountF2 = float40.fix2Float(amount2)

    //   const {proofA, proofB, proofC} = await createProof(tokenID, babyjub, loadAmount, fromIdx, amountF, amountF2);
    //   const batchNum = await hardhatHermez.lastForgedBatch();

    //   // perform withdraw
    //   const instantWithdraw = true;
    //   const amountWithdraw = amount / 4;
    //   const amountWithdraw2 = amount2 / 4;

    //   await expect(
    //     hardhatHermez.withdrawMultiToken(
    //       proofA,
    //       proofB,
    //       proofC,
    //       [tokenID[0], tokenID[1], tokenID[2], tokenID[3]],
    //       [amount, amount2, amount, amount2],
    //       [amountWithdraw, amountWithdraw2, amountWithdraw, amountWithdraw2],
    //       batchNum,
    //       [fromIdx[0], fromIdx[1], fromIdx[2], fromIdx[3]],
    //       [instantWithdraw, instantWithdraw, instantWithdraw, instantWithdraw]
    //     )
    //   )
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw, fromIdx[0], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw2, fromIdx[1], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw, fromIdx[2], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw2, fromIdx[3], instantWithdraw);
    // });

    // it("test instant withdraw multi token nWithdraws = 5", async function () {
    //   const tokenID = [1, 2, 3, 4, 5]
    //   const babyjub = `0x${accounts[0].bjjCompressed}`;
    //   const loadAmount = float40.round(1000);
    //   const fromIdx = [256, 257, 258, 259, 260]
    //   const amount = 100;
    //   const amount2 = amount * 2;
    //   const amountF = float40.fix2Float(amount);
    //   const amountF2 = float40.fix2Float(amount2)

    //   const {proofA, proofB, proofC} = await createProof(tokenID, babyjub, loadAmount, fromIdx, amountF, amountF2);
    //   const batchNum = await hardhatHermez.lastForgedBatch();

    //   // perform withdraw
    //   const instantWithdraw = true;
    //   const amountWithdraw = amount / 4;
    //   const amountWithdraw2 = amount2 / 4;

    //   await expect(
    //     hardhatHermez.withdrawMultiToken(
    //       proofA,
    //       proofB,
    //       proofC,
    //       [tokenID[0], tokenID[1], tokenID[2], tokenID[3], tokenID[4]],
    //       [amount, amount2, amount, amount2, amount],
    //       [amountWithdraw, amountWithdraw2, amountWithdraw, amountWithdraw2, amountWithdraw],
    //       batchNum,
    //       [fromIdx[0], fromIdx[1], fromIdx[2], fromIdx[3], fromIdx[4]],
    //       [instantWithdraw, instantWithdraw, instantWithdraw, instantWithdraw, instantWithdraw]
    //     )
    //   )
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw, fromIdx[0], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw2, fromIdx[1], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw, fromIdx[2], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw2, fromIdx[3], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw, fromIdx[4], instantWithdraw);
    // });

    // it("test instant withdraw multi token nWithdraws = 6", async function () {
    //   const tokenID = [1, 2, 3, 4, 5, 6]
    //   const babyjub = `0x${accounts[0].bjjCompressed}`;
    //   const loadAmount = float40.round(1000);
    //   const fromIdx = [256, 257, 258, 259, 260, 261]
    //   const amount = 100;
    //   const amount2 = amount * 2;
    //   const amountF = float40.fix2Float(amount);
    //   const amountF2 = float40.fix2Float(amount2)

    //   const {proofA, proofB, proofC} = await createProof(tokenID, babyjub, loadAmount, fromIdx, amountF, amountF2);
    //   const batchNum = await hardhatHermez.lastForgedBatch();

    //   // perform withdraw
    //   const instantWithdraw = true;
    //   const amountWithdraw = amount / 4;
    //   const amountWithdraw2 = amount2 / 4;

    //   await expect(
    //     hardhatHermez.withdrawMultiToken(
    //       proofA,
    //       proofB,
    //       proofC,
    //       [tokenID[0], tokenID[1], tokenID[2], tokenID[3], tokenID[4], tokenID[5]],
    //       [amount, amount2, amount, amount2, amount, amount2],
    //       [amountWithdraw, amountWithdraw2, amountWithdraw, amountWithdraw2, amountWithdraw, amountWithdraw2],
    //       batchNum,
    //       [fromIdx[0], fromIdx[1], fromIdx[2], fromIdx[3], fromIdx[4], fromIdx[5]],
    //       [instantWithdraw, instantWithdraw, instantWithdraw, instantWithdraw, instantWithdraw, instantWithdraw]
    //     )
    //   )
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw, fromIdx[0], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw2, fromIdx[1], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw, fromIdx[2], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw2, fromIdx[3], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw, fromIdx[4], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw2, fromIdx[5], instantWithdraw);
    // });

    // it("test instant withdraw multi token nWithdraws = 7", async function () {
    //   const tokenID = [1, 2, 3, 4, 5, 6, 7]
    //   const babyjub = `0x${accounts[0].bjjCompressed}`;
    //   const loadAmount = float40.round(1000);
    //   const fromIdx = [256, 257, 258, 259, 260, 261, 262]
    //   const amount = 100;
    //   const amount2 = amount * 2;
    //   const amountF = float40.fix2Float(amount);
    //   const amountF2 = float40.fix2Float(amount2)

    //   const {proofA, proofB, proofC} = await createProof(tokenID, babyjub, loadAmount, fromIdx, amountF, amountF2);
    //   const batchNum = await hardhatHermez.lastForgedBatch();

    //   // perform withdraw
    //   const instantWithdraw = true;
    //   const amountWithdraw = amount / 4;
    //   const amountWithdraw2 = amount2 / 4;

    //   await expect(
    //     hardhatHermez.withdrawMultiToken(
    //       proofA,
    //       proofB,
    //       proofC,
    //       [tokenID[0], tokenID[1], tokenID[2], tokenID[3], tokenID[4], tokenID[5], tokenID[6]],
    //       [amount, amount2, amount, amount2, amount, amount2, amount],
    //       [amountWithdraw, amountWithdraw2, amountWithdraw, amountWithdraw2, amountWithdraw, amountWithdraw2, amountWithdraw],
    //       batchNum,
    //       [fromIdx[0], fromIdx[1], fromIdx[2], fromIdx[3], fromIdx[4], fromIdx[5], fromIdx[6]],
    //       [instantWithdraw, instantWithdraw, instantWithdraw, instantWithdraw, instantWithdraw, instantWithdraw, instantWithdraw]
    //     )
    //   )
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw, fromIdx[0], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw2, fromIdx[1], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw, fromIdx[2], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw2, fromIdx[3], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw, fromIdx[4], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw2, fromIdx[5], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw, fromIdx[6], instantWithdraw);
    // });

    // it("test instant withdraw multi token nWithdraws = 8", async function () {
    //   const tokenID = [1, 2, 3, 4, 5, 6, 7, 8]
    //   const babyjub = `0x${accounts[0].bjjCompressed}`;
    //   const loadAmount = float40.round(1000);
    //   const fromIdx = [256, 257, 258, 259, 260, 261, 262, 263]
    //   const amount = 100;
    //   const amount2 = amount * 2;
    //   const amountF = float40.fix2Float(amount);
    //   const amountF2 = float40.fix2Float(amount2)

    //   const {proofA, proofB, proofC} = await createProof(tokenID, babyjub, loadAmount, fromIdx, amountF, amountF2);
    //   const batchNum = await hardhatHermez.lastForgedBatch();

    //   // perform withdraw
    //   const instantWithdraw = true;
    //   const amountWithdraw = amount / 4;
    //   const amountWithdraw2 = amount2 / 4;

    //   await expect(
    //     hardhatHermez.withdrawMultiToken(
    //       proofA,
    //       proofB,
    //       proofC,
    //       [tokenID[0], tokenID[1], tokenID[2], tokenID[3], tokenID[4], tokenID[5], tokenID[6], tokenID[7]],
    //       [amount, amount2, amount, amount2, amount, amount2, amount, amount2],
    //       [amountWithdraw, amountWithdraw2, amountWithdraw, amountWithdraw2, amountWithdraw, amountWithdraw2, amountWithdraw, amountWithdraw2],
    //       batchNum,
    //       [fromIdx[0], fromIdx[1], fromIdx[2], fromIdx[3], fromIdx[4], fromIdx[5], fromIdx[6], fromIdx[7]],
    //       [instantWithdraw, instantWithdraw, instantWithdraw, instantWithdraw, instantWithdraw, instantWithdraw, instantWithdraw, instantWithdraw]
    //     )
    //   )
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw, fromIdx[0], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw2, fromIdx[1], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw, fromIdx[2], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw2, fromIdx[3], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw, fromIdx[4], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw2, fromIdx[5], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw, fromIdx[6], instantWithdraw)
    //     .to.emit(hardhatHermez, "WithdrawEvent")
    //     .withArgs(amountWithdraw2, fromIdx[7], instantWithdraw);
    // });
  });

  async function createProof(tokenID, babyjub, loadAmount, fromIdx, amountF, amountF2) {
    const l1TxUserArray = [];

    const rollupDB = await RollupDB(new SMTMemDB(), chainID);
    const forgerTest = new ForgerTest(
      maxTx,
      maxL1Tx,
      nLevels,
      hardhatHermez,
      rollupDB
    );

    for (let i = 0; i < tokenID.length; i++) {
      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mocks[i],
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );
    }

    // Create account and exit some funds
    const numAccounts = 1;
    for (let i = 0; i < tokenID.length; i++) {
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID[i],
        babyjub,
        owner,
        hardhatHermez,
        hardhatTokenERC20Mocks[i],
        numAccounts
      );
    }

    for (let i = 0; i < tokenID.length; i++) {
      if (i % 2 == 0) {
        l1TxUserArray.push(
          await l1UserTxForceExit(tokenID[i], fromIdx[i], amountF, owner, hardhatHermez)
        );
      } else {
        l1TxUserArray.push(
          await l1UserTxForceExit(tokenID[i], fromIdx[i], amountF2, owner, hardhatHermez)
        );
      }
    }

    // forge empty batch
    await forgerTest.forgeBatch(true, [], []);
    // forge batch with all the create account and exit
    await forgerTest.forgeBatch(true, l1TxUserArray, []);

    // circuit stuff
    const batchNum = await hardhatHermez.lastForgedBatch();
    const stateRoot = await rollupDB.getStateRoot(batchNum);
    const input = {
      tokenIDs: [],
      balances: [],
      idxs: [],
      signs: [],
      ays: [],
      exitBalances: [],
      accumulatedHashes: [],
      nonces: [],
      siblingsStates: []
    };
    const tmpStates = [];
    const siblingsArray = []
    for (let i = 0; i < tokenID.length; i++) {
      const exitInfo = await rollupDB.getExitInfo(fromIdx[i], batchNum);
      const tmpExitInfo = exitInfo;
      const tmpState = tmpExitInfo.state;
      const siblings = exitInfo.siblings;
      tmpStates.push(tmpState);
      siblingsArray.push(siblings);
    }

    input.rootState = stateRoot;
    input.ethAddr = Scalar.fromString(tmpStates[0].ethAddr, 16);
    for (let i = 0; i < tmpStates.length; i++) {
      input.tokenIDs.push(tmpStates[i].tokenID);
      input.balances.push(tmpStates[i].balance);
      input.idxs.push(tmpStates[i].idx);
      input.signs.push(tmpStates[i].sign);
      input.ays.push(Scalar.fromString(tmpStates[i].ay, 16))
      input.exitBalances.push(tmpStates[i].exitBalance);
      input.accumulatedHashes.push(tmpStates[i].accumulatedHash);
      input.nonces.push(tmpStates[i].nonce);
      let siblingsAux = siblingsArray[i];
      while (siblingsAux.length < (nLevels + 1)) siblingsAux.push(Scalar.e(0));
      input.siblingsStates.push(siblingsAux);
    }

    const startTime = Date.now()
    const prove = await snarkjs.groth16.fullProve(input, path.join(__dirname, `./circuits/withdraw-multi-token-${tokenID.length}.wasm`), path.join(__dirname, `./circuits/withdraw-multi-token-${tokenID.length}.zkey`));
    const endTime = Date.now()
    console.log(`Call to withdraw-${tokenID.length} took ${endTime - startTime} milliseconds`)
    const vKey = JSON.parse(fs.readFileSync(path.join(__dirname, `./circuits/verification_key_wmt_${tokenID.length}.json`)));
    const res = await snarkjs.groth16.verify(vKey, prove.publicSignals, prove.proof);
    expect(res).to.be.true;

    const proofA = [prove.proof.pi_a[0],
    prove.proof.pi_a[1]
    ];
    const proofB = [
      [
        prove.proof.pi_b[0][1],
        prove.proof.pi_b[0][0]
      ],
      [
        prove.proof.pi_b[1][1],
        prove.proof.pi_b[1][0]
      ]
    ];
    const proofC = [prove.proof.pi_c[0],
    prove.proof.pi_c[1]
    ];

    // perform withdraw
    const instantWithdraw = true;
    const amountWithdraw = amount / 4;
    const amountWithdraw2 = amount2 / 4;

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
      .to.emit(hardhatHermez, "WithdrawEventNew")
      .withArgs(amountWithdraw, fromIdx[0], instantWithdraw)
      .to.emit(hardhatHermez, "WithdrawEventNew")
      .withArgs(amountWithdraw2, fromIdx[1], instantWithdraw)
      .to.emit(hardhatHermez, "WithdrawEventNew")
      .withArgs(amountWithdraw, fromIdx[2], instantWithdraw)
      .to.emit(hardhatHermez, "WithdrawEventNew")
      .withArgs(amountWithdraw2, fromIdx[3], instantWithdraw);
  });* /
  });
});

