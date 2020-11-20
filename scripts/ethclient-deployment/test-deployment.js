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
const forgeL1L2BatchTimeout = 10;
const feeAddToken = 10;
const withdrawalDelay = 60 * 60 * 24 * 7 * 2; // 2 weeks
const INITIAL_DELAY = 60; //seconds

async function main() {
    [
        owner,
        governance,
        safetyBot,
        _,
        _,
        _,
        hermezKeeperAddress,
        hermezGovernanceDAOAddress,
        whiteHackGroupAddress,
        donation,
        _,
        aux2,
        hermezTest,
        aux,
        ...addrs
    ] = await ethers.getSigners();

    governanceAddress = await governance.getAddress();
    ownerAddress = await owner.getAddress();
    hermezTestAddress = await hermezTest.getAddress()

    // factory
    const Hermez = await ethers.getContractFactory("HermezTest");
    const TokenHEZ = await ethers.getContractFactory("HEZTokenMockFake");
    const VerifierRollupHelper = await ethers.getContractFactory(
        "VerifierRollupHelper"
    );
    const VerifierWithdrawHelper = await ethers.getContractFactory(
        "VerifierWithdrawHelper"
    );
    const HermezAuctionProtocol = await ethers.getContractFactory(
        "HermezAuctionProtocol"
    );
    const WithdrawalDelayer = await ethers.getContractFactory(
        "WithdrawalDelayer"
    );
    const Poseidon2Elements = new ethers.ContractFactory(
        poseidonUnit.abi,
        poseidonUnit.createCode(2),
        owner
    );

    const Poseidon3Elements = new ethers.ContractFactory(
        poseidonUnit.abi,
        poseidonUnit.createCode(3),
        owner
    );

    const Poseidon4Elements = new ethers.ContractFactory(
        poseidonUnit.abi,
        poseidonUnit.createCode(4),
        owner
    );

    // deploy poseidon libs
    const buidlerPoseidon2Elements = await Poseidon2Elements.deploy();
    const buidlerPoseidon3Elements = await Poseidon3Elements.deploy();
    const buidlerPoseidon4Elements = await Poseidon4Elements.deploy();

    const poseidonAddr2 = buidlerPoseidon2Elements.address;
    const poseidonAddr3 = buidlerPoseidon3Elements.address;
    const poseidonAddr4 = buidlerPoseidon4Elements.address;

    buidlerTokenHermez = await TokenHEZ.deploy(
        await hermezTest.getAddress(),
    );

    await buidlerTokenHermez.deployed();

    let buidlerVerifierRollupHelper = await VerifierRollupHelper.deploy();
    let buidlerVerifierWithdrawHelper = await VerifierWithdrawHelper.deploy();

    //deploy auction protocol
    buidlerHermezAuctionProtocol = await HermezAuctionProtocol.deploy();
    await buidlerHermezAuctionProtocol.deployed();

    // deploy hermez and withdrawal delayer
    let currentCount = await owner.getTransactionCount();

    const WithdrawalDelayerAddress = ethers.utils.getContractAddress({
        nonce: currentCount + 1,
        from: ownerAddress,
    });
    const HermezAddress = ethers.utils.getContractAddress({
        nonce: currentCount + 3,
        from: ownerAddress,
    });

    // Wait for pending blocks
    let current = await time.latestBlock();
    time.advanceBlock();
    let latest = (await time.latestBlock()).toNumber();
    while (current >= latest) {
        sleep(100);
        latest = (await time.latestBlock()).toNumber();
    }

    genesisBlock = latest + 1 + MIN_BLOCKS
    await buidlerHermezAuctionProtocol.hermezAuctionProtocolInitializer(
        buidlerTokenHermez.address,
        genesisBlock,
        HermezAddress,
        governanceAddress,
        await donation.getAddress(), // donation address
        ownerAddress // bootCoordinatorAddress
    );

    buidlerWithdrawalDelayer = await WithdrawalDelayer.deploy();
    await buidlerWithdrawalDelayer.withdrawalDelayerInitializer(
        INITIAL_DELAY,
        HermezAddress,
        hermezKeeperAddress.getAddress(),
        hermezGovernanceDAOAddress.getAddress(),
        whiteHackGroupAddress.getAddress()
    );

    // deploy hermez
    buidlerHermez = await Hermez.deploy();
    await buidlerHermez.deployed();
    // return

    await buidlerHermez.initializeHermez(
        [buidlerVerifierRollupHelper.address],
        calculateInputMaxTxLevels([maxTx], [nLevels]),
        buidlerVerifierWithdrawHelper.address,
        buidlerHermezAuctionProtocol.address,
        buidlerTokenHermez.address,
        forgeL1L2BatchTimeout,
        feeAddToken,
        poseidonAddr2,
        poseidonAddr3,
        poseidonAddr4,
        governanceAddress,
        await safetyBot.getAddress(),
        withdrawalDelay,
        WithdrawalDelayerAddress
    );

    buidlerHermezAuctionProtocolTest = await HermezAuctionProtocol.deploy();
    await buidlerHermezAuctionProtocolTest.deployed();

    // Wait for pending blocks
    current = await time.latestBlock();
    time.advanceBlock();
    latest = (await time.latestBlock()).toNumber();
    while (current >= latest) {
        sleep(100);
        latest = (await time.latestBlock()).toNumber();
    }

    genesisBlockTest = latest + 1 + MIN_BLOCKS
    await buidlerHermezAuctionProtocolTest.hermezAuctionProtocolInitializer(
        buidlerTokenHermez.address,
        genesisBlockTest,
        hermezTestAddress,
        governanceAddress,
        await donation.getAddress(), // donation address
        ownerAddress // bootCoordinatorAddress
    );

    buidlerWithdrawalDelayerTest = await WithdrawalDelayer.deploy();
    await buidlerWithdrawalDelayerTest.deployed()

    await buidlerWithdrawalDelayerTest.withdrawalDelayerInitializer(
        INITIAL_DELAY,
        hermezTestAddress,
        hermezKeeperAddress.getAddress(),
        hermezGovernanceDAOAddress.getAddress(),
        whiteHackGroupAddress.getAddress()
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
            buidlerHermez.address,
            ethers.BigNumber.from("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")
        );

    await buidlerTokenHermez
        .connect(hermezTest)
        .approve(
            buidlerWithdrawalDelayerTest.address,
            ethers.BigNumber.from("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")
        );

    await buidlerTokenHermez
        .connect(governance)
        .approve(
            buidlerHermezAuctionProtocolTest.address,
            ethers.BigNumber.from("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")
        );

    await buidlerTokenHermez
        .connect(governance)
        .approve(
            buidlerHermez.address,
            ethers.BigNumber.from("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")
        );

    await buidlerTokenHermez
        .connect(governance)
        .approve(
            buidlerHermezAuctionProtocol.address,
            ethers.BigNumber.from("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")
        );

    const address = {
        // genesisBlock: genesisBlock,
        genesisBlock: genesisBlockTest,
        auction: buidlerHermezAuctionProtocol.address,
        auctionTest: buidlerHermezAuctionProtocolTest.address,
        tokenHEZ: buidlerTokenHermez.address,
        hermez: buidlerHermez.address,
        wdelayer: buidlerWithdrawalDelayer.address,
        wdelayerTest: buidlerWithdrawalDelayerTest.address
    }

    fs.writeFileSync(pathAddress, JSON.stringify(address, null, 1))
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.log(error);
        process.exit(1)
    })
