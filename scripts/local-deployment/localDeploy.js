const path = require("path");
const pathDeployParameters = path.join(__dirname, "./deploy_parameters.json");
const pathOutputJson = path.join(__dirname, "./deploy_output.json");
const deployParameters = require(pathDeployParameters);

process.env.BUIDLER_NETWORK = deployParameters.buidlerNetwork;
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


const INITIAL_WITHDRAWAL_DELAY = 3600; //seconds
const maxTxVerifierConstant = 512;
const nLevelsVeriferConstant = 32;
const tokenInitialAmount = ethers.BigNumber.from(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
);
const bootCoordinatorURL = "https://boot.coordinator.io";


async function main() {
  // compìle contracts
  await bre.run("compile");

  // load Mnemonic accounts:
  const signersArray = await ethers.getSigners();

  // index 0 would use as the deployer address
  const [deployer] = signersArray;

  // Default index to load ethereum addresses if not specified on deploy parameters
  const hermezGovernanceIndex = 1;
  const emergencyCouncilIndex = 2;
  const donationIndex = 3;
  const bootCoordinatorIndex = 4;

  const hermezGovernanceEthers = signersArray[hermezGovernanceIndex];
  const emergencyCouncilEthers = signersArray[emergencyCouncilIndex];
  const donationEthers = signersArray[donationIndex];
  const bootCoordinatorEthers = signersArray[bootCoordinatorIndex];

  // get chain ID
  const chainId = (await ethers.provider.getNetwork()).chainId;

  // fund the accounts with ether
  const numAccountsFund = deployParameters[chainId].numAccountsFund
    ? deployParameters[chainId].numAccountsFund
    : 0;

  // get address
  const emergencyCouncilAddress =
    deployParameters[chainId].emergencyCouncilAddress ||
    (await emergencyCouncilEthers.getAddress());
  const hermezGovernanceAddress =
    deployParameters[chainId].hermezGovernanceAddress ||
    (await hermezGovernanceEthers.getAddress());
  const donationAddress =
    deployParameters[chainId].donationAddress ||
    (await donationEthers.getAddress());
  const bootCoordinatorAddress =
    deployParameters[chainId].bootCoordinatorAddress ||
    (await bootCoordinatorEthers.getAddress());

  console.log("emergencyCouncilAddress: " + emergencyCouncilAddress);
  console.log("hermezGovernanceAddress: " + hermezGovernanceAddress);
  console.log("donationAddress: " + donationAddress);
  console.log("bootCoordinatorAddress: " + bootCoordinatorAddress);

  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  console.log("Account balance:", (await deployer.getBalance()).toString());

  // get contract factorys
  let Hermez;
  if (deployParameters.test == true) {
    Hermez = await ethers.getContractFactory("HermezTest");
  } else {
    Hermez = await ethers.getContractFactory("Hermez");
  }

  const HermezAuctionProtocol = await ethers.getContractFactory(
    "HermezAuctionProtocol"
  );
  const WithdrawalDelayer = await ethers.getContractFactory(
    "WithdrawalDelayer"
  );
  const HEZToken = await ethers.getContractFactory("ERC20PermitMock");

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

  // deploy smart contracts with proxy https://github.com/OpenZeppelin/openzeppelin-upgrades/blob/master/packages/plugin-buidler/test/initializers.js
  // or intializer undefined and call initialize later

  // Deploy auction with proxy
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
  const withdrawalDelayer = await WithdrawalDelayer.deploy();
  await withdrawalDelayer.deployed();

  console.log("withdrawalDelayer deployed at: ", withdrawalDelayer.address);

  // deploy HEZ (erc20Permit) token
  const buidlerHEZToken = await HEZToken.deploy(
    "tokenname",
    "TKN",
    await deployer.getAddress(),
    tokenInitialAmount
  );
  await buidlerHEZToken.deployed();
  console.log("HEZToken deployed at: ", buidlerHEZToken.address);

  // fund accounts with HEZ tokens
  if (numAccountsFund > 0) {
    // fund all accounts with tokens
    const accountToFund = await ethers.getSigners();
    for (let i = 0; i < numAccountsFund; i++) {
      await buidlerHEZToken.transfer(
        await accountToFund[i].getAddress(),
        ethers.utils.parseEther("10000")
      );
    }
  }
  // load or deploy libs

  // poseidon libs
  let libposeidonsAddress = deployParameters[chainId].libposeidonsAddress;
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

  // verifiers rollup libs
  let libVerifiersAddress = deployParameters[chainId].libVerifiersAddress;
  if (!libVerifiersAddress || libVerifiersAddress.length == 0) {
    let buidlerVerifierRollupHelper = await VerifierRollupHelper.deploy();
    await buidlerVerifierRollupHelper.deployed();
    libVerifiersAddress = [buidlerVerifierRollupHelper.address];
  }

  // maxTx and nLevelsVerifer must have the same number of elements as verifiers
  let maxTxVerifier = deployParameters[chainId].maxTxVerifier;
  let nLevelsVerifer = deployParameters[chainId].nLevelsVerifer;
  if (
    !maxTxVerifier ||
    !nLevelsVerifer ||
    maxTxVerifier.length != nLevelsVerifer.length ||
    maxTxVerifier.length != libVerifiersAddress.length
  ) {
    maxTxVerifier = [];
    nLevelsVerifer = [];
    libVerifiersAddress.forEach(() => {
      maxTxVerifier.push(maxTxVerifierConstant);
      nLevelsVerifer.push(nLevelsVeriferConstant);
    });
  }

  // verifier withdraw lib
  let libverifiersWithdrawAddress =
    deployParameters[chainId].libVerifiersWithdrawAddress;
  if (!libverifiersWithdrawAddress) {
    let buidlerVerifierWithdrawHelper = await VerifierWithdrawHelper.deploy();
    await buidlerVerifierWithdrawHelper.deployed();
    libverifiersWithdrawAddress = buidlerVerifierWithdrawHelper.address;
  }

  // initialize upgradable smart contracts

  // initialize withdrawal delayer
  await withdrawalDelayer.withdrawalDelayerInitializer(
    INITIAL_WITHDRAWAL_DELAY,
    hermez.address,
    hermezGovernanceAddress,
    emergencyCouncilAddress
  );

  console.log("withdrawalDelayer initialized");

  // initialize auction hermez
  let genesisBlock = deployParameters[chainId].genesisBlock;
  if (genesisBlock == "") {
    genesisBlock =
      (await time.latestBlock()).toNumber() +
      parseInt(deployParameters[chainId].genesisBlockOffsetCurrent);
  }

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

  await hermez.initializeHermez(
    libVerifiersAddress,
    calculateInputMaxTxLevels(maxTxVerifier, nLevelsVerifer),
    libverifiersWithdrawAddress,
    hermezAuctionProtocol.address,
    buidlerHEZToken.address,
    deployParameters[chainId].forgeL1L2BatchTimeout,
    deployParameters[chainId].feeAddToken,
    libposeidonsAddress[0],
    libposeidonsAddress[1],
    libposeidonsAddress[2],
    hermezGovernanceAddress,
    deployParameters[chainId].withdrawalDelay,
    withdrawalDelayer.address
  );

  console.log("hermez Initialized");

  // in case the mnemonic accounts are used, return the index, otherwise, return null
  const outputJson = {
    hermezAuctionProtocolAddress: hermezAuctionProtocol.address,
    hermezAddress: hermez.address,
    withdrawalDelayeAddress: withdrawalDelayer.address,
    HEZTokenAddress: buidlerHEZToken.address,
    hermezGovernanceIndex: deployParameters[chainId]
      .hermezGovernanceAddress
      ? null
      : hermezGovernanceIndex,
    hermezGovernanceAddress,
    emergencyCouncilIndex: deployParameters[chainId].emergencyCouncilAddress
      ? null
      : emergencyCouncilIndex,
    emergencyCouncilAddress,
    donationIndex: deployParameters[chainId].donationAddress
      ? null
      : donationIndex,
    donationAddress,
    bootCoordinatorIndex: deployParameters[chainId].bootCoordinatorAddress
      ? null
      : bootCoordinatorIndex,
    bootCoordinatorAddress,
    accountsFunded: numAccountsFund,
    buidlerNetwork: deployParameters.buidlerNetwork,
    mnemonic: deployParameters.mnemonic,
    test: deployParameters.test
  };

  fs.writeFileSync(pathOutputJson, JSON.stringify(outputJson, null, 1));
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
