const fs = require("fs");
const ethers = require("ethers");
const path = require("path");
const Scalar = require("ffjavascript").Scalar;
const { stringifyBigInts } = require("ffjavascript").utils;
const poseidonHashJs = require("circomlib").poseidon;
const poseidonUnit = require("circomlib/src/poseidon_gencontract");

const nodeUrl = require("./config.json").ethNodeUrl;
const hermezAddress = "0xA68D85dF56E733A06443306A095646317B5Fa633";
const auctionAddress = "0x15468b45eD46C8383F5c0b1b6Cf2EcF403C2AeC2";
const governanceAddressDeploy = "0xf1B3b124842555782F98bE08d1357ABb8013F11c";
const wdAddressDeploy = "0x392361427Ef5e17b69cFDd1294F31ab555c86124";

async function main() {
    // load params
    const provider = new ethers.providers.JsonRpcProvider(nodeUrl);
    const Hermezjson = fs.readFileSync(path.join(__dirname, "./Hermez.json"));
    const abiHermez = JSON.parse(Hermezjson);
    const hermezContract = new ethers.Contract(hermezAddress, abiHermez.abi, provider);

    const auctionJson = fs.readFileSync(path.join(__dirname, "./Auction.json"));
    const abiAuction = JSON.parse(auctionJson);
    const auctionContract = new ethers.Contract(auctionAddress, abiAuction.abi, provider);

    const governanceJson = fs.readFileSync(path.join(__dirname, "./HermezGovernance.json"));
    const abiGovernance = JSON.parse(governanceJson);
    const governanceContract = new ethers.Contract(governanceAddressDeploy, abiGovernance.abi, provider);

    const wdJson = fs.readFileSync(path.join(__dirname, "./WithdrawalDelayer.json"));
    const abiWd = JSON.parse(wdJson);
    const wdContract = new ethers.Contract(wdAddressDeploy, abiWd.abi, provider);

    // read params hermez
    console.log("=====> Params hermez:");

    console.log("Initializer:");
    const filterHermez = hermezContract.filters.InitializeHermezEvent(null, null, null);
    const eventsHermez = await hermezContract.queryFilter(filterHermez, 0, "latest");

    console.log("   forgeL1L2BatchTimeout: ", eventsHermez[0].args.forgeL1L2BatchTimeout);
    console.log("   feeAddToken: ", Number(eventsHermez[0].args.feeAddToken));
    console.log("   withdrawalDelay: ", Number(eventsHermez[0].args.withdrawalDelay));

    console.log("                               address                         maxTx,nLevels");
    const rollupVerifiers_0 = await hermezContract.rollupVerifiers(0);
    console.log(`   rollupVerifiers_0: ${rollupVerifiers_0}`);
    const rollupVerifiers_1 = await hermezContract.rollupVerifiers(1);
    console.log(`   rollupVerifiers_1: ${rollupVerifiers_1}`);

    const withdrawVerifier = await hermezContract.withdrawVerifier();
    console.log("   withdrawVerifier: ", withdrawVerifier);

    const totalTokens = 1;
    const tokenList = [];
    for (let i = 0; i < totalTokens; i++) {
        const tokenInfo = await hermezContract.tokenList(i);
        console.log(`   token ${i}: ${tokenInfo}`);
        tokenList.push(tokenInfo);
    }

    const hermezAuctionContract = await hermezContract.hermezAuctionContract();
    console.log("   hermezAuctionContract: ", hermezAuctionContract);

    const forgeL1L2BatchTimeout = await hermezContract.forgeL1L2BatchTimeout();
    console.log("   forgeL1L2BatchTimeout: ", forgeL1L2BatchTimeout);

    const tokenHEZ = await hermezContract.tokenHEZ();
    console.log("   tokenHEZ: ", tokenHEZ);

    // read instant withdrawal
    console.log("\n\n=====> Params instant withdrawal:");

    const nBuckets = Number(await hermezContract.nBuckets());
    console.log("   nBuckets: ", nBuckets);

    console.log("             ceil, blockSt, with, rateB, rateW, maxW");
    for (let i = 0; i < nBuckets; i++) {
        const bucketData = await hermezContract.buckets(i);
        const decodeBucket = await hermezContract.unpackBucket(bucketData);
        console.log(`   Bucket ${i}: ${decodeBucket}`);
    }

    const hermezGovernanceAddress = await hermezContract.hermezGovernanceAddress();
    console.log("   hermezGovernanceAddress: ", hermezGovernanceAddress);

    const withdrawalDelay = Number(await hermezContract.withdrawalDelay());
    console.log("   withdrawalDelay: ", withdrawalDelay);

    const withdrawDelayerContract = await hermezContract.withdrawDelayerContract();
    console.log("   withdrawDelayerContract: ", withdrawDelayerContract);

    for (tokenAddr of tokenList) {
        const rateExchange = await hermezContract.tokenExchange(tokenAddr);
        console.log(`   rateExchange ${tokenAddr} --> ${rateExchange / 1e10} USD`);
    }

    // read Auction contracts
    console.log("\n\n=====> Params auction:");

    console.log("Initializer:");
    const filterAuction = auctionContract.filters.InitializeHermezAuctionProtocolEvent(null, null, null);
    const eventsAuction = await auctionContract.queryFilter(filterAuction, 0, "latest");

    console.log("   donationAddress: ", eventsAuction[0].args.donationAddress);
    console.log("   bootCoordinatorAddress: ", eventsAuction[0].args.bootCoordinatorAddress);
    console.log("   bootCoordinatorURL: ", eventsAuction[0].args.bootCoordinatorURL);
    console.log("   outbidding: ", eventsAuction[0].args.outbidding);
    console.log("   slotDeadline: ", eventsAuction[0].args.slotDeadline);
    console.log("   closedAuctionSlots: ", eventsAuction[0].args.closedAuctionSlots);
    console.log("   openAuctionSlots: ", eventsAuction[0].args.openAuctionSlots);
    console.log("   allocationRatio: ", eventsAuction[0].args.allocationRatio);

    const tokenHEZauction = await auctionContract.tokenHEZ();
    console.log("   tokenHEZ: ", tokenHEZauction);

    const hermezRollup = await auctionContract.hermezRollup();
    console.log("   hermezRollup: ", hermezRollup);

    const governanceAddress = await auctionContract.governanceAddress();
    console.log("   governanceAddress: ", governanceAddress);

    const genesisBlock = Number(await auctionContract.genesisBlock());
    console.log("   genesisBlock: ", genesisBlock);

    // boot coordinator
    const bootCoordinatorURL = await auctionContract.bootCoordinatorURL();
    console.log("   bootCoordinatorURL: ", bootCoordinatorURL);

    // read governance
    console.log("\n\n=====> Read governance: ");

    const roleAdmin = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const communityCouncilAddress = "0xE5762e2a9ea9Ab4091A5C1FeECD2eDdf988b75e0";
    const hasRole = await governanceContract.hasRole(roleAdmin, communityCouncilAddress);

    console.log(`   communityCouncilAddress ${communityCouncilAddress} has admin role: ${hasRole}`);

    // read withdrawal delayer
    console.log("\n\n=====> Read withdrawal delayer: ");

    console.log("Initializer:");
    const filterWd = wdContract.filters.InitializeWithdrawalDelayerEvent(null, null, null);
    const eventsWd = await wdContract.queryFilter(filterWd, 0, "latest");

    console.log("   initialWithdrawalDelay:", Number(eventsWd[0].args.initialWithdrawalDelay));
    console.log("   initialHermezGovernanceAddress:", eventsWd[0].args.initialHermezGovernanceAddress);
    console.log("   initialEmergencyCouncil:", eventsWd[0].args.initialEmergencyCouncil);

    const hermezRollupAddress = await wdContract.hermezRollupAddress();
    console.log(`   hermezRollupAddress: ${hermezRollupAddress}`);

    // check poseidon hashes
    console.log("=====> Poseidon contracts");
    const poseidonAddr2 = "0x45e5058DE86382BB9815579333a3677c56D6D944";
    const abiPoseidon2 = await poseidonUnit.generateABI(2);
    const poseidon2Contract = new ethers.Contract(poseidonAddr2, abiPoseidon2, provider);
    const resSm2 = await poseidon2Contract["poseidon(uint256[2])"]([1, 2]);
    const resJs2 = poseidonHashJs([1, 2]);
    console.log("\n   Poseidon2 JS: ", resJs2);
    console.log("   Poseidon2 SC: ", Scalar.e(resSm2));

    const poseidonAddr3 = "0xcB2Ebd9fcb570db7B4f723461Efce7E1F3B5B5A3";
    const abiPoseidon3 = await poseidonUnit.generateABI(3);
    const poseidon3Contract = new ethers.Contract(poseidonAddr3, abiPoseidon3, provider);
    const resSm3 = await poseidon3Contract["poseidon(uint256[3])"]([1, 2, 3]);
    const resJs3 = poseidonHashJs([1, 2, 3]);
    console.log("\n   Poseidon3 JS: ", resJs3);
    console.log("   Poseidon3 SC: ", Scalar.e(resSm3));

    const poseidonAddr4 = "0xEf6Efe5E4Db7ac19B740cF125D2a6F85040a7229";
    const abiPoseidon4 = await poseidonUnit.generateABI(4);
    const poseidon4Contract = new ethers.Contract(poseidonAddr4, abiPoseidon4, provider);
    const resSm4 = await poseidon4Contract["poseidon(uint256[4])"]([1, 2, 3, 4]);
    const resJs4 = poseidonHashJs([1, 2, 3, 4]);
    console.log("\n   Poseidon4 JS: ", resJs4);
    console.log("   Poseidon4 SC: ", Scalar.e(resSm4));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}