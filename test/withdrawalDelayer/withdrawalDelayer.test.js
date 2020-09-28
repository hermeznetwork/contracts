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

const ERC1820_REGISTRY_DEPLOY_TX =
  "0xf90a388085174876e800830c35008080b909e5608060405234801561001057600080fd5b506109c5806100206000396000f3fe608060405234801561001057600080fd5b50600436106100a5576000357c010000000000000000000000000000000000000000000000000000000090048063a41e7d5111610078578063a41e7d51146101d4578063aabbb8ca1461020a578063b705676514610236578063f712f3e814610280576100a5565b806329965a1d146100aa5780633d584063146100e25780635df8122f1461012457806365ba36c114610152575b600080fd5b6100e0600480360360608110156100c057600080fd5b50600160a060020a038135811691602081013591604090910135166102b6565b005b610108600480360360208110156100f857600080fd5b5035600160a060020a0316610570565b60408051600160a060020a039092168252519081900360200190f35b6100e06004803603604081101561013a57600080fd5b50600160a060020a03813581169160200135166105bc565b6101c26004803603602081101561016857600080fd5b81019060208101813564010000000081111561018357600080fd5b82018360208201111561019557600080fd5b803590602001918460018302840111640100000000831117156101b757600080fd5b5090925090506106b3565b60408051918252519081900360200190f35b6100e0600480360360408110156101ea57600080fd5b508035600160a060020a03169060200135600160e060020a0319166106ee565b6101086004803603604081101561022057600080fd5b50600160a060020a038135169060200135610778565b61026c6004803603604081101561024c57600080fd5b508035600160a060020a03169060200135600160e060020a0319166107ef565b604080519115158252519081900360200190f35b61026c6004803603604081101561029657600080fd5b508035600160a060020a03169060200135600160e060020a0319166108aa565b6000600160a060020a038416156102cd57836102cf565b335b9050336102db82610570565b600160a060020a031614610339576040805160e560020a62461bcd02815260206004820152600f60248201527f4e6f7420746865206d616e616765720000000000000000000000000000000000604482015290519081900360640190fd5b6103428361092a565b15610397576040805160e560020a62461bcd02815260206004820152601a60248201527f4d757374206e6f7420626520616e204552433136352068617368000000000000604482015290519081900360640190fd5b600160a060020a038216158015906103b85750600160a060020a0382163314155b156104ff5760405160200180807f455243313832305f4143434550545f4d4147494300000000000000000000000081525060140190506040516020818303038152906040528051906020012082600160a060020a031663249cb3fa85846040518363ffffffff167c01000000000000000000000000000000000000000000000000000000000281526004018083815260200182600160a060020a0316600160a060020a031681526020019250505060206040518083038186803b15801561047e57600080fd5b505afa158015610492573d6000803e3d6000fd5b505050506040513d60208110156104a857600080fd5b5051146104ff576040805160e560020a62461bcd02815260206004820181905260248201527f446f6573206e6f7420696d706c656d656e742074686520696e74657266616365604482015290519081900360640190fd5b600160a060020a03818116600081815260208181526040808320888452909152808220805473ffffffffffffffffffffffffffffffffffffffff19169487169485179055518692917f93baa6efbd2244243bfee6ce4cfdd1d04fc4c0e9a786abd3a41313bd352db15391a450505050565b600160a060020a03818116600090815260016020526040812054909116151561059a5750806105b7565b50600160a060020a03808216600090815260016020526040902054165b919050565b336105c683610570565b600160a060020a031614610624576040805160e560020a62461bcd02815260206004820152600f60248201527f4e6f7420746865206d616e616765720000000000000000000000000000000000604482015290519081900360640190fd5b81600160a060020a031681600160a060020a0316146106435780610646565b60005b600160a060020a03838116600081815260016020526040808220805473ffffffffffffffffffffffffffffffffffffffff19169585169590951790945592519184169290917f605c2dbf762e5f7d60a546d42e7205dcb1b011ebc62a61736a57c9089d3a43509190a35050565b600082826040516020018083838082843780830192505050925050506040516020818303038152906040528051906020012090505b92915050565b6106f882826107ef565b610703576000610705565b815b600160a060020a03928316600081815260208181526040808320600160e060020a031996909616808452958252808320805473ffffffffffffffffffffffffffffffffffffffff19169590971694909417909555908152600284528181209281529190925220805460ff19166001179055565b600080600160a060020a038416156107905783610792565b335b905061079d8361092a565b156107c357826107ad82826108aa565b6107b85760006107ba565b815b925050506106e8565b600160a060020a0390811660009081526020818152604080832086845290915290205416905092915050565b6000808061081d857f01ffc9a70000000000000000000000000000000000000000000000000000000061094c565b909250905081158061082d575080155b1561083d576000925050506106e8565b61084f85600160e060020a031961094c565b909250905081158061086057508015155b15610870576000925050506106e8565b61087a858561094c565b909250905060018214801561088f5750806001145b1561089f576001925050506106e8565b506000949350505050565b600160a060020a0382166000908152600260209081526040808320600160e060020a03198516845290915281205460ff1615156108f2576108eb83836107ef565b90506106e8565b50600160a060020a03808316600081815260208181526040808320600160e060020a0319871684529091529020549091161492915050565b7bffffffffffffffffffffffffffffffffffffffffffffffffffffffff161590565b6040517f01ffc9a7000000000000000000000000000000000000000000000000000000008082526004820183905260009182919060208160248189617530fa90519096909550935050505056fea165627a7a72305820377f4a2d4301ede9949f163f319021a6e9c687c292a5e2b2c4734c126b524e6c00291ba01820182018201820182018201820182018201820182018201820182018201820a01820182018201820182018201820182018201820182018201820182018201820";
