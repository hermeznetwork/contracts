// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.6.12;

import "../../interfaces/VerifierRollupInterface.sol";

contract VerifierMock is VerifierRollupInterface {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[1] calldata input
    ) public override view returns (bool) {
        return true;
    }
}
