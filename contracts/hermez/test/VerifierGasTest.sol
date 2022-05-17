// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.6.12;
import "../interfaces/VerifierRollupInterface.sol";

contract VerifierGasTest {
    VerifierRollupInterface verifier;

    constructor (address _verifier) public {
        verifier = VerifierRollupInterface(_verifier);
    }

    function gasVerifier(
        uint256[2] calldata proofA,
        uint256[2][2] calldata proofB,
        uint256[2] calldata proofC,
        uint256[1] calldata input
    ) public view returns (uint256){
        uint256 gasFirst = gasleft();
        verifier.verifyProof(
            proofA,
            proofB,
            proofC,
            input
        );
        return (gasFirst - gasleft());
    }
}
