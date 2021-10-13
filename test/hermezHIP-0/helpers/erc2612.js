const {
  ethers
} = require("hardhat");

const PERMIT_TYPEHASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"));
async function createPermitDigest(token, owner, spender, value, nonce, deadline) {
  const chainId = (await token.getChainId());
  const name = await token.name();
  let _domainSeparator = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [
        ethers.utils.keccak256(
          ethers.utils.toUtf8Bytes(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
          )
        ),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes(name)),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")),
        chainId,
        token.address,
      ]
    )
  );

  return ethers.utils.solidityKeccak256(
    ["bytes1", "bytes1", "bytes32", "bytes32"],
    [
      "0x19",
      "0x01",
      _domainSeparator,
      ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "address", "address", "uint256", "uint256", "uint256"],
        [PERMIT_TYPEHASH, owner, spender, value, nonce, deadline]
      ))
    ]);
}

module.exports = {
  createPermitDigest,
  PERMIT_TYPEHASH
};