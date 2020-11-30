const { ethers } = require("../../node_modules/@nomiclabs/buidler");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const { time } = require("@openzeppelin/test-helpers");

const {
    calculateInputMaxTxLevels
} = require("../../test/hermez/helpers/helpers");
const fs = require("fs");
const path = require("path");
const pathAddress = path.join(__dirname, "./deploy-ouput.json");

const MIN_BLOCKS = 81;
const maxTx = 512;
const nLevels = 32;
const tokenInitialAmount = ethers.BigNumber.from(
    "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
);
const bootCoordinatorURL = "https://boot.coordinator.io";
const forgeL1L2BatchTimeout = 10;
const feeAddToken = 10;
const withdrawalDelay = 60 * 60 * 24 * 7 * 2; // 2 weeks
const INITIAL_WITHDRAWAL_DELAY = 60; //seconds


async function main() {

    // load Mnemonic accounts:
    const signersArray = await ethers.getSigners();

    [
        owner,
        governance,
        emergencyCouncil,
        donation,
        hermezTest,
        aux,
        aux2,
        ...addrs
    ] = signersArray;

    governanceAddress = await governance.getAddress();
    ownerAddress = await owner.getAddress();
    hermezTestAddress = await hermezTest.getAddress()
    emergencyCouncilAddress = await emergencyCouncil.getAddress()
    donationAddress = await donation.getAddress()

    // factory
    const Hermez = await ethers.getContractFactory("HermezTest");
    const HermezAuctionProtocol = await ethers.getContractFactory(
        "HermezAuctionProtocol"
    );
    const WithdrawalDelayer = await ethers.getContractFactory(
        "WithdrawalDelayer"
    );
    const TokenHEZ = await ethers.getContractFactory("HEZTokenMockFake");

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
        owner
    );

    const Poseidon3Elements = new ethers.ContractFactory(
        poseidonUnit.generateABI(3),
        poseidonUnit.createCode(3),
        owner
    );

    const Poseidon4Elements = new ethers.ContractFactory(
        poseidonUnit.generateABI(4),
        poseidonUnit.createCode(4),
        owner
    );

    // Deploy smart contacts:

    // deploy smart contracts with proxy https://github.com/OpenZeppelin/openzeppelin-upgrades/blob/master/packages/plugin-buidler/test/initializers.js
    // or intializer undefined and call initialize later

    // deploy auction protocol
    const hermezAuctionProtocol = await upgrades.deployProxy(
        HermezAuctionProtocol,
        [],
        {
            unsafeAllowCustomTypes: true,
            initializer: undefined,
        }
    );
    await hermezAuctionProtocol.deployed();
    auctionProtocolAddress = hermezAuctionProtocol.address;

    // deploy auction protocol test
    const hermezAuctionProtocolTest = await upgrades.deployProxy(
        HermezAuctionProtocol,
        [],
        {
            unsafeAllowCustomTypes: true,
            initializer: undefined,
        }
    );
    await hermezAuctionProtocolTest.deployed();
    auctionProtocolTestAddress = hermezAuctionProtocolTest.address;

    // Deploy hermez
    const hermez = await upgrades.deployProxy(Hermez, [], {
        unsafeAllowCustomTypes: true,
        initializer: undefined,
    });
    await hermez.deployed();
    hermezAddress = hermez.address;

    // Deploy withdrawalDelayer
    const withdrawalDelayer = await WithdrawalDelayer.deploy();
    await withdrawalDelayer.deployed();
    withdrawalDelayerAddress = withdrawalDelayer.address

    // Deploy withdrawalDelayer test
    const withdrawalDelayerTest = await WithdrawalDelayer.deploy();
    await withdrawalDelayerTest.deployed();
    withdrawalDelayerTestAddress = withdrawalDelayerTest.address

    buidlerTokenHermez = await TokenHEZ.deploy(
        await hermezTest.getAddress(),
    );

    await buidlerTokenHermez.deployed();

    // deploy poseidon libs
    const buidlerPoseidon2Elements = await Poseidon2Elements.deploy();
    const buidlerPoseidon3Elements = await Poseidon3Elements.deploy();
    const buidlerPoseidon4Elements = await Poseidon4Elements.deploy();
    await buidlerPoseidon2Elements.deployed();
    await buidlerPoseidon3Elements.deployed();
    await buidlerPoseidon4Elements.deployed();

    const poseidonAddr2 = buidlerPoseidon2Elements.address;
    const poseidonAddr3 = buidlerPoseidon3Elements.address;
    const poseidonAddr4 = buidlerPoseidon4Elements.address;

    let buidlerVerifierRollupHelper = await VerifierRollupHelper.deploy();
    let buidlerVerifierWithdrawHelper = await VerifierWithdrawHelper.deploy();

    // initialize smart contracts

    await withdrawalDelayer.withdrawalDelayerInitializer(
        INITIAL_WITHDRAWAL_DELAY,
        hermezAddress,
        governanceAddress,
        emergencyCouncilAddress
    );

    await withdrawalDelayerTest.withdrawalDelayerInitializer(
        INITIAL_WITHDRAWAL_DELAY,
        hermezTestAddress,
        governanceAddress,
        emergencyCouncilAddress
    );

    // Wait for pending blocks
    genesisBlock = (await time.latestBlock()).toNumber() + MIN_BLOCKS;

    await hermezAuctionProtocol.hermezAuctionProtocolInitializer(
        buidlerTokenHermez.address,
        genesisBlock,
        hermezAddress,
        governanceAddress,
        donationAddress, // donation address
        ownerAddress, // bootCoordinatorAddress
        bootCoordinatorURL
    );

    // Wait for pending blocks
    genesisBlockTest = (await time.latestBlock()).toNumber() + MIN_BLOCKS;

    await hermezAuctionProtocolTest.hermezAuctionProtocolInitializer(
        buidlerTokenHermez.address,
        genesisBlockTest,
        hermezTestAddress,
        governanceAddress,
        donationAddress, // donation address
        ownerAddress, // bootCoordinatorAddress
        bootCoordinatorURL
    );

    await hermez.initializeHermez(
        [buidlerVerifierRollupHelper.address],
        calculateInputMaxTxLevels([maxTx], [nLevels]),
        buidlerVerifierWithdrawHelper.address,
        hermezAuctionProtocol.address,
        buidlerTokenHermez.address,
        forgeL1L2BatchTimeout,
        feeAddToken,
        poseidonAddr2,
        poseidonAddr3,
        poseidonAddr4,
        governanceAddress,
        withdrawalDelay,
        withdrawalDelayer.address
    );

    await buidlerTokenHermez
        .connect(hermezTest)
        .transfer(
            governanceAddress,
            ethers.utils.parseEther("10000000")
        );

    await buidlerTokenHermez
        .connect(hermezTest)
        .transfer(
            await aux2.getAddress(),
            ethers.utils.parseEther("10000000")
        );

    await buidlerTokenHermez
        .connect(aux2)
        .approve(
            hermez.address,
            tokenInitialAmount
        );

    await buidlerTokenHermez
        .connect(hermezTest)
        .approve(
            withdrawalDelayerTest.address,
            tokenInitialAmount
        );

    await buidlerTokenHermez
        .connect(governance)
        .approve(
            hermezAuctionProtocolTest.address,
            tokenInitialAmount
        );

    await buidlerTokenHermez
        .connect(governance)
        .approve(
            hermez.address,
            tokenInitialAmount
        );

    await buidlerTokenHermez
        .connect(governance)
        .approve(
            hermezAuctionProtocol.address,
            tokenInitialAmount
        );

    const address = {
        // genesisBlock: genesisBlock,
        genesisBlock: genesisBlockTest,
        auction: auctionProtocolAddress,
        auctionTest: auctionProtocolTestAddress,
        tokenHEZ: buidlerTokenHermez.address,
        hermez: hermezAddress,
        wdelayer: withdrawalDelayerAddress,
        wdelayerTest: withdrawalDelayerTestAddress
    }

    fs.writeFileSync(pathAddress, JSON.stringify(address, null, 1))
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.log(error);
        process.exit(1)
    })
