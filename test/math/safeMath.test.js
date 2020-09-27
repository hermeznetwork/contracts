const {
    ethers
} = require("@nomiclabs/buidler");
const {
    expect
} = require("chai");


let buidlerSafeMathMock;

describe("Safe Math Uint128", function () {
    beforeEach(async function () {
        const SafeMathMock = await ethers.getContractFactory(
            "SafeMathMock"
        );

        // To deploy our contract, we just have to call Token.deploy() and await
        // for it to be deployed(), which happens onces its transaction has been
        // mined.
        buidlerSafeMathMock = await SafeMathMock.deploy();
        await buidlerSafeMathMock.deployed();
    });
    it("should test add", async function () {
        result = await buidlerSafeMathMock.testAdd()
        expect(result).to.be.equal(11);
    });
    it("should test sub", async function () {
        result = await buidlerSafeMathMock.testSub()
        expect(result).to.be.equal(1);
    });
    it("should test mul", async function () {
        result = await buidlerSafeMathMock.testMul()
        expect(result).to.be.equal(30);
    });
    it("should test mul with 0", async function () {
        result = await buidlerSafeMathMock.testMul0()
        expect(result).to.be.equal(0);
    });
    it("should test div", async function () {
        result = await buidlerSafeMathMock.testDiv()
        expect(result).to.be.equal(2);
    });
    it("should test mod", async function () {
        result = await buidlerSafeMathMock.testMod()
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
        buidlerSafeMathMock = await SafeMathMock.deploy();
        await buidlerSafeMathMock.deployed();
    });

    it("should test add", async function () {
        await expect(
            buidlerSafeMathMock.testAddRevert()
        ).to.be.revertedWith("SafeMath: addition overflow");
    });
    it("should test sub", async function () {
        await expect(
            buidlerSafeMathMock.testSubRevert()
        ).to.be.revertedWith("SafeMath: subtraction overflow");
    });
    it("should test mul", async function () {
        await expect(
            buidlerSafeMathMock.testMulRevert()
        ).to.be.revertedWith("SafeMath: multiplication overflow");
    });
    it("should test div", async function () {
        await expect(
            buidlerSafeMathMock.testDivRevert()
        ).to.be.revertedWith("SafeMath: division by zero");
    });
    it("should test mod", async function () {
        await expect(
            buidlerSafeMathMock.testModRevert()
        ).to.be.revertedWith("SafeMath: modulo by zero");
    });
});