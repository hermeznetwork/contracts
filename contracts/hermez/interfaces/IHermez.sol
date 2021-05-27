// SPDX-License-Identifier: AGPL-3.0

interface IHermez {
    /**
     * @dev Create a new rollup l1 user transaction
     * @param babyPubKey Public key babyjubjub represented as point: sign + (Ay)
     * @param fromIdx Index leaf of sender account or 0 if create new account
     * @param loadAmountF Amount from L1 to L2 to sender account or new account
     * @param amountF Amount transfered between L2 accounts
     * @param tokenID Token identifier
     * @param toIdx Index leaf of recipient account, or _EXIT_IDX if exit, or 0 if not transfer
     * Events: `L1UserTxEvent`
     */
    function addL1Transaction(
        uint256 babyPubKey,
        uint48 fromIdx,
        uint40 loadAmountF,
        uint40 amountF,
        uint32 tokenID,
        uint48 toIdx,
        bytes calldata permit
    ) external payable;

    // Mapping addres of the token, with the tokenID associated
    function tokenMap(address tokenAddress) external view returns (uint256);

    // Each batch forged will have a correlated 'state root'
    function stateRootMap(uint32 batchNum) external view returns (uint256);

    // Each batch forged will have a correlated 'l1L2TxDataHash'
    function l1L2TxsDataHashMap(uint32 batchNum)
        external
        view
        returns (bytes32);

    /**
     * @dev Withdraw to retrieve the tokens from the exit tree to the owner account
     * Before this call an exit transaction must be done
     * @param proofA zk-snark input
     * @param proofB zk-snark input
     * @param proofC zk-snark input
     * @param tokenID Token identifier
     * @param amount Amount to retrieve
     * @param numExitRoot Batch number where the exit transaction has been done
     * @param idx Index of the exit tree account
     * @param instantWithdraw true if is an instant withdraw
     * Events: `WithdrawEvent`
     */
    function withdrawCircuit(
        uint256[2] calldata proofA,
        uint256[2][2] calldata proofB,
        uint256[2] calldata proofC,
        uint32 tokenID,
        uint192 amount,
        uint32 numExitRoot,
        uint48 idx,
        bool instantWithdraw
    ) external;

    /**
     * @dev Return true if a instant withdraw could be done with that 'tokenAddress' and 'amount'
     * @param tokenAddress Token address
     * @param amount Amount to withdraw
     * @return true if the instant withdrawal is allowed
     */
    function instantWithdrawalViewer(address tokenAddress, uint192 amount)
        external
        returns (bool);
}
