const { expect } = require("chai");
const hre = require("hardhat");
const globalState = require("./shared/testState");

// Check environment flags
const VALIDATION = process.env.VALIDATION === 'true';
const TRADING = process.env.TRADING === 'true';

describe("LSLMSR Market Test Suite", () => {
    before(async () => {
        console.log("\nStarting LSLMSR Market Test Suite...\n");
        
        // Log test configuration
        console.log("Test Configuration:");
        console.log(`  Validation Tests: ${VALIDATION ? 'Enabled' : 'Disabled'}`);
        console.log(`  Trading Tests: ${TRADING ? 'Enabled' : 'Disabled'}\n`);
    });

    // Add state validation between stages
    afterEach(() => {
        // Verify required state exists after each stage
        if (!globalState.fakeDaiAddress) {
            console.warn("Warning: FakeDai address not stored in global state");
        }
        if (!globalState.conditionalTokensAddress) {
            console.warn("Warning: ConditionalTokens address not stored in global state");
        }
        if (!globalState.factoryAddress) {
            console.warn("Warning: Factory address not stored in global state");
        }
    });

    // Core setup - always runs
    describe("Core Setup", () => {
        // Force sequential execution
        before(() => console.log("Starting Core Setup..."));
        describe("Stage 1: Base Setup", () => require("./core/Stage1_BaseSetup.js"));
        after(() => {
            globalState.validate('After Stage 1', ['fakeDaiAddress', 'signers.userA']);
        });
        
        describe("Stage 2: Market Creation", () => require("./core/Stage2_MarketCreation.js"));
        describe("Stage 3: Market Setup", () => require("./core/Stage3_MarketSetup.js"));
        after(() => {
            globalState.validate('After Core Setup', [
                'marketAddress',
                'conditionalTokensAddress',
                'factoryAddress'
            ]);
        });
    });

    // Validation tests - only if VALIDATION=true
    if (VALIDATION) {
        describe("Validation Tests", () => {
            describe("Pure Math Validation", () => require("./validation/PureMathValidation.js"));
        });
    }

    // Trading tests - only if TRADING=true
    if (TRADING) {
        describe("Trading Tests", () => {
            describe("Stage 4: Trading", () => require("./trading/Stage4_Trading.js"));
        });
    }

    after(async () => {
        // Any cleanup or final assertions
        console.log("\nCompleted LSLMSR Market Test Suite\n");
    });
}); 