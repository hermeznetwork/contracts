const { expect } = require("chai");
const { ethers } = require("@nomiclabs/buidler");
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
  let buidlerHermezHelpersTest;

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

    const chainSC = await buidlerHermezHelpersTest.getChainID();
    chainIDHex = chainSC.toHexString();
  });

  describe("utility helpers", function () {
    it("checkSig", async function () {
      const babyjub = accounts[0].bjjCompressed;
      const flatSig = await txUtils.signBjjAuth(owner, babyjub, chainIDHex, buidlerHermezHelpersTest.address);
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
    it("smt verifier: go proofs", async () => {

      const jsonProof = [
        {
          "root": "10171140035965439966839815283432442651152991056297946102647688349369299124493",
          "siblings": ["12422661758472400223401299094238820777063458096110016599986781158438915645129", "4330149052063565277182642012557086942088176847773467265587998154672740895682"],
          "key": "2",
          "value": "22"
        },
        {
          "root": "2428789715877414151724534926821663275227044986032971416145344707422178448671",
          "siblings": [
            "19445847529391717366082947015849918711252725332278875015870515996576571515818",
            "21173801481877043060659946885234886265190240121217432069546244428134401921175",
            "8164903903444844775738769613271776938083779700786419257342366407228782006785",
            "6735705425257736187043152582614842584768738673687112491857851420026693035944",
            "0",
            "4166263232532181325251654177034881923609634822447911868134368471528084848271"
          ],
          "key": "102",
          "value": "204"
        },
        {
          "root": "7522364176929915289570451038341795364473978790326009513223070812666939274419",
          "siblings": ["19625419196989711177392855749706011859677525707826108058432009176878623415281", "469109490504816271128471504075614597355669132318342374046897732130228771291", "18399594176067734048219581877759366707771572279710945570022814137963927366002", "11127098156458109833792840028466960187036783015824415430532814383898043905311"],
          "key": "2",
          "value": "4"
        }
      ];

      for (let i = 0; i < jsonProof.length; i++) {
        const resSm1 = await buidlerHermezHelpersTest.smtVerifierTest(
          jsonProof[i].root,
          jsonProof[i].siblings,
          jsonProof[i].key,
          jsonProof[i].value
        );
        expect(resSm1).to.be.equal(true);
      }
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
