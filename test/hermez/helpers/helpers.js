const {expect} = require("chai");
const {ethers} = require("../../../node_modules/@nomiclabs/buidler");
const Scalar = require("ffjavascript").Scalar;

const {float16, txUtils, utils} = require("@hermeznetwork/commonjs");
const {BigNumber} = require("ethers");
const nLevels = 32;
const {
  createPermitDigest
} = require("./erc2612");

const {
  ecsign,
} = require("ethereumjs-util");

const L1_USER_BYTES = 72; // 20 ehtaddr, 32 babyjub, 4 token, 2 amountF, 2 loadAmountf, 6 fromIDx, 6 toidx

const babyjub0 = 0;
const fromIdx0 = 0;
const loadAmountF0 = 0;
const amountF0 = 0;
const tokenID0 = 0;
const toIdx0 = 0;


class ForgerTest {
  constructor(maxTx, maxL1Tx, nLevels, buidlerHermez, rollupDB) {
    this.rollupDB = rollupDB;
    this.maxTx = maxTx;
    this.maxL1Tx = maxL1Tx;
    this.nLevels = nLevels;
    this.buidlerHermez = buidlerHermez;

    this.L1TxB = 544;
  }

  async forgeBatch(l1Batch, l1TxUserArray, l1TxCoordiatorArray) {
    const bb = await this.rollupDB.buildBatch(
      this.maxTx,
      this.nLevels,
      this.maxL1Tx
    );

    let jsL1TxData = "";
    for (let tx of l1TxUserArray) {
      bb.addTx(txUtils.decodeL1Tx(tx));
      jsL1TxData = jsL1TxData + tx.slice(2);
    }

    // check L1 user tx are the same in batchbuilder and contract
    const currentQueue = await this.buidlerHermez.nextL1ToForgeQueue();
    const SCL1TxData = await this.buidlerHermez.mapL1TxQueue(currentQueue);

    expect(SCL1TxData).to.equal(`0x${jsL1TxData}`);

    for (let tx of l1TxCoordiatorArray) {
      bb.addTx(txUtils.decodeL1Tx(tx.l1TxBytes));
    }

    await bb.build();

    let stringL1CoordinatorTx = "";
    for (let tx of l1TxCoordiatorArray) {
      stringL1CoordinatorTx =
        stringL1CoordinatorTx + tx.l1TxCoordinatorbytes.slice(2); // retireve the 0x
    }

    const proofA = ["0", "0"];
    const proofB = [
      ["0", "0"],
      ["0", "0"],
    ];
    const proofC = ["0", "0"];

    const newLastIdx = bb.getNewLastIdx();
    const newStateRoot = bb.getNewStateRoot();
    const newExitRoot = bb.getNewExitRoot();
    const compressedL1CoordinatorTx = `0x${stringL1CoordinatorTx}`;
    const L2TxsData = bb.getL2TxsDataSM();
    const feeIdxCoordinator = bb.getFeeTxsDataSM();
    const verifierIdx = 0;

    await expect(
      this.buidlerHermez.calculateInputTest(
        newLastIdx,
        newStateRoot,
        newExitRoot,
        compressedL1CoordinatorTx,
        L2TxsData,
        feeIdxCoordinator,
        l1Batch,
        verifierIdx
      )
    )
      .to.emit(this.buidlerHermez, "ReturnUint256")
      .withArgs(bb.getHashInputs());

    const tx = await this.buidlerHermez.forgeBatch(
      newLastIdx,
      newStateRoot,
      newExitRoot,
      compressedL1CoordinatorTx,
      L2TxsData,
      feeIdxCoordinator,
      verifierIdx,
      l1Batch,
      proofA,
      proofB,
      proofC
    );

    await this.rollupDB.consolidate(bb);

    return tx;
  }
}

