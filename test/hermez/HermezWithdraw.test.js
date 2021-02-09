const { expect } = require("chai");
const { ethers } = require("hardhat");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const { time } = require("@openzeppelin/test-helpers");
const { HermezAccount } = require("@hermeznetwork/commonjs");
const {
  AddToken,
  calculateInputMaxTxLevels,
} = require("./helpers/helpers");

describe("Hermez instant withdraw manager", function () {
  let hardhatTokenERC20Mock;
  let hardhatHermez;

  let owner;
  let id1;
  let addrs;
  let governance;
  let ownerWallet;

  const accounts = [];
  for (let i = 0; i < 10; i++) {
    accounts.push(new HermezAccount());
  }
  const tokenInitialAmount = 1000000;
  const maxTx = 512;
  const nLevels = 32;
  const forgeL1L2BatchTimeout = 10;
  const feeAddToken = 10;
  const withdrawalDelay = 60 * 60 * 24 * 7 * 2; // 2 weeks

  const INITIAL_DELAY = 0;


  this.beforeEach(async function () {
    [
      owner,
      governance,
      id1,
      ...addrs
    ] = await ethers.getSigners();

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

    const hermezGovernanceAddress = await governance.getAddress();

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
    const Hermez = await ethers.getContractFactory("HermezTest");

    // deploy helpers
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
    hardhatHermezAuctionTest = await HermezAuctionTest.deploy();

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
  });

  describe("Instant withdraw functionality", function () {
    it("updateBucketsParameters ", async function () {
      const numBuckets = 5;

      const buckets = [];

      for (let i = 0; i < numBuckets; i++) {
        const ceilUSD = (i + 1) * 1000;
        const withdrawals = 0;
        const blockWithdrawalRate = i * 2;
        const maxWithdrawals = 100000000000;
        buckets.push([
          ethers.BigNumber.from(ceilUSD),
          ethers.BigNumber.from(withdrawals),
          ethers.BigNumber.from(blockWithdrawalRate),
          ethers.BigNumber.from(maxWithdrawals),
        ]);
      }
      await expect(
        hardhatHermez.connect(governance).updateBucketsParameters(buckets)
      ).to.emit(hardhatHermez, "UpdateBucketsParameters");

      for (let i = 0; i < numBuckets; i++) {
        let bucket = await hardhatHermez.buckets(i);
        expect(bucket.ceilUSD).to.be.equal(buckets[i][0]);
        expect(bucket.blockWithdrawalRate).to.be.equal(buckets[i][2]);
        expect(bucket.maxWithdrawals).to.be.equal(buckets[i][3]);
      }
    });

    it("test instant withdraw with buckets", async function () {
      const numBuckets = 5;
      const tokenAddress = hardhatTokenERC20Mock.address;

      const buckets = [];

      // add buckets
      for (let i = 0; i < numBuckets; i++) {
        const ceilUSD = (i + 1) * 1000;
        const withdrawals = 0;
        const blockWithdrawalRate = (i + 1) * 2;
        const maxWithdrawals = 100000000000;
        buckets.push([
          ceilUSD,
          withdrawals,
          blockWithdrawalRate,
          maxWithdrawals,
        ]);
      }

      await hardhatHermez.connect(governance).updateBucketsParameters(buckets);

      for (let i = 0; i < numBuckets; i++) {
        let bucket = await hardhatHermez.buckets(i);
        expect(bucket.ceilUSD).to.be.equal(buckets[i][0]);
        expect(bucket.blockWithdrawalRate).to.be.equal(buckets[i][2]);
        expect(bucket.maxWithdrawals).to.be.equal(buckets[i][3]);
      }

      for (let i = 0; i < numBuckets; i++) {
        const ceilUSD = (i + 1) * 1000;
        expect(await hardhatHermez.findBucketIdxTest(ceilUSD)).to.equal(i);
      }

      await expect(hardhatHermez.findBucketIdxTest(6000)).to.be.revertedWith(
        "InstantWithdrawManager::_findBucketIdx: EXCEED_MAX_AMOUNT"
      );

      // add withdrawals and price
      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );
      const addressArray = [hardhatTokenERC20Mock.address];
      const tokenPrice = 10; //USD
      const valueArray = [tokenPrice * 1e14];
      await expect(hardhatHermez
        .connect(governance)
        .updateTokenExchange(addressArray, valueArray))
        .to.emit(hardhatHermez, "UpdateTokenExchange")
        .withArgs(addressArray, valueArray);

      expect(
        await hardhatHermez.tokenExchange(hardhatTokenERC20Mock.address)
      ).to.equal(valueArray[0]);

      const tokenAmount = 10; // base unit
      const tokenAmountDecimals = ethers.utils.parseEther(
        tokenAmount.toString()
      ); // 18 decimals
      const resultUSD = tokenPrice * tokenAmount;
      const bucketIdx = 0;
      expect(
        await hardhatHermez.token2USDTest(tokenAddress, tokenAmountDecimals)
      ).to.equal(resultUSD);
      expect(await hardhatHermez.findBucketIdxTest(resultUSD)).to.equal(
        bucketIdx
      );

      // test instat withdrawal and bucket recharge

      // reset buckets
      await hardhatHermez.connect(governance).updateBucketsParameters(buckets);

      await expect(
        hardhatHermez.instantWithdrawalTest(tokenAddress, tokenAmountDecimals)
      ).to.be.revertedWith("Hermez::withdrawMerkleProof: INSTANT_WITHDRAW_WASTED_FOR_THIS_USD_RANGE");

      let bucketSC = await hardhatHermez.buckets(bucketIdx);
      expect(bucketSC.withdrawals).to.be.equal(0);
      const initialTimestamp = parseInt(bucketSC.blockStamp);

      const tokenRate = buckets[bucketIdx][2];

      // 0 withdrawals
      await time.advanceBlockTo(initialTimestamp + tokenRate * 2 - 1);


      const expectedIdx = bucketIdx;
      let expectedWithdrawals = 1;
      let expectedblockStamp = initialTimestamp + tokenRate * 2;

      // 2 withdrawals
      await expect(hardhatHermez.instantWithdrawalTest(
        tokenAddress,
        tokenAmountDecimals
      )).to.emit(hardhatHermez, "UpdateBucketWithdraw")
        .withArgs(expectedIdx, expectedblockStamp, expectedWithdrawals);


      bucketSC = await hardhatHermez.buckets(bucketIdx);
      expect(bucketSC.withdrawals).to.be.equal(expectedWithdrawals);
      expect(bucketSC.blockStamp).to.be.equal(expectedblockStamp);

      await time.advanceBlockTo(initialTimestamp + tokenRate * 5 - 1);

      expectedWithdrawals = 3;
      expectedblockStamp = initialTimestamp + tokenRate * 5;

      await expect(hardhatHermez.instantWithdrawalTest(
        tokenAddress,
        tokenAmountDecimals
      )).to.emit(hardhatHermez, "UpdateBucketWithdraw")
        .withArgs(expectedIdx, expectedblockStamp, expectedWithdrawals);

      bucketSC = await hardhatHermez.buckets(bucketIdx);

      // 1 + 3 - 1 = 3 withdrawals left
      expect(bucketSC.withdrawals).to.be.equal(expectedWithdrawals);
      expect(bucketSC.blockStamp).to.be.equal(expectedblockStamp);

      await hardhatHermez.instantWithdrawalTest(
        tokenAddress,
        tokenAmountDecimals
      );
      bucketSC = await hardhatHermez.buckets(bucketIdx);
      expect(bucketSC.withdrawals).to.be.equal(2);
    });

    it("test instant withdraw with buckets full, and ERC20Permit", async function () {
      const numBuckets = 5;
      const tokenAddress = hardhatHEZ.address;

      const buckets = [];

      // add buckets
      for (let i = 0; i < numBuckets; i++) {
        const ceilUSD = (i + 1) * 1000;
        const withdrawals = 0;
        const blockWithdrawalRate = (i + 1) * 4;
        const maxWithdrawals = 4;
        buckets.push([
          ceilUSD,
          withdrawals,
          blockWithdrawalRate,
          maxWithdrawals,
        ]);
      }

      await hardhatHermez.connect(governance).updateBucketsParameters(buckets);

      for (let i = 0; i < numBuckets; i++) {
        let bucket = await hardhatHermez.buckets(i);
        expect(bucket.ceilUSD).to.be.equal(buckets[i][0]);
        expect(bucket.blockWithdrawalRate).to.be.equal(buckets[i][2]);
        expect(bucket.maxWithdrawals).to.be.equal(buckets[i][3]);
      }

      // withdraw can be performed, because token has no value in rollup
      expect(
        await hardhatHermez.instantWithdrawalViewer(tokenAddress, 1e15)
      ).to.be.equal(true);

      // add withdrawals and price
      await AddToken(
        hardhatHermez,
        hardhatHEZ,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );
      const addressArray = [hardhatHEZ.address];
      const tokenPrice = 10;
      const valueArray = [tokenPrice * 1e14];
      await expect(hardhatHermez
        .connect(governance)
        .updateTokenExchange(addressArray, valueArray))
        .to.emit(hardhatHermez, "UpdateTokenExchange")
        .withArgs(addressArray, valueArray);

      expect(await hardhatHermez.tokenExchange(hardhatHEZ.address)).to.equal(
        valueArray[0]
      );

      const tokenAmount = 10;
      const resultUSD = tokenPrice * tokenAmount;
      const tokenAmountDecimals = ethers.utils.parseEther(
        tokenAmount.toString()
      ); // 18 decimals
      const bucketIdx = 0;

      expect(
        await hardhatHermez.token2USDTest(tokenAddress, tokenAmountDecimals)
      ).to.equal(resultUSD);
      expect(await hardhatHermez.findBucketIdxTest(resultUSD)).to.equal(
        bucketIdx
      );

      // no withdrawals yet
      expect(
        await hardhatHermez.instantWithdrawalViewer(
          tokenAddress,
          tokenAmountDecimals
        )
      ).to.be.equal(false);

      // test instat withdrawal and bucket recharge

      // reset buckets
      await hardhatHermez.connect(governance).updateBucketsParameters(buckets);

      await expect(
        hardhatHermez.instantWithdrawalTest(tokenAddress, tokenAmountDecimals)
      ).to.be.revertedWith("Hermez::withdrawMerkleProof: INSTANT_WITHDRAW_WASTED_FOR_THIS_USD_RANGE");

      let bucketSC = await hardhatHermez.buckets(bucketIdx);
      expect(bucketSC.withdrawals).to.be.equal(0);
      const initialTimestamp = parseInt(bucketSC.blockStamp);
      const tokenRate = buckets[bucketIdx][2];

      // 0 withdrawals
      expect(
        await hardhatHermez.instantWithdrawalViewer(
          tokenAddress,
          tokenAmountDecimals
        )
      ).to.be.equal(false);

      // still 0 withdrawals
      await time.advanceBlockTo(initialTimestamp + tokenRate - 1);
      expect(
        await hardhatHermez.instantWithdrawalViewer(
          tokenAddress,
          tokenAmountDecimals
        )
      ).to.be.equal(false);

      await time.advanceBlockTo(initialTimestamp + tokenRate * 2 - 1);
      expect(
        await hardhatHermez.instantWithdrawalViewer(
          tokenAddress,
          tokenAmountDecimals
        )
      ).to.be.equal(true);


      const expectedIdx = bucketIdx;
      let expectedWithdrawals = 1;
      let expectedblockStamp = initialTimestamp + tokenRate * 2;

      // 2 withdrawals
      await expect(hardhatHermez.instantWithdrawalTest(
        tokenAddress,
        tokenAmountDecimals
      )).to.emit(hardhatHermez, "UpdateBucketWithdraw")
        .withArgs(expectedIdx, expectedblockStamp, expectedWithdrawals);


      // 2 withdrawals
      bucketSC = await hardhatHermez.buckets(bucketIdx);

      expect(bucketSC.withdrawals).to.be.equal(expectedWithdrawals);
      expect(bucketSC.blockStamp).to.be.equal(expectedblockStamp);

      await time.advanceBlockTo(initialTimestamp + tokenRate * 5 - 1);


      expectedWithdrawals = 3;
      expectedblockStamp = initialTimestamp + tokenRate * 5;

      await expect(hardhatHermez.instantWithdrawalTest(
        tokenAddress,
        tokenAmountDecimals
      )).to.emit(hardhatHermez, "UpdateBucketWithdraw")
        .withArgs(expectedIdx, expectedblockStamp, expectedWithdrawals);

      bucketSC = await hardhatHermez.buckets(bucketIdx);
      // max withdawals = 4
      expect(bucketSC.withdrawals).to.be.equal(expectedWithdrawals);
      expect(bucketSC.blockStamp).to.be.equal(expectedblockStamp);

      // withdraw could be performed
      expect(
        await hardhatHermez.instantWithdrawalViewer(
          tokenAddress,
          tokenAmountDecimals
        )
      ).to.be.equal(true);

      await time.advanceBlockTo(initialTimestamp + tokenRate * 10 - 1);

      // withdraw
      await hardhatHermez.instantWithdrawalTest(
        tokenAddress,
        tokenAmountDecimals
      );

      // still tokens for withdraw
      expect(
        await hardhatHermez.instantWithdrawalViewer(
          tokenAddress,
          tokenAmountDecimals
        )
      ).to.be.equal(true);

      const lastBlock = await time.latestBlock();
      bucketSC = await hardhatHermez.buckets(bucketIdx);
      expect(bucketSC.withdrawals).to.be.equal(3);
      // if withdrawals = maxWithdrawals, blockstamp is updated when withdraw
      expect(bucketSC.blockStamp).to.be.equal(lastBlock.toNumber());

      // add new buckets
      const bucketsFull = [];
      for (let i = 0; i < numBuckets; i++) {
        const ceilUSD = (i + 1) * 1000;
        const withdrawals = 4;
        const blockWithdrawalRate = (i + 1) * 4;
        const maxWithdrawals = 4;
        bucketsFull.push([
          ceilUSD,
          withdrawals,
          blockWithdrawalRate,
          maxWithdrawals,
        ]);
      }
      await hardhatHermez
        .connect(governance)
        .updateBucketsParameters(bucketsFull);

      // test again withdraw will full bucket
      await hardhatHermez.instantWithdrawalTest(
        tokenAddress,
        tokenAmountDecimals
      );

      const lastBlock2 = await time.latestBlock();
      bucketSC = await hardhatHermez.buckets(bucketIdx);
      expect(bucketSC.withdrawals).to.be.equal(3);
      // if withdrawals = maxWithdrawals, blockstamp is updated when withdraw
      expect(bucketSC.blockStamp).to.be.equal(lastBlock2.toNumber());
    });

    it("update WithdrawalDelay", async function () {
      const newWithdrawalDelay = 100000;

      expect(await hardhatHermez.withdrawalDelay()).to.equal(
        60 * 60 * 24 * 7 * 2 // 2 weeks
      );

      await expect(
        hardhatHermez
          .connect(governance)
          .updateWithdrawalDelay(newWithdrawalDelay))
        .to.emit(hardhatHermez, "UpdateWithdrawalDelay")
        .withArgs(newWithdrawalDelay);
      expect(await hardhatHermez.withdrawalDelay()).to.equal(
        newWithdrawalDelay
      );
    });

    it("enable safeMode", async function () {
      await expect(hardhatHermez.safeMode()).to.be.revertedWith(
        "InstantWithdrawManager::onlyGovernance: ONLY_GOVERNANCE_ADDRESS"
      );

      const numBuckets = 5;

      const buckets = [];

      // add buckets
      for (let i = 0; i < numBuckets; i++) {
        const ceilUSD = (i + 1) * 1000;
        const withdrawals = 0;
        const blockWithdrawalRate = (i + 1) * 2;
        const maxWithdrawals = 100000000000;
        buckets.push([
          ceilUSD,
          withdrawals,
          blockWithdrawalRate,
          maxWithdrawals,
        ]);
      }

      await hardhatHermez.connect(governance).updateBucketsParameters(buckets);

      for (let i = 0; i < numBuckets; i++) {
        let bucket = await hardhatHermez.buckets(i);
        expect(bucket.ceilUSD).to.be.equal(buckets[i][0]);
        expect(bucket.blockWithdrawalRate).to.be.equal(buckets[i][2]);
        expect(bucket.maxWithdrawals).to.be.equal(buckets[i][3]);
      }

      await expect(hardhatHermez.connect(governance).safeMode()).to.emit(hardhatHermez, "SafeMode");

      for (let i = 0; i < numBuckets; i++) {
        let bucket = await hardhatHermez.buckets(i);
        expect(bucket.ceilUSD).to.be.equal(0);
        expect(bucket.blockWithdrawalRate).to.be.equal(0);
        expect(bucket.maxWithdrawals).to.be.equal(0);
      }
    });
  });
});
