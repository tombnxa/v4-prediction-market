// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./NewMath.sol";

contract MathTester {
    function fromInt(int256 x) public pure returns (int128) {
        return NewMath.fromInt(x);
    }
    
    function fromUInt(uint256 x) public pure returns (int128) {
        return NewMath.fromUInt(x);
    }
    
    function exp(int128 x) public pure returns (int128) {
        return NewMath.exp(x);
    }
    
    function divu(uint256 x, uint256 y) public pure returns (int128) {
        return NewMath.divu(x, y);
    }
    
    function mulu(int128 x, uint256 y) public pure returns (uint256) {
        return NewMath.mulu(x, y);
    }
    
    function ln(int128 x) public pure returns (int128) {
        return NewMath.ln(x);
    }
}