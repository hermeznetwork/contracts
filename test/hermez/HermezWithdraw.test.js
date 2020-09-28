const {expect} = require("chai");
const {ethers} = require("../../node_modules/@nomiclabs/buidler");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const {time} = require("@openzeppelin/test-helpers");
const {HermezAccount} = require("@hermeznetwork/commonjs");
const {
  AddToken,
  calculateInputMaxTxLevels,
  registerERC1820,
} = require("./helpers/helpers");

describe("Hermez instant withdraw manager", function () {
  let buidlerTokenERC20Mock;
  let buidlerHermez;

  let owner;
  let id1;
  let addrs;
  let governance;

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

  this.beforeEach(async function () {
    [
      owner,
      governance,
      safetyAddress,
      id1,
      ...addrs
    ] = await ethers.getSigners();

    const hermezGovernanceDAOAddress = await governance.getAddress();

    // factory helpers
    const TokenERC20Mock = await ethers.getContractFactory("ERC20Mock");
    const TokenERC777Mock = await ethers.getContractFactory("ERC777Mock");

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

    await registerERC1820(owner);

    buidlerTokenERC20Mock = await TokenERC20Mock.deploy(
      "tokenname",
      "TKN",
      await owner.getAddress(),
      tokenInitialAmount
    );

    buidlerHEZ = await TokenERC777Mock.deploy(
      await owner.getAddress(),
      tokenInitialAmount,
      "tokenname",
      "TKN",
      []
    );

    let buidlerVerifierRollupHelper = await VerifierRollupHelper.deploy();
    let buidlerVerifierWithdrawHelper = await VerifierWithdrawHelper.deploy();
    buidlerHermezAuctionTest = await HermezAuctionTest.deploy();

    // deploy hermez
    buidlerHermez = await Hermez.deploy();
    await buidlerHermez.deployed();

    buidlerWithdrawalDelayer = await WithdrawalDelayer.deploy(
      0,
      buidlerHermez.address,
      hermezGovernanceDAOAddress,
      hermezGovernanceDAOAddress,
      hermezGovernanceDAOAddress
    );

    await buidlerHermez.initializeHermez(
      [buidlerVerifierRollupHelper.address],
      [calculateInputMaxTxLevels(maxTx, nLevels)],
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
          ceilUSD,
          withdrawals,
          blockWithdrawalRate,
          maxWithdrawals,
        ]);
      }

      await buidlerHermez.connect(governance).updateBucketsParameters(buckets);

      for (let i = 0; i < numBuckets; i++) {
        let bucket = await buidlerHermez.buckets(i);
        expect(bucket.ceilUSD).to.be.equal(buckets[i][0]);
        expect(bucket.blockWithdrawalRate).to.be.equal(buckets[i][2]);
        expect(bucket.maxWithdrawals).to.be.equal(buckets[i][3]);
      }
    });

    it("test instant withdraw with buckets", async function () {
      const numBuckets = 5;
      const tokenAddress = buidlerTokenERC20Mock.address;

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

      await buidlerHermez.connect(governance).updateBucketsParameters(buckets);

      for (let i = 0; i < numBuckets; i++) {
        let bucket = await buidlerHermez.buckets(i);
        expect(bucket.ceilUSD).to.be.equal(buckets[i][0]);
        expect(bucket.blockWithdrawalRate).to.be.equal(buckets[i][2]);
        expect(bucket.maxWithdrawals).to.be.equal(buckets[i][3]);
      }

      for (let i = 0; i < numBuckets; i++) {
        const ceilUSD = (i + 1) * 1000;
        expect(await buidlerHermez.findBucketIdxTest(ceilUSD)).to.equal(i);
      }

      await expect(buidlerHermez.findBucketIdxTest(6000)).to.be.revertedWith(
        "exceed max amount"
      );

      // add withdrawals and price
      await AddToken(
        buidlerHermez,
        buidlerTokenERC20Mock,
        buidlerHEZ,
        await owner.getAddress(),
        feeAddToken
      );
      const addressArray = [buidlerTokenERC20Mock.address];
      const tokenPrice = 10; //USD
      const valueArray = [tokenPrice * 1e14];
      await buidlerHermez
        .connect(governance)
        .updateTokenExchange(addressArray, valueArray);

      expect(
        await buidlerHermez.tokenExchange(buidlerTokenERC20Mock.address)
      ).to.equal(valueArray[0]);

      const tokenAmount = 10; // base unit
      const tokenAmountDecimals = ethers.utils.parseEther(
        tokenAmount.toString()
      ); // 18 decimals
      const resultUSD = tokenPrice * tokenAmount;
      const bucketIdx = 0;
      expect(
        await buidlerHermez.token2USDTest(tokenAddress, tokenAmountDecimals)
      ).to.equal(resultUSD);
      expect(await buidlerHermez.findBucketIdxTest(resultUSD)).to.equal(
        bucketIdx
      );

      // test instat withdrawal and bucket recharge

      // reset buckets
      await buidlerHermez.connect(governance).updateBucketsParameters(buckets);

      await expect(
        buidlerHermez.instantWithdrawalTest(tokenAddress, tokenAmountDecimals)
      ).to.be.revertedWith("instant withdrawals wasted for this USD range");

      let bucketSC = await buidlerHermez.buckets(bucketIdx);
      expect(bucketSC.withdrawals).to.be.equal(0);
      const initialTimestamp = parseInt(bucketSC.blockStamp);

      const tokenRate = buckets[bucketIdx][2];

      // 0 withdrawals
      await time.advanceBlockTo(initialTimestamp + tokenRate * 2 - 1);

      // 2 withdrawals
      await buidlerHermez.updateBucketTest(bucketIdx);
      bucketSC = await buidlerHermez.buckets(bucketIdx);

      expect(bucketSC.withdrawals).to.be.equal(2);
      expect(bucketSC.blockStamp).to.be.equal(initialTimestamp + tokenRate * 2);

      await time.advanceBlockTo(initialTimestamp + tokenRate * 5 - 1);

      await buidlerHermez.updateBucketTest(bucketIdx);
      bucketSC = await buidlerHermez.buckets(bucketIdx);

      expect(bucketSC.withdrawals).to.be.equal(5);
      expect(bucketSC.blockStamp).to.be.equal(initialTimestamp + tokenRate * 5);

      await buidlerHermez.instantWithdrawalTest(
        tokenAddress,
        tokenAmountDecimals
      );
      bucketSC = await buidlerHermez.buckets(bucketIdx);
      expect(bucketSC.withdrawals).to.be.equal(4);
    });

    it("test instant withdraw with buckets full", async function () {
      const numBuckets = 5;
      const tokenAddress = buidlerTokenERC20Mock.address;

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

      await buidlerHermez.connect(governance).updateBucketsParameters(buckets);

      for (let i = 0; i < numBuckets; i++) {
        let bucket = await buidlerHermez.buckets(i);
        expect(bucket.ceilUSD).to.be.equal(buckets[i][0]);
        expect(bucket.blockWithdrawalRate).to.be.equal(buckets[i][2]);
        expect(bucket.maxWithdrawals).to.be.equal(buckets[i][3]);
      }

      // withdraw can be performed, because token has no value in rollup
      expect(
        await buidlerHermez.instantWithdrawalViewer(tokenAddress, 1e15)
      ).to.be.equal(true);

      // add withdrawals and price
      await AddToken(
        buidlerHermez,
        buidlerTokenERC20Mock,
        buidlerHEZ,
        await owner.getAddress(),
        feeAddToken
      );
      const addressArray = [buidlerTokenERC20Mock.address];
      const tokenPrice = 10;
      const valueArray = [tokenPrice * 1e14];
      await buidlerHermez
        .connect(governance)
        .updateTokenExchange(addressArray, valueArray);

      expect(
        await buidlerHermez.tokenExchange(buidlerTokenERC20Mock.address)
      ).to.equal(valueArray[0]);

      const tokenAmount = 10;
      const resultUSD = tokenPrice * tokenAmount;
      const tokenAmountDecimals = ethers.utils.parseEther(
        tokenAmount.toString()
      ); // 18 decimals
      const bucketIdx = 0;

      expect(
        await buidlerHermez.token2USDTest(tokenAddress, tokenAmountDecimals)
      ).to.equal(resultUSD);
      expect(await buidlerHermez.findBucketIdxTest(resultUSD)).to.equal(
        bucketIdx
      );

      // no withdrawals yet
      expect(
        await buidlerHermez.instantWithdrawalViewer(
          tokenAddress,
          tokenAmountDecimals
        )
      ).to.be.equal(false);

      // test instat withdrawal and bucket recharge

      // reset buckets
      await buidlerHermez.connect(governance).updateBucketsParameters(buckets);

      await expect(
        buidlerHermez.instantWithdrawalTest(tokenAddress, tokenAmountDecimals)
      ).to.be.revertedWith("instant withdrawals wasted for this USD range");

      let bucketSC = await buidlerHermez.buckets(bucketIdx);
      expect(bucketSC.withdrawals).to.be.equal(0);
      const initialTimestamp = parseInt(bucketSC.blockStamp);
      const tokenRate = buckets[bucketIdx][2];

      // 0 withdrawals
      expect(
        await buidlerHermez.instantWithdrawalViewer(
          tokenAddress,
          tokenAmountDecimals
        )
      ).to.be.equal(false);

      // still 0 withdrawals
      await time.advanceBlockTo(initialTimestamp + tokenRate - 1);
      expect(
        await buidlerHermez.instantWithdrawalViewer(
          tokenAddress,
          tokenAmountDecimals
        )
      ).to.be.equal(false);

      await time.advanceBlockTo(initialTimestamp + tokenRate * 2 - 1);
      expect(
        await buidlerHermez.instantWithdrawalViewer(
          tokenAddress,
          tokenAmountDecimals
        )
      ).to.be.equal(true);

      // 2 withdrawals
      await buidlerHermez.updateBucketTest(bucketIdx);
      bucketSC = await buidlerHermez.buckets(bucketIdx);

      expect(bucketSC.withdrawals).to.be.equal(2);
      expect(bucketSC.blockStamp).to.be.equal(initialTimestamp + tokenRate * 2);

      await time.advanceBlockTo(initialTimestamp + tokenRate * 5 - 1);

      await buidlerHermez.updateBucketTest(bucketIdx);
      bucketSC = await buidlerHermez.buckets(bucketIdx);

      // max withdawals = 4
      expect(bucketSC.withdrawals).to.be.equal(4);
      expect(bucketSC.blockStamp).to.be.equal(initialTimestamp + tokenRate * 5);

      // withdraw could be performed
      expect(
        await buidlerHermez.instantWithdrawalViewer(
          tokenAddress,
          tokenAmountDecimals
        )
      ).to.be.equal(true);
      // withdraw
      await buidlerHermez.instantWithdrawalTest(
        tokenAddress,
        tokenAmountDecimals
      );
      const lastBlock = await time.latestBlock();

      // still tokens for withdraw
      expect(
        await buidlerHermez.instantWithdrawalViewer(
          tokenAddress,
          tokenAmountDecimals
        )
      ).to.be.equal(true);

      bucketSC = await buidlerHermez.buckets(bucketIdx);
      expect(bucketSC.withdrawals).to.be.equal(3);
      // if withdrawals = maxWithdrawals, blockstamp is updated when withdraw
      expect(bucketSC.blockStamp).to.be.equal(lastBlock.toNumber());
    });

    it("update WithdrawalDelay", async function () {
      const newWithdrawalDelay = 100000;

      expect(await buidlerHermez.withdrawalDelay()).to.equal(
        60 * 60 * 24 * 7 * 2 // 2 weeks
      );

      await buidlerHermez
        .connect(governance)
        .updateWithdrawalDelay(newWithdrawalDelay);
      expect(await buidlerHermez.withdrawalDelay()).to.equal(
        newWithdrawalDelay
      );
    });

    it("update WithdrawalDelay", async function () {
      await expect(buidlerHermez.safeMode()).to.be.revertedWith(
        "Only safe bot or goverance"
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

      await buidlerHermez.connect(governance).updateBucketsParameters(buckets);

      for (let i = 0; i < numBuckets; i++) {
        let bucket = await buidlerHermez.buckets(i);
        expect(bucket.ceilUSD).to.be.equal(buckets[i][0]);
        expect(bucket.blockWithdrawalRate).to.be.equal(buckets[i][2]);
        expect(bucket.maxWithdrawals).to.be.equal(buckets[i][3]);
      }

      await buidlerHermez.connect(safetyAddress).safeMode();

      for (let i = 0; i < numBuckets; i++) {
        let bucket = await buidlerHermez.buckets(i);
        expect(bucket.ceilUSD).to.be.equal(0);
        expect(bucket.blockWithdrawalRate).to.be.equal(0);
        expect(bucket.maxWithdrawals).to.be.equal(0);
      }
    });
  });
});
