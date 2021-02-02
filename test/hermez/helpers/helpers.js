const { expect } = require("chai");
const { ethers } = require("../../../node_modules/@nomiclabs/buidler");
const Scalar = require("ffjavascript").Scalar;
const axios = require("axios");

const { float16, txUtils, utils } = require("@hermeznetwork/commonjs");
const { BigNumber } = require("ethers");
const nLevels = 32;
const {
  createPermitDigest
} = require("./erc2612");
const { stringifyBigInts, unstringifyBigInts } = require("ffjavascript").utils;

const L1_USER_BYTES = 72; // 20 ehtaddr, 32 babyjub, 4 token, 2 amountF, 2 loadAmountf, 6 fromIDx, 6 toidx

const babyjub0 = 0;
const fromIdx0 = 0;
const loadAmountF0 = 0;
const amountF0 = 0;
const tokenID0 = 0;
const toIdx0 = 0;
const emptyPermit = "0x";
let ABIbid = [
  "function permit(address,address,uint256,uint256,uint8,bytes32,bytes32)",
];

let iface = new ethers.utils.Interface(ABIbid);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class ForgerTest {
  constructor(maxTx, maxL1Tx, nLevels, buidlerHermez, rollupDB, realVerifier) {
    this.rollupDB = rollupDB;
    this.maxTx = maxTx;
    this.maxL1Tx = maxL1Tx;
    this.nLevels = nLevels;
    this.buidlerHermez = buidlerHermez;
    this.realVerifier = realVerifier;

    this.L1TxB = 544;
  }

  async forgeBatch(l1Batch, l1TxUserArray, l1TxCoordiatorArray, l2txArray) {
    const bb = await this.rollupDB.buildBatch(
      this.maxTx,
      this.nLevels,
      this.maxL1Tx
    );

    let jsL1TxData = "";
    for (let tx of l1TxUserArray) {
      bb.addTx(txUtils.decodeL1TxFull(tx));
      jsL1TxData = jsL1TxData + tx.slice(2);
    }

    // check L1 user tx are the same in batchbuilder and contract
    const currentQueue = await this.buidlerHermez.nextL1ToForgeQueue();
    const SCL1TxData = await this.buidlerHermez.mapL1TxQueue(currentQueue);

    expect(SCL1TxData).to.equal(`0x${jsL1TxData}`);


    if (l1TxCoordiatorArray) {
      for (let tx of l1TxCoordiatorArray) {
        bb.addTx(txUtils.decodeL1TxFull(tx.l1TxBytes));
      }
    }


    if (l2txArray) {
      for (let tx of l2txArray) {
        bb.addTx(tx);
      }
    }

    await bb.build();

    let stringL1CoordinatorTx = "";
    for (let tx of l1TxCoordiatorArray) {
      stringL1CoordinatorTx =
        stringL1CoordinatorTx + tx.l1TxCoordinatorbytes.slice(2); // retireve the 0x
    }


    let proofA, proofB, proofC;

    if (this.realVerifier == true) {
      // real verifier
      const inputJson = stringifyBigInts(bb.getInput());
      await axios.post("http://ec2-3-139-54-168.us-east-2.compute.amazonaws.com:3000/api/input", inputJson);
      let response;
      do {
        await sleep(1000);
        response = await axios.get("http://ec2-3-139-54-168.us-east-2.compute.amazonaws.com:3000/api/status");
      } while (response.data.status == "busy");

      proofA = [JSON.parse(response.data.proof).pi_a[0],
        JSON.parse(response.data.proof).pi_a[1]
      ];
      proofB = [
        [
          JSON.parse(response.data.proof).pi_b[0][1],
          JSON.parse(response.data.proof).pi_b[0][0]
        ],
        [
          JSON.parse(response.data.proof).pi_b[1][1],
          JSON.parse(response.data.proof).pi_b[1][0]
        ]
      ];
      proofC =  [JSON.parse(response.data.proof).pi_c[0],
        JSON.parse(response.data.proof).pi_c[1]
      ];    

      const input = JSON.parse(response.data.pubData);
      expect(input[0]).to.equal(bb.getHashInputs().toString());

    } else {
      // mock verifier
      proofA = ["0", "0"];
      proofB = [
        ["0", "0"],
        ["0", "0"],
      ];
      proofC = ["0", "0"];
    }

    const newLastIdx = bb.getNewLastIdx();
    const newStateRoot = bb.getNewStateRoot();
    const newExitRoot = bb.getNewExitRoot();
    const compressedL1CoordinatorTx = `0x${stringL1CoordinatorTx}`;
    const L1L2TxsData = bb.getL1L2TxsDataSM();
    const feeIdxCoordinator = bb.getFeeTxsDataSM();
    const verifierIdx = 0;

    await expect(
      this.buidlerHermez.calculateInputTest(
        newLastIdx,
        newStateRoot,
        newExitRoot,
        compressedL1CoordinatorTx,
        L1L2TxsData,
        feeIdxCoordinator,
        l1Batch,
        verifierIdx
      )
    )
      .to.emit(this.buidlerHermez, "ReturnUint256")
      .withArgs(bb.getHashInputs());

    await expect(
      this.buidlerHermez.forgeBatch(
        newLastIdx,
        newStateRoot,
        newExitRoot,
        compressedL1CoordinatorTx,
        L1L2TxsData,
        feeIdxCoordinator,
        verifierIdx,
        l1Batch,
        proofA,
        proofB,
        proofC
      )
    ).to.emit(this.buidlerHermez, "ForgeBatch")
      .withArgs(bb.batchNumber, l1TxUserArray.length);

    await this.rollupDB.consolidate(bb);
  }
}

