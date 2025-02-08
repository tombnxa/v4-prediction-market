const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Stage 2: Factory Setup", () => {
    // Test participants
    let admin;           // Contract deployer/admin
    let userA;           // First user - will create a market
    let oracle;          // Oracle who will resolve the market
    let otherUsers;      // Other users for future trading tests
    
    // Contracts
    let ct;              // ConditionalTokens
    let dai;             // FakeDai
    let factory;         // LsLMSRFactory
    
    before(async () => {
        // Setup test participants
        [admin, userA, oracle, ...otherUsers] = await ethers.getSigners();
        console.log("\nTest Participants:");
        console.log(`Admin/Deployer: ${admin.address}`);
        console.log(`User A (Market Creator): ${userA.address}`);
        console.log(`Oracle: ${oracle.address}\n`);
    });

    describe("2.1 Infrastructure Deployment", () => {
        it("Admin should deploy ConditionalTokens first", async () => {
            console.log("Admin Actions:");
            const CT = await ethers.getContractFactory("ConditionalTokens");
            ct = await CT.deploy();
            await ct.waitForDeployment();
            expect(await ct.getAddress()).to.be.properAddress;
            console.log("1. ConditionalTokens deployed");
        });

        it("Admin should deploy FakeDai second", async () => {
            const DAI = await ethers.getContractFactory("FakeDai");
            dai = await DAI.deploy();
            await dai.waitForDeployment();
            expect(await dai.getAddress()).to.be.properAddress;
            console.log("2. FakeDai deployed");
        });

        it("Admin should deploy LsLMSRFactory last", async () => {
            const Factory = await ethers.getContractFactory("LsLMSRFactory");
            factory = await Factory.deploy(await ct.getAddress());
            await factory.waitForDeployment();
            expect(await factory.getAddress()).to.be.properAddress;
            console.log("3. LsLMSRFactory deployed\n");
        });
    });

    describe("2.2 Factory Setup", () => {
        it("Factory should have correct ConditionalTokens reference", async () => {
            console.log("Verifying factory configuration:");
            expect(await factory.conditionalTokens()).to.equal(await ct.getAddress());
            console.log("1. ConditionalTokens reference correct");
        });

        it("Factory should set admin as owner", async () => {
            expect(await factory.owner()).to.equal(admin.address);
            console.log("2. Admin ownership confirmed");
        });
    });
}); 