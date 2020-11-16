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
  ecsign,
} = require("ethereumjs-util");

const {
  createPermitDigest
} = require("./helpers/erc2612.js");

const COORDINATOR_1_URL = "https://hermez.io";
const COORDINATOR_2_URL = "https://second.hermez.io";

const TIMEOUT = 40000;
const MIN_BLOCKS = 81;

let ABIbid = [
  "function bid(uint128 slot, uint128 bidAmount)",
  "function multiBid(uint128 startingSlot,uint128 endingSlot,bool[6] slotEpoch,uint128 maxBid,uint128 minBid)",
  "function permit(address,address,uint256,uint256,uint8,bytes32,bytes32)",
  "function permitFake(address,address,uint256,uint256,uint8,bytes32,bytes32)",
  "function processBid(uint128, uint128, uint128, bytes)"
];
let iface = new ethers.utils.Interface(ABIbid);

describe("Consensus Protocol Bidding", function() {
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
    donation,
    bootCoordinator,
    governance,
    erc2612Wallet;

  let governanceAddress, hermezRollupAddress, donationAddress;

  // Deploy
  before(async function() {
    const HEZToken = await ethers.getContractFactory("HEZTokenMockFake");

    [
      owner,
      coordinator1,
      forger1,
      coordinator2,
      forger2,
      registryFunder,
      hermezRollup,
      donation,
      bootCoordinator,
      governance,
      ...addrs
    ] = await ethers.getSigners();

    governanceAddress = await governance.getAddress();
    bootCoordinator = await governance.getAddress();
    hermezRollupAddress = await hermezRollup.getAddress();
    donationAddress = await donation.getAddress();
    coordinator1Address = await coordinator1.getAddress();

    buidlerHEZToken = await HEZToken.deploy(await owner.getAddress());
    await buidlerHEZToken.deployed();

    const chainIdProvider = (await ethers.provider.getNetwork()).chainId;
    if (chainIdProvider == 1337) { // solcover, must be a jsonRPC wallet
      const mnemonic = "explain tackle mirror kit van hammer degree position ginger unfair soup bonus";
      let erc2612WalletTest = ethers.Wallet.fromMnemonic(mnemonic);
      // erc2612WalletTest = erc2612Wallet.connect(ethers.provider);
      erc2612Wallet = owner;
      erc2612Wallet.privateKey = erc2612WalletTest.privateKey;
    }
    else {
      erc2612Wallet = new ethers.Wallet(ethers.provider._buidlerProvider._genesisAccounts[0].privateKey, ethers.provider);
    }

    // erc2612Wallet = new ethers.Wallet("0x0123456789012345678901234567890123456789012345678901234567890123",ethers.provider);

    await owner.sendTransaction({
      to: await erc2612Wallet.getAddress(),
      value: ethers.utils.parseEther("1"),
    });
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
      bootCoordinator
    );
    // Send tokens to coordinators addresses
    await buidlerHEZToken
      .connect(owner)
      .transfer(
        await coordinator1.getAddress(),
        ethers.utils.parseEther("100000")
      );

    await buidlerHEZToken
      .connect(owner)
      .transfer(
        await coordinator2.getAddress(),
        ethers.utils.parseEther("100000")
      );
    await buidlerHEZToken
      .connect(owner)
      .transfer(
        await erc2612Wallet.getAddress(),
        ethers.utils.parseEther("100000")
      );
  });

  describe("Call bid", function() {
    // Register Coordinator
    beforeEach(async function() {
      await buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .setCoordinator(await forger1.getAddress(), COORDINATOR_1_URL);
      await buidlerHermezAuctionProtocol
        .connect(coordinator2)
        .setCoordinator(await forger2.getAddress(), COORDINATOR_2_URL);

      await buidlerHEZToken.connect(coordinator1).approve(
        buidlerHermezAuctionProtocol.address,
        ethers.BigNumber.from("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"));
      await buidlerHEZToken.connect(coordinator2).approve(
        buidlerHermezAuctionProtocol.address,
        ethers.BigNumber.from("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"));
    });
    it("should revert if getMinBidBySlot for an already closed bid", async function() {
      // Try to consult the minBid of a slot with closed auction
      await expect(
        buidlerHermezAuctionProtocol.getMinBidBySlot(0)
      ).to.be.revertedWith("HermezAuctionProtocol::getMinBidBySlot: AUCTION_CLOSED");
    });

    it("should revert when the coordinator is not registered", async function() {
      let amount = ethers.utils.parseEther("11");
      let slot = 2;
      let permit = ethers.utils.toUtf8Bytes("");
      // Try to send a bid with an unregistered coordinator address
      await expect(
        buidlerHermezAuctionProtocol
          .connect(owner)
          .processBid(amount, slot, amount, permit)
      ).to.be.revertedWith("HermezAuctionProtocol::processBid: COORDINATOR_NOT_REGISTERED");
    });
    it("should call bid 11HEZ@2 ", async function() {
      let amount = ethers.utils.parseEther("11");
      let slot = 2;
      let permit = ethers.utils.toUtf8Bytes("");

      await expect(
        buidlerHermezAuctionProtocol
          .connect(coordinator1)
          .processBid(amount, slot, amount, permit)
      ).to.be.revertedWith("HermezAuctionProtocol::processBid: AUCTION_CLOSED");
    });

    it("should be higher than the previous bid", async function() {
      await buidlerHermezAuctionProtocol
        .connect(governance)
        .setOutbidding(2);

      // test for values <10000
      for (i = 0; i < 6; i++) {
        // Change minBids
        await buidlerHermezAuctionProtocol
          .connect(governance)
          .changeDefaultSlotSetBid(i, 0);
      }
        
      let amount = 1000;
      let slot = 3;
      let permit = ethers.utils.toUtf8Bytes("");

      await buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .processBid(amount, slot, amount, permit);

      await expect(
        buidlerHermezAuctionProtocol
          .connect(coordinator1)
          .processBid(amount, slot, amount, permit)
      ).to.be.revertedWith("HermezAuctionProtocol::_doBid: BID_MUST_BE_HIGHER");
    });

    it("should call bid 11HEZ@3 ", async function() {
      let amount = ethers.utils.parseEther("11");
      let slot = 3;
      let permit = ethers.utils.toUtf8Bytes("");

      await expect(
        buidlerHermezAuctionProtocol
          .connect(coordinator1)
          .processBid(amount, slot, amount, permit)
      ).to.emit(buidlerHermezAuctionProtocol, "NewBid")
        .withArgs(slot, amount, coordinator1Address);
    });

    it("should call multiBid 11HEZ@5-10 ", async function() {
      let amount = ethers.utils.parseEther("10000");
      let bid = ethers.utils.parseEther("11");
      let slotMin = 5;
      let slotMax = 10;
      let permit = ethers.utils.toUtf8Bytes("");
      let slotSet = [true, true, true, true, true, true];


      await expect();
      buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .processMultiBid(amount, slotMin, slotMax, slotSet, bid, bid, permit);
    });

    it("should revert when call multiBid without enough balanace", async function() {
      let amount = ethers.utils.parseEther("10");
      let bid = ethers.utils.parseEther("11");
      let slotMin = 5;
      let slotMax = 10;
      let permit = ethers.utils.toUtf8Bytes("");
      let slotSet = [true, true, true, true, true, true];

      await expect(
        buidlerHermezAuctionProtocol
          .connect(coordinator1)
          .processMultiBid(amount, slotMin, slotMax, slotSet, bid, bid, permit))
        .to.be.revertedWith("HermezAuctionProtocol::processMultiBid NOT_ENOUGH_BALANCE");
    });

    it("should make a complex bidding with multiBid", async function() {
      let coordinator1Address = await coordinator1.getAddress();
      // Get how much HEZ tokens are pending to be claimed for coordinator1Address
      let prevBalance = await buidlerHermezAuctionProtocol.getClaimableHEZ(
        coordinator1Address
      );
      expect(prevBalance).to.be.equal(0);

      let amount = ethers.utils.parseEther("1000");
      let bidMin = ethers.utils.parseEther("20");
      let bidMax = ethers.utils.parseEther("30");
      let slotMin = 10;
      let slotMax = 20;
      let permit = ethers.utils.toUtf8Bytes("");
      let slotSet = [true, false, true, false, true, false];

      await
      buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .processMultiBid(amount, slotMin, slotMax, slotSet, bidMax, bidMin, permit);

      // Get how much HEZ tokens are pending to be claimed for coordinator1Address
      let postBalance = await buidlerHermezAuctionProtocol.getClaimableHEZ(
        coordinator1Address
      );

      // 10 * [ 1 , 0 , 1 , 0 , 1 , 0 ] => 6 slots -> 6 * 20 = 120 HEZ
      // 1000 HEZ - 120 HEZ = 880 HEZ
      expect(postBalance).to.be.equal(ethers.utils.parseEther("880"));

      amount = ethers.utils.parseEther("0");
      bidMin = ethers.utils.parseEther("20");
      bidMax = ethers.utils.parseEther("30");
      slotMin = 10;
      slotMax = 20;
      permit = ethers.utils.toUtf8Bytes("");
      slotSet = [true, false, true, false, true, false];

      await
      buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .processMultiBid(amount, slotMin, slotMax, slotSet, bidMax, bidMin, permit);

      // Get how much HEZ tokens are pending to be claimed for coordinator1Address
      postBalance = await buidlerHermezAuctionProtocol.getClaimableHEZ(
        coordinator1Address
      );

      // 20 * 1.1 * [ 1 , 0 , 1 , 0 , 1 , 0 ] => 6 slots -> 6 * 22 = 132 HEZ
      // Diff: 132 HEZ - 120 HEZ = 12 HEZ -> 880 HEZ - 12 HEZ -> 868 HEZ
      expect(postBalance).to.be.equal(ethers.utils.parseEther("868"));

      await
      buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .processMultiBid(amount, slotMin, slotMax, slotSet, bidMax, bidMin, permit);

      await
      buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .processBid(
          ethers.utils.parseEther("0"),
          11,
          ethers.utils.parseEther("800"),
          ethers.utils.toUtf8Bytes("")
        );

      // Get how much HEZ tokens are pending to be claimed for coordinator1Address
      postBalance = await buidlerHermezAuctionProtocol.getClaimableHEZ(
        coordinator1Address
      );
      // Get coordinator1Address balance before claiming the tokens
      let preHEZBalance = await buidlerHEZToken.balanceOf(coordinator1Address);
      // Claim the tokens
      await buidlerHermezAuctionProtocol.connect(coordinator1).claimHEZ();
      // Check that there are no tokens left to claim
      expect(
        await buidlerHermezAuctionProtocol.getClaimableHEZ(coordinator1Address)
      ).to.be.equal(0);
      // Check that the coordinator1Address balance has been updated
      let postHEZBalance = await buidlerHEZToken.balanceOf(coordinator1Address);
      expect(postHEZBalance).to.be.equal(preHEZBalance.add(postBalance));
    });

    it("should revert when call multiBid for a slot already closed", async function() {
      let amount = ethers.utils.parseEther("10000");
      let bid = ethers.utils.parseEther("11");
      let slotMin = 1;
      let slotMax = 2;
      let permit = ethers.utils.toUtf8Bytes("");
      let slotSet = [true, true, true, true, true, true];

      await expect(
        buidlerHermezAuctionProtocol
          .connect(coordinator1)
          .processMultiBid(amount, slotMin, slotMax, slotSet, bid, bid, permit))
        .to.be.revertedWith("HermezAuctionProtocol::processMultiBid AUCTION_CLOSED");
    });

    it("should revert when call multiBid for a slot that is not open yet", async function() {
      let amount = ethers.utils.parseEther("10000");
      let bid = ethers.utils.parseEther("11");
      let slotMin = 10000;
      let slotMax = 10001;
      let permit = ethers.utils.toUtf8Bytes("");
      let slotSet = [true, true, true, true, true, true];

      await expect(
        buidlerHermezAuctionProtocol
          .connect(coordinator1)
          .processMultiBid(amount, slotMin, slotMax, slotSet, bid, bid, permit))
        .to.be.revertedWith("HermezAuctionProtocol::processMultiBid AUCTION_NOT_OPEN");
    });

    it("should set the minbid for a multiBid", async function() {

      let amount = ethers.utils.parseEther("100");
      let maxBid = ethers.utils.parseEther("15");
      let minBid = ethers.utils.parseEther("0");
      let slotMin = 5;
      let slotMax = 10;
      let permit = ethers.utils.toUtf8Bytes("");
      let slotSet = [true, true, true, true, true, true];

      await buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .processMultiBid(amount, slotMin, slotMax, slotSet, maxBid, minBid, permit);

      for (let i = 5; i < 10; i++) {
        // Check that the minBid of the slots 5-10 has been updated
        expect(
          (await buidlerHermezAuctionProtocol.slots(i)).bidAmount
        ).to.be.equal(ethers.utils.parseEther("11"));
      }
    });

    it("should set the minbid for a multiBid if maxBid is enough", async function() {
      let producer = await coordinator1.getAddress();

      // Change minBid of slot set
      await buidlerHermezAuctionProtocol
        .connect(governance)
        .changeDefaultSlotSetBid(0, ethers.utils.parseEther("123456789"));

      let amount = ethers.utils.parseEther("100");
      let maxBid = ethers.utils.parseEther("15");
      let minBid = ethers.utils.parseEther("0");
      let slotMin = 5;
      let slotMax = 11;
      let permit = ethers.utils.toUtf8Bytes("");
      let slotSet = [true, true, true, true, true, true];

      await buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .processMultiBid(amount, slotMin, slotMax, slotSet, maxBid, minBid, permit);

      // Check that bidder is producer
      expect((await buidlerHermezAuctionProtocol.slots(5)).bidder).to.be.equal(
        producer
      );
      // The minbid has been updated, the bid has not been enough
      // Check that forger is 0x00
      expect((await buidlerHermezAuctionProtocol.slots(6)).bidder).to.be.equal(
        ethers.constants.AddressZero
      );
      for (let i = 7; i < 12; i++) {
        // Check that forger is producer
        expect(
          (await buidlerHermezAuctionProtocol.slots(i)).bidder
        ).to.be.equal(producer);
      }
    });

    it("should make an exact multiBid", async function() {
      let amount = ethers.utils.parseEther("15");
      let maxBid = ethers.utils.parseEther("15");
      let minBid = ethers.utils.parseEther("15");
      let slotMin = 5;
      let slotMax = 5;
      let permit = ethers.utils.toUtf8Bytes("");
      let slotSet = [true, true, true, true, true, true];

      await buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .processMultiBid(amount, slotMin, slotMax, slotSet, maxBid, minBid, permit);
    });

    it("should when maxBid < closedMinBid", async function() {

      let amount = ethers.utils.parseEther("100");
      let maxBid = ethers.utils.parseEther("10");
      let minBid = ethers.utils.parseEther("15");
      let slotMin = 5;
      let slotMax = 10;
      let permit = ethers.utils.toUtf8Bytes("");
      let slotSet = [true, true, true, true, true, true];

      await expect(
        buidlerHermezAuctionProtocol
          .connect(coordinator1)
          .processMultiBid(amount, slotMin, slotMax, slotSet, maxBid, minBid, permit))
        .to.be.revertedWith("HermezAuctionProtocol::processMultiBid MAXBID_GREATER_THAN_MINBID");

    });

    it("should revert when call multibid from a non registered coordinator", async function() {
      let amount = ethers.utils.parseEther("100");
      let maxBid = ethers.utils.parseEther("12");
      let minBid = ethers.utils.parseEther("12");
      let slotMin = 5;
      let slotMax = 10;
      let permit = ethers.utils.toUtf8Bytes("");
      let slotSet = [true, true, true, true, true, true];

      await expect(
        buidlerHermezAuctionProtocol
          .connect(owner)
          .processMultiBid(amount, slotMin, slotMax, slotSet, maxBid, minBid, permit))
        .to.be.revertedWith("HermezAuctionProtocol::processMultiBid COORDINATOR_NOT_REGISTERED");

    });

    it("should call bid 12HEZ@3 -> 11HEZ@3 -> 14HEZ@3", async function() {
      let amount = ethers.utils.parseEther("12");
      let slot = 3;
      let permit = ethers.utils.toUtf8Bytes("");

      await
      buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .processBid(amount, slot, amount, permit);

      // Send tokens and bid data with amount = 11 (previous bid = 12)
      await expect(
        buidlerHermezAuctionProtocol
          .connect(coordinator1)
          .processBid(ethers.utils.parseEther("11"), slot, ethers.utils.parseEther("11"), permit))
        .to.be.revertedWith("HermezAuctionProtocol::processBid: BELOW_MINIMUM");

      let prevBalance = await buidlerHermezAuctionProtocol.getClaimableHEZ(
        await coordinator1.getAddress()
      );
      // Send tokens and bid data with amount = 14
      let amount_14 = ethers.utils.parseEther("14");

      await expect(buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .processBid(amount_14, slot, amount_14, permit))
        .to.emit(buidlerHermezAuctionProtocol, "NewBid")
        .withArgs(slot, amount_14, coordinator1Address);

      let postBalance = await buidlerHermezAuctionProtocol.getClaimableHEZ(
        await coordinator1.getAddress()
      );
      // Check that previous coordinator can withdraw the previous bid
      expect(postBalance).to.be.equal(
        prevBalance.add(ethers.utils.parseEther("12"))
      );

    });

    it("should revert when bid 10HEZ@0 and 10HEZ@1 and 10HEZ@2", async function() {
      let permit = ethers.utils.toUtf8Bytes("");

      // Send tokens and bid data with slot with closed auction
      await expect(
        buidlerHermezAuctionProtocol
          .connect(coordinator1)
          .processBid(ethers.utils.parseEther("14"), 0, ethers.utils.parseEther("14"), permit))
        .to.be.revertedWith("HermezAuctionProtocol::processBid: AUCTION_CLOSED");

      await expect(
        buidlerHermezAuctionProtocol
          .connect(coordinator1)
          .processBid(ethers.utils.parseEther("14"), 1, ethers.utils.parseEther("14"), permit))
        .to.be.revertedWith("HermezAuctionProtocol::processBid: AUCTION_CLOSED");

      await expect(
        buidlerHermezAuctionProtocol
          .connect(coordinator1)
          .processBid(ethers.utils.parseEther("14"), 2, ethers.utils.parseEther("14"), permit))
        .to.be.revertedWith("HermezAuctionProtocol::processBid: AUCTION_CLOSED");
    });

    it("should revert when bid 10HEZ@(openAuctionSlots + closeAuctionSlots) and 10HEZ@(openAuctionSlots + closeAuctionSlots + 1)", async function() {
      let permit = ethers.utils.toUtf8Bytes("");

      // Send tokens and bid data with slot with auction that has not yet been opened
      await expect(
        buidlerHermezAuctionProtocol
          .connect(coordinator1)
          .processBid(ethers.utils.parseEther("14"), 4323, ethers.utils.parseEther("14"), permit))
        .to.be.revertedWith("HermezAuctionProtocol::processBid: AUCTION_NOT_OPEN");
      // Send tokens and bid data with slot with auction that has not yet been opened
      await expect(
        buidlerHermezAuctionProtocol
          .connect(coordinator1)
          .processBid(ethers.utils.parseEther("14"), 4324, ethers.utils.parseEther("14"), permit))
        .to.be.revertedWith("HermezAuctionProtocol::processBid: AUCTION_NOT_OPEN");
    });
    // Send tokens and bid data with bid below minimum bid
    it("should revert when bid below minimal bid", async function() {
      let permit = ethers.utils.toUtf8Bytes("");

      await expect(
        buidlerHermezAuctionProtocol
          .connect(coordinator1)
          .processBid(ethers.utils.parseEther("10"), 3, ethers.utils.parseEther("10"), permit))
        .to.be.revertedWith("HermezAuctionProtocol::processBid: BELOW_MINIMUM");
    });

    it("should revert if claimHEZ revert", async function() {
      let permit = ethers.utils.toUtf8Bytes("");

      await
      buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .processBid(ethers.utils.parseEther("12"), 3, ethers.utils.parseEther("12"), permit);

      await
      buidlerHermezAuctionProtocol
        .connect(coordinator2)
        .processBid(ethers.utils.parseEther("14"), 3, ethers.utils.parseEther("14"), permit);

      // Check that the coordinator can withdraw the tokens from the previous bid
      expect(
        await buidlerHermezAuctionProtocol.getClaimableHEZ(
          await coordinator1.getAddress()
        )
      ).to.be.equal(ethers.utils.parseEther("12"));

      await buidlerHEZToken.connect(coordinator1).setTransferRevert(true);

      await expect(
        buidlerHermezAuctionProtocol.connect(coordinator1).claimHEZ()
      ).to.be.revertedWith("Transfer reverted");
      await buidlerHEZToken.connect(coordinator1).setTransferRevert(false);

    });

    it("should change the min bid price", async function() {
      let permit = ethers.utils.toUtf8Bytes("");

      for (i = 0; i < 6; i++) {
        // Change minBids
        await buidlerHermezAuctionProtocol
          .connect(governance)
          .changeDefaultSlotSetBid(i, ethers.utils.parseEther((i * 100).toString()));
      }
      for (i = 0; i < 6; i++) {
        // Check update minBids
        expect(
          await buidlerHermezAuctionProtocol.getDefaultSlotSetBid(i)
        ).to.be.equal(ethers.utils.parseEther((i * 100).toString()));
      }
      // Send tokens and bid data with amount < minBid
      await expect(
        buidlerHermezAuctionProtocol
          .connect(coordinator1)
          .processBid(ethers.utils.parseEther("10"), 3, ethers.utils.parseEther("10"), permit))
        .to.be.revertedWith("HermezAuctionProtocol::processBid: BELOW_MINIMUM");

      // Send tokens and bid data with amount > minBid
      await
      buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .processBid(ethers.utils.parseEther("330"), 3, ethers.utils.parseEther("330"), permit);

      // Check same behavior next slot set
      await expect(
        buidlerHermezAuctionProtocol
          .connect(coordinator1)
          .processBid(ethers.utils.parseEther("10"), 2 + 6, ethers.utils.parseEther("10"), permit))
        .to.be.revertedWith("HermezAuctionProtocol::processBid: BELOW_MINIMUM");

      await
      buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .processBid(ethers.utils.parseEther("330"), 2 + 6, ethers.utils.parseEther("330"), permit);

    });
  });

  describe("Bids with permit", function() {
    // Register Coordinator
    beforeEach(async function() {
      await buidlerHermezAuctionProtocol
        .connect(erc2612Wallet)
        .setCoordinator(await erc2612Wallet.getAddress(), "NONE");
      await buidlerHermezAuctionProtocol
        .connect(coordinator1)
        .setCoordinator(await erc2612Wallet.getAddress(), "NONE");
    });
    it("should be able to bid with permit", async function() {
      let amount = ethers.utils.parseEther("11");
      let slot = 3;

      const deadline = ethers.constants.MaxUint256;
      const nonce = await buidlerHEZToken.nonces(await erc2612Wallet.getAddress());

      const { v, r, s } = await createPermitSignature(
        buidlerHEZToken,
        erc2612Wallet,
        buidlerHermezAuctionProtocol.address,
        amount,
        nonce,
        deadline
      );

      const data = iface.encodeFunctionData("permit", [
        await erc2612Wallet.getAddress(),
        buidlerHermezAuctionProtocol.address,
        amount,
        deadline,
        v,
        r,
        s
      ]);

      await expect(
        buidlerHermezAuctionProtocol.connect(coordinator1)
          .processBid(amount, slot, amount, data)
      ).to.revertedWith("HermezAuctionProtocol::_permit: OWNER_NOT_EQUAL_SENDER");


      await expect(
        buidlerHermezAuctionProtocol.connect(erc2612Wallet)
          .processBid(amount, slot, amount, data)
      ).to.emit(buidlerHermezAuctionProtocol, "NewBid");

    });

    it("shouldn't be able to bid with a different permit call", async function() {
      let amount = ethers.utils.parseEther("11");
      let slot = 3;

      const deadline = ethers.constants.MaxUint256;
      const nonce = await buidlerHEZToken.nonces(await erc2612Wallet.getAddress());

      const { v, r, s } = await createPermitSignature(
        buidlerHEZToken,
        erc2612Wallet,
        buidlerHermezAuctionProtocol.address,
        amount,
        nonce,
        deadline
      );

      const data = iface.encodeFunctionData("permitFake", [
        await erc2612Wallet.getAddress(),
        buidlerHermezAuctionProtocol.address,
        amount,
        deadline,
        v,
        r,
        s
      ]);

      await expect(
        buidlerHermezAuctionProtocol.connect(erc2612Wallet)
          .processBid(amount, slot, amount, data)
      ).to.revertedWith("HermezAuctionProtocol::_permit: NOT_VALID_CALL");

    });

    it("should be able to multiBid with permit", async function() {
      const addressOwner = await erc2612Wallet.getAddress();
      const deadline = ethers.constants.MaxUint256;
      const value = ethers.utils.parseEther("200");
      const nonce = await buidlerHEZToken.nonces(addressOwner);

      const { v, r, s } = await createPermitSignature(
        buidlerHEZToken,
        erc2612Wallet,
        buidlerHermezAuctionProtocol.address,
        value,
        nonce,
        deadline
      );

      const data = iface.encodeFunctionData("permit", [
        await erc2612Wallet.getAddress(),
        buidlerHermezAuctionProtocol.address,
        value,
        deadline,
        v,
        r,
        s
      ]);

      let amount = ethers.utils.parseEther("200");
      let bid = ethers.utils.parseEther("11");
      let slotMin = 5;
      let slotMax = 6;
      let slotSet = [true, true, true, true, true, true];

      await
      buidlerHermezAuctionProtocol
        .connect(erc2612Wallet)
        .processMultiBid(amount, slotMin, slotMax, slotSet, bid, bid, data);
    });

    it("shouldn't be able to bid with permit if SPENDER_NOT_EQUAL_THIS", async function() {
      let amount = ethers.utils.parseEther("11");
      let slot = 3;

      const addressOwner = await erc2612Wallet.getAddress();
      const deadline = ethers.constants.MaxUint256;
      const value = ethers.utils.parseEther("11");
      const nonce = await buidlerHEZToken.nonces(addressOwner);

      const { v, r, s } = await createPermitSignature(
        buidlerHEZToken,
        erc2612Wallet,
        buidlerHEZToken.address,
        value,
        nonce,
        deadline
      );

      const data = iface.encodeFunctionData("permit", [
        await erc2612Wallet.getAddress(),
        buidlerHEZToken.address,
        value,
        deadline,
        v,
        r,
        s
      ]);

      await expect(
        buidlerHermezAuctionProtocol
          .connect(erc2612Wallet)
          .processBid(amount, slot, amount, data)
      ).to.revertedWith("HermezAuctionProtocol::_permit: SPENDER_NOT_EQUAL_THIS");
    });

    it("shouldn't be able to bid with permit if WRONG_AMOUNT", async function() {
      let amount = ethers.utils.parseEther("11");
      let slot = 3;

      const addressOwner = await erc2612Wallet.getAddress();
      const deadline = ethers.constants.MaxUint256;
      const value = ethers.utils.parseEther("11");
      const nonce = await buidlerHEZToken.nonces(addressOwner);

      const { v, r, s } = await createPermitSignature(
        buidlerHEZToken,
        erc2612Wallet,
        buidlerHermezAuctionProtocol.address,
        value.add(1),
        nonce,
        deadline
      );

      const data = iface.encodeFunctionData("permit", [
        await erc2612Wallet.getAddress(),
        buidlerHermezAuctionProtocol.address,
        value.add(1),
        deadline,
        v,
        r,
        s
      ]);

      await expect(
        buidlerHermezAuctionProtocol
          .connect(erc2612Wallet)
          .processBid(amount, slot, amount, data)
      ).to.revertedWith("HermezAuctionProtocol::_permit: WRONG_AMOUNT");
    });
    it("shouldn't be able to bid without NOT_ENOUGH_BALANCE", async function() {
      let amount = ethers.utils.parseEther("11");
      let slot = 3;

      const addressOwner = await erc2612Wallet.getAddress();
      const deadline = ethers.constants.MaxUint256;
      const value = ethers.utils.parseEther("11");
      const nonce = await buidlerHEZToken.nonces(addressOwner);

      const { v, r, s } = await createPermitSignature(
        buidlerHEZToken,
        erc2612Wallet,
        buidlerHermezAuctionProtocol.address,
        value,
        nonce,
        deadline
      );

      const data = iface.encodeFunctionData("permit", [
        await erc2612Wallet.getAddress(),
        buidlerHermezAuctionProtocol.address,
        value,
        deadline,
        v,
        r,
        s
      ]);

      await expect(
        buidlerHermezAuctionProtocol
          .connect(erc2612Wallet)
          .processBid(amount, slot, amount.add(1), data)
      ).to.revertedWith("HermezAuctionProtocol::processBid: NOT_ENOUGH_BALANCE");
    });

    it("should revert if token transfer fail", async function() {
      let amount = ethers.utils.parseEther("11");
      let slot = 3;

      const addressOwner = await erc2612Wallet.getAddress();
      const deadline = ethers.constants.MaxUint256;
      const value = ethers.utils.parseEther("11");
      const nonce = await buidlerHEZToken.nonces(addressOwner);

      const { v, r, s } = await createPermitSignature(
        buidlerHEZToken,
        erc2612Wallet,
        buidlerHermezAuctionProtocol.address,
        value,
        nonce,
        deadline
      );

      const data = iface.encodeFunctionData("permit", [
        await erc2612Wallet.getAddress(),
        buidlerHermezAuctionProtocol.address,
        value,
        deadline,
        v,
        r,
        s
      ]);
      await buidlerHEZToken.setTransferFromResult(false);

      await expect(
        buidlerHermezAuctionProtocol
          .connect(erc2612Wallet)
          .processBid(amount, slot, amount, data)
      ).to.revertedWith("HermezAuctionProtocol::processBid: TOKEN_TRANSFER_FAILED");


      let bid = ethers.utils.parseEther("11");
      let slotMin = 5;
      let slotMax = 6;
      let slotSet = [true, true, true, true, true, true];

      await expect(
        buidlerHermezAuctionProtocol
          .connect(erc2612Wallet)
          .processMultiBid(amount, slotMin, slotMax, slotSet, bid, bid, data)
      ).to.revertedWith("HermezAuctionProtocol::processMultiBid: TOKEN_TRANSFER_FAILED");

      await buidlerHEZToken.setTransferFromResult(true);

    });

  });
});

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function createPermitSignature(buidlerToken, owner, spenderAddress, value, nonce, deadline) {
  const digest = await createPermitDigest(
    buidlerToken,
    await owner.getAddress(),
    spenderAddress,
    value,
    nonce,
    deadline
  );

  let {
    v,
    r,
    s
  } = new ethers.utils.SigningKey(owner.privateKey).signDigest(digest);

  return {
    v,
    r,
    s,
  };
}