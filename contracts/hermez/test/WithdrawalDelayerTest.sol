// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract WithdrawalDelayerTest is ReentrancyGuard, IERC777Recipient {
    IERC1820Registry private constant _ERC1820_REGISTRY = IERC1820Registry(
        0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24
    );
    bytes32 private constant _ERC777_RECIPIENT_INTERFACE_HASH = keccak256(
        "ERC777TokensRecipient"
    );

    address public hermezRollupAddress;

    bytes4 private constant _TRANSFERFROM_SIGNATURE = bytes4(
        keccak256(bytes("transferFrom(address,address,uint256)"))
    );

    bytes4 private constant _DEPOSIT_SIGNATURE = bytes4(
        keccak256(bytes("deposit(address,address,uint192)"))
    );

    event Deposit(
        address indexed owner,
        address indexed token,
        uint192 amount,
        uint64 depositTimestamp
    );

    struct DepositState {
        uint192 amount;
        uint64 depositTimestamp;
    }
    mapping(bytes32 => DepositState) public deposits;

    /**
     * @notice withdrawalDelayerInitializer (Constructor)
     * @param _initialWithdrawalDelay Initial withdrawal delay time in seconds to be able to withdraw the funds
     * @param _initialHermezRollup Smart contract responsible of making deposits and it's able to change the delay
     * @param _initialHermezKeeperAddress can enable emergency mode and modify the delay to make a withdrawal
     * @param _initialHermezGovernanceDAOAddress can claim the funds in an emergency mode
     * @param _initialWhiteHackGroupAddress can claim the funds in an emergency and MAX_EMERGENCY_MODE_TIME exceeded
     */
    constructor(
        uint64 _initialWithdrawalDelay,
        address _initialHermezRollup,
        address _initialHermezKeeperAddress,
        address _initialHermezGovernanceDAOAddress,
        address payable _initialWhiteHackGroupAddress
    ) public {
        hermezRollupAddress = _initialHermezRollup;
        _ERC1820_REGISTRY.setInterfaceImplementer(
            address(this),
            _ERC777_RECIPIENT_INTERFACE_HASH,
            address(this)
        );
    }

    /**
     * Function to make a deposit in the WithdrawalDelayer smartcontract, only the Hermez rollup smartcontract can do it
     * @dev In case of an Ether deposit, the address `0x0` will be used and the corresponding amount must be sent in the
     * `msg.value`. In case of an ERC20 this smartcontract must have the approval to expend the token to
     * deposit to be able to make a transferFrom to itself.
     * @param _owner is who can claim the deposit once the withdrawal delay time has been exceeded
     * @param _token address of the token deposited (`0x0` in case of Ether)
     * @param _amount deposit amount
     * Events: `Deposit`
     */
    function deposit(
        address _owner,
        address _token,
        uint192 _amount
    ) external payable nonReentrant {
        require(msg.sender == hermezRollupAddress, "Only hermezRollupAddress");
        if (msg.value != 0) {
            require(_token == address(0x0), "ETH should be the 0x0 address");
            require(_amount == msg.value, "Different amount and msg.value");
        } else {
            require(
                IERC20(_token).allowance(hermezRollupAddress, address(this)) >=
                    _amount,
                "Doesn't have enough allowance"
            );
            /* solhint-disable avoid-low-level-calls */
            (bool success, bytes memory data) = address(_token).call(
                abi.encodeWithSelector(
                    _TRANSFERFROM_SIGNATURE,
                    hermezRollupAddress,
                    address(this),
                    _amount
                )
            );
            // `transferFrom` method may return (bool) or nothing.
            require(
                success && (data.length == 0 || abi.decode(data, (bool))),
                "Token Transfer Failed"
            );
        }
        _processDeposit(_owner, _token, _amount);
    }

    /**
     * Function to make a deposit in the WithdrawalDelayer smartcontract, with an ERC777
     * @dev
     * @param operator - not used
     * @param from - not used
     * @param to - not used
     * @param amount the amount of tokens that have been sent
     * @param userData contains the raw call of the method to invoke (deposit)
     * @param operatorData - not used
     * Events: `Deposit`
     */
    function tokensReceived(
        // solhint-disable no-unused-vars
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata userData,
        bytes calldata operatorData
    ) external override nonReentrant {
        require(from == hermezRollupAddress, "Only hermezRollupAddress");
        require(userData.length != 0, "UserData empty");

        // Decode the signature
        bytes4 sig = abi.decode(userData, (bytes4));
        // We only accept "deposit(address,address,uint192)"
        if (sig == _DEPOSIT_SIGNATURE) {
            (address _owner, address _token, uint192 _amount) = abi.decode(
                userData[4:],
                (address, address, uint192)
            );
            require(amount == _amount, "Amount sent different");
            _processDeposit(_owner, _token, _amount);
        } else {
            revert("Not a valid calldata");
        }
    }

    /**
     * @notice Internal call to make a deposit
     * @param _owner is who can claim the deposit once the withdrawal delay time has been exceeded
     * @param _token address of the token deposited (`0x0` in case of Ether)
     * @param _amount deposit amount
     * Events: `Deposit`
     */
    function _processDeposit(
        address _owner,
        address _token,
        uint192 _amount
    ) internal {
        // We identify a deposit with the keccak of its owner and the token
        bytes32 depositId = keccak256(abi.encodePacked(_owner, _token));
        uint192 newAmount = deposits[depositId].amount + _amount;
        require(newAmount >= deposits[depositId].amount, "Deposit overflow");

        deposits[depositId].amount = newAmount;
        deposits[depositId].depositTimestamp = uint64(now);

        emit Deposit(
            _owner,
            _token,
            _amount,
            deposits[depositId].depositTimestamp
        );
    }

    /**
     * @notice This function allows the HermezKeeperAddress to change the withdrawal delay time, this is the time that
     * anyone needs to wait until a withdrawal of the funds is allowed. Since this time is calculated at the time of
     * withdrawal, this change affects existing deposits. Can never exceed `MAX_WITHDRAWAL_DELAY`
     * @dev It changes `_withdrawalDelay` if `_newWithdrawalDelay` it is less than or equal to MAX_WITHDRAWAL_DELAY
     * @param _newWithdrawalDelay new delay time in seconds
     * Events: `NewWithdrawalDelay` event.
     */
    function changeWithdrawalDelay(uint64 _newWithdrawalDelay) external {}
}
