// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// mock class using ERC20
contract ERC20Custom is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals,
        address initialAccount,
        uint256 initialBalance
    ) public payable ERC20(name, symbol) {
        _setupDecimals(decimals);
        _mint(initialAccount, initialBalance);
    }
}
