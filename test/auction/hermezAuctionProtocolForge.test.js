 const {
   ethers
 } = require("@nomiclabs/buidler");
 const {
   expect
 } = require("chai");

 const {
   time
 } = require("@openzeppelin/test-helpers");
 const {
   BigNumber
 } = require("ethers");

 const ERC1820_REGISTRY_ADDRESS = "0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24";
 const ERC1820_REGISTRY_DEPLOY_TX =
   "0xf90a388085174876e800830c35008080b909e5608060405234801561001057600080fd5b506109c5806100206000396000f3fe608060405234801561001057600080fd5b50600436106100a5576000357c010000000000000000000000000000000000000000000000000000000090048063a41e7d5111610078578063a41e7d51146101d4578063aabbb8ca1461020a578063b705676514610236578063f712f3e814610280576100a5565b806329965a1d146100aa5780633d584063146100e25780635df8122f1461012457806365ba36c114610152575b600080fd5b6100e0600480360360608110156100c057600080fd5b50600160a060020a038135811691602081013591604090910135166102b6565b005b610108600480360360208110156100f857600080fd5b5035600160a060020a0316610570565b60408051600160a060020a039092168252519081900360200190f35b6100e06004803603604081101561013a57600080fd5b50600160a060020a03813581169160200135166105bc565b6101c26004803603602081101561016857600080fd5b81019060208101813564010000000081111561018357600080fd5b82018360208201111561019557600080fd5b803590602001918460018302840111640100000000831117156101b757600080fd5b5090925090506106b3565b60408051918252519081900360200190f35b6100e0600480360360408110156101ea57600080fd5b508035600160a060020a03169060200135600160e060020a0319166106ee565b6101086004803603604081101561022057600080fd5b50600160a060020a038135169060200135610778565b61026c6004803603604081101561024c57600080fd5b508035600160a060020a03169060200135600160e060020a0319166107ef565b604080519115158252519081900360200190f35b61026c6004803603604081101561029657600080fd5b508035600160a060020a03169060200135600160e060020a0319166108aa565b6000600160a060020a038416156102cd57836102cf565b335b9050336102db82610570565b600160a060020a031614610339576040805160e560020a62461bcd02815260206004820152600f60248201527f4e6f7420746865206d616e616765720000000000000000000000000000000000604482015290519081900360640190fd5b6103428361092a565b15610397576040805160e560020a62461bcd02815260206004820152601a60248201527f4d757374206e6f7420626520616e204552433136352068617368000000000000604482015290519081900360640190fd5b600160a060020a038216158015906103b85750600160a060020a0382163314155b156104ff5760405160200180807f455243313832305f4143434550545f4d4147494300000000000000000000000081525060140190506040516020818303038152906040528051906020012082600160a060020a031663249cb3fa85846040518363ffffffff167c01000000000000000000000000000000000000000000000000000000000281526004018083815260200182600160a060020a0316600160a060020a031681526020019250505060206040518083038186803b15801561047e57600080fd5b505afa158015610492573d6000803e3d6000fd5b505050506040513d60208110156104a857600080fd5b5051146104ff576040805160e560020a62461bcd02815260206004820181905260248201527f446f6573206e6f7420696d706c656d656e742074686520696e74657266616365604482015290519081900360640190fd5b600160a060020a03818116600081815260208181526040808320888452909152808220805473ffffffffffffffffffffffffffffffffffffffff19169487169485179055518692917f93baa6efbd2244243bfee6ce4cfdd1d04fc4c0e9a786abd3a41313bd352db15391a450505050565b600160a060020a03818116600090815260016020526040812054909116151561059a5750806105b7565b50600160a060020a03808216600090815260016020526040902054165b919050565b336105c683610570565b600160a060020a031614610624576040805160e560020a62461bcd02815260206004820152600f60248201527f4e6f7420746865206d616e616765720000000000000000000000000000000000604482015290519081900360640190fd5b81600160a060020a031681600160a060020a0316146106435780610646565b60005b600160a060020a03838116600081815260016020526040808220805473ffffffffffffffffffffffffffffffffffffffff19169585169590951790945592519184169290917f605c2dbf762e5f7d60a546d42e7205dcb1b011ebc62a61736a57c9089d3a43509190a35050565b600082826040516020018083838082843780830192505050925050506040516020818303038152906040528051906020012090505b92915050565b6106f882826107ef565b610703576000610705565b815b600160a060020a03928316600081815260208181526040808320600160e060020a031996909616808452958252808320805473ffffffffffffffffffffffffffffffffffffffff19169590971694909417909555908152600284528181209281529190925220805460ff19166001179055565b600080600160a060020a038416156107905783610792565b335b905061079d8361092a565b156107c357826107ad82826108aa565b6107b85760006107ba565b815b925050506106e8565b600160a060020a0390811660009081526020818152604080832086845290915290205416905092915050565b6000808061081d857f01ffc9a70000000000000000000000000000000000000000000000000000000061094c565b909250905081158061082d575080155b1561083d576000925050506106e8565b61084f85600160e060020a031961094c565b909250905081158061086057508015155b15610870576000925050506106e8565b61087a858561094c565b909250905060018214801561088f5750806001145b1561089f576001925050506106e8565b506000949350505050565b600160a060020a0382166000908152600260209081526040808320600160e060020a03198516845290915281205460ff1615156108f2576108eb83836107ef565b90506106e8565b50600160a060020a03808316600081815260208181526040808320600160e060020a0319871684529091529020549091161492915050565b7bffffffffffffffffffffffffffffffffffffffffffffffffffffffff161590565b6040517f01ffc9a7000000000000000000000000000000000000000000000000000000008082526004820183905260009182919060208160248189617530fa90519096909550935050505056fea165627a7a72305820377f4a2d4301ede9949f163f319021a6e9c687c292a5e2b2c4734c126b524e6c00291ba01820182018201820182018201820182018201820182018201820182018201820a01820182018201820182018201820182018201820182018201820182018201820";

 const COORDINATOR_1_URL = "https://hermez.io";

 const BLOCKS_PER_SLOT = 40;
 const TIMEOUT = 30000;
 const MIN_BLOCKS = 81;


 let ABIbid = [
   "function bid(uint128 slot, uint128 bidAmount, address producer)",
   "function multiBid(uint128 startingSlot,uint128 endingSlot,bool[6] slotEpoch,uint128 maxBid,uint128 minBid,address forger)",
 ];
 let iface = new ethers.utils.Interface(ABIbid);

 describe("Auction Protocol", function() {
   this.timeout(40000);

   let buidlerHEZToken;
   let buidlerHermezAuctionProtocol;
   let owner,
     coordinator1,
     coordinator2,
     registryFunder,
     hermezRollup,
     bootCoordinator,
     governance;
   let bootCoordinatorAddress,
     governanceAddress,
     hermezRollupAddress,
     donationAddress;

   // Deploy
   before(async function() {
     const HEZToken = await ethers.getContractFactory("ERC777Mock");

     [
       owner,
       coordinator1,
       coordinator2,
       producer2,
       registryFunder,
       hermezRollup,
       governance,
       donation,
       bootCoordinator,
       ...addrs
     ] = await ethers.getSigners();

     bootCoordinatorAddress = await bootCoordinator.getAddress();
     governanceAddress = await governance.getAddress();
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
       bootCoordinatorAddress
     );
   });

   describe("Forge process", function() {
     beforeEach(async function() {
       // Register Coordinator
       await buidlerHermezAuctionProtocol
         .connect(coordinator1)
         .registerCoordinator(COORDINATOR_1_URL);
     });

     it("shouldn't be able to forge before the auction starts", async function() {
       let genesis = await buidlerHermezAuctionProtocol.genesisBlock();
       await expect(
         buidlerHermezAuctionProtocol.canForge(
           bootCoordinatorAddress,
           genesis.sub(1)
         )
       ).to.be.revertedWith("Auction has not started yet");
     });

     it("shouldn't be able to forge a block higher than 2^128", async function() {
       await expect(
         buidlerHermezAuctionProtocol.canForge(
           bootCoordinatorAddress,
           ethers.BigNumber.from("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")
         )
       ).to.be.revertedWith("blockNumber higher than 2_128");
     });

     it("bootCoordinator should be able to forge (no biddings)", async function() {
       let startingBlock = await buidlerHermezAuctionProtocol.genesisBlock();
       expect(
         await buidlerHermezAuctionProtocol.canForge(
           bootCoordinatorAddress,
           startingBlock
         )
       ).to.be.equal(true);
     });

     it("Anyone should be able to forge if slotDeadline exceeded", async function() {
       let startingBlock = await buidlerHermezAuctionProtocol.genesisBlock();
       expect(
         await buidlerHermezAuctionProtocol.canForge(
           governanceAddress,
           startingBlock.toNumber() + 20
         )
       ).to.be.equal(true);
     });

     it("The winner should be able to forge", async function() {
       let startingBlock = await buidlerHermezAuctionProtocol.genesisBlock();

       // Encode multiBid data
       let data = iface.encodeFunctionData("multiBid", [
         2,
         7,
         [true, true, true, true, true, true],
         ethers.utils.parseEther("11"),
         ethers.utils.parseEther("11"),
         await coordinator1.getAddress(),
       ]);

       // Send tokens and multiBid data
       await buidlerHEZToken
         .connect(coordinator1)
         .send(
           buidlerHermezAuctionProtocol.address,
           ethers.utils.parseEther("100"),
           data, {
             gasLimit: 10000000,
           }
         );

       let block = startingBlock.add(3 * 40);
       // Check forger address
       expect(
         await buidlerHermezAuctionProtocol.canForge(
           await coordinator1.getAddress(),
           block
         )
       ).to.be.equal(true);
       expect(
         await buidlerHermezAuctionProtocol.canForge(
           bootCoordinatorAddress,
           block
         )
       ).to.be.equal(false);
     });

     it("bootCoordinator should be able to forge if bidAmount less than minBid", async function() {
       let startingBlock = await buidlerHermezAuctionProtocol.genesisBlock();

       // Encode multiBid data
       let data = iface.encodeFunctionData("multiBid", [
         2,
         7,
         [true, true, true, true, true, true],
         ethers.utils.parseEther("11"),
         ethers.utils.parseEther("11"),
         await coordinator1.getAddress(),
       ]);

       // Send tokens and multiBid data
       await buidlerHEZToken
         .connect(coordinator1)
         .send(
           buidlerHermezAuctionProtocol.address,
           ethers.utils.parseEther("100"),
           data, {
             gasLimit: 10000000,
           }
         );

       for (i = 0; i < 6; i++) {
         // Change epochs minBid
         await buidlerHermezAuctionProtocol
           .connect(governance)
           .changeDefaultSlotSetBid(i, ethers.utils.parseEther("123456789"));
       }

       // Check forger address
       expect(
         await buidlerHermezAuctionProtocol.canForge(
           governanceAddress,
           startingBlock.add(3 * 40)
         )
       ).to.be.equal(false);
       expect(
         await buidlerHermezAuctionProtocol.canForge(
           bootCoordinatorAddress,
           startingBlock.add(3 * 40)
         )
       ).to.be.equal(true);

       // Advance blocks
       let blockNumber = startingBlock.add(3 * 40).toNumber();
       time.advanceBlockTo(blockNumber);
       while (blockNumber > (await time.latestBlock()).toNumber()) {
         sleep(100);
       }

       let forgerAddress = await coordinator1.getAddress();
       let prevBalance = await buidlerHermezAuctionProtocol.getClaimableHEZ(
         forgerAddress
       );
       // BootCoordinator forge
       await buidlerHermezAuctionProtocol
         .connect(hermezRollup)
         .forge(bootCoordinatorAddress);

       let postBalance = await buidlerHermezAuctionProtocol.getClaimableHEZ(
         forgerAddress
       );
       // Check forgerAddress balances
       expect(postBalance).to.be.equal(
         prevBalance.add(ethers.utils.parseEther("11"))
       );
       expect(prevBalance.add(ethers.utils.parseEther("11"))).to.be.equal(
         postBalance
       );
     });

     it("should burn the HEZ tokens if it's no able to return them", async function() {
       let startingBlock = await buidlerHermezAuctionProtocol.genesisBlock();

       // Encode multibid data
       let data = iface.encodeFunctionData("multiBid", [
         2,
         7,
         [true, true, true, true, true, true],
         ethers.utils.parseEther("11"),
         ethers.utils.parseEther("11"),
         await coordinator1.getAddress(),
       ]);

       // Send tokens and multibid data
       await buidlerHEZToken
         .connect(coordinator1)
         .send(
           buidlerHermezAuctionProtocol.address,
           ethers.utils.parseEther("100"),
           data, {
             gasLimit: 10000000,
           }
         );

       for (i = 0; i < 6; i++) {
         // Change epochs minBid
         await buidlerHermezAuctionProtocol
           .connect(governance)
           .changeDefaultSlotSetBid(i, ethers.utils.parseEther("123456789"));
       }
       // Advance Blocks
       let blockNumber = startingBlock.add(3 * 40).toNumber();
       time.advanceBlockTo(blockNumber);
       while (blockNumber > (await time.latestBlock()).toNumber()) {
         sleep(100);
       }
       // Check forger balances
       await buidlerHEZToken.connect(coordinator1).setTransferRevert(true);
       let forgerAddress = await coordinator1.getAddress();
       let prevBalance = await buidlerHEZToken.balanceOf(forgerAddress);
       await buidlerHermezAuctionProtocol
         .connect(hermezRollup)
         .forge(bootCoordinatorAddress);
       let currentBalance = await buidlerHEZToken.balanceOf(forgerAddress);
       expect(prevBalance).to.be.equal(currentBalance);
       await buidlerHEZToken.connect(coordinator1).setTransferRevert(false);
     });

     it("shouldn't be able to forge unless it's called by Hermez Rollup Address", async function() {
       await expect(
         buidlerHermezAuctionProtocol
         .connect(bootCoordinator)
         .forge(bootCoordinatorAddress)
       ).to.be.revertedWith("Only Hermez Rollup Address");
     });

     it("shouldn't be able to forge unless it's the bootcoordinator or the winner", async function() {
       // Advance Blocks
       let startingBlock = await buidlerHermezAuctionProtocol.genesisBlock();
       let blockNumber = startingBlock.add(3 * 40).toNumber();
       time.advanceBlockTo(blockNumber);
       while (blockNumber > (await time.latestBlock()).toNumber()) {
         sleep(100);
       }
       // Check that governance can't forge
       await expect(
         buidlerHermezAuctionProtocol
         .connect(hermezRollup)
         .forge(governanceAddress)
       ).to.be.revertedWith("Can't forge");
     });

     it("should be able to forge (bootCoordinator)", async function() {
       let startingBlock = await buidlerHermezAuctionProtocol.genesisBlock();
       // Event NewForge
       let eventNewForge = new Promise((resolve, reject) => {
         filter = buidlerHermezAuctionProtocol.filters.NewForge();
         buidlerHermezAuctionProtocol.on(filter, (forger, slotToForge) => {
           expect(forger).to.be.equal(bootCoordinatorAddress);
           buidlerHermezAuctionProtocol.removeAllListeners();
           resolve();
         });

         // After 10s, we throw a timeout error
         setTimeout(() => {
           reject(new Error("timeout while waiting for event"));
         }, TIMEOUT);
       });
       // Advance blocks
       let blockNumber = startingBlock.add(3 * 40).toNumber();
       time.advanceBlockTo(blockNumber);
       while (blockNumber > (await time.latestBlock()).toNumber()) {
         sleep(100);
       }
       // Forge
       buidlerHermezAuctionProtocol
         .connect(hermezRollup)
         .forge(bootCoordinatorAddress);
       await eventNewForge;
     });

     it("Winner should be able to forge", async function() {
       let producer1Address = await coordinator1.getAddress();
       let bidAmount = ethers.utils.parseEther("11");
       // Event NewForgeAllocated
       let eventNewForgeAllocated = new Promise((resolve, reject) => {
         filter = buidlerHermezAuctionProtocol.filters.NewForgeAllocated();
         buidlerHermezAuctionProtocol.on(
           filter,
           (
             forger,
             slotToForge,
             burnAmount,
             donationAmount,
             governanceAmount
           ) => {
             expect(forger).to.be.equal(producer1Address);
             expect(burnAmount).to.be.equal(bidAmount.mul(40).div(100));
             expect(donationAmount).to.be.equal(bidAmount.mul(40).div(100));
             expect(governanceAmount).to.be.equal(bidAmount.mul(20).div(100));
             buidlerHermezAuctionProtocol.removeAllListeners();
             resolve();
           }
         );

         // After 10s, we throw a timeout error
         setTimeout(() => {
           reject(new Error("timeout while waiting for event"));
         }, TIMEOUT);
       });

       let startingBlock = await buidlerHermezAuctionProtocol.genesisBlock();

       // Encode multibid data
       let data = iface.encodeFunctionData("multiBid", [
         2,
         7,
         [true, true, true, true, true, true],
         bidAmount,
         bidAmount,
         await coordinator1.getAddress(),
       ]);
       // Send tokens and mutlbid data
       await buidlerHEZToken
         .connect(coordinator1)
         .send(
           buidlerHermezAuctionProtocol.address,
           ethers.utils.parseEther("100"),
           data, {
             gasLimit: 10000000,
           }
         );
       // Advance blocks
       let blockNumber = startingBlock.add(3 * 40).toNumber();
       time.advanceBlockTo(blockNumber);
       while (blockNumber > (await time.latestBlock()).toNumber()) {
         sleep(100);
       }
       // Winner forge
       await buidlerHermezAuctionProtocol
         .connect(hermezRollup)
         .forge(producer1Address);
       await buidlerHermezAuctionProtocol
         .connect(hermezRollup)
         .forge(producer1Address);
       await buidlerHermezAuctionProtocol
         .connect(hermezRollup)
         .forge(producer1Address);
       await eventNewForgeAllocated;
     });

     it("shouldn't be able to claim HEZ if it doesn't have enough balance", async function() {
       await expect(
         buidlerHermezAuctionProtocol.connect(donation).claimHEZ()
       ).to.be.revertedWith("Doesn't have enough balance");
     });

     it("should be able to claim HEZ", async function() {
       let producer1Address = await coordinator1.getAddress();
       let bidAmount = ethers.utils.parseEther("11");
       // Event HEZClaimed
       let eventHEZClaimed = new Promise((resolve, reject) => {
         filter = buidlerHermezAuctionProtocol.filters.HEZClaimed();
         buidlerHermezAuctionProtocol.on(filter, (owner, amount) => {
           if (owner == governanceAddress) {
             expect(amount).to.be.equal(bidAmount.mul(3).mul(20).div(100));
           } else {
             expect(amount).to.be.equal(bidAmount.mul(3).mul(40).div(100));
           }
           buidlerHermezAuctionProtocol.removeAllListeners();
           resolve();
         });

         // After 10s, we throw a timeout error
         setTimeout(() => {
           reject(new Error("timeout while waiting for event"));
         }, TIMEOUT);
       });

       let startingBlock = await buidlerHermezAuctionProtocol.genesisBlock();

       // Encode multibid data
       let data = iface.encodeFunctionData("multiBid", [
         2,
         7,
         [true, true, true, true, true, true],
         bidAmount,
         bidAmount,
         await coordinator1.getAddress(),
       ]);
       // Send tokens and multibid data
       await buidlerHEZToken
         .connect(coordinator1)
         .send(
           buidlerHermezAuctionProtocol.address,
           ethers.utils.parseEther("100"),
           data, {
             gasLimit: 10000000,
           }
         );

       for (let slot = 3; slot < 6; slot++) {
         // Advance blocks
         let firstBlock = startingBlock.add(slot * BLOCKS_PER_SLOT).toNumber();
         time.advanceBlockTo(firstBlock);
         while (firstBlock > (await time.latestBlock()).toNumber()) {
           sleep(100);
         }
         // Forge
         await buidlerHermezAuctionProtocol
           .connect(hermezRollup)
           .forge(producer1Address);
       }
       // Check balances
       expect(await buidlerHEZToken.balanceOf(governanceAddress)).to.be.equal(0);
       expect(
         await buidlerHermezAuctionProtocol.getClaimableHEZ(governanceAddress)
       ).to.be.equal(bidAmount.mul(3).mul(20).div(100));
       await buidlerHermezAuctionProtocol.connect(governance).claimHEZ();
       expect(
         await buidlerHermezAuctionProtocol.getClaimableHEZ(governanceAddress)
       ).to.be.equal(0);
       expect(await buidlerHEZToken.balanceOf(governanceAddress)).to.be.equal(
         bidAmount.mul(3).mul(20).div(100)
       );

       expect(await buidlerHEZToken.balanceOf(donationAddress)).to.be.equal(0);
       expect(
         await buidlerHermezAuctionProtocol.getClaimableHEZ(donationAddress)
       ).to.be.equal(bidAmount.mul(3).mul(40).div(100));
       await buidlerHermezAuctionProtocol.connect(donation).claimHEZ();
       expect(
         await buidlerHermezAuctionProtocol.getClaimableHEZ(donationAddress)
       ).to.be.equal(0);
       expect(await buidlerHEZToken.balanceOf(donationAddress)).to.be.equal(
         bidAmount.mul(3).mul(40).div(100)
       );

       await eventHEZClaimed;
     });

     it("should revert when claim HEZ and it revert", async function() {
       let producer1Address = await coordinator1.getAddress();
       let bidAmount = ethers.utils.parseEther("11");
       let startingBlock = await buidlerHermezAuctionProtocol.genesisBlock();

       // Encode multibid data
       let data = iface.encodeFunctionData("multiBid", [
         2,
         7,
         [true, true, true, true, true, true],
         bidAmount,
         bidAmount,
         await coordinator1.getAddress(),
       ]);
       // Send tokens and multibid data
       await buidlerHEZToken
         .connect(coordinator1)
         .send(
           buidlerHermezAuctionProtocol.address,
           ethers.utils.parseEther("100"),
           data, {
             gasLimit: 10000000,
           }
         );

       for (let slot = 3; slot < 6; slot++) {
         // Advance blocks
         let firstBlock = startingBlock.add(slot * BLOCKS_PER_SLOT).toNumber();
         time.advanceBlockTo(firstBlock);
         while (firstBlock > (await time.latestBlock()).toNumber()) {
           sleep(100);
         }
         // Forge
         await buidlerHermezAuctionProtocol
           .connect(hermezRollup)
           .forge(producer1Address);
       }
     });
   });
 });

 function sleep(ms) {
   return new Promise((resolve) => {
     setTimeout(resolve, ms);
   });
 }