async function l1UserTxCreateAccountDeposit(
  loadAmount,
  tokenID,
  babyjub,
  wallet,
  buidlerHermez,
  buidlerTokenHermez,
  isERC20Permit
) {
  const loadAmountF = float16.fix2Float(loadAmount);

  // equivalent L1 transaction:
  const l1TxcreateAccountDeposit = {
    toIdx: 0,
    tokenID: tokenID,
    amountF: 0,
    loadAmountF: loadAmountF,
    fromIdx: 0,
    fromBjjCompressed: babyjub,
    fromEthAddr: await wallet.getAddress(),
  };
  const l1Txbytes = `0x${txUtils.encodeL1TxFull(l1TxcreateAccountDeposit)}`;

  const lastQueue = await buidlerHermez.nextL1FillingQueue();

  const lastQueueBytes = await buidlerHermez.mapL1TxQueue(lastQueue);

  const currentIndex = (lastQueueBytes.length - 2) / 2 / L1_USER_BYTES; // -2 --> 0x, /2 --> 2 hex digits = 1 byte

  if (tokenID != 0) {
    if (!isERC20Permit) {
      // tokens ERC20
      const initialOwnerBalance = await buidlerTokenHermez.balanceOf(
        await wallet.getAddress()
      );
      await expect(
        buidlerTokenHermez.connect(wallet).approve(buidlerHermez.address, loadAmount)
      ).to.emit(buidlerTokenHermez, "Approval");

      // const gasCost = await buidlerHermez.estimateGas[
      //   "addL1Transaction(uint256,uint48,uint16,uint16,uint32,uint48)"
      // ](babyjub, fromIdx0, loadAmountF, amountF0, tokenID, toIdx0);
      // console.log(gasCost.toNumber());

      await expect(
        buidlerHermez.connect(wallet).addL1Transaction(
          babyjub,
          fromIdx0,
          loadAmountF,
          amountF0,
          tokenID,
          toIdx0,
          emptyPermit
        )
      )
        .to.emit(buidlerHermez, "L1UserTxEvent")
        .withArgs(lastQueue, currentIndex, l1Txbytes);

      const finalOwnerBalance = await buidlerTokenHermez.balanceOf(
        await wallet.getAddress()
      );

      expect(finalOwnerBalance).to.equal(
        BigNumber.from(initialOwnerBalance).sub(Scalar.toNumber(loadAmount))
      );
    } else {
      // tokens ERC20Permit
      const initialOwnerBalance = await buidlerTokenHermez.balanceOf(
        await wallet.getAddress()
      );

      const deadline = ethers.constants.MaxUint256;
      const value = loadAmount;
      const nonce = await buidlerTokenHermez.nonces(await wallet.getAddress());
      const { v, r, s } = await createPermitSignature(
        buidlerTokenHermez,
        wallet,
        buidlerHermez.address,
        value,
        nonce,
        deadline
      );

      const data = iface.encodeFunctionData("permit", [
        await wallet.getAddress(),
        buidlerHermez.address,
        value,
        deadline,
        v,
        r,
        s
      ]);

      // send l1tx wth permit signature
      await expect(
        buidlerHermez.connect(wallet).addL1Transaction(
          babyjub,
          fromIdx0,
          loadAmountF,
          amountF0,
          tokenID,
          toIdx0,
          data
        )
      )
        .to.emit(buidlerHermez, "L1UserTxEvent")
        .withArgs(lastQueue, currentIndex, l1Txbytes);

      const finalOwnerBalance = await buidlerTokenHermez.balanceOf(
        await wallet.getAddress()
      );

      expect(finalOwnerBalance).to.equal(
        BigNumber.from(initialOwnerBalance).sub(Scalar.toNumber(loadAmount))
      );
    }
  } else {
    // ether
    const initialOwnerBalance = await wallet.getBalance();
    await expect(
      buidlerHermez.connect(wallet).addL1Transaction(
        babyjub,
        fromIdx0,
        loadAmountF,
        amountF0,
        tokenID,
        toIdx0,
        emptyPermit,
        {
          value: loadAmount,
          gasPrice: 0,
        }
      )
    )
      .to.emit(buidlerHermez, "L1UserTxEvent")
      .withArgs(lastQueue, currentIndex, l1Txbytes);

    const finalOwnerBalance = await wallet.getBalance();

    expect(finalOwnerBalance).to.equal(
      BigNumber.from(initialOwnerBalance).sub(Scalar.toNumber(loadAmount))
    );
  }

  return l1Txbytes;
}

