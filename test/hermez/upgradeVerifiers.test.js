const { expect } = require("chai");
const { ethers, network } = require("hardhat");
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
      ["0xE388aFB8b6590C81C96Afdc9D1d8470945dFceB4",
        "0x0deB62ded592F18Faacf3C58BD5431C1fD1414bb"],
      calculateInputMaxTxLevels([344, 1912], [32, 32]),
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
  });

  describe("test tokens contract", function () {
    it("Call update verifiers", async function () {
      expect( await hardhatHermez.withdrawVerifier()).to.be.equal(hardhatVerifierWithdrawHelper.address);

      const verifier0Before = await hardhatHermez.rollupVerifiers(0);
      expect(verifier0Before.verifierInterface).to.be.equal("0xE388aFB8b6590C81C96Afdc9D1d8470945dFceB4");
      expect(verifier0Before.maxTx).to.be.equal(344);
      expect(verifier0Before.nLevels).to.be.equal(32);

      const verifier1Before = await hardhatHermez.rollupVerifiers(1);
      expect(verifier1Before.verifierInterface).to.be.equal("0x0deB62ded592F18Faacf3C58BD5431C1fD1414bb");
      expect(verifier1Before.maxTx).to.be.equal(1912);
      expect(verifier1Before.nLevels).to.be.equal(32);
    
 
      // load deployer account
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0xb6D3f1056c015962fA66A4020E50522B58292D1E"],
      });
      const signerDeployer = await ethers.provider.getSigner(
        "0xb6D3f1056c015962fA66A4020E50522B58292D1E"
      );
      await owner.sendTransaction({
        to: "0xb6D3f1056c015962fA66A4020E50522B58292D1E",
        value: ethers.utils.parseEther("1.0")
      });

      // updateVerifiers
      await expect(hardhatHermez.updateVerifiers()).to.be.revertedWith("Hermez::updateVerifiers ONLY_DEPLOYER");
      await hardhatHermez.connect(signerDeployer).updateVerifiers();

      expect( await hardhatHermez.withdrawVerifier()).to.be.equal("0x4464A1E499cf5443541da6728871af1D5C4920ca");
      const verifier0 = await hardhatHermez.rollupVerifiers(0);
      expect(verifier0.verifierInterface).to.be.equal("0x3DAa0B2a994b1BC60dB9e312aD0a8d87a1Bb16D2");
      expect(verifier0.maxTx).to.be.equal(400);
      expect(verifier0.nLevels).to.be.equal(32);

      const verifier1 = await hardhatHermez.rollupVerifiers(1);
      expect(verifier1.verifierInterface).to.be.equal("0x1DC4b451DFcD0e848881eDE8c7A99978F00b1342");
      expect(verifier1.maxTx).to.be.equal(2048);
      expect(verifier1.nLevels).to.be.equal(32);

      await expect(hardhatHermez.updateVerifiers()).to.be.revertedWith("Hermez::updateVerifiers ONLY_DEPLOYER");
      await expect(hardhatHermez.connect(signerDeployer).updateVerifiers()).to.be.revertedWith("Hermez::updateVerifiers VERIFIERS_ALREADY_UPDATED");
    });
  });
});
