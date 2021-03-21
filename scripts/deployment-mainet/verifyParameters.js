require("dotenv").config();
const hre = require("hardhat");
const {ethers} = require("hardhat");
const path = require("path");

const pathDeployParameters = path.join(__dirname, "./deploy_parameters.json");
const deployParameters = require(pathDeployParameters);
const {expect} = require("chai");
const poseidonHashJs = require("circomlib").poseidon;

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

  // verify hermez parameters:
  console.log("Verify HermezAuctionProtocol deployment");
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

  console.log("check poseidon libs in the initialize function");
}


// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });