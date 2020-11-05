const { ethers, upgrades } = require("@nomiclabs/buidler");
const {
  expect
} = require("chai");


const ProxyAdmin = require("@openzeppelin/upgrades-core/artifacts/ProxyAdmin.json");
const { getAdminAddress } = require("@openzeppelin/upgrades-core");

const TIMEOUT = 400000;

describe("upgradability test", function() {
  this.timeout(TIMEOUT);
  let deployer,
    hermezGovernanceEthers, initAddressEthers;

  let hermezGovernanceAddress, initAddress;

  let hermezAuctionProtocol;

  beforeEach(async function() {
    [
      deployer,
      hermezGovernanceEthers,
      initAddressEthers
    ] = await ethers.getSigners();
    hermezGovernanceAddress = await hermezGovernanceEthers.getAddress();
    initAddress = await initAddressEthers.getAddress();

    const HermezAuctionProtocol = await ethers.getContractFactory(
      "HermezAuctionProtocol"
    );

    // Deploy smart contacts:
    hermezAuctionProtocol = await upgrades.deployProxy(
      HermezAuctionProtocol,
      [],
      {
        unsafeAllowCustomTypes: true,
        initializer: undefined,
      }
    );
    await hermezAuctionProtocol.deployed();
    let latest = await ethers.provider.getBlockNumber();
    await hermezAuctionProtocol.hermezAuctionProtocolInitializer(
      initAddress,
      latest + 100,
      initAddress,
      initAddress,
      initAddress,
      initAddress
    );
  });
  it("should be able to upgrade HermezAuctionProtocol", async () => {

    const HermezAuctionProtocolV2 = await ethers.getContractFactory("HermezAuctionProtocolV2");
    const newHermezAuctionProtocolV2 = HermezAuctionProtocolV2.attach(hermezAuctionProtocol.address);

    await expect(newHermezAuctionProtocolV2.getVersion()).to.be.reverted;

    await upgrades.upgradeProxy(hermezAuctionProtocol.address, HermezAuctionProtocolV2, {
      unsafeAllowCustomTypes: true
    });
    let latest = await ethers.provider.getBlockNumber();
    await expect(newHermezAuctionProtocolV2.hermezAuctionProtocolInitializer(
      initAddress,
      latest + 100,
      initAddress,
      initAddress,
      initAddress,
      initAddress
    )).to.be.revertedWith("Contract instance has already been initialized");

    await newHermezAuctionProtocolV2.setVersion();
    expect(await newHermezAuctionProtocolV2.getVersion()).to.be.equal(2);

  });
  it("should be able to upgrade HermezAuctionProtocol with prepareUpgrade", async () => {
    const HermezAuctionProtocolV2 = await ethers.getContractFactory("HermezAuctionProtocolV2");

    const hermezAuctionProtocolV2 = await upgrades.prepareUpgrade(hermezAuctionProtocol.address, HermezAuctionProtocolV2, {
      unsafeAllowCustomTypes: true
    });

    const AdminFactory = await getProxyAdminFactory();
    const admin = AdminFactory.attach(await getAdminAddress(ethers.provider, hermezAuctionProtocol.address));
    const proxyAdminAddress = await getAdminAddress(ethers.provider, hermezAuctionProtocol.address);

    await admin.upgrade(hermezAuctionProtocol.address, hermezAuctionProtocolV2);
    const newHermezAuctionProtocolV2 = HermezAuctionProtocolV2.attach(hermezAuctionProtocol.address);
    await newHermezAuctionProtocolV2.setVersion();
    expect(await newHermezAuctionProtocolV2.getVersion()).to.be.equal(2);
  });

  it("should be able to upgrade HermezAuctionProtocol with prepareUpgrade after transferProxyAdminOwnership", async () => {
    const HermezAuctionProtocolV2 = await ethers.getContractFactory("HermezAuctionProtocolV2");

    const hermezAuctionProtocolV2 = await upgrades.prepareUpgrade(hermezAuctionProtocol.address, HermezAuctionProtocolV2, {
      unsafeAllowCustomTypes: true
    });


    await upgrades.admin.transferProxyAdminOwnership(hermezGovernanceAddress);

    const AdminFactory = await getProxyAdminFactory();
    const admin = AdminFactory.attach(await getAdminAddress(ethers.provider, hermezAuctionProtocol.address));
    const proxyAdminAddress = await getAdminAddress(ethers.provider, hermezAuctionProtocol.address);

    await admin.connect(hermezGovernanceEthers).upgrade(hermezAuctionProtocol.address, hermezAuctionProtocolV2);
    const newHermezAuctionProtocolV2 = HermezAuctionProtocolV2.attach(hermezAuctionProtocol.address);
    await newHermezAuctionProtocolV2.setVersion();
    expect(await newHermezAuctionProtocolV2.getVersion()).to.be.equal(2);
  });


  it("should be able to upgrade using Timelock HermezAuctionProtocol with prepareUpgrade", async () => {
    const HermezAuctionProtocolV2 = await ethers.getContractFactory("HermezAuctionProtocolV2");
    const Timelock = await ethers.getContractFactory("Timelock");

    const newHermezAuctionProtocolV2 = HermezAuctionProtocolV2.attach(hermezAuctionProtocol.address);
    await expect(newHermezAuctionProtocolV2.getVersion()).to.be.reverted;

    const AdminFactory = await getProxyAdminFactory();
    let adminAddress = await getAdminAddress(ethers.provider, hermezAuctionProtocol.address);
    const admin = AdminFactory.attach(adminAddress);


    // Deploy Timelock
    const TimelockBuidler = await Timelock.deploy(hermezGovernanceAddress, 604800);
    await TimelockBuidler.deployed();
    await admin.connect(hermezGovernanceEthers).transferOwnership(TimelockBuidler.address);

    const hermezAuctionProtocolV2 = await upgrades.prepareUpgrade(hermezAuctionProtocol.address, HermezAuctionProtocolV2, {
      unsafeAllowCustomTypes: true
    });

    const proxyAdminAddress = await getAdminAddress(ethers.provider, hermezAuctionProtocol.address);

    let iface = new ethers.utils.Interface(ProxyAdmin.abi);
    let latest = await ethers.provider.getBlockNumber();
    let blockTimestamp = (await ethers.provider.getBlock(latest)).timestamp;
    let eta = blockTimestamp + 605800;
    await TimelockBuidler.connect(hermezGovernanceEthers).queueTransaction(
      adminAddress,
      0,
      "",
      iface.encodeFunctionData("upgrade", [hermezAuctionProtocol.address, hermezAuctionProtocolV2]),
      eta
    );

    await expect(TimelockBuidler.connect(hermezGovernanceEthers).executeTransaction(
      adminAddress,
      0,
      "",
      iface.encodeFunctionData("upgrade", [hermezAuctionProtocol.address, hermezAuctionProtocolV2]),
      eta
    )).to.be.revertedWith("Timelock::executeTransaction: Transaction hasn't surpassed time lock.");

    await ethers.provider.send("evm_setNextBlockTimestamp", [eta]);

    await TimelockBuidler.connect(hermezGovernanceEthers).executeTransaction(
      adminAddress,
      0,
      "",
      iface.encodeFunctionData("upgrade", [hermezAuctionProtocol.address, hermezAuctionProtocolV2]),
      eta
    );
    await newHermezAuctionProtocolV2.setVersion();
    expect(await newHermezAuctionProtocolV2.getVersion()).to.be.equal(2);
  });


});

async function getProxyAdminFactory() {
  return ethers.getContractFactory(ProxyAdmin.abi, ProxyAdmin.bytecode);
}