async function l1UserTxDeposit(
  loadAmount,
  tokenID,
  fromIdx,
  wallet,
  buidlerHermez,
  buidlerTokenHermez,
  isERC20Permit
) {
  const loadAmountF = float16.fix2Float(loadAmount);

  // equivalent L1 transaction:
  const l1TxDeposit = {
    toIdx: 0,
    tokenID: tokenID,
    amountF: 0,
    loadAmountF: loadAmountF,
    fromIdx: fromIdx,
    fromBjjCompressed: "0",
    fromEthAddr: await wallet.getAddress(),
  };

  const l1Txbytes = `0x${txUtils.encodeL1TxFull(l1TxDeposit)}`;

  const lastQueue = await buidlerHermez.nextL1FillingQueue();

  const lastQueueBytes = await buidlerHermez.mapL1TxQueue(lastQueue);

  const currentIndex = (lastQueueBytes.length - 2) / 2 / L1_USER_BYTES; // -2 --> 0x, /2 --> 2 hex digits = 1 byte

  if (tokenID != 0) {
    if (!isERC20Permit) {
      // tokens ERC20
      const initialOwnerBalance = await buidlerTokenHermez.balanceOf(
        await wallet.getAddress()
      );
      await expect(
        buidlerTokenHermez.connect(wallet).approve(buidlerHermez.address, loadAmount)
      ).to.emit(buidlerTokenHermez, "Approval");

      await expect(
        buidlerHermez.connect(wallet).addL1Transaction(
          babyjub0,
          fromIdx,
          loadAmountF,
          amountF0,
          tokenID,
          toIdx0,
          emptyPermit
        )
      )
        .to.emit(buidlerHermez, "L1UserTxEvent")
        .withArgs(lastQueue, currentIndex, l1Txbytes);

      const finalOwnerBalance = await buidlerTokenHermez.balanceOf(
        await wallet.getAddress()
      );

      expect(finalOwnerBalance).to.equal(
        BigNumber.from(initialOwnerBalance).sub(Scalar.toNumber(loadAmount))
      );
    } else {
      // tokens ERC20Permit
      const initialOwnerBalance = await buidlerTokenHermez.balanceOf(
        await wallet.getAddress()
      );

      const deadline = ethers.constants.MaxUint256;
      const value = loadAmount;
      const nonce = await buidlerTokenHermez.nonces(await wallet.getAddress());
      const { v, r, s } = await createPermitSignature(
        buidlerTokenHermez,
        wallet,
        buidlerHermez.address,
        value,
        nonce,
        deadline
      );

      const data = iface.encodeFunctionData("permit", [
        await wallet.getAddress(),
        buidlerHermez.address,
        value,
        deadline,
        v,
        r,
        s
      ]);

      // send l1tx wth permit signature
      await expect(
        buidlerHermez.connect(wallet).addL1Transaction(
          babyjub0,
          fromIdx,
          loadAmountF,
          amountF0,
          tokenID,
          toIdx0,
          data
        )
      )
        .to.emit(buidlerHermez, "L1UserTxEvent")
        .withArgs(lastQueue, currentIndex, l1Txbytes);

      const finalOwnerBalance = await buidlerTokenHermez.balanceOf(
        await wallet.getAddress()
      );

      expect(finalOwnerBalance).to.equal(
        BigNumber.from(initialOwnerBalance).sub(Scalar.toNumber(loadAmount))
      );
    }
  } else {
    // ether
    const initialOwnerBalance = await wallet.getBalance();

    await expect(
      buidlerHermez.connect(wallet).addL1Transaction(
        babyjub0,
        fromIdx,
        loadAmountF,
        amountF0,
        tokenID,
        toIdx0,
        emptyPermit,
        {
          value: loadAmount,
          gasPrice: 0,
        }
      )
    )
      .to.emit(buidlerHermez, "L1UserTxEvent")
      .withArgs(lastQueue, currentIndex, l1Txbytes);

    const finalOwnerBalance = await wallet.getBalance();

    expect(finalOwnerBalance).to.equal(
      BigNumber.from(initialOwnerBalance).sub(Scalar.toNumber(loadAmount))
    );
  }

  return l1Txbytes;
}

