const {
  ethers
} = require("@nomiclabs/buidler");
const {
  expect
} = require("chai");

const {
  time
} = require("@openzeppelin/test-helpers");


const ERC1820_REGISTRY_ADDRESS = "0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24";
const ERC1820_REGISTRY_DEPLOY_TX =
  "0xf90a388085174876e800830c35008080b909e5608060405234801561001057600080fd5b506109c5806100206000396000f3fe608060405234801561001057600080fd5b50600436106100a5576000357c010000000000000000000000000000000000000000000000000000000090048063a41e7d5111610078578063a41e7d51146101d4578063aabbb8ca1461020a578063b705676514610236578063f712f3e814610280576100a5565b806329965a1d146100aa5780633d584063146100e25780635df8122f1461012457806365ba36c114610152575b600080fd5b6100e0600480360360608110156100c057600080fd5b50600160a060020a038135811691602081013591604090910135166102b6565b005b610108600480360360208110156100f857600080fd5b5035600160a060020a0316610570565b60408051600160a060020a039092168252519081900360200190f35b6100e06004803603604081101561013a57600080fd5b50600160a060020a03813581169160200135166105bc565b6101c26004803603602081101561016857600080fd5b81019060208101813564010000000081111561018357600080fd5b82018360208201111561019557600080fd5b803590602001918460018302840111640100000000831117156101b757600080fd5b5090925090506106b3565b60408051918252519081900360200190f35b6100e0600480360360408110156101ea57600080fd5b508035600160a060020a03169060200135600160e060020a0319166106ee565b6101086004803603604081101561022057600080fd5b50600160a060020a038135169060200135610778565b61026c6004803603604081101561024c57600080fd5b508035600160a060020a03169060200135600160e060020a0319166107ef565b604080519115158252519081900360200190f35b61026c6004803603604081101561029657600080fd5b508035600160a060020a03169060200135600160e060020a0319166108aa565b6000600160a060020a038416156102cd57836102cf565b335b9050336102db82610570565b600160a060020a031614610339576040805160e560020a62461bcd02815260206004820152600f60248201527f4e6f7420746865206d616e616765720000000000000000000000000000000000604482015290519081900360640190fd5b6103428361092a565b15610397576040805160e560020a62461bcd02815260206004820152601a60248201527f4d757374206e6f7420626520616e204552433136352068617368000000000000604482015290519081900360640190fd5b600160a060020a038216158015906103b85750600160a060020a0382163314155b156104ff5760405160200180807f455243313832305f4143434550545f4d4147494300000000000000000000000081525060140190506040516020818303038152906040528051906020012082600160a060020a031663249cb3fa85846040518363ffffffff167c01000000000000000000000000000000000000000000000000000000000281526004018083815260200182600160a060020a0316600160a060020a031681526020019250505060206040518083038186803b15801561047e57600080fd5b505afa158015610492573d6000803e3d6000fd5b505050506040513d60208110156104a857600080fd5b5051146104ff576040805160e560020a62461bcd02815260206004820181905260248201527f446f6573206e6f7420696d706c656d656e742074686520696e74657266616365604482015290519081900360640190fd5b600160a060020a03818116600081815260208181526040808320888452909152808220805473ffffffffffffffffffffffffffffffffffffffff19169487169485179055518692917f93baa6efbd2244243bfee6ce4cfdd1d04fc4c0e9a786abd3a41313bd352db15391a450505050565b600160a060020a03818116600090815260016020526040812054909116151561059a5750806105b7565b50600160a060020a03808216600090815260016020526040902054165b919050565b336105c683610570565b600160a060020a031614610624576040805160e560020a62461bcd02815260206004820152600f60248201527f4e6f7420746865206d616e616765720000000000000000000000000000000000604482015290519081900360640190fd5b81600160a060020a031681600160a060020a0316146106435780610646565b60005b600160a060020a03838116600081815260016020526040808220805473ffffffffffffffffffffffffffffffffffffffff19169585169590951790945592519184169290917f605c2dbf762e5f7d60a546d42e7205dcb1b011ebc62a61736a57c9089d3a43509190a35050565b600082826040516020018083838082843780830192505050925050506040516020818303038152906040528051906020012090505b92915050565b6106f882826107ef565b610703576000610705565b815b600160a060020a03928316600081815260208181526040808320600160e060020a031996909616808452958252808320805473ffffffffffffffffffffffffffffffffffffffff19169590971694909417909555908152600284528181209281529190925220805460ff19166001179055565b600080600160a060020a038416156107905783610792565b335b905061079d8361092a565b156107c357826107ad82826108aa565b6107b85760006107ba565b815b925050506106e8565b600160a060020a0390811660009081526020818152604080832086845290915290205416905092915050565b6000808061081d857f01ffc9a70000000000000000000000000000000000000000000000000000000061094c565b909250905081158061082d575080155b1561083d576000925050506106e8565b61084f85600160e060020a031961094c565b909250905081158061086057508015155b15610870576000925050506106e8565b61087a858561094c565b909250905060018214801561088f5750806001145b1561089f576001925050506106e8565b506000949350505050565b600160a060020a0382166000908152600260209081526040808320600160e060020a03198516845290915281205460ff1615156108f2576108eb83836107ef565b90506106e8565b50600160a060020a03808316600081815260208181526040808320600160e060020a0319871684529091529020549091161492915050565b7bffffffffffffffffffffffffffffffffffffffffffffffffffffffff161590565b6040517f01ffc9a7000000000000000000000000000000000000000000000000000000008082526004820183905260009182919060208160248189617530fa90519096909550935050505056fea165627a7a72305820377f4a2d4301ede9949f163f319021a6e9c687c292a5e2b2c4734c126b524e6c00291ba01820182018201820182018201820182018201820182018201820182018201820a01820182018201820182018201820182018201820182018201820182018201820";