const ERC1820_REGISTRY_ADDRESS = "0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24";
const ERC20_TOKENS = 1;
const ERC777_TOKENS = 1;
const INITIAL_DELAY = 60; //seconds
const MAX_EMERGENCY_MODE_TIME = 52 * 7 * 24 * 60 * 60;
const MAX_WITHDRAWAL_DELAY = 2 * 7 * 24 * 60 * 60;
const DEPOSIT_AMOUNT = ethers.utils.parseEther("5");
let ABIbid = [
  "function deposit(address,address,uint192)",
  "function depositFake(address,address,uint192)",
];
let iface = new ethers.utils.Interface(ABIbid);


describe("WithdrawalDelayer Tests", function() {
  let buidlerWithdrawalDelayer,
    buidlerPayableRevert,
    buidlerHermezGovernanceDAO,
    buidlerWhiteHackGroup;
  let buidlerERC20 = [];
  let buidlerERC777 = [];
  let buidlerERC20Fake;
  let hermezRollup, hermezKeeper, escapeHatch, registryFunder, ownerToken1;
  let hermezRollupAddress,
    hermezGovernanceDAOAddress,
    hermezKeeperAddress,
    whiteHackGroupAddress,
    registryFunderAddress,
    ownerToken1Address;

  before(async function() {
    const ERC20 = await ethers.getContractFactory("ERC20Mock");
    const ERC777 = await ethers.getContractFactory("ERC777Mock");
    const ERC20Fake = await ethers.getContractFactory("ERC20MockFake");

    [
      hermezRollup,
      hermezGovernanceDAO,
      hermezKeeper,
      registryFunder,
      escapeHatch,
      ownerToken1,
    ] = await ethers.getSigners();

    hermezRollupAddress = await hermezRollup.getAddress();
    hermezKeeperAddress = await hermezKeeper.getAddress();
    registryFunderAddress = await registryFunder.getAddress();
    ownerToken1Address = await ownerToken1.getAddress();

    if ((await ethers.provider.getCode(ERC1820_REGISTRY_ADDRESS)) == "0x") {
      await registryFunder.sendTransaction({
        to: "0xa990077c3205cbDf861e17Fa532eeB069cE9fF96",
        value: ethers.utils.parseEther("1"),
      });
      await ethers.provider.sendTransaction(ERC1820_REGISTRY_DEPLOY_TX);
    }

    const PayableRevert = await ethers.getContractFactory("PayableRevert");
    buidlerPayableRevert = await PayableRevert.deploy();
    await buidlerPayableRevert.deployed();

    buidlerHermezGovernanceDAO = await PayableRevert.deploy();
    await buidlerHermezGovernanceDAO.deployed();

    buidlerWhiteHackGroup = await PayableRevert.deploy();
    await buidlerWhiteHackGroup.deployed();

    whiteHackGroupAddress = buidlerWhiteHackGroup.address;
    hermezGovernanceDAOAddress = buidlerHermezGovernanceDAO.address;

    for (let i = 0; i < ERC20_TOKENS; i++) {
      buidlerERC20[i] = await ERC20.deploy(
        "ERC20_" + i,
        "20_" + i,
        hermezRollupAddress,
        ethers.BigNumber.from(
          "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        )
      );
      await buidlerERC20[i].deployed();
    }
    for (let i = 0; i < ERC777_TOKENS; i++) {
      buidlerERC777[i] = await ERC777.deploy(
        hermezRollupAddress,
        ethers.BigNumber.from(
          "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        ),
        "ERC777_" + i,
        "777_" + i,
        []
      );
      await buidlerERC777[i].deployed();
      // Send tokens to coordinators addresses
      await buidlerERC777[i]
        .send(
          await hermezKeeperAddress,
          ethers.utils.parseEther("10000"),
          ethers.utils.toUtf8Bytes("")
        );
    }
    buidlerERC20Fake = await ERC20Fake.deploy(
      "ERC20Fake",
      "ERCFake",
      hermezRollupAddress,
      ethers.utils.parseEther("10000")
    );
    await buidlerERC20Fake.deployed();
  });

  // Deploy the WithdrawalDelayer
  beforeEach(async function() {
    const withdrawalDelayer = await ethers.getContractFactory(
      "WithdrawalDelayer"
    );
    buidlerWithdrawalDelayer = await withdrawalDelayer.deploy();
    await buidlerWithdrawalDelayer.deployed();
    await buidlerWithdrawalDelayer.withdrawalDelayerInitializer(
      INITIAL_DELAY,
      hermezRollupAddress,
      hermezKeeperAddress,
      hermezGovernanceDAOAddress,
      whiteHackGroupAddress
    );
  });

  describe("Common behavior tests", function() {
    describe("Deposits", function() {
      it("shouldn't be possible to initialize it twice", async function() {
        await expect(
          buidlerWithdrawalDelayer.withdrawalDelayerInitializer(
            INITIAL_DELAY,
            hermezRollupAddress,
            hermezKeeperAddress,
            hermezGovernanceDAOAddress,
            whiteHackGroupAddress
          )
        ).to.be.revertedWith("Contract instance has already been initialized");
      });
      it("should be able to make a ERC20 deposit", async function() {
        // Event Deposit
        let eventDeposit = new Promise((resolve, reject) => {
          filter = buidlerWithdrawalDelayer.filters.Deposit();
          buidlerWithdrawalDelayer.on(
            filter,
            async (owner, token, amount, depositTimestamp) => {
              let latest = await ethers.provider.getBlockNumber();
              let blockTimestamp = (await ethers.provider.getBlock(latest))
                .timestamp;

              //Check the depositTimestamp
              expect(depositTimestamp).to.be.equal(blockTimestamp);

              //Check the WithdrawalDelayer balance
              await expect(
                await buidlerERC20[0].balanceOf(
                  buidlerWithdrawalDelayer.address
                )
              ).to.be.equal(DEPOSIT_AMOUNT);

              //Check the depositInfo for the owner and token
              let [
                _amount,
                _depositTimestamp,
              ] = await buidlerWithdrawalDelayer.depositInfo(owner, token);

              expect(_amount).to.be.equal(DEPOSIT_AMOUNT);
              expect(_depositTimestamp).to.be.equal(depositTimestamp);
              buidlerWithdrawalDelayer.removeAllListeners();
              resolve();
            }
          );

          // After 10s, we throw a timeout error
          setTimeout(() => {
            reject(new Error("timeout while waiting for event"));
          }, 10000);
        });

        // Do the approval so that WithdrawalDelayer can transfer it
        await buidlerERC20[0]
          .connect(hermezRollup)
          .approve(buidlerWithdrawalDelayer.address, DEPOSIT_AMOUNT);

        // Make the approval so that WithdrawalDelayer can transfer it
        await buidlerWithdrawalDelayer
          .connect(hermezRollup)
          .deposit(ownerToken1Address, buidlerERC20[0].address, DEPOSIT_AMOUNT);
        await eventDeposit;
      });

      it("should be able to make a ERC777 deposit", async function() {
        // Event Deposit
        let eventDeposit = new Promise((resolve, reject) => {
          filter = buidlerWithdrawalDelayer.filters.Deposit();
          buidlerWithdrawalDelayer.on(
            filter,
            async (owner, token, amount, depositTimestamp) => {
              let latest = await ethers.provider.getBlockNumber();
              let blockTimestamp = (await ethers.provider.getBlock(latest))
                .timestamp;

              //Check the depositTimestamp
              expect(depositTimestamp).to.be.equal(blockTimestamp);

              //Check the WithdrawalDelayer balance
              await expect(
                await buidlerERC777[0].balanceOf(
                  buidlerWithdrawalDelayer.address
                )
              ).to.be.equal(DEPOSIT_AMOUNT);

              //Check the depositInfo for the owner and token
              let [
                _amount,
                _depositTimestamp,
              ] = await buidlerWithdrawalDelayer.depositInfo(owner, token);

              expect(_amount).to.be.equal(DEPOSIT_AMOUNT);
              expect(_depositTimestamp).to.be.equal(depositTimestamp);
              buidlerWithdrawalDelayer.removeAllListeners();
              resolve();
            }
          );

          // After 10s, we throw a timeout error
          setTimeout(() => {
            reject(new Error("timeout while waiting for event"));
          }, 10000);
        });

        let data = iface.encodeFunctionData("deposit", [ownerToken1Address, buidlerERC777[0].address, DEPOSIT_AMOUNT]);
        await buidlerERC777[0]
          .connect(hermezRollup)
          .send(buidlerWithdrawalDelayer.address, DEPOSIT_AMOUNT, data);

        await eventDeposit;
      });

      it("should revert if not hermezRollupAddress", async function() {

        let data = iface.encodeFunctionData("deposit", [ownerToken1Address, buidlerERC777[0].address, DEPOSIT_AMOUNT]);

        await expect(buidlerERC777[0]
          .connect(hermezKeeper)
          .send(buidlerWithdrawalDelayer.address, DEPOSIT_AMOUNT, data)
        ).to.be.revertedWith("Only hermezRollupAddress");

      });

      it("should revert if different amount", async function() {

        let data = iface.encodeFunctionData("deposit", [ownerToken1Address, buidlerERC777[0].address, DEPOSIT_AMOUNT]);

        await expect(buidlerERC777[0]
          .send(buidlerWithdrawalDelayer.address, ethers.utils.parseEther("15"), data)
        ).to.be.revertedWith("Amount sent different");

      });

      it("should revert if no user data", async function() {
        await expect(buidlerERC777[0]
          .send(buidlerWithdrawalDelayer.address, DEPOSIT_AMOUNT, ethers.utils.toUtf8Bytes(""))
        ).to.be.revertedWith("UserData empty");
      });

      it("should revert if not valid data", async function() {
        let data = iface.encodeFunctionData("depositFake", [ownerToken1Address, buidlerERC777[0].address, DEPOSIT_AMOUNT]);

        await expect(buidlerERC777[0]
          .send(buidlerWithdrawalDelayer.address, DEPOSIT_AMOUNT, data)
        ).to.be.revertedWith("Not a valid calldata");
      });

      it("should be able to make a ETH deposit", async function() {
        // Event Deposit
        let eventDeposit = new Promise((resolve, reject) => {
          filter = buidlerWithdrawalDelayer.filters.Deposit();
          buidlerWithdrawalDelayer.on(
            filter,
            async (owner, token, amount, depositTimestamp) => {
              let latest = await ethers.provider.getBlockNumber();
              let blockTimestamp = (await ethers.provider.getBlock(latest))
                .timestamp;

              expect(depositTimestamp).to.be.equal(blockTimestamp);

              await expect(
                await ethers.provider.getBalance(
                  buidlerWithdrawalDelayer.address
                )
              ).to.be.equal(DEPOSIT_AMOUNT);
              let [
                _amount,
                _depositTimestamp,
              ] = await buidlerWithdrawalDelayer.depositInfo(
                owner,
                ethers.constants.AddressZero
              );

              expect(_amount).to.be.equal(DEPOSIT_AMOUNT);
              expect(_depositTimestamp).to.be.equal(depositTimestamp);
              buidlerWithdrawalDelayer.removeAllListeners();
              resolve();
            }
          );

          // After 10s, we throw a timeout error
          setTimeout(() => {
            reject(new Error("timeout while waiting for event"));
          }, 10000);
        });

        // Check that ETH should be the 0x0 address
        await expect(
          buidlerWithdrawalDelayer
          .connect(hermezRollup)
          .deposit(
            ownerToken1Address,
            buidlerERC20[0].address,
            DEPOSIT_AMOUNT, {
              value: DEPOSIT_AMOUNT,
            }
          )
        ).to.be.revertedWith("ETH should be the 0x0 address");

        // Different amount and msg.value
        await expect(
          buidlerWithdrawalDelayer
          .connect(hermezRollup)
          .deposit(
            ownerToken1Address,
            ethers.constants.AddressZero,
            DEPOSIT_AMOUNT, {
              value: ethers.utils.parseEther("1"),
            }
          )
        ).to.be.revertedWith("Different amount and msg.value");

        // Make a ETH deposit
        await buidlerWithdrawalDelayer
          .connect(hermezRollup)
          .deposit(
            ownerToken1Address,
            ethers.constants.AddressZero,
            DEPOSIT_AMOUNT, {
              value: DEPOSIT_AMOUNT,
            }
          );
        await eventDeposit;
      });
      it("shouldn't be able to make a ERC20Fake deposit", async function() {
        await buidlerERC20Fake.setTransferFromResult(false);
        // Do the approval so that WithdrawalDelayer can transfer it
        await buidlerERC20Fake
          .connect(hermezRollup)
          .approve(buidlerWithdrawalDelayer.address, DEPOSIT_AMOUNT);

        // Make the approval so that WithdrawalDelayer can transfer it
        await expect(
          buidlerWithdrawalDelayer
          .connect(hermezRollup)
          .deposit(
            ownerToken1Address,
            buidlerERC20Fake.address,
            DEPOSIT_AMOUNT
          )
        ).to.be.revertedWith("Token Transfer Failed");
      });

      it("shouldn't be able to make a deposit without enough allowance", async function() {
        // Do the approval of DEPOSIT_AMOUNT / 2
        await buidlerERC20[0]
          .connect(hermezRollup)
          .approve(
            buidlerWithdrawalDelayer.address,
            ethers.utils.parseEther("0.5")
          );
        // Do the approval of DEPOSIT_AMOUNT / 2
        await buidlerERC777[0]
          .connect(hermezRollup)
          .approve(
            buidlerWithdrawalDelayer.address,
            ethers.utils.parseEther("0.5")
          );

        // Make the approval so that WithdrawalDelayer can transfer it
        await expect(
          buidlerWithdrawalDelayer
          .connect(hermezRollup)
          .deposit(
            ownerToken1Address,
            buidlerERC20[0].address,
            DEPOSIT_AMOUNT
          )
        ).to.be.revertedWith("Doesn't have enough allowance");

        // Make the approval so that WithdrawalDelayer can transfer it
        await expect(
          buidlerWithdrawalDelayer
          .connect(hermezRollup)
          .deposit(
            ownerToken1Address,
            buidlerERC777[0].address,
            DEPOSIT_AMOUNT
          )
        ).to.be.revertedWith("Doesn't have enough allowance");
      });

      it("shouldn't be able to make a deposit if not hermez rollup address", async function() {
        await buidlerERC20[0]
          .connect(hermezRollup)
          .approve(ownerToken1Address, DEPOSIT_AMOUNT);

        await expect(
          buidlerWithdrawalDelayer
          .connect(ownerToken1)
          .deposit(
            ownerToken1Address,
            buidlerERC20[0].address,
            DEPOSIT_AMOUNT
          )
        ).to.be.revertedWith("Only hermezRollupAddress");
      });

      it("should be able to make a second deposit", async function() {
        let newDeposit = ethers.utils.parseEther("2");
        // Event Deposit
        let eventSecondDeposit = new Promise((resolve, reject) => {
          filter = buidlerWithdrawalDelayer.filters.Deposit();
          buidlerWithdrawalDelayer.on(
            filter,
            async (owner, token, amount, depositTimestamp) => {
              if (amount.eq(newDeposit)) {
                let blockTimestamp = (await time.latest()).toNumber();
                expect(depositTimestamp).to.be.equal(blockTimestamp);
                expect(amount).to.be.equal(newDeposit);
                let [
                  _amount,
                  _depositTimestamp,
                ] = await buidlerWithdrawalDelayer.depositInfo(owner, token);
                expect(_depositTimestamp).to.be.equal(blockTimestamp);
                expect(_amount).to.be.equal(
                  BigNumber.from(DEPOSIT_AMOUNT).add(newDeposit)
                );
                buidlerWithdrawalDelayer.removeAllListeners();
                resolve();
              }
            }
          );

          // After 10s, we throw a timeout error
          setTimeout(() => {
            reject(new Error("timeout while waiting for event"));
          }, 10000);
        });

        // Do the approval so that WithdrawalDelayer can transfer it
        await buidlerERC20[0]
          .connect(hermezRollup)
          .approve(buidlerWithdrawalDelayer.address, DEPOSIT_AMOUNT);

        // Make the approval so that WithdrawalDelayer can transfer it
        await buidlerWithdrawalDelayer
          .connect(hermezRollup)
          .deposit(ownerToken1Address, buidlerERC20[0].address, DEPOSIT_AMOUNT);

        // Get first desopist info
        let [
          prevAmount,
          prevDepositTimestamp,
        ] = await buidlerWithdrawalDelayer.depositInfo(
          ownerToken1Address,
          buidlerERC20[0].address
        );

        // Approve second deposit
        await buidlerERC20[0]
          .connect(hermezRollup)
          .approve(buidlerWithdrawalDelayer.address, newDeposit);

        // Make second deposit
        await buidlerWithdrawalDelayer
          .connect(hermezRollup)
          .deposit(ownerToken1Address, buidlerERC20[0].address, newDeposit);
        await eventSecondDeposit;
      });
    });

    describe("Withdrawals", function() {
      beforeEach(async function() {
        //Make an ERC20 deposit
        await buidlerERC20[0]
          .connect(hermezRollup)
          .approve(buidlerWithdrawalDelayer.address, DEPOSIT_AMOUNT);
        await buidlerWithdrawalDelayer
          .connect(hermezRollup)
          .deposit(ownerToken1Address, buidlerERC20[0].address, DEPOSIT_AMOUNT);

        let data = iface.encodeFunctionData("deposit", [ownerToken1Address, buidlerERC777[0].address, DEPOSIT_AMOUNT]);
        // Send bid data and amount
        await buidlerERC777[0]
          .connect(hermezRollup)
          .send(buidlerWithdrawalDelayer.address, DEPOSIT_AMOUNT, data);


        //Make an ERC20Fake deposit
        await buidlerERC20Fake.setTransferFromResult(true);
        await buidlerERC20Fake
          .connect(hermezRollup)
          .approve(buidlerWithdrawalDelayer.address, DEPOSIT_AMOUNT);
        await buidlerWithdrawalDelayer
          .connect(hermezRollup)
          .deposit(
            ownerToken1Address,
            buidlerERC20Fake.address,
            DEPOSIT_AMOUNT
          );

        //Make an ETH deposit
        await buidlerWithdrawalDelayer
          .connect(hermezRollup)
          .deposit(
            ownerToken1Address,
            ethers.constants.AddressZero,
            DEPOSIT_AMOUNT, {
              value: DEPOSIT_AMOUNT,
            }
          );
      });

      it("shouldn't be able to withdraw if not funds", async function() {
        await expect(
          buidlerWithdrawalDelayer.withdrawal(
            registryFunderAddress,
            buidlerERC20[0].address
          )
        ).to.be.revertedWith("No funds to withdraw");
      });

      it("shouldn't be able to withdraw if the delay time has not exceeded", async function() {
        await expect(
          buidlerWithdrawalDelayer.withdrawal(
            ownerToken1Address,
            buidlerERC20[0].address
          )
        ).to.be.revertedWith("Withdrawal not allowed yet");
      });

      it("should be able to make an ERC20 withdrawal", async function() {
        let prevAmount = await buidlerERC20[0].balanceOf(ownerToken1Address);

        let eventWithdraw = new Promise((resolve, reject) => {
          filter = buidlerWithdrawalDelayer.filters.Withdraw();
          buidlerWithdrawalDelayer.on(filter, async (owner, token) => {
            let [
              newAmount,
              newTimeToClaim,
            ] = await buidlerWithdrawalDelayer.depositInfo(owner, token);
            expect(newAmount).to.be.eq(0);
            expect(newTimeToClaim).to.be.eq(0);
            buidlerWithdrawalDelayer.removeAllListeners();
            resolve();
          });

          // After 10s, we throw a timeout error
          setTimeout(() => {
            reject(new Error("timeout while waiting for event"));
          }, 10000);
        });

        let [
          amount,
          depositTimestamp,
        ] = await buidlerWithdrawalDelayer.depositInfo(
          ownerToken1Address,
          buidlerERC20[0].address
        );
        await time.increaseTo(depositTimestamp.toNumber() + INITIAL_DELAY);
        await buidlerWithdrawalDelayer.withdrawal(
          ownerToken1Address,
          buidlerERC20[0].address
        );
        expect(await buidlerERC20[0].balanceOf(ownerToken1Address)).to.be.eq(
          amount.add(prevAmount)
        );
        await eventWithdraw;
      });

      it("should be able to make an ERC777 withdrawal", async function() {
        let prevAmount = await buidlerERC777[0].balanceOf(ownerToken1Address);

        let eventWithdraw = new Promise((resolve, reject) => {
          filter = buidlerWithdrawalDelayer.filters.Withdraw();
          buidlerWithdrawalDelayer.on(filter, async (owner, token) => {
            let [
              newAmount,
              newTimeToClaim,
            ] = await buidlerWithdrawalDelayer.depositInfo(owner, token);
            expect(newAmount).to.be.eq(0);
            expect(newTimeToClaim).to.be.eq(0);
            buidlerWithdrawalDelayer.removeAllListeners();
            resolve();
          });

          // After 10s, we throw a timeout error
          setTimeout(() => {
            reject(new Error("timeout while waiting for event"));
          }, 10000);
        });

        let [
          amount,
          depositTimestamp,
        ] = await buidlerWithdrawalDelayer.depositInfo(
          ownerToken1Address,
          buidlerERC777[0].address
        );
        await time.increaseTo(depositTimestamp.toNumber() + INITIAL_DELAY);
        await buidlerWithdrawalDelayer.withdrawal(
          ownerToken1Address,
          buidlerERC777[0].address
        );
        expect(await buidlerERC777[0].balanceOf(ownerToken1Address)).to.be.eq(
          amount.add(prevAmount)
        );
        await eventWithdraw;
      });

      it("should be able to make an ETH withdrawal", async function() {
        let prevAmount = await ethers.provider.getBalance(ownerToken1Address);

        let eventWithdraw = new Promise((resolve, reject) => {
          filter = buidlerWithdrawalDelayer.filters.Withdraw();
          buidlerWithdrawalDelayer.on(filter, async (owner, token) => {
            let [
              newAmount,
              newTimeToClaim,
            ] = await buidlerWithdrawalDelayer.depositInfo(owner, token);
            expect(newAmount).to.be.eq(0);
            expect(newTimeToClaim).to.be.eq(0);
            buidlerWithdrawalDelayer.removeAllListeners();
            resolve();
          });

          // After 10s, we throw a timeout error
          setTimeout(() => {
            reject(new Error("timeout while waiting for event"));
          }, 10000);
        });

        let [
          amount,
          depositTimestamp,
        ] = await buidlerWithdrawalDelayer.depositInfo(
          ownerToken1Address,
          ethers.constants.AddressZero
        );
        await time.increaseTo(depositTimestamp.toNumber() + INITIAL_DELAY);
        await buidlerWithdrawalDelayer.withdrawal(
          ownerToken1Address,
          ethers.constants.AddressZero
        );
        expect(await ethers.provider.getBalance(ownerToken1Address)).to.be.eq(
          amount.add(prevAmount)
        );
        await eventWithdraw;
      });

      it("should revert if not able to send the ether", async function() {
        const PayableRevert = await ethers.getContractFactory("PayableRevert");
        let buidlerPayableRevert = await PayableRevert.deploy();
        await buidlerPayableRevert.deployed();
        await buidlerPayableRevert.disablePayment();
        await buidlerWithdrawalDelayer
          .connect(hermezRollup)
          .deposit(
            buidlerPayableRevert.address,
            ethers.constants.AddressZero,
            ethers.utils.parseEther("1"), {
              value: ethers.utils.parseEther("1"),
            }
          );

        await time.increaseTo((await time.latest()) + INITIAL_DELAY);
        await expect(
          buidlerWithdrawalDelayer.withdrawal(
            buidlerPayableRevert.address,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("ETH transfer failed");
      });

      it("should revert if not able to send the token", async function() {
        await buidlerERC20Fake.setTransferFromResult(false);
        await time.increaseTo((await time.latest()) + INITIAL_DELAY);
        await expect(
          buidlerWithdrawalDelayer.withdrawal(
            ownerToken1Address,
            buidlerERC20Fake.address
          )
        ).to.be.revertedWith("Token Transfer Failed");
      });
    });

    it("should be able change the withdrawal delay", async function() {
      // NewWithdrawalDelay event
      let eventNewWithdrawalDelay = new Promise((resolve, reject) => {
        filter = buidlerWithdrawalDelayer.filters.NewWithdrawalDelay();
        buidlerWithdrawalDelayer.on(filter, async (delay) => {
          expect(delay).to.be.eq(INITIAL_DELAY * 2);
          buidlerWithdrawalDelayer.removeAllListeners();
          // Decrease the initial delay with rollup account
          await buidlerWithdrawalDelayer
            .connect(hermezRollup)
            .changeWithdrawalDelay(INITIAL_DELAY);
          // Check that it has the initial delay again
          expect(await buidlerWithdrawalDelayer.getWithdrawalDelay()).to.be.eq(
            INITIAL_DELAY
          );
          resolve();
        });

        // After 10s, we throw a timeout error
        setTimeout(() => {
          reject(new Error("timeout while waiting for event"));
        }, 10000);
      });

      // Check that only hermez keeper or rollup can change it
      await expect(
        buidlerWithdrawalDelayer.connect(ownerToken1).changeWithdrawalDelay(2)
      ).to.be.revertedWith("Only hermez keeper or rollup");

      // Check that can't exceed the MAX_WITHDRAWAL_DELAY
      await expect(
        buidlerWithdrawalDelayer
        .connect(hermezKeeper)
        .changeWithdrawalDelay(MAX_WITHDRAWAL_DELAY + 1)
      ).to.be.revertedWith("Exceeds MAX_WITHDRAWAL_DELAY");

      // check that we still have the initial withdrawalDelay
      expect(await buidlerWithdrawalDelayer.getWithdrawalDelay()).to.be.eq(
        INITIAL_DELAY
      );

      // Increase the initial delay with hermezKeeper account
      await buidlerWithdrawalDelayer
        .connect(hermezKeeper)
        .changeWithdrawalDelay(INITIAL_DELAY * 2);
      expect(await buidlerWithdrawalDelayer.getWithdrawalDelay()).to.be.eq(
        INITIAL_DELAY * 2
      );
      await eventNewWithdrawalDelay;
    });

    it("should be able to enableEmergencyMode", async function() {
      let eventEnableEmergencyMode = new Promise((resolve, reject) => {
        filter = buidlerWithdrawalDelayer.filters.EmergencyModeEnabled();
        buidlerWithdrawalDelayer.on(filter, async () => {
          buidlerWithdrawalDelayer.removeAllListeners();
          resolve();
        });
        // After 10s, we throw a timeout error
        setTimeout(() => {
          reject(new Error("timeout while waiting for event"));
        }, 10000);
      });

      await expect(
        buidlerWithdrawalDelayer.connect(hermezRollup).enableEmergencyMode()
      ).to.be.revertedWith("Only hermezKeeperAddress");
      expect(await buidlerWithdrawalDelayer.isEmergencyMode()).to.be.eq(false);
      await buidlerWithdrawalDelayer
        .connect(hermezKeeper)
        .enableEmergencyMode();
      expect(await buidlerWithdrawalDelayer.isEmergencyMode()).to.be.eq(true);

      await eventEnableEmergencyMode;
    });

    it("shouldn't be able to make a escapeHatchWithdrawal w/o Emergency Mode", async function() {
      let ERC20Amount = await buidlerERC20[0].balanceOf(
        buidlerWithdrawalDelayer.address
      );
      await expect(
        buidlerHermezGovernanceDAO.escapeHatchWithdrawal(
          buidlerWithdrawalDelayer.address,
          hermezGovernanceDAOAddress,
          buidlerERC20[0].address,
          ERC20Amount
        )
      ).to.be.revertedWith("Only Emergency Mode");
    });

    it("should revert if a deposit overflows", async function() {
      // Do the approval so that WithdrawalDelayer can transfer it
      await buidlerERC20[0]
        .connect(hermezRollup)
        .approve(
          buidlerWithdrawalDelayer.address,
          ethers.BigNumber.from(
            "0xffffffffffffffffffffffffffffffffffffffffffffffff"
          )
        );
      await buidlerWithdrawalDelayer
        .connect(hermezRollup)
        .deposit(
          ownerToken1Address,
          buidlerERC20[0].address,
          ethers.BigNumber.from(
            "0xffffffffffffffffffffffffffffffffffffffffffffffff"
          )
        );
      await buidlerERC20[0]
        .connect(hermezRollup)
        .approve(
          buidlerWithdrawalDelayer.address,
          ethers.BigNumber.from("0xFFFFFFFFFFFFFFFFFFFFFFFFFF")
        );
      await expect(
        buidlerWithdrawalDelayer
        .connect(hermezRollup)
        .deposit(
          ownerToken1Address,
          buidlerERC20[0].address,
          ethers.BigNumber.from("0xFFFFFFFFFFFFFFFFFFFFFFFFFF")
        )
      ).to.be.revertedWith("Deposit overflow");
    });
  });

  describe("Address change tests", function() {
    it("should be able to set a new hermezGovernanceDAOAddress", async function() {
      // Only the current hermezGovernanceDAOAddress can set a new address
      await expect(
        buidlerWithdrawalDelayer
        .connect(ownerToken1)
        .setHermezGovernanceDAOAddress(buidlerWithdrawalDelayer.address)
      ).to.be.revertedWith("Only Hermez Governance DAO");
      // Change HermezGovernanceDAOAddress to WithdrawalDelayerAddress
      await buidlerHermezGovernanceDAO.setHermezGovernanceDAOAddress(
        buidlerWithdrawalDelayer.address,
        buidlerWithdrawalDelayer.address
      );
      //Check that the new address is the WithdrawalDelayerAddress
      expect(
        await buidlerWithdrawalDelayer.getHermezGovernanceDAOAddress()
      ).to.be.equal(buidlerWithdrawalDelayer.address);
    });

    it("should be able to set a new hermezKeeperAddress", async function() {
      // Only the current hermezGovernanceDAOAddress can set a new address
      await expect(
        buidlerWithdrawalDelayer
        .connect(ownerToken1)
        .setHermezKeeperAddress(buidlerWithdrawalDelayer.address)
      ).to.be.revertedWith("Only Hermez Keeper Address");
      // Change HermezGovernanceDAOAddress to WithdrawalDelayerAddress
      await buidlerWithdrawalDelayer
        .connect(hermezKeeper)
        .setHermezKeeperAddress(buidlerWithdrawalDelayer.address);
      //Check that the new address is the WithdrawalDelayerAddress
      expect(
        await buidlerWithdrawalDelayer.getHermezKeeperAddress()
      ).to.be.equal(buidlerWithdrawalDelayer.address);
    });

    it("should be able to set a new whiteHackGroupAddress", async function() {
      // Only the current whiteHackGroupAddress can set a new address
      await expect(
        buidlerWithdrawalDelayer
        .connect(ownerToken1)
        .setWhiteHackGroupAddress(buidlerWithdrawalDelayer.address)
      ).to.be.revertedWith("Only WHG address");
      // Change WhiteHackGroupAddress to WithdrawalDelayerAddress
      await buidlerWhiteHackGroup.setWhiteHackGroupAddress(
        buidlerWithdrawalDelayer.address,
        buidlerWithdrawalDelayer.address
      );
      //Check that the new address is the WithdrawalDelayerAddress
      expect(
        await buidlerWithdrawalDelayer.getWhiteHackGroupAddress()
      ).to.be.equal(buidlerWithdrawalDelayer.address);
    });
  });

  describe("Emergency mode tests", function() {
    // Enable EmergencyMode and make a deposit ERC20, ERC777 and ETH
    beforeEach(async function() {
      // Enable EmergencyMode
      await buidlerWithdrawalDelayer
        .connect(hermezKeeper)
        .enableEmergencyMode();
      expect(await buidlerWithdrawalDelayer.isEmergencyMode()).to.be.eq(true);

      //Make an ERC20 deposit
      await buidlerERC20[0]
        .connect(hermezRollup)
        .approve(buidlerWithdrawalDelayer.address, DEPOSIT_AMOUNT);
      await buidlerWithdrawalDelayer
        .connect(hermezRollup)
        .deposit(ownerToken1Address, buidlerERC20[0].address, DEPOSIT_AMOUNT);

      //Make an ERC777 deposit
      let data = iface.encodeFunctionData("deposit", [ownerToken1Address, buidlerERC777[0].address, DEPOSIT_AMOUNT]);
      // Send bid data and amount
      await buidlerERC777[0]
        .connect(hermezRollup)
        .send(buidlerWithdrawalDelayer.address, DEPOSIT_AMOUNT, data);

      //Make an ETH deposit
      await buidlerWithdrawalDelayer
        .connect(hermezRollup)
        .deposit(
          ownerToken1Address,
          ethers.constants.AddressZero,
          DEPOSIT_AMOUNT, {
            value: DEPOSIT_AMOUNT,
          }
        );
    });
    it("shouldn't be able to enableEmergencyMode twice", async function() {
      await expect(
        buidlerWithdrawalDelayer.connect(hermezKeeper).enableEmergencyMode()
      ).to.be.revertedWith("Emergency mode already enabled");
    });

    it("shouldn't be able to make a normal withdraw", async function() {
      await expect(
        buidlerWithdrawalDelayer.withdrawal(
          ownerToken1Address,
          buidlerERC20[0].address
        )
      ).to.be.revertedWith("Emergency mode");
    });

    it("anyone shouldn't be able to make a escapeHatchWithdrawal", async function() {
      let ERC777Amount = await buidlerERC777[0].balanceOf(
        buidlerWithdrawalDelayer.address
      );
      await expect(
        buidlerWithdrawalDelayer
        .connect(hermezRollup)
        .escapeHatchWithdrawal(
          buidlerWithdrawalDelayer.address,
          buidlerERC777[0].address,
          ERC777Amount
        )
      ).to.be.revertedWith("Only GovernanceDAO or WHG");
    });

    it("GovernanceDAO should be able to make a escapeHatchWithdrawal at any time", async function() {
      // Check if the transfer is reverted (ERC777 and ETH)
      let ETHAmount = await ethers.provider.getBalance(
        buidlerWithdrawalDelayer.address
      );

      let ERC777Amount = await buidlerERC777[0].balanceOf(
        buidlerWithdrawalDelayer.address
      );

      await buidlerHermezGovernanceDAO.disablePayment();
      await expect(
        buidlerHermezGovernanceDAO.escapeHatchWithdrawal(
          buidlerWithdrawalDelayer.address,
          hermezGovernanceDAOAddress,
          buidlerERC777[0].address,
          ERC777Amount
        )
      ).to.be.revertedWith("Token Transfer Failed");
      await expect(
        buidlerHermezGovernanceDAO.escapeHatchWithdrawal(
          buidlerWithdrawalDelayer.address,
          hermezGovernanceDAOAddress,
          ethers.constants.AddressZero,
          ETHAmount
        )
      ).to.be.revertedWith("ETH transfer failed");

      // Enable the normal behavior to test the withdrawal
      await buidlerHermezGovernanceDAO.enablePayment();

      let ERC20Amount = await buidlerERC20[0].balanceOf(
        buidlerWithdrawalDelayer.address
      );
      ERC777Amount = await buidlerERC777[0].balanceOf(
        buidlerWithdrawalDelayer.address
      );
      ETHAmount = await ethers.provider.getBalance(
        buidlerWithdrawalDelayer.address
      );

      // Withdraw the ERC20
      await buidlerHermezGovernanceDAO.escapeHatchWithdrawal(
        buidlerWithdrawalDelayer.address,
        hermezGovernanceDAOAddress,
        buidlerERC20[0].address,
        ERC20Amount
      );
      expect(
        await buidlerERC20[0].balanceOf(hermezGovernanceDAOAddress)
      ).to.be.eq(ERC20Amount);
      // Withdraw the ERC777
      await buidlerHermezGovernanceDAO.escapeHatchWithdrawal(
        buidlerWithdrawalDelayer.address,
        hermezGovernanceDAOAddress,
        buidlerERC777[0].address,
        ERC777Amount
      );
      expect(
        await buidlerERC777[0].balanceOf(hermezGovernanceDAOAddress)
      ).to.be.eq(ERC777Amount);
      // Withdraw the ETH
      await buidlerHermezGovernanceDAO.escapeHatchWithdrawal(
        buidlerWithdrawalDelayer.address,
        hermezGovernanceDAOAddress,
        ethers.constants.AddressZero,
        ETHAmount
      );
      expect(
        await ethers.provider.getBalance(hermezGovernanceDAOAddress)
      ).to.be.eq(ETHAmount);
    });

    it("WHG should be able to make a escapeHatchWithdrawal after MAX_EMERGENCY_MODE_TIME", async function() {

      let ERC20Amount = await buidlerERC20[0].balanceOf(
        buidlerWithdrawalDelayer.address
      );
      let ERC777Amount = await buidlerERC777[0].balanceOf(
        buidlerWithdrawalDelayer.address
      );
      let ETHAmount = await ethers.provider.getBalance(
        buidlerWithdrawalDelayer.address
      );
      await expect(
        buidlerWhiteHackGroup.escapeHatchWithdrawal(
          buidlerWithdrawalDelayer.address,
          whiteHackGroupAddress,
          buidlerERC777[0].address,
          ERC777Amount
        )
      ).to.be.revertedWith("NO MAX_EMERGENCY_MODE_TIME");
      await expect(
        buidlerWhiteHackGroup.escapeHatchWithdrawal(
          buidlerWithdrawalDelayer.address,
          whiteHackGroupAddress,
          ethers.constants.AddressZero,
          ETHAmount
        )
      ).to.be.revertedWith("NO MAX_EMERGENCY_MODE_TIME");

      await time.increaseTo(
        (
          await buidlerWithdrawalDelayer.getEmergencyModeStartingTime()
        ).toNumber() + MAX_EMERGENCY_MODE_TIME
      );

      // Check if the transfer is reverted (ERC777 and ETH)
      await buidlerWhiteHackGroup.disablePayment();
      await expect(
        buidlerWhiteHackGroup.escapeHatchWithdrawal(
          buidlerWithdrawalDelayer.address,
          whiteHackGroupAddress,
          buidlerERC777[0].address,
          ERC777Amount
        )
      ).to.be.revertedWith("Token Transfer Failed");
      await expect(
        buidlerWhiteHackGroup.escapeHatchWithdrawal(
          buidlerWithdrawalDelayer.address,
          whiteHackGroupAddress,
          ethers.constants.AddressZero,
          ETHAmount
        )
      ).to.be.revertedWith("ETH transfer failed");

      // Enable the normal behavior to test the withdrawal
      await buidlerWhiteHackGroup.enablePayment();

      ERC20Amount = await buidlerERC20[0].balanceOf(
        buidlerWithdrawalDelayer.address
      );
      ERC777Amount = await buidlerERC777[0].balanceOf(
        buidlerWithdrawalDelayer.address
      );
      ETHAmount = await ethers.provider.getBalance(
        buidlerWithdrawalDelayer.address
      );

      // Withdraw the ERC20
      await buidlerWhiteHackGroup.escapeHatchWithdrawal(
        buidlerWithdrawalDelayer.address,
        whiteHackGroupAddress,
        buidlerERC20[0].address,
        ERC20Amount
      );
      expect(await buidlerERC20[0].balanceOf(whiteHackGroupAddress)).to.be.eq(
        ERC20Amount
      );
      // Withdraw the ERC777
      await buidlerWhiteHackGroup.escapeHatchWithdrawal(
        buidlerWithdrawalDelayer.address,
        whiteHackGroupAddress,
        buidlerERC777[0].address,
        ERC777Amount
      );
      expect(await buidlerERC777[0].balanceOf(whiteHackGroupAddress)).to.be.eq(
        ERC777Amount
      );
      // Withdraw the ETH
      await buidlerWhiteHackGroup.escapeHatchWithdrawal(
        buidlerWithdrawalDelayer.address,
        whiteHackGroupAddress,
        ethers.constants.AddressZero,
        ETHAmount
      );
      expect(await ethers.provider.getBalance(whiteHackGroupAddress)).to.be.eq(
        ETHAmount
      );
    });
  });
});