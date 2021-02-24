const { expect } = require("chai");
const { ethers } = require("../../node_modules/hardhat");
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
  
  // set accounts
  for (let i = 0; i < 10; i++) {
    const newHermezAccount = new HermezAccount();
    const newAccount = {};
    newAccount.hermezAccount = newHermezAccount;
    newAccount.bjjCompressed = `0x${newHermezAccount.bjjCompressed}`;
    newAccount.idx = 256 + i; // first idx --> 256
    accounts.push(newAccount);
  }

  const tokenInitialAmount = 1000000;
  const maxL1Tx = 256;
  const maxTx = 376;
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
      ownerWallet = new ethers.Wallet(ethers.provider._hardhatProvider._genesisAccounts[0].privateKey, ethers.provider);
    }

    const mnemonic = "explain tackle mirror kit van hammer degree position ginger unfair soup bonus";
    let ownerWalletTest = ethers.Wallet.fromMnemonic(mnemonic);
    console.log(ownerWallet.address, ownerWalletTest.address);
    // const privateKeyhardhat =
    //   "0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122";
    // ownerWallet = new ethers.Wallet(
    //   privateKeyhardhat,
    //   ethers.provider
    // );
    //ownerWallet = new ethers.Wallet(ethers.provider._hardhatProvider._genesisAccounts[0].privateKey, ethers.provider);

    // factory helpers
    const TokenERC20Mock = await ethers.getContractFactory("ERC20Mock");
    const TokenERC20PermitMock = await ethers.getContractFactory("ERC20PermitMock");

    const VerifierRollupHelper = await ethers.getContractFactory(
      "Verifier"
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

    hardhatWithdrawalDelayer = await WithdrawalDelayer.deploy();
    await hardhatWithdrawalDelayer.withdrawalDelayerInitializer(
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


  describe("Forge Batch", function () {
    this.timeout(0);
    it("Create l2 Tx and forge them", async function () {
      const tokenIdERC20 = await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );

      const loadAmount = float16.float2Fix(float16.fix2Float(1000));

      const l1TxUserArray = [];
      l1TxUserArray.push(await l1UserTxCreateAccountDeposit(
        loadAmount,
        tokenIdERC20,
        accounts[0].bjjCompressed,
        owner,
        hardhatHermez,
        hardhatTokenERC20Mock
      ));
      l1TxUserArray.push(await l1UserTxCreateAccountDeposit(
        loadAmount,
        tokenIdERC20,
        accounts[1].bjjCompressed,
        owner,
        hardhatHermez,
        hardhatTokenERC20Mock
      ));

      l1TxUserArray.push(await l1UserTxCreateAccountDeposit(
        loadAmount,
        tokenIdERC20,
        accounts[2].bjjCompressed,
        owner,
        hardhatHermez,
        hardhatTokenERC20Mock
      ));

      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        hardhatHermez,
        rollupDB,
        true
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the L1 tx
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      const l1TxCoordiatorArray = [];

      const l2TxUserArray = [];

      const tx = {
        fromIdx: accounts[0].idx,
        toIdx: Constants.exitIdx, //Constants.exitIdx
        tokenID: tokenIdERC20.toNumber(),
        amount: Scalar.e(40),
        nonce: 0,
        chainID: chainID,
        userFee: 0, // 0
      };

      accounts[0].hermezAccount.signTx(tx);
      l2TxUserArray.push(tx);


      l1TxCoordiatorArray.push(
        await l1CoordinatorTxEth(tokenIdERC20, accounts[0].bjjCompressed, owner, hardhatHermez, chainIDHex)
      );

      await forgerTest.forgeBatch(true, [], l1TxCoordiatorArray, l2TxUserArray, true);


      const s1 = await rollupDB.getStateByIdx(256);
      expect(s1.sign).to.be.equal(accounts[0].hermezAccount.sign);
      expect(s1.ay).to.be.equal(accounts[0].hermezAccount.ay);
      //  expect(s1.balance.toString()).to.be.equal(Scalar.e(950).toString()); // 1000(loadAmount) - 40(amount) - 10(fee) = 950
      expect(s1.tokenID).to.be.equal(tokenIdERC20);
      expect(s1.nonce).to.be.equal(1);
    });

  });
});
