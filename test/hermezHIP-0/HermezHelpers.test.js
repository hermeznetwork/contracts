const { expect } = require("chai");
const { ethers } = require("hardhat");
const poseidonHashJs = require("circomlib").poseidon;
const Scalar = require("ffjavascript").Scalar;
const { smt } = require("circomlib");
const babyJub = require("circomlib").babyJub;
const utilsScalar = require("ffjavascript").utils;

const { HermezAccount, stateUtils, txUtils } = require("@hermeznetwork/commonjs");

let tree;
const key1 = Scalar.e(7);
const value1 = Scalar.e(77);
const key2 = Scalar.e(8);
const value2 = Scalar.e(88);
const key3 = Scalar.e(32);
const value3 = Scalar.e(3232);

async function fillSmtTree() {
  tree = await smt.newMemEmptyTrie();

  await tree.insert(key1, value1);
  await tree.insert(key2, value2);
  await tree.insert(key3, value3);
}

describe("Hermez Helpers", function () {
  let hardhatHermezHelpersTest;

  let owner;
  let id1;
  let id2;
  let addrs;
  let chainIDHex;

  const accounts = [];
  for (let i = 0; i < 10; i++) {
    accounts.push(new HermezAccount());
  }

  before(async function () {
    [owner, id1, id2, ...addrs] = await ethers.getSigners();

    let HermezHelpersTest = await ethers.getContractFactory(
      "HermezHelpersTestV2"
    );

    hardhatHermezHelpersTest = await HermezHelpersTest.deploy();

    await hardhatHermezHelpersTest.deployed();

    const chainSC = await hardhatHermezHelpersTest.getChainId();
    chainIDHex = chainSC.toHexString();
  });

  describe("utility helpers", function () {
    it("checkSig", async function () {
      const babyjub = accounts[0].bjjCompressed;
      const flatSig = await txUtils.signBjjAuth(owner, babyjub, chainIDHex, hardhatHermezHelpersTest.address);
      let sig = ethers.utils.splitSignature(flatSig);

      expect(
        await hardhatHermezHelpersTest.checkSigTest(
          `0x${babyjub}`,
          sig.r,
          sig.s,
          sig.v
        )
      ).to.equal(await owner.getAddress());
    });

    it("float to fix", async () => {
      const testVector = [
        [6 * 0x800000000 + 123, "123000000"],
        [2 * 0x800000000 + 4545, "454500"],
        [30 * 0x800000000 + 10235, "10235000000000000000000000000000000"],
        [0, "0"],
        [0x800000000, "0"],
        [0x0001, "1"],
        [31 * 0x800000000, "0"],
        [0x800000000 + 1, "10"],
        [0xFFFFFFFFFF, "343597383670000000000000000000000000000000"],
      ];

      for (let i = 0; i < testVector.length; i++) {
        const resSm = await hardhatHermezHelpersTest.float2FixTest(
          testVector[i][0]
        );
        expect(Scalar.e(resSm).toString()).to.be.equal(testVector[i][1]);
      }
    });
  });
});
