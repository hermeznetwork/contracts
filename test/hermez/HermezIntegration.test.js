const {expect} = require("chai");
const {ethers} = require("../../node_modules/@nomiclabs/buidler");
const SMTMemDB = require("circomlib").SMTMemDB;
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const {time} = require("@openzeppelin/test-helpers");

const {
  signBjjAuth,
  l1UserTxCreateAccountDeposit,
  l1UserTxDeposit,
  l1UserTxDepositTransfer,
  l1UserTxCreateAccountDepositTransfer,
  l1UserTxForceTransfer,
  l1UserTxForceExit,
  l1CoordinatorTxEth,
  l1CoordinatorTxBjj,
  AddToken,
  createAccounts,
  ForgerTest,
  calculateInputMaxTxLevels,
  registerERC1820,
} = require("./helpers/helpers");
const {
  float16,
  HermezAccount,
  txUtils,
  stateUtils,
  utils,
  feeTable,
  SMTTmpDb,
  Constants,
  RollupDB,
  BatchBuilder,
} = require("@hermeznetwork/commonjs");

const COORDINATOR_1_URL = "https://hermez.io";
const ERC1820_REGISTRY_DEPLOY_TX =
  "0xf90a388085174876e800830c35008080b909e5608060405234801561001057600080fd5b506109c5806100206000396000f3fe608060405234801561001057600080fd5b50600436106100a5576000357c010000000000000000000000000000000000000000000000000000000090048063a41e7d5111610078578063a41e7d51146101d4578063aabbb8ca1461020a578063b705676514610236578063f712f3e814610280576100a5565b806329965a1d146100aa5780633d584063146100e25780635df8122f1461012457806365ba36c114610152575b600080fd5b6100e0600480360360608110156100c057600080fd5b50600160a060020a038135811691602081013591604090910135166102b6565b005b610108600480360360208110156100f857600080fd5b5035600160a060020a0316610570565b60408051600160a060020a039092168252519081900360200190f35b6100e06004803603604081101561013a57600080fd5b50600160a060020a03813581169160200135166105bc565b6101c26004803603602081101561016857600080fd5b81019060208101813564010000000081111561018357600080fd5b82018360208201111561019557600080fd5b803590602001918460018302840111640100000000831117156101b757600080fd5b5090925090506106b3565b60408051918252519081900360200190f35b6100e0600480360360408110156101ea57600080fd5b508035600160a060020a03169060200135600160e060020a0319166106ee565b6101086004803603604081101561022057600080fd5b50600160a060020a038135169060200135610778565b61026c6004803603604081101561024c57600080fd5b508035600160a060020a03169060200135600160e060020a0319166107ef565b604080519115158252519081900360200190f35b61026c6004803603604081101561029657600080fd5b508035600160a060020a03169060200135600160e060020a0319166108aa565b6000600160a060020a038416156102cd57836102cf565b335b9050336102db82610570565b600160a060020a031614610339576040805160e560020a62461bcd02815260206004820152600f60248201527f4e6f7420746865206d616e616765720000000000000000000000000000000000604482015290519081900360640190fd5b6103428361092a565b15610397576040805160e560020a62461bcd02815260206004820152601a60248201527f4d757374206e6f7420626520616e204552433136352068617368000000000000604482015290519081900360640190fd5b600160a060020a038216158015906103b85750600160a060020a0382163314155b156104ff5760405160200180807f455243313832305f4143434550545f4d4147494300000000000000000000000081525060140190506040516020818303038152906040528051906020012082600160a060020a031663249cb3fa85846040518363ffffffff167c01000000000000000000000000000000000000000000000000000000000281526004018083815260200182600160a060020a0316600160a060020a031681526020019250505060206040518083038186803b15801561047e57600080fd5b505afa158015610492573d6000803e3d6000fd5b505050506040513d60208110156104a857600080fd5b5051146104ff576040805160e560020a62461bcd02815260206004820181905260248201527f446f6573206e6f7420696d706c656d656e742074686520696e74657266616365604482015290519081900360640190fd5b600160a060020a03818116600081815260208181526040808320888452909152808220805473ffffffffffffffffffffffffffffffffffffffff19169487169485179055518692917f93baa6efbd2244243bfee6ce4cfdd1d04fc4c0e9a786abd3a41313bd352db15391a450505050565b600160a060020a03818116600090815260016020526040812054909116151561059a5750806105b7565b50600160a060020a03808216600090815260016020526040902054165b919050565b336105c683610570565b600160a060020a031614610624576040805160e560020a62461bcd02815260206004820152600f60248201527f4e6f7420746865206d616e616765720000000000000000000000000000000000604482015290519081900360640190fd5b81600160a060020a031681600160a060020a0316146106435780610646565b60005b600160a060020a03838116600081815260016020526040808220805473ffffffffffffffffffffffffffffffffffffffff19169585169590951790945592519184169290917f605c2dbf762e5f7d60a546d42e7205dcb1b011ebc62a61736a57c9089d3a43509190a35050565b600082826040516020018083838082843780830192505050925050506040516020818303038152906040528051906020012090505b92915050565b6106f882826107ef565b610703576000610705565b815b600160a060020a03928316600081815260208181526040808320600160e060020a031996909616808452958252808320805473ffffffffffffffffffffffffffffffffffffffff19169590971694909417909555908152600284528181209281529190925220805460ff19166001179055565b600080600160a060020a038416156107905783610792565b335b905061079d8361092a565b156107c357826107ad82826108aa565b6107b85760006107ba565b815b925050506106e8565b600160a060020a0390811660009081526020818152604080832086845290915290205416905092915050565b6000808061081d857f01ffc9a70000000000000000000000000000000000000000000000000000000061094c565b909250905081158061082d575080155b1561083d576000925050506106e8565b61084f85600160e060020a031961094c565b909250905081158061086057508015155b15610870576000925050506106e8565b61087a858561094c565b909250905060018214801561088f5750806001145b1561089f576001925050506106e8565b506000949350505050565b600160a060020a0382166000908152600260209081526040808320600160e060020a03198516845290915281205460ff1615156108f2576108eb83836107ef565b90506106e8565b50600160a060020a03808316600081815260208181526040808320600160e060020a0319871684529091529020549091161492915050565b7bffffffffffffffffffffffffffffffffffffffffffffffffffffffff161590565b6040517f01ffc9a7000000000000000000000000000000000000000000000000000000008082526004820183905260009182919060208160248189617530fa90519096909550935050505056fea165627a7a72305820377f4a2d4301ede9949f163f319021a6e9c687c292a5e2b2c4734c126b524e6c00291ba01820182018201820182018201820182018201820182018201820182018201820a01820182018201820182018201820182018201820182018201820182018201820";