async function signBjjAuth(wallet, babyjub) {
  const AccountCreationAuthMsgArray = ethers.utils.toUtf8Bytes(
    "I authorize this babyjubjub key for hermez rollup account creation"
  ); // 66 bytes
  const messageHex =
    ethers.utils.hexlify(AccountCreationAuthMsgArray) + babyjub; // 66 bytes + 32 bytes = 98 bytes
  const messageArray = ethers.utils.arrayify(messageHex);
  // other approach could be babyjub arrify, concat with AccountCreationAuthMsgArray and sign
  const flatSig = await wallet.signMessage(messageArray); // automatically concat "\x19Ethereum Signed Message:\n98" to the messageArray, where `98`is the length of the messageArray
  const signatureParams = ethers.utils.splitSignature(flatSig);
  return flatSig.slice(0, -2) + signatureParams.v.toString(16);
}

async function l1UserTxCreateAccountDeposit(
  loadAmount,
  tokenID,
  babyjub,
  owner,
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
    fromEthAddr: await owner.getAddress(),
  };
  const l1Txbytes = `0x${txUtils.encodeL1Tx(l1TxcreateAccountDeposit)}`;

  const lastQueue = await buidlerHermez.nextL1FillingQueue();

  const lastQueueBytes = await buidlerHermez.mapL1TxQueue(lastQueue);

  const currentIndex = (lastQueueBytes.length - 2) / 2 / L1_USER_BYTES; // -2 --> 0x, /2 --> 2 hex digits = 1 byte

  if (tokenID != 0) {
    if (!isERC20Permit) {
      // tokens ERC20
      const initialOwnerBalance = await buidlerTokenHermez.balanceOf(
        await owner.getAddress()
      );
      await expect(
        buidlerTokenHermez.approve(buidlerHermez.address, loadAmount)
      ).to.emit(buidlerTokenHermez, "Approval");

      // const gasCost = await buidlerHermez.estimateGas[
      //   "addL1Transaction(uint256,uint48,uint16,uint16,uint32,uint48)"
      // ](babyjub, fromIdx0, loadAmountF, amountF0, tokenID, toIdx0);
      // console.log(gasCost.toNumber());
      
      await expect(
        buidlerHermez.addL1Transaction(
          babyjub,
          fromIdx0,
          loadAmountF,
          amountF0,
          tokenID,
          toIdx0
        )
      )
        .to.emit(buidlerHermez, "L1UserTxEvent")
        .withArgs(lastQueue, currentIndex + 1, l1Txbytes);

      const finalOwnerBalance = await buidlerTokenHermez.balanceOf(
        await owner.getAddress()
      );

      expect(finalOwnerBalance).to.equal(
        BigNumber.from(initialOwnerBalance).sub(Scalar.toNumber(loadAmount))
      );
    } else {
      // tokens ERC20Permit
      const initialOwnerBalance = await buidlerTokenHermez.balanceOf(
        await owner.getAddress()
      );
        
      const deadline = ethers.constants.MaxUint256;
      const value = loadAmount;
      const nonce = await buidlerTokenHermez.nonces(await owner.getAddress());
      const {v,r,s} = await createPermitSignature(
        buidlerTokenHermez,
        owner,
        buidlerHermez.address,
        value,
        nonce,
        deadline
      );
      // send l1tx wth permit signature
      await expect(
        buidlerHermez.addL1TransactionWithPermit(
          babyjub,
          fromIdx0,
          loadAmountF,
          amountF0,
          tokenID,
          toIdx0,
          deadline,
          v,
          r,
          s 
        )
      )
        .to.emit(buidlerHermez, "L1UserTxEvent")
        .withArgs(lastQueue, currentIndex + 1, l1Txbytes);

      const finalOwnerBalance = await buidlerTokenHermez.balanceOf(
        await owner.getAddress()
      );

      expect(finalOwnerBalance).to.equal(
        BigNumber.from(initialOwnerBalance).sub(Scalar.toNumber(loadAmount))
      );
    }
  } else {
    // ether
    const initialOwnerBalance = await owner.getBalance();
    await expect(
      buidlerHermez.addL1Transaction(
        babyjub,
        fromIdx0,
        loadAmountF,
        amountF0,
        tokenID,
        toIdx0,
        {
          value: loadAmount,
          gasPrice: 0,
        }
      )
    )
      .to.emit(buidlerHermez, "L1UserTxEvent")
      .withArgs(lastQueue, currentIndex + 1, l1Txbytes);

    const finalOwnerBalance = await owner.getBalance();

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
  owner,
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
    fromEthAddr: await owner.getAddress(),
  };

  const l1Txbytes = `0x${txUtils.encodeL1Tx(l1TxDeposit)}`;

  const lastQueue = await buidlerHermez.nextL1FillingQueue();

  const lastQueueBytes = await buidlerHermez.mapL1TxQueue(lastQueue);

  const currentIndex = (lastQueueBytes.length - 2) / 2 / L1_USER_BYTES; // -2 --> 0x, /2 --> 2 hex digits = 1 byte

  if (tokenID != 0) {
    if (!isERC20Permit) {
      // tokens ERC20
      const initialOwnerBalance = await buidlerTokenHermez.balanceOf(
        await owner.getAddress()
      );
      await expect(
        buidlerTokenHermez.approve(buidlerHermez.address, loadAmount)
      ).to.emit(buidlerTokenHermez, "Approval");

      await expect(
        buidlerHermez.addL1Transaction(
          babyjub0,
          fromIdx,
          loadAmountF,
          amountF0,
          tokenID,
          toIdx0
        )
      )
        .to.emit(buidlerHermez, "L1UserTxEvent")
        .withArgs(lastQueue, currentIndex + 1, l1Txbytes);

      const finalOwnerBalance = await buidlerTokenHermez.balanceOf(
        await owner.getAddress()
      );

      expect(finalOwnerBalance).to.equal(
        BigNumber.from(initialOwnerBalance).sub(Scalar.toNumber(loadAmount))
      );
    } else {
      // tokens ERC20Permit
      const initialOwnerBalance = await buidlerTokenHermez.balanceOf(
        await owner.getAddress()
      );

      const deadline = ethers.constants.MaxUint256;
      const value = loadAmount;
      const nonce = await buidlerTokenHermez.nonces(await owner.getAddress());
      const {v,r,s} = await createPermitSignature(
        buidlerTokenHermez,
        owner,
        buidlerHermez.address,
        value,
        nonce,
        deadline
      );
      // send l1tx wth permit signature
      await expect(
        buidlerHermez.addL1TransactionWithPermit(
          babyjub0,
          fromIdx,
          loadAmountF,
          amountF0,
          tokenID,
          toIdx0,
          deadline,
          v,
          r,
          s 
        )
      )
        .to.emit(buidlerHermez, "L1UserTxEvent")
        .withArgs(lastQueue, currentIndex + 1, l1Txbytes);

      const finalOwnerBalance = await buidlerTokenHermez.balanceOf(
        await owner.getAddress()
      );

      expect(finalOwnerBalance).to.equal(
        BigNumber.from(initialOwnerBalance).sub(Scalar.toNumber(loadAmount))
      );
    }
  } else {
    // ether
    const initialOwnerBalance = await owner.getBalance();

    await expect(
      buidlerHermez.addL1Transaction(
        babyjub0,
        fromIdx,
        loadAmountF,
        amountF0,
        tokenID,
        toIdx0,
        {
          value: loadAmount,
          gasPrice: 0,
        }
      )
    )
      .to.emit(buidlerHermez, "L1UserTxEvent")
      .withArgs(lastQueue, currentIndex + 1, l1Txbytes);

    const finalOwnerBalance = await owner.getBalance();

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
  owner,
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
    fromEthAddr: await owner.getAddress(),
  };

  const l1Txbytes = `0x${txUtils.encodeL1Tx(l1TxDepositTransfer)}`;

  const lastQueue = await buidlerHermez.nextL1FillingQueue();

  const lastQueueBytes = await buidlerHermez.mapL1TxQueue(lastQueue);

  const currentIndex = (lastQueueBytes.length - 2) / 2 / L1_USER_BYTES; // -2 --> 0x, /2 --> 2 hex digits = 1 byte

  if (tokenID != 0) {
    if (!isERC20Permit) {
      // tokens ERC20
      const initialOwnerBalance = await buidlerTokenHermez.balanceOf(
        await owner.getAddress()
      );
      await expect(
        buidlerTokenHermez.approve(buidlerHermez.address, loadAmount)
      ).to.emit(buidlerTokenHermez, "Approval");

      await expect(
        buidlerHermez.addL1Transaction(
          babyjub0,
          fromIdx,
          loadAmountF,
          amountF,
          tokenID,
          toIdx
        )
      )
        .to.emit(buidlerHermez, "L1UserTxEvent")
        .withArgs(lastQueue, currentIndex + 1, l1Txbytes);

      const finalOwnerBalance = await buidlerTokenHermez.balanceOf(
        await owner.getAddress()
      );

      expect(finalOwnerBalance).to.equal(
        BigNumber.from(initialOwnerBalance).sub(Scalar.toNumber(loadAmount))
      );
    } else {
      // tokens ERC20Permit
      const initialOwnerBalance = await buidlerTokenHermez.balanceOf(
        await owner.getAddress()
      );

      const deadline = ethers.constants.MaxUint256;
      const value = loadAmount;
      const nonce = await buidlerTokenHermez.nonces(await owner.getAddress());
      const {v,r,s} = await createPermitSignature(
        buidlerTokenHermez,
        owner,
        buidlerHermez.address,
        value,
        nonce,
        deadline
      );
      // send l1tx wth permit signature
      await expect(
        buidlerHermez.addL1TransactionWithPermit(
          babyjub0,
          fromIdx,
          loadAmountF,
          amountF,
          tokenID,
          toIdx,
          deadline,
          v,
          r,
          s 
        )
      )
        .to.emit(buidlerHermez, "L1UserTxEvent")
        .withArgs(lastQueue, currentIndex + 1, l1Txbytes);

      const finalOwnerBalance = await buidlerTokenHermez.balanceOf(
        await owner.getAddress()
      );

      expect(finalOwnerBalance).to.equal(
        BigNumber.from(initialOwnerBalance).sub(Scalar.toNumber(loadAmount))
      );
    }
  } else {
    // ether
    const initialOwnerBalance = await owner.getBalance();

    await expect(
      buidlerHermez.addL1Transaction(
        babyjub0,
        fromIdx,
        loadAmountF,
        amountF,
        tokenID,
        toIdx,
        {
          value: loadAmount,
          gasPrice: 0,
        }
      )
    )
      .to.emit(buidlerHermez, "L1UserTxEvent")
      .withArgs(lastQueue, currentIndex + 1, l1Txbytes);

    const finalOwnerBalance = await owner.getBalance();

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
  owner,
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
    fromEthAddr: await owner.getAddress(),
  };

  const l1Txbytes = `0x${txUtils.encodeL1Tx(l1TxCreateAccountDepositTransfer)}`;

  const lastQueue = await buidlerHermez.nextL1FillingQueue();

  const lastQueueBytes = await buidlerHermez.mapL1TxQueue(lastQueue);

  const currentIndex = (lastQueueBytes.length - 2) / 2 / L1_USER_BYTES; // -2 --> 0x, /2 --> 2 hex digits = 1 byte

  if (tokenID != 0) {
    if (!isERC20Permit) {
      // tokens ERC20
      const initialOwnerBalance = await buidlerTokenHermez.balanceOf(
        await owner.getAddress()
      );
      await expect(
        buidlerTokenHermez.approve(buidlerHermez.address, loadAmount)
      ).to.emit(buidlerTokenHermez, "Approval");

      await expect(
        buidlerHermez.addL1Transaction(
          babyjub,
          fromIdx0,
          loadAmountF,
          amountF,
          tokenID,
          toIdx
        )
      )
        .to.emit(buidlerHermez, "L1UserTxEvent")
        .withArgs(lastQueue, currentIndex + 1, l1Txbytes);

      const finalOwnerBalance = await buidlerTokenHermez.balanceOf(
        await owner.getAddress()
      );

      expect(finalOwnerBalance).to.equal(
        BigNumber.from(initialOwnerBalance).sub(Scalar.toNumber(loadAmount))
      );
    } else {
      // tokens ERC20Permit
      const initialOwnerBalance = await buidlerTokenHermez.balanceOf(
        await owner.getAddress()
      );

      const deadline = ethers.constants.MaxUint256;
      const value = loadAmount;
      const nonce = await buidlerTokenHermez.nonces(await owner.getAddress());
      const {v,r,s} = await createPermitSignature(
        buidlerTokenHermez,
        owner,
        buidlerHermez.address,
        value,
        nonce,
        deadline
      );
      // send l1tx wth permit signature
      await expect(
        buidlerHermez.addL1TransactionWithPermit(
          babyjub,
          fromIdx0,
          loadAmountF,
          amountF,
          tokenID,
          toIdx,
          deadline,
          v,
          r,
          s 
        )
      )
        .to.emit(buidlerHermez, "L1UserTxEvent")
        .withArgs(lastQueue, currentIndex + 1, l1Txbytes);

      const finalOwnerBalance = await buidlerTokenHermez.balanceOf(
        await owner.getAddress()
      );

      expect(finalOwnerBalance).to.equal(
        BigNumber.from(initialOwnerBalance).sub(Scalar.toNumber(loadAmount))
      );
    }
  } else {
    // ether
    const initialOwnerBalance = await owner.getBalance();

    await expect(
      buidlerHermez.addL1Transaction(
        babyjub,
        fromIdx0,
        loadAmountF,
        amountF,
        tokenID,
        toIdx,
        {
          value: loadAmount,
          gasPrice: 0,
        }
      )
    )
      .to.emit(buidlerHermez, "L1UserTxEvent")
      .withArgs(lastQueue, currentIndex + 1, l1Txbytes);

    const finalOwnerBalance = await owner.getBalance();

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
  owner,
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
    fromEthAddr: await owner.getAddress(),
  };

  const l1Txbytes = `0x${txUtils.encodeL1Tx(l1TxForceTransfer)}`;

  const lastQueue = await buidlerHermez.nextL1FillingQueue();

  const lastQueueBytes = await buidlerHermez.mapL1TxQueue(lastQueue);

  const currentIndex = (lastQueueBytes.length - 2) / 2 / L1_USER_BYTES; // -2 --> 0x, /2 --> 2 hex digits = 1 byte

  await expect(
    buidlerHermez.addL1Transaction(
      babyjub0,
      fromIdx,
      loadAmountF0,
      amountF,
      tokenID,
      toIdx
    )
  )
    .to.emit(buidlerHermez, "L1UserTxEvent")
    .withArgs(lastQueue, currentIndex + 1, l1Txbytes);

  return l1Txbytes;
}

