//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MicroToken is ERC20 {
    constructor() ERC20("Micro", "MICRO") {
        _mint(msg.sender, 100 * 10**6 * 10**18);
    }
}