async function l1UserTxDepositTransfer(
  loadAmount,
  tokenID,
  fromIdx,
  toIdx,
  amountF,
  wallet,
  buidlerHermez,
  buidlerTokenHermez,
  isERC20Permit
) {
  const loadAmountF = float16.fix2Float(loadAmount);

  // equivalent L1 transaction:
  const l1TxDepositTransfer = {
    toIdx: toIdx,
    tokenID: tokenID,
    amountF: amountF,
    loadAmountF: loadAmountF,
    fromIdx: fromIdx,
    fromBjjCompressed: "0",
    fromEthAddr: await wallet.getAddress(),
  };

  const l1Txbytes = `0x${txUtils.encodeL1TxFull(l1TxDepositTransfer)}`;

  const lastQueue = await buidlerHermez.nextL1FillingQueue();

  const lastQueueBytes = await buidlerHermez.mapL1TxQueue(lastQueue);

  const currentIndex = (lastQueueBytes.length - 2) / 2 / L1_USER_BYTES; // -2 --> 0x, /2 --> 2 hex digits = 1 byte

  if (tokenID != 0) {
    if (!isERC20Permit) {
      // tokens ERC20
      const initialOwnerBalance = await buidlerTokenHermez.balanceOf(
        await wallet.getAddress()
      );
      await expect(
        buidlerTokenHermez.connect(wallet).approve(buidlerHermez.address, loadAmount)
      ).to.emit(buidlerTokenHermez, "Approval");

      await expect(
        buidlerHermez.connect(wallet).addL1Transaction(
          babyjub0,
          fromIdx,
          loadAmountF,
          amountF,
          tokenID,
          toIdx,
          emptyPermit
        )
      )
        .to.emit(buidlerHermez, "L1UserTxEvent")
        .withArgs(lastQueue, currentIndex, l1Txbytes);

      const finalOwnerBalance = await buidlerTokenHermez.balanceOf(
        await wallet.getAddress()
      );

      expect(finalOwnerBalance).to.equal(
        BigNumber.from(initialOwnerBalance).sub(Scalar.toNumber(loadAmount))
      );
    } else {
      // tokens ERC20Permit
      const initialOwnerBalance = await buidlerTokenHermez.balanceOf(
        await wallet.getAddress()
      );

      const deadline = ethers.constants.MaxUint256;
      const value = loadAmount;
      const nonce = await buidlerTokenHermez.nonces(await wallet.getAddress());
      const { v, r, s } = await createPermitSignature(
        buidlerTokenHermez,
        wallet,
        buidlerHermez.address,
        value,
        nonce,
        deadline
      );

      const data = iface.encodeFunctionData("permit", [
        await wallet.getAddress(),
        buidlerHermez.address,
        value,
        deadline,
        v,
        r,
        s
      ]);

      // send l1tx wth permit signature
      await expect(
        buidlerHermez.connect(wallet).addL1Transaction(
          babyjub0,
          fromIdx,
          loadAmountF,
          amountF,
          tokenID,
          toIdx,
          data
        )
      )
        .to.emit(buidlerHermez, "L1UserTxEvent")
        .withArgs(lastQueue, currentIndex, l1Txbytes);

      const finalOwnerBalance = await buidlerTokenHermez.balanceOf(
        await wallet.getAddress()
      );

      expect(finalOwnerBalance).to.equal(
        BigNumber.from(initialOwnerBalance).sub(Scalar.toNumber(loadAmount))
      );
    }
  } else {
    // ether
    const initialOwnerBalance = await wallet.getBalance();

    await expect(
      buidlerHermez.connect(wallet).addL1Transaction(
        babyjub0,
        fromIdx,
        loadAmountF,
        amountF,
        tokenID,
        toIdx,
        emptyPermit,
        {
          value: loadAmount,
          gasPrice: 0,
        }
      )
    )
      .to.emit(buidlerHermez, "L1UserTxEvent")
      .withArgs(lastQueue, currentIndex, l1Txbytes);

    const finalOwnerBalance = await wallet.getBalance();

    expect(finalOwnerBalance).to.equal(
      BigNumber.from(initialOwnerBalance).sub(Scalar.toNumber(loadAmount))
    );
  }

  return l1Txbytes;
}

