const {
  ethers
} = require("hardhat");
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
  let hardhatWithdrawalDelayer,
    hardhatPayableRevert,
    hardhatHermezGovernanceDAO,
    hardhatWhiteHackGroup;
  let hardhatERC20 = [];
  let hardhatERC777 = [];
  let hardhatERC20Fake;
  let hermezRollup, escapeHatch, registryFunder, ownerToken1;
  let hermezRollupAddress,
    hermezGovernanceAddress,
    whiteHackGroupAddress,
    registryFunderAddress,
    ownerToken1Address;

  before(async function() {
    const ERC20 = await ethers.getContractFactory("ERC20Mock");
    const ERC20Fake = await ethers.getContractFactory("ERC20MockFake");

    [
      hermezRollup,
      hermezGovernanceDAO,
      registryFunder,
      escapeHatch,
      ownerToken1
    ] = await ethers.getSigners();

    hermezRollupAddress = await hermezRollup.getAddress();
    registryFunderAddress = await registryFunder.getAddress();
    ownerToken1Address = await ownerToken1.getAddress();

    const PayableRevert = await ethers.getContractFactory("PayableRevert");
    hardhatPayableRevert = await PayableRevert.deploy();
    await hardhatPayableRevert.deployed();

    hardhatHermezGovernanceDAO = await PayableRevert.deploy();
    await hardhatHermezGovernanceDAO.deployed();

    hardhatWhiteHackGroup = await PayableRevert.deploy();
    await hardhatWhiteHackGroup.deployed();

    whiteHackGroupAddress = hardhatWhiteHackGroup.address;
    hermezGovernanceAddress = hardhatHermezGovernanceDAO.address;

    for (let i = 0; i < ERC20_TOKENS; i++) {
      hardhatERC20[i] = await ERC20.deploy(
        "ERC20_" + i,
        "20_" + i,
        hermezRollupAddress,
        ethers.BigNumber.from(
          "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        )
      );
      await hardhatERC20[i].deployed();
    }

    hardhatERC20Fake = await ERC20Fake.deploy(
      "ERC20Fake",
      "ERCFake",
      hermezRollupAddress,
      ethers.utils.parseEther("10000")
    );
    await hardhatERC20Fake.deployed();
  });

  // Deploy the WithdrawalDelayer
  beforeEach(async function() {
    const withdrawalDelayer = await ethers.getContractFactory(
      "WithdrawalDelayer"
    );
    hardhatWithdrawalDelayer = await withdrawalDelayer.deploy(
      INITIAL_DELAY,
      hermezRollupAddress,
      hermezGovernanceAddress,
      whiteHackGroupAddress
    );
    await hardhatWithdrawalDelayer.deployed();
  });

  describe("Common behavior tests", function() {
    describe("Deposits", function() {
      it("should be able to make a ERC20 deposit", async function() {
        // Event Deposit
        let eventDeposit = new Promise((resolve, reject) => {
          filter = hardhatWithdrawalDelayer.filters.Deposit();
          hardhatWithdrawalDelayer.on(
            filter,
            async (owner, token, amount, depositTimestamp) => {
              let latest = await ethers.provider.getBlockNumber();
              let blockTimestamp = (await ethers.provider.getBlock(latest))
                .timestamp;

              //Check the depositTimestamp
              expect(depositTimestamp).to.be.equal(blockTimestamp);

              //Check the WithdrawalDelayer balance
              await expect(
                await hardhatERC20[0].balanceOf(
                  hardhatWithdrawalDelayer.address
                )
              ).to.be.equal(DEPOSIT_AMOUNT);

              //Check the depositInfo for the owner and token
              let [
                _amount,
                _depositTimestamp,
              ] = await hardhatWithdrawalDelayer.depositInfo(owner, token);

              expect(_amount).to.be.equal(DEPOSIT_AMOUNT);
              expect(_depositTimestamp).to.be.equal(depositTimestamp);
              hardhatWithdrawalDelayer.removeAllListeners();
              resolve();
            }
          );

          // After 10s, we throw a timeout error
          setTimeout(() => {
            reject(new Error("timeout while waiting for event"));
          }, 10000);
        });

        // Do the approval so that WithdrawalDelayer can transfer it
        await hardhatERC20[0]
          .connect(hermezRollup)
          .approve(hardhatWithdrawalDelayer.address, DEPOSIT_AMOUNT);

        // Make the approval so that WithdrawalDelayer can transfer it
        await hardhatWithdrawalDelayer
          .connect(hermezRollup)
          .deposit(ownerToken1Address, hardhatERC20[0].address, DEPOSIT_AMOUNT);
        await eventDeposit;
      });

      it("should be able to make a ETH deposit", async function() {
        // Event Deposit
        let eventDeposit = new Promise((resolve, reject) => {
          filter = hardhatWithdrawalDelayer.filters.Deposit();
          hardhatWithdrawalDelayer.on(
            filter,
            async (owner, token, amount, depositTimestamp) => {
              let latest = await ethers.provider.getBlockNumber();
              let blockTimestamp = (await ethers.provider.getBlock(latest))
                .timestamp;

              expect(depositTimestamp).to.be.equal(blockTimestamp);

              await expect(
                await ethers.provider.getBalance(
                  hardhatWithdrawalDelayer.address
                )
              ).to.be.equal(DEPOSIT_AMOUNT);
              let [
                _amount,
                _depositTimestamp,
              ] = await hardhatWithdrawalDelayer.depositInfo(
                owner,
                ethers.constants.AddressZero
              );

              expect(_amount).to.be.equal(DEPOSIT_AMOUNT);
              expect(_depositTimestamp).to.be.equal(depositTimestamp);
              hardhatWithdrawalDelayer.removeAllListeners();
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
          hardhatWithdrawalDelayer
            .connect(hermezRollup)
            .deposit(
              ownerToken1Address,
              hardhatERC20[0].address,
              DEPOSIT_AMOUNT, {
                value: DEPOSIT_AMOUNT,
              }
            )
        ).to.be.revertedWith("WithdrawalDelayer::deposit: WRONG_TOKEN_ADDRESS");

        // WithdrawalDelayer::deposit: WRONG_AMOUNT
        await expect(
          hardhatWithdrawalDelayer
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
        await hardhatWithdrawalDelayer
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
        await hardhatERC20Fake.setTransferFromResult(false);
        // Do the approval so that WithdrawalDelayer can transfer it
        await hardhatERC20Fake
          .connect(hermezRollup)
          .approve(hardhatWithdrawalDelayer.address, DEPOSIT_AMOUNT);

        // Make the approval so that WithdrawalDelayer can transfer it
        await expect(
          hardhatWithdrawalDelayer
            .connect(hermezRollup)
            .deposit(
              ownerToken1Address,
              hardhatERC20Fake.address,
              DEPOSIT_AMOUNT
            )
        ).to.be.revertedWith("WithdrawalDelayer::deposit: TOKEN_TRANSFER_FAILED");
      });

      it("shouldn't be able to make a deposit without enough allowance", async function() {
        // Do the approval of DEPOSIT_AMOUNT / 2
        await hardhatERC20[0]
          .connect(hermezRollup)
          .approve(
            hardhatWithdrawalDelayer.address,
            ethers.utils.parseEther("0.5")
          );

        // Make the approval so that WithdrawalDelayer can transfer it
        await expect(
          hardhatWithdrawalDelayer
            .connect(hermezRollup)
            .deposit(
              ownerToken1Address,
              hardhatERC20[0].address,
              DEPOSIT_AMOUNT
            )
        ).to.be.revertedWith("WithdrawalDelayer::deposit: NOT_ENOUGH_ALLOWANCE");

      });

      it("shouldn't be able to make a deposit if not Hermez rollup", async function() {
        await hardhatERC20[0]
          .connect(hermezRollup)
          .approve(ownerToken1Address, DEPOSIT_AMOUNT);

        await expect(
          hardhatWithdrawalDelayer
            .connect(ownerToken1)
            .deposit(
              ownerToken1Address,
              hardhatERC20[0].address,
              DEPOSIT_AMOUNT
            )
        ).to.be.revertedWith("WithdrawalDelayer::deposit: ONLY_ROLLUP");
      });

      it("should be able to make a second deposit", async function() {
        let newDeposit = ethers.utils.parseEther("2");
        // Event Deposit
        let eventSecondDeposit = new Promise((resolve, reject) => {
          filter = hardhatWithdrawalDelayer.filters.Deposit();
          hardhatWithdrawalDelayer.on(
            filter,
            async (owner, token, amount, depositTimestamp) => {
              if (amount.eq(newDeposit)) {
                let blockTimestamp = (await time.latest()).toNumber();
                expect(depositTimestamp).to.be.equal(blockTimestamp);
                expect(amount).to.be.equal(newDeposit);
                let [
                  _amount,
                  _depositTimestamp,
                ] = await hardhatWithdrawalDelayer.depositInfo(owner, token);
                expect(_depositTimestamp).to.be.equal(blockTimestamp);
                expect(_amount).to.be.equal(
                  BigNumber.from(DEPOSIT_AMOUNT).add(newDeposit)
                );
                hardhatWithdrawalDelayer.removeAllListeners();
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
        await hardhatERC20[0]
          .connect(hermezRollup)
          .approve(hardhatWithdrawalDelayer.address, DEPOSIT_AMOUNT);

        // Make the approval so that WithdrawalDelayer can transfer it
        await hardhatWithdrawalDelayer
          .connect(hermezRollup)
          .deposit(ownerToken1Address, hardhatERC20[0].address, DEPOSIT_AMOUNT);

        // Get first desopist info
        let [
          prevAmount,
          prevDepositTimestamp,
        ] = await hardhatWithdrawalDelayer.depositInfo(
          ownerToken1Address,
          hardhatERC20[0].address
        );

        // Approve second deposit
        await hardhatERC20[0]
          .connect(hermezRollup)
          .approve(hardhatWithdrawalDelayer.address, newDeposit);

        // Make second deposit
        await hardhatWithdrawalDelayer
          .connect(hermezRollup)
          .deposit(ownerToken1Address, hardhatERC20[0].address, newDeposit);
        await eventSecondDeposit;
      });
    });

    describe("Withdrawals", function() {
      beforeEach(async function() {
        //Make an ERC20 deposit
        await hardhatERC20[0]
          .connect(hermezRollup)
          .approve(hardhatWithdrawalDelayer.address, DEPOSIT_AMOUNT);
        await hardhatWithdrawalDelayer
          .connect(hermezRollup)
          .deposit(ownerToken1Address, hardhatERC20[0].address, DEPOSIT_AMOUNT);

        //Make an ERC20Fake deposit
        await hardhatERC20Fake.setTransferFromResult(true);
        await hardhatERC20Fake
          .connect(hermezRollup)
          .approve(hardhatWithdrawalDelayer.address, DEPOSIT_AMOUNT);
        await hardhatWithdrawalDelayer
          .connect(hermezRollup)
          .deposit(
            ownerToken1Address,
            hardhatERC20Fake.address,
            DEPOSIT_AMOUNT
          );

        //Make an ETH deposit
        await hardhatWithdrawalDelayer
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
          hardhatWithdrawalDelayer.withdrawal(
            registryFunderAddress,
            hardhatERC20[0].address
          )
        ).to.be.revertedWith("WithdrawalDelayer::withdrawal: NO_FUNDS");
      });

      it("shouldn't be able to withdraw if the delay time has not exceeded", async function() {
        await expect(
          hardhatWithdrawalDelayer.withdrawal(
            ownerToken1Address,
            hardhatERC20[0].address
          )
        ).to.be.revertedWith("WithdrawalDelayer::withdrawal: WITHDRAWAL_NOT_ALLOWED");
      });

      it("should be able to make an ERC20 withdrawal", async function() {
        let prevAmount = await hardhatERC20[0].balanceOf(ownerToken1Address);

        let eventWithdraw = new Promise((resolve, reject) => {
          filter = hardhatWithdrawalDelayer.filters.Withdraw();
          hardhatWithdrawalDelayer.on(filter, async (owner, token) => {
            let [
              newAmount,
              newTimeToClaim,
            ] = await hardhatWithdrawalDelayer.depositInfo(owner, token);
            expect(newAmount).to.be.eq(0);
            expect(newTimeToClaim).to.be.eq(0);
            hardhatWithdrawalDelayer.removeAllListeners();
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
        ] = await hardhatWithdrawalDelayer.depositInfo(
          ownerToken1Address,
          hardhatERC20[0].address
        );
        await time.increaseTo(depositTimestamp.toNumber() + INITIAL_DELAY);
        await hardhatWithdrawalDelayer.withdrawal(
          ownerToken1Address,
          hardhatERC20[0].address
        );
        expect(await hardhatERC20[0].balanceOf(ownerToken1Address)).to.be.eq(
          amount.add(prevAmount)
        );
        await eventWithdraw;
      });

      it("should be able to make an ETH withdrawal", async function() {
        let prevAmount = await ethers.provider.getBalance(ownerToken1Address);

        let eventWithdraw = new Promise((resolve, reject) => {
          filter = hardhatWithdrawalDelayer.filters.Withdraw();
          hardhatWithdrawalDelayer.on(filter, async (owner, token) => {
            let [
              newAmount,
              newTimeToClaim,
            ] = await hardhatWithdrawalDelayer.depositInfo(owner, token);
            expect(newAmount).to.be.eq(0);
            expect(newTimeToClaim).to.be.eq(0);
            hardhatWithdrawalDelayer.removeAllListeners();
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
        ] = await hardhatWithdrawalDelayer.depositInfo(
          ownerToken1Address,
          ethers.constants.AddressZero
        );
        await time.increaseTo(depositTimestamp.toNumber() + INITIAL_DELAY);
        await hardhatWithdrawalDelayer.withdrawal(
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
        let hardhatPayableRevert = await PayableRevert.deploy();
        await hardhatPayableRevert.deployed();
        await hardhatPayableRevert.disablePayment();
        await hardhatWithdrawalDelayer
          .connect(hermezRollup)
          .deposit(
            hardhatPayableRevert.address,
            ethers.constants.AddressZero,
            ethers.utils.parseEther("1"), {
              value: ethers.utils.parseEther("1"),
            }
          );

        await time.increaseTo((await time.latest()) + INITIAL_DELAY);
        await expect(
          hardhatWithdrawalDelayer.withdrawal(
            hardhatPayableRevert.address,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("WithdrawalDelayer::_ethWithdrawal: TRANSFER_FAILED");
      });

      it("should revert if not able to send the token", async function() {
        await hardhatERC20Fake.setTransferFromResult(false);
        await time.increaseTo((await time.latest()) + INITIAL_DELAY);
        await expect(
          hardhatWithdrawalDelayer.withdrawal(
            ownerToken1Address,
            hardhatERC20Fake.address
          )
        ).to.be.revertedWith("WithdrawalDelayer::_tokenWithdrawal: TOKEN_TRANSFER_FAILED");
      });
    });

    it("should be able change the withdrawal delay", async function() {
      // NewWithdrawalDelay event
      let eventNewWithdrawalDelay = new Promise((resolve, reject) => {
        filter = hardhatWithdrawalDelayer.filters.NewWithdrawalDelay();
        hardhatWithdrawalDelayer.on(filter, async (delay) => {
          expect(delay).to.be.eq(INITIAL_DELAY * 2);
          hardhatWithdrawalDelayer.removeAllListeners();
          // Decrease the initial delay with rollup account
          await hardhatWithdrawalDelayer
            .connect(hermezRollup)
            .changeWithdrawalDelay(INITIAL_DELAY);
          // Check that it has the initial delay again
          expect(await hardhatWithdrawalDelayer.getWithdrawalDelay()).to.be.eq(
            INITIAL_DELAY
          );
          resolve();
        });

        // After 10s, we throw a timeout error
        setTimeout(() => {
          reject(new Error("timeout while waiting for event"));
        }, 10000);
      });

      // Check that only hermez governance or rollup can change it
      await expect(
        hardhatWithdrawalDelayer.connect(ownerToken1).changeWithdrawalDelay(2)
      ).to.be.revertedWith("WithdrawalDelayer::changeWithdrawalDelay: ONLY_ROLLUP_OR_GOVERNANCE");

      // Check that can't exceed the MAX_WITHDRAWAL_DELAY
      await expect(
        hardhatHermezGovernanceDAO
          .changeWithdrawalDelay(hardhatWithdrawalDelayer.address, MAX_WITHDRAWAL_DELAY + 1)
      ).to.be.revertedWith("WithdrawalDelayer::changeWithdrawalDelay: EXCEEDS_MAX_WITHDRAWAL_DELAY");

      // check that we still have the initial withdrawalDelay
      expect(await hardhatWithdrawalDelayer.getWithdrawalDelay()).to.be.eq(
        INITIAL_DELAY
      );

      // Increase the initial delay with governance
      await hardhatHermezGovernanceDAO
        .changeWithdrawalDelay(hardhatWithdrawalDelayer.address, INITIAL_DELAY * 2);
      expect(await hardhatWithdrawalDelayer.getWithdrawalDelay()).to.be.eq(
        INITIAL_DELAY * 2
      );
      await eventNewWithdrawalDelay;
    });

    it("should be able to enableEmergencyMode", async function() {
      let eventEnableEmergencyMode = new Promise((resolve, reject) => {
        filter = hardhatWithdrawalDelayer.filters.EmergencyModeEnabled();
        hardhatWithdrawalDelayer.on(filter, async () => {
          hardhatWithdrawalDelayer.removeAllListeners();
          resolve();
        });
        // After 10s, we throw a timeout error
        setTimeout(() => {
          reject(new Error("timeout while waiting for event"));
        }, 10000);
      });

      await expect(
        hardhatWithdrawalDelayer.connect(hermezRollup).enableEmergencyMode()
      ).to.be.revertedWith("WithdrawalDelayer::enableEmergencyMode: ONLY_GOVERNANCE");
      expect(await hardhatWithdrawalDelayer.isEmergencyMode()).to.be.eq(false);
      await hardhatHermezGovernanceDAO
        .enableEmergencyMode(hardhatWithdrawalDelayer.address);
      expect(await hardhatWithdrawalDelayer.isEmergencyMode()).to.be.eq(true);

      await eventEnableEmergencyMode;
    });

    it("shouldn't be able to make a escapeHatchWithdrawal w/o Emergency Mode", async function() {
      let ERC20Amount = await hardhatERC20[0].balanceOf(
        hardhatWithdrawalDelayer.address
      );
      await expect(
        hardhatHermezGovernanceDAO.escapeHatchWithdrawal(
          hardhatWithdrawalDelayer.address,
          hermezGovernanceAddress,
          hardhatERC20[0].address,
          ERC20Amount
        )
      ).to.be.revertedWith("WithdrawalDelayer::escapeHatchWithdrawal: ONLY_EMODE");
    });

    it("should revert if a deposit overflows", async function() {
      // Do the approval so that WithdrawalDelayer can transfer it
      await hardhatERC20[0]
        .connect(hermezRollup)
        .approve(
          hardhatWithdrawalDelayer.address,
          ethers.BigNumber.from(
            "0xffffffffffffffffffffffffffffffffffffffffffffffff"
          )
        );
      await hardhatWithdrawalDelayer
        .connect(hermezRollup)
        .deposit(
          ownerToken1Address,
          hardhatERC20[0].address,
          ethers.BigNumber.from(
            "0xffffffffffffffffffffffffffffffffffffffffffffffff"
          )
        );
      await hardhatERC20[0]
        .connect(hermezRollup)
        .approve(
          hardhatWithdrawalDelayer.address,
          ethers.BigNumber.from("0xFFFFFFFFFFFFFFFFFFFFFFFFFF")
        );
      await expect(
        hardhatWithdrawalDelayer
          .connect(hermezRollup)
          .deposit(
            ownerToken1Address,
            hardhatERC20[0].address,
            ethers.BigNumber.from("0xFFFFFFFFFFFFFFFFFFFFFFFFFF")
          )
      ).to.be.revertedWith("WithdrawalDelayer::_processDeposit: DEPOSIT_OVERFLOW");
    });
  });

  describe("Address change tests", function() {
    it("should be able to set a new hermezGovernanceAddress", async function() {
      // Only the current hermezGovernanceAddress can set a new address
      await expect(
        hardhatWithdrawalDelayer
          .connect(ownerToken1)
          .transferGovernance(hardhatWithdrawalDelayer.address)
      ).to.be.revertedWith("WithdrawalDelayer::transferGovernance: ONLY_GOVERNANCE");
      // Change hermezGovernanceAddress to WithdrawalDelayerAddress
      await hardhatHermezGovernanceDAO.transferGovernance(
        hardhatWithdrawalDelayer.address,
        await hermezGovernanceDAO.getAddress()
      );
      hardhatWithdrawalDelayer.connect(hermezGovernanceDAO).claimGovernance();
      //Check that the new address is the WithdrawalDelayerAddress
      expect(
        await hardhatWithdrawalDelayer.getHermezGovernanceAddress()
      ).to.be.equal(await hermezGovernanceDAO.getAddress());
    });

    it("should be able to set a new emergencyCouncil", async function() {
      // Only the current whiteHackGroupAddress can set a new address
      await expect(
        hardhatWithdrawalDelayer
          .connect(ownerToken1)
          .transferEmergencyCouncil(hardhatWithdrawalDelayer.address)
      ).to.be.revertedWith("WithdrawalDelayer::transferEmergencyCouncil: ONLY_EMERGENCY_COUNCIL");
      // Change WhiteHackGroupAddress to WithdrawalDelayerAddress
      await hardhatWhiteHackGroup.transferEmergencyCouncil(
        hardhatWithdrawalDelayer.address,
        await hermezGovernanceDAO.getAddress()
      );
      hardhatWithdrawalDelayer.connect(hermezGovernanceDAO).claimEmergencyCouncil();

      //Check that the new address is the WithdrawalDelayerAddress
      expect(
        await hardhatWithdrawalDelayer.getEmergencyCouncil()
      ).to.be.equal(await hermezGovernanceDAO.getAddress());
    });
  });

  describe("Emergency mode tests", function() {
    // Enable EmergencyMode and make a deposit ERC20 and ETH
    beforeEach(async function() {
      // Enable EmergencyMode
      await hardhatHermezGovernanceDAO
        .enableEmergencyMode(hardhatWithdrawalDelayer.address);
      expect(await hardhatWithdrawalDelayer.isEmergencyMode()).to.be.eq(true);

      //Make an ERC20 deposit
      await hardhatERC20[0]
        .connect(hermezRollup)
        .approve(hardhatWithdrawalDelayer.address, DEPOSIT_AMOUNT);
      await hardhatWithdrawalDelayer
        .connect(hermezRollup)
        .deposit(ownerToken1Address, hardhatERC20[0].address, DEPOSIT_AMOUNT);

      //Make an ETH deposit
      await hardhatWithdrawalDelayer
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
        hardhatHermezGovernanceDAO.enableEmergencyMode(hardhatWithdrawalDelayer.address)
      ).to.be.revertedWith("WithdrawalDelayer::enableEmergencyMode: ALREADY_ENABLED");
    });

    it("shouldn't be able to make a normal withdraw", async function() {
      await expect(
        hardhatWithdrawalDelayer.withdrawal(
          ownerToken1Address,
          hardhatERC20[0].address
        )
      ).to.be.revertedWith("WithdrawalDelayer::deposit: EMERGENCY_MODE");
    });

    it("anyone shouldn't be able to make a escapeHatchWithdrawal", async function() {
      let amount = await hardhatERC20[0].balanceOf(
        hardhatWithdrawalDelayer.address
      );
      await expect(
        hardhatWithdrawalDelayer
          .connect(hermezRollup)
          .escapeHatchWithdrawal(
            hardhatWithdrawalDelayer.address,
            hardhatERC20[0].address,
            amount
          )
      ).to.be.revertedWith("WithdrawalDelayer::escapeHatchWithdrawal: ONLY_GOVERNANCE");
    });

    it("GovernanceDAO should be able to make a escapeHatchWithdrawal at any time", async function() {
      // Check if the transfer is reverted (ETH)
      let ETHAmount = await ethers.provider.getBalance(
        hardhatWithdrawalDelayer.address
      );


      await hardhatHermezGovernanceDAO.disablePayment();
      await expect(
        hardhatHermezGovernanceDAO.escapeHatchWithdrawal(
          hardhatWithdrawalDelayer.address,
          hermezGovernanceAddress,
          ethers.constants.AddressZero,
          ETHAmount
        )
      ).to.be.revertedWith("WithdrawalDelayer::_ethWithdrawal: TRANSFER_FAILED");

      // Enable the normal behavior to test the withdrawal
      await hardhatHermezGovernanceDAO.enablePayment();

      let ERC20Amount = await hardhatERC20[0].balanceOf(
        hardhatWithdrawalDelayer.address
      );
      ETHAmount = await ethers.provider.getBalance(
        hardhatWithdrawalDelayer.address
      );

      // Withdraw the ERC20
      await hardhatHermezGovernanceDAO.escapeHatchWithdrawal(
        hardhatWithdrawalDelayer.address,
        hermezGovernanceAddress,
        hardhatERC20[0].address,
        ERC20Amount
      );
      expect(
        await hardhatERC20[0].balanceOf(hermezGovernanceAddress)
      ).to.be.eq(ERC20Amount);

      // Withdraw the ETH
      await hardhatHermezGovernanceDAO.escapeHatchWithdrawal(
        hardhatWithdrawalDelayer.address,
        hermezGovernanceAddress,
        ethers.constants.AddressZero,
        ETHAmount
      );
      expect(
        await ethers.provider.getBalance(hermezGovernanceAddress)
      ).to.be.eq(ETHAmount);
    });

    it("WHG should be able to make a escapeHatchWithdrawal after MAX_EMERGENCY_MODE_TIME", async function() {

      let ERC20Amount = await hardhatERC20[0].balanceOf(
        hardhatWithdrawalDelayer.address
      );
      let ETHAmount = await ethers.provider.getBalance(
        hardhatWithdrawalDelayer.address
      );
      await expect(
        hardhatWhiteHackGroup.escapeHatchWithdrawal(
          hardhatWithdrawalDelayer.address,
          whiteHackGroupAddress,
          hardhatERC20[0].address,
          ERC20Amount
        )
      ).to.be.revertedWith("WithdrawalDelayer::escapeHatchWithdrawal: NO_MAX_EMERGENCY_MODE_TIME");
      await expect(
        hardhatWhiteHackGroup.escapeHatchWithdrawal(
          hardhatWithdrawalDelayer.address,
          whiteHackGroupAddress,
          ethers.constants.AddressZero,
          ETHAmount
        )
      ).to.be.revertedWith("WithdrawalDelayer::escapeHatchWithdrawal: NO_MAX_EMERGENCY_MODE_TIME");

      await time.increaseTo(
        (
          await hardhatWithdrawalDelayer.getEmergencyModeStartingTime()
        ).toNumber() + MAX_EMERGENCY_MODE_TIME
      );

      // Check if the transfer is reverted (ETH)
      await hardhatWhiteHackGroup.disablePayment();
      await expect(
        hardhatWhiteHackGroup.escapeHatchWithdrawal(
          hardhatWithdrawalDelayer.address,
          whiteHackGroupAddress,
          ethers.constants.AddressZero,
          ETHAmount
        )
      ).to.be.revertedWith("WithdrawalDelayer::_ethWithdrawal: TRANSFER_FAILED");

      // Enable the normal behavior to test the withdrawal
      await hardhatWhiteHackGroup.enablePayment();

      ERC20Amount = await hardhatERC20[0].balanceOf(
        hardhatWithdrawalDelayer.address
      );
      ETHAmount = await ethers.provider.getBalance(
        hardhatWithdrawalDelayer.address
      );

      // Withdraw the ERC20
      await hardhatWhiteHackGroup.escapeHatchWithdrawal(
        hardhatWithdrawalDelayer.address,
        whiteHackGroupAddress,
        hardhatERC20[0].address,
        ERC20Amount
      );
      expect(await hardhatERC20[0].balanceOf(whiteHackGroupAddress)).to.be.eq(
        ERC20Amount
      );
      // Withdraw the ETH
      await hardhatWhiteHackGroup.escapeHatchWithdrawal(
        hardhatWithdrawalDelayer.address,
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