const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Stage 1: Base Setup", () => {
    // Test participants
    let admin;           // Contract deployer/admin
    let userA;           // First user - will create a market
    let mrResolver;      // Our dedicated oracle for resolving markets
    let otherUsers;      // Other users for future trading tests

    before(async () => {
        // Setup test participants
        [admin, userA, mrResolver, ...otherUsers] = await ethers.getSigners();
        console.log("\nTest Participants:");
        console.log(`Admin/Deployer: ${admin.address}`);
        console.log(`User A (Market Creator): ${userA.address}`);
        console.log(`Market Resolver: ${mrResolver.address}\n`);
    });

    describe("1.1 Contract Loading", () => {
        it("Admin should be able to load contract artifacts", async () => {
            console.log("Admin verifies contract artifacts:");
            const ConditionalTokens = await ethers.getContractFactory("ConditionalTokens");
            const FakeDai = await ethers.getContractFactory("FakeDai");
            const LsLMSRFactory = await ethers.getContractFactory("LsLMSRFactory");
            const LsLMSR = await ethers.getContractFactory("LsLMSR");
            
            expect(ConditionalTokens).to.not.be.undefined;
            expect(FakeDai).to.not.be.undefined;
            expect(LsLMSRFactory).to.not.be.undefined;
            expect(LsLMSR).to.not.be.undefined;
            console.log("✓ All contract artifacts loaded successfully");
        });
    });
}); 