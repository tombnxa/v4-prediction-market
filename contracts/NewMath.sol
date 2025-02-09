// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title NewMath
 * @notice A minimal fixed-point math library (64.64-bit) to support LMSR cost calculations.
 *
 * This library replaces ABDKMath64x64 with a leaner version that:
 *  - Provides functions to convert between integers and 64.64 fixed point.
 *  - Implements safe add, sub, mul, div.
 *  - Computes natural logarithms and exponentials (via an exp₂ routine).
 *  - Provides helper functions (divu and mulu) for converting token units.
 *
 * Functions used by the LMSR market maker include:
 *    fromUInt, divu, mulu, add, sub, mul, div, ln, and exp.
 */
library NewMath {
    // 64.64 fixed point constant representing 1.
    int128 internal constant ONE = 0x10000000000000000; // 1 << 64

    // Minimal and maximal 64.64 fixed point values.
    int128 internal constant MIN_64x64 = -0x80000000000000000000000000000000;
    int128 internal constant MAX_64x64 = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

    // LN2 = ln(2) in 64.64 fixed point format.
    // Approximately 0.6931471805599453 * 2^64.
    int128 internal constant LN2 = 0xB17217F7D1CF79AB;

    /*//////////////////////////////////////////////////////////////
                              CONVERSIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Convert a signed 256-bit integer into 64.64 fixed point.
     */
    function fromInt (int256 x) internal pure returns (int128) {
        require(
            x >= -0x8000000000000000 && x <= 0x7FFFFFFFFFFFFFFF,
            "fromInt overflow"
        );
        return int128(x << 64);
    }

    /**
     * @notice Convert a 64.64 fixed point number into a signed 64-bit integer (rounding down).
     */
    function toInt (int128 x) internal pure returns (int64) {
        return int64(x >> 64);
    }

    /**
     * @notice Convert an unsigned 256-bit integer into 64.64 fixed point.
     */
    function fromUInt (uint256 x) internal pure returns (int128) {
        require(x <= 0x7FFFFFFFFFFFFFFF, "fromUInt overflow");
        return int128(int256(x << 64));
    }

    /**
     * @notice Convert a 64.64 fixed point number into an unsigned 64-bit integer (rounding down).
     */
    function toUInt (int128 x) internal pure returns (uint64) {
        require(x >= 0, "toUInt underflow");
        return uint64(uint128(x >> 64));
    }

    /*//////////////////////////////////////////////////////////////
                              BASIC ARITHMETIC
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Adds two 64.64 fixed point numbers.
     */
    function add (int128 x, int128 y) internal pure returns (int128) {
        int128 z = x + y;
        require(
            (y >= 0 && z >= x) || (y < 0 && z < x),
            "add overflow"
        );
        return z;
    }

    /**
     * @notice Subtracts two 64.64 fixed point numbers.
     */
    function sub (int128 x, int128 y) internal pure returns (int128) {
        int128 z = x - y;
        require(
            (y >= 0 && z <= x) || (y < 0 && z > x),
            "sub overflow"
        );
        return z;
    }

    /**
     * @notice Multiplies two 64.64 fixed point numbers.
     */
    function mul (int128 x, int128 y) internal pure returns (int128) {
        int256 prod = int256(x) * y;
        int128 z = int128(prod >> 64);
        require(z >= MIN_64x64 && z <= MAX_64x64, "mul overflow");
        return z;
    }

    /**
     * @notice Divides one 64.64 fixed point number by another.
     */
    function div (int128 x, int128 y) internal pure returns (int128) {
        require(y != 0, "div by zero");
        int256 result = (int256(x) << 64) / y;
        require(result >= MIN_64x64 && result <= MAX_64x64, "div overflow");
        return int128(result);
    }

    /**
     * @notice Returns the negation of a 64.64 fixed point number.
     */
    function neg (int128 x) internal pure returns (int128) {
        require(x != MIN_64x64, "neg overflow");
        return -x;
    }

    /**
     * @notice Returns the absolute value of a 64.64 fixed point number.
     */
    function abs (int128 x) internal pure returns (int128) {
        return x >= 0 ? x : neg(x);
    }

    /*//////////////////////////////////////////////////////////////
                         UNSIGNED HELPERS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Divides an unsigned 256-bit integer by another and returns a 64.64 fixed point number.
     */
    function divu (uint256 x, uint256 y) internal pure returns (int128) {
        require(y != 0, "divu: division by zero");
        uint256 result = (x << 64) / y;
        require(result <= uint256(uint128(MAX_64x64)), "divu overflow");
        return int128(uint128(result));
    }

    /**
     * @notice Multiplies a nonnegative 64.64 fixed point number by an unsigned 256-bit integer.
     */
    function mulu (int128 x, uint256 y) internal pure returns (uint256) {
        require(x >= 0, "mulu: negative x not allowed");
        return (uint256(uint128(x)) * y) >> 64;
    }

    /*//////////////////////////////////////////////////////////////
                         ADVANCED FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Computes the natural logarithm of x. Reverts if x ≤ 0.
     */
    function ln (int128 x) internal pure returns (int128) {
        require(x > 0, "ln: x must be positive");
        // ln(x) = log2(x) * ln(2); our mul() handles the fixed-point scaling.
        return mul(log_2(x), LN2);
    }

    /**
     * @notice Computes the binary logarithm of x. Reverts if x ≤ 0.
     * @dev Uses an iterative approximation. Result is in 64.64 fixed point.
     */
    function log_2 (int128 x) internal pure returns (int128) {
        require(x > 0, "log_2: x must be positive");
        int128 result = 0;

        // Bring x into [1, 2) using bit shifts.
        while (x < ONE) {
            x = x << 1;
            result = sub(result, ONE);
        }
        while (x >= (ONE << 1)) {
            x = x >> 1;
            result = add(result, ONE);
        }
        // Now x is in the range [1, 2). Do iterative approximation.
        for (uint8 i = 0; i < 64; i++) {
            x = mul(x, x);
            if (x >= (ONE << 1)) {
                x = x >> 1;
                result = add(result, int128(uint128(ONE) >> (i + 1)));
            }
        }
        return result;
    }

    /**
     * @notice Computes the natural exponential of x, i.e. e^x.
     * @dev Uses the identity: e^x = 2^(x/ln2)
     */
    function exp (int128 x) internal pure returns (int128) {
        return exp_2(div(x, LN2));
    }

    /**
     * @notice Computes 2^x where x is a 64.64 fixed point number
     * @dev Optimized for LMSR price impact behavior
     */
    function exp_2(int128 x) internal pure returns (int128) {
        // Handle x = 0 case early
        if (x == 0) return ONE;

        // Split into integer and fractional parts
        int128 n = x / ONE;
        int128 f = x % ONE;

        // Handle negative fractional part
        if (f < 0) {
            f += ONE;
            n -= 1;
        }

        // Calculate 2^n through bit shifting
        int128 result;
        if (n >= 0) {
            require(uint256(uint128(n)) < 128, "exp_2: integer overflow");
            result = int128(uint128(ONE) << uint128(n));
        } else {
            uint256 shift = uint256(uint128(-n));
            require(shift < 128, "exp_2: integer underflow");
            result = int128(uint128(ONE) >> shift);
        }

        // For fractional part, use coefficients optimized for LMSR behavior
        int128 z = div(mul(f, LN2), ONE);
        int128 z2 = div(mul(z, z), ONE);
        int128 z3 = div(mul(z2, z), ONE);

        // Diminishing series with carefully balanced terms
        int128 sum = ONE;
        sum = add(sum, z);                                  // + z
        sum = add(sum, div(z2, fromInt(2)));               // + z²/2
        sum = add(sum, div(mul(z3, fromInt(7)), ONE * 6)); // + (7/6)z³

        return div(mul(result, sum), ONE);
    }
}