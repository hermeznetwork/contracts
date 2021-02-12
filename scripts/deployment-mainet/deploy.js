const {expect} = require("chai");
require("dotenv").config();
const path = require("path");
const bre = require("@nomiclabs/buidler");
const { ethers, upgrades } = require("@nomiclabs/buidler");

require("@openzeppelin/test-helpers/configure")({
  provider: ethers.provider._buidlerProvider._url || "http://localhost:8545",
});
const { time } = require("@openzeppelin/test-helpers");

const fs = require("fs");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");

const {
  calculateInputMaxTxLevels,
} = require("../../test/hermez/helpers/helpers");


const maxTxVerifierDefault = [512, 376, 376];
const nLevelsVeriferDefault = [32, 32, 32];
const verifierTypeDefault = ["mock","mock", "real"];
const tokenInitialAmount = ethers.BigNumber.from(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
);

const inputDeployFile = process.argv[2];
const pathDeployParameters = path.join(__dirname, inputDeployFile || "./deploy_parameters.json");
const deployParameters = require(pathDeployParameters);

const pathOutputJson = deployParameters.pathOutputJson || path.join(__dirname, "./deploy_output.json");

async function main() {

  // compìle contracts
  await bre.run("compile");

  // load Mnemonic accounts:
  const signersArray = await ethers.getSigners();

  // index 0 would use as the deployer address
  const [deployer] = signersArray;

  // get address
  const emergencyCouncilAddress =
    deployParameters.emergencyCouncilAddress ||
    (await deployer.getAddress());
  const communitCouncilAddress =
    deployParameters.communitCouncilAddress ||
    (await deployer.getAddress());
  const donationAddress =
    deployParameters.donationAddress ||
    (await deployer.getAddress());
  const bootCoordinatorAddress =
    deployParameters.bootCoordinatorAddress ||
    (await deployer.getAddress());

  console.log("if not address specified deployer address will be used!");
  console.log("emergencyCouncilAddress: " + emergencyCouncilAddress);
  console.log("communitCouncilAddress: " + communitCouncilAddress);
  console.log("donationAddress: " + donationAddress);
  console.log("bootCoordinatorAddress: " + bootCoordinatorAddress);

  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  console.log("Account balance:", (await deployer.getBalance()).toString());

  // get contract factorys
  let Hermez = await ethers.getContractFactory("Hermez");

  const HermezAuctionProtocol = await ethers.getContractFactory(
    "HermezAuctionProtocol"
  );
  const WithdrawalDelayer = await ethers.getContractFactory(
    "WithdrawalDelayer"
  );
  const HEZToken = await ethers.getContractFactory("ERC20PermitMock");

  // hermez libs
  const VerifierWithdrawHelper = await ethers.getContractFactory(
    "VerifierWithdraw"
  );

  const HermezGovernance = await ethers.getContractFactory(
    "HermezGovernance"
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
  // Deploy Governance

  let hermezGovernanceAddress =
    deployParameters.hermezGovernanceAddress;
  if (!hermezGovernanceAddress) {
    // deploy Hermez Governance
    const buidlerHermezGovernance = await HermezGovernance.deploy(communitCouncilAddress);
    await buidlerHermezGovernance.deployed();

    hermezGovernanceAddress = buidlerHermezGovernance.address;
    console.log("Hermez Governance Address deployed at: ", hermezGovernanceAddress);
  }
  else {
    console.log("Hermez Governance Address already deployed");
  }
  
  //Deploy auction with proxy
  const hermezAuctionProtocol = await upgrades.deployProxy(
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
  const hermez = await upgrades.deployProxy(Hermez, [], {
    unsafeAllowCustomTypes: true,
    initializer: undefined,
  });
  await hermez.deployed();

  console.log("hermez deployed at: ", hermez.address);

  // Deploy withdrawalDelayer
  const withdrawalDelayer = await WithdrawalDelayer.deploy(
    deployParameters.initialWithdrawalDelay,
    hermez.address,
    hermezGovernanceAddress,
    emergencyCouncilAddress
  );
  await withdrawalDelayer.deployed();

  const filterInitialize = withdrawalDelayer.filters.InitializeWithdrawalDelayerEvent(null, null, null);
  const eventsInitialize = await withdrawalDelayer.queryFilter(filterInitialize, 0, "latest");
  expect(eventsInitialize[0].args.initialWithdrawalDelay).to.be.equal(deployParameters.initialWithdrawalDelay);
  expect(eventsInitialize[0].args.initialHermezGovernanceAddress).to.be.equal(hermezGovernanceAddress);
  expect(eventsInitialize[0].args.initialEmergencyCouncil).to.be.equal(emergencyCouncilAddress);

  console.log("withdrawalDelayer deployed at: ", withdrawalDelayer.address);

  let buidlerHEZToken;
  let HEZTokenAddress =
    deployParameters.HEZTokenAddress;
  if (!HEZTokenAddress) {
    // deploy HEZ (erc20Permit) token
    buidlerHEZToken = await HEZToken.deploy(
      "HEZ token",
      "HEZ",
      await deployer.getAddress(),
      tokenInitialAmount
    );
    await buidlerHEZToken.deployed();

    HEZTokenAddress = buidlerHEZToken.address;
    console.log("HEZToken deployed at: ", HEZTokenAddress);
  }
  else {
    console.log("HEZ already deployed");
  }
  // load or deploy libs

  // poseidon libs
  let libposeidonsAddress = deployParameters.libposeidonsAddress;
  if (!libposeidonsAddress || libposeidonsAddress.length != 3) {
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
  } else {
    console.log("posidon libs already depoloyed");
  }


  // maxTx and nLevelsVerifer must have the same number of elements as verifiers
  let maxTxVerifier = deployParameters.maxTxVerifier || maxTxVerifierDefault;
  let nLevelsVerifer = deployParameters.nLevelsVerifer || nLevelsVeriferDefault;

  // verifiers rollup libs
  let libVerifiersAddress = deployParameters.libVerifiersAddress;

  // assert maxTx Nlevels and libVerifiersAddress match
  expect(maxTxVerifier.length).to.be.equal(nLevelsVerifer.length);
  if (libVerifiersAddress && libVerifiersAddress.length != 0) { 
    expect(maxTxVerifier.length).to.be.equal(libVerifiersAddress.length);
  }

  if (!libVerifiersAddress || libVerifiersAddress.length == 0) {
    libVerifiersAddress = [];
    console.log("deployed verifiers libs");
    for (let i = 0; i < maxTxVerifier.length; i++) {
      const VerifierRollupReal = await ethers.getContractFactory(
        `Verifier${maxTxVerifier[i]}`
      );
      const buidlerVerifierRollupReal = await VerifierRollupReal.deploy();
      await buidlerVerifierRollupReal.deployed();
      libVerifiersAddress.push(buidlerVerifierRollupReal.address);
      console.log("verifiers Real deployed at: ", buidlerVerifierRollupReal.address);
    }
  } else {
    console.log("verifier libs already depoloyed");
  }


  // verifier withdraw lib
  let libverifiersWithdrawAddress =
    deployParameters.libVerifiersWithdrawAddress;
  if (!libverifiersWithdrawAddress) {
    let buidlerVerifierWithdrawHelper = await VerifierWithdrawHelper.deploy();
    await buidlerVerifierWithdrawHelper.deployed();
    libverifiersWithdrawAddress = buidlerVerifierWithdrawHelper.address;
    console.log("deployed withdraw verifiers libs");
    console.log("withdraw verifiers deployed at: ", libverifiersWithdrawAddress);
  } else {
    console.log("withdraw verifier libs already depoloyed");
  }

  // initialize upgradable smart contracts

  // initialize auction hermez
  let genesisBlock = deployParameters.genesisBlock;
  if (genesisBlock == "") {
    genesisBlock =
    (await time.latestBlock()).toNumber() +
      parseInt(deployParameters.genesisBlockOffsetCurrent);
  }

  const outbidding = 1000;
  const slotDeadline = 20;
  const closedAuctionSlots = 2;
  const openAuctionSlots = 4320;
  const allocationRatio = [4000, 4000, 2000];

  const hermezAuctionTx = await hermezAuctionProtocol.hermezAuctionProtocolInitializer(
    HEZTokenAddress,
    genesisBlock,
    hermez.address,
    hermezGovernanceAddress,
    donationAddress,
    bootCoordinatorAddress,
    deployParameters.bootCoordinatorURL
  );
  const receiptAuction = await hermezAuctionTx.wait();
  expect(receiptAuction.events[0].args.donationAddress).to.be.equal(donationAddress);
  expect(receiptAuction.events[0].args.bootCoordinatorAddress).to.be.equal(bootCoordinatorAddress);
  expect(receiptAuction.events[0].args.bootCoordinatorURL).to.be.equal(deployParameters.bootCoordinatorURL);
  expect(receiptAuction.events[0].args.outbidding).to.be.equal(outbidding);
  expect(receiptAuction.events[0].args.slotDeadline).to.be.equal(slotDeadline);
  expect(receiptAuction.events[0].args.closedAuctionSlots).to.be.equal(closedAuctionSlots);
  expect(receiptAuction.events[0].args.openAuctionSlots).to.be.equal(openAuctionSlots);
  expect(receiptAuction.events[0].args.allocationRatio[0]).to.be.equal(allocationRatio[0]);
  expect(receiptAuction.events[0].args.allocationRatio[1]).to.be.equal(allocationRatio[1]);
  expect(receiptAuction.events[0].args.allocationRatio[2]).to.be.equal(allocationRatio[2]);

  console.log("hermezAuctionProtocol Initialized");

  // initialize Hermez

  const hermezTx = await hermez.initializeHermez(
    libVerifiersAddress,
    calculateInputMaxTxLevels(maxTxVerifier, nLevelsVerifer),
    libverifiersWithdrawAddress,
    hermezAuctionProtocol.address,
    HEZTokenAddress,
    deployParameters.forgeL1L2BatchTimeout,
    deployParameters.feeAddToken,
    libposeidonsAddress[0],
    libposeidonsAddress[1],
    libposeidonsAddress[2],
    hermezGovernanceAddress,
    deployParameters.withdrawalDelayHermez,
    withdrawalDelayer.address
  );
  const receiptHermez = await hermezTx.wait();
  expect(receiptHermez.events[0].args.forgeL1L2BatchTimeout).to.be.equal(deployParameters.forgeL1L2BatchTimeout);
  expect(receiptHermez.events[0].args.feeAddToken).to.be.equal(deployParameters.feeAddToken);
  expect(receiptHermez.events[0].args.withdrawalDelay).to.be.equal(deployParameters.withdrawalDelayHermez);

  console.log("hermez Initialized");

  // in case the mnemonic accounts are used, return the index, otherwise, return null
  const outputJson = {
    hermezAuctionProtocolAddress: hermezAuctionProtocol.address,
    hermezAddress: hermez.address,
    withdrawalDelayeAddress: withdrawalDelayer.address,
    HEZTokenAddress: HEZTokenAddress,
    hermezGovernanceAddress,
    emergencyCouncilAddress,
    donationAddress,
    bootCoordinatorAddress,
    communitCouncilAddress,
    libVerifiersAddress,
    libverifiersWithdrawAddress,
    network: process.env.BUIDLER_NETWORK
  };

  fs.writeFileSync(pathOutputJson, JSON.stringify(outputJson, null, 1));
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
