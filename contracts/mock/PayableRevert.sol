// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";

interface IWithdrawalDelayer {
    function changeDisputeResolutionAddress() external;

    function escapeHatchWithdrawal(address _to, address _token) external;

    function setHermezGovernanceDAOAddress(address newAddress) external;

    function setWhiteHackGroupAddress(address payable newAddress) external;
}

contract PayableRevert is IERC777Recipient {
    bool public paymentEnable = true;

    IERC1820Registry private constant _ERC1820 = IERC1820Registry(
        0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24
    );
    bytes32 private constant _TOKENS_RECIPIENT_INTERFACE_HASH = keccak256(
        "ERC777TokensRecipient"
    );

    constructor() public {
        _ERC1820.setInterfaceImplementer(
            address(this),
            _TOKENS_RECIPIENT_INTERFACE_HASH,
            address(this)
        );
    }

    function disablePayment() public {
        paymentEnable = false;
    }

    function enablePayment() public {
        paymentEnable = true;
    }

    fallback() external payable {
        require(paymentEnable, "Not payable");
    }

    receive() external payable {
        require(paymentEnable, "Not payable");
    }

    function changeDisputeResolutionAddress(address withdrawalDelayerAddress)
        public
    {
        IWithdrawalDelayer(withdrawalDelayerAddress)
            .changeDisputeResolutionAddress();
    }

    function escapeHatchWithdrawal(
        address withdrawalDelayerAddress,
        address _to,
        address _token
    ) public {
        IWithdrawalDelayer(withdrawalDelayerAddress).escapeHatchWithdrawal(
            _to,
            _token
        );
    }

    function setHermezGovernanceDAOAddress(
        address withdrawalDelayerAddress,
        address newAddress
    ) public {
        IWithdrawalDelayer(withdrawalDelayerAddress)
            .setHermezGovernanceDAOAddress(newAddress);
    }

    function setWhiteHackGroupAddress(
        address withdrawalDelayerAddress,
        address payable newAddress
    ) public {
        IWithdrawalDelayer(withdrawalDelayerAddress).setWhiteHackGroupAddress(
            newAddress
        );
    }

    function tokensReceived(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata userData,
        bytes calldata operatorData
    ) external override {
        require(paymentEnable, "Not payable");
    }
}
