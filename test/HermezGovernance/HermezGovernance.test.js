const {
  ethers
} = require("@nomiclabs/buidler");
const {
  expect
} = require("chai");

const {
  time
} = require("@openzeppelin/test-helpers");

const poseidonUnit = require("circomlib/src/poseidon_gencontract");

const MIN_BLOCKS = 81;
const INITIAL_WITHDRAWAL_DELAY = 3600; //seconds
const maxTxVerifierConstant = 512;
const nLevelsVeriferConstant = 32;

const {
  calculateInputMaxTxLevels,
} = require("../hermez/helpers/helpers");
describe("Hermez Governance", function() {
  let communityCouncil, bootstrapCouncil, emergencyCouncil, hermezKeeper, donation, bootCoordinator, deployer;
  let communityCouncilAddress, bootstrapCouncilAddress, emergencyCouncilAddress, hermezKeeperAddress, donationAddress, bootCoordinatorAddress;
  let hermezGovernance;
  let buidlerHEZToken;
  let hermezAuctionProtocol, hermez;
  before(async function() {
    const accessControlFactory = await ethers.getContractFactory("HermezGovernance");
    [
      communityCouncil,
      bootstrapCouncil,
      emergencyCouncil,
      hermezKeeper,
      donation,
      bootCoordinator,
      deployer,
      ...addrs
    ] = await ethers.getSigners();
    communityCouncilAddress = await communityCouncil.getAddress();
    bootstrapCouncilAddress = await bootstrapCouncil.getAddress();
    hermezKeeperAddress = await hermezKeeper.getAddress();
    emergencyCouncilAddress = await emergencyCouncil.getAddress();
    donationAddress = await donation.getAddress();
    bootCoordinatorAddress = await bootCoordinator.getAddress();

    hermezGovernance = await upgrades.deployProxy(
      accessControlFactory,
      [],
      {
        unsafeAllowCustomTypes: true,
        initializer: undefined,
      }
    );
    await hermezGovernance.deployed();

    await hermezGovernance.hermezGovernanceInitializer(communityCouncilAddress);

    const HermezAuctionProtocol = await ethers.getContractFactory(
      "HermezAuctionProtocol"
    );
    const WithdrawalDelayer = await ethers.getContractFactory(
      "WithdrawalDelayer"
    );
    const HEZToken = await ethers.getContractFactory("HEZ");
    const Hermez = await ethers.getContractFactory("Hermez");
    const VerifierRollupHelper = await ethers.getContractFactory(
      "VerifierRollupHelper"
    );
    const VerifierWithdrawHelper = await ethers.getContractFactory(
      "VerifierWithdrawHelper"
    );
    const Poseidon2Elements = new ethers.ContractFactory(
      poseidonUnit.abi,
      poseidonUnit.createCode(2),
      deployer
    );
    const Poseidon3Elements = new ethers.ContractFactory(
      poseidonUnit.abi,
      poseidonUnit.createCode(3),
      deployer
    );
    const Poseidon4Elements = new ethers.ContractFactory(
      poseidonUnit.abi,
      poseidonUnit.createCode(4),
      deployer
    );
    // Deploy smart contacts:
    hermezAuctionProtocol = await upgrades.deployProxy(
      HermezAuctionProtocol,
      [],
      {
        unsafeAllowCustomTypes: true,
        initializer: undefined,
      }
    );
    await hermezAuctionProtocol.deployed();

    // Deploy hermez
    hermez = await upgrades.deployProxy(Hermez, [], {
      unsafeAllowCustomTypes: true,
      initializer: undefined,
    });
    await hermez.deployed();

    // Deploy withdrawalDelayer
    withdrawalDelayer = await WithdrawalDelayer.deploy();
    await withdrawalDelayer.deployed();

    // deploy HEZ (erc20Permit) token
    buidlerHEZToken = await HEZToken.deploy(
      await deployer.getAddress(),
    );
    await buidlerHEZToken.deployed();

    const buidlerPoseidon2Elements = await Poseidon2Elements.deploy();
    const buidlerPoseidon3Elements = await Poseidon3Elements.deploy();
    const buidlerPoseidon4Elements = await Poseidon4Elements.deploy();
    await buidlerPoseidon2Elements.deployed();
    await buidlerPoseidon3Elements.deployed();
    await buidlerPoseidon4Elements.deployed();

    libposeidonsAddress = [
      buidlerPoseidon2Elements.address,
      buidlerPoseidon3Elements.address,
      buidlerPoseidon4Elements.address,
    ];

    let buidlerVerifierRollupHelper = await VerifierRollupHelper.deploy();
    await buidlerVerifierRollupHelper.deployed();
    libVerifiersAddress = [buidlerVerifierRollupHelper.address];

    let buidlerVerifierWithdrawHelper = await VerifierWithdrawHelper.deploy();
    await buidlerVerifierWithdrawHelper.deployed();
    libverifiersWithdrawAddress = buidlerVerifierWithdrawHelper.address;

    // initialize withdrawal delayer
    await withdrawalDelayer.withdrawalDelayerInitializer(
      INITIAL_WITHDRAWAL_DELAY,
      hermez.address,
      hermezKeeperAddress,
      hermezGovernance.address,
      emergencyCouncilAddress
    );

    let genesisBlock =
            (await time.latestBlock()).toNumber() + 100;

    await hermezAuctionProtocol.hermezAuctionProtocolInitializer(
      buidlerHEZToken.address,
      genesisBlock,
      hermez.address,
      hermezGovernance.address,
      donationAddress,
      bootCoordinatorAddress
    );

    // initialize Hermez
    maxTxVerifier = [];
    nLevelsVerifer = [];
    libVerifiersAddress.forEach(() => {
      maxTxVerifier.push(maxTxVerifierConstant);
      nLevelsVerifer.push(nLevelsVeriferConstant);
    });
    await hermez.initializeHermez(
      libVerifiersAddress,
      calculateInputMaxTxLevels(maxTxVerifier, nLevelsVerifer),
      libverifiersWithdrawAddress,
      hermezAuctionProtocol.address,
      buidlerHEZToken.address,
      10,
      10,
      libposeidonsAddress[0],
      libposeidonsAddress[1],
      libposeidonsAddress[2],
      hermezGovernance.address,
      hermezKeeperAddress,
      1209600,
      withdrawalDelayer.address
    );
  });
  describe("Basic funcionality", function() {
    it("should be able to add a role", async function() {

      let role = await getRole(hermezGovernance.address, "0xFFFFFFFF");

      await expect(
        hermezGovernance.addRole(role, bootstrapCouncilAddress)
      ).to.emit(hermezGovernance, "RoleGranted")
        .withArgs(role, bootstrapCouncilAddress, communityCouncilAddress);
      expect(
        await
        hermezGovernance.hasRole(role, bootstrapCouncilAddress))
        .to.be.equal(true);
    });
    it("should be able to add a revoke a role", async function() {
      let role = await getRole(hermezGovernance.address, "0xFFFFFFFF");
      expect(
        await
        hermezGovernance.hasRole(role, bootstrapCouncilAddress))
        .to.be.equal(true);
      await expect(
        hermezGovernance.removeRole(role, bootstrapCouncilAddress)
      ).to.emit(hermezGovernance, "RoleRevoked")
        .withArgs(role, bootstrapCouncilAddress, communityCouncilAddress);
      expect(await
      hermezGovernance.hasRole(role, bootstrapCouncilAddress))
        .to.be.equal(false);

    });
  });

  describe("hermezAuctionProtocol", function() {
    before(async function() {
      // 87e6b6bb  =>  setSlotDeadline(uint8) ==> BootstrapCouncil
      // c63de515  =>  setOpenAuctionSlots(uint16) ==> BootstrapCouncil
      // d92bdda3  =>  setClosedAuctionSlots(uint16) ==> BootstrapCouncil
      // dfd5281b  =>  setOutbidding ==> BootstrapCouncil
      // 82787405  =>  setAllocationRatio ==> BootstrapCouncil
      // 6f48e79b  =>  setDonationAddress ==> BootstrapCouncil
      // 62945af2  =>  setBootCoordinator ==> BootstrapCouncil
      // 7c643b70  =>  changeDefaultSlotSetBid ==> BootstrapCouncil, HermezKeeper

      let allowedFunctionsBootstrapCouncil = [
        "setSlotDeadline",
        "setOpenAuctionSlots",
        "setClosedAuctionSlots",
        "setOutbidding",
        "setAllocationRatio",
        "setDonationAddress",
        "setBootCoordinator",
        "changeDefaultSlotSetBid"];

      allowedFunctionsBootstrapCouncil.forEach(async method => {

        let role = await getRole(
          hermezAuctionProtocol.address,
          hermezAuctionProtocol.interface.getSighash(method));
        await expect(
          hermezGovernance.addRole(role, bootstrapCouncilAddress)
        ).to.emit(hermezGovernance, "RoleGranted")
          .withArgs(role, bootstrapCouncilAddress, communityCouncilAddress);
        expect(
          await
          hermezGovernance.hasRole(role, bootstrapCouncilAddress))
          .to.be.equal(true);
      });

      let allowedHermezKeeper = [
        "changeDefaultSlotSetBid"
      ];

      allowedHermezKeeper.forEach(async method => {
        let role = await getRole(
          hermezAuctionProtocol.address,
          hermezAuctionProtocol.interface.getSighash(method));
        await expect(
          hermezGovernance.addRole(role, hermezKeeperAddress)
        ).to.emit(hermezGovernance, "RoleGranted")
          .withArgs(role, hermezKeeperAddress, communityCouncilAddress);
        expect(
          await
          hermezGovernance.hasRole(role, hermezKeeperAddress))
          .to.be.equal(true);
      });
    });

    it("should be able to change setSlotDeadline", async function() {
      let newSlotDeadline = 1;

      await expect(
        hermezAuctionProtocol.setSlotDeadline(0)
      ).to.be.revertedWith("HermezAuctionProtocol::onlyGovernance: ONLY_GOVERNANCE");

      let data = hermezAuctionProtocol.interface.encodeFunctionData("setSlotDeadline", [newSlotDeadline]);
      await expect(
        hermezGovernance
          .execute(hermezAuctionProtocol.address, 0, data))
        .to.be.revertedWith("HermezGovernance::execute: ONLY_ALLOWED_ROLE");
      await expect(
        hermezGovernance.connect(bootstrapCouncil)
          .execute(hermezAuctionProtocol.address, 0, data))
        .to.emit(hermezGovernance, "ExecOk");
      expect(await hermezAuctionProtocol.getSlotDeadline()).to.be.equal(newSlotDeadline);

    });
    it("should be able to change setOpenAuctionSlots", async function() {
      let newOpenAuctionSlots = 123;

      await expect(
        hermezAuctionProtocol.setOpenAuctionSlots(newOpenAuctionSlots)
      ).to.be.revertedWith("HermezAuctionProtocol::onlyGovernance: ONLY_GOVERNANCE");

      let data = hermezAuctionProtocol.interface.encodeFunctionData("setOpenAuctionSlots", [newOpenAuctionSlots]);
      await expect(
        hermezGovernance
          .execute(hermezAuctionProtocol.address, 0, data))
        .to.be.revertedWith("HermezGovernance::execute: ONLY_ALLOWED_ROLE");
      await expect(
        hermezGovernance.connect(bootstrapCouncil)
          .execute(hermezAuctionProtocol.address, 0, data))
        .to.emit(hermezGovernance, "ExecOk");
      expect(await hermezAuctionProtocol.getOpenAuctionSlots()).to.be.equal(newOpenAuctionSlots);
    });
    it("should be able to change setClosedAuctionSlots", async function() {
      let newClosedAuctionSlots = 5;
      await expect(
        hermezAuctionProtocol.setOpenAuctionSlots(newClosedAuctionSlots)
      ).to.be.revertedWith("HermezAuctionProtocol::onlyGovernance: ONLY_GOVERNANCE");

      let data = hermezAuctionProtocol.interface.encodeFunctionData("setClosedAuctionSlots", [newClosedAuctionSlots]);
      await expect(
        hermezGovernance
          .execute(hermezAuctionProtocol.address, 0, data))
        .to.be.revertedWith("HermezGovernance::execute: ONLY_ALLOWED_ROLE");
      await expect(
        hermezGovernance.connect(bootstrapCouncil)
          .execute(hermezAuctionProtocol.address, 0, data))
        .to.emit(hermezGovernance, "ExecOk");
      expect(await hermezAuctionProtocol.getClosedAuctionSlots()).to.be.equal(newClosedAuctionSlots);
    });

    it("should be able to change setOutbidding", async function() {
      let newOutbidding = 1122;
      await expect(
        hermezAuctionProtocol.setOpenAuctionSlots(newOutbidding)
      ).to.be.revertedWith("HermezAuctionProtocol::onlyGovernance: ONLY_GOVERNANCE");

      let data = hermezAuctionProtocol.interface.encodeFunctionData("setOutbidding", [newOutbidding]);
      await expect(
        hermezGovernance
          .execute(hermezAuctionProtocol.address, 0, data))
        .to.be.revertedWith("HermezGovernance::execute: ONLY_ALLOWED_ROLE");
      await expect(
        hermezGovernance.connect(bootstrapCouncil)
          .execute(hermezAuctionProtocol.address, 0, data))
        .to.emit(hermezGovernance, "ExecOk");
      expect(await hermezAuctionProtocol.getOutbidding()).to.be.equal(newOutbidding);
    });
    it("should be able to change setAllocationRatio", async function() {
      let newAllocationRatio = [5000, 5000, 0];
      await expect(
        hermezAuctionProtocol.setAllocationRatio(newAllocationRatio)
      ).to.be.revertedWith("HermezAuctionProtocol::onlyGovernance: ONLY_GOVERNANCE");

      let data = hermezAuctionProtocol.interface.encodeFunctionData("setAllocationRatio", [newAllocationRatio]);
      await expect(
        hermezGovernance
          .execute(hermezAuctionProtocol.address, 0, data))
        .to.be.revertedWith("HermezGovernance::execute: ONLY_ALLOWED_ROLE");
      await expect(
        hermezGovernance.connect(bootstrapCouncil)
          .execute(hermezAuctionProtocol.address, 0, data))
        .to.emit(hermezGovernance, "ExecOk");
      expect((await hermezAuctionProtocol.getAllocationRatio())[0]).to.be.equal(newAllocationRatio[0]);
      expect((await hermezAuctionProtocol.getAllocationRatio())[1]).to.be.equal(newAllocationRatio[1]);
      expect((await hermezAuctionProtocol.getAllocationRatio())[2]).to.be.equal(newAllocationRatio[2]);
    });

    it("should be able to change setDonationAddress", async function() {
      let newDonationAddress = bootstrapCouncilAddress;
      await expect(
        hermezAuctionProtocol.setDonationAddress(newDonationAddress)
      ).to.be.revertedWith("HermezAuctionProtocol::onlyGovernance: ONLY_GOVERNANCE");

      let data = hermezAuctionProtocol.interface.encodeFunctionData("setDonationAddress", [newDonationAddress]);
      await expect(
        hermezGovernance
          .execute(hermezAuctionProtocol.address, 0, data))
        .to.be.revertedWith("HermezGovernance::execute: ONLY_ALLOWED_ROLE");
      await expect(
        hermezGovernance.connect(bootstrapCouncil)
          .execute(hermezAuctionProtocol.address, 0, data))
        .to.emit(hermezGovernance, "ExecOk");
      expect(await hermezAuctionProtocol.getDonationAddress()).to.be.equal(newDonationAddress);
    });

    it("should be able to change setBootCoordinator", async function() {
      let newBootCoordinator = bootstrapCouncilAddress;
      await expect(
        hermezAuctionProtocol.setBootCoordinator(newBootCoordinator)
      ).to.be.revertedWith("HermezAuctionProtocol::onlyGovernance: ONLY_GOVERNANCE");

      let data = hermezAuctionProtocol.interface.encodeFunctionData("setBootCoordinator", [newBootCoordinator]);
      await expect(
        hermezGovernance
          .execute(hermezAuctionProtocol.address, 0, data))
        .to.be.revertedWith("HermezGovernance::execute: ONLY_ALLOWED_ROLE");
      await expect(
        hermezGovernance.connect(bootstrapCouncil)
          .execute(hermezAuctionProtocol.address, 0, data))
        .to.emit(hermezGovernance, "ExecOk");
      expect(await hermezAuctionProtocol.getBootCoordinator()).to.be.equal(newBootCoordinator);
    });

    it("should be able to change changeDefaultSlotSetBid", async function() {
      let slotCouncil = 0;
      let slotKeeper = 1;
      let valueCouncil = 123;
      let valueKeeper = 321;
      await expect(
        hermezAuctionProtocol.changeDefaultSlotSetBid(slotCouncil, valueCouncil)
      ).to.be.revertedWith("HermezAuctionProtocol::onlyGovernance: ONLY_GOVERNANCE");

      let data = hermezAuctionProtocol.interface.encodeFunctionData("changeDefaultSlotSetBid", [slotCouncil, valueCouncil]);
      await expect(
        hermezGovernance
          .execute(hermezAuctionProtocol.address, 0, data))
        .to.be.revertedWith("HermezGovernance::execute: ONLY_ALLOWED_ROLE");
      await expect(
        hermezGovernance.connect(bootstrapCouncil)
          .execute(hermezAuctionProtocol.address, 0, data))
        .to.emit(hermezGovernance, "ExecOk");
      expect(await hermezAuctionProtocol.getDefaultSlotSetBid(slotCouncil)).to.be.equal(valueCouncil);

      let data_keeper = hermezAuctionProtocol.interface.encodeFunctionData("changeDefaultSlotSetBid", [slotKeeper, valueKeeper]);
      await expect(
        hermezGovernance.connect(hermezKeeper)
          .execute(hermezAuctionProtocol.address, 0, data_keeper))
        .to.emit(hermezGovernance, "ExecOk");
      expect(await hermezAuctionProtocol.getDefaultSlotSetBid(slotKeeper)).to.be.equal(valueKeeper);
    });
  });
  describe("Hermez", function() {
    before(async function() {
      let allowedFunctionsBootstrapCouncil = [
        "updateBucketsParameters",
        "updateWithdrawalDelay",
        "safeMode",
        "updateForgeL1L2BatchTimeout",
        "updateFeeAddToken"];

      allowedFunctionsBootstrapCouncil.forEach(async method => {

        let role = await getRole(
          hermez.address,
          hermez.interface.getSighash(method));
        await expect(
          hermezGovernance.addRole(role, bootstrapCouncilAddress)
        ).to.emit(hermezGovernance, "RoleGranted")
          .withArgs(role, bootstrapCouncilAddress, communityCouncilAddress);
        expect(
          await
          hermezGovernance.hasRole(role, bootstrapCouncilAddress))
          .to.be.equal(true);
      });

      let allowedHermezKeeper = [
        "updateTokenExchange",
        "safeMode"
      ];

      allowedHermezKeeper.forEach(async method => {
        let role = await getRole(
          hermez.address,
          hermez.interface.getSighash(method));
        await expect(
          hermezGovernance.addRole(role, hermezKeeperAddress)
        ).to.emit(hermezGovernance, "RoleGranted")
          .withArgs(role, hermezKeeperAddress, communityCouncilAddress);
        expect(
          await
          hermezGovernance.hasRole(role, hermezKeeperAddress))
          .to.be.equal(true);
      });
    });

    it("should be able to change updateBucketsParameters", async function() {
      const buckets = [];
      const numBuckets = 5;

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
        hermez.updateBucketsParameters(buckets)
      ).to.be.revertedWith("InstantWithdrawManager::onlyGovernance: ONLY_GOVERNANCE");

      let data = hermez.interface.encodeFunctionData("updateBucketsParameters", [buckets]);
      await expect(
        hermezGovernance
          .execute(hermez.address, 0, data))
        .to.be.revertedWith("HermezGovernance::execute: ONLY_ALLOWED_ROLE");
      await expect(
        hermezGovernance.connect(bootstrapCouncil)
          .execute(hermez.address, 0, data))
        .to.emit(hermezGovernance, "ExecOk");
      for (let i = 0; i < numBuckets; i++) {
        let bucket = await hermez.buckets(i);
        expect(bucket.ceilUSD).to.be.equal(buckets[i][0]);
        expect(bucket.blockWithdrawalRate).to.be.equal(buckets[i][2]);
        expect(bucket.maxWithdrawals).to.be.equal(buckets[i][3]);
      }
    });
    it("should be able to change updateTokenExchange", async function() {
      const addressArray = [buidlerHEZToken.address];
      const tokenPrice = 10; //USD
      const valueArray = [tokenPrice * 1e14];

      await expect(
        hermez.updateTokenExchange(addressArray, valueArray)
      ).to.be.revertedWith("InstantWithdrawManager::onlyGovernance: ONLY_GOVERNANCE");

      let data = hermez.interface.encodeFunctionData("updateTokenExchange", [addressArray, valueArray]);
      await expect(
        hermezGovernance
          .execute(hermez.address, 0, data))
        .to.be.revertedWith("HermezGovernance::execute: ONLY_ALLOWED_ROLE");
      await expect(
        hermezGovernance.connect(hermezKeeper)
          .execute(hermez.address, 0, data))
        .to.emit(hermezGovernance, "ExecOk");
      expect(
        await hermez.tokenExchange(buidlerHEZToken.address)
      ).to.equal(valueArray[0]);
    });
    it("should be able to change updateWithdrawalDelay", async function() {
      const newWithdrawalDelay = 100000;

      await expect(
        hermez.updateWithdrawalDelay(newWithdrawalDelay)
      ).to.be.revertedWith("InstantWithdrawManager::onlyGovernance: ONLY_GOVERNANCE");

      let data = hermez.interface.encodeFunctionData("updateWithdrawalDelay", [newWithdrawalDelay]);
      await expect(
        hermezGovernance
          .execute(hermez.address, 0, data))
        .to.be.revertedWith("HermezGovernance::execute: ONLY_ALLOWED_ROLE");
      await expect(
        hermezGovernance.connect(bootstrapCouncil)
          .execute(hermez.address, 0, data))
        .to.emit(hermezGovernance, "ExecOk");
      expect(await hermez.withdrawalDelay()).to.equal(
        newWithdrawalDelay
      );
    });
    it("should be able to change safeMode", async function() {

      const numBuckets = 5;
      const buckets = [];
      await expect(
        hermez.safeMode()
      ).to.be.revertedWith("InstantWithdrawManager::safeMode: ONY_SAFETYADDRESS_OR_GOVERNANCE");

      let data = hermez.interface.encodeFunctionData("safeMode", []);
      dataEncoded = ethers.utils.defaultAbiCoder.encode(
        ["bytes4"],
        [data]);
      await expect(
        hermezGovernance
          .execute(hermez.address, 0, dataEncoded))
        .to.be.revertedWith("HermezGovernance::execute: ONLY_ALLOWED_ROLE");
      await expect(
        hermezGovernance.connect(bootstrapCouncil)
          .execute(hermez.address, 0, dataEncoded))
        .to.emit(hermezGovernance, "ExecOk");


      for (let i = 0; i < numBuckets; i++) {
        let bucket = await hermez.buckets(i);
        expect(bucket.ceilUSD).to.be.equal(0);
        expect(bucket.blockWithdrawalRate).to.be.equal(0);
        expect(bucket.maxWithdrawals).to.be.equal(0);
      }

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

      let dataBuckets = hermez.interface.encodeFunctionData("updateBucketsParameters", [buckets]);
      await expect(
        hermezGovernance.connect(bootstrapCouncil)
          .execute(hermez.address, 0, dataBuckets))
        .to.emit(hermezGovernance, "ExecOk");

      await expect(
        hermezGovernance.connect(hermezKeeper)
          .execute(hermez.address, 0, dataEncoded))
        .to.emit(hermezGovernance, "ExecOk");


      for (let i = 0; i < numBuckets; i++) {
        let bucket = await hermez.buckets(i);
        expect(bucket.ceilUSD).to.be.equal(0);
        expect(bucket.blockWithdrawalRate).to.be.equal(0);
        expect(bucket.maxWithdrawals).to.be.equal(0);
      }

    });

    it("should be able to change updateForgeL1L2BatchTimeout", async function() {

      const newForgeL1Timeout = 100;

      await expect(
        hermez.updateForgeL1L2BatchTimeout(newForgeL1Timeout)
      ).to.be.revertedWith("InstantWithdrawManager::onlyGovernance: ONLY_GOVERNANCE");

      let data = hermez.interface.encodeFunctionData("updateForgeL1L2BatchTimeout", [newForgeL1Timeout]);
      await expect(
        hermezGovernance
          .execute(hermez.address, 0, data))
        .to.be.revertedWith("HermezGovernance::execute: ONLY_ALLOWED_ROLE");
      await expect(
        hermezGovernance.connect(bootstrapCouncil)
          .execute(hermez.address, 0, data))
        .to.emit(hermezGovernance, "ExecOk");
      expect(await hermez.forgeL1L2BatchTimeout()).to.equal(
        newForgeL1Timeout
      );
    });

    it("should be able to change updateFeeAddToken", async function() {
      const newFeeAddToken = 100;
      await expect(
        hermez.updateFeeAddToken(newFeeAddToken)
      ).to.be.revertedWith("InstantWithdrawManager::onlyGovernance: ONLY_GOVERNANCE");

      let data = hermez.interface.encodeFunctionData("updateFeeAddToken", [newFeeAddToken]);
      await expect(
        hermezGovernance
          .execute(hermez.address, 0, data))
        .to.be.revertedWith("HermezGovernance::execute: ONLY_ALLOWED_ROLE");
      await expect(
        hermezGovernance.connect(bootstrapCouncil)
          .execute(hermez.address, 0, data))
        .to.emit(hermezGovernance, "ExecOk");
      expect(await hermez.feeAddToken()).to.equal(newFeeAddToken);
    });
  });
});

function getRole(address, dataSignature) {
  return ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ["address", "bytes4"],
      [address, dataSignature]
    )
  );
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}