const COORDINATOR_1_URL = "https://hermez.io";
const COORDINATOR_2_URL = "https://second.hermez.io";

const TIMEOUT = 40000;
const MIN_BLOCKS = 81;


let ABIbid = [
  "function bid(uint128 slot, uint128 bidAmount, address producer)",
  "function multiBid(uint128 startingSlot,uint128 endingSlot,bool[6] slotEpoch,uint128 maxBid,uint128 minBid,address forger)",
];
let iface = new ethers.utils.Interface(ABIbid);

describe("Consensus Protocol Bidding", function() {
  this.timeout(40000);

  let buidlerHEZToken;
  let buidlerHermezAuctionProtocol;
  let owner,
    coordinator1,
    producer1,
    coordinator2,
    producer2,
    registryFunder,
    hermezRollup,
    donation,
    bootCoordinator,
    governance;

  let governanceAddress, hermezRollupAddress, donationAddress;

  // Deploy
  before(async function() {
    const HEZToken = await ethers.getContractFactory("ERC777Mock");

    [
      owner,
      coordinator1,
      producer1,
      coordinator2,
      producer2,
      registryFunder,
      hermezRollup,
      donation,
      bootCoordinator,
      governance,
      ...addrs
    ] = await ethers.getSigners();

    governanceAddress = await governance.getAddress();
    bootCoordinator = await governance.getAddress();
    hermezRollupAddress = await hermezRollup.getAddress();
    donationAddress = await donation.getAddress();

    if ((await ethers.provider.getCode(ERC1820_REGISTRY_ADDRESS)) == "0x") {
      await registryFunder.sendTransaction({
        to: "0xa990077c3205cbDf861e17Fa532eeB069cE9fF96",
        value: ethers.utils.parseEther("0.08"),
      });
      await ethers.provider.sendTransaction(ERC1820_REGISTRY_DEPLOY_TX);
    }

    buidlerHEZToken = await HEZToken.deploy(
      await owner.getAddress(),
      ethers.utils.parseEther("1000000"),
      "HEZToken",
      "HEZ",
      []
    );
    await buidlerHEZToken.deployed();
  });

  beforeEach(async function() {
    const HermezAuctionProtocol = await ethers.getContractFactory(
      "HermezAuctionProtocol"
    );


    // To deploy our contract, we just have to call Token.deploy() and await
    // for it to be deployed(), which happens onces its transaction has been
    // mined.
    buidlerHermezAuctionProtocol = await HermezAuctionProtocol.deploy();
    await buidlerHermezAuctionProtocol.deployed();

    let current = await time.latestBlock();
    time.advanceBlock();
    let latest = (await time.latestBlock()).toNumber();
    while (current >= latest) {
      sleep(100);
      latest = (await time.latestBlock()).toNumber();
    }

    await buidlerHermezAuctionProtocol.hermezAuctionProtocolInitializer(
      buidlerHEZToken.address,
      latest + MIN_BLOCKS,
      hermezRollupAddress,
      governanceAddress,
      donationAddress,
      bootCoordinator
    );
    // Send tokens to coordinators addresses
    await buidlerHEZToken
      .connect(owner)
      .send(
        await coordinator1.getAddress(),
        ethers.utils.parseEther("10000"),
        ethers.utils.toUtf8Bytes("")
      );

    await buidlerHEZToken
      .connect(owner)
      .send(
        await coordinator2.getAddress(),
        ethers.utils.parseEther("10000"),
        ethers.utils.toUtf8Bytes("")
      );
    // Register Coordinator
    await buidlerHermezAuctionProtocol
      .connect(coordinator1)
      .registerCoordinator(await producer1.getAddress(), COORDINATOR_1_URL);
    // Register Coordinator
    await buidlerHermezAuctionProtocol
      .connect(coordinator2)
      .registerCoordinator(await producer2.getAddress(), COORDINATOR_2_URL);
  });

  describe("Call bid", function() {
    it("should revert if getMinBidBySlot for an already closed bid", async function() {
      // Try to consult the minBid of a slot with closed auction
      await expect(
        buidlerHermezAuctionProtocol.getMinBidBySlot(0)
      ).to.be.revertedWith("Auction has already been closed");
    });

    it("should revert when send HEZ without data", async function() {
      // Send tokens without data about bid method
      await expect(
        buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("11"),
          ethers.utils.toUtf8Bytes("")
        )
      ).to.be.revertedWith("Send HEZ without data");
    });

    it("should revert when amount send is different to the call amount", async function() {
      // Encode bid data
      let data = iface.encodeFunctionData("bid", [
        2,
        ethers.utils.parseEther("12"),
        await producer1.getAddress(),
      ]);
      // Send tokens and bid data (amount != call amount)
      await expect(
        buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("11"),
          data
        )
      ).to.be.revertedWith("Do not have enough balance");
    });

    it("should revert when the coordinator is not registered", async function() {
      // Encode bid data with unregistered coordinator address
      let data = iface.encodeFunctionData("bid", [
        2,
        ethers.utils.parseEther("11"),
        await owner.getAddress(),
      ]);
      // Try to send a bid with an unregistered coordinator address
      await expect(
        buidlerHEZToken
        .connect(owner)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("11"),
          data
        )
      ).to.be.revertedWith("Coordinator not registered");
    });

    it("should call bid 11HEZ@2 ", async function() {
      // Event NewBid
      let eventNewBid = new Promise((resolve, reject) => {
        filter = buidlerHermezAuctionProtocol.filters.NewBid();
        buidlerHermezAuctionProtocol.on(filter, () => {
          resolve();
        });

        // After 10s, we throw a timeout error
        setTimeout(() => {
          reject(new Error("timeout while waiting for event"));
        }, TIMEOUT);
      });
      // Encode bid data
      let data = iface.encodeFunctionData("bid", [
        2,
        ethers.utils.parseEther("11"),
        await producer1.getAddress(),
      ]);
      // Send tokens with bid data
      await buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("11"),
          data
        );
      await eventNewBid;
    });

    it("should call multiBid 11HEZ@5-10 ", async function() {
      // Encode multibid data
      let data = iface.encodeFunctionData("multiBid", [
        5,
        10,
        [false, true, false, true, false, true],
        ethers.utils.parseEther("11"),
        ethers.utils.parseEther("11"),
        await producer1.getAddress(),
      ]);
      let overrides = {
        // The maximum units of gas for the transaction to use
        gasLimit: 10000000,
      };
      // Send tokens with multibid data
      await buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("10000"),
          data,
          overrides
        );
    });

    it("should revert when call multiBid without enough balanace", async function() {
      // Info multibid data: multiBid(uint128 startingSlot,uint128 endingSlot, bool[6] memory slotEpochs, uint128 maxBid, uint128 closedMinBid, address forgerAddress)
      // Encode multibid data
      let data = iface.encodeFunctionData("multiBid", [
        5,
        10,
        [true, true, true, true, true, true],
        ethers.utils.parseEther("11"),
        ethers.utils.parseEther("11"),
        await producer1.getAddress(),
      ]);
      // Send tokens with multibid data without enough balance
      await expect(
        buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("10"),
          data
        )
      ).to.be.revertedWith("Do not have enough balance");
    });

    it("should make a complex bidding with multiBid", async function() {
      let coordinator1Address = await coordinator1.getAddress();
      let producer1Address = await producer1.getAddress();
      // Get how much HEZ tokens are pending to be claimed for coordinator1Address
      let prevBalance = await buidlerHermezAuctionProtocol.getClaimableHEZ(
        coordinator1Address
      );
      expect(prevBalance).to.be.equal(0);
      // Encode multibid data
      let data = iface.encodeFunctionData("multiBid", [
        10,
        20,
        [true, false, true, false, true, false],
        ethers.utils.parseEther("30"),
        ethers.utils.parseEther("20"),
        producer1Address,
      ]);
      // Send tokens with multibid data
      await buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("1000"),
          data
        );
      // Get how much HEZ tokens are pending to be claimed for coordinator1Address
      let postBalance = await buidlerHermezAuctionProtocol.getClaimableHEZ(
        coordinator1Address
      );

      // 10 * [ 1 , 0 , 1 , 0 , 1 , 0 ] => 6 slots -> 6 * 20 = 120 HEZ
      // 1000 HEZ - 120 HEZ = 880 HEZ
      expect(postBalance).to.be.equal(ethers.utils.parseEther("880"));
      // Encode multibid data
      data = iface.encodeFunctionData("multiBid", [
        10,
        20,
        [true, false, true, false, true, false],
        ethers.utils.parseEther("30"),
        ethers.utils.parseEther("20"),
        producer1Address,
      ]);
      // Send tokens with multibid data
      await buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("0"),
          data
        );
      // Get how much HEZ tokens are pending to be claimed for coordinator1Address
      postBalance = await buidlerHermezAuctionProtocol.getClaimableHEZ(
        coordinator1Address
      );

      // 20 * 1.1 * [ 1 , 0 , 1 , 0 , 1 , 0 ] => 6 slots -> 6 * 22 = 132 HEZ
      // Diff: 132 HEZ - 120 HEZ = 12 HEZ -> 880 HEZ - 12 HEZ -> 868 HEZ
      expect(postBalance).to.be.equal(ethers.utils.parseEther("868"));
      // Send tokens with multibid data
      await buidlerHEZToken
        .connect(coordinator2)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("0"),
          iface.encodeFunctionData("bid", [
            11,
            ethers.utils.parseEther("800"),
            await producer1.getAddress(),
          ])
        );
      // Get how much HEZ tokens are pending to be claimed for coordinator1Address
      postBalance = await buidlerHermezAuctionProtocol.getClaimableHEZ(
        coordinator1Address
      );
      // Get coordinator1Address balance before claiming the tokens
      let preHEZBalance = await buidlerHEZToken.balanceOf(coordinator1Address);
      // Claim the tokens
      await buidlerHermezAuctionProtocol.claimHEZ(coordinator1Address);
      // Check that there are no tokens left to claim
      expect(
        await buidlerHermezAuctionProtocol.getClaimableHEZ(coordinator1Address)
      ).to.be.equal(0);
      // Check that the coordinator1Address balance has been updated
      let postHEZBalance = await buidlerHEZToken.balanceOf(coordinator1Address);
      expect(postHEZBalance).to.be.equal(preHEZBalance.add(postBalance));
    });

    it("should revert when call multiBid for a slot already closed", async function() {
      // Encode multibid data with slot already closed
      let data = iface.encodeFunctionData("multiBid", [
        1,
        2,
        [true, true, true, true, true, true],
        ethers.utils.parseEther("11"),
        ethers.utils.parseEther("11"),
        await producer1.getAddress(),
      ]);
      // Send tokens and multibid data
      await expect(
        buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("10000"),
          data
        )
      ).to.be.revertedWith("Auction has already been closed");
    });

    it("should revert when call multiBid for a slot that is not open yet", async function() {
      // Encode multibid data with slot that is not open yet
      let data = iface.encodeFunctionData("multiBid", [
        10000,
        10001,
        [true, true, true, true, true, true],
        ethers.utils.parseEther("11"),
        ethers.utils.parseEther("11"),
        await producer1.getAddress(),
      ]);
      // Send tokens and multibid data
      await expect(
        buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("10000"),
          data
        )
      ).to.be.revertedWith("Bid has not been opened yet");
    });

    it("should set the minbid for a multiBid", async function() {
      // Encode multibid data
      let data = iface.encodeFunctionData("multiBid", [
        5,
        10,
        [true, true, true, true, true, true],
        ethers.utils.parseEther("15"),
        ethers.utils.parseEther("0"),
        await producer1.getAddress(),
      ]);
      // Send tokens and multibid data
      await buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("100"),
          data
        );
      for (let i = 5; i < 10; i++) {
        // Check that the minBid of the slots 5-10 has been updated
        expect(
          (await buidlerHermezAuctionProtocol.slots(i)).bidAmount
        ).to.be.equal(ethers.utils.parseEther("11"));
      }
    });

    it("should set the minbid for a multiBid if maxBid is enough", async function() {
      let producer = await producer1.getAddress();

      // Change minBid of slot set
      await buidlerHermezAuctionProtocol
        .connect(governance)
        .changeDefaultSlotSetBid(0, ethers.utils.parseEther("123456789"));
      // Encode multibid data
      let data = iface.encodeFunctionData("multiBid", [
        5,
        11,
        [true, true, true, true, true, true],
        ethers.utils.parseEther("15"),
        ethers.utils.parseEther("0"),
        producer,
      ]);
      // Send tokens and multibid data
      await buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("100"),
          data
        );
      // Check that forger is producer
      expect((await buidlerHermezAuctionProtocol.slots(5)).forger).to.be.equal(
        producer
      );
      // The minbid has been updated, the bid has not been enough
      // Check that forger is 0x00
      expect((await buidlerHermezAuctionProtocol.slots(6)).forger).to.be.equal(
        ethers.constants.AddressZero
      );
      for (let i = 7; i < 12; i++) {
        // Check that forger is producer
        expect(
          (await buidlerHermezAuctionProtocol.slots(i)).forger
        ).to.be.equal(producer);
      }
    });

    it("should make an exact multiBid", async function() {
      // Encode multibid data
      let data = iface.encodeFunctionData("multiBid", [
        5,
        5,
        [true, true, true, true, true, true],
        ethers.utils.parseEther("15"),
        ethers.utils.parseEther("15"),
        await producer1.getAddress(),
      ]);
      // Send exact tokens and multibid data
      await buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("15"),
          data
        );
    });

    it("should when maxBid < closedMinBid", async function() {
      // Encode multibid data with maxBid < closedMinBid
      let data = iface.encodeFunctionData("multiBid", [
        5,
        10,
        [true, true, true, true, true, true],
        ethers.utils.parseEther("10"),
        ethers.utils.parseEther("15"),
        await producer1.getAddress(),
      ]);
      // Send tokens and multibid data
      await expect(
        buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("100"),
          data
        )
      ).to.be.revertedWith("maxBid should be >= closedMinBid");
    });

    it("should revert when call multibid from a non registered coordinator", async function() {
      // Encode multibid data with non registered coordinator
      let data = iface.encodeFunctionData("multiBid", [
        5,
        10,
        [true, true, true, true, true, true],
        ethers.utils.parseEther("12"),
        ethers.utils.parseEther("12"),
        await owner.getAddress(),
      ]);
      // Send tokens and multibid data
      await expect(
        buidlerHEZToken
        .connect(owner)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("100"),
          data
        )
      ).to.be.revertedWith("Coordinator not registered");
    });

    it("should revert when calling to a not valid method", async function() {
      // Encode invalid bid data
      let ABIbidFake = [
        "function newBid(uint256 slot, uint256 bidAmount, address producer)",
      ];
      let ifaceFake = new ethers.utils.Interface(ABIbidFake);
      let data = ifaceFake.encodeFunctionData("newBid", [
        2,
        ethers.utils.parseEther("11"),
        await producer1.getAddress(),
      ]);
      // Send tokens and invalid bid data
      await expect(
        buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("11"),
          data
        )
      ).to.be.revertedWith("Not a valid calldata");
    });
    it("should call bid 12HEZ@2 -> 11HEZ@2 -> 14HEZ@2", async function() {
      // Event NewBid
      let eventNewBid = new Promise((resolve, reject) => {
        filter = buidlerHermezAuctionProtocol.filters.NewBid();
        buidlerHermezAuctionProtocol.on(filter, () => {
          resolve();
        });

        // After 10s, we throw a timeout error
        setTimeout(() => {
          reject(new Error("timeout while waiting for event"));
        }, TIMEOUT);
      });
      // Encode bid data with amount = 12
      let data = iface.encodeFunctionData("bid", [
        2,
        ethers.utils.parseEther("12"),
        await producer1.getAddress(),
      ]);
      // Send tokens and bid data
      await buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("12"),
          data
        );
      // Send tokens and bid data with amount = 11 (previous bid = 12)
      await expect(
        buidlerHEZToken
        .connect(coordinator2)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("11"),
          iface.encodeFunctionData("bid", [
            2,
            ethers.utils.parseEther("11"),
            await producer1.getAddress(),
          ])
        )
      ).to.be.revertedWith("Bid below minimum");
      let prevBalance = await buidlerHermezAuctionProtocol.getClaimableHEZ(
        await coordinator1.getAddress()
      );
      // Send tokens and bid data with amount = 14
      await buidlerHEZToken
        .connect(coordinator2)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("14"),
          iface.encodeFunctionData("bid", [
            2,
            ethers.utils.parseEther("14"),
            await producer2.getAddress(),
          ])
        );

      let postBalance = await buidlerHermezAuctionProtocol.getClaimableHEZ(
        await coordinator1.getAddress()
      );
      // Check that previous coordinator can withdraw the previous bid
      expect(postBalance).to.be.equal(
        prevBalance.add(ethers.utils.parseEther("12"))
      );
      await eventNewBid;
    });

    it("should revert when bid 10HEZ@0 and 10HEZ@1", async function() {
      // Send tokens and bid data with slot with closed auction
      await expect(
        buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("14"),
          iface.encodeFunctionData("bid", [
            0,
            ethers.utils.parseEther("14"),
            await producer1.getAddress(),
          ])
        )
      ).to.be.revertedWith("Auction has already been closed");
      // Send tokens and bid data with slot with closed auction
      await expect(
        buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("14"),
          iface.encodeFunctionData("bid", [
            1,
            ethers.utils.parseEther("14"),
            await producer1.getAddress(),
          ])
        )
      ).to.be.revertedWith("Auction has already been closed");
    });

    it("should revert when bid 10HEZ@(openAuctionSlots + closeAuctionSlots) and 10HEZ@(openAuctionSlots + closeAuctionSlots + 10)", async function() {
      // Send tokens and bid data with slot with auction that has not yet been opened
      await expect(
        buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("14"),
          iface.encodeFunctionData("bid", [
            4322,
            ethers.utils.parseEther("14"),
            await producer1.getAddress(),
          ])
        )
      ).to.be.revertedWith("Bid has not been opened yet");
      // Send tokens and bid data with slot with auction that has not yet been opened
      await expect(
        buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("14"),
          iface.encodeFunctionData("bid", [
            4323,
            ethers.utils.parseEther("14"),
            await producer1.getAddress(),
          ])
        )
      ).to.be.revertedWith("Bid has not been opened yet");
    });
    // Send tokens and bid data with bid below minimum bid
    it("should revert when bid below minimal bid", async function() {
      await expect(
        buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("10"),
          iface.encodeFunctionData("bid", [
            2,
            ethers.utils.parseEther("10"),
            await producer1.getAddress(),
          ])
        )
      ).to.be.revertedWith("Bid below minimum");
    });

    it("should revert if claimHEZ revert", async function() {
      // Encode bid data
      let data = iface.encodeFunctionData("bid", [
        2,
        ethers.utils.parseEther("12"),
        await producer1.getAddress(),
      ]);
      // Send tokens and bid data
      await buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("12"),
          data
        );
      // Send tokens and bid data
      await buidlerHEZToken
        .connect(coordinator2)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("14"),
          iface.encodeFunctionData("bid", [
            2,
            ethers.utils.parseEther("14"),
            await producer2.getAddress(),
          ])
        );
      // Check that the coordinator can withdraw the tokens from the previous bid
      expect(
        await buidlerHermezAuctionProtocol.getClaimableHEZ(
          await coordinator1.getAddress()
        )
      ).to.be.equal(ethers.utils.parseEther("12"));

      await buidlerHEZToken.connect(coordinator1).setTransferRevert(true);

      await expect(
        buidlerHermezAuctionProtocol.claimHEZ(await coordinator1.getAddress())
      ).to.be.revertedWith("Token Transfer Failed");
    });

    it("should change the min bid price", async function() {
      for (i = 0; i < 6; i++) {
        // Change minBids
        await buidlerHermezAuctionProtocol
          .connect(governance)
          .changeDefaultSlotSetBid(i, ethers.utils.parseEther((i * 100).toString()));
      }
      for (i = 0; i < 6; i++) {
        // Check update minBids
        expect(
          await buidlerHermezAuctionProtocol.getDefaultSlotSetBid(i)
        ).to.be.equal(ethers.utils.parseEther((i * 100).toString()));
      }
      // Send tokens and bid data with amount < minBid
      await expect(
        buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("10"),
          iface.encodeFunctionData("bid", [
            2,
            ethers.utils.parseEther("10"),
            await producer1.getAddress(),
          ])
        )
      ).to.be.revertedWith("Bid below minimum");
      // Send tokens and bid data with amount > minBid
      await buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("330"),
          iface.encodeFunctionData("bid", [
            2,
            ethers.utils.parseEther("330"),
            await producer1.getAddress(),
          ])
        );

      // Check same behavior next slot set
      await expect(
        buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("10"),
          iface.encodeFunctionData("bid", [
            2 + 6,
            ethers.utils.parseEther("10"),
            await producer1.getAddress(),
          ])
        )
      ).to.be.revertedWith("Bid below minimum");
      buidlerHEZToken
        .connect(coordinator1)
        .send(
          buidlerHermezAuctionProtocol.address,
          ethers.utils.parseEther("330"),
          iface.encodeFunctionData("bid", [
            2 + 6,
            ethers.utils.parseEther("330"),
            await producer1.getAddress(),
          ])
        );
    });
  });
});

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}