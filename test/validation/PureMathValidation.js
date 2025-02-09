const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Pure LMSR Math Validation", function() {
    let mathTester;
    const NUM_OUTCOMES = 4;
    const INITIAL_LIQUIDITY = 100; // 100 DAI initial liquidity
    
    before(async function() {
        console.log("\nPure Math Validation Setup:");
        const MathTester = await ethers.getContractFactory("MathTester");
        mathTester = await MathTester.deploy();
        console.log("MathTester deployed to:", mathTester.address);
        console.log(`Testing with ${NUM_OUTCOMES} outcomes`);
        console.log(`Test liquidity: ${INITIAL_LIQUIDITY}.0 DAI`);
    });

    describe("LMSR Price Discovery", function() {
        it("Should demonstrate correct price impact behavior", async function() {
            const ONE = await mathTester.getONE();
            
            // Initial state setup
            const initialLiquidity = await mathTester.fromUInt(INITIAL_LIQUIDITY);
            const numOutcomes = await mathTester.fromUInt(NUM_OUTCOMES);
            const alpha = await mathTester.div(ONE, await mathTester.mul(numOutcomes, await mathTester.ln(numOutcomes)));
            
            console.log("\nLSMR Price Impact Analysis");
            console.log("============================");
            
            // Test increasing position sizes
            const testAmounts = [0.1, 0.3, 0.9, 2.7];
            let lastPrice = 0;
            
            for(let i = 0; i < testAmounts.length; i++) {
                const amount = testAmounts[i];
                const shares = await mathTester.fromUInt(INITIAL_LIQUIDITY + amount);
                const newB = await mathTester.mul(shares, alpha);
                
                // Calculate qi/b for the target outcome
                const qi = await mathTester.fromUInt(INITIAL_LIQUIDITY + amount);
                const qiOverB = await mathTester.div(qi, newB);
                
                // Calculate qj/b for other outcomes
                const qj = await mathTester.fromUInt(INITIAL_LIQUIDITY);
                const qjOverB = await mathTester.div(qj, newB);
                
                // Calculate e^(qi/b) and e^(qj/b)
                const expQi = await mathTester.exp(qiOverB);
                const expQj = await mathTester.exp(qjOverB);
                
                // Calculate price: e^(qi/b) / (e^(qi/b) + 3*e^(qj/b))
                const denominator = await mathTester.add(
                    expQi,
                    await mathTester.mul(
                        await mathTester.fromUInt(NUM_OUTCOMES - 1),
                        expQj
                    )
                );
                
                const price = await mathTester.div(expQi, denominator);
                
                // Convert to decimal for readability
                const priceDecimal = Number(price) / Number(ONE);
                
                console.log(`\nPosition Size: ${amount} DAI`);
                console.log(`Price: ${(priceDecimal * 100).toFixed(4)}%`);
                
                if(i > 0) {
                    const priceChange = priceDecimal - lastPrice;
                    const marginalImpact = priceChange / (amount - testAmounts[i-1]);
                    console.log(`Marginal Impact: ${(marginalImpact * 100).toFixed(4)}%/DAI`);
                    
                    if(i > 1) {
                        // The key test: Marginal impact should decrease
                        const lastMarginalImpact = (lastPrice - prevPrice) / 
                            (testAmounts[i-1] - testAmounts[i-2]);
                        expect(marginalImpact).to.be.below(lastMarginalImpact);
                    }
                }
                
                const prevPrice = lastPrice;
                lastPrice = priceDecimal;
            }
        });
    });
});