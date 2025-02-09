// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FakeDai is ERC20 {
    constructor() ERC20('Test Dai', 'DAI') {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}
