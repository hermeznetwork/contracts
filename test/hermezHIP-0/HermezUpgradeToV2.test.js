const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const SMTMemDB = require("circomlib").SMTMemDB;
const { time } = require("@openzeppelin/test-helpers");
const Scalar = require("ffjavascript").Scalar;
const ProxyAdmin = require("@openzeppelin/upgrades-core/artifacts/ProxyAdmin.json");
const { getAdminAddress } = require("@openzeppelin/upgrades-core");

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
} = require("../hermez/helpers/helpers");


const {
  createAccounts: createAccountsV1,
  ForgerTest: ForgeTestV1,
} = require("./helpers/helpers");
const {
  float40,
  HermezAccount,
  RollupDB
} = require("@hermeznetwork/commonjs");

const commonJsV1 = require("@hermeznetwork/commonjsV1");

describe("Hermez ERC 20 Upgradability", function () {
  let hardhatTokenERC20Mock;
  let hardhatHermez;
  let hardhatWithdrawalDelayer;
  let hardhatHEZ;
  let hardhatVerifierWithdrawHelper;

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

  const fakeProofA = ["0", "0"];
  const fakeProofB = [
    ["0", "0"],
    ["0", "0"],
  ];
  const fakeProofC = ["0", "0"];

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
    hardhatVerifierWithdrawHelper = await VerifierWithdrawHelper.deploy();

    let hardhatHermezAuctionTest = await HermezAuctionTest.deploy();

    // factory hermez
    const Hermez = await ethers.getContractFactory("Hermez");

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
      poseidonAddr2,
      poseidonAddr3,
      poseidonAddr4,
      hermezGovernanceAddress,
      withdrawalDelay,
      hardhatWithdrawalDelayer.address
    );

    const chainSC = await hardhatHermez.getChainId();
    chainID = chainSC.toNumber();
    chainIDHex = chainSC.toHexString();
  });

  describe("Forge Batch", function () {
    it("Upgrade to V2 and check that the upgraded was succesfull", async function () {
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

      // Create 2 accounts

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

      // upgrade contract and assure that the state is the same!
      const HermezV2 = await ethers.getContractFactory("HermezV2Upgraded");
      const newHermezV2 = HermezV2.attach(hardhatHermez.address);
      await expect(newHermezV2.MAX_TOKEN_WITHDRAW()).to.be.reverted;
      await upgrades.upgradeProxy(hardhatHermez.address, HermezV2, {
        unsafeAllowCustomTypes: true
      });
      expect(await newHermezV2.MAX_TOKEN_WITHDRAW()).to.be.equal(4);

      const accountsMigrate = 1000;

      // should be cloned the DB first ?the exit tre will not be updated, so... maybe is not encessary
      const upgradeDBClass = new commonJsV1.upgradeDb(rollupDB, accountsMigrate, nLevels);

      const state = await rollupDB.getStateByIdx(fromIdx);
      const state2 = await rollupDB.getStateByIdx(toIdx);

      const rollupDBUpgraded = await upgradeDBClass.doUpgrade();
      const forgerTestV1 = new ForgeTestV1(
        maxTx,
        maxL1Tx,
        nLevels,
        newHermezV2,
        rollupDBUpgraded
      );

      await expect(
        newHermezV2.updateToV1(
          [hardhatVerifierWithdrawHelper.address, hardhatVerifierWithdrawHelper.address, hardhatVerifierWithdrawHelper.address, hardhatVerifierWithdrawHelper.address],
          hardhatVerifierWithdrawHelper.address,
          hardhatVerifierWithdrawHelper.address,
          [fakeProofA],
          [fakeProofB],
          [fakeProofC],
          accountsMigrate,
          [upgradeDBClass.getOutput(0).newStateRoot]
        )
      ).to.emit(newHermezV2, "hermezV1");

      // forge batch with the upgraded version
      await forgerTestV1.forgeBatch(true, [], []);

      // check the state accounts
      const stateUpgraded = await rollupDBUpgraded.getStateByIdx(fromIdx);
      const stateUpgraded2 = await rollupDBUpgraded.getStateByIdx(toIdx);
        
      for( key in state) {
        expect(state[key]).to.be.equal(stateUpgraded[key]);
        expect(state2[key]).to.be.equal(stateUpgraded2[key]);
      }

    });

    it("Upgrade to V2 and try to do a legacy and current withdraw", async function () {
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float40.round(1000);
      const fromIdx = 256;
      const toIdx = 257;
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
      const numExitRoot = await hardhatHermez.lastForgedBatch();

      // upgrade contract and assure that the state is the same!
      const HermezV2 = await ethers.getContractFactory("HermezV2Upgraded");
      const newHermezV2 = HermezV2.attach(hardhatHermez.address);
      await upgrades.upgradeProxy(hardhatHermez.address, HermezV2, {
        unsafeAllowCustomTypes: true
      });

      const accountsMigrate = 1000;
      const upgradeDBClass = new commonJsV1.upgradeDb(rollupDB, accountsMigrate, nLevels);

      const rollupDBUpgraded = await upgradeDBClass.doUpgrade();
      const forgerTestV1 = new ForgeTestV1(
        maxTx,
        maxL1Tx,
        nLevels,
        newHermezV2,
        rollupDBUpgraded
      );

      await expect(
        newHermezV2.updateToV1(
          [hardhatVerifierWithdrawHelper.address, hardhatVerifierWithdrawHelper.address, hardhatVerifierWithdrawHelper.address, hardhatVerifierWithdrawHelper.address],
          hardhatVerifierWithdrawHelper.address,
          hardhatVerifierWithdrawHelper.address,
          [fakeProofA],
          [fakeProofB],
          [fakeProofC],
          accountsMigrate,
          [upgradeDBClass.getOutput(0).newStateRoot]
        )
      ).to.emit(newHermezV2, "hermezV1");
        
      // perform legacy withdraw
      const instantWithdraw = true;
      const exitInfo = await rollupDBUpgraded.getExitInfo(fromIdx, numExitRoot);
      const initialOwnerBalance = await hardhatTokenERC20Mock.balanceOf(
        await owner.getAddress()
      );

      await expect(
        newHermezV2.withdrawLegacyMerkleProof(
          tokenID,
          amount,
          babyjub,
          numExitRoot,
          exitInfo.siblings,
          fromIdx,
          instantWithdraw
        )
      )
        .to.emit(newHermezV2, "WithdrawEvent")
        .withArgs(fromIdx, numExitRoot, instantWithdraw);

      const finalOwnerBalance = await hardhatTokenERC20Mock.balanceOf(
        await owner.getAddress()
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + amount
      );

      const l1TxUserArray2 = [];
      l1TxUserArray2.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, newHermezV2)
      );

      // forge empty batch
      await forgerTestV1.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTestV1.forgeBatch(true, l1TxUserArray2, []);

      // perform withdraw
      const batchNum = await newHermezV2.lastForgedBatch();
      const amountWithdraw = amount;
      const proofA = ["0", "0"];
      const proofB = [
        ["0", "0"],
        ["0", "0"],
      ];
      const proofC = ["0", "0"];

      await expect(
        newHermezV2.withdrawMultiToken(
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
        .to.emit(newHermezV2, "WithdrawEventNew")
        .withArgs(amountWithdraw, fromIdx, instantWithdraw);

      const finalOwnerBalance2 = await hardhatTokenERC20Mock.balanceOf(
        await owner.getAddress()
      );
      expect(parseInt(finalOwnerBalance2)).to.equal(
        parseInt(finalOwnerBalance) + amount
      );

      expect(amount).to.equal(
        await newHermezV2.exitAccumulateMap(fromIdx)
      );
    });
  });
});

