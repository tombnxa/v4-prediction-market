const { expect } = require("chai");
const hre = require("hardhat");

describe("LSLMSR Market Test Suite", () => {
    // Global test state that can be shared across stages if needed
    let globalTestState = {};

    before(async () => {
        // Any one-time setup for the entire test suite
        console.log("\nStarting LSLMSR Market Test Suite...\n");
    });

    // Import and run test stages in sequence
    require("./Stage1_BaseSetup.js");
    require("./Stage2_MarketCreation.js");
    require("./Stage3_MarketSetup.js");
    // Future stages will be added here:
    // require("./Stage3_MathVerification.js");
    // require("./Stage4_TradingOperations.js");
    // require("./Stage5_MarketResolution.js");

    after(async () => {
        // Any cleanup or final assertions
        console.log("\nCompleted LSLMSR Market Test Suite\n");
    });
}); 