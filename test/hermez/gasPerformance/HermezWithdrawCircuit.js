const { expect } = require("chai");
const { ethers } = require("hardhat");
const SMTMemDB = require("circomlib").SMTMemDB;
const { time } = require("@openzeppelin/test-helpers");
const Scalar = require("ffjavascript").Scalar;
const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");

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
  packBucket,
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
  withdrawUtils
} = require("@hermeznetwork/commonjs");

describe("Hermez ERC 20", function () {
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
  const tokenInitialAmount = ethers.BigNumber.from(
    "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
  ); 
  const maxL1Tx = 256;
  const maxTx = 512;
  const nLevels = 32;
  const forgeL1L2BatchTimeout = 10;
  const feeAddToken = 10;
  const withdrawalDelay = 60 * 60 * 24 * 7 * 2; // 2 weeks
  const INITIAL_DELAY = 0;
  let circuitPath = path.join(__dirname, "withdraw.test.circom");
  let circuit;

  beforeEach(async function () {
    this.timeout(0);
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
      "VerifierWithdraw"
    );
    // VerifierWithdraw
    
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


  // You can nest describe calls to create subsections.

  describe("Withdraw circuit", function () {
    this.timeout(0);
    it("test instant withdraw circuit", async function () {
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float40.round(Scalar.fromString("1000000000000000000000"));
      const loadAmountF = float40.fix2Float(loadAmount);
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
        numAccounts,
        null,
        true
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, hardhatHermez)
      );

      const initialOwnerBalance = await hardhatTokenERC20Mock.balanceOf(
        await owner.getAddress()
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], [], [], false, true);
      // forge the create accounts
      await forgerTest.forgeBatch(true, l1TxUserArray, [], [], false, true);

      // circuit stuff
      const numExitRoot = await hardhatHermez.lastForgedBatch();
      const exitInfo = await rollupDB.getExitTreeInfo(256, numExitRoot);
      const exitRoot = await rollupDB.getExitRoot(numExitRoot);

      const input = {};
      const tmpExitInfo = exitInfo;
      const tmpState = tmpExitInfo.state;

      // fill private inputs
      input.rootExit = exitRoot;
      input.ethAddr = Scalar.fromString(tmpState.ethAddr, 16);
      input.tokenID = tmpState.tokenID;
      input.balance = tmpState.balance;
      input.idx = tmpState.idx;
      input.sign = tmpState.sign;
      input.ay = Scalar.fromString(tmpState.ay, 16);

      let siblings = tmpExitInfo.siblings;
      while (siblings.length < (nLevels + 1)) siblings.push(Scalar.e(0));
      input.siblingsState = siblings;

      const prove = await snarkjs.groth16.fullProve(input, path.join(__dirname, "./circuits/withdraw.wasm"), path.join(__dirname, "./circuits/withdraw_hez4_final.zkey" ));
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
      const proofC =  [prove.proof.pi_c[0],
        prove.proof.pi_c[1]
      ];    
      const instantWithdraw = true;

      // console.log("Gas testing");
      // const gasVerifiProver = await hardhatVerifierWithdrawHelper.estimateGas.verifyProof(proofA,
      //   proofB,
      //   proofC,
      //   prove.publicSignals
      // );

      // console.log("directly prover: ", gasVerifiProver.toNumber());
      // const gasVerifiProof = await hardhatHermez.testVerifyWithdraw(proofA,
      //   proofB,
      //   proofC,
      //   prove.publicSignals
      // );
      // console.log("valid proof: ", gasVerifiProof.toNumber());

      // const gasVerifiInvalid = await hardhatHermez.testVerifyWithdraw(["0", "0"],
      //   proofB,
      //   proofC,
      //   prove.publicSignals
      // );
      // console.log("invalid proof: ", gasVerifiProof.toNumber());

      const tx = await hardhatHermez.withdrawCircuit(
        proofA,
        proofB,
        proofC,
        tokenID,
        amount,
        numExitRoot,
        fromIdx,
        instantWithdraw
      );
      console.log("withdraw circuit");
      console.log((await tx.wait()).gasUsed.toNumber());
      const finalOwnerBalance = await hardhatTokenERC20Mock.balanceOf(
        await owner.getAddress()
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + amount
      );
    });
  
    it("test instant withdraw merkle proof with more leafs", async function () {
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
      const numAccounts = 3;
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        owner,
        hardhatHermez,
        hardhatTokenERC20Mock,
        numAccounts,
        null,
        true
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, hardhatHermez)
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(
          tokenID,
          fromIdx + 1,
          amountF,
          owner,
          hardhatHermez
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(
          tokenID,
          fromIdx + 2,
          amountF,
          owner,
          hardhatHermez
        )
      );
      const initialOwnerBalance = await hardhatTokenERC20Mock.balanceOf(
        await owner.getAddress()
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], [], [], false, true);
      // forge the create accounts
      await forgerTest.forgeBatch(true, l1TxUserArray, [], [], false, true);

      // circuit stuff
      // perform withdraw

      const numExitRoot = await hardhatHermez.lastForgedBatch();
      const exitRoot = await rollupDB.getExitRoot(numExitRoot);
      for (let i = 0; i < 3; i ++) {
        const instantWithdraw = true;
        const exitInfo = await rollupDB.getExitTreeInfo(fromIdx + i, numExitRoot);

        const input = {};
        const tmpExitInfo = exitInfo;
        const tmpState = tmpExitInfo.state;

        // fill private inputs
        input.rootExit = exitRoot;
        input.ethAddr = Scalar.fromString(tmpState.ethAddr, 16);
        input.tokenID = tmpState.tokenID;
        input.balance = tmpState.balance;
        input.idx = tmpState.idx;
        input.sign = tmpState.sign;
        input.ay = Scalar.fromString(tmpState.ay, 16);

        let siblings = tmpExitInfo.siblings;
        while (siblings.length < (nLevels + 1)) siblings.push(Scalar.e(0));
        input.siblingsState = siblings;

        const prove = await snarkjs.groth16.fullProve(input, path.join(__dirname, "./circuits/withdraw.wasm"), path.join(__dirname, "./circuits/withdraw_hez4_final.zkey" ));
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
        const proofC =  [prove.proof.pi_c[0],
          prove.proof.pi_c[1]
        ];    

        const tx = await hardhatHermez.withdrawCircuit(
          proofA,
          proofB,
          proofC,
          tokenID,
          amount,
          numExitRoot,
          fromIdx + i,
          instantWithdraw
        );
        console.log("gas used circuit 3 leafs: " + i);
        console.log((await tx.wait()).gasUsed.toNumber());
      }
    });

    it("test delayed withdraw merkle proof with more leafs", async function () {
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
      const numAccounts = 3;
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        owner,
        hardhatHermez,
        hardhatTokenERC20Mock,
        numAccounts,
        null,
        true
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, hardhatHermez)
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(
          tokenID,
          fromIdx + 1,
          amountF,
          owner,
          hardhatHermez
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(
          tokenID,
          fromIdx + 2,
          amountF,
          owner,
          hardhatHermez
        )
      );
      const initialOwnerBalance = await hardhatTokenERC20Mock.balanceOf(
        await owner.getAddress()
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], [], [], false, true);
      // forge the create accounts
      await forgerTest.forgeBatch(true, l1TxUserArray, [], [], false, true);

      // circuit stuff
      // perform withdraw

      const numExitRoot = await hardhatHermez.lastForgedBatch();
      const exitRoot = await rollupDB.getExitRoot(numExitRoot);
      for (let i = 0; i < 3; i ++) {
        const instantWithdraw = false;
        const exitInfo = await rollupDB.getExitTreeInfo(fromIdx + i, numExitRoot);

        const input = {};
        const tmpExitInfo = exitInfo;
        const tmpState = tmpExitInfo.state;

        // fill private inputs
        input.rootExit = exitRoot;
        input.ethAddr = Scalar.fromString(tmpState.ethAddr, 16);
        input.tokenID = tmpState.tokenID;
        input.balance = tmpState.balance;
        input.idx = tmpState.idx;
        input.sign = tmpState.sign;
        input.ay = Scalar.fromString(tmpState.ay, 16);

        let siblings = tmpExitInfo.siblings;
        while (siblings.length < (nLevels + 1)) siblings.push(Scalar.e(0));
        input.siblingsState = siblings;

        const prove = await snarkjs.groth16.fullProve(input, path.join(__dirname, "./circuits/withdraw.wasm"), path.join(__dirname, "./circuits/withdraw_hez4_final.zkey" ));
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
        const proofC =  [prove.proof.pi_c[0],
          prove.proof.pi_c[1]
        ];    

        const tx = await hardhatHermez.withdrawCircuit(
          proofA,
          proofB,
          proofC,
          tokenID,
          amount,
          numExitRoot,
          fromIdx + i,
          instantWithdraw
        );
        console.log("gas used circuit 3 leafs: " + i);
        console.log((await tx.wait()).gasUsed.toNumber());
      }
    });
  });
});
