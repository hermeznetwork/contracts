const { expect } = require("chai");
const { ethers } = require("../../node_modules/@nomiclabs/buidler");
const SMTMemDB = require("circomlib").SMTMemDB;
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const { time } = require("@openzeppelin/test-helpers");

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
  calculateInputMaxTxLevels,
  createPermitSignature
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

const COORDINATOR_1_URL = "https://hermez.io";
const BLOCKS_PER_SLOT = 40;
const bootCoordinatorURL = "https://boot.coordinator.io";

const MIN_BLOCKS = 81;
let ABIbid = [
  "function permit(address,address,uint256,uint256,uint8,bytes32,bytes32)",
];

let iface = new ethers.utils.Interface(ABIbid);
const INITIAL_DELAY = 0;


describe("Hermez integration", function () {
  let buidlerTokenHermez;
  let buidlerHermez;
  let buidlerWithdrawalDelayer;
  let buidlerHermezAuctionProtocol;

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
  const tokenInitialAmount = ethers.utils.parseEther("100000");
  const maxL1Tx = 256;
  const maxTx = 512;
  const nLevels = 32;
  const forgeL1L2BatchTimeout = 10;
  const feeAddToken = 10;
  const withdrawalDelay = 60 * 60 * 24 * 7 * 2; // 2 weeks
  const INITIAL_DELAY = 60; //seconds

  beforeEach(async function () {
    [
      owner,
      governance,
      forger1,
      id1,
      id2,
      registryFunder,
      hermezGovernanceAddress,
      whiteHackGroupAddress,
      donation,
      ...addrs
    ] = await ethers.getSigners();

    hermezGovernanceAddress = await governance.getAddress();
    ownerAddress = await owner.getAddress();

    const chainIdProvider = (await ethers.provider.getNetwork()).chainId;
    if (chainIdProvider == 1337) { // solcover, must be a jsonRPC wallet
      const mnemonic = "explain tackle mirror kit van hammer degree position ginger unfair soup bonus";
      let ownerWalletTest = ethers.Wallet.fromMnemonic(mnemonic);
      // ownerWalletTest = ownerWallet.connect(ethers.provider);
      ownerWallet = owner;
      ownerWallet.privateKey = ownerWalletTest.privateKey;
    }
    else {
      ownerWallet = new ethers.Wallet(ethers.provider._buidlerProvider._genesisAccounts[0].privateKey, ethers.provider);
    }

    // factory
    const Hermez = await ethers.getContractFactory("HermezTest");
    const TokenERC20PermitMock = await ethers.getContractFactory("ERC20PermitMock");
    const VerifierRollupHelper = await ethers.getContractFactory(
      "VerifierRollupHelper"
    );
    const VerifierWithdrawHelper = await ethers.getContractFactory(
      "VerifierWithdrawHelper"
    );
    const HermezAuctionProtocol = await ethers.getContractFactory(
      "HermezAuctionProtocol"
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

    // deploy poseidon libs
    const buidlerPoseidon2Elements = await Poseidon2Elements.deploy();
    const buidlerPoseidon3Elements = await Poseidon3Elements.deploy();
    const buidlerPoseidon4Elements = await Poseidon4Elements.deploy();

    const poseidonAddr2 = buidlerPoseidon2Elements.address;
    const poseidonAddr3 = buidlerPoseidon3Elements.address;
    const poseidonAddr4 = buidlerPoseidon4Elements.address;

    buidlerTokenHermez = await TokenERC20PermitMock.deploy(
      "tokenname",
      "TKN",
      await owner.getAddress(),
      tokenInitialAmount
    );

    await buidlerTokenHermez.deployed();
    let buidlerVerifierRollupHelper = await VerifierRollupHelper.deploy();
    let buidlerVerifierWithdrawHelper = await VerifierWithdrawHelper.deploy();

    //deploy auction protocol
    buidlerHermezAuctionProtocol = await HermezAuctionProtocol.deploy();

    await buidlerHermezAuctionProtocol.deployed();

    // deploy hermez and withdrawal delayer
    let currentCount = await owner.getTransactionCount();

    const WithdrawalDelayerAddress = ethers.utils.getContractAddress({
      nonce: currentCount + 1,
      from: ownerAddress,
    });
    const HermezAddress = ethers.utils.getContractAddress({
      nonce: currentCount + 2,
      from: ownerAddress,
    });

    const latest = (await time.latestBlock()).toNumber();


    const outbidding = 1000;
    const slotDeadline = 20;
    const closedAuctionSlots = 2;
    const openAuctionSlots = 4320;
    const allocationRatio = [4000, 4000, 2000];
    await expect(
      buidlerHermezAuctionProtocol.hermezAuctionProtocolInitializer(
        buidlerTokenHermez.address,
        latest + 1 + MIN_BLOCKS,
        HermezAddress,
        hermezGovernanceAddress,
        await donation.getAddress(), // donation address
        ownerAddress, // bootCoordinatorAddress
        bootCoordinatorURL
      )
    )
      .to.emit(buidlerHermezAuctionProtocol, "InitializeHermezAuctionProtocolEvent")
      .withArgs(
        await donation.getAddress(), // donation address
        ownerAddress, // bootCoordinatorAddress
        bootCoordinatorURL,
        outbidding,
        slotDeadline,
        closedAuctionSlots,
        openAuctionSlots,
        allocationRatio
      );

    buidlerWithdrawalDelayer = await WithdrawalDelayer.deploy(
      INITIAL_DELAY,
      HermezAddress,
      hermezGovernanceAddress,
      await whiteHackGroupAddress.getAddress()
    );  

    const filterInitialize = buidlerWithdrawalDelayer.filters.InitializeWithdrawalDelayerEvent(null, null, null);
    const eventsInitialize = await buidlerWithdrawalDelayer.queryFilter(filterInitialize, 0, "latest");
    expect(eventsInitialize[0].args.initialWithdrawalDelay).to.be.equal(INITIAL_DELAY);
    expect(eventsInitialize[0].args.initialHermezGovernanceAddress).to.be.equal(hermezGovernanceAddress);
    expect(eventsInitialize[0].args.initialEmergencyCouncil).to.be.equal( await whiteHackGroupAddress.getAddress());

    // deploy hermez
    buidlerHermez = await Hermez.deploy();
    await buidlerHermez.deployed();

    await expect(
      buidlerHermez.initializeHermez(
        [buidlerVerifierRollupHelper.address],
        calculateInputMaxTxLevels([maxTx], [nLevels]),
        buidlerVerifierWithdrawHelper.address,
        buidlerHermezAuctionProtocol.address,
        buidlerTokenHermez.address,
        forgeL1L2BatchTimeout,
        feeAddToken,
        poseidonAddr2,
        poseidonAddr3,
        poseidonAddr4,
        hermezGovernanceAddress,
        withdrawalDelay,
        WithdrawalDelayerAddress
      ))
      .to.emit(buidlerHermez, "InitializeHermezEvent")
      .withArgs(
        forgeL1L2BatchTimeout,
        feeAddToken,
        withdrawalDelay,
      );

    expect(buidlerWithdrawalDelayer.address).to.equal(WithdrawalDelayerAddress);
    expect(buidlerHermez.address).to.equal(HermezAddress);

    const chainSC = await buidlerHermez.getChainID();
    chainID = chainSC.toNumber();
    chainIDHex = chainSC.toHexString();
  });

  describe("Forge Batch", function () {
    it("forge L1 user & Coordiator Tx batch using consensus mechanism", async function () {
      // consensus operations
      let startingBlock = (
        await buidlerHermezAuctionProtocol.genesisBlock()
      ).toNumber();

      await buidlerHermezAuctionProtocol
        .connect(owner)
        .setCoordinator(await owner.getAddress(), COORDINATOR_1_URL);


      const value = ethers.utils.parseEther("100");
      const deadline = ethers.constants.MaxUint256;
      const nonce = await buidlerTokenHermez.nonces(await owner.getAddress());

      const { v, r, s } = await createPermitSignature(
        buidlerTokenHermez,
        ownerWallet,
        buidlerHermezAuctionProtocol.address,
        value,
        nonce,
        deadline
      );

      const dataPermit = iface.encodeFunctionData("permit", [
        await owner.getAddress(),
        buidlerHermezAuctionProtocol.address,
        value,
        deadline,
        v,
        r,
        s
      ]);

      await buidlerHermezAuctionProtocol.processMultiBid(
        value,
        3,
        8,
        [true, true, true, true, true, true],
        ethers.utils.parseEther("11"),
        ethers.utils.parseEther("11"),
        dataPermit
      );

      let block = startingBlock + 3 * BLOCKS_PER_SLOT;

      await time.advanceBlockTo(block);

      // hermez operations
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
        buidlerHermez,
        rollupDB
      );
      await AddToken(
        buidlerHermez,
        buidlerTokenHermez,
        buidlerTokenHermez,
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
        ownerWallet,
        buidlerHermez,
        buidlerTokenHermez,
        numAccounts,
        true
      );

      // add user l1 tx
      l1TxUserArray.push(
        await l1UserTxCreateAccountDeposit(
          loadAmount,
          tokenID,
          babyjub,
          ownerWallet,
          buidlerHermez,
          buidlerTokenHermez,
          true
        )
      );

      l1TxUserArray.push(
        await l1UserTxDeposit(
          loadAmount,
          tokenID,
          fromIdx,
          ownerWallet,
          buidlerHermez,
          buidlerTokenHermez,
          true
        )
      );
      l1TxUserArray.push(
        await l1UserTxDepositTransfer(
          loadAmount,
          tokenID,
          fromIdx,
          toIdx,
          amountF,
          ownerWallet,
          buidlerHermez,
          buidlerTokenHermez,
          true
        )
      );
      l1TxUserArray.push(
        await l1UserTxCreateAccountDepositTransfer(
          loadAmount,
          tokenID,
          toIdx,
          amountF,
          babyjub,
          ownerWallet,
          buidlerHermez,
          buidlerTokenHermez,
          true
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceTransfer(
          tokenID,
          fromIdx,
          toIdx,
          amountF,
          ownerWallet,
          buidlerHermez
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, ownerWallet, buidlerHermez)
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      const l1TxCoordiatorArray = [];

      // add Coordiator tx
      l1TxCoordiatorArray.push(
        await l1CoordinatorTxEth(tokenID, babyjub, ownerWallet, buidlerHermez, chainIDHex)
      );

      l1TxCoordiatorArray.push(
        await l1CoordinatorTxBjj(tokenID, babyjub, buidlerHermez)
      );

      // forge batch with all the L1 tx
      await forgerTest.forgeBatch(true, l1TxUserArray, l1TxCoordiatorArray);
    });
    it("test delayed withdraw with consensus mechanism and withdrawal delayer", async function () {
      // consensus operations
      let startingBlock = (
        await buidlerHermezAuctionProtocol.genesisBlock()
      ).toNumber();

      await buidlerHermezAuctionProtocol
        .connect(owner)
        .setCoordinator(await owner.getAddress(), COORDINATOR_1_URL);

      const value = ethers.utils.parseEther("100");
      const deadline = ethers.constants.MaxUint256;
      const nonce = await buidlerTokenHermez.nonces(await owner.getAddress());

      const { v, r, s } = await createPermitSignature(
        buidlerTokenHermez,
        ownerWallet,
        buidlerHermezAuctionProtocol.address,
        value,
        nonce,
        deadline
      );

      const dataPermit = iface.encodeFunctionData("permit", [
        await owner.getAddress(),
        buidlerHermezAuctionProtocol.address,
        value,
        deadline,
        v,
        r,
        s
      ]);

      await buidlerHermezAuctionProtocol.processMultiBid(
        value,
        3,
        8,
        [true, true, true, true, true, true],
        ethers.utils.parseEther("11"),
        ethers.utils.parseEther("11"),
        dataPermit
      );

      let block = startingBlock + 3 * BLOCKS_PER_SLOT;

      await time.advanceBlockTo(block);

      // hermez operations

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
        buidlerHermez,
        rollupDB
      );

      await AddToken(
        buidlerHermez,
        buidlerTokenHermez,
        buidlerTokenHermez,
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
        ownerWallet,
        buidlerHermez,
        buidlerTokenHermez,
        numAccounts,
        true
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, ownerWallet, buidlerHermez)
      );

      const initialOwnerBalance = await buidlerTokenHermez.balanceOf(
        buidlerWithdrawalDelayer.address
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      // perform withdraw
      const instantWithdraw = false;
      const numExitRoot = await buidlerHermez.lastForgedBatch();
      const state = await rollupDB.getStateByIdx(256);
      const exitInfo = await rollupDB.getExitTreeInfo(256, numExitRoot);
      await expect(
        buidlerHermez.withdrawMerkleProof(
          tokenID,
          amount,
          babyjub,
          numExitRoot,
          exitInfo.siblings,
          fromIdx,
          instantWithdraw
        )
      )
        .to.emit(buidlerHermez, "WithdrawEvent")
        .withArgs(fromIdx, numExitRoot, instantWithdraw);
      const finalOwnerBalance = await buidlerTokenHermez.balanceOf(
        buidlerWithdrawalDelayer.address
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + 10
      );
    });
  });
});
