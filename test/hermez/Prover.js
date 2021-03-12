const { expect } = require("chai");
const { ethers } = require("hardhat");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const poseidonHashJs = require("circomlib").poseidon;
const Scalar = require("ffjavascript").Scalar;
const { smt } = require("circomlib");
const babyJub = require("circomlib").babyJub;
const utilsScalar = require("ffjavascript").utils;
const axios = require("axios");
const { RollupDB } = require("@hermeznetwork/commonjs");
const SMTMemDB = require("circomlib").SMTMemDB;
const { stringifyBigInts, unstringifyBigInts } = require("ffjavascript").utils;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe("Hermez Helpers", function () {
  this.timeout(0);
  before(async function () {
    let ProverContract = await ethers.getContractFactory(
      "Verifier344"
    );
    hardhatProverContract = await ProverContract.deploy();

    await hardhatProverContract.deployed();
  });

  describe("utility helpers", function () {

    it("verify proof server proof", async function () {
      const maxTx = 344;
      const nLevels = 32;
      const maxL1Tx = 256;
      const nFeeTx = 64;
      const chainID = 15;

      const rollupDB = await RollupDB(new SMTMemDB(), chainID);
      const bb = await rollupDB.buildBatch(
        maxTx,
        nLevels,
        maxL1Tx,
        nFeeTx
      );
      await bb.build();


      const inputJson = stringifyBigInts(bb.getInput());
      await axios.post("http://10.48.11.192:9080/input", inputJson);

      let response;
      do {
        response = await axios.get("http://10.48.11.192:9080/status");
        await sleep(1000);
      } while (response.data.status == "busy");

      const proofA = [JSON.parse(response.data.proof).pi_a[0],
        JSON.parse(response.data.proof).pi_a[1]
      ];
      const proofB = [
        [
          JSON.parse(response.data.proof).pi_b[0][1],
          JSON.parse(response.data.proof).pi_b[0][0]
        ],
        [
          JSON.parse(response.data.proof).pi_b[1][1],
          JSON.parse(response.data.proof).pi_b[1][0]
        ]
      ];
      const proofC =  [JSON.parse(response.data.proof).pi_c[0],
        JSON.parse(response.data.proof).pi_c[1]
      ];
      const input = JSON.parse(response.data.pubData);

      expect(
        await hardhatProverContract.verifyProof(
          proofA,
          proofB,
          proofC,
          input,
        )
      ).to.equal(true);

            
      const gas = await hardhatProverContract.estimateGas.verifyProof(
        proofA,
        proofB,
        proofC,
        input,
      );
      console.log({gas: gas.toNumber()});
    });
  });
});
