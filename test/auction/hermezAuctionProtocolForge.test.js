const {
  ethers
} = require("@nomiclabs/buidler");
const {
  expect
} = require("chai");

const {
  time
} = require("@openzeppelin/test-helpers");
const {
  BigNumber
} = require("ethers");

const COORDINATOR_1_URL = "https://hermez.io";

const BLOCKS_PER_SLOT = 40;
const TIMEOUT = 30000;
const MIN_BLOCKS = 81;


let ABIbid = [
  "function bid(uint128 slot, uint128 bidAmount)",
  "function multiBid(uint128 startingSlot,uint128 endingSlot,bool[6] slotEpoch,uint128 maxBid,uint128 minBid)",
];
let iface = new ethers.utils.Interface(ABIbid);

describe("Auction Protocol", function() {
  this.timeout(40000);

  let buidlerHEZToken;
  let buidlerHermezAuctionProtocol;
  let owner,
    coordinator1,
    forger1,
    coordinator2,
    forger2,
    registryFunder,
    hermezRollup,
    bootCoordinator,
    governance;
  let bootCoordinatorAddress,
    governanceAddress,
    hermezRollupAddress,
    donationAddress;

  // Deploy
  before(async function() {
    const HEZToken = await ethers.getContractFactory("HEZTokenMockFake");

    [
      owner,
      coordinator1,
      forger1,
      coordinator2,
      producer2,
      registryFunder,
      hermezRollup,
      governance,
      donation,
      bootCoordinator,
      ...addrs
    ] = await ethers.getSigners();

    bootCoordinatorAddress = await bootCoordinator.getAddress();
    governanceAddress = await governance.getAddress();
    hermezRollupAddress = await hermezRollup.getAddress();
    donationAddress = await donation.getAddress();
    coordinator1Address = await coordinator1.getAddress();

    buidlerHEZToken = await HEZToken.deploy(await owner.getAddress());

    await buidlerHEZToken.deployed();
    // Send tokens to coordinators addresses
    await buidlerHEZToken
      .connect(owner)
      .transfer(
        await coordinator1.getAddress(),
        ethers.utils.parseEther("10000000")
      );

    await buidlerHEZToken
      .connect(owner)
      .transfer(
        await coordinator2.getAddress(),
        ethers.utils.parseEther("10000000")
      );
  });

  beforeEach(async function() {
    const HermezAuctionProtocol = await ethers.getContractFactory(
      "HermezAuctionProtocol"
    );

    // To deploy our contract, we just have to call Token.deploy() and await
    // for it to be deployed(), which happens onces its transaction has been
    // mined.
    buidlerHermezAuctionProtocol = await HermezAuctionProtocol.deploy();
    await buidlerHermezAuctionProtocol.deployed();

    let current = await time.latestBlock();
    time.advanceBlock();
    let latest = (await time.latestBlock()).toNumber();
    while (current >= latest) {
      sleep(100);
      latest = (await time.latestBlock()).toNumber();
    }

    await buidlerHermezAuctionProtocol.hermezAuctionProtocolInitializer(
      buidlerHEZToken.address,
      latest + MIN_BLOCKS,
      hermezRollupAddress,
      governanceAddress,
      donationAddress,
      bootCoordinatorAddress
    );
  });

  describe("Forge process", function() {
    beforeEach(async function() {
      // Register Coordinator
      await buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .setCoordinator(await forger1.getAddress(), COORDINATOR_1_URL);
      await buidlerHEZToken.connect(coordinator1).approve(buidlerHermezAuctionProtocol.address,ethers.BigNumber.from("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"));

    });

    it("shouldn't be able to forge before the auction starts", async function() {
      let genesis = await buidlerHermezAuctionProtocol.genesisBlock();
      await expect(
        buidlerHermezAuctionProtocol.canForge(
          bootCoordinatorAddress,
          genesis.sub(1)
        )
      ).to.be.revertedWith("HermezAuctionProtocol::canForge AUCTION_NOT_STARTED");
    });

    it("shouldn't be able to forge a block higher than 2^128", async function() {
      await expect(
        buidlerHermezAuctionProtocol.canForge(
          bootCoordinatorAddress,
          ethers.BigNumber.from("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")
        )
      ).to.be.revertedWith("HermezAuctionProtocol::canForge WRONG_BLOCKNUMBER");
    });

    it("bootCoordinator should be able to forge (no biddings)", async function() {
      let startingBlock = await buidlerHermezAuctionProtocol.genesisBlock();
      expect(
        await buidlerHermezAuctionProtocol.canForge(
          bootCoordinatorAddress,
          startingBlock
        )
      ).to.be.equal(true);
    });

    it("Anyone should be able to forge if slotDeadline exceeded", async function() {
      let startingBlock = await buidlerHermezAuctionProtocol.genesisBlock();
      expect(
        await buidlerHermezAuctionProtocol.canForge(
          governanceAddress,
          startingBlock.toNumber() + 20
        )
      ).to.be.equal(true);
    });

    it("The winner should be able to forge", async function() {
      let startingBlock = await buidlerHermezAuctionProtocol.genesisBlock();
      let amount = ethers.utils.parseEther("100");
      let bid = ethers.utils.parseEther("11");
      let slotMin = 2;
      let slotMax = 7;
      let permit = ethers.utils.toUtf8Bytes("");
      let slotSet = [true, true, true, true, true, true];

      await 
      buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .processMultiBid(amount,slotMin,slotMax,slotSet,bid,bid,permit);

      let block = startingBlock.add(3 * 40);
      // Check forger address
      expect(
        await buidlerHermezAuctionProtocol.canForge(
          await forger1.getAddress(),
          block
        )
      ).to.be.equal(true);
      expect(
        await buidlerHermezAuctionProtocol.canForge(
          bootCoordinatorAddress,
          block
        )
      ).to.be.equal(false);
    });

    it("bootCoordinator should be able to forge if bidAmount less than minBid", async function() {
      let startingBlock = await buidlerHermezAuctionProtocol.genesisBlock();
      let amount = ethers.utils.parseEther("100");
      let bid = ethers.utils.parseEther("11");
      let slotMin = 2;
      let slotMax = 7;
      let permit = ethers.utils.toUtf8Bytes("");
      let slotSet = [true, true, true, true, true, true];

      await 
      buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .processMultiBid(amount,slotMin,slotMax,slotSet,bid,bid,permit);

      for (i = 0; i < 6; i++) {
        // Change epochs minBid
        await buidlerHermezAuctionProtocol
          .connect(governance)
          .changeDefaultSlotSetBid(i, ethers.utils.parseEther("123456789"));
      }

      // Check forger address
      expect(
        await buidlerHermezAuctionProtocol.canForge(
          governanceAddress,
          startingBlock.add(3 * 40)
        )
      ).to.be.equal(false);
      expect(
        await buidlerHermezAuctionProtocol.canForge(
          bootCoordinatorAddress,
          startingBlock.add(3 * 40)
        )
      ).to.be.equal(true);

      // Advance blocks
      let blockNumber = startingBlock.add(3 * 40).toNumber();
      time.advanceBlockTo(blockNumber);
      while (blockNumber > (await time.latestBlock()).toNumber()) {
        sleep(100);
      }

      let forgerAddress = await coordinator1.getAddress();
      let prevBalance = await buidlerHermezAuctionProtocol.getClaimableHEZ(
        forgerAddress
      );
      // BootCoordinator forge
      await buidlerHermezAuctionProtocol
        .connect(hermezRollup)
        .forge(bootCoordinatorAddress);

      let postBalance = await buidlerHermezAuctionProtocol.getClaimableHEZ(
        forgerAddress
      );
      // Check forgerAddress balances
      expect(postBalance).to.be.equal(
        prevBalance.add(ethers.utils.parseEther("11"))
      );
      expect(prevBalance.add(ethers.utils.parseEther("11"))).to.be.equal(
        postBalance
      );
    });

    it("should burn the HEZ tokens if it's no able to return them", async function() {
      let startingBlock = await buidlerHermezAuctionProtocol.genesisBlock();
      let amount = ethers.utils.parseEther("100");
      let bid = ethers.utils.parseEther("11");
      let slotMin = 2;
      let slotMax = 7;
      let permit = ethers.utils.toUtf8Bytes("");
      let slotSet = [true, true, true, true, true, true];

      await 
      buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .processMultiBid(amount,slotMin,slotMax,slotSet,bid,bid,permit);

      for (i = 0; i < 6; i++) {
        // Change epochs minBid
        await buidlerHermezAuctionProtocol
          .connect(governance)
          .changeDefaultSlotSetBid(i, ethers.utils.parseEther("123456789"));
      }
      // Advance Blocks
      let blockNumber = startingBlock.add(3 * 40).toNumber();
      time.advanceBlockTo(blockNumber);
      while (blockNumber > (await time.latestBlock()).toNumber()) {
        sleep(100);
      }
      // Check forger balances
      await buidlerHEZToken.connect(coordinator1).setTransferRevert(true);
      let forgerAddress = await coordinator1.getAddress();
      let prevBalance = await buidlerHEZToken.balanceOf(forgerAddress);
      await buidlerHermezAuctionProtocol
        .connect(hermezRollup)
        .forge(bootCoordinatorAddress);
      let currentBalance = await buidlerHEZToken.balanceOf(forgerAddress);
      expect(prevBalance).to.be.equal(currentBalance);
      await buidlerHEZToken.connect(coordinator1).setTransferRevert(false);
    });

    it("shouldn't be able to forge unless it's called by Hermez rollup", async function() {
      await expect(
        buidlerHermezAuctionProtocol
          .connect(bootCoordinator)
          .forge(bootCoordinatorAddress)
      ).to.be.revertedWith("HermezAuctionProtocol::forge: ONLY_HERMEZ_ROLLUP");
    });

    it("shouldn't be able to forge unless it's the bootcoordinator or the winner", async function() {
      // Advance Blocks
      let startingBlock = await buidlerHermezAuctionProtocol.genesisBlock();
      let blockNumber = startingBlock.add(3 * 40).toNumber();
      time.advanceBlockTo(blockNumber);
      while (blockNumber > (await time.latestBlock()).toNumber()) {
        sleep(100);
      }
      // Check that governance HermezAuctionProtocol::forge: CANNOT_FORGE
      await expect(
        buidlerHermezAuctionProtocol
          .connect(hermezRollup)
          .forge(governanceAddress)
      ).to.be.revertedWith("HermezAuctionProtocol::forge: CANNOT_FORGE");
    });

    it("should be able to forge (bootCoordinator)", async function() {
      let startingBlock = await buidlerHermezAuctionProtocol.genesisBlock();
      // Event NewForge
      let eventNewForge = new Promise((resolve, reject) => {
        filter = buidlerHermezAuctionProtocol.filters.NewForge();
        buidlerHermezAuctionProtocol.on(filter, (forger, slotToForge) => {
          expect(forger).to.be.equal(bootCoordinatorAddress);
          buidlerHermezAuctionProtocol.removeAllListeners();
          resolve();
        });

        // After 10s, we throw a timeout error
        setTimeout(() => {
          reject(new Error("timeout while waiting for event"));
        }, TIMEOUT);
      });
      // Advance blocks
      let blockNumber = startingBlock.add(3 * 40).toNumber();
      time.advanceBlockTo(blockNumber);
      while (blockNumber > (await time.latestBlock()).toNumber()) {
        sleep(100);
      }
      // Forge
      buidlerHermezAuctionProtocol
        .connect(hermezRollup)
        .forge(bootCoordinatorAddress);
      await eventNewForge;
    });

    it("Winner should be able to forge", async function() {
      let producer1Address = await forger1.getAddress();
      let bidAmount = ethers.utils.parseEther("11");
      // Event NewForgeAllocated
      let eventNewForgeAllocated = new Promise((resolve, reject) => {
        filter = buidlerHermezAuctionProtocol.filters.NewForgeAllocated();
        buidlerHermezAuctionProtocol.on(
          filter,
          (
            bidder,
            forger,
            slotToForge,
            burnAmount,
            donationAmount,
            governanceAmount
          ) => {
            expect(forger).to.be.equal(producer1Address);
            expect(burnAmount).to.be.equal(bidAmount.mul(40).div(100));
            expect(donationAmount).to.be.equal(bidAmount.mul(40).div(100));
            expect(governanceAmount).to.be.equal(bidAmount.mul(20).div(100));
            buidlerHermezAuctionProtocol.removeAllListeners();
            resolve();
          }
        );

        // After 10s, we throw a timeout error
        setTimeout(() => {
          reject(new Error("timeout while waiting for event"));
        }, TIMEOUT);
      });

      let startingBlock = await buidlerHermezAuctionProtocol.genesisBlock();

      let amount = ethers.utils.parseEther("100");
      let bid = ethers.utils.parseEther("11");
      let slotMin = 2;
      let slotMax = 7;
      let permit = ethers.utils.toUtf8Bytes("");
      let slotSet = [true, true, true, true, true, true];

      await 
      buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .processMultiBid(amount,slotMin,slotMax,slotSet,bid,bid,permit);

      // Advance blocks
      let blockNumber = startingBlock.add(3 * 40).toNumber();
      time.advanceBlockTo(blockNumber);
      while (blockNumber > (await time.latestBlock()).toNumber()) {
        sleep(100);
      }
      // Winner forge
      await buidlerHermezAuctionProtocol
        .connect(hermezRollup)
        .forge(producer1Address);
      await buidlerHermezAuctionProtocol
        .connect(hermezRollup)
        .forge(producer1Address);
      await buidlerHermezAuctionProtocol
        .connect(hermezRollup)
        .forge(producer1Address);
      await eventNewForgeAllocated;
    });

    it("shouldn't be able to claim HEZ if NOT_ENOUGH_BALANCE", async function() {
      await expect(
        buidlerHermezAuctionProtocol.connect(donation).claimHEZ()
      ).to.be.revertedWith("HermezAuctionProtocol::claimHEZ: NOT_ENOUGH_BALANCE");
    });

    it("should be able to claim HEZ", async function() {
      let producer1Address = await forger1.getAddress();
      let bidAmount = ethers.utils.parseEther("11");
      // Event HEZClaimed
      let eventHEZClaimed = new Promise((resolve, reject) => {
        filter = buidlerHermezAuctionProtocol.filters.HEZClaimed();
        buidlerHermezAuctionProtocol.on(filter, (owner, amount) => {
          if (owner == governanceAddress) {
            expect(amount).to.be.equal(bidAmount.mul(3).mul(20).div(100));
          } else {
            expect(amount).to.be.equal(bidAmount.mul(3).mul(40).div(100));
          }
          buidlerHermezAuctionProtocol.removeAllListeners();
          resolve();
        });

        // After 10s, we throw a timeout error
        setTimeout(() => {
          reject(new Error("timeout while waiting for event"));
        }, TIMEOUT);
      });

      let startingBlock = await buidlerHermezAuctionProtocol.genesisBlock();


      let amount = ethers.utils.parseEther("100");
      let bid = ethers.utils.parseEther("11");
      let slotMin = 2;
      let slotMax = 7;
      let permit = ethers.utils.toUtf8Bytes("");
      let slotSet = [true, true, true, true, true, true];

      await 
      buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .processMultiBid(amount,slotMin,slotMax,slotSet,bid,bid,permit);

      for (let slot = 3; slot < 6; slot++) {
        // Advance blocks
        let firstBlock = startingBlock.add(slot * BLOCKS_PER_SLOT).toNumber();
        time.advanceBlockTo(firstBlock);
        while (firstBlock > (await time.latestBlock()).toNumber()) {
          sleep(100);
        }
        // Forge
        await buidlerHermezAuctionProtocol
          .connect(hermezRollup)
          .forge(producer1Address);
      }
      // Check balances
      expect(await buidlerHEZToken.balanceOf(governanceAddress)).to.be.equal(0);
      expect(
        await buidlerHermezAuctionProtocol.getClaimableHEZ(governanceAddress)
      ).to.be.equal(bidAmount.mul(3).mul(20).div(100));
      await buidlerHermezAuctionProtocol.connect(governance).claimHEZ();
      expect(
        await buidlerHermezAuctionProtocol.getClaimableHEZ(governanceAddress)
      ).to.be.equal(0);
      expect(await buidlerHEZToken.balanceOf(governanceAddress)).to.be.equal(
        bidAmount.mul(3).mul(20).div(100)
      );

      expect(await buidlerHEZToken.balanceOf(donationAddress)).to.be.equal(0);
      expect(
        await buidlerHermezAuctionProtocol.getClaimableHEZ(donationAddress)
      ).to.be.equal(bidAmount.mul(3).mul(40).div(100));
      await buidlerHermezAuctionProtocol.connect(donation).claimHEZ();
      expect(
        await buidlerHermezAuctionProtocol.getClaimableHEZ(donationAddress)
      ).to.be.equal(0);
      expect(await buidlerHEZToken.balanceOf(donationAddress)).to.be.equal(
        bidAmount.mul(3).mul(40).div(100)
      );

      await eventHEZClaimed;
    });

    it("should revert when claim HEZ and it revert", async function() {
      let producer1Address = await forger1.getAddress();
      let bidAmount = ethers.utils.parseEther("11");
      let startingBlock = await buidlerHermezAuctionProtocol.genesisBlock();

      let amount = ethers.utils.parseEther("100");
      let bid = ethers.utils.parseEther("11");
      let slotMin = 2;
      let slotMax = 7;
      let permit = ethers.utils.toUtf8Bytes("");
      let slotSet = [true, true, true, true, true, true];

      await 
      buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .processMultiBid(amount,slotMin,slotMax,slotSet,bid,bid,permit);

      for (let slot = 3; slot < 6; slot++) {
        // Advance blocks
        let firstBlock = startingBlock.add(slot * BLOCKS_PER_SLOT).toNumber();
        time.advanceBlockTo(firstBlock);
        while (firstBlock > (await time.latestBlock()).toNumber()) {
          sleep(100);
        }
        // Forge
        await buidlerHermezAuctionProtocol
          .connect(hermezRollup)
          .forge(producer1Address);
      }
    });
  });
});

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}