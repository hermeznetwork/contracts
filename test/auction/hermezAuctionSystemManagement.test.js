const {
  ethers
} = require("hardhat");
const {
  expect
} = require("chai");

const {
  time
} = require("@openzeppelin/test-helpers");

const TIMEOUT = 40000;
const MIN_BLOCKS = 81;

const bootCoordinatorURL = "https://boot.coordinator.io";

describe("Auction Protocol Management", function() {
  this.timeout(40000);

  let hardhatHEZToken;
  let hardhatHermezAuctionProtocol;
  let owner,
    coordinator1,
    producer1,
    coordinator2,
    producer2,
    registryFunder,
    hermezRollup,
    bootCoordinator,
    governance;

  let governanceAddress,
    hermezRollupAddress,
    donationAddress;

  // Deploy
  before(async function() {
    const HEZToken = await ethers.getContractFactory("HEZTokenMockFake");

    [
      owner,
      coordinator1,
      producer1,
      coordinator2,
      producer2,
      registryFunder,
      hermezRollup,
      governance,
      donation,
      bootCoordinator,
      ...addrs
    ] = await ethers.getSigners();

    governanceAddress = await governance.getAddress();
    bootCoordinator = await governance.getAddress();
    hermezRollupAddress = await hermezRollup.getAddress();
    donationAddress = await donation.getAddress();
    coordinator1Address = await coordinator1.getAddress();

    hardhatHEZToken = await HEZToken.deploy(await owner.getAddress());
    await hardhatHEZToken.deployed();
    // Send tokens to coordinators addresses

    await hardhatHEZToken
      .connect(owner)
      .transfer(
        await coordinator1.getAddress(),
        ethers.utils.parseEther("10000")
      );

    await hardhatHEZToken
      .connect(owner)
      .transfer(
        await coordinator2.getAddress(),
        ethers.utils.parseEther("10000")
      );
  });

  beforeEach(async function() {
    const HermezAuctionProtocol = await ethers.getContractFactory(
      "HermezAuctionProtocol"
    );

    // To deploy our contract, we just have to call Token.deploy() and await
    // for it to be deployed(), which happens onces its transaction has been
    // mined.
    hardhatHermezAuctionProtocol = await HermezAuctionProtocol.deploy();
    await hardhatHermezAuctionProtocol.deployed();

    let current = await time.latestBlock();
    time.advanceBlock();
    let latest = (await time.latestBlock()).toNumber();
    while (current >= latest) {
      sleep(100);
      latest = (await time.latestBlock()).toNumber();
    }


    await hardhatHermezAuctionProtocol.hermezAuctionProtocolInitializer(
      hardhatHEZToken.address,
      latest + MIN_BLOCKS,
      hermezRollupAddress,
      governanceAddress,
      donationAddress,
      bootCoordinator,
      bootCoordinatorURL
    );
  });

  describe("SlotDeadline", function() {
    it("Anyone shouldn't set a new slot deadline", async function() {
      await expect(
        hardhatHermezAuctionProtocol.setSlotDeadline(0)
      ).to.be.revertedWith("HermezAuctionProtocol::onlyGovernance: ONLY_GOVERNANCE");
    });
    it("should'n set a new slot deadline greater than the current BLOCKS_PER_SLOT", async function() {
      let blocks_per_slot = await hardhatHermezAuctionProtocol.BLOCKS_PER_SLOT();
      await expect(
        hardhatHermezAuctionProtocol
          .connect(governance)
          .setSlotDeadline(blocks_per_slot + 1)
      ).to.be.revertedWith("HermezAuctionProtocol::setSlotDeadline: GREATER_THAN_BLOCKS_PER_SLOT");
    });
    it("shoul be able to set a new slot deadline", async function() {
      let newSlotDeadline = 3;

      // NewSlotDeadline event
      let eventNewSlotDeadline = new Promise((resolve, reject) => {
        filter = hardhatHermezAuctionProtocol.filters.NewSlotDeadline();
        hardhatHermezAuctionProtocol.on(filter, async (_newSlotDeadline) => {
          expect(_newSlotDeadline).to.be.equal(newSlotDeadline);
          hardhatHermezAuctionProtocol.removeAllListeners();
          resolve();
        });
        // After 10s, we throw a timeout error
        setTimeout(() => {
          reject(new Error("timeout while waiting for event"));
        }, TIMEOUT);
      });

      // Set slot deadline
      await hardhatHermezAuctionProtocol
        .connect(governance)
        .setSlotDeadline(newSlotDeadline);
      await eventNewSlotDeadline;
      // Check new slot deadline
      expect(await hardhatHermezAuctionProtocol.getSlotDeadline()).to.be.equal(
        newSlotDeadline
      );
    });
  });

  describe("OpenAuctionSlots", function() {
    it("Anyone shouldn't set a new OpenAuctionSlots", async function() {
      await expect(
        hardhatHermezAuctionProtocol.setOpenAuctionSlots(0)
      ).to.be.revertedWith("HermezAuctionProtocol::onlyGovernance: ONLY_GOVERNANCE");
    });
    it("shoul be able to set a new OpenAuctionSlots", async function() {
      let newOpenAuctionSlots = 65535;

      // NewOpenAuctionSlots event
      let eventNewOpenAuctionSlots = new Promise((resolve, reject) => {
        filter = hardhatHermezAuctionProtocol.filters.NewOpenAuctionSlots();
        hardhatHermezAuctionProtocol.on(
          filter,
          async (_newOpenAuctionSlots) => {
            expect(_newOpenAuctionSlots).to.be.equal(newOpenAuctionSlots);
            hardhatHermezAuctionProtocol.removeAllListeners();
            resolve();
          }
        );
        // After 10s, we throw a timeout error
        setTimeout(() => {
          reject(new Error("timeout while waiting for event"));
        }, TIMEOUT);
      });

      // Set open auction slots
      await hardhatHermezAuctionProtocol
        .connect(governance)
        .setOpenAuctionSlots(newOpenAuctionSlots);
      await eventNewOpenAuctionSlots;
      // Check new open auction slots
      expect(
        await hardhatHermezAuctionProtocol.getOpenAuctionSlots()
      ).to.be.equal(newOpenAuctionSlots);
    });
  });

  describe("ClosedAuctionSlots", function() {
    it("Anyone shouldn't set a new ClosedAuctionSlots", async function() {
      await expect(
        hardhatHermezAuctionProtocol.setClosedAuctionSlots(0)
      ).to.be.revertedWith("HermezAuctionProtocol::onlyGovernance: ONLY_GOVERNANCE");
    });
    it("shoul be able to set a new ClosedAuctionSlots", async function() {
      let newClosedAuctionSlots = 4;

      // NewClosedAuctionSlots event
      let eventClosedAuctionSlots = new Promise((resolve, reject) => {
        filter = hardhatHermezAuctionProtocol.filters.NewClosedAuctionSlots();
        hardhatHermezAuctionProtocol.on(
          filter,
          async (_newClosedAuctionSlots) => {
            expect(_newClosedAuctionSlots).to.be.equal(newClosedAuctionSlots);
            hardhatHermezAuctionProtocol.removeAllListeners();
            resolve();
          }
        );
        // After 10s, we throw a timeout error
        setTimeout(() => {
          reject(new Error("timeout while waiting for event"));
        }, TIMEOUT);
      });

      // Set closed auction slots
      await hardhatHermezAuctionProtocol
        .connect(governance)
        .setClosedAuctionSlots(newClosedAuctionSlots);
      await eventClosedAuctionSlots;
      // Check new closed auction slots
      expect(
        await hardhatHermezAuctionProtocol.getClosedAuctionSlots()
      ).to.be.equal(newClosedAuctionSlots);
    });
  });

  describe("Outbidding", function() {
    it("Anyone shouldn't set a new Outbidding", async function() {
      await expect(
        hardhatHermezAuctionProtocol.setOutbidding(0)
      ).to.be.revertedWith("HermezAuctionProtocol::onlyGovernance: ONLY_GOVERNANCE");
    });
    it("should be able to set a new Outbidding", async function() {
      let newOutbidding = 100;

      // NewOutbidding event
      let eventNewOutbidding = new Promise((resolve, reject) => {
        filter = hardhatHermezAuctionProtocol.filters.NewOutbidding();
        hardhatHermezAuctionProtocol.on(filter, async (_newOutbidding) => {
          expect(_newOutbidding).to.be.equal(newOutbidding);
          hardhatHermezAuctionProtocol.removeAllListeners();
          resolve();
        });
        // After 10s, we throw a timeout error
        setTimeout(() => {
          reject(new Error("timeout while waiting for event"));
        }, TIMEOUT);
      });

      await expect(hardhatHermezAuctionProtocol
        .connect(governance)
        .setOutbidding(0)
      ).to.be.revertedWith("HermezAuctionProtocol::setOutbidding: OUTBIDDING_NOT_VALID");
      await expect(hardhatHermezAuctionProtocol
        .connect(governance)
        .setOutbidding(10001)
      ).to.be.revertedWith("HermezAuctionProtocol::setOutbidding: OUTBIDDING_NOT_VALID");

      // Set outbidding
      await hardhatHermezAuctionProtocol
        .connect(governance)
        .setOutbidding(newOutbidding);

      await eventNewOutbidding;
      // Check new outbidding
      expect(await hardhatHermezAuctionProtocol.getOutbidding()).to.be.equal(
        newOutbidding
      );
    });
  });

  describe("AllocationRatio", function() {
    it("Anyone shouldn't set a new AllocationRatio", async function() {
      await expect(
        hardhatHermezAuctionProtocol.setAllocationRatio([30, 30, 40])
      ).to.be.revertedWith("HermezAuctionProtocol::onlyGovernance: ONLY_GOVERNANCE");
    });
    it("shouldn't set an AllocationRatio whose sum is not 100%", async function() {
      await expect(
        hardhatHermezAuctionProtocol
          .connect(governance)
          .setAllocationRatio([1, 10, 1])
      ).to.be.revertedWith("HermezAuctionProtocol::setAllocationRatio: ALLOCATION_RATIO_NOT_VALID");
      await expect(
        hardhatHermezAuctionProtocol
          .connect(governance)
          .setAllocationRatio([1, 10000, 65535])
      ).to.be.revertedWith("HermezAuctionProtocol::setAllocationRatio: ALLOCATION_RATIO_NOT_VALID");
      await expect(
        hardhatHermezAuctionProtocol
          .connect(governance)
          .setAllocationRatio([120, 120, 120])
      ).to.be.revertedWith("HermezAuctionProtocol::setAllocationRatio: ALLOCATION_RATIO_NOT_VALID");
    });
    it("should be able to set a new AllocationRatio", async function() {
      let newAllocationRatio = [5000, 5000, 0];

      // NewClosedAuctionSlots event
      let eventNewAllocationRatio = new Promise((resolve, reject) => {
        filter = hardhatHermezAuctionProtocol.filters.NewAllocationRatio();
        hardhatHermezAuctionProtocol.on(filter, async (_newAllocationRatio) => {
          expect(_newAllocationRatio[0]).to.be.equal(newAllocationRatio[0]);
          expect(_newAllocationRatio[1]).to.be.equal(newAllocationRatio[1]);
          expect(_newAllocationRatio[2]).to.be.equal(newAllocationRatio[2]);
          hardhatHermezAuctionProtocol.removeAllListeners();
          resolve();
        });
        // After 10s, we throw a timeout error
        setTimeout(() => {
          reject(new Error("timeout while waiting for event"));
        }, TIMEOUT);
      });

      // Set allocation ratio
      await hardhatHermezAuctionProtocol
        .connect(governance)
        .setAllocationRatio(newAllocationRatio);
      await eventNewAllocationRatio;
      // Check new allocation ratio
      let allocationRatio = await hardhatHermezAuctionProtocol.getAllocationRatio();
      expect(allocationRatio[0]).to.be.equal(newAllocationRatio[0]);
      expect(allocationRatio[1]).to.be.equal(newAllocationRatio[1]);
      expect(allocationRatio[2]).to.be.equal(newAllocationRatio[2]);
    });
  });

  describe("DonationAddress", function() {
    it("Anyone shouldn't set a new DonationAddress", async function() {
      await expect(
        hardhatHermezAuctionProtocol.setDonationAddress(
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith("HermezAuctionProtocol::onlyGovernance: ONLY_GOVERNANCE");
    });
    it("should be able to set a new DonationAddress", async function() {
      // It makes no sense to set the donation address to 0x0
      // You have the option to burn the tokens, this's just for testing
      let newDonationAddress = governanceAddress;

      // NewClosedAuctionSlots event
      let eventNewDonationAddress = new Promise((resolve, reject) => {
        filter = hardhatHermezAuctionProtocol.filters.NewDonationAddress();
        hardhatHermezAuctionProtocol.on(filter, async (_newDonationAddress) => {
          expect(_newDonationAddress).to.be.equal(newDonationAddress);
          hardhatHermezAuctionProtocol.removeAllListeners();
          resolve();
        });
        // After 10s, we throw a timeout error
        setTimeout(() => {
          reject(new Error("timeout while waiting for event"));
        }, TIMEOUT);
      });

      await expect(
        hardhatHermezAuctionProtocol
          .connect(governance)
          .setDonationAddress(ethers.constants.AddressZero))
        .to.be.revertedWith("HermezAuctionProtocol::setDonationAddress: NOT_VALID_ADDRESS");

      // Set donation address
      await hardhatHermezAuctionProtocol
        .connect(governance)
        .setDonationAddress(newDonationAddress);
      await eventNewDonationAddress;
      // Check new donation address
      expect(
        await hardhatHermezAuctionProtocol.getDonationAddress()
      ).to.be.equal(newDonationAddress);
    });
  });

  describe("BootCoordinator", function() {
    it("Anyone shouldn't set a new DonationAddress", async function() {
      await expect(
        hardhatHermezAuctionProtocol.setBootCoordinator(
          ethers.constants.AddressZero, "urlBootCoordinator"
        )
      ).to.be.revertedWith("HermezAuctionProtocol::onlyGovernance: ONLY_GOVERNANCE");
    });
    it("shoul be able to set a new BootCoordinator", async function() {
      // It makes no sense to set the donation address to 0x0
      // You have the option to burn the tokens, this's just for testing
      let newBootCoordinator = ethers.constants.AddressZero;

      // NewClosedAuctionSlots event
      let eventNewBootCoordinator = new Promise((resolve, reject) => {
        filter = hardhatHermezAuctionProtocol.filters.NewBootCoordinator();
        hardhatHermezAuctionProtocol.on(filter, async (_newBootCoordinator) => {
          expect(_newBootCoordinator).to.be.equal(newBootCoordinator);
          hardhatHermezAuctionProtocol.removeAllListeners();
          resolve();
        });
        // After 10s, we throw a timeout error
        setTimeout(() => {
          reject(new Error("timeout while waiting for event"));
        }, TIMEOUT);
      });

      // Set boot coordinator
      await hardhatHermezAuctionProtocol
        .connect(governance)
        .setBootCoordinator(newBootCoordinator, "urlBootCoordinator");
      await eventNewBootCoordinator;
      // Check new boot coordinator
      expect(
        await hardhatHermezAuctionProtocol.getBootCoordinator()
      ).to.be.equal(newBootCoordinator);
    });
  });
  describe("changeDefaultSlotSetBid", function() {
    it("Anyone shouldn't set a new changeDefaultSlotSetBid", async function() {
      await expect(
        hardhatHermezAuctionProtocol.changeDefaultSlotSetBid(0, 0)
      ).to.be.revertedWith("HermezAuctionProtocol::onlyGovernance: ONLY_GOVERNANCE");
    });

    it("should revert if an invalid slot set", async function() {
      await expect(
        hardhatHermezAuctionProtocol
          .connect(governance)
          .changeDefaultSlotSetBid(123, ethers.utils.parseEther("112"))
      ).to.be.revertedWith("HermezAuctionProtocol::changeDefaultSlotSetBid: NOT_VALID_SLOT_SET");
    });

    it("shouldn't be able to change a 0 min bid", async function() {
      for (i = 0; i < 6; i++) {
        // Change default slot set bid to 0
        await hardhatHermezAuctionProtocol
          .connect(governance)
          .changeDefaultSlotSetBid(i, 0);
      }
      for (i = 0; i < 6; i++) {
        // Check default slot set bid update
        expect(
          await hardhatHermezAuctionProtocol.getDefaultSlotSetBid(i)
        ).to.be.equal(0);
      }
      for (i = 0; i < 6; i++) {
        // Can't change minbid if previous minBid == 0
        await expect(
          hardhatHermezAuctionProtocol
            .connect(governance)
            .changeDefaultSlotSetBid(i, ethers.utils.parseEther("112"))
        ).to.be.revertedWith("HermezAuctionProtocol::changeDefaultSlotSetBid: SLOT_DECENTRALIZED");
      }
    });
  });
});

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}