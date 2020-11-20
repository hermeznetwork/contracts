// SPDX-License-Identifier: AGPL-3.0

pragma solidity 0.6.12;

interface IWithdrawalDelayer {
    /**
     * @notice Getter of the current `_hermezGovernanceDAOAddress`
     * @return The `_hermezGovernanceDAOAddress` value
     */
    function getHermezGovernanceDAOAddress() external view returns (address);

    /**
     * @notice Allows to change the `_hermezGovernanceDAOAddress` if it's called by `_hermezGovernanceDAOAddress`
     * @param newAddress new `_hermezGovernanceDAOAddress`
     */
    function setHermezGovernanceDAOAddress(address newAddress) external;

    /**
     * @notice Getter of the current `_hermezKeeperAddress`
     * @return The `_hermezKeeperAddress` value
     */
    function getHermezKeeperAddress() external view returns (address);

    /**
     * @notice Allows to change the `_hermezKeeperAddress` if it's called by `_hermezKeeperAddress`
     * @param newAddress `_hermezKeeperAddress`
     */
    function setHermezKeeperAddress(address newAddress) external;

    /**
     * @notice Getter of the current `_whiteHackGroupAddress`
     * @return The `_whiteHackGroupAddress` value
     */
    function getWhiteHackGroupAddress() external view returns (address);

    /**
     * @notice Allows to change the `_whiteHackGroupAddress` if it's called by `_whiteHackGroupAddress`
     * @param newAddress new `_whiteHackGroupAddress`
     */
    function setWhiteHackGroupAddress(address payable newAddress) external;

    /**
     * @notice Getter of the current `_emergencyMode` status to know if the emergency mode is enable or disable
     * @return The `_emergencyMode` value
     */
    function isEmergencyMode() external view returns (bool);

    /**
     * @notice Getter to obtain the current withdrawal delay
     * @return the current withdrawal delay time in seconds: `_withdrawalDelay`
     */
    function getWithdrawalDelay() external view returns (uint128);

    /**
     * @notice Getter to obtain when emergency mode started
     * @return the emergency mode starting time in seconds: `_emergencyModeStartingTime`
     */
    function getEmergencyModeStartingTime() external view returns (uint128);

    /**
     * @notice This function enables the emergency mode. Only the keeper of the system can enable this mode. This cannot
     * be deactivated in any case so it will be irreversible.
     * @dev The activation time is saved in `_emergencyModeStartingTime` and this function can only be called
     * once if it has not been previously activated.
     * Events: `EmergencyModeEnabled` event.
     */
    function enableEmergencyMode() external;

    /**
     * @notice This function allows the HermezKeeperAddress to change the withdrawal delay time, this is the time that
     * anyone needs to wait until a withdrawal of the funds is allowed. Since this time is calculated at the time of
     * withdrawal, this change affects existing deposits. Can never exceed `MAX_WITHDRAWAL_DELAY`
     * @dev It changes `_withdrawalDelay` if `_newWithdrawalDelay` it is less than or equal to MAX_WITHDRAWAL_DELAY
     * @param _newWithdrawalDelay new delay time in seconds
     * Events: `NewWithdrawalDelay` event.
     */
    function changeWithdrawalDelay(uint64 _newWithdrawalDelay) external;

    /**
     * Returns the balance and the timestamp for a specific owner and token
     * @param _owner who can claim the deposit once the delay time has expired (if not in emergency mode)
     * @param _token address of the token to withdrawal (0x0 in case of Ether)
     * @return `amount` Total amount withdrawable (if not in emergency mode)
     * @return `depositTimestamp` Moment at which funds were deposited
     */
    function depositInfo(address payable _owner, address _token)
        external
        view
        returns (uint192, uint64);

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
    ) external payable;

    /**
     * This function allows the owner to withdawal the funds. Emergency mode cannot be enabled and it must have exceeded
     * the withdrawal delay time
     * @dev `NonReentrant` modifier is used as a protection despite the state is being previously updated
     * @param _owner can claim the deposit once the delay time has expired
     * @param _token address of the token to withdrawal (0x0 in case of Ether)
     * Events: `Withdraw`
     */
    function withdrawal(address payable _owner, address _token) external;

    /**
     * Allows the Hermez Governance DAO to withdawal the funds in the event that emergency mode was enable.
     * Note: An Aragon Court will have the right to veto over the call to this method
     * @dev `NonReentrant` modifier is used as a protection despite the state is being previously updated and this is
     * a security mechanism
     * @param _to where the funds will be sent
     * @param _token address of the token withdraw (0x0 in case of Ether)
     * @param _amount the amount to send
     * Events: `EscapeHatchWithdrawal`
     */
    function escapeHatchWithdrawal(
        address _to,
        address _token,
        uint256 _amount
    ) external;
}
