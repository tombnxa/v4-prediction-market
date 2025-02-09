const { expect } = require("chai");
const { ethers } = require("hardhat");
const globalState = require("../shared/testState");

describe("Stage 4: Trading", () => {
    let market, dai;
    
    before(async () => {
        // Validate required state from previous stages
        globalState.validate('Stage 4 Setup', [
            'fakeDaiAddress',
            'marketAddress',
            'signers.alice',
            'initialBalances.alice',
            'outcomeIndices'
        ]);

        // Log initial state
        console.log("\nTrading Test Setup - Global State:");
        console.log(JSON.stringify({
            contracts: {
                fakeDai: globalState.fakeDaiAddress,
                market: globalState.marketAddress
            },
            trader: {
                address: globalState.signers.alice.address,
                balance: globalState.initialBalances.alice
            }
        }, null, 2));

        // Get contracts from global state
        const FakeDai = await ethers.getContractFactory("FakeDai");
        dai = FakeDai.attach(globalState.fakeDaiAddress);
        market = await ethers.getContractAt("LsLMSR", globalState.marketAddress);
        
        console.log("\nTrading Test Setup:");
        console.log(`Market Address: ${globalState.marketAddress}`);
        console.log(`FakeDai Address: ${globalState.fakeDaiAddress}`);
    });

    describe("4.1 Basic Trading", () => {
        it("Should execute a simple buy order", async () => {
            const tradeAmount = ethers.parseEther("1");
            const alice = globalState.signers.alice;
            
            // Approve market to spend DAI
            await dai.connect(alice).approve(market.getAddress(), tradeAmount);
            
            // Buy Chiefs outcome
            const tx = await market.connect(alice).buy(
                globalState.outcomeIndices.CHIEFS,
                tradeAmount
            );
            await tx.wait();
            
            // Verify trade
            const aliceBalance = await dai.balanceOf(alice.address);
            console.log(`Alice's DAI balance after trade: ${ethers.formatEther(aliceBalance)}`);
        });
    });
}); 