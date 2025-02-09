const { expect } = require("chai");
const { ethers } = require("hardhat");
const globalState = require("../shared/testState");

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
        // Get signers
        const [admin, userA, mrResolver, alice, ...otherUsers] = await ethers.getSigners();
        
        // Store signers in global state first
        globalState.signers = {
            admin,
            userA,
            mrResolver,
            alice,
            otherUsers
        };
        
        console.log("\nTest Participants:");
        console.log(`Admin/Deployer: ${admin.address}`);
        console.log(`User A (Market Creator): ${userA.address}`);
        console.log(`Market Resolver: ${mrResolver.address}`);
        console.log(`Alice (Trader): ${alice.address}\n`);
        
        // Deploy FakeDai only once
        const FakeDai = await ethers.getContractFactory("FakeDai");
        fakeDai = await FakeDai.deploy();
        await fakeDai.waitForDeployment();
        const fakeDaiAddress = await fakeDai.getAddress();
        
        // Set address in global state
        globalState.fakeDaiAddress = fakeDaiAddress;
        
        // Mint initial balances
        const initialBalance = ethers.parseEther("1000000");
        await fakeDai.mint(userA.address, initialBalance);
        await fakeDai.mint(alice.address, initialBalance);
        
        // Store balances in global state
        globalState.initialBalances = {
            userA: initialBalance.toString(),
            alice: initialBalance.toString()
        };
        
        console.log("Initial token balances minted:");
        console.log(`User A: ${ethers.formatEther(initialBalance)} DAI`);
        console.log(`Alice: ${ethers.formatEther(initialBalance)} DAI`);
        
        // Log entire state for debugging
        console.log("\nGlobal State after Stage 1 setup:");
        console.log(JSON.stringify({
            fakeDaiAddress: globalState.fakeDaiAddress,
            signers: {
                admin: globalState.signers.admin.address,
                userA: globalState.signers.userA.address,
                mrResolver: globalState.signers.mrResolver.address,
                alice: globalState.signers.alice.address
            },
            initialBalances: globalState.initialBalances
        }, null, 2));
    });

    afterEach(() => {
        // Validate required state after Stage 1
        globalState.validate('Stage 1', ['fakeDaiAddress', 'signers.userA', 'initialBalances.userA']);
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