async function l1UserTxCreateAccountDepositTransfer(
  loadAmount,
  tokenID,
  toIdx,
  amountF,
  babyjub,
  wallet,
  buidlerHermez,
  buidlerTokenHermez,
  isERC20Permit
) {
  const loadAmountF = float16.fix2Float(loadAmount);

  // equivalent L1 transaction:
  const l1TxCreateAccountDepositTransfer = {
    toIdx: toIdx,
    tokenID: tokenID,
    amountF: amountF,
    loadAmountF: loadAmountF,
    fromIdx: 0,
    fromBjjCompressed: babyjub,
    fromEthAddr: await wallet.getAddress(),
  };

  const l1Txbytes = `0x${txUtils.encodeL1TxFull(l1TxCreateAccountDepositTransfer)}`;

  const lastQueue = await buidlerHermez.nextL1FillingQueue();

  const lastQueueBytes = await buidlerHermez.mapL1TxQueue(lastQueue);

  const currentIndex = (lastQueueBytes.length - 2) / 2 / L1_USER_BYTES; // -2 --> 0x, /2 --> 2 hex digits = 1 byte

  if (tokenID != 0) {
    if (!isERC20Permit) {
      // tokens ERC20
      const initialOwnerBalance = await buidlerTokenHermez.balanceOf(
        await wallet.getAddress()
      );
      await expect(
        buidlerTokenHermez.connect(wallet).approve(buidlerHermez.address, loadAmount)
      ).to.emit(buidlerTokenHermez, "Approval");

      await expect(
        buidlerHermez.connect(wallet).addL1Transaction(
          babyjub,
          fromIdx0,
          loadAmountF,
          amountF,
          tokenID,
          toIdx,
          emptyPermit
        )
      )
        .to.emit(buidlerHermez, "L1UserTxEvent")
        .withArgs(lastQueue, currentIndex, l1Txbytes);

      const finalOwnerBalance = await buidlerTokenHermez.balanceOf(
        await wallet.getAddress()
      );

      expect(finalOwnerBalance).to.equal(
        BigNumber.from(initialOwnerBalance).sub(Scalar.toNumber(loadAmount))
      );
    } else {
      // tokens ERC20Permit
      const initialOwnerBalance = await buidlerTokenHermez.balanceOf(
        await wallet.getAddress()
      );

      const deadline = ethers.constants.MaxUint256;
      const value = loadAmount;
      const nonce = await buidlerTokenHermez.nonces(await wallet.getAddress());
      const { v, r, s } = await createPermitSignature(
        buidlerTokenHermez,
        wallet,
        buidlerHermez.address,
        value,
        nonce,
        deadline
      );

      const data = iface.encodeFunctionData("permit", [
        await wallet.getAddress(),
        buidlerHermez.address,
        value,
        deadline,
        v,
        r,
        s
      ]);

      // send l1tx wth permit signature
      await expect(
        buidlerHermez.connect(wallet).addL1Transaction(
          babyjub,
          fromIdx0,
          loadAmountF,
          amountF,
          tokenID,
          toIdx,
          data
        )
      )
        .to.emit(buidlerHermez, "L1UserTxEvent")
        .withArgs(lastQueue, currentIndex, l1Txbytes);

      const finalOwnerBalance = await buidlerTokenHermez.balanceOf(
        await wallet.getAddress()
      );

      expect(finalOwnerBalance).to.equal(
        BigNumber.from(initialOwnerBalance).sub(Scalar.toNumber(loadAmount))
      );
    }
  } else {
    // ether
    const initialOwnerBalance = await wallet.getBalance();

    await expect(
      buidlerHermez.connect(wallet).addL1Transaction(
        babyjub,
        fromIdx0,
        loadAmountF,
        amountF,
        tokenID,
        toIdx,
        emptyPermit,
        {
          value: loadAmount,
          gasPrice: 0,
        }
      )
    )
      .to.emit(buidlerHermez, "L1UserTxEvent")
      .withArgs(lastQueue, currentIndex, l1Txbytes);

    const finalOwnerBalance = await wallet.getBalance();

    expect(finalOwnerBalance).to.equal(
      BigNumber.from(initialOwnerBalance).sub(Scalar.toNumber(loadAmount))
    );
  }
  return l1Txbytes;
}

