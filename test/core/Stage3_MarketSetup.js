const { expect } = require("chai");
const { ethers } = require("hardhat");
const globalState = require("../shared/testState");

describe("Stage 3: Market Creation", () => {
    // Define ALL shared variables at the top level
    let ct, dai, factory, market;
    let outcomes, questionId;

    // Gnosis protocol constants
    const OUTCOME_SLOTS = 4;  // Number of possible outcomes
    const OUTCOME_INDICES = {  // Binary representation for position splitting
        CHIEFS: 1,    // 0001
        RAVENS: 2,    // 0010
        BUCS: 4,      // 0100
        OTHER: 8      // 1000
    };

    // Test participants
    let admin, userA, mrResolver, alice, otherUsers;
    
    before(async () => {
        // Validate required state from previous stages
        globalState.validate('Stage 3 Setup', [
            'fakeDaiAddress',
            'signers.admin',
            'signers.userA',
            'signers.mrResolver',
            'initialBalances.userA'
        ]);

        // Get signers from global state
        admin = globalState.signers.admin;
        userA = globalState.signers.userA;
        mrResolver = globalState.signers.mrResolver;

        // Set up market parameters
        outcomes = ["Chiefs", "Ravens", "Buccaneers", "Other"];
        questionId = ethers.hexlify(ethers.randomBytes(32));

        try {
            // Get existing FakeDai deployment
            const FakeDai = await ethers.getContractFactory("FakeDai");
            dai = FakeDai.attach(globalState.fakeDaiAddress);

            // Log state before deployment
            console.log("\nUsing existing contracts:");
            console.log(`FakeDai: ${globalState.fakeDaiAddress}`);
            
            // Deploy infrastructure
            const CT = await ethers.getContractFactory("ConditionalTokens");
            ct = await CT.deploy();
            await ct.waitForDeployment();
            const ctAddress = await ct.getAddress();
            globalState.conditionalTokensAddress = ctAddress;
            console.log(`Deployed ConditionalTokens: ${ctAddress}`);
            
            const Factory = await ethers.getContractFactory("LsLMSRFactory");
            factory = await Factory.deploy(ctAddress);
            await factory.waitForDeployment();
            const factoryAddress = await factory.getAddress();
            globalState.factoryAddress = factoryAddress;
            console.log(`Deployed Factory: ${factoryAddress}`);

            // Store market parameters in global state
            Object.assign(globalState, {
                outcomes,
                outcomeSlots: OUTCOME_SLOTS,
                outcomeIndices: OUTCOME_INDICES,
                questionId,
                question: "Who will win the Superbowl",
                subsidy: ethers.parseEther("100")
            });

            // Log updated state
            console.log("\nGlobal State after infrastructure setup:");
            console.log(JSON.stringify({
                fakeDaiAddress: globalState.fakeDaiAddress,
                conditionalTokensAddress: globalState.conditionalTokensAddress,
                factoryAddress: globalState.factoryAddress,
                marketParams: {
                    outcomes: globalState.outcomes,
                    questionId: globalState.questionId,
                    subsidy: ethers.formatEther(globalState.subsidy)
                }
            }, null, 2));

        } catch (error) {
            throw new Error(`Stage 3 Setup: ${error.message}`);
        }
    });

    describe("3.1 Market Creation Flow", () => {
        before(async () => {
            // Validate all required parameters exist
            const requiredParams = [
                'questionId', 'subsidy', 'question'
            ];
            
            for (const param of requiredParams) {
                if (!globalState[param]) {
                    throw new Error(`Market Creation: Missing required parameter: ${param}`);
                }
            }

            // Validate parameter types and values
            if (typeof globalState.question !== 'string' || globalState.question.length === 0) {
                throw new Error('Market Creation: Invalid question format');
            }

            if (!ethers.isHexString(globalState.questionId, 32)) {
                throw new Error('Market Creation: Invalid questionId format - must be 32 byte hex');
            }

            const subsidy = globalState.subsidy;
            if (subsidy <= 0n) {
                throw new Error('Market Creation: Subsidy must be greater than 0');
            }
        });

        it("Should verify User A's initial DAI balance", async () => {
            try {
                const balance = await dai.balanceOf(userA.address);
                console.log(`User A initial DAI balance: ${ethers.formatEther(balance)}`);
                if (balance === 0n) {
                    throw new Error("User A has no DAI balance");
                }
            } catch (error) {
                throw new Error(`Balance check failed: ${error.message}`);
            }
        });

        it("User A should approve factory to spend DAI", async () => {
            const tx = await dai.connect(userA).approve(
                await factory.getAddress(),
                globalState.subsidy
            );
            await tx.wait();
            
            const allowance = await dai.allowance(userA.address, await factory.getAddress());
            expect(allowance).to.equal(globalState.subsidy);
            console.log(`User A approved factory to spend ${ethers.formatEther(globalState.subsidy)} DAI`);
        });

        it("User A should be able to create market through factory", async () => {
            console.log("\nCreating Market:");
            console.log("Market Parameters:");
            console.log(`Question: ${globalState.question}`);
            console.log(`QuestionId: ${globalState.questionId}`);
            console.log(`Outcomes: ${outcomes.join(", ")}`);
            console.log(`Subsidy: ${ethers.formatEther(globalState.subsidy)} DAI`);

            const userADaiBefore = await dai.balanceOf(userA.address);
            console.log(`1. User A's initial DAI balance: ${ethers.formatEther(userADaiBefore)}`);
            
            try {
                console.log("\nStarting market creation transaction...");
                console.log("Input parameters:");
                console.log(`- DAI Address: ${await dai.getAddress()}`);
                console.log(`- Oracle Address: ${mrResolver.address}`);
                console.log(`- Question ID: ${globalState.questionId}`);
                console.log(`- Outcome Count: ${OUTCOME_SLOTS}`);
                console.log(`- Subsidy Amount: ${ethers.formatEther(globalState.subsidy)} DAI`);
                
                const tx = await factory.connect(userA).createAndSetupMarket(
                    await dai.getAddress(),
                    mrResolver.address,
                    globalState.questionId,
                    OUTCOME_SLOTS,
                    globalState.subsidy,
                    globalState.question,
                    outcomes
                );
                
                console.log("\nTransaction sent:", tx.hash);
                console.log("Waiting for confirmation...");
                
                const receipt = await tx.wait(1);
                console.log("\nTransaction confirmed!");
                console.log("Gas used:", receipt.gasUsed.toString());
                console.log("Block number:", receipt.blockNumber);
                
                // Log all events from the receipt
                console.log("\nEvents emitted:");
                receipt.logs.forEach((log, i) => {
                    try {
                        if (log.fragment) {
                            console.log(`${i + 1}. ${log.fragment.name}`);
                            console.log("   Args:", log.args);
                        } else {
                            console.log(`${i + 1}. Unknown event:`, log);
                        }
                    } catch (e) {
                        console.log(`${i + 1}. Failed to parse event:`, e.message);
                    }
                });
                
                // Validate market creation event
                const event = receipt.logs.find(log => 
                    log.fragment && log.fragment.name === 'MarketCreated'
                );
                
                if (!event) {
                    console.error("\nMarketCreated event not found in transaction logs!");
                    console.error("Available events:", receipt.logs.map(l => l.fragment?.name).join(", "));
                    throw new Error("Market Creation: MarketCreated event not found");
                }
                
                const marketAddress = event.args[0];
                
                // Store market address in global state
                globalState.marketAddress = marketAddress;
                
                // Validate market contract deployment
                const marketCode = await ethers.provider.getCode(marketAddress);
                if (marketCode === "0x") {
                    throw new Error("Market Creation: No code at market address");
                }
                
                market = await ethers.getContractAt("LsLMSR", marketAddress);
                console.log(`2. Market created at ${marketAddress}`);

                // Log updated state after market creation
                console.log("\nGlobal State after market creation:");
                console.log(JSON.stringify({
                    fakeDaiAddress: globalState.fakeDaiAddress,
                    conditionalTokensAddress: globalState.conditionalTokensAddress,
                    factoryAddress: globalState.factoryAddress,
                    marketAddress: globalState.marketAddress,
                    marketParams: {
                        outcomes: globalState.outcomes,
                        questionId: globalState.questionId,
                        subsidy: ethers.formatEther(globalState.subsidy)
                    }
                }, null, 2));

                // Validate market state
                const marketToken = await market.token();
                const marketOracle = await market.oracle();
                const marketOutcomes = await market.numOutcomes();
                const marketInit = await market.init();

                // Add detailed validation logging
                console.log("\nValidating market state:");
                console.log(`Token Address: expected=${await dai.getAddress()}, got=${marketToken}`);
                console.log(`Oracle Address: expected=${mrResolver.address}, got=${marketOracle}`);
                console.log(`Outcomes Count: ${marketOutcomes}`);
                console.log(`Market Initialized: ${marketInit}`);

                if (marketToken !== await dai.getAddress()) {
                    throw new Error("Market Creation: Incorrect token address");
                }
                if (marketOracle !== mrResolver.address) {
                    throw new Error("Market Creation: Incorrect oracle address");
                }
                const expectedOutcomes = outcomes.length;  // Should match the array length
                if (!marketInit) {
                    throw new Error("Market Creation: Market not initialized");
                }

                // Validate balance changes
                const expectedBalance = BigInt(userADaiBefore) - BigInt(globalState.subsidy);
                const userADaiAfter = await dai.balanceOf(userA.address);
                expect(userADaiAfter).to.equal(expectedBalance);
                
                console.log(`3. User A's final DAI balance: ${ethers.formatEther(userADaiAfter)}`);
                console.log(`4. DAI spent on market creation: ${ethers.formatEther(globalState.subsidy)}`);
            } catch (error) {
                console.error("\nDetailed error information:");
                console.error("Error name:", error.name);
                console.error("Error message:", error.message);
                if (error.transaction) {
                    console.error("Transaction hash:", error.transaction.hash);
                }
                if (error.receipt) {
                    console.error("Transaction receipt:", error.receipt);
                }
                throw error;
            }

            // Move validation here after market creation succeeds
            after(() => {
                globalState.validate('Stage 3', [
                    'marketAddress',
                    'conditionalTokensAddress',
                    'factoryAddress'
                ]);
            });
        });

        it("Market should have received the correct liquidity", async () => {
            const marketBalance = await dai.balanceOf(await market.getAddress());
            expect(marketBalance).to.equal(globalState.subsidy);
            console.log(`\nMarket has received ${ethers.formatEther(marketBalance)} DAI liquidity`);
        });

        it("Should create market with correct parameters", async () => {
            expect(outcomes).to.deep.equal(globalState.outcomes);
            // ... rest of the test
        });
    });
});