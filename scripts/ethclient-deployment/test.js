const web3 = require("web3");
const blockFromRpc = require('ethereumjs-block/from-rpc')
const utils = require('ethereumjs-util');

const node = new web3("http://localhost:8545");

node.eth.getBlock(1).then((blockData) => {
  console.log(blockData);
  // 1
  blockData.difficulty = Number(blockData.difficulty);
  blockData.totalDifficulty = Number(blockData.totalDifficulty);
  blockData.uncleHash = blockData.sha3Uncles;
  blockData.coinbase = blockData.miner;
  blockData.transactionTrie = blockData.transactionsRoot;
  blockData.receiptTrie = blockData.receiptsRoot;
  blockData.bloom = blockData.logsBloom;

  // 2
  // https://ethereum.stackexchange.com/questions/31314/block-header-format
  // https://ethereum.stackexchange.com/questions/268/ethereum-block-architecture
  const rawHeader = [
      blockData.parentHash,
      blockData.sha3Uncles,
      blockData.miner,
      blockData.stateRoot,
      blockData.transactionsRoot,
      blockData.receiptsRoot,
      blockData.logsBloom,
      blockData.difficulty,
      blockData.number,
      blockData.gasLimit,
      blockData.gasUsed,
      blockData.timestamp,
      blockData.extraData,
      blockData.mixHash,
      blockData.nonce
  ];
  blockData.mixHash = Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex');

  // 3
  const block = blockFromRpc(blockData);

  console.log(blockData);
  console.log(rawHeader);
  console.log(block.header.raw);

  console.log('calculated block hash:', utils.rlphash(block.header.raw).toString('hex'));
})
