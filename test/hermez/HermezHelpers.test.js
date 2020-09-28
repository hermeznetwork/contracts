const {expect} = require("chai");
const {ethers} = require("../../node_modules/@nomiclabs/buidler");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const poseidonHashJs = require("circomlib").poseidon;
const Scalar = require("ffjavascript").Scalar;
const {smt} = require("circomlib");
const babyJub = require("circomlib").babyJub;
const utilsScalar = require("ffjavascript").utils;

const {HermezAccount, stateUtils} = require("@hermeznetwork/commonjs");

const {signBjjAuth} = require("./helpers/helpers");

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
  let buidlerHermezHelpersTest;

  let owner;
  let id1;
  let id2;
  let addrs;

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
      poseidonUnit.abi,
      poseidonUnit.createCode(2),
      owner
    );

    let Poseidon3Elements = new ethers.ContractFactory(
      poseidonUnit.abi,
      poseidonUnit.createCode(3),
      owner
    );

    let Poseidon4Elements = new ethers.ContractFactory(
      poseidonUnit.abi,
      poseidonUnit.createCode(4),
      owner
    );
    const buidlerPoseidon2Elements = await Poseidon2Elements.deploy();
    const buidlerPoseidon3Elements = await Poseidon3Elements.deploy();
    const buidlerPoseidon4Elements = await Poseidon4Elements.deploy();

    const poseidonAddr2 = buidlerPoseidon2Elements.address;
    const poseidonAddr3 = buidlerPoseidon3Elements.address;
    const poseidonAddr4 = buidlerPoseidon4Elements.address;

    buidlerHermezHelpersTest = await HermezHelpersTest.deploy(
      poseidonAddr2,
      poseidonAddr3,
      poseidonAddr4
    );

    await buidlerHermezHelpersTest.deployed();

    fillSmtTree();
  });

  describe("utility helpers", function () {
    it("checkSig", async function () {
      const babyjub = accounts[0].bjjCompressed;
      const flatSig = await signBjjAuth(owner, babyjub);
      let sig = ethers.utils.splitSignature(flatSig);

      expect(
        await buidlerHermezHelpersTest.checkSigTest(
          `0x${babyjub}`,
          sig.r,
          sig.s,
          sig.v
        )
      ).to.equal(await owner.getAddress());
    });

    it("hash poseidon 2 elements", async () => {
      const resJs = poseidonHashJs([1, 2]);

      const resSm = await buidlerHermezHelpersTest.testHash2Elements([1, 2]);
      expect(resJs.toString()).to.be.equal(resSm.toString());
    });

    it("hash poseidon 3 elements", async () => {
      const resJs = poseidonHashJs([1, 2, 3]);

      const resSm = await buidlerHermezHelpersTest.testHash3Elements([1, 2, 3]);
      expect(resJs.toString()).to.be.equal(resSm.toString());
    });

    it("hash poseidon 4 elements", async () => {
      const resJs = poseidonHashJs([1, 2, 3, 4]);

      const resSm = await buidlerHermezHelpersTest.testHash4Elements([
        1,
        2,
        3,
        4,
      ]);
      expect(resJs.toString()).to.be.equal(resSm.toString());
    });

    it("hash node", async () => {
      const resJs = poseidonHashJs([1, 2]);

      const resSm = await buidlerHermezHelpersTest.testHashNode(1, 2);
      expect(resJs.toString()).to.be.equal(resSm.toString());
    });

    it("hash final node", async () => {
      const resJs = poseidonHashJs([1, 2, 1]);

      const resSm = await buidlerHermezHelpersTest.testHashFinalNode(1, 2);
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
      const resSm1 = await buidlerHermezHelpersTest.smtVerifierTest(
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
      const resSm2 = await buidlerHermezHelpersTest.smtVerifierTest(
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
      const resSm3 = await buidlerHermezHelpersTest.smtVerifierTest(
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

      const resSC = await buidlerHermezHelpersTest.buildTreeStateTest(
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

      const resHashSC = await buidlerHermezHelpersTest.hashTreeStateTest(
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
        [0x307b, "123000000"],
        [0x1dc6, "454500"],
        [0xffff, "10235000000000000000000000000000000"],
        [0x0000, "0"],
        [0x0400, "0"],
        [0x0001, "1"],
        [0x0401, "1"],
        [0x0800, "0"],
        [0x0c00, "5"],
        [0x0801, "10"],
        [0x0c01, "15"],
      ];

      for (let i = 0; i < testVector.length; i++) {
        const resSm = await buidlerHermezHelpersTest.float2FixTest(
          testVector[i][0]
        );
        expect(Scalar.e(resSm).toString()).to.be.equal(testVector[i][1]);
      }
    });
  });
});
