// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// mock class using ERC20
contract ERC20PermitMock is ERC20 {
    // default mint amount
    uint256 public constant defaultMintAmount = 1000 ether;

    constructor(
        string memory name,
        string memory symbol,
        address initialAccount,
        uint256 initialBalance
    ) public payable ERC20(name, symbol) {
        _mint(initialAccount, initialBalance);
        NAME_HASH = keccak256(bytes(name));
    }

    // erc20 permit
    mapping(address => uint256) public nonces;

    bytes32 public constant PERMIT_TYPEHASH = keccak256(
        "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
    );

    bytes32 public NAME_HASH;

    // bytes32 public constant VERSION_HASH =
    //      keccak256("1")
    bytes32
        public constant VERSION_HASH = 0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6;

    // bytes32 public constant EIP712DOMAIN_HASH =
    //      keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
    bytes32
        public constant EIP712DOMAIN_HASH = 0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f;

    // erc20 Mock
    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) public {
        _burn(account, amount);
    }

    function transferInternal(
        address from,
        address to,
        uint256 value
    ) public {
        _transfer(from, to, value);
    }

    function approveInternal(
        address owner,
        address spender,
        uint256 value
    ) public {
        _approve(owner, spender, value);
    }

    receive() external payable {
        _mint(msg.sender, defaultMintAmount);
    }

    // erc20 permit
    function _validateSignedData(
        address signer,
        bytes32 encodeData,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal view {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                EIP712DOMAIN_HASH,
                NAME_HASH,
                VERSION_HASH,
                getChainId(),
                address(this)
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator, encodeData)
        );
        address recoveredAddress = ecrecover(digest, v, r, s);
        // Explicitly disallow authorizations for address(0) as ecrecover returns address(0) on malformed messages
        require(
            recoveredAddress != address(0) && recoveredAddress == signer,
            "HEZ::_validateSignedData: INVALID_SIGNATURE"
        );
    }

    function getChainId() public pure returns (uint256 chainId) {
        assembly {
            chainId := chainid()
        }
    }

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(deadline >= block.timestamp, "HEZ::permit: AUTH_EXPIRED");
        bytes32 encodeData = keccak256(
            abi.encode(
                PERMIT_TYPEHASH,
                owner,
                spender,
                value,
                nonces[owner]++,
                deadline
            )
        );
        _validateSignedData(owner, encodeData, v, r, s);
        _approve(owner, spender, value);
    }

    // views
    function encodeDataView(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline
    ) public view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    PERMIT_TYPEHASH,
                    owner,
                    spender,
                    value,
                    nonces[owner],
                    deadline
                )
            );
    }

    function domainSeparatorView() public view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    EIP712DOMAIN_HASH,
                    NAME_HASH,
                    VERSION_HASH,
                    getChainId(),
                    address(this)
                )
            );
    }

    function digestView(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline
    ) public view returns (bytes32) {
        bytes32 encodeData = keccak256(
            abi.encode(
                PERMIT_TYPEHASH,
                owner,
                spender,
                value,
                nonces[owner],
                deadline
            )
        );
        bytes32 domainSeparator = keccak256(
            abi.encode(
                EIP712DOMAIN_HASH,
                NAME_HASH,
                VERSION_HASH,
                getChainId(),
                address(this)
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator, encodeData)
        );
        return digest;
    }
}
