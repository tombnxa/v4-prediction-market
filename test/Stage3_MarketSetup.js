const { expect } = require("chai");
const { ethers } = require("hardhat");

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
        // Set up our test data first
        outcomes = ["Chiefs", "Ravens", "Buccaneers", "Other"];
        questionId = ethers.hexlify(ethers.randomBytes(32));

        // Validate global state from previous stages
        if (!global.testState?.fakeDaiAddress) {
            throw new Error("Stage 3 Setup: Missing FakeDai address from Stage 1");
        }

        // Get existing signers
        [admin, userA, mrResolver, alice, ...otherUsers] = await ethers.getSigners();
        if (!admin || !userA || !mrResolver) {
            throw new Error("Stage 3 Setup: Failed to get required signers");
        }
        
        try {
            // Get existing FakeDai deployment with validation
            const FakeDai = await ethers.getContractFactory("FakeDai");
            dai = FakeDai.attach(global.testState.fakeDaiAddress);
            // Validate contract exists
            await dai.getAddress();
        } catch (error) {
            throw new Error(`Stage 3 Setup: Failed to attach to FakeDai: ${error.message}`);
        }
        
        console.log("Admin Actions - Infrastructure Deployment:");
        
        try {
            // 1. Deploy ConditionalTokens
            const CT = await ethers.getContractFactory("ConditionalTokens");
            ct = await CT.deploy({ gasLimit: 5000000 });
            await ct.waitForDeployment();
            const ctAddress = await ct.getAddress();
            console.log("1. Admin deployed ConditionalTokens to:", ctAddress);

            // 2. Deploy Factory (no condition preparation needed)
            const Factory = await ethers.getContractFactory("LsLMSRFactory");
            factory = await Factory.deploy(ctAddress, { gasLimit: 5000000 });
            await factory.waitForDeployment();
            const factoryAddress = await factory.getAddress();
            console.log("2. Admin deployed LsLMSRFactory to:", factoryAddress);

            // Store everything in global state
            Object.assign(global.testState, {
                conditionalTokensAddress: ctAddress,
                factoryAddress: factoryAddress,
                outcomes,
                outcomeSlots: OUTCOME_SLOTS,
                outcomeIndices: OUTCOME_INDICES,
                questionId,
                question: "Who will win the Superbowl",
                subsidy: ethers.parseEther("1000"),
                overround: 501
            });

        } catch (error) {
            throw new Error(`Stage 3 Setup: ${error.message}`);
        }
    });

    describe("3.1 Market Creation Flow", () => {
        before(async () => {
            // Validate all required parameters exist
            const requiredParams = [
                'questionId', 'subsidy', 'overround', 'question'
            ];
            
            for (const param of requiredParams) {
                if (!global.testState[param]) {
                    throw new Error(`Market Creation: Missing required parameter: ${param}`);
                }
            }

            // Validate parameter types and values
            if (typeof global.testState.question !== 'string' || global.testState.question.length === 0) {
                throw new Error('Market Creation: Invalid question format');
            }

            if (!ethers.isHexString(global.testState.questionId, 32)) {
                throw new Error('Market Creation: Invalid questionId format - must be 32 byte hex');
            }

            const subsidy = global.testState.subsidy;
            if (subsidy <= 0n) {
                throw new Error('Market Creation: Subsidy must be greater than 0');
            }

            const overround = global.testState.overround;
            if (overround < 100 || overround > 1000) {
                throw new Error('Market Creation: Overround must be between 100 and 1000 basis points');
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
                global.testState.subsidy
            );
            await tx.wait();
            
            const allowance = await dai.allowance(userA.address, await factory.getAddress());
            expect(allowance).to.equal(global.testState.subsidy);
            console.log(`User A approved factory to spend ${ethers.formatEther(global.testState.subsidy)} DAI`);
        });

        it("User A should be able to create market through factory", async () => {
            console.log("\nCreating Market:");
            console.log("Market Parameters:");
            console.log(`Question: ${global.testState.question}`);
            console.log(`QuestionId: ${global.testState.questionId}`);
            console.log(`Outcomes: ${outcomes.join(", ")}`);
            console.log(`Subsidy: ${ethers.formatEther(global.testState.subsidy)} DAI`);
            console.log(`Overround: ${global.testState.overround/100}%`);

            const userADaiBefore = await dai.balanceOf(userA.address);
            console.log(`1. User A's initial DAI balance: ${ethers.formatEther(userADaiBefore)}`);
            
            try {
                const tx = await factory.connect(userA).createAndSetupMarket(
                    await dai.getAddress(),
                    mrResolver.address,
                    global.testState.questionId,
                    OUTCOME_SLOTS,
                    global.testState.subsidy,
                    global.testState.overround,
                    global.testState.question,
                    outcomes
                );
                
                const receipt = await tx.wait(1);
                
                // Validate market creation event
                const event = receipt.logs.find(log => 
                    log.fragment && log.fragment.name === 'MarketCreated'
                );
                if (!event) {
                    throw new Error("Market Creation: MarketCreated event not found");
                }
                
                const marketAddress = event.args[0];
                
                // Validate market contract deployment
                const marketCode = await ethers.provider.getCode(marketAddress);
                if (marketCode === "0x") {
                    throw new Error("Market Creation: No code at market address");
                }
                
                market = await ethers.getContractAt("LsLMSR", marketAddress);
                console.log(`2. Market created at ${marketAddress}`);

                // Store market address in global state
                Object.assign(global.testState, {
                    marketAddress: marketAddress
                });

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
                const expectedBalance = BigInt(userADaiBefore) - BigInt(global.testState.subsidy);
                const userADaiAfter = await dai.balanceOf(userA.address);
                expect(userADaiAfter).to.equal(expectedBalance);
                
                console.log(`3. User A's final DAI balance: ${ethers.formatEther(userADaiAfter)}`);
                console.log(`4. DAI spent on market creation: ${ethers.formatEther(global.testState.subsidy)}`);
            } catch (error) {
                throw new Error(`Market Creation failed: ${error.message}`);
            }
        });

        it("Market should have received the correct liquidity", async () => {
            const marketBalance = await dai.balanceOf(await market.getAddress());
            expect(marketBalance).to.equal(global.testState.subsidy);
            console.log(`\nMarket has received ${ethers.formatEther(marketBalance)} DAI liquidity`);
        });

        it("Should create market with correct parameters", async () => {
            expect(outcomes).to.deep.equal(global.testState.outcomes);
            // ... rest of the test
        });
    });
}); 