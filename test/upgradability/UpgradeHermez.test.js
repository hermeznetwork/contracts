const { ethers, upgrades } = require("hardhat");

const {
  expect
} = require("chai");

const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const ProxyAdmin = require("@openzeppelin/upgrades-core/artifacts/ProxyAdmin.json");
const { getAdminAddress } = require("@openzeppelin/upgrades-core");

const INITIAL_WITHDRAWAL_DELAY = 3600; //seconds

const { time } = require("@openzeppelin/test-helpers");

const {
  calculateInputMaxTxLevels,
} = require("../hermez/helpers/helpers");

const maxTxVerifierConstant = 512;
const nLevelsVeriferConstant = 32;
const TIMEOUT = 400000;
const bootCoordinatorURL = "https://boot.coordinator.io";

describe("upgradability test Hermez", function() {
  this.timeout(TIMEOUT);

  let hermez, libVerifiersAddress, maxTxVerifier, nLevelsVerifer, libverifiersWithdrawAddress,
    hermezAuctionProtocol, hardhatHEZToken, libposeidonsAddress, hermezGovernanceAddress, 
    withdrawalDelayer;
  
  beforeEach(async function() {

    [
      deployer,
      hermezGovernanceEthers,
      whiteHackGroupEthers,
      donationEthers,
      bootCoordinatorEthers,
    ] = await ethers.getSigners();

    whiteHackGroupAddress = await whiteHackGroupEthers.getAddress();
    hermezGovernanceAddress = await hermezGovernanceEthers.getAddress();
    donationAddress = await donationEthers.getAddress();
    bootCoordinatorAddress = await bootCoordinatorEthers.getAddress();

    console.log("whiteHackGroupAddress: " + whiteHackGroupAddress);
    console.log("hermezGovernanceAddress: " + hermezGovernanceAddress);
    console.log("donationAddress: " + donationAddress);
    console.log("bootCoordinatorAddress: " + bootCoordinatorAddress);

    console.log(
      "Deploying contracts with the account:",
      await deployer.getAddress()
    );

    const HermezAuctionProtocol = await ethers.getContractFactory(
      "HermezAuctionProtocol"
    );
    const WithdrawalDelayer = await ethers.getContractFactory(
      "WithdrawalDelayer"
    );
    const HEZToken = await ethers.getContractFactory("HEZ");
    const Hermez = await ethers.getContractFactory("Hermez");

    // hermez libs
    const VerifierRollupHelper = await ethers.getContractFactory(
      "VerifierRollupHelper"
    );
    const VerifierWithdrawHelper = await ethers.getContractFactory(
      "VerifierWithdrawHelper"
    );

    const Poseidon2Elements = new ethers.ContractFactory(
      poseidonUnit.generateABI(2),
      poseidonUnit.createCode(2),
      deployer
    );
    const Poseidon3Elements = new ethers.ContractFactory(
      poseidonUnit.generateABI(3),
      poseidonUnit.createCode(3),
      deployer
    );
    const Poseidon4Elements = new ethers.ContractFactory(
      poseidonUnit.generateABI(4),
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
    console.log(
      "hermezAuctionProtocol deployed at: ",
      hermezAuctionProtocol.address
    );

    // Deploy hermez
    hermez = await upgrades.deployProxy(Hermez, [], {
      unsafeAllowCustomTypes: true,
      initializer: undefined,
    });
    await hermez.deployed();

    console.log("hermez deployed at: ", hermez.address);

    // Deploy withdrawalDelayer
    withdrawalDelayer = await WithdrawalDelayer.deploy(  
      INITIAL_WITHDRAWAL_DELAY,
      hermez.address,
      hermezGovernanceAddress,
      whiteHackGroupAddress);
    await withdrawalDelayer.deployed();

    console.log("withdrawalDelayer deployed at: ", withdrawalDelayer.address);

    // deploy HEZ (erc20Permit) token
    hardhatHEZToken = await HEZToken.deploy(
      await deployer.getAddress(),
    );
    await hardhatHEZToken.deployed();
    console.log("HEZToken deployed at: ", hardhatHEZToken.address);

    const hardhatPoseidon2Elements = await Poseidon2Elements.deploy();
    const hardhatPoseidon3Elements = await Poseidon3Elements.deploy();
    const hardhatPoseidon4Elements = await Poseidon4Elements.deploy();
    await hardhatPoseidon2Elements.deployed();
    await hardhatPoseidon3Elements.deployed();
    await hardhatPoseidon4Elements.deployed();

    libposeidonsAddress = [
      hardhatPoseidon2Elements.address,
      hardhatPoseidon3Elements.address,
      hardhatPoseidon4Elements.address,
    ];
    console.log("deployed poseidon libs");
    console.log("poseidon 2 elements at: ", hardhatPoseidon2Elements.address);
    console.log("poseidon 3 elements at: ", hardhatPoseidon3Elements.address);
    console.log("poseidon 4 elements at: ", hardhatPoseidon4Elements.address);

    let hardhatVerifierRollupHelper = await VerifierRollupHelper.deploy();
    await hardhatVerifierRollupHelper.deployed();
    libVerifiersAddress = [hardhatVerifierRollupHelper.address];
    console.log("libVerifiersAddress at: ", hardhatVerifierRollupHelper.address);

    let hardhatVerifierWithdrawHelper = await VerifierWithdrawHelper.deploy();
    await hardhatVerifierWithdrawHelper.deployed();
    libverifiersWithdrawAddress = hardhatVerifierWithdrawHelper.address;
    console.log("libverifiersWithdrawAddress at: ", hardhatVerifierWithdrawHelper.address);

    let genesisBlock =
          (await time.latestBlock()).toNumber() + 100;

    await hermezAuctionProtocol.hermezAuctionProtocolInitializer(
      hardhatHEZToken.address,
      genesisBlock,
      hermez.address,
      hermezGovernanceAddress,
      donationAddress,
      bootCoordinatorAddress,
      bootCoordinatorURL
    );

    console.log("hermezAuctionProtocol Initialized");

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
      hardhatHEZToken.address,
      10,
      10,
      libposeidonsAddress[0],
      libposeidonsAddress[1],
      libposeidonsAddress[2],
      hermezGovernanceAddress,
      1209600,
      withdrawalDelayer.address
    );

    console.log("hermez Initialized");
  });
  it("should be able to upgrade Hermez", async () => {

    const HermezV2 = await ethers.getContractFactory("HermezV2");
    const newHermezV2 = HermezV2.attach(hermez.address);

    await expect(newHermezV2.getVersion()).to.be.reverted;

    await upgrades.upgradeProxy(hermez.address, HermezV2, {
      unsafeAllowCustomTypes: true
    });

    await expect(newHermezV2.initializeHermez(
      libVerifiersAddress,
      calculateInputMaxTxLevels(maxTxVerifier, nLevelsVerifer),
      libverifiersWithdrawAddress,
      hermezAuctionProtocol.address,
      hardhatHEZToken.address,
      10,
      10,
      libposeidonsAddress[0],
      libposeidonsAddress[1],
      libposeidonsAddress[2],
      hermezGovernanceAddress,
      1209600,
      withdrawalDelayer.address
    )).to.be.revertedWith("Initializable: contract is already initialized");

    await newHermezV2.setVersion();
    expect(await newHermezV2.getVersion()).to.be.equal(2);

  });
  it("should be able to upgrade Hermez with prepareUpgrade", async () => {
    const HermezV2 = await ethers.getContractFactory("HermezV2");

    const hermezV2 = await upgrades.prepareUpgrade(hermez.address, HermezV2, {
      unsafeAllowCustomTypes: true
    });

    const AdminFactory = await getProxyAdminFactory();
    const admin = AdminFactory.attach(await getAdminAddress(ethers.provider, hermez.address));
    const proxyAdminAddress = await getAdminAddress(ethers.provider, hermez.address);

    await admin.upgrade(hermez.address, hermezV2);
    const newHermezV2 = HermezV2.attach(hermez.address);
    await newHermezV2.setVersion();
    expect(await newHermezV2.getVersion()).to.be.equal(2);
  });

  it("should be able to upgrade Hermez with prepareUpgrade after transferProxyAdminOwnership", async () => {
    const HermezV2 = await ethers.getContractFactory("HermezV2");

    const hermezV2 = await upgrades.prepareUpgrade(hermez.address, HermezV2, {
      unsafeAllowCustomTypes: true
    });


    await upgrades.admin.transferProxyAdminOwnership(hermezGovernanceAddress);

    const AdminFactory = await getProxyAdminFactory();
    const admin = AdminFactory.attach(await getAdminAddress(ethers.provider, hermez.address));
    const proxyAdminAddress = await getAdminAddress(ethers.provider, hermez.address);

    await admin.connect(hermezGovernanceEthers).upgrade(hermez.address, hermezV2);
    const newHermezV2 = HermezV2.attach(hermez.address);
    await newHermezV2.setVersion();
    expect(await newHermezV2.getVersion()).to.be.equal(2);
  });


  it("should be able to upgrade using Timelock Hermez with prepareUpgrade", async () => {
    const HermezV2 = await ethers.getContractFactory("HermezV2");
    const Timelock = await ethers.getContractFactory("Timelock");

    const newHermezV2 = HermezV2.attach(hermez.address);
    await expect(newHermezV2.getVersion()).to.be.reverted;

    const AdminFactory = await getProxyAdminFactory();
    let adminAddress = await getAdminAddress(ethers.provider, hermez.address);
    const admin = AdminFactory.attach(adminAddress);

    const deployerAddress = await deployer.getAddress();

    // Deploy Timelock
    const Timelockhardhat = await Timelock.deploy(hermezGovernanceAddress, 604800);
    await Timelockhardhat.deployed();
    await admin.connect(hermezGovernanceEthers).transferOwnership(Timelockhardhat.address);

    const hermezV2 = await upgrades.prepareUpgrade(hermez.address, HermezV2, {
      unsafeAllowCustomTypes: true
    });

    const proxyAdminAddress = await getAdminAddress(ethers.provider, hermez.address);

    let iface = new ethers.utils.Interface(ProxyAdmin.abi);
    let latest = await ethers.provider.getBlockNumber();
    let blockTimestamp = (await ethers.provider.getBlock(latest)).timestamp;
    let eta = blockTimestamp + 605800;
    await Timelockhardhat.connect(hermezGovernanceEthers).queueTransaction(
      adminAddress,
      0,
      "",
      iface.encodeFunctionData("upgrade", [hermez.address, hermezV2]),
      eta
    );

    await expect(Timelockhardhat.connect(hermezGovernanceEthers).executeTransaction(
      adminAddress,
      0,
      "",
      iface.encodeFunctionData("upgrade", [hermez.address, hermezV2]),
      eta
    )).to.be.revertedWith("Timelock::executeTransaction: Transaction hasn't surpassed time lock.");


    await Timelockhardhat.connect(hermezGovernanceEthers).queueTransaction(
      adminAddress,
      0,
      "",
      iface.encodeFunctionData("transferOwnership", [deployerAddress]),
      eta
    );

    await ethers.provider.send("evm_setNextBlockTimestamp", [eta]);

    await Timelockhardhat.connect(hermezGovernanceEthers).executeTransaction(
      adminAddress,
      0,
      "",
      iface.encodeFunctionData("upgrade", [hermez.address, hermezV2]),
      eta
    );

    // return the ownerwship to the deployer address for future tests!
    await Timelockhardhat.connect(hermezGovernanceEthers).executeTransaction(
      adminAddress,
      0,
      "",
      iface.encodeFunctionData("transferOwnership", [deployerAddress]),
      eta
    );
        
    await newHermezV2.setVersion();
    expect(await newHermezV2.getVersion()).to.be.equal(2);
  });


});

async function getProxyAdminFactory() {
  return ethers.getContractFactory(ProxyAdmin.abi, ProxyAdmin.bytecode);
}
