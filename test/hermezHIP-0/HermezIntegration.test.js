const { expect } = require("chai");
const { ethers } = require("hardhat");
const SMTMemDB = require("circomlib").SMTMemDB;
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
} = require("@hermeznetwork/commonjsV1");

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
  let hardhatTokenHermez;
  let hardhatHermez;
  let hardhatWithdrawalDelayer;
  let hardhatHermezAuctionProtocol;

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
      ownerWallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", ethers.provider);
    }

    // factory
    const Hermez = await ethers.getContractFactory("HermezTestV2");
    const TokenERC20PermitMock = await ethers.getContractFactory("ERC20PermitMock");
    const VerifierRollupHelper = await ethers.getContractFactory(
      "VerifierMock"
    );
    const VerifierWithdrawHelper = await ethers.getContractFactory(
      "VerifierMock"
    );
    const HermezAuctionProtocol = await ethers.getContractFactory(
      "HermezAuctionProtocol"
    );
    const WithdrawalDelayer = await ethers.getContractFactory(
      "WithdrawalDelayer"
    );

    hardhatTokenHermez = await TokenERC20PermitMock.deploy(
      "tokenname",
      "TKN",
      await owner.getAddress(),
      tokenInitialAmount
    );

    await hardhatTokenHermez.deployed();
    let hardhatVerifierRollupHelper = await VerifierRollupHelper.deploy();
    let hardhatVerifierWithdrawHelper = await VerifierWithdrawHelper.deploy();

    //deploy auction protocol
    hardhatHermezAuctionProtocol = await HermezAuctionProtocol.deploy();

    await hardhatHermezAuctionProtocol.deployed();

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
      hardhatHermezAuctionProtocol.hermezAuctionProtocolInitializer(
        hardhatTokenHermez.address,
        latest + 1 + MIN_BLOCKS,
        HermezAddress,
        hermezGovernanceAddress,
        await donation.getAddress(), // donation address
        ownerAddress, // bootCoordinatorAddress
        bootCoordinatorURL
      )
    )
      .to.emit(hardhatHermezAuctionProtocol, "InitializeHermezAuctionProtocolEvent")
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

    hardhatWithdrawalDelayer = await WithdrawalDelayer.deploy(
      INITIAL_DELAY,
      HermezAddress,
      hermezGovernanceAddress,
      await whiteHackGroupAddress.getAddress()
    );

    const filterInitialize = hardhatWithdrawalDelayer.filters.InitializeWithdrawalDelayerEvent(null, null, null);
    const eventsInitialize = await hardhatWithdrawalDelayer.queryFilter(filterInitialize, 0, "latest");
    expect(eventsInitialize[0].args.initialWithdrawalDelay).to.be.equal(INITIAL_DELAY);
    expect(eventsInitialize[0].args.initialHermezGovernanceAddress).to.be.equal(hermezGovernanceAddress);
    expect(eventsInitialize[0].args.initialEmergencyCouncil).to.be.equal(await whiteHackGroupAddress.getAddress());

    // deploy hermez
    hardhatHermez = await Hermez.deploy();
    await hardhatHermez.deployed();

    await expect(
      hardhatHermez.initializeHermez(
        [hardhatVerifierRollupHelper.address],
        calculateInputMaxTxLevels([maxTx], [nLevels]),
        [hardhatVerifierWithdrawHelper.address, hardhatVerifierWithdrawHelper.address, hardhatVerifierWithdrawHelper.address, hardhatVerifierWithdrawHelper.address],
        hardhatHermezAuctionProtocol.address,
        hardhatTokenHermez.address,
        forgeL1L2BatchTimeout,
        feeAddToken,
        hermezGovernanceAddress,
        withdrawalDelay,
        WithdrawalDelayerAddress
      ))
      .to.emit(hardhatHermez, "InitializeHermezEvent")
      .withArgs(
        forgeL1L2BatchTimeout,
        feeAddToken,
        withdrawalDelay,
      );

    expect(hardhatWithdrawalDelayer.address).to.equal(WithdrawalDelayerAddress);
    expect(hardhatHermez.address).to.equal(HermezAddress);

    const chainSC = await hardhatHermez.getChainID();
    chainID = chainSC.toNumber();
    chainIDHex = chainSC.toHexString();
  });

  describe("Forge Batch", function () {
    it("forge L1 user & Coordiator Tx batch using consensus mechanism", async function () {
      // consensus operations
      let startingBlock = (
        await hardhatHermezAuctionProtocol.genesisBlock()
      ).toNumber();

      await hardhatHermezAuctionProtocol
        .connect(owner)
        .setCoordinator(await owner.getAddress(), COORDINATOR_1_URL);


      const value = ethers.utils.parseEther("100");
      const deadline = ethers.constants.MaxUint256;
      const nonce = await hardhatTokenHermez.nonces(await owner.getAddress());

      const { v, r, s } = await createPermitSignature(
        hardhatTokenHermez,
        ownerWallet,
        hardhatHermezAuctionProtocol.address,
        value,
        nonce,
        deadline
      );

      const dataPermit = iface.encodeFunctionData("permit", [
        await owner.getAddress(),
        hardhatHermezAuctionProtocol.address,
        value,
        deadline,
        v,
        r,
        s
      ]);

      await hardhatHermezAuctionProtocol.processMultiBid(
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
        hardhatHermez,
        rollupDB
      );
      await AddToken(
        hardhatHermez,
        hardhatTokenHermez,
        hardhatTokenHermez,
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
        hardhatHermez,
        hardhatTokenHermez,
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
          hardhatHermez,
          hardhatTokenHermez,
          true
        )
      );

      l1TxUserArray.push(
        await l1UserTxDeposit(
          loadAmount,
          tokenID,
          fromIdx,
          ownerWallet,
          hardhatHermez,
          hardhatTokenHermez,
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
          hardhatHermez,
          hardhatTokenHermez,
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
          hardhatHermez,
          hardhatTokenHermez,
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
          hardhatHermez
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, ownerWallet, hardhatHermez)
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      const l1TxCoordiatorArray = [];

      // add Coordiator tx
      l1TxCoordiatorArray.push(
        await l1CoordinatorTxEth(tokenID, babyjub, ownerWallet, hardhatHermez, chainIDHex)
      );

      l1TxCoordiatorArray.push(
        await l1CoordinatorTxBjj(tokenID, babyjub, hardhatHermez)
      );

      // forge batch with all the L1 tx
      await forgerTest.forgeBatch(true, l1TxUserArray, l1TxCoordiatorArray);
    });
    it("test delayed withdraw with consensus mechanism and withdrawal delayer", async function () {
      // consensus operations
      let startingBlock = (
        await hardhatHermezAuctionProtocol.genesisBlock()
      ).toNumber();

      await hardhatHermezAuctionProtocol
        .connect(owner)
        .setCoordinator(await owner.getAddress(), COORDINATOR_1_URL);

      const value = ethers.utils.parseEther("100");
      const deadline = ethers.constants.MaxUint256;
      const nonce = await hardhatTokenHermez.nonces(await owner.getAddress());

      const { v, r, s } = await createPermitSignature(
        hardhatTokenHermez,
        ownerWallet,
        hardhatHermezAuctionProtocol.address,
        value,
        nonce,
        deadline
      );

      const dataPermit = iface.encodeFunctionData("permit", [
        await owner.getAddress(),
        hardhatHermezAuctionProtocol.address,
        value,
        deadline,
        v,
        r,
        s
      ]);

      await hardhatHermezAuctionProtocol.processMultiBid(
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
        hardhatHermez,
        rollupDB
      );

      await AddToken(
        hardhatHermez,
        hardhatTokenHermez,
        hardhatTokenHermez,
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
        hardhatHermez,
        hardhatTokenHermez,
        numAccounts,
        true
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, ownerWallet, hardhatHermez)
      );

      const initialOwnerBalance = await hardhatTokenHermez.balanceOf(
        hardhatWithdrawalDelayer.address
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      // perform withdraw
      const proofA = ["0", "0"];
      const proofB = [
        ["0", "0"],
        ["0", "0"],
      ];
      const proofC = ["0", "0"];
      const instantWithdraw = false;
      const batchNum = await hardhatHermez.lastForgedBatch();

      await expect(
        hardhatHermez.withdrawMultiToken(
          proofA,
          proofB,
          proofC,
          [tokenID],
          [amount],
          [amount],
          batchNum,
          [fromIdx],
          [instantWithdraw]
        )
      )
        .to.emit(hardhatHermez, "WithdrawEvent")
        .withArgs(amount, fromIdx, instantWithdraw);

      const finalOwnerBalance = await hardhatTokenHermez.balanceOf(
        hardhatWithdrawalDelayer.address
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + 10
      );
    });
  });
});
