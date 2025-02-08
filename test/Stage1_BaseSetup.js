const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Stage 1: Base Setup", () => {
    // Test participants - consolidated signer setup
    let admin;           // Contract deployer/admin
    let userA;           // First user - will create a market
    let mrResolver;      // Our dedicated oracle for resolving markets
    let alice;           // Trading user
    let otherUsers;      // Other users for future trading tests
    
    // Contracts
    let fakeDai;         // Test ERC20 token
    
    before(async () => {
        // Setup test participants - single signer setup
        [admin, userA, mrResolver, alice, ...otherUsers] = await ethers.getSigners();
        
        console.log("\nTest Participants:");
        console.log(`Admin/Deployer: ${admin.address}`);
        console.log(`User A (Market Creator): ${userA.address}`);
        console.log(`Market Resolver: ${mrResolver.address}`);
        console.log(`Alice (Trader): ${alice.address}\n`);
        
        // Deploy FakeDai - single deployment
        const FakeDai = await ethers.getContractFactory("FakeDai");
        fakeDai = await FakeDai.deploy({ gasLimit: 5000000 });
        await fakeDai.waitForDeployment();
        const fakeDaiAddress = await fakeDai.getAddress();
        console.log("FakeDai deployed to:", fakeDaiAddress);
        
        // Store contract addresses in global state
        global.testState.fakeDaiAddress = fakeDaiAddress;
        
        // Initial balance is BigInt (wei) for contract interaction
        const initialBalance = ethers.parseEther("1000000");  // 1M * 10^18
        await fakeDai.mint(userA.address, initialBalance);
        await fakeDai.mint(alice.address, initialBalance);
        
        // Convert BigInts to strings only for display
        console.log("Initial token balances minted:");
        const userABalance = await fakeDai.balanceOf(userA.address);
        const aliceBalance = await fakeDai.balanceOf(alice.address);
        console.log(`User A: ${ethers.formatEther(userABalance)} DAI`);
        console.log(`Alice: ${ethers.formatEther(aliceBalance)} DAI`);

        // Store balances in global state
        Object.assign(global.testState, {
            fakeDaiAddress,
            initialBalances: {
                userA: userABalance.toString(),
                alice: aliceBalance.toString()
            }
        });
    });

    describe("1.1 Contract Loading", () => {
        it("Admin should be able to load contract artifacts", async () => {
            console.log("Admin verifies contract artifacts:");
            const ConditionalTokens = await ethers.getContractFactory("ConditionalTokens");
            const LsLMSRFactory = await ethers.getContractFactory("LsLMSRFactory");
            const LsLMSR = await ethers.getContractFactory("LsLMSR");
            
            expect(ConditionalTokens).to.not.be.undefined;
            expect(fakeDai).to.not.be.undefined;
            expect(LsLMSRFactory).to.not.be.undefined;
            expect(LsLMSR).to.not.be.undefined;
            console.log("✓ All contract artifacts loaded successfully");
        });
    });
}); 