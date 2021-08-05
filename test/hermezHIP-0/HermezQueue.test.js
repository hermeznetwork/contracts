const { expect } = require("chai");
const { ethers } = require("hardhat");
const SMTMemDB = require("circomlib").SMTMemDB;
const {
  l1UserTxCreateAccountDeposit,
  l1CoordinatorTxBjj,
  AddToken,
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

const INITIAL_DELAY = 0;

describe("Hermez Queue", function () {
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
    let TokenERC20Mock = await ethers.getContractFactory("ERC20Mock");
    const TokenERC20PermitMock = await ethers.getContractFactory("ERC20PermitMock");

    const VerifierRollupHelper = await ethers.getContractFactory(
      "VerifierMock"
    );
    const VerifierWithdrawHelper = await ethers.getContractFactory(
      "VerifierMock"
    );
    let HermezAuctionTest = await ethers.getContractFactory(
      "HermezAuctionTest"
    );
    let WithdrawalDelayer = await ethers.getContractFactory(
      "WithdrawalDelayerTest"
    );

    // factory hermez
    let Hermez = await ethers.getContractFactory("HermezTestV2");

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

    await hardhatHermez.initializeHermez(
      [hardhatVerifierRollupHelper.address],
      calculateInputMaxTxLevels([maxTx], [nLevels]),
      [hardhatVerifierWithdrawHelper.address, hardhatVerifierWithdrawHelper.address, hardhatVerifierWithdrawHelper.address, hardhatVerifierWithdrawHelper.address],
      hardhatVerifierWithdrawHelper.address,
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
    const chainSC = await hardhatHermez.getChainID();
    chainID = chainSC.toNumber();
  });

  describe("Test Queue", function () {
    it("Exceed 128 l1-user-tx", async function () {
      this.timeout(0);
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float40.round(1000);
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
      const initialLastForge = await hardhatHermez.nextL1FillingQueue();
      const initialCurrentForge = await hardhatHermez.nextL1ToForgeQueue();
      // add l1-user-tx
      for (let i = 0; i < 127; i++)
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
      // after 128 l1-user-tx still in the same queue
      expect(initialLastForge).to.equal(
        await hardhatHermez.nextL1FillingQueue()
      );
      expect(initialCurrentForge).to.equal(
        await hardhatHermez.nextL1ToForgeQueue()
      );
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
      // last Forge is updated at transaction 128
      const after128L1LastForge = await hardhatHermez.nextL1FillingQueue();
      const after128L1CurrentForge = await hardhatHermez.nextL1ToForgeQueue();
      expect(parseInt(initialLastForge) + 1).to.equal(after128L1LastForge);
      expect(parseInt(initialCurrentForge)).to.equal(after128L1CurrentForge);
      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);
      const afterForgeLastForge = await hardhatHermez.nextL1FillingQueue();
      const afterForgeCurrentForge = await hardhatHermez.nextL1ToForgeQueue();
      expect(after128L1LastForge).to.equal(afterForgeLastForge);
      expect(afterForgeCurrentForge).to.equal(after128L1CurrentForge + 1);
      const l1TxCoordiatorArray = [];
      // forge batch with all the L1 tx
      await forgerTest.forgeBatch(true, l1TxUserArray, l1TxCoordiatorArray);
      expect(parseInt(afterForgeLastForge) + 1).to.equal(
        await hardhatHermez.nextL1FillingQueue()
      );
      expect(parseInt(afterForgeCurrentForge) + 1).to.equal(
        await hardhatHermez.nextL1ToForgeQueue()
      );
    });
    it("Exceed max l1-tx", async function () {
      this.timeout(0);
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float40.round(1000);
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
      ); // add l1-user-tx
      for (let i = 0; i < 128; i++)
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
      await forgerTest.forgeBatch(true, [], []);
      const initialLastForge = await hardhatHermez.nextL1FillingQueue();
      const initialCurrentForge = await hardhatHermez.nextL1ToForgeQueue();
      const lastLastForge = await hardhatHermez.nextL1FillingQueue();
      const lastCurrentForge = await hardhatHermez.nextL1ToForgeQueue();
      const l1TxCoordiatorArray = [];
      for (let i = 0; i < 129; i++) {
        await l1TxCoordiatorArray.push(
          await l1CoordinatorTxBjj(tokenID, babyjub, hardhatHermez)
        );
      }
      let stringL1CoordinatorTx = "";
      for (let tx of l1TxCoordiatorArray) {
        stringL1CoordinatorTx =
          stringL1CoordinatorTx + tx.l1TxCoordinatorbytes.slice(2); // retireve the 0x
      }
      // custom impossible forge, 128 L1-user-Tx + 129 L1-operator-Tx = 257 > MAX_L1_TX
      const proofA = ["0", "0"];
      const proofB = [
        ["0", "0"],
        ["0", "0"],
      ];
      const proofC = ["0", "0"];
      const newLastIdx = 257;
      const newStateRoot = 123;
      const newExitRoot = 456;
      const compressedL1CoordinatorTx = `0x${stringL1CoordinatorTx}`;
      const L2TxsData = "0x00";
      const feeIdxCoordinator = "0x00";
      const verifierIdx = 0;
      await expect(
        hardhatHermez.forgeBatch(
          newLastIdx,
          newStateRoot,
          compressedL1CoordinatorTx,
          L2TxsData,
          feeIdxCoordinator,
          verifierIdx,
          true,
          proofA,
          proofB,
          proofC
        )
      ).to.be.revertedWith("Hermez::_buildL1Data: L1_TX_OVERFLOW");
    });
  });
});