const ERC1820_REGISTRY_ADDRESS = "0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24";
const BLOCKS_PER_SLOT = 40;
let ABIbid = [
  "function bid(uint128 slot, uint128 bidAmount)",
  "function multiBid(uint128 startingSlot,uint128 endingSlot,bool[6] slotEpoch,uint128 maxBid,uint128 minBid)",
];

const MIN_BLOCKS = 81;
let iface = new ethers.utils.Interface(ABIbid);

describe("Hermez integration", function () {
  let buidlerTokenERC777Mock;
  let buidlerHermez;
  let buidlerWithdrawalDelayer;
  let buidlerHermezAuctionProtocol;

  let owner;
  let id1;
  let id2;
  let addrs;
  let hermezGovernanceDAOAddress;

  const accounts = [];
  for (let i = 0; i < 10; i++) {
    accounts.push(new HermezAccount());
  }
  const tokenInitialAmount = ethers.utils.parseEther("100000");
  const maxL1Tx = 256;
  const maxTx = 512;
  const nLevels = 32;
  const forgeL1L2BatchTimeout = 10;
  let chainID;
  const feeAddToken = 10;
  const withdrawalDelay = 60 * 60 * 24 * 7 * 2; // 2 weeks
  const INITIAL_DELAY = 60; //seconds

  beforeEach(async function () {
    [
      owner,
      governance,
      forger1,
      safetyAddress,
      id1,
      id2,
      registryFunder,
      hermezKeeperAddress,
      hermezGovernanceDAOAddress,
      whiteHackGroupAddress,
      donation,
      ...addrs
    ] = await ethers.getSigners();

    hermezGovernanceDAOAddress = await governance.getAddress();
    ownerAddress = await owner.getAddress();

    // factory
    const Hermez = await ethers.getContractFactory("HermezTest");
    const TokenERC777Mock = await ethers.getContractFactory("ERC777Mock");
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

    // deploy registry erc1820
    await registerERC1820(owner);

    // deploy poseidon libs
    const buidlerPoseidon2Elements = await Poseidon2Elements.deploy();
    const buidlerPoseidon3Elements = await Poseidon3Elements.deploy();
    const buidlerPoseidon4Elements = await Poseidon4Elements.deploy();

    const poseidonAddr2 = buidlerPoseidon2Elements.address;
    const poseidonAddr3 = buidlerPoseidon3Elements.address;
    const poseidonAddr4 = buidlerPoseidon4Elements.address;

    buidlerTokenERC777Mock = await TokenERC777Mock.deploy(
      ownerAddress,
      tokenInitialAmount,
      "tokenname",
      "TKN",
      []
    );

    await buidlerTokenERC777Mock.deployed();
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

    const latest = (await time.latestBlock()).toNumber();

    await buidlerHermezAuctionProtocol.hermezAuctionProtocolInitializer(
      buidlerTokenERC777Mock.address,
      latest + 1 + MIN_BLOCKS,
      HermezAddress,
      hermezGovernanceDAOAddress,
      await donation.getAddress(), // donation address
      ownerAddress // bootCoordinatorAddress
    );

    buidlerWithdrawalDelayer = await WithdrawalDelayer.deploy();
    await buidlerWithdrawalDelayer.withdrawalDelayerInitializer(
      INITIAL_DELAY,
      HermezAddress,
      hermezKeeperAddress.getAddress(),
      hermezGovernanceDAOAddress,
      whiteHackGroupAddress.getAddress()
    );
    // deploy hermez
    buidlerHermez = await Hermez.deploy();
    await buidlerHermez.deployed();

    await buidlerHermez.initializeHermez(
      [buidlerVerifierRollupHelper.address],
      calculateInputMaxTxLevels([maxTx], [nLevels]),
      buidlerVerifierWithdrawHelper.address,
      buidlerHermezAuctionProtocol.address,
      buidlerTokenERC777Mock.address,
      forgeL1L2BatchTimeout,
      feeAddToken,
      poseidonAddr2,
      poseidonAddr3,
      poseidonAddr4,
      hermezGovernanceDAOAddress,
      await safetyAddress.getAddress(),
      withdrawalDelay,
      WithdrawalDelayerAddress
    );

    expect(buidlerWithdrawalDelayer.address).to.equal(WithdrawalDelayerAddress);
    expect(buidlerHermez.address).to.equal(HermezAddress);
    const chainSC = await buidlerHermez.getChainID();
    chainID = chainSC.toNumber();
  });

  describe("Forge Batch", function () {
    it("forge L1 user & Coordiator Tx batch using consensus mechanism", async function () {
      // consensus operations
      let startingBlock = (
        await buidlerHermezAuctionProtocol.genesisBlock()
      ).toNumber();

      await buidlerHermezAuctionProtocol
        .connect(owner)
        .setCoordinator(await owner.getAddress(), COORDINATOR_1_URL);

      let data = iface.encodeFunctionData("multiBid", [
        2,
        7,
        [true, true, true, true, true, true],
        ethers.utils.parseEther("11"),
        ethers.utils.parseEther("11"),
      ]);

      await buidlerTokenERC777Mock
        .connect(owner)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("100"),
          data,
          {
            gasLimit: 10000000,
          }
        );

      let block = startingBlock + 3 * BLOCKS_PER_SLOT;

      await time.advanceBlockTo(block);

      // hermez operations
      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float16.float2Fix(float16.fix2Float(1000));
      const fromIdx = 256;
      const toIdx = 257;
      const amountF = float16.fix2Float(10);
      const l1TxUserArray = [];
      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        buidlerHermez,
        rollupDB
      );
      await AddToken(
        buidlerHermez,
        buidlerTokenERC777Mock,
        buidlerTokenERC777Mock,
        await owner.getAddress(),
        feeAddToken
      );

      // In order to add all the possible l1tx we need 2 accounts created in batchbuilder and rollup:
      const numAccounts = 2;
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        owner,
        buidlerHermez,
        buidlerTokenERC777Mock,
        numAccounts,
        true
      );

      // add user l1 tx
      l1TxUserArray.push(
        await l1UserTxCreateAccountDeposit(
          loadAmount,
          tokenID,
          babyjub,
          owner,
          buidlerHermez,
          buidlerTokenERC777Mock,
          true
        )
      );

      l1TxUserArray.push(
        await l1UserTxDeposit(
          loadAmount,
          tokenID,
          fromIdx,
          owner,
          buidlerHermez,
          buidlerTokenERC777Mock,
          true
        )
      );
      l1TxUserArray.push(
        await l1UserTxDepositTransfer(
          loadAmount,
          tokenID,
          fromIdx,
          toIdx,
          amountF,
          owner,
          buidlerHermez,
          buidlerTokenERC777Mock,
          true
        )
      );
      l1TxUserArray.push(
        await l1UserTxCreateAccountDepositTransfer(
          loadAmount,
          tokenID,
          toIdx,
          amountF,
          babyjub,
          owner,
          buidlerHermez,
          buidlerTokenERC777Mock,
          true
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceTransfer(
          tokenID,
          fromIdx,
          toIdx,
          amountF,
          owner,
          buidlerHermez
        )
      );
      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, buidlerHermez)
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      const l1TxCoordiatorArray = [];

      // add Coordiator tx
      l1TxCoordiatorArray.push(
        await l1CoordinatorTxEth(tokenID, babyjub, owner, buidlerHermez)
      );

      l1TxCoordiatorArray.push(
        await l1CoordinatorTxBjj(tokenID, babyjub, buidlerHermez)
      );

      // forge batch with all the L1 tx
      await forgerTest.forgeBatch(true, l1TxUserArray, l1TxCoordiatorArray);
    });
    it("test delayed withdraw with consensus mechanism and withdrawal delayer", async function () {
      // consensus operations
      let startingBlock = (
        await buidlerHermezAuctionProtocol.genesisBlock()
      ).toNumber();

      await buidlerHermezAuctionProtocol
        .connect(owner)
        .setCoordinator(await owner.getAddress(), COORDINATOR_1_URL);

      let data = iface.encodeFunctionData("multiBid", [
        2,
        7,
        [true, true, true, true, true, true],
        ethers.utils.parseEther("11"),
        ethers.utils.parseEther("11"),
      ]);

      await buidlerTokenERC777Mock
        .connect(owner)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("100"),
          data,
          {
            gasLimit: 10000000,
          }
        );

      let block = startingBlock + 3 * BLOCKS_PER_SLOT;

      await time.advanceBlockTo(block);

      // hermez operations

      const tokenID = 1;
      const babyjub = `0x${accounts[0].bjjCompressed}`;
      const loadAmount = float16.float2Fix(float16.fix2Float(1000));
      const fromIdx = 256;
      const amount = 10;
      const amountF = float16.fix2Float(amount);

      const l1TxUserArray = [];

      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const forgerTest = new ForgerTest(
        maxTx,
        maxL1Tx,
        nLevels,
        buidlerHermez,
        rollupDB
      );

      await AddToken(
        buidlerHermez,
        buidlerTokenERC777Mock,
        buidlerTokenERC777Mock,
        await owner.getAddress(),
        feeAddToken
      );

      // Create account and exit some funds
      const numAccounts = 1;
      await createAccounts(
        forgerTest,
        loadAmount,
        tokenID,
        babyjub,
        owner,
        buidlerHermez,
        buidlerTokenERC777Mock,
        numAccounts,
        true
      );

      l1TxUserArray.push(
        await l1UserTxForceExit(tokenID, fromIdx, amountF, owner, buidlerHermez)
      );

      const initialOwnerBalance = await buidlerTokenERC777Mock.balanceOf(
        buidlerWithdrawalDelayer.address
      );

      // forge empty batch
      await forgerTest.forgeBatch(true, [], []);

      // forge batch with all the create account and exit
      await forgerTest.forgeBatch(true, l1TxUserArray, []);

      // perform withdraw
      const instantWithdraw = false;
      const numExitRoot = await buidlerHermez.lastForgedBatch();
      const state = await rollupDB.getStateByIdx(256);
      const exitInfo = await rollupDB.getExitTreeInfo(256, numExitRoot);
      await expect(
        buidlerHermez.withdrawMerkleProof(
          tokenID,
          amount,
          babyjub,
          numExitRoot,
          exitInfo.siblings,
          fromIdx,
          instantWithdraw
        )
      )
        .to.emit(buidlerHermez, "WithdrawEvent")
        .withArgs(fromIdx, numExitRoot, instantWithdraw);
      const finalOwnerBalance = await buidlerTokenERC777Mock.balanceOf(
        buidlerWithdrawalDelayer.address
      );
      expect(parseInt(finalOwnerBalance)).to.equal(
        parseInt(initialOwnerBalance) + 10
      );
    });
  });
});