async function l1UserTxForceTransfer(
  tokenID,
  fromIdx,
  toIdx,
  amountF,
  wallet,
  buidlerHermez
) {
  // equivalent L1 transaction:
  const l1TxForceTransfer = {
    toIdx: toIdx,
    tokenID: tokenID,
    amountF: amountF,
    loadAmountF: 0,
    fromIdx: fromIdx,
    fromBjjCompressed: 0,
    fromEthAddr: await wallet.getAddress(),
  };

  const l1Txbytes = `0x${txUtils.encodeL1TxFull(l1TxForceTransfer)}`;

  const lastQueue = await buidlerHermez.nextL1FillingQueue();

  const lastQueueBytes = await buidlerHermez.mapL1TxQueue(lastQueue);

  const currentIndex = (lastQueueBytes.length - 2) / 2 / L1_USER_BYTES; // -2 --> 0x, /2 --> 2 hex digits = 1 byte

  await expect(
    buidlerHermez.connect(wallet).addL1Transaction(
      babyjub0,
      fromIdx,
      loadAmountF0,
      amountF,
      tokenID,
      toIdx,
      emptyPermit,
    )
  )
    .to.emit(buidlerHermez, "L1UserTxEvent")
    .withArgs(lastQueue, currentIndex, l1Txbytes);

  return l1Txbytes;
}

async function l1UserTxForceExit(
  tokenID,
  fromIdx,
  amountF,
  wallet,
  buidlerHermez
) {
  const exitIdx = 1;
  // equivalent L1 transaction:
  const l1TxForceExit = {
    toIdx: exitIdx,
    tokenID: tokenID,
    amountF: amountF,
    loadAmountF: 0,
    fromIdx: fromIdx,
    fromBjjCompressed: 0,
    fromEthAddr: await wallet.getAddress(),
  };
  const l1Txbytes = `0x${txUtils.encodeL1TxFull(l1TxForceExit)}`;

  const lastQueue = await buidlerHermez.nextL1FillingQueue();

  const lastQueueBytes = await buidlerHermez.mapL1TxQueue(lastQueue);

  const currentIndex = (lastQueueBytes.length - 2) / 2 / L1_USER_BYTES; // -2 --> 0x, /2 --> 2 hex digits = 1 byte

  await expect(
    buidlerHermez.connect(wallet).addL1Transaction(
      babyjub0,
      fromIdx,
      loadAmountF0,
      amountF,
      tokenID,
      exitIdx,
      emptyPermit,
    )
  )
    .to.emit(buidlerHermez, "L1UserTxEvent")
    .withArgs(lastQueue, currentIndex, l1Txbytes);

  return l1Txbytes;
}

async function l1CoordinatorTxEth(tokenID, babyjub, wallet, buidlerHermez, chainIdHex) {
  // equivalent L1 transaction:

  const flatSig = await txUtils.signBjjAuth(wallet, babyjub.slice(2), chainIdHex, buidlerHermez.address);

  let sig = ethers.utils.splitSignature(flatSig);

  const l1TxCoordinator = {
    tokenID: tokenID,
    fromBjjCompressed: babyjub,
    r: sig.r,
    s: sig.s,
    v: sig.v,
    fromEthAddr: await wallet.getAddress(),
  };

  const l1TxCoordinatorbytes = `0x${txUtils.encodeL1CoordinatorTx(
    l1TxCoordinator
  )}`;
  const l1TxBytes = `0x${txUtils.encodeL1TxFull(l1TxCoordinator)}`;

  return { l1TxBytes, l1TxCoordinatorbytes };
}

