// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/GSN/Context.sol";
import "./ERC777.sol";

contract ERC777Mock is Context, ERC777 {
    bool public transferResult = true;
    bool public transferRevert = false;

    // default mint amount
    uint256 public constant defaultMintAmount = 1000 ether;

    constructor(
        address initialHolder,
        uint256 initialBalance,
        string memory name,
        string memory symbol,
        address[] memory defaultOperators
    ) public ERC777(name, symbol, defaultOperators) {
        _mint(initialHolder, initialBalance, "", "");
    }

    function mintInternal(
        address to,
        uint256 amount,
        bytes memory userData,
        bytes memory operatorData
    ) public {
        _mint(to, amount, userData, operatorData);
    }

    function approveInternal(
        address holder,
        address spender,
        uint256 value
    ) public {
        _approve(holder, spender, value);
    }

    function transfer(address recipient, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        require(!transferRevert, "Transfer reverted");
        super.transfer(recipient, amount);
        return transferResult;
    }

    function send(
        address recipient,
        uint256 amount,
        bytes memory data
    ) public virtual override {
        require(!transferRevert, "Transfer reverted");
        super.send(recipient, amount, data);
    }

    function setTransferResult(bool result) public {
        transferResult = result;
    }

    function setTransferRevert(bool result) public {
        transferRevert = result;
    }

    receive() external payable {
        _mint(msg.sender, defaultMintAmount, new bytes(0), new bytes(0));
    }
}
