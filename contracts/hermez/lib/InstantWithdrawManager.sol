// SPDX-License-Identifier: AGPL-3.0

pragma solidity 0.6.12;

import "../../interfaces/IWithdrawalDelayer.sol";
import "./HermezHelpers.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";


contract InstantWithdrawManager is HermezHelpers {
    using SafeMath for uint256;


    // Number of buckets
    uint256 private constant _MAX_BUCKETS = 5;

    // Bucket array
    uint256 public nBuckets;
    mapping (int256 => uint256) public buckets;

    // Governance address
    address public hermezGovernanceAddress;

    // Withdraw delay in seconds
    uint64 public withdrawalDelay;

    // ERC20 decimals signature
    //  bytes4(keccak256(bytes("decimals()")))
    bytes4 private constant _ERC20_DECIMALS = 0x313ce567;

    uint256 private constant _MAX_WITHDRAWAL_DELAY = 2 weeks;

    // Withdraw delayer interface
    IWithdrawalDelayer public withdrawDelayerContract;

    // Mapping tokenAddress --> (USD value)/token , default 0, means that token does not worth
    // 2^64 = 1.8446744e+19
    // fixed point codification is used, 9 digits for integer part, 10 digits for decimal
    // In other words, the USD value of a token base unit is multiplied by 1e10
    // MaxUSD value for a base unit token: 1844674407,3709551616$
    // MinUSD value for a base unit token: 1e-10$
    mapping(address => uint64) public tokenExchange;

    uint256 private constant _EXCHANGE_MULTIPLIER = 1e10;

    event UpdateBucketWithdraw(
        uint8 indexed numBucket,
        uint256 indexed blockStamp,
        uint256 withdrawals
    );

    event UpdateWithdrawalDelay(uint64 newWithdrawalDelay);
    event UpdateBucketsParameters(uint256[] arrayBuckets);
    event UpdateTokenExchange(address[] addressArray, uint64[] valueArray);
    event SafeMode();

    function _initializeWithdraw(
        address _hermezGovernanceAddress,
        uint64 _withdrawalDelay,
        address _withdrawDelayerContract
    ) internal initializer {
        hermezGovernanceAddress = _hermezGovernanceAddress;
        withdrawalDelay = _withdrawalDelay;
        withdrawDelayerContract = IWithdrawalDelayer(_withdrawDelayerContract);
    }

    modifier onlyGovernance {
        require(
            msg.sender == hermezGovernanceAddress,
            "InstantWithdrawManager::onlyGovernance: ONLY_GOVERNANCE_ADDRESS"
        );
        _;
    }

    /**
     * @dev Attempt to use instant withdraw
     * @param tokenAddress Token address
     * @param amount Amount to withdraw
     */
    function _processInstantWithdrawal(address tokenAddress, uint192 amount)
        internal
        returns (bool)
    {
        // find amount in USD and then the corresponding bucketIdx
        uint256 amountUSD = _token2USD(tokenAddress, amount);

        if (amountUSD == 0) {
            return true;
        }

        // find the appropiate bucketId
        int256 bucketIdx = _findBucketIdx(amountUSD);
        if (bucketIdx == -1) return true;

        (uint256 ceilUSD, uint256 blockStamp, uint256 withdrawals, uint256 rateBlocks, uint256 rateWithdrawals, uint256 maxWithdrawals) = unpackBucket(buckets[bucketIdx]);

        // update the bucket and check again if are withdrawals available
        uint256 differenceBlocks = block.number.sub(blockStamp);
        uint256 periods = differenceBlocks.div(rateBlocks);

        withdrawals = withdrawals.add(periods.mul(rateWithdrawals));
        if (withdrawals>=maxWithdrawals) {
            withdrawals = maxWithdrawals;
            blockStamp = block.number;
        } else {
            blockStamp = blockStamp.add(periods.mul(rateBlocks));
        }

        if (withdrawals == 0) return false;

        withdrawals = withdrawals.sub(1);

        buckets[bucketIdx] = packBucket(ceilUSD, blockStamp, withdrawals, rateBlocks, rateWithdrawals, maxWithdrawals);

        emit UpdateBucketWithdraw(uint8(bucketIdx), blockStamp, withdrawals);
        return true;
    }

    /**
     * @dev Update bucket parameters
     * @param newBuckets Array of buckets to replace the current ones, this array includes the
     * following parameters: [ceilUSD, withdrawals, blockWithdrawalRate, maxWithdrawals]
     */
    function updateBucketsParameters(
        uint256[] memory newBuckets
    ) external onlyGovernance {
        uint256 n = newBuckets.length;
        require(
            n <= _MAX_BUCKETS,
            "InstantWithdrawManager::updateBucketsParameters: MAX_NUM_BUCKETS"
        );

        nBuckets = n;
        for (uint256 i = 0; i < n; i++) {
            (uint256 ceilUSD, , uint256 withdrawals, uint256 rateBlocks, uint256 rateWithdrawals, uint256 maxWithdrawals) = unpackBucket(newBuckets[i]);
            require(
                withdrawals <= maxWithdrawals,
                "InstantWithdrawManager::updateBucketsParameters: WITHDRAWALS_MUST_BE_LESS_THAN_MAXWITHDRAWALS"
            );
            require(
                rateBlocks > 0,
                "InstantWithdrawManager::updateBucketsParameters: RATE_BLOCKS_MUST_BE_MORE_THAN_0"
            );
            buckets[int256(i)] = packBucket(
                ceilUSD,
                block.number,
                withdrawals,
                rateBlocks,
                rateWithdrawals,
                maxWithdrawals
            );
        }
        emit UpdateBucketsParameters(newBuckets);
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
            "InstantWithdrawManager::updateTokenExchange: INVALID_ARRAY_LENGTH"
        );
        for (uint256 i = 0; i < addressArray.length; i++) {
            tokenExchange[addressArray[i]] = valueArray[i];
        }
        emit UpdateTokenExchange(addressArray, valueArray);
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
            "InstantWithdrawManager::updateWithdrawalDelay: EXCEED_MAX_WITHDRAWAL_DELAY"
        );
        withdrawalDelay = newWithdrawalDelay;
        emit UpdateWithdrawalDelay(newWithdrawalDelay);
    }

    /**
     * @dev Put the smartcontract in safe mode, only delayed withdrawals allowed,
     * also update the 'withdrawalDelay' of the 'withdrawDelayer' contract
     */
    function safeMode() external onlyGovernance {
        // all buckets to 0
        nBuckets = 1;
        buckets[0] = packBucket(
            0xFFFFFFFF_FFFFFFFF_FFFFFFFF,
            0,
            0,
            1,
            0,
            0
        );
        withdrawDelayerContract.changeWithdrawalDelay(withdrawalDelay);
        emit SafeMode();
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
        if (amountUSD == 0) return true;

        int256 bucketIdx = _findBucketIdx(amountUSD);
        if (bucketIdx == -1) return true;


        (, uint256 blockStamp, uint256 withdrawals, uint256 rateBlocks, uint256 rateWithdrawals, uint256 maxWithdrawals) = unpackBucket(buckets[bucketIdx]);

        uint256 differenceBlocks = block.number.sub(blockStamp);
        uint256 periods = differenceBlocks.div(rateBlocks);

        withdrawals = withdrawals.add(periods.mul(rateWithdrawals));
        if (withdrawals>maxWithdrawals) withdrawals = maxWithdrawals;

        if (withdrawals == 0) return false;

        return true;
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
        uint256 baseUnitTokenUSD = (uint256(amount) *
            uint256(tokenExchange[tokenAddress])) / _EXCHANGE_MULTIPLIER;

        uint8 decimals;

        // if decimals() is not implemented 0 decimals are assumed
        (bool success, bytes memory data) = tokenAddress.staticcall(
            abi.encodeWithSelector(_ERC20_DECIMALS)
        );
        if (success) {
            decimals = abi.decode(data, (uint8));
        }

        require(
            decimals < 77,
            "InstantWithdrawManager::_token2USD: TOKEN_DECIMALS_OVERFLOW"
        );
        return baseUnitTokenUSD / (10**uint256(decimals));
    }

    /**
     * @dev Find the corresponding bucket for the input amount
     * @param amountUSD USD amount
     * @return Bucket index
     */
    function _findBucketIdx(uint256 amountUSD) internal view returns (int256) {
        for (int256 i = 0; i < int256(nBuckets); i++) {
            uint256 ceilUSD = buckets[i] & 0xFFFFFFFF_FFFFFFFF_FFFFFFFF;
            if ((amountUSD <= ceilUSD) ||
                (ceilUSD == 0xFFFFFFFF_FFFFFFFF_FFFFFFFF))
            {
                return i;
            }
        }
        return -1;
    }

    function unpackBucket(uint256 bucket) public pure returns(
        uint256 ceilUSD,
        uint256 blockStamp,
        uint256 withdrawals,
        uint256 rateBlocks,
        uint256 rateWithdrawals,
        uint256 maxWithdrawals
    ) {
        ceilUSD = bucket & 0xFFFFFFFF_FFFFFFFF_FFFFFFFF;
        blockStamp = (bucket >> 96) & 0xFFFFFFFF;
        withdrawals = (bucket >> 128) & 0xFFFFFFFF;
        rateBlocks = (bucket >> 160) & 0xFFFFFFFF;
        rateWithdrawals = (bucket >> 192) & 0xFFFFFFFF;
        maxWithdrawals = (bucket >> 224) & 0xFFFFFFFF;
    }

    function packBucket(
        uint256 ceilUSD,
        uint256 blockStamp,
        uint256 withdrawals,
        uint256 rateBlocks,
        uint256 rateWithdrawals,
        uint256 maxWithdrawals
    ) public pure returns(uint256 ret) {
        ret = ceilUSD |
              (blockStamp << 96) |
              (withdrawals << 128) |
              (rateBlocks << 160) |
              (rateWithdrawals << 192) |
              (maxWithdrawals << 224);
    }


}

