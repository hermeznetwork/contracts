// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.6.12;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

/**
 * @dev Rollup helper functions
 */
contract HermezHelpersV2 is Initializable {
    uint256 private constant _WORD_SIZE = 32;

    // bytes32 public constant EIP712DOMAIN_HASH =
    //      keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
    bytes32
        public constant EIP712DOMAIN_HASH = 0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f;
    // bytes32 public constant NAME_HASH =
    //      keccak256("Hermez Network")
    bytes32
        public constant NAME_HASH = 0xbe287413178bfeddef8d9753ad4be825ae998706a6dabff23978b59dccaea0ad;
    // bytes32 public constant VERSION_HASH =
    //      keccak256("1")
    bytes32
        public constant VERSION_HASH = 0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6;
    // bytes32 public constant AUTHORISE_TYPEHASH =
    //      keccak256("Authorise(string Provider,string Authorisation,bytes32 BJJKey)");
    bytes32
        public constant AUTHORISE_TYPEHASH = 0xafd642c6a37a2e6887dc4ad5142f84197828a904e53d3204ecb1100329231eaa;
    // bytes32 public constant HERMEZ_NETWORK_HASH = keccak256(bytes("Hermez Network")),
    bytes32
        public constant HERMEZ_NETWORK_HASH = 0xbe287413178bfeddef8d9753ad4be825ae998706a6dabff23978b59dccaea0ad;
    // bytes32 public constant ACCOUNT_CREATION_HASH = keccak256(bytes("Account creation")),
    bytes32
        public constant ACCOUNT_CREATION_HASH = 0xff946cf82975b1a2b6e6d28c9a76a4b8d7a1fd0592b785cb92771933310f9ee7;

    /**
     * @dev Decode half floating precision.
     * Max value encoded with this codification: 0x1f8def8800cca870c773f6eb4d980000000 (aprox 137 bits)
     * @param float Float half precision encode number
     * @return Decoded floating half precision
     */
    function _float2Fix(uint40 float) internal pure returns (uint256) {
        uint256 m = float & 0x7FFFFFFFF;
        uint256 e = float >> 35;

        // never overflow, max "e" value is 32
        uint256 exp = 10**e;

        // never overflow, max "fix" value is 1023 * 10^32
        uint256 fix = m * exp;

        return fix;
    }

    /**
     * @dev Retrieve the DOMAIN_SEPARATOR hash
     * @return domainSeparator hash used for sign messages
     */
    function DOMAIN_SEPARATOR() public view returns (bytes32 domainSeparator) {
        return
            keccak256(
                abi.encode(
                    EIP712DOMAIN_HASH,
                    NAME_HASH,
                    VERSION_HASH,
                    getChainId(),
                    address(this)
                )
            );
    }

    /**
     * @return chainId The current chainId where the smarctoncract is executed
     */
    function getChainId() public pure returns (uint256 chainId) {
        assembly {
            chainId := chainid()
        }
    }

    /**
     * @dev Retrieve ethereum address from a (defaultMessage + babyjub) signature
     * @param babyjub Public key babyjubjub represented as point: sign + (Ay)
     * @param r Signature parameter
     * @param s Signature parameter
     * @param v Signature parameter
     * @return Ethereum address recovered from the signature
     */
    function _checkSig(
        bytes32 babyjub,
        bytes32 r,
        bytes32 s,
        uint8 v
    ) internal view returns (address) {
        // from https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/cryptography/ECDSA.sol#L46
        // EIP-2 still allows signature malleability for ecrecover(). Remove this possibility and make the signature
        // unique. Appendix F in the Ethereum Yellow paper (https://ethereum.github.io/yellowpaper/paper.pdf), defines
        // the valid range for s in (281): 0 < s < secp256k1n ÷ 2 + 1, and for v in (282): v ∈ {27, 28}. Most
        // signatures from current libraries generate a unique signature with an s-value in the lower half order.
        //
        // If your library generates malleable signatures, such as s-values in the upper range, calculate a new s-value
        // with 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141 - s1 and flip v from 27 to 28 or
        // vice versa. If your library also generates signatures with 0/1 for v instead 27/28, add 27 to v to accept
        // these malleable signatures as well.
        require(
            uint256(s) <=
                0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0,
            "HermezHelpers::_checkSig: INVALID_S_VALUE"
        );

        bytes32 encodeData = keccak256(
            abi.encode(
                AUTHORISE_TYPEHASH,
                HERMEZ_NETWORK_HASH,
                ACCOUNT_CREATION_HASH,
                babyjub
            )
        );

        bytes32 messageDigest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), encodeData)
        );

        address ethAddress = ecrecover(messageDigest, v, r, s);

        require(
            ethAddress != address(0),
            "HermezHelpers::_checkSig: INVALID_SIGNATURE"
        );

        return ethAddress;
    }

    /**
     * @dev return information from specific call data info
     * @param posParam parameter number relative to 0 to extract the info
     * @return ptr ptr to the call data position where the actual data starts
     * @return len Length of the data
     */
    function _getCallData(uint256 posParam)
        internal
        pure
        returns (uint256 ptr, uint256 len)
    {
        assembly {
            let pos := add(4, mul(posParam, 32))
            ptr := add(calldataload(pos), 4)
            len := calldataload(ptr)
            ptr := add(ptr, 32)
        }
    }

    /**
     * @dev This package fills at least len zeros in memory and a maximum of len+31
     * @param ptr The position where it starts to fill zeros
     * @param len The minimum quantity of zeros it's added
     */
    function _fillZeros(uint256 ptr, uint256 len) internal pure {
        assembly {
            let ptrTo := ptr
            ptr := add(ptr, len)
            for {

            } lt(ptrTo, ptr) {
                ptrTo := add(ptrTo, 32)
            } {
                mstore(ptrTo, 0)
            }
        }
    }

    /**
     * @dev Copy 'len' bytes from memory address 'src', to address 'dest'.
     * From https://github.com/GNSPS/solidity-bytes-utils/blob/master/contracts/BytesLib.sol
     * @param _preBytes bytes storage
     * @param _postBytes Bytes array memory
     */
    function _concatStorage(bytes storage _preBytes, bytes memory _postBytes)
        internal
    {
        assembly {
            // Read the first 32 bytes of _preBytes storage, which is the length
            // of the array. (We don't need to use the offset into the slot
            // because arrays use the entire slot.)
            let fslot := sload(_preBytes_slot)
            // Arrays of 31 bytes or less have an even value in their slot,
            // while longer arrays have an odd value. The actual length is
            // the slot divided by two for odd values, and the lowest order
            // byte divided by two for even values.
            // If the slot is even, bitwise and the slot with 255 and divide by
            // two to get the length. If the slot is odd, bitwise and the slot
            // with -1 and divide by two.
            let slength := div(
                and(fslot, sub(mul(0x100, iszero(and(fslot, 1))), 1)),
                2
            )
            let mlength := mload(_postBytes)
            let newlength := add(slength, mlength)
            // slength can contain both the length and contents of the array
            // if length < 32 bytes so let's prepare for that
            // v. http://solidity.readthedocs.io/en/latest/miscellaneous.html#layout-of-state-variables-in-storage
            switch add(lt(slength, 32), lt(newlength, 32))
                case 2 {
                    // Since the new array still fits in the slot, we just need to
                    // update the contents of the slot.
                    // uint256(bytes_storage) = uint256(bytes_storage) + uint256(bytes_memory) + new_length
                    sstore(
                        _preBytes_slot,
                        // all the modifications to the slot are inside this
                        // next block
                        add(
                            // we can just add to the slot contents because the
                            // bytes we want to change are the LSBs
                            fslot,
                            add(
                                mul(
                                    div(
                                        // load the bytes from memory
                                        mload(add(_postBytes, 0x20)),
                                        // zero all bytes to the right
                                        exp(0x100, sub(32, mlength))
                                    ),
                                    // and now shift left the number of bytes to
                                    // leave space for the length in the slot
                                    exp(0x100, sub(32, newlength))
                                ),
                                // increase length by the double of the memory
                                // bytes length
                                mul(mlength, 2)
                            )
                        )
                    )
                }
                case 1 {
                    // The stored value fits in the slot, but the combined value
                    // will exceed it.
                    // get the keccak hash to get the contents of the array
                    mstore(0x0, _preBytes_slot)
                    let sc := add(keccak256(0x0, 0x20), div(slength, 32))

                    // save new length
                    sstore(_preBytes_slot, add(mul(newlength, 2), 1))

                    // The contents of the _postBytes array start 32 bytes into
                    // the structure. Our first read should obtain the `submod`
                    // bytes that can fit into the unused space in the last word
                    // of the stored array. To get this, we read 32 bytes starting
                    // from `submod`, so the data we read overlaps with the array
                    // contents by `submod` bytes. Masking the lowest-order
                    // `submod` bytes allows us to add that value directly to the
                    // stored value.

                    let submod := sub(32, slength)
                    let mc := add(_postBytes, submod)
                    let end := add(_postBytes, mlength)
                    let mask := sub(exp(0x100, submod), 1)

                    sstore(
                        sc,
                        add(
                            and(
                                fslot,
                                0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00
                            ),
                            and(mload(mc), mask)
                        )
                    )

                    for {
                        mc := add(mc, 0x20)
                        sc := add(sc, 1)
                    } lt(mc, end) {
                        sc := add(sc, 1)
                        mc := add(mc, 0x20)
                    } {
                        sstore(sc, mload(mc))
                    }

                    mask := exp(0x100, sub(mc, end))

                    sstore(sc, mul(div(mload(mc), mask), mask))
                }
                default {
                    // get the keccak hash to get the contents of the array
                    mstore(0x0, _preBytes_slot)
                    // Start copying to the last used word of the stored array.
                    let sc := add(keccak256(0x0, 0x20), div(slength, 32))

                    // save new length
                    sstore(_preBytes_slot, add(mul(newlength, 2), 1))

                    // Copy over the first `submod` bytes of the new data as in
                    // case 1 above.
                    let slengthmod := mod(slength, 32)
                    let mlengthmod := mod(mlength, 32)
                    let submod := sub(32, slengthmod)
                    let mc := add(_postBytes, submod)
                    let end := add(_postBytes, mlength)
                    let mask := sub(exp(0x100, submod), 1)

                    sstore(sc, add(sload(sc), and(mload(mc), mask)))

                    for {
                        sc := add(sc, 1)
                        mc := add(mc, 0x20)
                    } lt(mc, end) {
                        sc := add(sc, 1)
                        mc := add(mc, 0x20)
                    } {
                        sstore(sc, mload(mc))
                    }

                    mask := exp(0x100, sub(mc, end))

                    sstore(sc, mul(div(mload(mc), mask), mask))
                }
        }
    }

    /**
     * @dev Calculate the circuit input hashing all the elements
     * @param sender tx sender
     * @param stateRoot state root
     * @param tokenIDs list token ids to withdraw
     * @param amountWithdraws list amounts to withdraw
     * @param idxs list idxs to withdraw
     * @param nWithdraws number of tokens to withdraw
     * @return circuit input
     */
    function _getInputWithdraw(
        address sender,
        uint256 stateRoot,
        uint32[] memory tokenIDs,
        uint192[] memory amountWithdraws,
        uint48[] memory idxs,
        uint256 nWithdraws
    ) internal pure returns (uint256) {
        bytes memory inputBytes;

        uint256 ptr; // Position for writing the buffer

        assembly {
            let inputBytesLength := add(
                add(add(add(32, 20), mul(4, nWithdraws)), mul(24, nWithdraws)),
                mul(6, nWithdraws)
            )

            // Set inputBytes to the next free memory space
            inputBytes := mload(0x40)
            // Reserve the memory. 32 for the length , the input bytes and 32
            // extra bytes at the end for word manipulation
            mstore(0x40, add(add(inputBytes, 0x40), inputBytesLength))

            // Set the actual length of the input bytes
            mstore(inputBytes, inputBytesLength)
            // Set The Ptr at the begining of the inputPubber
            ptr := add(inputBytes, 32)

            mstore(ptr, stateRoot)
            ptr := add(ptr, 32)

            mstore(ptr, shl(96, sender)) // 256 - 20*8 = 96
            ptr := add(ptr, 20)
        }

        for (uint256 i = 0; i < nWithdraws; i++) {
            uint32 tokenID = tokenIDs[i];
            assembly {
                mstore(ptr, shl(224, tokenID)) // 256 - 4*8 = 224
                ptr := add(ptr, 4)
            }
        }
        for (uint256 i = 0; i < nWithdraws; i++) {
            uint192 amountWithdraw = amountWithdraws[i];
            assembly {
                mstore(ptr, shl(64, amountWithdraw)) // 256 - 24*8 = 64
                ptr := add(ptr, 24)
            }
        }
        for (uint256 i = 0; i < nWithdraws; i++) {
            uint48 idx = idxs[i];
            assembly {
                mstore(ptr, shl(208, idx)) // 256 - 6*8 = 208
                ptr := add(ptr, 6)
            }
        }
        return uint256(sha256(inputBytes));
    }
}
