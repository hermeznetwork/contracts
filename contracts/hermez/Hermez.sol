// SPDX-License-Identifier: AGPL-3.0

pragma solidity 0.6.12;

import "./lib/InstantWithdrawManager.sol";
import "./interfaces/VerifierRollupInterface.sol";
import "./interfaces/VerifierWithdrawInterface.sol";
import "./interfaces/AuctionInterface.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";

contract Hermez is InstantWithdrawManager, IERC777Recipient {
    struct VerifierRollup {
        VerifierRollupInterface verifierInterface;
        uint256 maxTx; // maximum rollup transactions in a batch: L2-tx + L1-tx transactions
        uint256 nLevels; // number of levels of the circuit
    }

    // ERC777 recipient interface hash
    bytes32 constant _ERC777_RECIPIENT_INTERFACE_HASH = keccak256(
        "ERC777TokensRecipient"
    );

    // When this contract recept an ERC777 tokens, the tokensReceived method is iked.
    // The field data is used to determine wich function is called.
    // We codify the call exactly the same way that ethereum does for a normal call.
    // The tokenReceipt method will parse this data and call the corresponding method to do the action
    // Here we define the signatures of the functions that can be called thru an ERC777 `send`
    bytes4 constant _PERFORM_L1_USER_TX_SIGNATURE = bytes4(
        keccak256(
            "addL1Transaction(uint256,uint48,uint16,uint16,uint32,uint48)"
        )
    );
    bytes4 constant _ADD_TOKEN_SIGNATURE = bytes4(
        keccak256("addToken(address)")
    );

    // Erc20 signatures:
    // This constants are used in the _safeTransfer internal method in order to safe GAS.
    bytes4 constant _TRANSFER_SIGNATURE = bytes4(
        keccak256(bytes("transfer(address,uint256)"))
    );
    bytes4 constant _TRANSFER_FROM_SIGNATURE = bytes4(
        keccak256(bytes("transferFrom(address,address,uint256)"))
    );
    bytes4 constant _APPROVE_SIGNATURE = bytes4(
        keccak256(bytes("approve(address,uint256)"))
    );

    // Erc777 signatures:
    bytes4 constant _SEND_SIGNATURE = bytes4(
        keccak256(bytes("send(address,uint256,bytes)"))
    );
    bytes4 private constant _ERC777_GRANULARITY = bytes4(
        keccak256(bytes("granularity()"))
    );

    // This constant are used to deposit tokens from ERC77 tokens into withdrawal delayer
    bytes4 constant _WITHDRAWAL_DELAYER_DEPOSIT = bytes4(
        keccak256(bytes("deposit(address,address,uint192)"))
    );

    // First 256 indexes reserved, first user index will be the 256
    uint48 constant _RESERVED_IDX = 255;

    // IDX 1 is reserved for exits
    uint48 constant _EXIT_IDX = 1;

    // Max load amount allowed (loadAmount: L1 --> L2)
    uint256 constant _LIMIT_LOAD_AMOUNT = (1 << 128);

    // Max amount allowed (amount L2 --> L2)
    uint256 constant _LIMIT_L2TRANSFER_AMOUNT = (1 << 192);

    // Max number of tokens allowed to be registered inside the rollup
    uint256 constant _LIMIT_TOKENS = (1 << 32);

    // [4 bytes] token + [32 bytes] babyjub + [65 bytes] compressedSignature
    uint256 constant _L1_COORDINATOR_TOTALBYTES = 101;

    // [20 bytes] fromEthAddr + [32 bytes] fromBjj-compressed + [6 bytes] fromIdx +
    // [2 bytes] loadAmountFloat16 + [2 bytes] amountFloat16 + [4 bytes] tokenId + [6 bytes] toIdx
    uint256 constant _L1_USER_TOTALBYTES = 72;

    // User TXs are the TX made by the user with a L1 TX
    // Coordinator TXs are the L2 account creation made by the coordinator whose signature
    // needs to be verified in L1.
    // The maximum number of L1-user TXs and L1-coordinartor-TX is limited by the _MAX_L1_TX
    // And the maximum User TX is _MAX_L1_USER_TX

    // Maximum L1-user transactions allowed to be queued in a batch
    uint256 constant _MAX_L1_USER_TX = 128;

    // Maximum L1 transactions allowed to be queued in a batch
    uint256 constant _MAX_L1_TX = 256;

    // Modulus zkSNARK
    uint256 constant _RFIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // [6 bytes] lastIdx + [6 bytes] newLastIdx  + [32 bytes] stateRoot  + [32 bytes] newStRoot  + [32 bytes] newExitRoot +
    // [_MAX_L1_TX * _L1_USER_TOTALBYTES bytes] l1TxsData + totalL2TxsDataLength + feeIdxCoordinatorLength + [2 bytes] chainID =
    // 18542 bytes +  totalL2TxsDataLength + feeIdxCoordinatorLength

    uint256 constant _INPUT_SHA_CONSTANT_BYTES = 18542;

    uint8 public constant ABSOLUTE_MAX_L1L2BATCHTIMEOUT = 240;

    // This ethereum address is used internally for rollup accounts that don't have ethereum address, only Babyjubjub
    // This non-ethereum accounts can be created by the coordinator and allow users to have a rollup
    // account without needing an ethereum address
    address constant _ETH_ADDRESS_INTERNAL_ONLY = address(
        0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF
    );

    // Verifiers array
    VerifierRollup[] public rollupVerifiers;

    // Withdraw verifier interface
    VerifierWithdrawInterface public withdrawVerifier;

    // Last account index created inside the rollup
    uint48 public lastIdx;

    // Last batch forged
    uint64 public lastForgedBatch;

    // Each batch forged will have a correlated 'state root'
    mapping(uint64 => uint256) public stateRootMap;

    // Each batch forged will have a correlated 'exit tree' represented by the exit root
    mapping(uint64 => uint256) public exitRootsMap;

    // Mapping of exit nullifiers, only allowing each withdrawal to be made once
    // rootId => (Idx => true/false)
    mapping(uint64 => mapping(uint48 => bool)) public exitNullifierMap;

    // List of ERC20/ERC777 tokens that can be used in rollup
    // ID = 0 will be reserved for ether
    address[] public tokenList;

    // Mapping addres of the token, with the tokenID associated
    mapping(address => uint256) public tokenMap;

    // Fee for adding a new token to the rollup in HEZ tokens
    uint256 public feeAddToken;

    // Contract interface of the hermez auction
    AuctionInterface public hermezAuctionContract;

    // Map of queues of L1-user-tx transactions, the transactions are stored in bytes32 sequentially
    // The coordinator is forced to forge the next queue in the next L1-L2-batch
    mapping(uint64 => bytes) public mapL1TxQueue;

    // Ethereum block where the last L1-L2-batch was forged
    uint64 public lastL1L2Batch;

    // Queue index that will be forged in the next L1-L2-batch
    uint64 public nextL1ToForgeQueue;

    // Queue index wich will be filled with the following L1-User-Tx
    uint64 public nextL1FillingQueue;

    // Max ethereum blocks after the last L1-L2-batch, when exceeds the timeout only L1-L2-batch are allowed
    uint8 public forgeL1L2BatchTimeout;

    // HEZ token address
    address public tokenHEZ;

    // Event emitted when a L1-user transaction is called and added to the nextL1FillingQueue queue
    event L1UserTxEvent(
        uint64 indexed queueIndex,
        uint8 indexed position, // Position inside the queue where the TX resides
        bytes l1UserTx
    );

    // Event emitted when a new token is added
    event AddToken(address indexed tokenAddress, uint32 tokenID);

    // Event emitted every time a batch is forged
    event ForgeBatch(uint64 indexed batchNum);

    // Event emitted when the governance update the `forgeL1L2BatchTimeout`
    event UpdateForgeL1L2BatchTimeout(uint8 newForgeL1L2BatchTimeout);

    // Event emitted when the governance update the `feeAddToken`
    event UpdateFeeAddToken(uint256 newFeeAddToken);

    // Event emitted when a withdrawal is done
    event WithdrawEvent(
        uint48 indexed idx,
        uint48 indexed numExitRoot,
        bool indexed instantWithdraw
    );

    /**
     * @dev Initializer function (equivalent to the constructor). Since we use
     * upgradeable smartcontracts the state vars have to be initialized here.
     */
    function initializeHermez(
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
        address _hermezGovernanceDAOAddress,
        address _safetyAddress,
        uint64 _withdrawalDelay,
        address _withdrawDelayerContract
    ) external initializer {
        // set state variables
        _initializeVerifiers(_verifiers, _verifiersParams);
        withdrawVerifier = VerifierWithdrawInterface(_withdrawVerifier);
        hermezAuctionContract = AuctionInterface(_hermezAuctionContract);
        tokenHEZ = _tokenHEZ;
        forgeL1L2BatchTimeout = _forgeL1L2BatchTimeout;
        feeAddToken = _feeAddToken;

        // set default state variables
        lastIdx = _RESERVED_IDX;
        // lastL1L2Batch = 0 --> first batch forced to be L1Batch
        // nextL1ToForgeQueue = 0 --> First queue will be forged
        nextL1FillingQueue = 1;
        // stateRootMap[0] = 0 --> genesis batch will have root = 0
        tokenList.push(address(0)); // Token 0 is ETH
        // register interface for ERC777 send
        _ERC1820.setInterfaceImplementer(
            address(this),
            _ERC777_RECIPIENT_INTERFACE_HASH,
            address(this)
        );
        // _acceptERC777Tokens = false --> don't accept ERC777 tokens unauthorized

        // initialize libs
        _initializeHelpers(
            _poseidon2Elements,
            _poseidon3Elements,
            _poseidon4Elements
        );
        _initializeWithdraw(
            _hermezGovernanceDAOAddress,
            _safetyAddress,
            _withdrawalDelay,
            _withdrawDelayerContract
        );
    }

    //////////////
    // Coordinator operations
    /////////////

    /**
     * @dev Checks proof given by the coordinator
     * Forge a batch if successful update state root and add a new exit root
     * @param newLastIdx New total rollup accounts
     * @param newStRoot New state root
     * @param newExitRoot New exit root
     * @param encodedL1CoordinatorTx Encoded L1-coordinator transactions
     * @param l2TxsData Encoded l2 data
     * @param feeIdxCoordinator Encoded idx accounts of the coordinator where the fees will be payed
     * @param verifierIdx Verifier index
     * @param l1Batch Indicates if this batch will be L2 or L1-L2
     * @param proofA zk-snark input
     * @param proofB zk-snark input
     * @param proofC zk-snark input
     * Events: `ForgeBatch`
     */
    function forgeBatch(
        uint48 newLastIdx,
        uint256 newStRoot,
        uint256 newExitRoot,
        bytes calldata encodedL1CoordinatorTx,
        bytes calldata l2TxsData,
        bytes calldata feeIdxCoordinator,
        uint8 verifierIdx,
        bool l1Batch,
        uint256[2] calldata proofA,
        uint256[2][2] calldata proofB,
        uint256[2] calldata proofC
    ) external virtual {
        // Assure data availability from regular ethereum nodes
        // We include this line because it's easier to track the transaction data, as it will never be in an internal TX.
        // In general this makes no sense, as callling this function from another smart contract will have to pay the calldata twice.
        // But forcing, it avoids having to check.
        require(
            msg.sender == tx.origin,
            "forgeBatch can't be called as a internal transaction"
        );

        // ask the auction if this coordinator is allow to forge
        require(
            hermezAuctionContract.canForge(msg.sender, block.number) == true,
            "auction denied the forge"
        );

        if (!l1Batch) {
            require(
                block.number < (lastL1L2Batch + forgeL1L2BatchTimeout), // No overflow since forgeL1L2BatchTimeout is an uint8
                "L1L2Batch required"
            );
        }

        // calculate input
        uint256 input = _constructCircuitInput(
            newLastIdx,
            newStRoot,
            newExitRoot,
            l1Batch,
            verifierIdx
        );

        // verify proof
        require(
            rollupVerifiers[verifierIdx].verifierInterface.verifyProof(
                proofA,
                proofB,
                proofC,
                [input]
            ),
            "invalid rollup proof"
        );

        // update state
        lastForgedBatch++;
        lastIdx = newLastIdx;
        stateRootMap[lastForgedBatch] = newStRoot;
        exitRootsMap[lastForgedBatch] = newExitRoot;

        if (l1Batch) {
            // restart the timeout
            lastL1L2Batch = uint64(block.number);
            // clear current queue
            _clearQueue();
        }

        // auction must be aware that a batch is being forged
        hermezAuctionContract.forge(msg.sender);

        emit ForgeBatch(lastForgedBatch);
    }

    //////////////
    // User L1 rollup tx
    /////////////

    // This are all the possible L1-User transactions:
    // | fromIdx | toIdx | loadAmountF | amountF | tokenID(SC) | babyPubKey |           l1-user-TX            |
    // |:-------:|:-----:|:-----------:|:-------:|:-----------:|:----------:|:-------------------------------:|
    // |    0    |   0   |      0      |  0(SC)  |      X      |  !=0(SC)   |          createAccount          |
    // |    0    |   0   |     !=0     |  0(SC)  |      X      |  !=0(SC)   |      createAccountDeposit       |
    // |    0    |   1   |      X      |    X    |      X      |  !=0(SC)   |   createAccountDepositAndExit   |
    // |    0    | 255+  |      X      |    X    |      X      |  !=0(SC)   | createAccountDepositAndTransfer |
    // |  255+   |   0   |      X      |  0(SC)  |      X      |   0(SC)    |             Deposit             |
    // |  255+   |   1   |      0      |    X    |      X      |   0(SC)    |              Exit               |
    // |  255+   |   1   |     !=0     |    X    |      X      |   0(SC)    |         DepositAndExit          |
    // |  255+   | 255+  |      0      |    X    |      X      |   0(SC)    |            Transfer             |
    // |  255+   | 255+  |     !=0     |    X    |      X      |   0(SC)    |       DepositAndTransfer        |
    // As can be seen in the table the type of transaction is determined basically by the "fromIdx" and "toIdx"
    // The 'X' means that can be any valid value and does not change the l1-user-tx type
    // Other parameters must be consistent, for example, if toIdx is 0, amountF must be 0, because there's no L2 transfer

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
        uint16 loadAmountF,
        uint16 amountF,
        uint32 tokenID,
        uint48 toIdx
    ) external payable {
        // check tokenID
        require(tokenID < tokenList.length, "token has not been registered");

        // check loadAmount
        uint256 loadAmount = _float2Fix(loadAmountF);
        require(
            loadAmount < _LIMIT_LOAD_AMOUNT,
            "deposit amount larger than limit"
        );

        // deposit token or ether
        if (loadAmount > 0) {
            if (tokenID == 0) {
                require(loadAmount == msg.value, "loadAmount != msg.value");
            } else {
                _safeTransferFrom(
                    tokenList[tokenID],
                    msg.sender,
                    address(this),
                    loadAmount
                );
            }
        }

        // perform L1 User Tx
        _addL1Transaction(
            msg.sender,
            babyPubKey,
            fromIdx,
            loadAmountF,
            amountF,
            tokenID,
            toIdx
        );
    }

    /**
     * @dev Create a new rollup l1 user transaction
     * @param ethAddress Ethereum addres of the sender account or new account
     * @param babyPubKey Public key babyjubjub represented as point: sign + (Ay)
     * @param fromIdx Index leaf of sender account or 0 if create new account
     * @param loadAmountF Amount from L1 to L2 to sender account or new account
     * @param amountF Amount transfered between L2 accounts
     * @param tokenID Token identifier
     * @param toIdx Index leaf of recipient account, or _EXIT_IDX if exit, or 0 if not transfer
     * Events: `L1UserTxEvent`
     */
    function _addL1Transaction(
        address ethAddress,
        uint256 babyPubKey,
        uint48 fromIdx,
        uint16 loadAmountF,
        uint16 amountF,
        uint32 tokenID,
        uint48 toIdx
    ) internal {
        uint256 amount = _float2Fix(amountF);
        require(amount < _LIMIT_L2TRANSFER_AMOUNT, "amount larger than limit");

        // toIdx can be: 0, _EXIT_IDX or (toIdx > _RESERVED_IDX)
        if (toIdx == 0) {
            require((amount == 0), "amount must be 0 if toIdx is 0");
        } else {
            require(
                ((toIdx > _RESERVED_IDX) && (toIdx <= lastIdx)) ||
                    (toIdx == _EXIT_IDX),
                "invalid toIdx"
            );
        }
        // fromIdx can be: 0 if create account or (fromIdx > _RESERVED_IDX)
        if (fromIdx == 0) {
            require(
                babyPubKey != 0,
                "can't create account with babyPubKey = 0"
            );
        } else {
            require(
                (fromIdx > _RESERVED_IDX) && (fromIdx <= lastIdx),
                "invalid fromIdx"
            );
            require(
                babyPubKey == 0,
                "babyPubKey must be 0 if use existing account"
            );
        }

        _l1QueueAddTx(
            ethAddress,
            babyPubKey,
            fromIdx,
            loadAmountF,
            amountF,
            tokenID,
            toIdx
        );
    }

    //////////////
    // User operations
    /////////////

    /**
     * @dev Withdraw to retrieve the tokens from the exit tree to the owner account
     * Before this call an exit transaction must be done
     * @param tokenID Token identifier
     * @param amount Amount to retrieve
     * @param babyPubKey Public key babyjubjub represented as point: sign + (Ay)
     * @param numExitRoot Batch number where the exit transaction has been done
     * @param siblings Siblings to demonstrate merkle tree proof
     * @param idx Index of the exit tree account
     * @param instantWithdraw true if is an instant withdraw
     * Events: `WithdrawEvent`
     */
    function withdrawMerkleProof(
        uint32 tokenID,
        uint192 amount,
        uint256 babyPubKey,
        uint48 numExitRoot,
        uint256[] memory siblings,
        uint48 idx,
        bool instantWithdraw
    ) external {
        // numExitRoot is not checked because an invalid numExitRoot will bring to a 0 root
        // and this is an empty tree.
        // in case of instant withdraw assure that is available
        if (instantWithdraw) {
            require(
                _processInstantWithdrawal(tokenList[tokenID], amount),
                "instant withdrawals wasted for this USD range"
            );
        }

        // build 'key' and 'value' for exit tree
        uint256[] memory arrayState = _buildTreeState(
            tokenID,
            0,
            amount,
            babyPubKey,
            msg.sender
        );
        uint256 stateHash = _hash4Elements(arrayState);
        // get exit root given its index depth
        uint256 exitRoot = exitRootsMap[numExitRoot];
        // check exit tree nullifier
        require(
            exitNullifierMap[numExitRoot][idx] == false,
            "withdraw has been already done"
        );
        // check sparse merkle tree proof
        require(
            _smtVerifier(exitRoot, siblings, idx, stateHash) == true,
            "smt proof invalid"
        );

        // set nullifier
        exitNullifierMap[numExitRoot][idx] = true;

        _withdrawFunds(amount, tokenID, instantWithdraw);

        emit WithdrawEvent(idx, numExitRoot, instantWithdraw);
    }

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
        uint48 numExitRoot,
        uint48 idx,
        bool instantWithdraw
    ) external {
        // in case of instant withdraw assure that is available
        if (instantWithdraw) {
            require(
                _processInstantWithdrawal(tokenList[tokenID], amount),
                "instant withdrawals wasted for this USD range"
            );
        }
        require(
            exitNullifierMap[numExitRoot][idx] == false,
            "withdraw has been already done"
        );

        // get exit root given its index depth
        uint256 exitRoot = exitRootsMap[numExitRoot];

        uint256 input = uint256(
            sha256(abi.encodePacked(exitRoot, msg.sender, tokenID, amount, idx))
        ) % _RFIELD;
        // verify zk-snark circuit
        require(
            withdrawVerifier.verifyProof(proofA, proofB, proofC, [input]) ==
                true,
            "zk-snark proof is not valid"
        );

        // set nullifier
        exitNullifierMap[numExitRoot][idx] = true;

        _withdrawFunds(amount, tokenID, instantWithdraw);

        emit WithdrawEvent(idx, numExitRoot, instantWithdraw);
    }

    //////////////
    // ERC777 tokensReceived
    /////////////
    /**
     * @notice function that is triggered every time this smartcontract receives HEZ tokens (ERC777)
     * @dev This function will process the l1tx deposits from ERC777 tokens or the addTokens functions
     * Use a ERC777 as a ERC20 using "approve" and "transferFrom" is not supported
     * @param operator - not used
     * @param from - not used
     * @param to - not used
     * @param amount the amount of tokens that have been sent
     * @param userData contains the raw call of the method to invoke (bid or multiBid)
     * @param operatorData - not used
     */
    function tokensReceived(
        // solhint-disable no-unused-vars
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata userData,
        bytes calldata operatorData
    ) external override {
        require(userData.length != 0, "Send ERC777 without data");
        // decode the signature
        bytes4 sig = abi.decode(userData, (bytes4));

        // perform a l1 user tx
        if (sig == _PERFORM_L1_USER_TX_SIGNATURE) {
            // Extract params
            (
                uint256 babyPubKey,
                uint48 fromIdx,
                uint16 loadAmountF,
                uint16 amountF,
                uint32 tokenID,
                uint48 toIdx
            ) = abi.decode(
                userData[4:],
                (uint256, uint48, uint16, uint16, uint32, uint48)
            );

            // check tokenID
            require(
                (tokenList[tokenID] == msg.sender),
                "token ID does not match"
            );

            uint256 granularity = _getGranularity(msg.sender);

            // check loadAmount, loadAmount will be send divided by the granularity
            if (loadAmountF != 0) {
                uint256 loadAmount = _float2Fix(loadAmountF);
                require(
                    loadAmount < _LIMIT_LOAD_AMOUNT,
                    "deposit amount larger than limit"
                );
                require(
                    loadAmount == amount / granularity,
                    "loadAmount != token amount"
                );
            }

            // perform L1 User Tx
            _addL1Transaction(
                from,
                babyPubKey,
                fromIdx,
                loadAmountF,
                amountF,
                tokenID,
                toIdx
            );
        } else if (sig == _ADD_TOKEN_SIGNATURE) {
            // handle addToken
            require((tokenHEZ == msg.sender), "must pay in HEZ");
            require((amount == feeAddToken), "not enough HEZ");
            _addToken(abi.decode(userData[4:], (address)));
        } else {
            revert("Not valid calldata");
        }
    }

    //////////////
    // Governance methods
    /////////////
    /**
     * @dev Update ForgeL1L2BatchTimeout
     * @param newForgeL1L2BatchTimeout New ForgeL1L2BatchTimeout
     * Events: `UpdateForgeL1L2BatchTimeout`
     */
    function updateForgeL1L2BatchTimeout(uint8 newForgeL1L2BatchTimeout)
        external
        onlyGovernance
    {
        require(
            newForgeL1L2BatchTimeout <= ABSOLUTE_MAX_L1L2BATCHTIMEOUT,
            "forge timeout exceded"
        );
        forgeL1L2BatchTimeout = newForgeL1L2BatchTimeout;
        emit UpdateForgeL1L2BatchTimeout(newForgeL1L2BatchTimeout);
    }

    /**
     * @dev Update feeAddToken
     * @param newFeeAddToken New feeAddToken
     * Events: `UpdateFeeAddToken`
     */
    function updateFeeAddToken(uint256 newFeeAddToken) external onlyGovernance {
        feeAddToken = newFeeAddToken;
        emit UpdateFeeAddToken(newFeeAddToken);
    }

    //////////////
    // Viewers
    /////////////

    /**
     * @dev Retrieve the number of tokens added in rollup
     * @return Number of tokens added in rollup
     */
    function registerTokensCount() public view returns (uint256) {
        return tokenList.length;
    }

    //////////////
    // Internal/private methods
    /////////////

    /**
     * @dev Inclusion of a new token to the rollup
     * Internal function, called by ERC777 tokensReceived
     * @param tokenAddress Smart contract token address
     * Events: `AddToken`
     */
    function _addToken(address tokenAddress) internal {
        uint256 currentTokens = tokenList.length;
        require(currentTokens < _LIMIT_TOKENS, "token list is full");
        require(tokenAddress != address(0), "can't be address 0");
        require(tokenMap[tokenAddress] == 0, "token address already added");

        tokenList.push(tokenAddress);
        tokenMap[tokenAddress] = currentTokens;

        emit AddToken(tokenAddress, uint32(currentTokens));
    }

    /**
     * @dev Initialize verifiers
     * @param _verifiers verifiers address array
     * @param _verifiersParams encoeded maxTx and nlevels of the verifier as follows:
     * [8 bits]nLevels || [248 bits] maxTx
     */
    function _initializeVerifiers(
        address[] memory _verifiers,
        uint256[] memory _verifiersParams
    ) internal {
        for (uint256 i = 0; i < _verifiers.length; i++) {
            rollupVerifiers.push(
                VerifierRollup({
                    verifierInterface: VerifierRollupInterface(_verifiers[i]),
                    maxTx: (_verifiersParams[i] << 8) >> 8,
                    nLevels: _verifiersParams[i] >> (256 - 8)
                })
            );
        }
    }

    /**
     * @dev Add L1-user-tx, add it to the correspoding queue
     * l1Tx L1-user-tx encoded in bytes as follows: [20 bytes] fromEthAddr || [32 bytes] fromBjj-compressed || [4 bytes] fromIdx ||
     * [2 bytes] loadAmountFloat16 || [2 bytes] amountFloat16 || [4 bytes] tokenId || [4 bytes] toIdx
     * @param ethAddress Ethereum address of the rollup account
     * @param babyPubKey Public key babyjubjub represented as point: sign + (Ay)
     * @param fromIdx Index account of the sender account
     * @param loadAmountF Amount from L1 to L2
     * @param amountF  Amount transfered between L2 accounts
     * @param tokenID  Token identifier
     * @param toIdx Index leaf of recipient account
     * Events: `L1UserTxEvent`
     */
    function _l1QueueAddTx(
        address ethAddress,
        uint256 babyPubKey,
        uint48 fromIdx,
        uint16 loadAmountF,
        uint16 amountF,
        uint32 tokenID,
        uint48 toIdx
    ) internal {
        bytes memory l1Tx = abi.encodePacked(
            ethAddress,
            babyPubKey,
            fromIdx,
            loadAmountF,
            amountF,
            tokenID,
            toIdx
        );

        // concatenate storage byte array with the new l1Tx
        _concatStorage(mapL1TxQueue[nextL1FillingQueue], l1Tx);

        uint256 lastPosition = mapL1TxQueue[nextL1FillingQueue].length /
            _L1_USER_TOTALBYTES;

        emit L1UserTxEvent(nextL1FillingQueue, uint8(lastPosition), l1Tx);
        if (lastPosition >= _MAX_L1_USER_TX) {
            nextL1FillingQueue++;
        }
    }

    /**
     * @dev return the current L1-user-tx queue adding the L1-coordinator-tx
     * @param ptr Ptr where L1 data is set
     * @param l1Batch if true, the include l1TXs from the queue
     * [1 byte] V(ecdsa signature) || [32 bytes] S(ecdsa signature) ||
     * [32 bytes] R(ecdsa signature) || [32 bytes] fromBjj-compressed || [4 bytes] tokenId
     */
    function _buildL1Data(uint256 ptr, bool l1Batch) internal view {
        uint256 dPtr;
        uint256 dLen;

        (dPtr, dLen) = _getCallData(3);
        uint256 l1CoordinatorLength = dLen / _L1_COORDINATOR_TOTALBYTES;

        uint256 l1UserLength;
        bytes memory l1UserTxQueue;
        if (l1Batch) {
            l1UserTxQueue = mapL1TxQueue[nextL1ToForgeQueue];
            l1UserLength = l1UserTxQueue.length / _L1_USER_TOTALBYTES;
        } else {
            l1UserLength = 0;
        }

        require(
            l1UserLength + l1CoordinatorLength <= _MAX_L1_TX,
            "L1 TX overflow"
        );

        if (l1UserLength > 0) {
            // Copy the queue to the ptr and update ptr
            assembly {
                let ptrFrom := add(l1UserTxQueue, 0x20)
                let ptrTo := ptr
                ptr := add(ptr, mul(l1UserLength, _L1_USER_TOTALBYTES))
                for {

                } lt(ptrTo, ptr) {
                    ptrTo := add(ptrTo, 32)
                    ptrFrom := add(ptrFrom, 32)
                } {
                    mstore(ptrTo, mload(ptrFrom))
                }
            }
        }

        for (uint256 i = 0; i < l1CoordinatorLength; i++) {
            uint8 v; // L1-Coordinator-Tx bytes[0]
            bytes32 s; // L1-Coordinator-Tx bytes[1:32]
            bytes32 r; // L1-Coordinator-Tx bytes[33:64]
            bytes32 babyPubKey; // L1-Coordinator-Tx bytes[65:96]
            uint256 tokenID; // L1-Coordinator-Tx bytes[97:128]

            assembly {
                v := byte(0, calldataload(dPtr))
                dPtr := add(dPtr, 1)

                s := calldataload(dPtr)
                dPtr := add(dPtr, 32)

                r := calldataload(dPtr)
                dPtr := add(dPtr, 32)

                babyPubKey := calldataload(dPtr)
                dPtr := add(dPtr, 32)

                tokenID := shr(224, calldataload(dPtr)) // 256-32 = 224
                dPtr := add(dPtr, 4)
            }

            require(
                tokenID < tokenList.length,
                "token has not been registered"
            );

            address ethAddress = _ETH_ADDRESS_INTERNAL_ONLY;

            // v must be >27 --> EIP-155, v == 0 means no signature
            if (v != 0) {
                ethAddress = _checkSig(babyPubKey, r, s, v);
            }

            // add L1-Coordinator-Tx to the L1-tx queue
            assembly {
                mstore(ptr, shl(96, ethAddress)) // 256 - 160 = 96, write ethAddress: bytes[0:19]
                ptr := add(ptr, 20)

                mstore(ptr, babyPubKey) // write babyPubKey: bytes[20:51]
                ptr := add(ptr, 32)

                mstore(ptr, 0) // write zeros
                // [6 Bytes] fromIdx ,
                // [2 bytes] loadAmountFloat16 .
                // [2 bytes] amountFloat16
                ptr := add(ptr, 10)

                mstore(ptr, shl(224, tokenID)) // 256 - 32 = 224 write tokenID: bytes[62:65]
                ptr := add(ptr, 4)

                mstore(ptr, 0) // write [6 Bytes] toIdx
                ptr := add(ptr, 6)
            }
        }

        _fillZeros(
            ptr,
            (_MAX_L1_TX - l1UserLength - l1CoordinatorLength) *
                _L1_USER_TOTALBYTES
        );
    }

    /**
     * @dev Calculate the circuit input hashing all the elements
     * @param newLastIdx New total rollup accounts
     * @param newStRoot New state root
     * @param newExitRoot New exit root
     * @param l1Batch Indicates if this forge will be L2 or L1-L2
     * @param verifierIdx Verifier index
     */
    function _constructCircuitInput(
        uint48 newLastIdx,
        uint256 newStRoot,
        uint256 newExitRoot,
        bool l1Batch,
        uint8 verifierIdx
    ) internal view returns (uint256) {
        uint256 oldStRoot = stateRootMap[lastForgedBatch];
        uint256 oldLastIdx = lastIdx;
        uint256 dPtr; // Pointer to the calldata parameter data
        uint256 dLen; // Length of the calldata parameter

        // l2TxsData = l2Bytes * maxTx =
        // ([(nLevels / 8) bytes] fromIdx + [(nLevels / 8) bytes] toIdx + [2 bytes] amountFloat16 + [1 bytes] fee) * maxTx =
        // ((nLevels / 4) bytes + 3 bytes) * maxTx
        uint256 l2TxsDataLength = ((rollupVerifiers[verifierIdx].nLevels / 8) *
            2 +
            3) * rollupVerifiers[verifierIdx].maxTx;

        // [(nLevels / 8) bytes]
        uint256 feeIdxCoordinatorLength = (rollupVerifiers[verifierIdx]
            .nLevels / 8) * 64;

        // the concatenation of all arguments could be done with abi.encodePacked(args), but is suboptimal, especially with a large bytes arrays
        // [6 bytes] lastIdx +
        // [6 bytes] newLastIdx  +
        // [32 bytes] stateRoot  +
        // [32 bytes] newStRoot  +
        // [32 bytes] newExitRoot +
        // [_MAX_L1_TX * _L1_USER_TOTALBYTES bytes] l1TxsData +
        // totalL2TxsDataLength +
        // feeIdxCoordinatorLength +
        // [2 bytes] chainID =
        // _INPUT_SHA_CONSTANT_BYTES bytes +  totalL2TxsDataLength + feeIdxCoordinatorLength
        bytes memory inputBytes;

        uint256 ptr; // Position for writing the bufftr

        assembly {
            let inputBytesLength := add(
                add(_INPUT_SHA_CONSTANT_BYTES, l2TxsDataLength),
                feeIdxCoordinatorLength
            )

            // Set inputBytes to the next free memory space
            inputBytes := mload(0x40)
            // Reserve the memory. 32 for the length , the input bytes and 32
            // extra bytes at the end for word manipulation
            mstore(0x40, add(add(inputBytes, 0x40), inputBytesLength))

            // Set the actua length of the input bytes
            mstore(inputBytes, inputBytesLength)

            // Set The Ptr at the begining of the inputPubber
            ptr := add(inputBytes, 32)

            mstore(ptr, shl(208, oldLastIdx)) // 256-48 = 208
            ptr := add(ptr, 6)

            mstore(ptr, shl(208, newLastIdx)) // 256-48 = 208
            ptr := add(ptr, 6)

            mstore(ptr, oldStRoot)
            ptr := add(ptr, 32)

            mstore(ptr, newStRoot)
            ptr := add(ptr, 32)

            mstore(ptr, newExitRoot)
            ptr := add(ptr, 32)
        }

        // Copy the L1TX Data
        _buildL1Data(ptr, l1Batch);
        ptr += _MAX_L1_TX * _L1_USER_TOTALBYTES;

        // Copy the L2 TX Data from calldata
        (dPtr, dLen) = _getCallData(4);
        require(dLen <= l2TxsDataLength, "l2 tx data overflow");
        assembly {
            calldatacopy(ptr, dPtr, dLen)
        }
        ptr += dLen;
        _fillZeros(ptr, l2TxsDataLength - dLen);
        ptr += l2TxsDataLength - dLen;

        // Copy the FeeIdxCoordinator from the calldata
        (dPtr, dLen) = _getCallData(5);
        require(
            dLen == feeIdxCoordinatorLength,
            "feeIdxCoordinator length invalid"
        );
        assembly {
            calldatacopy(ptr, dPtr, dLen)
        }
        ptr += dLen;
        _fillZeros(ptr, feeIdxCoordinatorLength - dLen);
        ptr += feeIdxCoordinatorLength - dLen;

        // store 2 bytes of chainID at the end of the inputBytes
        assembly {
            mstore(ptr, shl(240, chainid())) // 256 - 16 = 240
        }

        return uint256(sha256(inputBytes)) % _RFIELD;
    }

    /**
     * @dev Clear the current queue, and update the `nextL1ToForgeQueue` and `nextL1FillingQueue` if needed
     */
    function _clearQueue() internal {
        delete mapL1TxQueue[nextL1ToForgeQueue];
        nextL1ToForgeQueue++;
        if (nextL1ToForgeQueue == nextL1FillingQueue) {
            nextL1FillingQueue++;
        }
    }

    /**
     * @dev Withdraw the funds to the msg.sender if instant withdraw or to the withdraw delayer if delayed
     * @param amount Amount to retrieve
     * @param tokenID Token identifier
     * @param instantWithdraw true if is an instant withdraw
     */
    function _withdrawFunds(
        uint192 amount,
        uint32 tokenID,
        bool instantWithdraw
    ) internal {
        if (instantWithdraw) {
            _safeTransfer(tokenList[tokenID], msg.sender, amount);
        } else {
            if (tokenID == 0) {
                withdrawDelayerContract.deposit{value: amount}(
                    msg.sender,
                    address(0),
                    amount
                );
            } else {
                address tokenAddress = tokenList[tokenID];
                // check if the contract is ERC777, granularity has no inputs, it's cheaper to check
                bool isERC777 = _ERC1820.getInterfaceImplementer(
                    tokenAddress,
                    keccak256("ERC777Token")
                ) != address(0x0)
                    ? true
                    : false;

                // In case that the token is an ERC777 we use send instead of transfer
                if (isERC777) {
                    uint256 granularity = _getGranularity(tokenAddress);

                    /* solhint-disable avoid-low-level-calls */
                    (bool success, ) = tokenAddress.call(
                        abi.encodeWithSelector(
                            _SEND_SIGNATURE,
                            address(withdrawDelayerContract),
                            amount * granularity,
                            abi.encodeWithSelector(
                                _WITHDRAWAL_DELAYER_DEPOSIT,
                                msg.sender,
                                tokenAddress,
                                amount * granularity
                            )
                        )
                    );
                    require(success, "withdrawal delayer deposit fail");
                } else {
                    _safeApprove(
                        tokenAddress,
                        address(withdrawDelayerContract),
                        amount
                    );

                    withdrawDelayerContract.deposit(
                        msg.sender,
                        tokenAddress,
                        amount
                    );
                }
            }
        }
    }

    ///////////
    // helpers ERC20 functions
    ///////////

    /**
     * @dev Approve IERC20 / IERC77 tokens
     * @param token Token address
     * @param to Recievers
     * @param value Quantity of tokens to approve
     */
    function _safeApprove(
        address token,
        address to,
        uint256 value
    ) internal {
        /* solhint-disable avoid-low-level-calls */
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(_APPROVE_SIGNATURE, to, value)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "APPROVE_FAILED"
        );
    }

    /**
     * @dev transfer tokens or ether from the smart contract
     * @param token Token address
     * @param to Address to recieve the tokens
     * @param value Quantity to transfer
     */
    function _safeTransfer(
        address token,
        address to,
        uint256 value
    ) internal {
        // address 0 is reserved for eth
        if (token == address(0)) {
            /* solhint-disable avoid-low-level-calls */
            (bool success, ) = msg.sender.call{value: value}(new bytes(0));
            require(success, "ETH transfer failed");
        } else {
            // check if the contract is ERC777, granularity has no inputs, it's cheaper to check
            bool isERC777 = _ERC1820.getInterfaceImplementer(
                token,
                keccak256("ERC777Token")
            ) != address(0x0)
                ? true
                : false;

            // In case that the token is an ERC777 we use send instead of transfer
            if (isERC777) {
                uint256 granularity = _getGranularity(token);

                /* solhint-disable avoid-low-level-calls */
                (bool success, bytes memory data) = token.call(
                    abi.encodeWithSelector(
                        _SEND_SIGNATURE,
                        to,
                        value * granularity,
                        new bytes(0)
                    )
                );
                require(
                    success && (data.length == 0 || abi.decode(data, (bool))),
                    "ERC777 send failed"
                );
            } else {
                /* solhint-disable avoid-low-level-calls */
                (bool success, bytes memory data) = token.call(
                    abi.encodeWithSelector(_TRANSFER_SIGNATURE, to, value)
                );
                require(
                    success && (data.length == 0 || abi.decode(data, (bool))),
                    "ERC20 transfer failed"
                );
            }
        }
    }

    /**
     * @dev transferFrom IERC20 / IERC777
     * Require approve tokens for this contract previously
     * @param token Token address
     * @param from Sender
     * @param to Reciever
     * @param value Quantity of tokens to send
     */
    function _safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 value
    ) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(_TRANSFER_FROM_SIGNATURE, from, to, value)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "safe transfer from failed"
        );
    }

    /**
     * @dev Get granularity of a ERC777 token
     * // All the ERC777 tokens amounts are stored in the SC divided by the granularity
     * // When withdrawn the amount is multiplied by the granularity
     * // In this way we assure that the granularity is always accomplished
     * @param token Token address
     */
    function _getGranularity(address token) internal view returns (uint256) {
        // get granularity
        (bool success, bytes memory data) = token.staticcall(
            abi.encodeWithSelector(_ERC777_GRANULARITY)
        );
        require(success, "ERC777 don't implement granularity");
        return abi.decode(data, (uint256));
    }
}
