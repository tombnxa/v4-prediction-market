const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Stage 4: Trading", function() {
    let admin, userA, mrResolver, alice, otherUsers;
    let fakeDai, conditionalTokens, factory, market;
    let question, outcomes;
    let OUTCOMES;

    before(async function() {
        // Validate all required state exists
        const requiredState = [
            'fakeDaiAddress',
            'conditionalTokensAddress',
            'factoryAddress',
            'marketAddress',
            'outcomes',
            'outcomeIndices'
        ];

        for (const key of requiredState) {
            if (!global.testState[key]) {
                throw new Error(`Stage 4: Missing required state: ${key}`);
            }
            // Add address validation for contract addresses
            if (key.endsWith('Address')) {
                if (!ethers.isAddress(global.testState[key])) {
                    throw new Error(`Stage 4: Invalid address for ${key}: ${global.testState[key]}`);
                }
            }
        }

        // Log global state for debugging
        console.log("\nGlobal State at Stage 4:");
        console.log(JSON.stringify({
            ...global.testState,
            subsidy: global.testState.subsidy.toString(),
            // Convert any other BigInts to strings
            outcomeIndices: Object.fromEntries(
                Object.entries(global.testState.outcomeIndices)
                    .map(([k, v]) => [k, v.toString()])
            )
        }, null, 2));

        expect(global.testState.outcomeIndices).to.exist;
        
        // Retrieve outcome indices from global state
        // These are regular numbers (1,2,4,8) representing powers of 2
        OUTCOMES = global.testState.outcomeIndices;
        
        // Get existing signers
        [admin, userA, mrResolver, alice, ...otherUsers] = await ethers.getSigners();
        
        // Get deployed contract instances with proper error handling
        try {
            const FakeDai = await ethers.getContractFactory("FakeDai");
            fakeDai = FakeDai.attach(global.testState.fakeDaiAddress);
            await fakeDai.getAddress(); // Verify contract exists

            const CT = await ethers.getContractFactory("ConditionalTokens");
            conditionalTokens = CT.attach(global.testState.conditionalTokensAddress);
            await conditionalTokens.getAddress(); // Verify contract exists

            const Factory = await ethers.getContractFactory("LsLMSRFactory");
            factory = Factory.attach(global.testState.factoryAddress);
            await factory.getAddress(); // Verify contract exists

            const LsLMSR = await ethers.getContractFactory("LsLMSR");
            market = LsLMSR.attach(global.testState.marketAddress);
            const marketCode = await ethers.provider.getCode(global.testState.marketAddress);
            if (marketCode === "0x") {
                throw new Error("No code at market address");
            }
        } catch (error) {
            throw new Error(`Contract attachment failed: ${error.message}`);
        }
        
        // Get market details
        const marketDetails = await factory.getMarketDetails(global.testState.marketAddress);
        question = marketDetails.question;
        outcomes = marketDetails.outcomes;
        
        console.log("\nTrading on market:");
        console.log(`Question: ${question}`);
        console.log(`Outcomes: ${outcomes.join(", ")}`);
        console.log(`Market Address: ${global.testState.marketAddress}`);
        
        // Log outcome mapping
        // index is a regular number, not BigInt, safe for Math operations
        console.log("\nOutcome Index Mapping:");
        for (const [outcome, index] of Object.entries(OUTCOMES)) {
            console.log(`${outcome}: ${index} (2^${Math.floor(Math.log2(index))})`);
        }
        console.log("");
        
        // Verify market
        expect(question).to.equal("Who will win the Superbowl");
        expect(outcomes).to.deep.equal(["Chiefs", "Ravens", "Buccaneers", "Other"]);

        // Verify Alice's balance and allowance
        const aliceBalance = await fakeDai.balanceOf(alice.address);
        const marketAddress = await market.getAddress();
        const allowance = await fakeDai.allowance(alice.address, marketAddress);
        
        console.log(`Alice's balance: ${ethers.formatEther(aliceBalance)} DAI`);
        console.log(`Alice's allowance: ${ethers.formatEther(allowance)} DAI`);
        
        const TRADE_AMOUNT = ethers.parseEther("100");  // 100 * 10^18
        if (aliceBalance < TRADE_AMOUNT) {
            throw new Error(`Insufficient balance: ${ethers.formatEther(aliceBalance)} < ${ethers.formatEther(TRADE_AMOUNT)}`);
        }
    });

    describe("Alice's First Trade", function() {
        // TRADE_AMOUNT is BigInt (wei) for token operations
        const TRADE_AMOUNT = ethers.parseEther("100");  // 100 * 10^18
        // CHOSEN_OUTCOME is regular number (1,2,4,8) for market interaction
        let CHOSEN_OUTCOME;

        before(async function() {
            CHOSEN_OUTCOME = OUTCOMES.CHIEFS;
            
            // Verify Alice has DAI
            const aliceBalance = await fakeDai.balanceOf(alice.address);
            console.log(`Alice's initial DAI balance: ${ethers.formatEther(aliceBalance)}`);
            if (aliceBalance < TRADE_AMOUNT) {
                throw new Error(`Alice needs at least ${ethers.formatEther(TRADE_AMOUNT)} DAI for trading`);
            }
        });

        it("Should allow Alice to approve tokens for trading", async function() {
            const marketAddress = await market.getAddress();
            
            // Approve with much higher allowance (2000 DAI to be safe)
            const APPROVAL_AMOUNT = ethers.parseEther("2000");
            await fakeDai.connect(alice).approve(marketAddress, APPROVAL_AMOUNT);
            
            const allowance = await fakeDai.allowance(alice.address, marketAddress);
            expect(allowance).to.equal(APPROVAL_AMOUNT);
            console.log(`Alice approved ${ethers.formatEther(APPROVAL_AMOUNT)} DAI for trading`);
        });

        it("Should allow Alice to buy outcome tokens for Chiefs", async function() {
            const marketAddress = await market.getAddress();
            const fakeDaiAddress = await fakeDai.getAddress();
            
            // Use binary outcome index (1,2,4,8) not array index
            const outcomeIndex = OUTCOMES.CHIEFS;  // This is 1 (2^0)
            console.log(`Buying outcome index: ${outcomeIndex}`);
            
            // Calculate tokens we'll receive
            const outcomeTokens = await market.getTokenEth(fakeDaiAddress, TRADE_AMOUNT);
            console.log(`Attempting to buy ${ethers.formatUnits(outcomeTokens)} outcome tokens`);
            
            // Execute trade using binary outcome index
            const tx = await market.connect(alice).buy(
                outcomeIndex,  // Must be > 0
                TRADE_AMOUNT
            );
            await tx.wait();
            
            // Verify using same position calculation as contract
            const positionId = await conditionalTokens.getPositionId(
                fakeDaiAddress,
                await conditionalTokens.getCollectionId(
                    ethers.ZeroHash,
                    await market.condition(),
                    outcomeIndex  // Use same index here
                )
            );
            
            const balance = await conditionalTokens.balanceOf(alice.address, positionId);
            console.log(`Alice received ${ethers.formatUnits(balance)} outcome tokens for Chiefs`);
            expect(balance).to.be.gt(0);
        });
    });
}); 