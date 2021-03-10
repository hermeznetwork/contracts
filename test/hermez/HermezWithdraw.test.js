const { expect } = require("chai");
const { ethers } = require("hardhat");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const { time } = require("@openzeppelin/test-helpers");
const { HermezAccount } = require("@hermeznetwork/commonjs");
const {
  AddToken,
  calculateInputMaxTxLevels,
  packBucket,
  unpackBucket
} = require("./helpers/helpers");
const Scalar = require("ffjavascript").Scalar;

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
  const numBuckets = 5;
  const _EXCHANGE_MULTIPLIER = 1e10;
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

    it("test Helpers pack/unpack function matches SC", async function () {
      const numBuckets = 5;
      const buckets = [];
      for (let i = 0; i < numBuckets; i++) {
        const ceilUSD = (i + 1) * 10000000;
        const blockStamp = 1020;
        const withdrawals = 100005;
        const rateBlocks = 1123123;
        const rateWithdrawals = 1232143;
        const maxWithdrawals = 100000000000000;
        buckets.push({
          ceilUSD,
          blockStamp,
          withdrawals,
          rateBlocks,
          rateWithdrawals,
          maxWithdrawals
        });
      }

      for (let i = 0; i < buckets.length; i++) {
        const packetBucketSC = await hardhatHermez.packBucket(
          buckets[i].ceilUSD,
          buckets[i].blockStamp,
          buckets[i].withdrawals,
          buckets[i].rateBlocks,
          buckets[i].rateWithdrawals,
          buckets[i].maxWithdrawals
        );
        const packetBucketJs = packBucket(buckets[i]);
        expect(packetBucketJs).to.be.equal(packetBucketSC);

        const unpackedBucketSC = await hardhatHermez.unpackBucket(packetBucketJs);
        const unpackedBucketJs = unpackBucket(packetBucketJs);

        expect(unpackedBucketSC.ceilUSD).to.be.equal(ethers.BigNumber.from(unpackedBucketJs.ceilUSD));
        expect(unpackedBucketSC.blockStamp).to.be.equal(ethers.BigNumber.from(unpackedBucketJs.blockStamp));
        expect(unpackedBucketSC.withdrawals).to.be.equal(ethers.BigNumber.from(unpackedBucketJs.withdrawals));
        expect(unpackedBucketSC.rateBlocks).to.be.equal(ethers.BigNumber.from(unpackedBucketJs.rateBlocks));
        expect(unpackedBucketSC.rateWithdrawals).to.be.equal(ethers.BigNumber.from(unpackedBucketJs.rateWithdrawals));
        expect(unpackedBucketSC.maxWithdrawals).to.be.equal(ethers.BigNumber.from(unpackedBucketJs.maxWithdrawals));
      }


    });

    it("updateBucketsParameters ", async function () {
      const buckets = [];
      for (let i = 0; i < numBuckets; i++) {
        const ceilUSD = (i + 1) * 1000;
        const blockStamp = 0; // does not matter!
        const withdrawals = 0;
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

      for (let i = 0; i < numBuckets; i++) {
        const bucket = await hardhatHermez.buckets(i);
        const unpackedBucket = unpackBucket(bucket._hex);
        expect(buckets[i].ceilUSD).to.be.equal(ethers.BigNumber.from(unpackedBucket.ceilUSD));
        expect(buckets[i].withdrawals).to.be.equal(ethers.BigNumber.from(unpackedBucket.withdrawals));
        expect(buckets[i].rateBlocks).to.be.equal(ethers.BigNumber.from(unpackedBucket.rateBlocks));
        expect(buckets[i].rateWithdrawals).to.be.equal(ethers.BigNumber.from(unpackedBucket.rateWithdrawals));
        expect(buckets[i].maxWithdrawals).to.be.equal(ethers.BigNumber.from(unpackedBucket.maxWithdrawals));
      }
    });

    it("test instant withdraw with buckets", async function () {
      const tokenAddress = hardhatTokenERC20Mock.address;
      const buckets = [];
      for (let i = 0; i < numBuckets; i++) {
        const ceilUSD = (i + 1) * 1000;
        const blockStamp = 0; // does not matter!
        const withdrawals = 0;
        const rateBlocks = (i + 1) * 2;
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

 
      for (let i = 0; i < numBuckets; i++) {
        const bucket = await hardhatHermez.buckets(i);
        const unpackedBucket = unpackBucket(bucket._hex);
        expect(buckets[i].ceilUSD).to.be.equal(ethers.BigNumber.from(unpackedBucket.ceilUSD));
        expect(buckets[i].withdrawals).to.be.equal(ethers.BigNumber.from(unpackedBucket.withdrawals));
        expect(buckets[i].rateBlocks).to.be.equal(ethers.BigNumber.from(unpackedBucket.rateBlocks));
        expect(buckets[i].rateWithdrawals).to.be.equal(ethers.BigNumber.from(unpackedBucket.rateWithdrawals));
        expect(buckets[i].maxWithdrawals).to.be.equal(ethers.BigNumber.from(unpackedBucket.maxWithdrawals));
      }

      for (let i = 0; i < numBuckets; i++) {
        const ceilUSD = (i + 1) * 1000;
        expect(await hardhatHermez.findBucketIdxTest(ceilUSD)).to.equal(i);
      }

      // withdraw can be performed, because token has no value in rollup
      expect(
        await hardhatHermez.instantWithdrawalViewer(tokenAddress, 1e15)
      ).to.be.equal(true);

      // add withdrawals and price
      await AddToken(
        hardhatHermez,
        hardhatTokenERC20Mock,
        hardhatHEZ,
        ownerWallet,
        feeAddToken
      );
      const addressArray = [tokenAddress];
      const tokenPrice = 10; //USD
      const valueArray = [tokenPrice * _EXCHANGE_MULTIPLIER];
      await expect(hardhatHermez
        .connect(governance)
        .updateTokenExchange(addressArray, valueArray))
        .to.emit(hardhatHermez, "UpdateTokenExchange")
        .withArgs(addressArray, valueArray);

      expect(
        await hardhatHermez.tokenExchange(tokenAddress)
      ).to.equal(valueArray[0]);

      const tokenAmount = 10; // base unit 40000000000
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
      await hardhatHermez.connect(governance).updateBucketsParameters(bucketsPacked);

      await expect(
        hardhatHermez.instantWithdrawalTest(tokenAddress, tokenAmountDecimals)
      ).to.be.revertedWith("HermezTest::withdrawMerkleProof: INSTANT_WITHDRAW_WASTED_FOR_THIS_USD_RANGE");

      let actualBucketSC = await hardhatHermez.buckets(bucketIdx);
      let actualUnpackedBucket = unpackBucket(actualBucketSC._hex);

      expect(Scalar.toNumber(actualUnpackedBucket.withdrawals)).to.be.equal(0);

      const initialTimestamp = parseInt(actualUnpackedBucket.blockStamp);
      const tokenRate = buckets[bucketIdx].rateBlocks;

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


      actualBucketSC = await hardhatHermez.buckets(bucketIdx);
      actualUnpackedBucket = unpackBucket(actualBucketSC._hex);

      expect(Scalar.toNumber(actualUnpackedBucket.withdrawals)).to.be.equal(expectedWithdrawals);
      expect(Scalar.toNumber(actualUnpackedBucket.blockStamp)).to.be.equal(expectedblockStamp);

      await time.advanceBlockTo(initialTimestamp + tokenRate * 5 - 1);

      expectedWithdrawals = 3;
      expectedblockStamp = initialTimestamp + tokenRate * 5;

      await expect(hardhatHermez.instantWithdrawalTest(
        tokenAddress,
        tokenAmountDecimals
      )).to.emit(hardhatHermez, "UpdateBucketWithdraw")
        .withArgs(expectedIdx, expectedblockStamp, expectedWithdrawals);

      actualBucketSC = await hardhatHermez.buckets(bucketIdx);
      actualUnpackedBucket = unpackBucket(actualBucketSC._hex);

      // 1 + 3 - 1 = 3 withdrawals left
      expect(Scalar.toNumber(actualUnpackedBucket.withdrawals)).to.be.equal(expectedWithdrawals);
      expect(Scalar.toNumber(actualUnpackedBucket.blockStamp)).to.be.equal(expectedblockStamp);

      await hardhatHermez.instantWithdrawalTest(
        tokenAddress,
        tokenAmountDecimals
      );
      actualBucketSC = await hardhatHermez.buckets(bucketIdx);
      actualUnpackedBucket = unpackBucket(actualBucketSC._hex);
      expect(Scalar.toNumber(actualUnpackedBucket.withdrawals)).to.be.equal(2);
    });

    it("test instant withdraw with buckets full, and ERC20Permit", async function () {
      const tokenAddress = hardhatHEZ.address;
      const buckets = [];
      for (let i = 0; i < numBuckets; i++) {
        const ceilUSD = (i + 1) * 1000;
        const blockStamp = 0; // does not matter!
        const withdrawals = 0;
        const rateBlocks = (i + 1) * 4;
        const rateWithdrawals = 3;
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


      for (let i = 0; i < numBuckets; i++) {
        const bucket = await hardhatHermez.buckets(i);
        const unpackedBucket = unpackBucket(bucket._hex);
        expect(buckets[i].ceilUSD).to.be.equal(ethers.BigNumber.from(unpackedBucket.ceilUSD));
        expect(buckets[i].withdrawals).to.be.equal(ethers.BigNumber.from(unpackedBucket.withdrawals));
        expect(buckets[i].rateBlocks).to.be.equal(ethers.BigNumber.from(unpackedBucket.rateBlocks));
        expect(buckets[i].rateWithdrawals).to.be.equal(ethers.BigNumber.from(unpackedBucket.rateWithdrawals));
        expect(buckets[i].maxWithdrawals).to.be.equal(ethers.BigNumber.from(unpackedBucket.maxWithdrawals));
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
      const valueArray = [tokenPrice * _EXCHANGE_MULTIPLIER];
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
      await hardhatHermez.connect(governance).updateBucketsParameters(bucketsPacked);

      await expect(
        hardhatHermez.instantWithdrawalTest(tokenAddress, tokenAmountDecimals)
      ).to.be.revertedWith("HermezTest::withdrawMerkleProof: INSTANT_WITHDRAW_WASTED_FOR_THIS_USD_RANGE");

      let actualBucketSC = await hardhatHermez.buckets(bucketIdx);
      let actualUnpackedBucket = unpackBucket(actualBucketSC._hex);

      expect(Scalar.toNumber(actualUnpackedBucket.withdrawals)).to.be.equal(0);

      const initialTimestamp = parseInt(actualUnpackedBucket.blockStamp);
      const tokenRate = buckets[bucketIdx].rateBlocks;

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
      let expectedWithdrawals = 2 * buckets[bucketIdx].rateWithdrawals - 1; // -1 actual withdrawal
      let expectedblockStamp = initialTimestamp + tokenRate * 2;

      // 2 withdrawals
      await expect(hardhatHermez.instantWithdrawalTest(
        tokenAddress,
        tokenAmountDecimals
      )).to.emit(hardhatHermez, "UpdateBucketWithdraw")
        .withArgs(expectedIdx, expectedblockStamp, expectedWithdrawals);


      // 2 withdrawals
      actualBucketSC = await hardhatHermez.buckets(bucketIdx);
      actualUnpackedBucket = unpackBucket(actualBucketSC._hex);

      expect(Scalar.toNumber(actualUnpackedBucket.withdrawals)).to.be.equal(expectedWithdrawals);
      expect(Scalar.toNumber(actualUnpackedBucket.blockStamp)).to.be.equal(expectedblockStamp);

      await time.advanceBlockTo(initialTimestamp + tokenRate * 5 - 1);


      expectedWithdrawals = 5 * buckets[bucketIdx].rateWithdrawals - 2; // -2 previous and actual withdrawal
      expectedblockStamp = initialTimestamp + tokenRate * 5;

      await expect(hardhatHermez.instantWithdrawalTest(
        tokenAddress,
        tokenAmountDecimals
      )).to.emit(hardhatHermez, "UpdateBucketWithdraw")
        .withArgs(expectedIdx, expectedblockStamp, expectedWithdrawals);

      actualBucketSC = await hardhatHermez.buckets(bucketIdx);
      actualUnpackedBucket = unpackBucket(actualBucketSC._hex);

      // max withdawals = 4
      expect(Scalar.toNumber(actualUnpackedBucket.withdrawals)).to.be.equal(expectedWithdrawals);
      expect(Scalar.toNumber(actualUnpackedBucket.blockStamp)).to.be.equal(expectedblockStamp);

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
      actualBucketSC = await hardhatHermez.buckets(bucketIdx);
      actualUnpackedBucket = unpackBucket(actualBucketSC._hex);

      expectedWithdrawals = 10 * buckets[bucketIdx].rateWithdrawals - 3; // -3 previous withdrawals

      expect(Scalar.toNumber(actualUnpackedBucket.withdrawals)).to.be.equal(expectedWithdrawals);
      // if withdrawals = maxWithdrawals, blockstamp is updated when withdraw
      expect(Scalar.toNumber(actualUnpackedBucket.blockStamp)).to.be.equal(lastBlock.toNumber());

      // add new buckets
      const bucketsFull = [];
      for (let i = 0; i < numBuckets; i++) {
        const ceilUSD = (i + 1) * 1000;
        const blockStamp = 0; // does not matter!
        const withdrawals = 4;
        const rateBlocks = (i + 1) * 4;
        const rateWithdrawals = i + 1;
        const maxWithdrawals = 4; // max value 4294967296;
        bucketsFull.push({
          ceilUSD,
          blockStamp,
          withdrawals,
          rateBlocks,
          rateWithdrawals,
          maxWithdrawals
        });
      }

      const bucketsPackedFull = bucketsFull.map((bucket) => packBucket(bucket));
      await expect(
        hardhatHermez.connect(governance).updateBucketsParameters(bucketsPackedFull)
      ).to.emit(hardhatHermez, "UpdateBucketsParameters");

      // test again withdraw will full bucket
      await hardhatHermez.instantWithdrawalTest(
        tokenAddress,
        tokenAmountDecimals
      );
      const lastBlock2 = await time.latestBlock();
      actualBucketSC = await hardhatHermez.buckets(bucketIdx);
      actualUnpackedBucket = unpackBucket(actualBucketSC._hex);
      expect(actualUnpackedBucket.withdrawals).to.be.equal(Scalar.e(3));
      // if withdrawals = maxWithdrawals, blockstamp is updated when withdraw
      expect(actualUnpackedBucket.blockStamp).to.be.equal(Scalar.e(lastBlock2.toNumber()));
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

      const tokenAddress = hardhatTokenERC20Mock.address;
      // no limitations!
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
      const addressArray = [tokenAddress];
      const tokenPrice = 10;
      const valueArray = [tokenPrice * _EXCHANGE_MULTIPLIER];
      await expect(hardhatHermez
        .connect(governance)
        .updateTokenExchange(addressArray, valueArray))
        .to.emit(hardhatHermez, "UpdateTokenExchange")
        .withArgs(addressArray, valueArray);

      // still no limitations!
      expect(
        await hardhatHermez.instantWithdrawalViewer(tokenAddress, 1e15)
      ).to.be.equal(true);

      const buckets = [];
      for (let i = 0; i < numBuckets; i++) {
        if (i != 4) {
          const ceilUSD = (i + 1) * 1000;
          const blockStamp = 0; // does not matter!
          const withdrawals = 100;
          const rateBlocks = (i + 1) * 4;
          const rateWithdrawals = 3;
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
        else {
          // last bucket
          const ceilUSD = Scalar.fromString("0xffffffffffffffffffffffff", 16);
          const blockStamp = 0; // does not matter!
          const withdrawals = 0;
          const rateBlocks = 1;
          const rateWithdrawals = 0;
          const maxWithdrawals = 0; // max value 4294967296;
          buckets.push({
            ceilUSD,
            blockStamp,
            withdrawals,
            rateBlocks,
            rateWithdrawals,
            maxWithdrawals
          });
        }
      }
      const bucketsPacked = buckets.map((bucket) => packBucket(bucket));
      await expect(
        hardhatHermez.connect(governance).updateBucketsParameters(bucketsPacked)
      ).to.emit(hardhatHermez, "UpdateBucketsParameters");


      for (let i = 0; i < numBuckets; i++) {
        const bucket = await hardhatHermez.buckets(i);
        const unpackedBucket = unpackBucket(bucket._hex);
        expect(buckets[i].ceilUSD).to.be.equal(ethers.BigNumber.from(unpackedBucket.ceilUSD));
        expect(buckets[i].withdrawals).to.be.equal(ethers.BigNumber.from(unpackedBucket.withdrawals));
        expect(buckets[i].rateBlocks).to.be.equal(ethers.BigNumber.from(unpackedBucket.rateBlocks));
        expect(buckets[i].rateWithdrawals).to.be.equal(ethers.BigNumber.from(unpackedBucket.rateWithdrawals));
        expect(buckets[i].maxWithdrawals).to.be.equal(ethers.BigNumber.from(unpackedBucket.maxWithdrawals));
      }

      // limitations!
      const tokenAmount = 1e10;
      const resultUSD = tokenPrice * tokenAmount;
      const tokenAmountDecimals = ethers.utils.parseEther(
        tokenAmount.toString()
      ); // 18 decimals
      expect(
        await hardhatHermez.token2USDTest(tokenAddress, tokenAmountDecimals)
      ).to.equal(resultUSD);
      
      expect(
        await hardhatHermez.instantWithdrawalViewer(tokenAddress, tokenAmountDecimals)
      ).to.be.equal(false);
      expect(
        await hardhatHermez.instantWithdrawalViewer(tokenAddress, 10)
      ).to.be.equal(true); 

      await expect(hardhatHermez.connect(governance).safeMode()).to.emit(hardhatHermez, "SafeMode");

      const bucketSafe = await hardhatHermez.buckets(0);
      const unpackedBucketSafe = unpackBucket(bucketSafe._hex);

      expect(await hardhatHermez.nBuckets()).to.be.equal(1);
      expect(unpackedBucketSafe.ceilUSD.toString(16)).to.be.equal("ffffffffffffffffffffffff");
      expect(unpackedBucketSafe.withdrawals).to.be.equal(Scalar.e(0));
      expect(unpackedBucketSafe.rateBlocks).to.be.equal(Scalar.e(1));
      expect(unpackedBucketSafe.rateWithdrawals).to.be.equal(Scalar.e(0));
      expect(unpackedBucketSafe.maxWithdrawals).to.be.equal(Scalar.e(0));

      expect(
        await hardhatHermez.token2USDTest(tokenAddress, ethers.utils.parseEther("1"))
      ).to.equal(10);

      expect(
        await hardhatHermez.instantWithdrawalViewer(tokenAddress, ethers.utils.parseEther("1"))
      ).to.be.equal(false); 
    });
  });
});
