// SPDX-License-Identifier: AGPL-3.0

import "../interfaces/WithdrawalDelayerInterface.sol";
import "./HermezHelpers.sol";

import "./SafeMath.sol";

pragma solidity ^0.6.12;

contract InstantWithdrawManager is HermezHelpers {
    using SafeMath for uint256;

    // every time a withdraw is performed, a withdrawal is wasted
    struct Bucket {
        uint256 ceilUSD; // max USD value
        uint256 blockStamp; // last time a withdrawal was added ( or removed if the bucket was full)
        uint256 withdrawals; // available withdrawals of the bucket
        uint256 blockWithdrawalRate; // every `blockWithdrawalRate` blocks add 1 withdrawal
        uint256 maxWithdrawals; // max withdrawals the bucket can hold
    }

    // Reserved bucket index when token value is 0 USD
    uint256 private constant _NO_LIMIT = 0xFFFF;

    uint256 private constant _ARRAY_BUCKET_WITHDRAWALS = 1;
    uint256 private constant _ARRAY_BUCKET_MAXWITHDRAWALS = 3;

    // Number of buckets
    uint256 private constant _NUM_BUCKETS = 5;
    // Bucket array
    Bucket[_NUM_BUCKETS] public buckets;

    // Governance address
    address public hermezGovernanceDAOAddress;

    // Safety address, in case something out of control happens can put Hermez in safe mode
    // wich means only delay withdrawals allowed
    address public safetyAddress;

    // Withdraw delay in seconds
    uint64 public withdrawalDelay;

    bytes4 private constant _ERC20_DECIMALS = bytes4(
        keccak256(bytes("decimals()"))
    );
    uint256 private constant _MAX_WITHDRAWAL_DELAY = 2 weeks;

    // Withdraw delayer interface
    WithdrawalDelayerInterface public withdrawDelayerContract;

    // Mapping tokenAddress --> (USD value)/token , default 0, means that token does not worth
    // 2^64 = 1.8446744e+19
    // fixed point codification is used, 5 digits for integer part, 14 digits for decimal
    // In other words, the USD value of a token base unit is multiplied by 1e14
    // MaxUSD value for a base unit token: 184467$
    // MinUSD value for a base unit token: 1e-14$
    mapping(address => uint64) public tokenExchange;

    uint256 private constant _EXCHANGE_MULTIPLIER = 1e14;

    function _initializeWithdraw(
        address _hermezGovernanceDAOAddress,
        address _safetyAddress,
        uint64 _withdrawalDelay,
        address _withdrawDelayerContract
    ) internal initializer {
        hermezGovernanceDAOAddress = _hermezGovernanceDAOAddress;
        safetyAddress = _safetyAddress;
        withdrawalDelay = _withdrawalDelay;
        withdrawDelayerContract = WithdrawalDelayerInterface(
            _withdrawDelayerContract
        );
    }

    modifier onlyGovernance {
        require(
            msg.sender == hermezGovernanceDAOAddress,
            "Only goverance address"
        );
        _;
    }

    /**
     * @dev Update bucket parameters
     * @param arrayBuckets Array of buckets to replace the current ones
     */
    function updateBucketsParameters(
        uint256[4][_NUM_BUCKETS] memory arrayBuckets
    ) external onlyGovernance {
        for (uint256 i = 0; i < _NUM_BUCKETS; i++) {
            require(
                arrayBuckets[i][_ARRAY_BUCKET_MAXWITHDRAWALS] >=
                    arrayBuckets[i][_ARRAY_BUCKET_WITHDRAWALS],
                "can't be more withdrawals than Max withdrawals"
            );
            buckets[i] = Bucket(
                arrayBuckets[i][0],
                block.number,
                arrayBuckets[i][1],
                arrayBuckets[i][2],
                arrayBuckets[i][3]
            );
        }
    }

    /**
     * @dev Update token USD value
     * @param addressArray Array of the token address
     * @param valueArray Array of USD values
     */
    function updateTokenExchange(
        address[] memory addressArray,
        uint64[] memory valueArray
    ) external onlyGovernance {
        require(
            addressArray.length == valueArray.length,
            "address array and value array must have equal length"
        );
        for (uint256 i = 0; i < addressArray.length; i++) {
            tokenExchange[addressArray[i]] = valueArray[i];
        }
    }

    /**
     * @dev Update WithdrawalDelay
     * @param newWithdrawalDelay New WithdrawalDelay
     * Events: `UpdateWithdrawalDelay`
     */
    function updateWithdrawalDelay(uint64 newWithdrawalDelay)
        external
        onlyGovernance
    {
        require(
            newWithdrawalDelay <= _MAX_WITHDRAWAL_DELAY,
            "Exceeds MAX_WITHDRAWAL_DELAY"
        );
        withdrawalDelay = newWithdrawalDelay;
    }

    /**
     * @dev Put the smartcontract in safe mode, only delayed withdrawals allowed,
     * also update the 'withdrawalDelay' of the 'withdrawDelayer' contract
     */
    function safeMode() external {
        require(
            (msg.sender == safetyAddress) ||
                (msg.sender == hermezGovernanceDAOAddress),
            "Only safe bot or goverance"
        );

        // all buckets to 0
        for (uint256 i = 0; i < _NUM_BUCKETS; i++) {
            buckets[i] = Bucket(0, 0, 0, 0, 0);
        }
        withdrawDelayerContract.changeWithdrawalDelay(withdrawalDelay);
    }

    /**
     * @dev Return true if a instant withdraw could be done with that 'tokenAddress' and 'amount'
     * @param tokenAddress Token address
     * @param amount Amount to withdraw
     * @return true if the instant withdrawal is allowed
     */
    function instantWithdrawalViewer(address tokenAddress, uint192 amount)
        public
        view
        returns (bool)
    {
        // find amount in USD and then the corresponding bucketIdx
        uint256 amountUSD = _token2USD(tokenAddress, amount);
        uint256 bucketIdx = _findBucketIdx(amountUSD);

        if (bucketIdx == _NO_LIMIT) return true;

        Bucket storage currentBucket = buckets[bucketIdx];
        if (currentBucket.withdrawals > 0) {
            return true;
        } else {
            uint256 differenceBlocks = block.number.sub(
                currentBucket.blockStamp
            );
            if (differenceBlocks < currentBucket.blockWithdrawalRate)
                return false;
            else return true;
        }
    }

    /**
     * @dev Converts tokens to USD
     * @param tokenAddress Token address
     * @param amount Token amount
     * @return Total USD amount
     */
    function _token2USD(address tokenAddress, uint192 amount)
        internal
        view
        returns (uint256)
    {
        if (tokenExchange[tokenAddress] == 0) return 0;

        // this multiplication never overflows 192bits * 64 bits
        uint256 baseUnitTokenUSD = (
            uint256(amount).mul(tokenExchange[tokenAddress])
        )
            .div(_EXCHANGE_MULTIPLIER);

        // if decimals() is not implemented 0 decimals are assumed
        (bool success, bytes memory data) = tokenAddress.staticcall(
            abi.encodeWithSelector(_ERC20_DECIMALS)
        );
        uint8 decimals;
        if (success) {
            decimals = abi.decode(data, (uint8));
        }
        require(decimals < 77, "tokenUSD decimals overflow");
        return baseUnitTokenUSD.div(10**uint256(decimals));
    }

    /**
     * @dev Find the corresponding bucket for the input amount
     * @param amountUSD USD amount
     * @return Bucket index or `_NO_LIMIT` in case amountUSD is 0
     */
    function _findBucketIdx(uint256 amountUSD) internal view returns (uint256) {
        if (amountUSD == 0) return _NO_LIMIT;

        for (uint256 i = 0; i < _NUM_BUCKETS; i++) {
            if (amountUSD <= buckets[i].ceilUSD) {
                return i;
            }
        }
        revert("exceed max amount");
    }

    /**
     * @dev Add withdrawals to the bucket since the last update depending on the 'blockWithdrawalRate'
     * @param bucketIdx Bucket index
     */
    function _updateBucket(uint256 bucketIdx) internal {
        Bucket storage currentBucket = buckets[bucketIdx];

        uint256 differenceBlocks = block.number.sub(currentBucket.blockStamp);
        if (
            (currentBucket.withdrawals == currentBucket.maxWithdrawals) ||
            (differenceBlocks < currentBucket.blockWithdrawalRate)
        ) return; // no changes in the bucket

        uint256 addWithdrawals = differenceBlocks.div(
            currentBucket.blockWithdrawalRate
        );

        if (
            currentBucket.withdrawals.add(addWithdrawals) >=
            currentBucket.maxWithdrawals
        ) {
            currentBucket.withdrawals = currentBucket.maxWithdrawals;
        } else {
            currentBucket.withdrawals = currentBucket.withdrawals.add(
                addWithdrawals
            );
            // blockstamp increments with a multiple of blockWithdrawalRate nearest and smaller than differenceBlocks
            // addWithdrawals is that multiple because solidity divisions always result into integer rounded to 0
            // this expression, can be reduced into currentBucket.blockStamp = block.number only if addWithdrawals is a multiple of blockWithdrawalRate
            // in other words, there's no rounding in the division, otherwise the rounding will alter the expressionç
            currentBucket.blockStamp = currentBucket.blockStamp.add(
                (addWithdrawals.mul(currentBucket.blockWithdrawalRate))
            );
        }
    }

    /**
     * @dev Attempt to use instant withdraw
     * @param tokenAddress Token address
     * @param amount Amount to withdraw
     */
    function _processInstantWithdrawal(address tokenAddress, uint192 amount)
        internal
    {
        // find amount in USD and then the corresponding bucketIdx
        uint256 amountUSD = _token2USD(tokenAddress, amount);
        uint256 bucketIdx = _findBucketIdx(amountUSD);

        if (bucketIdx != _NO_LIMIT) {
            _updateBucket(bucketIdx);
            require(
                buckets[bucketIdx].withdrawals > 0,
                "instant withdrawals wasted"
            );
            if (
                buckets[bucketIdx].withdrawals ==
                buckets[bucketIdx].maxWithdrawals
            ) {
                buckets[bucketIdx].blockStamp = block.number;
            }
            // can't underflow, the last require assures that
            buckets[bucketIdx].withdrawals--;
        }
    }
}