async function l1CoordinatorTxBjj(tokenID, babyjub, buidlerHermez) {
  const l1TxCoordinatorCreateBjj = {
    tokenID: tokenID,
    fromBjjCompressed: babyjub,
    r: "0",
    s: "0",
    v: "0",
    fromEthAddr: "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
  };

  const l1TxCoordinatorbytes = `0x${txUtils.encodeL1CoordinatorTx(
    l1TxCoordinatorCreateBjj
  )}`;
  const l1TxBytes = `0x${txUtils.encodeL1TxFull(l1TxCoordinatorCreateBjj)}`;

  return {
    l1TxBytes,
    l1TxCoordinatorbytes,
  };
}

async function AddToken(
  buidlerHermez,
  buidlerToken,
  buidlerHEZ,
  wallet,
  feeAddToken
) {
  const addressOwner = await wallet.getAddress();


  const deadline = ethers.constants.MaxUint256;
  const value = feeAddToken;
  const nonce = await buidlerHEZ.nonces(addressOwner);
  const { v, r, s } = await createPermitSignature(
    buidlerHEZ,
    wallet,
    buidlerHermez.address,
    value,
    nonce,
    deadline
  );

  const data = iface.encodeFunctionData("permit", [
    await wallet.getAddress(),
    buidlerHermez.address,
    value,
    deadline,
    v,
    r,
    s
  ]);

  const initialOwnerBalance = await buidlerHEZ.balanceOf(addressOwner);

  const tokensAdded = await buidlerHermez.registerTokensCount();

  // Send data and amount
  await expect(buidlerHermez.connect(wallet).addToken(buidlerToken.address, data))
    .to.emit(buidlerHermez, "AddToken")
    .withArgs(buidlerToken.address, tokensAdded);

  const finalOwnerBalance = await buidlerHEZ.balanceOf(addressOwner);
  expect(finalOwnerBalance).to.equal(
    BigNumber.from(initialOwnerBalance).sub(feeAddToken)
  );

  return tokensAdded;
}

async function createAccounts(
  forgerTest,
  loadAmount,
  tokenID,
  babyjub,
  wallet,
  buidlerHermez,
  buidlerToken,
  numAccounts,
  isERC20Permit
) {
  const l1TxCreateAccounts = [];

  for (let i = 0; i < numAccounts; i++) {
    l1TxCreateAccounts.push(
      await l1UserTxCreateAccountDeposit(
        loadAmount,
        tokenID,
        babyjub,
        wallet,
        buidlerHermez,
        buidlerToken,
        isERC20Permit
      )
    );
  }
  // forge empty batch, now the current queue is filled with the L1-User-Tx
  await forgerTest.forgeBatch(true, [], []);
  // forge the create accounts
  await forgerTest.forgeBatch(true, l1TxCreateAccounts, []);
}

function calculateInputMaxTxLevels(maxTxArray, nLevelsArray) {
  let returnArray = [];
  for (let i = 0; i < maxTxArray.length; i++) {
    returnArray.push(
      Scalar.add(Scalar.e(maxTxArray[i]), Scalar.shl(nLevelsArray[i], 256 - 8))
    );
  }
  return returnArray;
}

async function createPermitSignature(buidlerToken, wallet, spenderAddress, value, nonce, deadline) {
  const digest = await createPermitDigest(
    buidlerToken,
    await wallet.getAddress(),
    spenderAddress,
    value,
    nonce,
    deadline
  );

  // must be a wallet not a signer!
  const ownerPrivateKey = wallet.privateKey;
  let signingKey = new ethers.utils.SigningKey(ownerPrivateKey);

  let {
    v,
    r,
    s
  } = signingKey.signDigest(digest);

  return {
    v,
    r,
    s,
  };
}

module.exports = {
  ForgerTest,
  l1UserTxCreateAccountDeposit,
  l1UserTxDeposit,
  l1UserTxDepositTransfer,
  l1UserTxCreateAccountDepositTransfer,
  l1UserTxForceTransfer,
  l1UserTxForceExit,
  l1CoordinatorTxEth,
  l1CoordinatorTxBjj,
  AddToken,
  createAccounts,
  calculateInputMaxTxLevels,
  createPermitSignature
};
