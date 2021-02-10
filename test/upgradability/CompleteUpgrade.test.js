const { ethers, upgrades } = require("@nomiclabs/buidler");

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

describe("upgradability test", function() {
  this.timeout(TIMEOUT);
  let deployer,
    hermezGovernanceEthers,
    whiteHackGroupEthers,
    donationEthers,
    bootCoordinatorEthers;

  let whiteHackGroupAddress,
    hermezGovernanceAddress,
    donationAddress,
    bootCoordinatorAddress;

  let hermezAuctionProtocol, withdrawalDelayer, hermez;

  before(async function() {
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
    let Hermez = await ethers.getContractFactory("Hermez");

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
      whiteHackGroupAddress
    );
    await withdrawalDelayer.deployed();

    console.log("withdrawalDelayer deployed at: ", withdrawalDelayer.address);

    // deploy HEZ (erc20Permit) token
    const buidlerHEZToken = await HEZToken.deploy(
      await deployer.getAddress(),
    );
    await buidlerHEZToken.deployed();
    console.log("HEZToken deployed at: ", buidlerHEZToken.address);

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
    console.log("deployed poseidon libs");
    console.log("poseidon 2 elements at: ", buidlerPoseidon2Elements.address);
    console.log("poseidon 3 elements at: ", buidlerPoseidon3Elements.address);
    console.log("poseidon 4 elements at: ", buidlerPoseidon4Elements.address);

    let buidlerVerifierRollupHelper = await VerifierRollupHelper.deploy();
    await buidlerVerifierRollupHelper.deployed();
    libVerifiersAddress = [buidlerVerifierRollupHelper.address];
    console.log("libVerifiersAddress at: ", buidlerVerifierRollupHelper.address);

    let buidlerVerifierWithdrawHelper = await VerifierWithdrawHelper.deploy();
    await buidlerVerifierWithdrawHelper.deployed();
    let libverifiersWithdrawAddress = buidlerVerifierWithdrawHelper.address;
    console.log("libverifiersWithdrawAddress at: ", buidlerVerifierWithdrawHelper.address);

    let genesisBlock =
            (await time.latestBlock()).toNumber() + 100;

    await hermezAuctionProtocol.hermezAuctionProtocolInitializer(
      buidlerHEZToken.address,
      genesisBlock,
      hermez.address,
      hermezGovernanceAddress,
      donationAddress,
      bootCoordinatorAddress,
      bootCoordinatorURL
    );

    console.log("hermezAuctionProtocol Initialized");

    // initialize Hermez
    let maxTxVerifier = [];
    let nLevelsVerifer = [];
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
      hermezGovernanceAddress,
      1209600,
      withdrawalDelayer.address
    );

    console.log("hermez Initialized");


  });
  it("should be able to upgrade all", async () => {
    const HermezAuctionProtocolV2 = await ethers.getContractFactory("HermezAuctionProtocolV2");
    const Timelock = await ethers.getContractFactory("Timelock");
    const HermezV2 = await ethers.getContractFactory("HermezV2");

    const newHermezAuctionProtocolV2 = HermezAuctionProtocolV2.attach(hermezAuctionProtocol.address);
    await expect(newHermezAuctionProtocolV2.getVersion()).to.be.reverted;

    const newHermezV2 = HermezV2.attach(hermez.address);
    await expect(newHermezV2.getVersion()).to.be.reverted;


    const AdminFactory = await getProxyAdminFactory();
    let adminAddress = await getAdminAddress(ethers.provider, hermezAuctionProtocol.address);
    const admin = AdminFactory.attach(adminAddress);

    const deployerAddress = await deployer.getAddress();

    // Deploy Timelock
    const TimelockBuidler = await Timelock.deploy(hermezGovernanceAddress, 604800);
    await TimelockBuidler.deployed();
    await admin.transferOwnership(TimelockBuidler.address);

    const hermezAuctionProtocolV2 = await upgrades.prepareUpgrade(hermezAuctionProtocol.address, HermezAuctionProtocolV2, {
      unsafeAllowCustomTypes: true
    });
    const hermezV2 = await upgrades.prepareUpgrade(hermez.address, HermezV2, {
      unsafeAllowCustomTypes: true
    });

    let iface = new ethers.utils.Interface(ProxyAdmin.abi);
    let latest = await ethers.provider.getBlockNumber();
    let blockTimestamp = (await ethers.provider.getBlock(latest)).timestamp;
    let eta = blockTimestamp + 605800;
    await TimelockBuidler.connect(hermezGovernanceEthers).queueTransaction(
      adminAddress,
      0,
      "",
      iface.encodeFunctionData("upgrade", [hermezAuctionProtocol.address, hermezAuctionProtocolV2]),
      eta
    );

    await TimelockBuidler.connect(hermezGovernanceEthers).queueTransaction(
      adminAddress,
      0,
      "",
      iface.encodeFunctionData("upgrade", [hermez.address, hermezV2]),
      eta
    );

    await TimelockBuidler.connect(hermezGovernanceEthers).queueTransaction(
      adminAddress,
      0,
      "",
      iface.encodeFunctionData("transferOwnership", [deployerAddress]),
      eta
    );
    await ethers.provider.send("evm_setNextBlockTimestamp", [eta]);

    await TimelockBuidler.connect(hermezGovernanceEthers).executeTransaction(
      adminAddress,
      0,
      "",
      iface.encodeFunctionData("upgrade", [hermezAuctionProtocol.address, hermezAuctionProtocolV2]),
      eta
    );
    await TimelockBuidler.connect(hermezGovernanceEthers).executeTransaction(
      adminAddress,
      0,
      "",
      iface.encodeFunctionData("upgrade", [hermez.address, hermezV2]),
      eta
    );

    // return the ownerwship to the deployer address for future tests!
    await TimelockBuidler.connect(hermezGovernanceEthers).executeTransaction(
      adminAddress,
      0,
      "",
      iface.encodeFunctionData("transferOwnership", [deployerAddress]),
      eta
    );

    await newHermezAuctionProtocolV2.setVersion();
    expect(await newHermezAuctionProtocolV2.getVersion()).to.be.equal(2);

    await newHermezV2.setVersion();
    expect(await newHermezV2.getVersion()).to.be.equal(2);
  });

});

async function getProxyAdminFactory() {
  return ethers.getContractFactory(ProxyAdmin.abi, ProxyAdmin.bytecode);
}
