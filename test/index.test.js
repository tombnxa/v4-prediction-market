const { expect } = require("chai");
const hre = require("hardhat");

describe("LSLMSR Market Test Suite", () => {
    before(async () => {
        // Initialize global test state with validation
        if (global.testState) {
            console.warn("Warning: global.testState already exists");
        }
        global.testState = {};
        console.log("\nStarting LSLMSR Market Test Suite...\n");
    });

    // Add state validation between stages
    afterEach(() => {
        // Verify required state exists after each stage
        if (!global.testState.fakeDaiAddress) {
            console.warn("Warning: FakeDai address not stored in global state");
        }
        if (!global.testState.conditionalTokensAddress) {
            console.warn("Warning: ConditionalTokens address not stored in global state");
        }
        if (!global.testState.factoryAddress) {
            console.warn("Warning: Factory address not stored in global state");
        }
    });

    // Tests MUST run in sequence
    describe("Stage 1: Base Setup", () => require("./Stage1_BaseSetup.js"));
    describe("Stage 2: Factory Setup", () => require("./Stage2_MarketCreation.js"));
    describe("Stage 3: Market Creation", () => require("./Stage3_MarketSetup.js"));
    describe("Stage 4: Trading", () => require("./Stage4_Trading.js"));
    // Future stages will be added here:
    // require("./Stage3_MathVerification.js");
    // require("./Stage5_MarketResolution.js");

    after(async () => {
        // Any cleanup or final assertions
        console.log("\nCompleted LSLMSR Market Test Suite\n");
    });
}); 