async function l1UserTxForceExit(
  tokenID,
  fromIdx,
  amountF,
  owner,
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
    fromEthAddr: await owner.getAddress(),
  };
  const l1Txbytes = `0x${txUtils.encodeL1Tx(l1TxForceExit)}`;

  const lastQueue = await buidlerHermez.nextL1FillingQueue();

  const lastQueueBytes = await buidlerHermez.mapL1TxQueue(lastQueue);

  const currentIndex = (lastQueueBytes.length - 2) / 2 / L1_USER_BYTES; // -2 --> 0x, /2 --> 2 hex digits = 1 byte

  await expect(
    buidlerHermez.connect(owner).addL1Transaction(
      babyjub0,
      fromIdx,
      loadAmountF0,
      amountF,
      tokenID,
      exitIdx
    )
  )
    .to.emit(buidlerHermez, "L1UserTxEvent")
    .withArgs(lastQueue, currentIndex + 1, l1Txbytes);

  return l1Txbytes;
}

async function l1CoordinatorTxEth(tokenID, babyjub, owner, buidlerHermez) {
  // equivalent L1 transaction:

  const flatSig = await signBjjAuth(owner, babyjub.slice(2));

  let sig = ethers.utils.splitSignature(flatSig);

  const l1TxCoordinator = {
    tokenID: tokenID,
    fromBjjCompressed: babyjub,
    r: sig.r,
    s: sig.s,
    v: sig.v,
    fromEthAddr: await owner.getAddress(),
  };

  const l1TxCoordinatorbytes = `0x${txUtils.encodeL1CoordinatorTx(
    l1TxCoordinator
  )}`;
  const l1TxBytes = `0x${txUtils.encodeL1Tx(l1TxCoordinator)}`;

  return {l1TxBytes, l1TxCoordinatorbytes};
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
  const l1TxBytes = `0x${txUtils.encodeL1Tx(l1TxCoordinatorCreateBjj)}`;

  return {
    l1TxBytes,
    l1TxCoordinatorbytes,
  };
}

