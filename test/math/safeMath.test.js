const {
  ethers
} = require("hardhat");
const {
  expect
} = require("chai");


let hardhatSafeMathMock;

describe("Safe Math Uint128", function () {
  beforeEach(async function () {
    const SafeMathMock = await ethers.getContractFactory(
      "SafeMathMock"
    );

    // To deploy our contract, we just have to call Token.deploy() and await
    // for it to be deployed(), which happens onces its transaction has been
    // mined.
    hardhatSafeMathMock = await SafeMathMock.deploy();
    await hardhatSafeMathMock.deployed();
  });
  it("should test add", async function () {
    result = await hardhatSafeMathMock.testAdd();
    expect(result).to.be.equal(11);
  });
  it("should test sub", async function () {
    result = await hardhatSafeMathMock.testSub();
    expect(result).to.be.equal(1);
  });
  it("should test mul", async function () {
    result = await hardhatSafeMathMock.testMul();
    expect(result).to.be.equal(30);
  });
  it("should test mul with 0", async function () {
    result = await hardhatSafeMathMock.testMul0();
    expect(result).to.be.equal(0);
  });
  it("should test div", async function () {
    result = await hardhatSafeMathMock.testDiv();
    expect(result).to.be.equal(2);
  });
  it("should test mod", async function () {
    result = await hardhatSafeMathMock.testMod();
    expect(result).to.be.equal(0);
  });
});

describe("Safe Math Uint128 reverts", function () {
  beforeEach(async function () {
    const SafeMathMock = await ethers.getContractFactory(
      "SafeMathMock"
    );

    // To deploy our contract, we just have to call Token.deploy() and await
    // for it to be deployed(), which happens onces its transaction has been
    // mined.
    hardhatSafeMathMock = await SafeMathMock.deploy();
    await hardhatSafeMathMock.deployed();
  });

  it("should test add", async function () {
    await expect(
      hardhatSafeMathMock.testAddRevert()
    ).to.be.revertedWith("SafeMath: addition overflow");
  });
  it("should test sub", async function () {
    await expect(
      hardhatSafeMathMock.testSubRevert()
    ).to.be.revertedWith("SafeMath: subtraction overflow");
  });
  it("should test mul", async function () {
    await expect(
      hardhatSafeMathMock.testMulRevert()
    ).to.be.revertedWith("SafeMath: multiplication overflow");
  });
  it("should test div", async function () {
    await expect(
      hardhatSafeMathMock.testDivRevert()
    ).to.be.revertedWith("SafeMath: division by zero");
  });
  it("should test mod", async function () {
    await expect(
      hardhatSafeMathMock.testModRevert()
    ).to.be.revertedWith("SafeMath: modulo by zero");
  });
});