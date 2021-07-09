// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// mock class using ERC20
contract ERC20MockDecimals is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        address initialAccount,
        uint256 initialBalance,
        uint8 decimals
    ) public payable ERC20(name, symbol) {
        _setupDecimals(decimals);
        _mint(initialAccount, initialBalance);
    }
}
