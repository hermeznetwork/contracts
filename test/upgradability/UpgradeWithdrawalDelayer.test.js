const { ethers, upgrades } = require("@nomiclabs/buidler");
const {
    expect
} = require("chai");


const ProxyAdmin = require('@openzeppelin/upgrades-core/artifacts/ProxyAdmin.json');
const { getAdminAddress } = require('@openzeppelin/upgrades-core');

const TIMEOUT = 400000;
const INITIAL_WITHDRAWAL_DELAY = 3600; //seconds

describe("upgradability test", function() {
    this.timeout(TIMEOUT);
    let deployer,
        hermezGovernanceEthers, initAddressEthers;

    let hermezGovernanceAddress, initAddress;

    let withdrawalDelayer

    beforeEach(async function() {
        [
            deployer,
            hermezGovernanceEthers,
            initAddressEthers
        ] = await ethers.getSigners();
        hermezGovernanceAddress = await hermezGovernanceEthers.getAddress();
        initAddress = await initAddressEthers.getAddress();

        const WithdrawalDelayer = await ethers.getContractFactory(
            "WithdrawalDelayer"
        );

        // Deploy smart contacts:
        withdrawalDelayer = await upgrades.deployProxy(
            WithdrawalDelayer,
            [],
            {
                unsafeAllowCustomTypes: true,
                initializer: undefined,
            }
        );
        await withdrawalDelayer.deployed();
        await withdrawalDelayer.withdrawalDelayerInitializer(
            INITIAL_WITHDRAWAL_DELAY,
            initAddress,
            initAddress,
            initAddress,
            initAddress
        );
    })

    it('should be able to upgrade WithdrawalDelayer', async () => {
        const WithdrawalDelayerV2 = await ethers.getContractFactory("WithdrawalDelayerV2");
        const newWithdrawalDelayerV2 = WithdrawalDelayerV2.attach(withdrawalDelayer.address);

        await expect(newWithdrawalDelayerV2.getVersion()).to.be.reverted;

        await upgrades.upgradeProxy(withdrawalDelayer.address, WithdrawalDelayerV2, {
            unsafeAllowCustomTypes: true
        });
        await expect(newWithdrawalDelayerV2.withdrawalDelayerInitializer(
            INITIAL_WITHDRAWAL_DELAY,
            initAddress,
            initAddress,
            initAddress,
            initAddress
        )).to.be.revertedWith("Contract instance has already been initialized");

        await newWithdrawalDelayerV2.setVersion();
        expect(await newWithdrawalDelayerV2.getVersion()).to.be.equal(2);
    })

    it('should be able to upgrade WithdrawalDelayer with prepareUpgrade', async () => {
        const WithdrawalDelayerV2 = await ethers.getContractFactory("WithdrawalDelayerV2");

        const withdrawalDelayerV2 = await upgrades.prepareUpgrade(withdrawalDelayer.address, WithdrawalDelayerV2, {
            unsafeAllowCustomTypes: true
        });

        const AdminFactory = await getProxyAdminFactory();
        const admin = AdminFactory.attach(await getAdminAddress(ethers.provider, withdrawalDelayer.address));
        const proxyAdminAddress = await getAdminAddress(ethers.provider, withdrawalDelayer.address);

        await admin.upgrade(withdrawalDelayer.address, withdrawalDelayerV2);
        const newWithdrawalDelayerV2 = WithdrawalDelayerV2.attach(withdrawalDelayer.address);
        await newWithdrawalDelayerV2.setVersion();
        expect(await newWithdrawalDelayerV2.getVersion()).to.be.equal(2);
    });

    it('should be able to upgrade WithdrawalDelayer with prepareUpgrade after transferProxyAdminOwnership', async () => {
        const WithdrawalDelayerV2 = await ethers.getContractFactory("WithdrawalDelayerV2");

        const withdrawalDelayerV2 = await upgrades.prepareUpgrade(withdrawalDelayer.address, WithdrawalDelayerV2, {
            unsafeAllowCustomTypes: true
        });


        await upgrades.admin.transferProxyAdminOwnership(hermezGovernanceAddress);

        const AdminFactory = await getProxyAdminFactory();
        const admin = AdminFactory.attach(await getAdminAddress(ethers.provider, withdrawalDelayer.address));
        const proxyAdminAddress = await getAdminAddress(ethers.provider, withdrawalDelayer.address);

        await admin.connect(hermezGovernanceEthers).upgrade(withdrawalDelayer.address, withdrawalDelayerV2);
        const newWithdrawalDelayerV2 = WithdrawalDelayerV2.attach(withdrawalDelayer.address);
        await newWithdrawalDelayerV2.setVersion();
        expect(await newWithdrawalDelayerV2.getVersion()).to.be.equal(2);
    });


    it('should be able to upgrade using Timelock WithdrawalDelayer with prepareUpgrade', async () => {
        const WithdrawalDelayerV2 = await ethers.getContractFactory("WithdrawalDelayerV2");
        const Timelock = await ethers.getContractFactory("Timelock");

        const newWithdrawalDelayerV2 = WithdrawalDelayerV2.attach(withdrawalDelayer.address);
        await expect(newWithdrawalDelayerV2.getVersion()).to.be.reverted;

        const AdminFactory = await getProxyAdminFactory();
        let adminAddress = await getAdminAddress(ethers.provider, withdrawalDelayer.address);
        const admin = AdminFactory.attach(adminAddress);


        // Deploy Timelock
        const TimelockBuidler = await Timelock.deploy(hermezGovernanceAddress, 604800);
        await TimelockBuidler.deployed();
        await admin.connect(hermezGovernanceEthers).transferOwnership(TimelockBuidler.address);

        const withdrawalDelayerV2 = await upgrades.prepareUpgrade(withdrawalDelayer.address, WithdrawalDelayerV2, {
            unsafeAllowCustomTypes: true
        });

        let iface = new ethers.utils.Interface(ProxyAdmin.abi);
        let latest = await ethers.provider.getBlockNumber();
        let blockTimestamp = (await ethers.provider.getBlock(latest)).timestamp;
        let eta = blockTimestamp + 605800
        await TimelockBuidler.connect(hermezGovernanceEthers).queueTransaction(
            adminAddress,
            0,
            "",
            iface.encodeFunctionData("upgrade", [withdrawalDelayer.address, withdrawalDelayerV2]),
            eta
        );

        await expect(TimelockBuidler.connect(hermezGovernanceEthers).executeTransaction(
            adminAddress,
            0,
            "",
            iface.encodeFunctionData("upgrade", [withdrawalDelayer.address, withdrawalDelayerV2]),
            eta
        )).to.be.revertedWith("Timelock::executeTransaction: Transaction hasn't surpassed time lock.");

        await ethers.provider.send("evm_setNextBlockTimestamp", [eta]);

        await TimelockBuidler.connect(hermezGovernanceEthers).executeTransaction(
            adminAddress,
            0,
            "",
            iface.encodeFunctionData("upgrade", [withdrawalDelayer.address, withdrawalDelayerV2]),
            eta
        );
        await newWithdrawalDelayerV2.setVersion();
        expect(await newWithdrawalDelayerV2.getVersion()).to.be.equal(2);
    });

})

async function getProxyAdminFactory() {
    return ethers.getContractFactory(ProxyAdmin.abi, ProxyAdmin.bytecode, ethers.getSigners[0]);
}
