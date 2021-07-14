const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const SMTMemDB = require("circomlib").SMTMemDB;
const { time } = require("@openzeppelin/test-helpers");
const Scalar = require("ffjavascript").Scalar;
const ProxyAdmin = require("@openzeppelin/upgrades-core/artifacts/ProxyAdmin.json");
const { getAdminAddress } = require("@openzeppelin/upgrades-core");

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

describe("Hermez ERC 20 Upgradability", function () {
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
      "VerifierMock"
    );
    const VerifierWithdrawHelper = await ethers.getContractFactory(
      "VerifierMock"
    );

    const HermezAuctionTest = await ethers.getContractFactory(
      "HermezAuctionTest"
    );
    const WithdrawalDelayer = await ethers.getContractFactory(
      "WithdrawalDelayerTest"
    );

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


    // factory hermez
    const Hermez = await ethers.getContractFactory("HermezV2");

    // Deploy hermez
    hardhatHermez = await upgrades.deployProxy(Hermez, [], {
      unsafeAllowCustomTypes: true,
      initializer: undefined,
    });
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
      hermezGovernanceAddress,
      withdrawalDelay,
      hardhatWithdrawalDelayer.address
    );

    const chainSC = await hardhatHermez.getChainId();
    chainID = chainSC.toNumber();
    chainIDHex = chainSC.toHexString();
  });

  describe("Forge Batch", function () {
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

      // upgrade contract and assure that the state is the same!
      const HermezV2 = await ethers.getContractFactory("HermezV2MockV2");
      const newHermezV2 = HermezV2.attach(hardhatHermez.address);
      await expect(newHermezV2.getVersion()).to.be.reverted;
      await upgrades.upgradeProxy(hardhatHermez.address, HermezV2, {
        unsafeAllowCustomTypes: true
      });
      await newHermezV2.setVersion();
      expect(await newHermezV2.getVersion()).to.be.equal(2);

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
      const exitInfo = await rollupDB.getExitInfo(256, numExitRoot);

      // upgrade contract and assure that the state is the same!
      const HermezV2 = await ethers.getContractFactory("HermezV2MockV2");
      const newHermezV2 = HermezV2.attach(hardhatHermez.address);
      await expect(newHermezV2.getVersion()).to.be.reverted;
      await upgrades.upgradeProxy(hardhatHermez.address, HermezV2, {
        unsafeAllowCustomTypes: true
      });
      await newHermezV2.setVersion();
      expect(await newHermezV2.getVersion()).to.be.equal(2);

      const proofA = ["0", "0"];
      const proofB = [
        ["0", "0"],
        ["0", "0"],
      ];
      const proofC = ["0", "0"];

      await expect(
        newHermezV2.withdrawCircuit(
          proofA,
          proofB,
          proofC,
          tokenID,
          amount,
          amount,
          numExitRoot,
          fromIdx,
          instantWithdraw
        )
      )
        .to.emit(newHermezV2, "WithdrawEvent")
        .withArgs(amount, fromIdx, instantWithdraw);
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

      // upgrade contract and assure that the state is the same!
      const HermezV2 = await ethers.getContractFactory("HermezV2MockV2");
      const newHermezV2 = HermezV2.attach(hardhatHermez.address);
      await expect(newHermezV2.getVersion()).to.be.reverted;
      await upgrades.upgradeProxy(hardhatHermez.address, HermezV2, {
        unsafeAllowCustomTypes: true
      });
      await newHermezV2.setVersion();
      expect(await newHermezV2.getVersion()).to.be.equal(2);

      // perform withdraw
      const numExitRoot = await hardhatHermez.lastForgedBatch();
      const instantWithdraw = false;
      const state = await rollupDB.getStateByIdx(256);
      const exitInfo = await rollupDB.getExitInfo(256, numExitRoot);

      const proofA = ["0", "0"];
      const proofB = [
        ["0", "0"],
        ["0", "0"],
      ];
      const proofC = ["0", "0"];

      await expect(
        newHermezV2.withdrawCircuit(
          proofA,
          proofB,
          proofC,
          tokenID,
          amount,
          amount,
          numExitRoot,
          fromIdx,
          instantWithdraw
        )
      )
        .to.emit(newHermezV2, "WithdrawEvent")
        .withArgs(amount, fromIdx, instantWithdraw);

      const finalOwnerBalance = await hardhatTokenERC20Mock.balanceOf(
        hardhatWithdrawalDelayer.address
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + amount
      );
    });
  });
});

