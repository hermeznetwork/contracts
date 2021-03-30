require("dotenv").config();
const hre = require("hardhat");
const {ethers} = require("hardhat");
const path = require("path");

const pathDeployParameters = path.join(__dirname, "./deploy_parameters.json");
const deployParameters = require(pathDeployParameters);
const {expect} = require("chai");
const poseidonHashJs = require("circomlib").poseidon;
const poseidonUnit = require("circomlib/src/poseidon_gencontract");

const {
  calculateInputMaxTxLevels,
} = require("../../test/hermez/helpers/helpers");
const pathDeployOutputParameters = path.join(__dirname, "./deploy_output.json");
const deployOutputParameters = require(pathDeployOutputParameters);

async function main() {

  // compìle contracts
  await hre.run("compile");
  const Hermez = await ethers.getContractFactory("Hermez");
  const HermezAuctionProtocol = await ethers.getContractFactory(
    "HermezAuctionProtocol"
  );
  const WithdrawalDelayer = await ethers.getContractFactory(
    "WithdrawalDelayer"
  );
  const HermezGovernance = await ethers.getContractFactory(
    "HermezGovernance"
  );

  const TimeLock = await ethers.getContractFactory(
    "Timelock"
  );

  const HermezContract = Hermez.attach(deployOutputParameters.hermezAddress);
  const HermezAuctionProtocolContract = HermezAuctionProtocol.attach(deployOutputParameters.hermezAuctionProtocolAddress);
  const WithdrawalDelayerContract = WithdrawalDelayer.attach(deployOutputParameters.withdrawalDelayeAddress);
  const HermezGovernanceContract = HermezGovernance.attach(deployOutputParameters.hermezGovernanceAddress);
  const TimeLockContract = TimeLock.attach(deployOutputParameters.timeLockAddress);

  // verify withdrawal Delayer parameters:
  console.log("Verify withdrawal delayer deployment");
  const MAX_WITHDRAWAL_DELAY = ethers.BigNumber.from(60*60*24*7*2);
  const MAX_EMERGENCY_MODE_TIME = ethers.BigNumber.from(60*60*24*7*26);
  const hermezRollupAddress = deployOutputParameters.hermezAddress;
  expect(await WithdrawalDelayerContract.MAX_WITHDRAWAL_DELAY()).to.be.equal(MAX_WITHDRAWAL_DELAY);
  expect(await WithdrawalDelayerContract.MAX_EMERGENCY_MODE_TIME()).to.be.equal(MAX_EMERGENCY_MODE_TIME);
  expect(await WithdrawalDelayerContract.hermezRollupAddress()).to.be.equal(hermezRollupAddress);
  expect(await WithdrawalDelayerContract.getWithdrawalDelay()).to.be.equal(deployParameters.initialWithdrawalDelay);
  expect(await WithdrawalDelayerContract.getHermezGovernanceAddress()).to.be.equal( deployOutputParameters.hermezGovernanceAddress);
  expect(await WithdrawalDelayerContract.getEmergencyCouncil()).to.be.equal(deployOutputParameters.emergencyCouncilAddress);

  // verify timelock parameters:
  console.log("Verify timelock deployment");
  const GRACE_PERIOD = ethers.BigNumber.from(60*60*24*14);
  const MINIMUM_DELAY = ethers.BigNumber.from(60*60*24*2);
  const MAXIMUM_DELAY = ethers.BigNumber.from(60*60*24*30);
  const admin = deployOutputParameters.hermezGovernanceAddress;
  const delay = deployParameters.timeLockDelay;
  expect(await TimeLockContract.GRACE_PERIOD()).to.be.equal(GRACE_PERIOD);
  expect(await TimeLockContract.MINIMUM_DELAY()).to.be.equal(MINIMUM_DELAY);
  expect(await TimeLockContract.MAXIMUM_DELAY()).to.be.equal(MAXIMUM_DELAY);
  expect(await TimeLockContract.admin()).to.be.equal(admin);
  expect(await TimeLockContract.delay()).to.be.equal(delay);

  // verify Governance parameters:
  console.log("Verify Governance deployment");
  const defaultAdminRole = await HermezGovernanceContract.DEFAULT_ADMIN_ROLE();
  expect(await HermezGovernanceContract.hasRole(defaultAdminRole, deployParameters.communitCouncilAddress)).to.be.equal(true);

  // verify HermezAuctionProtocolContract parameters:
  console.log("Verify HermezAuctionProtocol deployment");
  const tokenHEZ = deployOutputParameters.HEZTokenAddress;
  const genesisBlock = deployParameters.genesisBlock;
  const hermezRollup = deployOutputParameters.hermezAddress;
  const governanceAddress =  deployOutputParameters.hermezGovernanceAddress;
  const bootCoordinatorURL =  deployParameters.bootCoordinatorURL;
  const _donationAddress = deployOutputParameters.donationAddress;
  const _bootCoordinator = deployOutputParameters.bootCoordinatorAddress;
  expect(await HermezAuctionProtocolContract.tokenHEZ()).to.be.equal(tokenHEZ);
  expect(await HermezAuctionProtocolContract.genesisBlock()).to.be.equal(genesisBlock);
  expect(await HermezAuctionProtocolContract.hermezRollup()).to.be.equal(hermezRollup);
  expect(await HermezAuctionProtocolContract.governanceAddress()).to.be.equal(governanceAddress);
  expect(await HermezAuctionProtocolContract.bootCoordinatorURL()).to.be.equal(bootCoordinatorURL);
  expect(await HermezAuctionProtocolContract.getDonationAddress()).to.be.equal(_donationAddress);
  expect(await HermezAuctionProtocolContract.getBootCoordinator()).to.be.equal(_bootCoordinator);

  const outbidding = 1000;
  const slotDeadline = 20;
  const closedAuctionSlots = 2;
  const openAuctionSlots = 4320;
  const allocationRatio = [4000, 4000, 2000];
  const filterInitializeAuction = HermezAuctionProtocolContract.filters.InitializeHermezAuctionProtocolEvent(null, null, null);
  const eventsInitializeAuction = await HermezAuctionProtocolContract.queryFilter(filterInitializeAuction, 0, "latest");
  expect(eventsInitializeAuction[0].args.donationAddress).to.be.equal(deployOutputParameters.donationAddress);
  expect(eventsInitializeAuction[0].args.bootCoordinatorAddress).to.be.equal(deployOutputParameters.bootCoordinatorAddress);
  expect(eventsInitializeAuction[0].args.bootCoordinatorURL).to.be.equal(deployParameters.bootCoordinatorURL);
  expect(eventsInitializeAuction[0].args.outbidding).to.be.equal(outbidding);
  expect(eventsInitializeAuction[0].args.slotDeadline).to.be.equal(slotDeadline);
  expect(eventsInitializeAuction[0].args.closedAuctionSlots).to.be.equal(closedAuctionSlots);
  expect(eventsInitializeAuction[0].args.openAuctionSlots).to.be.equal(openAuctionSlots);
  expect(eventsInitializeAuction[0].args.allocationRatio[0]).to.be.equal(allocationRatio[0]);
  expect(eventsInitializeAuction[0].args.allocationRatio[1]).to.be.equal(allocationRatio[1]);
  expect(eventsInitializeAuction[0].args.allocationRatio[2]).to.be.equal(allocationRatio[2]);

  const tx = await ethers.provider.getTransaction(eventsInitializeAuction[0].transactionHash);
  const decodeInitializeAuction = HermezAuctionProtocolContract.interface.decodeFunctionData("hermezAuctionProtocolInitializer",tx.data);
  expect(decodeInitializeAuction.token).to.be.equal(tokenHEZ);
  expect(decodeInitializeAuction.genesis).to.be.equal(genesisBlock);
  expect(decodeInitializeAuction.hermezRollupAddress).to.be.equal(hermezRollup);
  expect(decodeInitializeAuction._governanceAddress).to.be.equal(governanceAddress);
  expect(decodeInitializeAuction.donationAddress).to.be.equal(deployOutputParameters.donationAddress);
  expect(decodeInitializeAuction.bootCoordinatorAddress).to.be.equal(deployOutputParameters.bootCoordinatorAddress);
  expect(decodeInitializeAuction._bootCoordinatorURL).to.be.equal(deployParameters.bootCoordinatorURL);


  // verify hermez parameters:
  console.log("Verify Hermez deployment");
  const rollupVerifiersAddress = deployOutputParameters.libVerifiersAddress;

  for (let i = 0; i < rollupVerifiersAddress.length; i++) {
    const verifier = await HermezContract.rollupVerifiers(i);
    expect(verifier.verifierInterface).to.be.equal(rollupVerifiersAddress[i]);
    expect(verifier.maxTx).to.be.equal(deployParameters.maxTxVerifier[i]);
    expect(verifier.nLevels).to.be.equal(deployParameters.nLevelsVerifer[i]);
  }

  const withdrawVerifier = deployOutputParameters.libverifiersWithdrawAddress;
  const hermezAuctionContract =  deployOutputParameters.hermezAuctionProtocolAddress;
  //const tokenHEZ = deployOutputParameters.HEZTokenAddress; same as before
  const forgeL1L2BatchTimeout = deployParameters.forgeL1L2BatchTimeout;
  const feeAddToken = deployParameters.feeAddToken;
  const hermezGovernanceAddress = deployOutputParameters.hermezGovernanceAddress;
  const withdrawalDelay = deployParameters.withdrawalDelayHermez;
  const withdrawDelayerContract = deployOutputParameters.withdrawalDelayeAddress;

  expect(await HermezContract.withdrawVerifier()).to.be.equal(withdrawVerifier);
  expect(await HermezContract.hermezAuctionContract()).to.be.equal(hermezAuctionContract);
  expect(await HermezContract.tokenHEZ()).to.be.equal(tokenHEZ);
  expect(await HermezContract.forgeL1L2BatchTimeout()).to.be.equal(forgeL1L2BatchTimeout);
  expect(await HermezContract.feeAddToken()).to.be.equal(feeAddToken);
  expect(await HermezContract.hermezGovernanceAddress()).to.be.equal(hermezGovernanceAddress);
  expect(await HermezContract.withdrawalDelay()).to.be.equal(withdrawalDelay);
  expect(await HermezContract.withdrawDelayerContract()).to.be.equal(withdrawDelayerContract);

  const filterInitializeHermez = HermezContract.filters.InitializeHermezEvent(null, null, null);
  const eventsInitializeHermez = await HermezContract.queryFilter(filterInitializeHermez, 0, "latest");
  expect(eventsInitializeHermez[0].args.forgeL1L2BatchTimeout).to.be.equal(deployParameters.forgeL1L2BatchTimeout);
  expect(eventsInitializeHermez[0].args.feeAddToken).to.be.equal(deployParameters.feeAddToken);
  expect(eventsInitializeHermez[0].args.withdrawalDelay).to.be.equal(deployParameters.withdrawalDelayHermez);

  const txHermez = await ethers.provider.getTransaction(eventsInitializeHermez[0].transactionHash);
  const decodeInitializeHermez = HermezContract.interface.decodeFunctionData("initializeHermez", txHermez.data);

  const poseidonAddress2 = "0x45e5058DE86382BB9815579333a3677c56D6D944";
  const poseidonAddress3 = "0xcB2Ebd9fcb570db7B4f723461Efce7E1F3B5B5A3";
  const poseidonAddress4 = "0xEf6Efe5E4Db7ac19B740cF125D2a6F85040a7229";

  expect(decodeInitializeHermez._verifiers[0]).to.be.equal(deployOutputParameters.libVerifiersAddress[0]);
  expect(decodeInitializeHermez._verifiers[1]).to.be.equal(deployOutputParameters.libVerifiersAddress[1]);

  expect(decodeInitializeHermez._verifiersParams[0]).to.be.equal(calculateInputMaxTxLevels(deployParameters.maxTxVerifier, deployParameters.nLevelsVerifer)[0]);
  expect(decodeInitializeHermez._verifiersParams[1]).to.be.equal(calculateInputMaxTxLevels(deployParameters.maxTxVerifier, deployParameters.nLevelsVerifer)[1]);

  expect(decodeInitializeHermez._withdrawVerifier).to.be.equal(deployOutputParameters.libverifiersWithdrawAddress);
  expect(decodeInitializeHermez._hermezAuctionContract).to.be.equal(deployOutputParameters.hermezAuctionProtocolAddress);
  expect(decodeInitializeHermez._tokenHEZ).to.be.equal(deployOutputParameters.HEZTokenAddress);
  expect(decodeInitializeHermez._forgeL1L2BatchTimeout).to.be.equal(deployParameters.forgeL1L2BatchTimeout);
  expect(decodeInitializeHermez._feeAddToken).to.be.equal(deployParameters.feeAddToken);
  expect(decodeInitializeHermez._poseidon2Elements).to.be.equal(poseidonAddress2);
  expect(decodeInitializeHermez._poseidon3Elements).to.be.equal(poseidonAddress3);
  expect(decodeInitializeHermez._poseidon4Elements).to.be.equal(poseidonAddress4);
  expect(decodeInitializeHermez._hermezGovernanceAddress).to.be.equal(deployOutputParameters.hermezGovernanceAddress);
  expect(decodeInitializeHermez._withdrawalDelay).to.be.equal(deployParameters.withdrawalDelayHermez);
  expect(decodeInitializeHermez._withdrawDelayerContract).to.be.equal(deployOutputParameters.withdrawalDelayeAddress);

  //verify Poseidon
  [owner] = await ethers.getSigners();

  let Poseidon2Elements = new ethers.ContractFactory(
    poseidonUnit.generateABI(2),
    poseidonUnit.createCode(2),
    owner
  );

  let Poseidon3Elements = new ethers.ContractFactory(
    poseidonUnit.generateABI(3),
    poseidonUnit.createCode(3),
    owner
  );

  let Poseidon4Elements = new ethers.ContractFactory(
    poseidonUnit.generateABI(4),
    poseidonUnit.createCode(4),
    owner
  );

  Poseidon2Elements = Poseidon2Elements.attach(poseidonAddress2);
  Poseidon3Elements = Poseidon3Elements.attach(poseidonAddress3);
  Poseidon4Elements = Poseidon4Elements.attach(poseidonAddress4);

  const resJs = poseidonHashJs([1, 2]);
  const resSm = await Poseidon2Elements["poseidon(uint256[2])"]([1, 2]);
  expect(resJs.toString()).to.be.equal(resSm.toString());

  const resJs3 = poseidonHashJs([1, 2, 3]);
  const resSm3 = await Poseidon3Elements["poseidon(uint256[3])"]([1, 2, 3]);
  expect(resJs3.toString()).to.be.equal(resSm3.toString());

  const resJs4 = poseidonHashJs([1, 2, 3, 4]);

  const resSm4 = await Poseidon4Elements["poseidon(uint256[4])"]([
    1,
    2,
    3,
    4,
  ]);
  expect(resJs4.toString()).to.be.equal(resSm4.toString());
}


// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });