// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.6.12;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "../interfaces/IHermez.sol";
import "../interfaces/VerifierRollupInterface.sol";
import "../Hermez.sol";

/**
 * @dev Rollup helper functions
 */
contract HermezMigration is Initializable, Hermez {
    // token migration information
    struct migrationAccountInfo {
        uint48 migrationIndex; // account index of the migration account in the origin rollup
        bool pendingIndexVerification; // true if the index is already verified
        uint32 lastBatchWithdrawed; // last batch where a withdrawn was done
        bool pendingWithdraw; // true if there's a pending withdraw
    }

    // Mapping token address with the information of the migration account
    mapping(address => migrationAccountInfo) public tokenMigrationMap;

    // Mapping of processed batches
    // migrationIndex => (batchNum => true/false)
    mapping(uint48 => mapping(uint48 => bool)) public batchNullifierMap;

    // Hermez interface
    IHermez public hermezOrigin;

    // index verifier interface
    VerifierRollupInterface public indexVerifier;

    // migration verifier interface
    VerifierRollupInterface public migrationVerifier;

    uint256 constant _MAX_INT = 2**256 - 1;

    /**
     * @dev Initialize Hermez migration
     */
    function _initializeHermezMigration(
        address _hermezOrigin,
        address _indexVerifier,
        address _migrationVerifier,
        address[] memory _verifiers,
        uint256[] memory _verifiersParams,
        address _withdrawVerifier,
        address _hermezAuctionContract,
        address _tokenHEZ,
        uint8 _forgeL1L2BatchTimeout,
        uint256 _feeAddToken,
        address _poseidon2Elements,
        address _poseidon3Elements,
        address _poseidon4Elements,
        address _hermezGovernanceAddress,
        uint64 _withdrawalDelay,
        address _withdrawDelayerContract
    ) internal initializer {
        hermezOrigin = IHermez(_hermezOrigin);
        indexVerifier = VerifierRollupInterface(_indexVerifier);
        migrationVerifier = VerifierRollupInterface(_migrationVerifier);

        // initialize hermez:
        initializeHermez(
            _verifiers,
            _verifiersParams,
            _withdrawVerifier,
            _hermezAuctionContract,
            _tokenHEZ,
            _forgeL1L2BatchTimeout,
            _feeAddToken,
            _poseidon2Elements,
            _poseidon3Elements,
            _poseidon4Elements,
            _hermezGovernanceAddress,
            _withdrawalDelay,
            _withdrawDelayerContract
        );
    }

    /**
     * @dev Create a migration account in the origin hermez
     * @param tokenAddress token address
     */
    function createMigrationAccount(address tokenAddress) public {
        require(
            tokenMigrationMap[tokenAddress].migrationIndex == 0,
            "MIGRATION::createMigrationAccount: ACCOUNT_ALREADY_VERIFIED"
        );
        require(
            !tokenMigrationMap[tokenAddress].pendingIndexVerification,
            "MIGRATION::createMigrationAccount: ACCOUNT_ALREADY_CREATED"
        );
        uint32 originTokenId = uint32(hermezOrigin.tokenMap(tokenAddress));
        if (tokenAddress != address(0)) {
            require(
                originTokenId != 0,
                "MIGRATION::createMigrationAccount: TOKEN_NOT_ADDED_IN_ORIGIN_ROLLUP"
            );
        }
        hermezOrigin.addL1Transaction(
            _MAX_INT, // uint256 babyPubKey,
            0, //  uint48 fromIdx,
            0, // uint40 loadAmountF,
            0, // uint40 amountF,
            originTokenId, // uint32 tokenID,
            0, // uint48 toIdx,
            new bytes(0) // bytes permit
        );

        tokenMigrationMap[tokenAddress].pendingIndexVerification = true;
    }

    /**
     * @dev Verify the index of a migration account
     * @param newIdx account index
     * @param batchNum batch number
     * @param amount Amount at `batchNum` batch
     * @param tokenAddress token address
     * @param proofA zk-snark input
     * @param proofB zk-snark input
     * @param proofC zk-snark input
     */
    function setIdx(
        uint48 newIdx,
        uint32 batchNum,
        uint192 amount,
        address tokenAddress,
        uint256[2] calldata proofA,
        uint256[2][2] calldata proofB,
        uint256[2] calldata proofC
    ) public {
        require(
            tokenMigrationMap[tokenAddress].pendingIndexVerification,
            "MIGRATION::createMigrationAccount: ACCOUNT_MUST_BE_PENDING"
        );

        uint32 originTokenId = uint32(hermezOrigin.tokenMap(tokenAddress));
        uint256 input = uint256(
            sha256(
                abi.encodePacked(
                    hermezOrigin.stateRootMap(batchNum), // state root after `batchNum`
                    address(this), // eth address
                    originTokenId, // tokenID,
                    amount, // Amount at `batchNum` batch
                    newIdx
                )
            )
        ) % _RFIELD;

        require(
            indexVerifier.verifyProof(proofA, proofB, proofC, [input]) == true,
            "INVALID_ZK_PROOF"
        );

        tokenMigrationMap[tokenAddress].migrationIndex = newIdx;
        tokenMigrationMap[tokenAddress].pendingIndexVerification = false;
    }

    /**
     * @dev Perform an exit from a certain token address
     * @param tokenAddress token address
     */
    function doExit(address tokenAddress) public {
        uint48 migrationIndex = tokenMigrationMap[tokenAddress].migrationIndex;
        require(migrationIndex != 0, "MIGRATION::doExit: ACCOUNT_NOT_VERIFIED");
        require(
            tokenMigrationMap[tokenAddress].pendingWithdraw,
            "MIGRATION::doExit: ONLY_ONE_CONCURRENT_EXIT"
        );

        uint32 originTokenId = uint32(hermezOrigin.tokenMap(tokenAddress));

        hermezOrigin.addL1Transaction(
            0, // uint256 babyPubKey,
            migrationIndex, //  uint48 fromIdx,
            0, // uint40 loadAmountF,
            0, // uint40 amountF,
            originTokenId, // uint32 tokenID,
            1, // uint48 toIdx,
            new bytes(0) // bytes permit
        );
        tokenMigrationMap[tokenAddress].pendingWithdraw = true;
    }

    /**
     * @dev Perform a withdraw form a pending exit
     * @param batchNum batch number
     * @param amount Amount at `batchNum` batch
     * @param tokenAddress token address
     * @param proofA zk-snark input
     * @param proofB zk-snark input
     * @param proofC zk-snark input
     */
    function doWithdraw(
        uint32 batchNum,
        uint192 amount,
        address tokenAddress,
        uint256[2] calldata proofA,
        uint256[2][2] calldata proofB,
        uint256[2] calldata proofC
    ) public {
        uint48 migrationIndex = tokenMigrationMap[tokenAddress].migrationIndex;
        require(
            tokenMigrationMap[tokenAddress].pendingWithdraw,
            "MIGRATION::doWithdraw: WITHDRAW_NOT_PENDING"
        );
        uint32 originTokenId = uint32(hermezOrigin.tokenMap(tokenAddress));

        if (hermezOrigin.instantWithdrawalViewer(tokenAddress, amount)) {
            hermezOrigin.withdrawCircuit(
                proofA, // uint256[2] calldata proofA,
                proofB, // uint256[2][2] calldata proofB,
                proofC, // uint256[2] calldata proofC,
                originTokenId, // uint32 tokenID
                amount, // uint192 mount
                batchNum, // uint32 numExitRoot,
                migrationIndex, // Index to withdraw
                true // instant withdraw
            );
        } else {
            hermezOrigin.withdrawCircuit(
                proofA, // uint256[2] calldata proofA,
                proofB, // uint256[2][2] calldata proofB,
                proofC, // uint256[2] calldata proofC,
                originTokenId, // uint32 tokenID
                amount, // uint192 mount
                batchNum, // uint32 numExitRoot,
                migrationIndex, // Index to withdraw
                false // instant withdraw
            );
        }
        tokenMigrationMap[tokenAddress].lastBatchWithdrawed = batchNum;
        tokenMigrationMap[tokenAddress].pendingWithdraw = false;
    }

    /**
     * @dev Update the state root migrating one batch from the origin rollup
     * @param batchNum batch number
     * @param newStRoot new state root
     * @param tokenAddress token address
     * @param proofA zk-snark input
     * @param proofB zk-snark input
     * @param proofC zk-snark input
     */
    function migrate(
        uint32 batchNum,
        uint48 newLastIdx,
        uint256 newStRoot,
        address tokenAddress,
        uint256[2] calldata proofA,
        uint256[2][2] calldata proofB,
        uint256[2] calldata proofC
    ) public {
        // migration checks
        uint48 migrationIndex = tokenMigrationMap[tokenAddress].migrationIndex;
        require(
            !batchNullifierMap[migrationIndex][batchNum],
            "Batch already processed"
        );
        require(
            batchNum < tokenMigrationMap[tokenAddress].lastBatchWithdrawed,
            "Batch not withdrawed yet"
        );

        // forge Batch

        // ask the auction if this coordinator is allow to forge
        require(
            hermezAuctionContract.canForge(msg.sender, block.number) == true,
            "Hermez::forgeBatch: AUCTION_DENIED"
        );

        uint256 input = uint256(
            sha256(
                abi.encodePacked(
                    newLastIdx,
                    stateRootMap[lastForgedBatch],
                    newStRoot,
                    hermezOrigin.l1L2TxsDataHashMap(batchNum),
                    hermezOrigin.stateRootMap(batchNum)
                )
            )
        ) % _RFIELD;

        require(
            migrationVerifier.verifyProof(proofA, proofB, proofC, [input]) ==
                true,
            "INVALID_ZK_PROOF"
        );

        // update state
        lastForgedBatch++;
        lastIdx = newLastIdx;
        stateRootMap[lastForgedBatch] = newStRoot;
        exitRootsMap[lastForgedBatch] = 0;
        l1L2TxsDataHashMap[lastForgedBatch] = 0;

        // auction must be aware that a batch is being forged
        hermezAuctionContract.forge(msg.sender);

        batchNullifierMap[migrationIndex][batchNum] = true;

        uint16 l1UserTxsLen = 0;
        emit ForgeBatch(lastForgedBatch, l1UserTxsLen);
    }
}
