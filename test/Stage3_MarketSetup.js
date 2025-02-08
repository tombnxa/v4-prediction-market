const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Stage 3: Market Creation", () => {
    // Test participants
    let admin;           // Contract deployer/admin
    let userA;           // First user - will create a market
    let mrResolver;      // Our dedicated oracle for resolving markets
    let otherUsers;      // Other users for future trading tests
    
    // Contracts
    let ct;              // ConditionalTokens
    let dai;             // FakeDai
    let factory;         // LsLMSRFactory
    let market;          // Created LSLMSR instance
    
    before(async () => {
        // Setup test participants
        [admin, userA, mrResolver, ...otherUsers] = await ethers.getSigners();
        console.log("\nTest Participants:");
        console.log(`Admin/Deployer: ${admin.address}`);
        console.log(`User A (Market Creator): ${userA.address}`);
        console.log(`Market Resolver: ${mrResolver.address}\n`);
        
        // Admin deploys infrastructure
        console.log("Admin Actions - Infrastructure Deployment:");
        
        const CT = await ethers.getContractFactory("ConditionalTokens");
        ct = await CT.deploy();
        await ct.waitForDeployment();
        console.log("1. Admin deployed ConditionalTokens");

        const DAI = await ethers.getContractFactory("FakeDai");
        dai = await DAI.deploy();
        await dai.waitForDeployment();
        console.log("2. Admin deployed FakeDai");

        // Mint initial DAI to User A
        const initialDai = ethers.parseEther("2000");
        await dai.connect(admin).mint(userA.address, initialDai);
        console.log(`3. Admin minted ${ethers.formatEther(initialDai)} DAI to User A`);

        const Factory = await ethers.getContractFactory("LsLMSRFactory");
        factory = await Factory.deploy(await ct.getAddress());
        await factory.waitForDeployment();
        console.log("4. Admin deployed LsLMSRFactory\n");
    });

    describe("3.1 Market Creation Flow", () => {
        const questionId = ethers.hexlify(ethers.randomBytes(32));
        const outcomes = ["Yes", "No", "Maybe"];
        const subsidy = ethers.parseEther("1000");
        const overround = 501; // 5.01%

        it("Should verify User A's initial DAI balance", async () => {
            const balance = await dai.balanceOf(userA.address);
            expect(balance).to.equal(ethers.parseEther("2000"));
            console.log(`User A initial DAI balance: ${ethers.formatEther(balance)}`);
        });

        it("User A should approve factory to spend DAI", async () => {
            const tx = await dai.connect(userA).approve(
                await factory.getAddress(),
                subsidy
            );
            await tx.wait();
            
            const allowance = await dai.allowance(userA.address, await factory.getAddress());
            expect(allowance).to.equal(subsidy);
            console.log(`User A approved factory to spend ${ethers.formatEther(subsidy)} DAI`);
        });

        it("User A should be able to create market through factory", async () => {
            console.log("\nCreating Market:");
            const userADaiBefore = await dai.balanceOf(userA.address);
            console.log(`1. User A's initial DAI balance: ${ethers.formatEther(userADaiBefore)}`);
            
            const tx = await factory.connect(userA).createAndSetupMarket(
                await dai.getAddress(),
                mrResolver.address,
                questionId,
                outcomes.length,
                subsidy,
                overround,
                "Will this test pass?",
                outcomes
            );
            
            const receipt = await tx.wait(1);
            // Find MarketCreated event
            const event = receipt.logs.find(log => 
                log.fragment && log.fragment.name === 'MarketCreated'
            );
            console.log("Found event:", event);
            expect(event).to.not.be.undefined;
            
            const marketAddress = event.args[0];  // First arg is market address
            market = await ethers.getContractAt("LsLMSR", marketAddress);
            console.log(`2. Market created at ${await market.getAddress()}`);

            // Verify User A's DAI was taken
            const userADaiAfter = await dai.balanceOf(userA.address);
            expect(userADaiAfter).to.equal(userADaiBefore - subsidy);
            console.log(`3. User A's final DAI balance: ${ethers.formatEther(userADaiAfter)}`);
            console.log(`4. DAI spent on market creation: ${ethers.formatEther(subsidy)}`);
        });

        it("Market should be initialized with correct parameters", async () => {
            console.log("\nVerifying market parameters:");
            expect(await market.token()).to.equal(await dai.getAddress());
            console.log("1. Correct token (DAI) set");
            
            expect(await market.oracle()).to.equal(mrResolver.address);
            console.log("2. Correct oracle set");
            
            expect(await market.numOutcomes()).to.equal(outcomes.length);
            console.log("3. Correct number of outcomes");
            
            expect(await market.init()).to.be.true;
            console.log("4. Market initialized");
        });

        it("Market should have received the correct liquidity", async () => {
            const marketBalance = await dai.balanceOf(await market.getAddress());
            expect(marketBalance).to.equal(subsidy);
            console.log(`\nMarket has received ${ethers.formatEther(marketBalance)} DAI liquidity`);
        });
    });
}); 