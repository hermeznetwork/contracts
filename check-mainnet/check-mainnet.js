const fs = require("fs");
const ethers = require("ethers");
const path = require("path");
const Scalar = require("ffjavascript").Scalar;
const { stringifyBigInts } = require("ffjavascript").utils;

const nodeUrl = "your_eth_node_url";
const hermezAddress = "0xA7bFf53521C43fC50BBaee79C05527C959d0a571";
const auctionAddress = "0xaC4224a5A7d1cB789Edd45159B986a86A670Bd23";
const governanceAddressDeploy = "0xf1B3b124842555782F98bE08d1357ABb8013F11c";
const wdAddressDeploy = "0xbD9264F01452F3Ee9BFC269779ecB3dD1cb10BCD";

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

    console.log("                               address                         maxTx,nLevels");
    const rollupVerifiers_0 = await hermezContract.rollupVerifiers(0);
    console.log(`   rollupVerifiers_0: ${rollupVerifiers_0}`);
    const rollupVerifiers_1 = await hermezContract.rollupVerifiers(1);
    console.log(`   rollupVerifiers_1: ${rollupVerifiers_1}`);

    const withdrawVerifier = await hermezContract.withdrawVerifier();
    console.log("   withdrawVerifier: ", withdrawVerifier);

    const totalTokens = 6;
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
    console.log("=====> Params instant withdrawal:");

    const nBuckets = Number(await hermezContract.nBuckets());
    console.log("   nBuckets: ", nBuckets);

    console.log("             ceil, blockSt, with, rateB, rateW, maxW");
    for (let i = 0; i < nBuckets; i++) {
        const bucketData = await hermezContract.buckets(i);
        const decodeBucket = await hermezContract.unpackBucket(bucketData);
        console.log(`   Bucket ${i}: ${decodeBucket}`);
    }

    const hermezGovernanceAddress = await hermezContract.hermezGovernanceAddress();
    console.log("hermezGovernanceAddress: ", hermezGovernanceAddress);

    const withdrawalDelay = Number(await hermezContract.withdrawalDelay());
    console.log("withdrawalDelay: ", withdrawalDelay);

    const withdrawDelayerContract = await hermezContract.withdrawDelayerContract();
    console.log("withdrawDelayerContract: ", withdrawDelayerContract);

    for (tokenAddr of tokenList) {
        const rateExchange = await hermezContract.tokenExchange(tokenAddr);
        console.log(`   rateExchange ${tokenAddr} --> ${rateExchange / 1e10} USD`);
    }

    // read Auction contracts
    console.log("=====> Params auction:");

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
    console.log("=====> Read governance: ");

    const roleAdmin = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const communityCouncilAddress = "0xE5762e2a9ea9Ab4091A5C1FeECD2eDdf988b75e0";
    const hasRole = await governanceContract.hasRole(roleAdmin, communityCouncilAddress);

    console.log(`   communityCouncilAddress ${communityCouncilAddress} has admin role: ${hasRole}`);

    // read withdrawal delayer
    console.log("=====> Read withdrawal delayer: ");

    const hermezRollupAddress = await wdContract.hermezRollupAddress();
    console.log(`   hermezRollupAddress: ${hermezRollupAddress}`);
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