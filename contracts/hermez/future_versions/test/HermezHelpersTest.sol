// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.6.12;

import "../lib/HermezHelpersV2.sol";

contract HermezHelpersTestV2 is HermezHelpersV2 {
    constructor() public {}

    function float2FixTest(uint40 float) public pure returns (uint256) {
        return _float2Fix(float);
    }

    function checkSigTest(
        bytes32 babyjub,
        bytes32 r,
        bytes32 s,
        uint8 v
    ) public view returns (address) {
        return _checkSig(babyjub, r, s, v);
    }
}