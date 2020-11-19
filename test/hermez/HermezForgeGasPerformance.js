const {expect} = require("chai");
const {ethers} = require("../../node_modules/@nomiclabs/buidler");
const SMTMemDB = require("circomlib").SMTMemDB;
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const {
  signBjjAuth,
  l1UserTxCreateAccountDeposit,
  l1UserTxDeposit,
  l1UserTxDepositTransfer,
  l1UserTxCreateAccountDepositTransfer,
  l1UserTxForceTransfer,
  l1UserTxForceExit,
  l1CoordinatorTxBjj,
  AddToken,
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
const INITIAL_DELAY = 0;

describe("Hermez gas performance", function () {
  let buidlerTokenERC20Mock;
  let buidlerHermez;
  let buidlerWithdrawalDelayer;
  let buidlerHEZ;
  let owner;
  let id1;
  let id2;
  let addrs;
  let hermezGovernanceDAOAddress;
  let ownerWallet;

  const accounts = [];
  for (let i = 0; i < 10; i++) {
    accounts.push(new HermezAccount());
  }
  const tokenInitialAmount = 1000000;
  const maxL1Tx = 256;
  const maxTx = 512;
  const nLevels = 48;
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
    
    const chainIdProvider = (await ethers.provider.getNetwork()).chainId;
    if (chainIdProvider == 1337){ // solcover, must be a jsonRPC wallet
      const mnemonic = "explain tackle mirror kit van hammer degree position ginger unfair soup bonus";
      let ownerWalletTest = ethers.Wallet.fromMnemonic(mnemonic); 
      // ownerWalletTest = ownerWallet.connect(ethers.provider);
      ownerWallet = owner;
      ownerWallet.privateKey = ownerWalletTest.privateKey;
    } 
    else {
      ownerWallet = new ethers.Wallet(ethers.provider._buidlerProvider._genesisAccounts[0].privateKey, ethers.provider);
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



    // factory hermez
    const Hermez = await ethers.getContractFactory("HermezTest");

    // deploy tokens
    buidlerTokenERC20Mock = await TokenERC20Mock.deploy(
      "tokenname",
      "TKN",
      await owner.getAddress(),
      tokenInitialAmount
    );

    buidlerHEZ = await TokenERC20PermitMock.deploy(
      "tokenname",
      "TKN",
      await owner.getAddress(),
      tokenInitialAmount
    );

    let buidlerVerifierRollupHelper = await VerifierRollupHelper.deploy();
    let buidlerVerifierWithdrawHelper = await VerifierWithdrawHelper.deploy();
    let buidlerHermezAuctionTest = await HermezAuctionTest.deploy();

    // deploy hermez
    buidlerHermez = await Hermez.deploy();
    await buidlerHermez.deployed();
    buidlerWithdrawalDelayer = await WithdrawalDelayer.deploy();
    await buidlerWithdrawalDelayer.withdrawalDelayerInitializer(
      INITIAL_DELAY,
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

  describe("Test Queue", function () {
    it("Gas report l1 operator tx", async function () {
      this.timeout(0);
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const l1TxCoordiatorArray = [];

      await AddToken(
        buidlerHermez,
        buidlerTokenERC20Mock,
        buidlerHEZ,
        ownerWallet,
        feeAddToken
      );
      const proofA = ["0", "0"];
      const proofB = [
        ["0", "0"],
        ["0", "0"],
      ];
      const proofC = ["0", "0"];

      const newLastIdx = 257;
      const newStateRoot = 123;
      const newExitRoot = 456;
      const compressedL1CoordinatorTx = "0x00";

      const L2TxsData = `0x${"1".repeat(((nLevels / 8) * 2 + 3) * maxTx * 2)}`;
      // const L2TxsData = `0x${utils.padZeros(
      //   "",
      //   ((nLevels / 8) * 2 + 3) * maxTx * 2
      // )}`;
      //const L2TxsData = "0x00";

      const feeIdxCoordinator = `0x${utils.padZeros(
        "",
        ((nLevels * 64) / 8) * 2
      )}`;
      const verifierIdx = 0;
      const SCGasArray = [];
      const wastedGasarray = [];

      let tx = await buidlerHermez.forgeGasTest(
        newLastIdx,
        newStateRoot,
        newExitRoot,
        compressedL1CoordinatorTx,
        L2TxsData,
        feeIdxCoordinator,
        verifierIdx,
        true,
        proofA,
        proofB,
        proofC,
        {gasLimit: 12500000}
      );

      console.log(
        "|   SC gas left    | Decrement | wastedGas | Increment | operatorTx |"
      );
      console.log(
        "| -------- | --------- | --------- | --------- | ---------- |"
      );

      for (let i = 0; i < 124; i++) {
        if (i != 0) {
          await l1TxCoordiatorArray.push(
            await l1CoordinatorTxBjj(tokenID, babyjub, buidlerHermez)
          );
        }

        stringL1CoordinatorTx = "";
        for (let tx of l1TxCoordiatorArray) {
          stringL1CoordinatorTx =
            stringL1CoordinatorTx + tx.l1TxCoordinatorbytes.slice(2); // retireve the 0x
        }
        let tx = await buidlerHermez.forgeGasTest(
          newLastIdx,
          newStateRoot,
          newExitRoot,
          `0x${stringL1CoordinatorTx}`,
          L2TxsData,
          feeIdxCoordinator,
          verifierIdx,
          true,
          proofA,
          proofB,
          proofC,
          {gasLimit: 12500000}
        );
        const receipt = await tx.wait();
        SCGasArray.push(receipt.events[1].args[0].toNumber());
        wastedGasarray.push(receipt.gasUsed.toNumber());

        // hackmd table
        let log = `|  ${SCGasArray[i]}    |`;
        log += ` ${
          (SCGasArray[i - 1] ? SCGasArray[i - 1] : SCGasArray[i]) -
          SCGasArray[i]
        }   |`;
        log += ` ${wastedGasarray[i]}   |`;
        log += ` ${
          wastedGasarray[i] -
          (wastedGasarray[i - 1] ? wastedGasarray[i - 1] : wastedGasarray[i])
        }   |`;
        log += ` ${i}   |`;
        console.log(log);
      }
    });

    it("Gas report l1 user creataccount tx", async function () {
      this.timeout(0);
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float16.float2Fix(float16.fix2Float(1));

      await AddToken(
        buidlerHermez,
        buidlerTokenERC20Mock,
        buidlerHEZ,
        ownerWallet,
        feeAddToken
      );
      const proofA = ["0", "0"];
      const proofB = [
        ["0", "0"],
        ["0", "0"],
      ];
      const proofC = ["0", "0"];

      const newLastIdx = 257;
      const newStateRoot = 123;
      const newExitRoot = 456;
      const compressedL1CoordinatorTx = "0x00";
      const L2TxsData = "0x00";
      const feeIdxCoordinator = `0x${utils.padZeros(
        "",
        ((nLevels * 64) / 8) * 2
      )}`;
      const verifierIdx = 0;
      const SCGasArray = [];
      const wastedGasarray = [];

      console.log(
        "|   SC gas left    | Decrement | wastedGas | Increment | user-tx-createAccount |"
      );
      console.log(
        "| -------- | --------- | --------- | --------- | ---------- |"
      );

      for (let i = 0; i < 124; i++) {
        for (let j = 0; j < i; j++) {
          let txUser = await l1UserTxCreateAccountDeposit(
            loadAmount,
            tokenID,
            babyjub,
            ownerWallet,
            buidlerHermez,
            buidlerTokenERC20Mock
          );
        }

        await buidlerHermez.forgeBatch(
          newLastIdx,
          newStateRoot,
          newExitRoot,
          compressedL1CoordinatorTx,
          L2TxsData,
          feeIdxCoordinator,
          verifierIdx,
          true,
          proofA,
          proofB,
          proofC,
          {gasLimit: 12500000}
        );

        // forge with events
        let tx = await buidlerHermez.forgeGasTest(
          newLastIdx,
          newStateRoot,
          newExitRoot,
          compressedL1CoordinatorTx,
          L2TxsData,
          feeIdxCoordinator,
          verifierIdx,
          true,
          proofA,
          proofB,
          proofC,
          {gasLimit: 12500000}
        );
        const receipt = await tx.wait();
        SCGasArray.push(receipt.events[1].args[0].toNumber());
        wastedGasarray.push(receipt.gasUsed.toNumber());

        // hackmd table
        let log = `|  ${SCGasArray[i]}    |`;
        log += ` ${
          (SCGasArray[i - 1] ? SCGasArray[i - 1] : SCGasArray[i]) -
          SCGasArray[i]
        }   |`;
        log += ` ${wastedGasarray[i]}   |`;
        log += ` ${
          wastedGasarray[i] -
          (wastedGasarray[i - 1] ? wastedGasarray[i - 1] : wastedGasarray[i])
        }   |`;
        log += ` ${i}   |`;
        console.log(log);
      }
    });
  });
});
