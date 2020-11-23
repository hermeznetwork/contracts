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

const ERC20_TOKENS = 1;
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
    hermezGovernanceAddress,
    hermezKeeperAddress,
    whiteHackGroupAddress,
    registryFunderAddress,
    ownerToken1Address;

  before(async function() {
    const ERC20 = await ethers.getContractFactory("ERC20Mock");
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

    const PayableRevert = await ethers.getContractFactory("PayableRevert");
    buidlerPayableRevert = await PayableRevert.deploy();
    await buidlerPayableRevert.deployed();

    buidlerHermezGovernanceDAO = await PayableRevert.deploy();
    await buidlerHermezGovernanceDAO.deployed();

    buidlerWhiteHackGroup = await PayableRevert.deploy();
    await buidlerWhiteHackGroup.deployed();

    whiteHackGroupAddress = buidlerWhiteHackGroup.address;
    hermezGovernanceAddress = buidlerHermezGovernanceDAO.address;

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
      hermezGovernanceAddress,
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
            hermezGovernanceAddress,
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

        // Check that WithdrawalDelayer::deposit: WRONG_TOKEN_ADDRESS
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
        ).to.be.revertedWith("WithdrawalDelayer::deposit: WRONG_TOKEN_ADDRESS");

        // WithdrawalDelayer::deposit: WRONG_AMOUNT
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
        ).to.be.revertedWith("WithdrawalDelayer::deposit: WRONG_AMOUNT");

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
        ).to.be.revertedWith("WithdrawalDelayer::deposit: TOKEN_TRANSFER_FAILED");
      });

      it("shouldn't be able to make a deposit without enough allowance", async function() {
        // Do the approval of DEPOSIT_AMOUNT / 2
        await buidlerERC20[0]
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
        ).to.be.revertedWith("WithdrawalDelayer::deposit: NOT_ENOUGH_ALLOWANCE");

      });

      it("shouldn't be able to make a deposit if not Hermez rollup", async function() {
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
        ).to.be.revertedWith("WithdrawalDelayer::deposit: ONLY_ROLLUP");
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
        ).to.be.revertedWith("WithdrawalDelayer::withdrawal: NO_FUNDS");
      });

      it("shouldn't be able to withdraw if the delay time has not exceeded", async function() {
        await expect(
          buidlerWithdrawalDelayer.withdrawal(
            ownerToken1Address,
            buidlerERC20[0].address
          )
        ).to.be.revertedWith("WithdrawalDelayer::withdrawal: WITHDRAWAL_NOT_ALLOWED");
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
        ).to.be.revertedWith("WithdrawalDelayer::_ethWithdrawal: TRANSFER_FAILED");
      });

      it("should revert if not able to send the token", async function() {
        await buidlerERC20Fake.setTransferFromResult(false);
        await time.increaseTo((await time.latest()) + INITIAL_DELAY);
        await expect(
          buidlerWithdrawalDelayer.withdrawal(
            ownerToken1Address,
            buidlerERC20Fake.address
          )
        ).to.be.revertedWith("WithdrawalDelayer::_tokenWithdrawal: TOKEN_TRANSFER_FAILED");
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
      ).to.be.revertedWith("WithdrawalDelayer::enableEmergencyMode: ONLY_KEEPER");
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
          hermezGovernanceAddress,
          buidlerERC20[0].address,
          ERC20Amount
        )
      ).to.be.revertedWith("WithdrawalDelayer::escapeHatchWithdrawal: ONLY_EMODE");
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
      ).to.be.revertedWith("WithdrawalDelayer::_processDeposit: DEPOSIT_OVERFLOW");
    });
  });

  describe("Address change tests", function() {
    it("should be able to set a new hermezGovernanceAddress", async function() {
      // Only the current hermezGovernanceAddress can set a new address
      await expect(
        buidlerWithdrawalDelayer
          .connect(ownerToken1)
          .setHermezGovernanceAddress(buidlerWithdrawalDelayer.address)
      ).to.be.revertedWith("WithdrawalDelayer::setHermezGovernanceAddress: ONLY_GOVERNANCE");
      // Change hermezGovernanceAddress to WithdrawalDelayerAddress
      await buidlerHermezGovernanceDAO.setHermezGovernanceAddress(
        buidlerWithdrawalDelayer.address,
        buidlerWithdrawalDelayer.address
      );
      //Check that the new address is the WithdrawalDelayerAddress
      expect(
        await buidlerWithdrawalDelayer.getHermezGovernanceAddress()
      ).to.be.equal(buidlerWithdrawalDelayer.address);
    });

    it("should be able to set a new hermezKeeperAddress", async function() {
      // Only the current hermezGovernanceAddress can set a new address
      await expect(
        buidlerWithdrawalDelayer
          .connect(ownerToken1)
          .setHermezKeeperAddress(buidlerWithdrawalDelayer.address)
      ).to.be.revertedWith("WithdrawalDelayer::setHermezKeeperAddress: ONLY_KEEPER");
      // Change hermezGovernanceAddress to WithdrawalDelayerAddress
      await buidlerWithdrawalDelayer
        .connect(hermezKeeper)
        .setHermezKeeperAddress(buidlerWithdrawalDelayer.address);
      //Check that the new address is the WithdrawalDelayerAddress
      expect(
        await buidlerWithdrawalDelayer.getHermezKeeperAddress()
      ).to.be.equal(buidlerWithdrawalDelayer.address);
    });

    it("should be able to set a new emergencyCouncil", async function() {
      // Only the current whiteHackGroupAddress can set a new address
      await expect(
        buidlerWithdrawalDelayer
          .connect(ownerToken1)
          .setEmergencyCouncil(buidlerWithdrawalDelayer.address)
      ).to.be.revertedWith("WithdrawalDelayer::setEmergencyCouncil: ONLY_EMERGENCY_COUNCIL");
      // Change WhiteHackGroupAddress to WithdrawalDelayerAddress
      await buidlerWhiteHackGroup.setEmergencyCouncil(
        buidlerWithdrawalDelayer.address,
        buidlerWithdrawalDelayer.address
      );
      //Check that the new address is the WithdrawalDelayerAddress
      expect(
        await buidlerWithdrawalDelayer.getEmergencyCouncil()
      ).to.be.equal(buidlerWithdrawalDelayer.address);
    });
  });

  describe("Emergency mode tests", function() {
    // Enable EmergencyMode and make a deposit ERC20 and ETH
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
      ).to.be.revertedWith("WithdrawalDelayer::enableEmergencyMode: ALREADY_ENABLED");
    });

    it("shouldn't be able to make a normal withdraw", async function() {
      await expect(
        buidlerWithdrawalDelayer.withdrawal(
          ownerToken1Address,
          buidlerERC20[0].address
        )
      ).to.be.revertedWith("WithdrawalDelayer::deposit: EMERGENCY_MODE");
    });

    it("anyone shouldn't be able to make a escapeHatchWithdrawal", async function() {
      let amount = await buidlerERC20[0].balanceOf(
        buidlerWithdrawalDelayer.address
      );
      await expect(
        buidlerWithdrawalDelayer
          .connect(hermezRollup)
          .escapeHatchWithdrawal(
            buidlerWithdrawalDelayer.address,
            buidlerERC20[0].address,
            amount
          )
      ).to.be.revertedWith("WithdrawalDelayer::escapeHatchWithdrawal: ONLY_GOVERNANCE");
    });

    it("GovernanceDAO should be able to make a escapeHatchWithdrawal at any time", async function() {
      // Check if the transfer is reverted (ETH)
      let ETHAmount = await ethers.provider.getBalance(
        buidlerWithdrawalDelayer.address
      );


      await buidlerHermezGovernanceDAO.disablePayment();
      await expect(
        buidlerHermezGovernanceDAO.escapeHatchWithdrawal(
          buidlerWithdrawalDelayer.address,
          hermezGovernanceAddress,
          ethers.constants.AddressZero,
          ETHAmount
        )
      ).to.be.revertedWith("WithdrawalDelayer::_ethWithdrawal: TRANSFER_FAILED");

      // Enable the normal behavior to test the withdrawal
      await buidlerHermezGovernanceDAO.enablePayment();

      let ERC20Amount = await buidlerERC20[0].balanceOf(
        buidlerWithdrawalDelayer.address
      );
      ETHAmount = await ethers.provider.getBalance(
        buidlerWithdrawalDelayer.address
      );

      // Withdraw the ERC20
      await buidlerHermezGovernanceDAO.escapeHatchWithdrawal(
        buidlerWithdrawalDelayer.address,
        hermezGovernanceAddress,
        buidlerERC20[0].address,
        ERC20Amount
      );
      expect(
        await buidlerERC20[0].balanceOf(hermezGovernanceAddress)
      ).to.be.eq(ERC20Amount);

      // Withdraw the ETH
      await buidlerHermezGovernanceDAO.escapeHatchWithdrawal(
        buidlerWithdrawalDelayer.address,
        hermezGovernanceAddress,
        ethers.constants.AddressZero,
        ETHAmount
      );
      expect(
        await ethers.provider.getBalance(hermezGovernanceAddress)
      ).to.be.eq(ETHAmount);
    });

    it("WHG should be able to make a escapeHatchWithdrawal after MAX_EMERGENCY_MODE_TIME", async function() {

      let ERC20Amount = await buidlerERC20[0].balanceOf(
        buidlerWithdrawalDelayer.address
      );
      let ETHAmount = await ethers.provider.getBalance(
        buidlerWithdrawalDelayer.address
      );
      await expect(
        buidlerWhiteHackGroup.escapeHatchWithdrawal(
          buidlerWithdrawalDelayer.address,
          whiteHackGroupAddress,
          buidlerERC20[0].address,
          ERC20Amount
        )
      ).to.be.revertedWith("WithdrawalDelayer::escapeHatchWithdrawal: NO_MAX_EMERGENCY_MODE_TIME");
      await expect(
        buidlerWhiteHackGroup.escapeHatchWithdrawal(
          buidlerWithdrawalDelayer.address,
          whiteHackGroupAddress,
          ethers.constants.AddressZero,
          ETHAmount
        )
      ).to.be.revertedWith("WithdrawalDelayer::escapeHatchWithdrawal: NO_MAX_EMERGENCY_MODE_TIME");

      await time.increaseTo(
        (
          await buidlerWithdrawalDelayer.getEmergencyModeStartingTime()
        ).toNumber() + MAX_EMERGENCY_MODE_TIME
      );

      // Check if the transfer is reverted (ETH)
      await buidlerWhiteHackGroup.disablePayment();
      await expect(
        buidlerWhiteHackGroup.escapeHatchWithdrawal(
          buidlerWithdrawalDelayer.address,
          whiteHackGroupAddress,
          ethers.constants.AddressZero,
          ETHAmount
        )
      ).to.be.revertedWith("WithdrawalDelayer::_ethWithdrawal: TRANSFER_FAILED");

      // Enable the normal behavior to test the withdrawal
      await buidlerWhiteHackGroup.enablePayment();

      ERC20Amount = await buidlerERC20[0].balanceOf(
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