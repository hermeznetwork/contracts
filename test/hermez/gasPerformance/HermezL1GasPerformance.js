const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const SMTMemDB = require("circomlib").SMTMemDB;
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const {
  l1UserTxCreateAccountDeposit,
  l1UserTxDeposit,
  l1UserTxDepositTransfer,
  l1UserTxCreateAccountDepositTransfer,
  l1UserTxForceTransfer,
  l1UserTxForceExit,
  l1CoordinatorTxBjj,
  l1CoordinatorTxEth,
  AddToken,
  createAccounts,
  ForgerTest,
  calculateInputMaxTxLevels,
  packBucket,
  unpackBucket
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
} = require("@hermeznetwork/commonjs");
const Scalar = require("ffjavascript").Scalar;
const INITIAL_DELAY = 0;

describe("Hermez gas performance", function () {
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
  const tokenInitialAmount = ethers.BigNumber.from(
    "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
  );
  const maxL1Tx = 256;
  const maxTx = 376;
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
      "WithdrawalDelayer"
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
    const Hermez = await ethers.getContractFactory("Hermez");

    // deploy tokens
    hardhatTokenERC20Mock = await TokenERC20PermitMock.deploy(
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

    // wait until is deployed
    await hardhatTokenERC20Mock.deployed();
    // const chainSC = await hardhatHermez.getChainID();
    // chainID = chainSC.toNumber();
    // chainIDHex = chainSC.toHexString();


    // setup buckets
    const buckets = [];
    for (let i = 0; i < 5; i++) {
      const ceilUSD = (i + 1) * 10000000;
      const blockStamp = 0; // does not matter!
      const withdrawals = 4000000000;
      const rateBlocks = i + 1;
      const rateWithdrawals = i + 1;
      const maxWithdrawals = 4000000000; // max value 4294967296;
      buckets.push({
        ceilUSD,
        blockStamp,
        withdrawals,
        rateBlocks,
        rateWithdrawals,
        maxWithdrawals
      });
    }

    const bucketsPacked = buckets.map((bucket) => packBucket(bucket));
    await expect(
      hardhatHermez.connect(governance).updateBucketsParameters(bucketsPacked)
    ).to.emit(hardhatHermez, "UpdateBucketsParameters");

    const _EXCHANGE_MULTIPLIER = 1e10;
    const tokenAddress = hardhatTokenERC20Mock.address;
    const ethereumAddress = "0x0000000000000000000000000000000000000000";
    const tokenPriceERC20 = 10 * _EXCHANGE_MULTIPLIER; //USD
    const ethereumPrice = 1800 * _EXCHANGE_MULTIPLIER; //USD

    const addressArray = [tokenAddress, ethereumAddress];
    const valueArray = [tokenPriceERC20, ethereumPrice];

    await expect(hardhatHermez
      .connect(governance)
      .updateTokenExchange(addressArray, valueArray))
      .to.emit(hardhatHermez, "UpdateTokenExchange")
      .withArgs(addressArray, valueArray);

  });

  describe("Test gas", function () {
    
    it("Gas report l1 usert tx forceExit", async function () {
      this.timeout(0);
      const tokenID = 1;
      const loadAmount = float40.round(Scalar.fromString("1000000000000000000000"));
      const loadAmountF = float40.fix2Float(loadAmount);
      const babyjub = `0x${accounts[0].bjjCompressed}`;

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );

      const numAccounts = 10;
      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        hardhatHermez,
        rollupDB
      );

      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        ownerWallet,
        hardhatHermez,
        hardhatTokenERC20Mock,
        numAccounts,
        null,
        true
      );

      await hardhatTokenERC20Mock.connect(ownerWallet).approve(hardhatHermez.address, tokenInitialAmount);

      const babyjub0 = 0;
      const fromIdx0 = 0;
      const loadAmountF0 = 0;
      const amountF0 = 0;
      const tokenID0 = 0;
      const toIdx0 = 0;
      const emptyPermit = "0x";

      console.log("#forceexit");
      console.log(
        "|   queue Position    | GasCost |"
      );
      console.log(
        "| -------- | --------- |"
      );
      for (let j = 0; j < 130; j++) {

        //forceexit
        let txUser = await hardhatHermez.addL1Transaction(
          babyjub0,
          256,
          loadAmountF0,
          148538953472,
          tokenID0,
          1,
          emptyPermit,
        );
        console.log(`|  ${j}    | ${((await txUser.wait()).gasUsed).toNumber()} | `);
      }
    });
    it("Gas report l1 usert tx CreateaccountDeposit ether", async function () {
      this.timeout(0);
      const tokenID = 1;
      const loadAmount = float40.round(Scalar.fromString("1000000000000000000"));
      const loadAmountF = float40.fix2Float(loadAmount);
      const babyjub = `0x${accounts[0].bjjCompressed}`;

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );

      const numAccounts = 0;
      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        hardhatHermez,
        rollupDB
      );

      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        ownerWallet,
        hardhatHermez,
        hardhatTokenERC20Mock,
        numAccounts,
        null,
        true
      );

      await hardhatTokenERC20Mock.connect(ownerWallet).approve(hardhatHermez.address, tokenInitialAmount);

      const babyjub0 = 0;
      const fromIdx0 = 0;
      const loadAmountF0 = 0;
      const amountF0 = 0;
      const tokenID0 = 0;
      const toIdx0 = 0;
      const emptyPermit = "0x";

      console.log("#createaccoiuntdeposit ether");
      console.log(
        "|   queue Position    | GasCost |"
      );
      console.log(
        "| -------- | --------- |"
      );
      for (let j = 0; j < 130; j++) {

        //createaccoiuntdepositether
        let txUser = await hardhatHermez.addL1Transaction(
          babyjub,
          0,
          loadAmountF,
          0,
          0,
          0,
          "0x", {
            value: loadAmount
          }
        );
        console.log(`|  ${j}    | ${((await txUser.wait()).gasUsed).toNumber()} | `);
      }
    });
    it("Gas report l1 usert tx CreateaccountDeposit token", async function () {
      this.timeout(0);
      const tokenID = 1;
      const loadAmount = float40.round(Scalar.fromString("1000000000000000000000"));
      const loadAmountF = float40.fix2Float(loadAmount);
      const babyjub = `0x${accounts[0].bjjCompressed}`;

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );

      const numAccounts = 0;
      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        hardhatHermez,
        rollupDB
      );

      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        ownerWallet,
        hardhatHermez,
        hardhatTokenERC20Mock,
        numAccounts,
        null,
        true
      );

      await hardhatTokenERC20Mock.connect(ownerWallet).approve(hardhatHermez.address, tokenInitialAmount);

      const babyjub0 = 0;
      const fromIdx0 = 0;
      const loadAmountF0 = 0;
      const amountF0 = 0;
      const tokenID0 = 0;
      const toIdx0 = 0;
      const emptyPermit = "0x";

      console.log("#createaccoiuntdeposit token");
      console.log(
        "|   queue Position    | GasCost |"
      );
      console.log(
        "| -------- | --------- |"
      );
      for (let j = 0; j < 130; j++) {
        //createaccoiuntdeposit token
        let txUser = await hardhatHermez.addL1Transaction(
          babyjub,
          0,
          loadAmountF,
          0,
          1,
          0,
          "0x"
        );
        console.log(`|  ${j}    | ${((await txUser.wait()).gasUsed).toNumber()} | `);
      }
    });


    it("Gas report withdraw Gas report different leafs token", async function () {
      this.timeout(0);
      const tokenID = 1;
      const loadAmount = float40.round(Scalar.fromString("1000000000000000000000"));
      const loadAmountF = float40.fix2Float(loadAmount);
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const amount = Scalar.fromString("10000000000000000000");
      const amountF = float40.fix2Float(amount);

      const firstIdx = 256;

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );
      const numAccounts = 10;
      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        hardhatHermez,
        rollupDB
      );

      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        ownerWallet,
        hardhatHermez,
        hardhatTokenERC20Mock,
        numAccounts,
        null,
        true
      );
      await hardhatTokenERC20Mock.connect(ownerWallet).approve(hardhatHermez.address, tokenInitialAmount);
      for (let i = 1; i < 10; i++) {
        const l1TxUserArray = [];

        for (let j = 0; j < i; j++) {
          l1TxUserArray.push(
            await l1UserTxForceExit(tokenID, firstIdx+j, amountF, owner, hardhatHermez)
          );
        }

        // forge empty batch
        await forgerTest.forgeBatch(true, [], [], [], false, true);
        // forge the create accounts
        await forgerTest.forgeBatch(true, l1TxUserArray, [], [], false, true);


        console.log("# Instant Withdraw token");
        console.log(
          "|   queue Position    | GasCost |"
        );
        console.log(
          "| -------- | --------- |"
        );

        const numExitRoot = await hardhatHermez.lastForgedBatch();
        const instantWithdraw = true;

        for (let j = 0; j < i; j++) {
          const exitInfo = await rollupDB.getExitTreeInfo(firstIdx+j, numExitRoot);
    
          //createaccoiuntdeposit token
          const txUser = await hardhatHermez.withdrawMerkleProof(
            tokenID,
            amount,
            babyjub,
            numExitRoot,
            exitInfo.siblings,
            firstIdx+j,
            instantWithdraw
          );
          console.log(`|  ${j}    | ${((await txUser.wait()).gasUsed).toNumber()} | `);
        }
      }
    });
    it("Gas report withdraw Gas report different leafs eth", async function () {
      this.timeout(0);
      const tokenID = 0;
      const loadAmount = float40.round(Scalar.fromString("1000000000000000000"));
      const loadAmountF = float40.fix2Float(loadAmount);
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const amount = Scalar.fromString("10000000000000000");
      const amountF = float40.fix2Float(amount);

      const firstIdx = 256;

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );
      const numAccounts = 10;
      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        hardhatHermez,
        rollupDB
      );

      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        ownerWallet,
        hardhatHermez,
        hardhatTokenERC20Mock,
        numAccounts,
        null,
        true
      );
      await hardhatTokenERC20Mock.connect(ownerWallet).approve(hardhatHermez.address, tokenInitialAmount);
      for (let i = 1; i < 10; i++) {
        const l1TxUserArray = [];

        for (let j = 0; j < i; j++) {
          l1TxUserArray.push(
            await l1UserTxForceExit(tokenID, firstIdx+j, amountF, owner, hardhatHermez)
          );
        }

        // forge empty batch
        await forgerTest.forgeBatch(true, [], [], [], false, true);
        // forge the create accounts
        await forgerTest.forgeBatch(true, l1TxUserArray, [], [], false, true);


        console.log("# Instant Withdraw eth");
        console.log(
          "|   queue Position    | GasCost |"
        );
        console.log(
          "| -------- | --------- |"
        );

        const numExitRoot = await hardhatHermez.lastForgedBatch();
        const instantWithdraw = true;

        for (let j = 0; j < i; j++) {
          const exitInfo = await rollupDB.getExitTreeInfo(firstIdx+j, numExitRoot);
    
          //createaccoiuntdeposit token
          const txUser = await hardhatHermez.withdrawMerkleProof(
            tokenID,
            amount,
            babyjub,
            numExitRoot,
            exitInfo.siblings,
            firstIdx+j,
            instantWithdraw
          );
          console.log(`|  ${j}    | ${((await txUser.wait()).gasUsed).toNumber()} | `);
        }
      }
    });
    it("Gas report withdraw Gas report different leafs eth delayed", async function () {
      this.timeout(0);
      const tokenID = 0;
      const loadAmount = float40.round(Scalar.fromString("1000000000000000000"));
      const loadAmountF = float40.fix2Float(loadAmount);
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const amount = Scalar.fromString("100000000000000000");
      const amountF = float40.fix2Float(amount);

      const firstIdx = 256;

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );
      const numAccounts = 10;
      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        hardhatHermez,
        rollupDB
      );

      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        ownerWallet,
        hardhatHermez,
        hardhatTokenERC20Mock,
        numAccounts,
        null,
        true
      );
      await hardhatTokenERC20Mock.connect(ownerWallet).approve(hardhatHermez.address, tokenInitialAmount);
      for (let i = 1; i < 10; i++) {
        const l1TxUserArray = [];

        for (let j = 0; j < i; j++) {
          l1TxUserArray.push(
            await l1UserTxForceExit(tokenID, firstIdx+j, amountF, owner, hardhatHermez)
          );
        }

        // forge empty batch
        await forgerTest.forgeBatch(true, [], [], [], false, true);
        // forge the create accounts
        await forgerTest.forgeBatch(true, l1TxUserArray, [], [], false, true);


        console.log("# Delayed Withdraw eth");
        console.log(
          "|   queue Position    | GasCost |"
        );
        console.log(
          "| -------- | --------- |"
        );

        const numExitRoot = await hardhatHermez.lastForgedBatch();
        const instantWithdraw = false;

        for (let j = 0; j < i; j++) {
          const exitInfo = await rollupDB.getExitTreeInfo(firstIdx+j, numExitRoot);
    
          //createaccoiuntdeposit token
          const txUser = await hardhatHermez.withdrawMerkleProof(
            tokenID,
            amount,
            babyjub,
            numExitRoot,
            exitInfo.siblings,
            firstIdx+j,
            instantWithdraw
          );
          console.log(`|  ${j}    | ${((await txUser.wait()).gasUsed).toNumber()} | `);
        }
      }
    });

    it("Gas report withdraw Gas report different leafs token delayed", async function () {
      this.timeout(0);
      const tokenID = 1;
      const loadAmount = float40.round(Scalar.fromString("1000000000000000000000"));
      const loadAmountF = float40.fix2Float(loadAmount);
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const amount = Scalar.fromString("10000000000000000000");
      const amountF = float40.fix2Float(amount);

      const firstIdx = 256;

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );
      const numAccounts = 10;
      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        hardhatHermez,
        rollupDB
      );

      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        ownerWallet,
        hardhatHermez,
        hardhatTokenERC20Mock,
        numAccounts,
        null,
        true
      );
      await hardhatTokenERC20Mock.connect(ownerWallet).approve(hardhatHermez.address, tokenInitialAmount);
      for (let i = 1; i < 10; i++) {
        const l1TxUserArray = [];

        for (let j = 0; j < i; j++) {
          l1TxUserArray.push(
            await l1UserTxForceExit(tokenID, firstIdx+j, amountF, owner, hardhatHermez)
          );
        }

        // forge empty batch
        await forgerTest.forgeBatch(true, [], [], [], false, true);
        // forge the create accounts
        await forgerTest.forgeBatch(true, l1TxUserArray, [], [], false, true);


        console.log("# Delayed Withdraw token");
        console.log(
          "|   queue Position    | GasCost |"
        );
        console.log(
          "| -------- | --------- |"
        );

        const numExitRoot = await hardhatHermez.lastForgedBatch();
        const instantWithdraw = false;

        for (let j = 0; j < i; j++) {
          const exitInfo = await rollupDB.getExitTreeInfo(firstIdx+j, numExitRoot);
    
          //createaccoiuntdeposit token
          const txUser = await hardhatHermez.withdrawMerkleProof(
            tokenID,
            amount,
            babyjub,
            numExitRoot,
            exitInfo.siblings,
            firstIdx+j,
            instantWithdraw
          );
          console.log(`|  ${j}    | ${((await txUser.wait()).gasUsed).toNumber()} | `);
        }
      }
    });
  });
});
