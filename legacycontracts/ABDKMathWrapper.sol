// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IABDKMath {
    function fromInt(int256 x) external pure returns (int128);
    function toInt(int128 x) external pure returns (int64);
    function fromUInt(uint256 x) external pure returns (int128);
    function toUInt(int128 x) external pure returns (uint64);
    // ... other needed functions
}

library ABDKMathWrapper {
    address constant ABDKMATH = address(0); // Will be set during deployment

    function fromInt(int256 x) internal pure returns (int128) {
        return IABDKMath(ABDKMATH).fromInt(x);
    }
    
    // ... other wrapper functions
} 