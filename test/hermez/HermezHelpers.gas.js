const { expect } = require("chai");
const { ethers } = require("hardhat");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const poseidonHashJs = require("circomlib").poseidon;
const Scalar = require("ffjavascript").Scalar;
const { smt } = require("circomlib");
const babyJub = require("circomlib").babyJub;
const utilsScalar = require("ffjavascript").utils;
const poseidonHash = require("circomlib").poseidon;

const { HermezAccount, stateUtils, txUtils } = require("@hermeznetwork/commonjs");


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
    const chainSC = await hardhatHermezHelpersTest.getChainID();
    chainIDHex = chainSC.toHexString();
  });

  describe("utility helpers", function () {
    it("Test gas poseidon", async () => {
      const resSm2 = await hardhatHermezHelpersTest.testHash2ElementsGas([1, 2]);
      console.log(`poseidon 2 elements ${resSm2}`);
      const resSm3 = await hardhatHermezHelpersTest.testHash3ElementsGas([1, 2, 3]);
      console.log(`poseidon 3 elements ${resSm3}`);
      const resSm4 = await hardhatHermezHelpersTest.testHash4ElementsGas([1, 2, 3, 4]);
      console.log(`poseidon 4 elements ${resSm4}`);
    });

    it("smt verifier: existence", async () => {
      let resProof;
      let siblings;


      let tree = await smt.newMemEmptyTrie();
      const arrayKeys = [];
      const arrayValues = [];

      for (let i = 1; i < 32; i++) {
        const key = 255 + i;//getRandomInt(255, 100000);
        const value = poseidonHash([Scalar.e(key)]);
        arrayKeys.push(key);
        arrayValues.push(value);
        await tree.insert(key, value);
        const root = tree.root.toString();
        const resProof = await tree.find(key);
        let siblings = [];
        for (let i = 0; i < resProof.siblings.length; i++) {
          siblings.push(resProof.siblings[i].toString());
        }

        const resSm1 = await hardhatHermezHelpersTest.smtVerifierTestGas(
          root,
          siblings,
          key.toString(),
          value.toString()
        );
        console.log(`smt verifier for ${i} elements, key: ${key}, gas: ${resSm1}`);
      }
    
    });
  });
});


function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}