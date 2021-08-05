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
} = require("@hermeznetwork/commonjsV1");
const INITIAL_DELAY = 0;

const gasLimit = 12500000;

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
  const tokenInitialAmount = 1000000;
  const maxL1Tx = 256;
  const maxTx = 2000;
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
      [hardhatVerifierWithdrawHelper.address, hardhatVerifierWithdrawHelper.address, hardhatVerifierWithdrawHelper.address, hardhatVerifierWithdrawHelper.address],
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
    chainIDHex = chainSC.toHexString();
  });

  describe("Test Queue", function () {
    it("Gas report l1 operator tx", async function () {
      this.timeout(0);
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const l1TxCoordiatorArray = [];

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
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
      const compressedL1CoordinatorTx = "0x00";

      const L2TxsData = "0x00";

      const feeIdxCoordinator = `0x${utils.padZeros(
        "",
        ((nLevels * 64) / 8) * 2
      )}`;
      const verifierIdx = 0;
      const SCGasArray = [];
      const wastedGasarray = [];

      let tx = await hardhatHermez.forgeGasTest(
        newLastIdx,
        newStateRoot,
        compressedL1CoordinatorTx,
        L2TxsData,
        feeIdxCoordinator,
        verifierIdx,
        true,
        proofA,
        proofB,
        proofC,
        { gasLimit: gasLimit }
      );

      console.log(
        "|   Wasted SC   | IncrementPrev | wastedGas | IncrementPrev | l1Coordinator-Tx |"
      );
      console.log(
        "| -------- | --------- | --------- | --------- | ---------- |"
      );

      const l1CoordinatorTx = await l1CoordinatorTxEth(tokenID, babyjub, owner, hardhatHermez, chainIDHex);
      const multiplier = 12;
      for (let i = 0; i < 22; i++) {
        stringL1CoordinatorTx = "";
        for (let j = 0; j < i * multiplier; j++) {
          stringL1CoordinatorTx =
            stringL1CoordinatorTx + l1CoordinatorTx.l1TxCoordinatorbytes.slice(2); // retireve the 0x
        }
        let tx = await hardhatHermez.forgeGasTest(
          newLastIdx,
          newStateRoot,
          `0x${stringL1CoordinatorTx}`,
          L2TxsData,
          feeIdxCoordinator,
          verifierIdx,
          true,
          proofA,
          proofB,
          proofC,
          { gasLimit: gasLimit }
        );
        const receipt = await tx.wait();
        SCGasArray.push(gasLimit - receipt.events[1].args[0].toNumber());
        wastedGasarray.push(receipt.gasUsed.toNumber());

        // hackmd table
        let log = `|  ${SCGasArray[i]}    |`;
        log += ` ${SCGasArray[i] - (SCGasArray[i - 1] ? SCGasArray[i - 1] : SCGasArray[i])
        }   |`;
        log += ` ${wastedGasarray[i]}   |`;
        log += ` ${wastedGasarray[i] -
          (wastedGasarray[i - 1] ? wastedGasarray[i - 1] : wastedGasarray[i])
        }   |`;
        log += ` ${i * multiplier}   |`;
        console.log(log);
      }
    });

    it("Gas report l1 user creataccount tx", async function () {
      this.timeout(0);
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float40.round(1);

      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
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
        "|   Wasted gas SC  | IncrementPrev | wastedGas | IncrementPrev | L1user-tx-createAccount |"
      );
      console.log(
        "| -------- | --------- | --------- | --------- | ---------- |"
      );

      const multiplier = 12;

      for (let i = 0; i < 11; i++) {
        for (let j = 0; j < i * multiplier; j++) {
          let txUser = await l1UserTxCreateAccountDeposit(
            loadAmount,
            tokenID,
            babyjub,
            ownerWallet,
            hardhatHermez,
            hardhatTokenERC20Mock
          );
        }

        await hardhatHermez.forgeBatch(
          newLastIdx,
          newStateRoot,
          compressedL1CoordinatorTx,
          L2TxsData,
          feeIdxCoordinator,
          verifierIdx,
          true,
          proofA,
          proofB,
          proofC,
          { gasLimit: gasLimit }
        );

        // forge with events
        let tx = await hardhatHermez.forgeGasTest(
          newLastIdx,
          newStateRoot,
          compressedL1CoordinatorTx,
          L2TxsData,
          feeIdxCoordinator,
          verifierIdx,
          true,
          proofA,
          proofB,
          proofC,
          { gasLimit: gasLimit }
        );
        const receipt = await tx.wait();
        SCGasArray.push(gasLimit - receipt.events[1].args[0].toNumber());
        wastedGasarray.push(receipt.gasUsed.toNumber());

        // hackmd table
        let log = `|  ${SCGasArray[i]}    |`;
        log += ` ${SCGasArray[i] - (SCGasArray[i - 1] ? SCGasArray[i - 1] : SCGasArray[i])
        }   |`;
        log += ` ${wastedGasarray[i]}   |`;
        log += ` ${wastedGasarray[i] -
          (wastedGasarray[i - 1] ? wastedGasarray[i - 1] : wastedGasarray[i])
        }   |`;
        log += ` ${i * multiplier}   |`;
        console.log(log);
      }
    });

    it("Gas report l2 tx", async function () {
      this.timeout(0);
      const proofA = ["0", "0"];
      const proofB = [
        ["0", "0"],
        ["0", "0"],
      ];
      const proofC = ["0", "0"];

      const newLastIdx = 257;
      const newStateRoot = 123;
      const compressedL1CoordinatorTx = "0x00";
      let L2TxsData;
      const feeIdxCoordinator = `0x${"1".repeat(
        ((nLevels * 64) / 8) * 2
      )}`;
      const verifierIdx = 0;
      const SCGasArray = [];
      const wastedGasarray = [];

      const multiplier = 37;
      console.log(
        "|   Wasted gas SC  | IncrementPrev | wastedGas | IncrementPrev | L2 |"
      );
      console.log(
        "| -------- | --------- | --------- | --------- | ---------- |"
      );

      for (let i = 0; i < 54; i++) {
        L2TxsData = `0x${"1".repeat(((nLevels / 8) * 2 + 6) * i * multiplier * 2)}`; // maxL2Tx 376
        await hardhatHermez.forgeBatch(
          newLastIdx,
          newStateRoot,
          compressedL1CoordinatorTx,
          L2TxsData,
          feeIdxCoordinator,
          verifierIdx,
          true,
          proofA,
          proofB,
          proofC,
          { gasLimit: gasLimit }
        );

        // forge with events
        let tx = await hardhatHermez.forgeGasTest(
          newLastIdx,
          newStateRoot,
          compressedL1CoordinatorTx,
          L2TxsData,
          feeIdxCoordinator,
          verifierIdx,
          true,
          proofA,
          proofB,
          proofC,
          { gasLimit: gasLimit }
        );
        const receipt = await tx.wait();
        SCGasArray.push(gasLimit - receipt.events[1].args[0].toNumber());
        wastedGasarray.push(receipt.gasUsed.toNumber());

        // hackmd table
        let log = `|  ${SCGasArray[i]}    |`;
        log += ` ${SCGasArray[i] - (SCGasArray[i - 1] ? SCGasArray[i - 1] : SCGasArray[i])
        }   |`;
        log += ` ${wastedGasarray[i]}   |`;
        log += ` ${wastedGasarray[i] -
          (wastedGasarray[i - 1] ? wastedGasarray[i - 1] : wastedGasarray[i])
        }   |`;
        log += ` ${i * multiplier}   |`;
        console.log(log);
      }
    });
  });
});
