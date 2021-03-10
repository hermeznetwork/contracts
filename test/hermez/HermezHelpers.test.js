const { expect } = require("chai");
const { ethers } = require("hardhat");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
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
      "HermezHelpersTest"
    );

    let Poseidon2Elements = new ethers.ContractFactory(
      poseidonUnit.generateABI(2),
      poseidonUnit.createCode(2),
      owner
    );

    let Poseidon3Elements = new ethers.ContractFactory(
      poseidonUnit.generateABI(3),
      poseidonUnit.createCode(3),
      owner
    );

    let Poseidon4Elements = new ethers.ContractFactory(
      poseidonUnit.generateABI(4),
      poseidonUnit.createCode(4),
      owner
    );
    const hardhatPoseidon2Elements = await Poseidon2Elements.deploy();
    const hardhatPoseidon3Elements = await Poseidon3Elements.deploy();
    const hardhatPoseidon4Elements = await Poseidon4Elements.deploy();

    const poseidonAddr2 = hardhatPoseidon2Elements.address;
    const poseidonAddr3 = hardhatPoseidon3Elements.address;
    const poseidonAddr4 = hardhatPoseidon4Elements.address;

    hardhatHermezHelpersTest = await HermezHelpersTest.deploy(
      poseidonAddr2,
      poseidonAddr3,
      poseidonAddr4
    );

    await hardhatHermezHelpersTest.deployed();

    fillSmtTree();

    const chainSC = await hardhatHermezHelpersTest.getChainID();
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

    it("hash poseidon 2 elements", async () => {
      const resJs = poseidonHashJs([1, 2]);

      const resSm = await hardhatHermezHelpersTest.testHash2Elements([1, 2]);
      expect(resJs.toString()).to.be.equal(resSm.toString());
    });

    it("hash poseidon 3 elements", async () => {
      const resJs = poseidonHashJs([1, 2, 3]);

      const resSm = await hardhatHermezHelpersTest.testHash3Elements([1, 2, 3]);
      expect(resJs.toString()).to.be.equal(resSm.toString());
    });

    it("hash poseidon 4 elements", async () => {
      const resJs = poseidonHashJs([1, 2, 3, 4]);

      const resSm = await hardhatHermezHelpersTest.testHash4Elements([
        1,
        2,
        3,
        4,
      ]);
      expect(resJs.toString()).to.be.equal(resSm.toString());
    });

    it("hash node", async () => {
      const resJs = poseidonHashJs([1, 2]);

      const resSm = await hardhatHermezHelpersTest.testHashNode(1, 2);
      expect(resJs.toString()).to.be.equal(resSm.toString());
    });

    it("hash final node", async () => {
      const resJs = poseidonHashJs([1, 2, 1]);

      const resSm = await hardhatHermezHelpersTest.testHashFinalNode(1, 2);
      expect(resJs.toString()).to.be.equal(resSm.toString());
    });

    it("smt verifier: existence", async () => {
      let resProof;
      let siblings;

      const root = tree.root.toString();

      // Verify key1, value1
      resProof = await tree.find(key1);
      siblings = [];
      for (let i = 0; i < resProof.siblings.length; i++) {
        siblings.push(resProof.siblings[i].toString());
      }
      const resSm1 = await hardhatHermezHelpersTest.smtVerifierTest(
        root,
        siblings,
        key1.toString(),
        value1.toString()
      );
      expect(resSm1).to.be.equal(true);

      // Verify key2, value2
      resProof = await tree.find(key2);
      siblings = [];
      for (let i = 0; i < resProof.siblings.length; i++) {
        siblings.push(resProof.siblings[i].toString());
      }
      const resSm2 = await hardhatHermezHelpersTest.smtVerifierTest(
        root,
        siblings,
        key2.toString(),
        value2.toString()
      );
      expect(resSm2).to.be.equal(true);

      // Verify key3, value3
      resProof = await tree.find(key3);
      siblings = [];
      for (let i = 0; i < resProof.siblings.length; i++) {
        siblings.push(resProof.siblings[i].toString());
      }
      const resSm3 = await hardhatHermezHelpersTest.smtVerifierTest(
        root,
        siblings,
        key3.toString(),
        value3.toString()
      );
      expect(resSm3).to.be.equal(true);
    });
   
    it("Hash state rollup tree", async () => {
      const balance = 2;
      const tokenID = 3;
      const nonce = 4;
      const ethAddr = "0xe0fbce58cfaa72812103f003adce3f284fe5fc7c";

      const babyjubCompressed = `0x${accounts[0].bjjCompressed}`;
      const bjjCompresedBuf = utilsScalar.leInt2Buff(
        Scalar.fromString(accounts[0].bjjCompressed, 16),
        32
      );
      const pointBjj = babyJub.unpackPoint(bjjCompresedBuf);

      const ay = pointBjj[1].toString(16);
      const sign = bjjCompresedBuf[31] & 0x80 ? 1 : 0;

      const resSC = await hardhatHermezHelpersTest.buildTreeStateTest(
        tokenID,
        nonce,
        balance,
        babyjubCompressed,
        ethAddr
      );

      const resJs = stateUtils.state2Array({
        tokenID,
        nonce,
        sign,
        balance,
        ay,
        ethAddr,
      });

      expect(resSC[0]).to.be.equal(resJs[0]);
      expect(resSC[1]).to.be.equal(resJs[1]);
      expect(resSC[2]).to.be.equal(resJs[2]);
      expect(resSC[3]).to.be.equal(resJs[3]);

      const resHashSC = await hardhatHermezHelpersTest.hashTreeStateTest(
        tokenID,
        nonce,
        balance,
        babyjubCompressed,
        ethAddr
      );

      const resHashJs = stateUtils.hashState({
        tokenID,
        nonce,
        sign,
        balance,
        ay,
        ethAddr,
      });
      expect(resHashSC).to.be.equal(resHashJs);
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