async function AddToken(
  buidlerHermez,
  buidlerToken,
  buidlerHEZ,
  owner,
  feeAddToken
) {
  const addressOwner = await owner.getAddress();


  const deadline = ethers.constants.MaxUint256;
  const value = feeAddToken;
  const nonce = await buidlerHEZ.nonces(addressOwner);
  const {v,r,s} = await createPermitSignature(
    buidlerHEZ,
    owner,
    buidlerHermez.address,
    value,
    nonce,
    deadline
  );

  // const digestView = await buidlerHEZ.digestView(addressOwner,  buidlerHermez.address, value, deadline);
  // const domainSeparator = await buidlerHEZ.domainSeparatorView();
  // console.log({digestView});
  // console.log({domainSeparator});

  const initialOwnerBalance = await buidlerHEZ.balanceOf(addressOwner);

  const tokensAdded = await buidlerHermez.registerTokensCount();

  // Send data and amount
  await expect(buidlerHermez.addToken(buidlerToken.address, deadline, v, r ,s))
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
  owner,
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
        owner,
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

async function registerERC1820(signer) {
  const ERC1820_REGISTRY_DEPLOY_TX =
  "0xf90a388085174876e800830c35008080b909e5608060405234801561001057600080fd5b506109c5806100206000396000f3fe608060405234801561001057600080fd5b50600436106100a5576000357c010000000000000000000000000000000000000000000000000000000090048063a41e7d5111610078578063a41e7d51146101d4578063aabbb8ca1461020a578063b705676514610236578063f712f3e814610280576100a5565b806329965a1d146100aa5780633d584063146100e25780635df8122f1461012457806365ba36c114610152575b600080fd5b6100e0600480360360608110156100c057600080fd5b50600160a060020a038135811691602081013591604090910135166102b6565b005b610108600480360360208110156100f857600080fd5b5035600160a060020a0316610570565b60408051600160a060020a039092168252519081900360200190f35b6100e06004803603604081101561013a57600080fd5b50600160a060020a03813581169160200135166105bc565b6101c26004803603602081101561016857600080fd5b81019060208101813564010000000081111561018357600080fd5b82018360208201111561019557600080fd5b803590602001918460018302840111640100000000831117156101b757600080fd5b5090925090506106b3565b60408051918252519081900360200190f35b6100e0600480360360408110156101ea57600080fd5b508035600160a060020a03169060200135600160e060020a0319166106ee565b6101086004803603604081101561022057600080fd5b50600160a060020a038135169060200135610778565b61026c6004803603604081101561024c57600080fd5b508035600160a060020a03169060200135600160e060020a0319166107ef565b604080519115158252519081900360200190f35b61026c6004803603604081101561029657600080fd5b508035600160a060020a03169060200135600160e060020a0319166108aa565b6000600160a060020a038416156102cd57836102cf565b335b9050336102db82610570565b600160a060020a031614610339576040805160e560020a62461bcd02815260206004820152600f60248201527f4e6f7420746865206d616e616765720000000000000000000000000000000000604482015290519081900360640190fd5b6103428361092a565b15610397576040805160e560020a62461bcd02815260206004820152601a60248201527f4d757374206e6f7420626520616e204552433136352068617368000000000000604482015290519081900360640190fd5b600160a060020a038216158015906103b85750600160a060020a0382163314155b156104ff5760405160200180807f455243313832305f4143434550545f4d4147494300000000000000000000000081525060140190506040516020818303038152906040528051906020012082600160a060020a031663249cb3fa85846040518363ffffffff167c01000000000000000000000000000000000000000000000000000000000281526004018083815260200182600160a060020a0316600160a060020a031681526020019250505060206040518083038186803b15801561047e57600080fd5b505afa158015610492573d6000803e3d6000fd5b505050506040513d60208110156104a857600080fd5b5051146104ff576040805160e560020a62461bcd02815260206004820181905260248201527f446f6573206e6f7420696d706c656d656e742074686520696e74657266616365604482015290519081900360640190fd5b600160a060020a03818116600081815260208181526040808320888452909152808220805473ffffffffffffffffffffffffffffffffffffffff19169487169485179055518692917f93baa6efbd2244243bfee6ce4cfdd1d04fc4c0e9a786abd3a41313bd352db15391a450505050565b600160a060020a03818116600090815260016020526040812054909116151561059a5750806105b7565b50600160a060020a03808216600090815260016020526040902054165b919050565b336105c683610570565b600160a060020a031614610624576040805160e560020a62461bcd02815260206004820152600f60248201527f4e6f7420746865206d616e616765720000000000000000000000000000000000604482015290519081900360640190fd5b81600160a060020a031681600160a060020a0316146106435780610646565b60005b600160a060020a03838116600081815260016020526040808220805473ffffffffffffffffffffffffffffffffffffffff19169585169590951790945592519184169290917f605c2dbf762e5f7d60a546d42e7205dcb1b011ebc62a61736a57c9089d3a43509190a35050565b600082826040516020018083838082843780830192505050925050506040516020818303038152906040528051906020012090505b92915050565b6106f882826107ef565b610703576000610705565b815b600160a060020a03928316600081815260208181526040808320600160e060020a031996909616808452958252808320805473ffffffffffffffffffffffffffffffffffffffff19169590971694909417909555908152600284528181209281529190925220805460ff19166001179055565b600080600160a060020a038416156107905783610792565b335b905061079d8361092a565b156107c357826107ad82826108aa565b6107b85760006107ba565b815b925050506106e8565b600160a060020a0390811660009081526020818152604080832086845290915290205416905092915050565b6000808061081d857f01ffc9a70000000000000000000000000000000000000000000000000000000061094c565b909250905081158061082d575080155b1561083d576000925050506106e8565b61084f85600160e060020a031961094c565b909250905081158061086057508015155b15610870576000925050506106e8565b61087a858561094c565b909250905060018214801561088f5750806001145b1561089f576001925050506106e8565b506000949350505050565b600160a060020a0382166000908152600260209081526040808320600160e060020a03198516845290915281205460ff1615156108f2576108eb83836107ef565b90506106e8565b50600160a060020a03808316600081815260208181526040808320600160e060020a0319871684529091529020549091161492915050565b7bffffffffffffffffffffffffffffffffffffffffffffffffffffffff161590565b6040517f01ffc9a7000000000000000000000000000000000000000000000000000000008082526004820183905260009182919060208160248189617530fa90519096909550935050505056fea165627a7a72305820377f4a2d4301ede9949f163f319021a6e9c687c292a5e2b2c4734c126b524e6c00291ba01820182018201820182018201820182018201820182018201820182018201820a01820182018201820182018201820182018201820182018201820182018201820";
  const ERC1820_REGISTRY_ADDRESS = "0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24";
  if ((await ethers.provider.getCode(ERC1820_REGISTRY_ADDRESS)) == "0x") {
    await signer.sendTransaction({
      to: "0xa990077c3205cbDf861e17Fa532eeB069cE9fF96",
      value: ethers.utils.parseEther("1"),
    });
    await ethers.provider.sendTransaction(ERC1820_REGISTRY_DEPLOY_TX);
  }
}


async function createPermitSignature(buidlerToken, owner, spenderAddress, value, nonce, deadline) {
  const digest = await createPermitDigest(
    buidlerToken,
    await owner.getAddress(),
    spenderAddress,
    value,
    nonce,
    deadline
  );

  const ownerPrivateKey = "0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122";
  let {
    r,
    s,
    v
  } = ecsign(
    Buffer.from(digest.slice(2), "hex"),
    Buffer.from(ownerPrivateKey.slice(2), "hex")
  );

  return {
    v,
    r,
    s,
  };
}

module.exports = {
  ForgerTest,
  signBjjAuth,
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
  registerERC1820
};
