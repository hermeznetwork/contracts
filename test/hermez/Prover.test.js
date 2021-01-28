const { expect } = require("chai");
const { ethers } = require("@nomiclabs/buidler");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const poseidonHashJs = require("circomlib").poseidon;
const Scalar = require("ffjavascript").Scalar;
const { smt } = require("circomlib");
const babyJub = require("circomlib").babyJub;
const utilsScalar = require("ffjavascript").utils;

const { HermezAccount, stateUtils, txUtils } = require("@hermeznetwork/commonjs");

describe("Hermez Helpers", function () {
  this.timeout(0);
  before(async function () {
    let ProverContract = await ethers.getContractFactory(
      "Verifier"
    );
    buidlerProverContract = await ProverContract.deploy();

    await buidlerProverContract.deployed();
  });

  describe("utility helpers", function () {
    it("verify proof", async function () {
      const proofA = ["12823142741947462018376637068611061184530582773186663424558261242088932958650",
        "15510239331731659263324114188636716065802904878544094401484954593592807049671"
      ];
      const proofB = [
        [
          "4371287187348687214940133605217733703004883222445181026251086972719957113140",
          "638637090244761631320234407798004725080627654045822348011813051565608453553"
        ],
        [
          "18997382790062900837772601169152115987807912448818596344809193940214862573620",
          "8789312473863924963986961093085972083579326466071861905150970567781475516666"
        ]
      ];
      const proofC =  ["15066023575175611296256118607366459860389282373417919892396785242139851111235",
        "20614173163416102479367448539231727763415631163149570165039228652167811930586"
      ];
      const input = ["13125286639093380931878518383173032474507961807467565131003538765912150608017"];

      expect(
        await buidlerProverContract.verifyProof(
          proofA,
          proofB,
          proofC,
          input,
        )
      ).to.equal(true);
    });
  });
});
