// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ConditionalTokens.sol";
import "./LsLMSR.sol";
import "./NewMath.sol";

contract LsLMSRFactory is Ownable {
    using SafeERC20 for IERC20;
    
    ConditionalTokens public immutable conditionalTokens;
    
    // Track all deployed markets
    LsLMSR[] public markets;
    
    // Add oracle functionality
    mapping(address => bool) public isOracle;
    
    event MarketCreated(address market, address creator);
    event MarketSetup(address market, bytes32 questionId, uint numOutcomes);
    
    struct MarketDetails {
        string question;
        string[] outcomes;
        address market;
        bool exists;
    }
    
    // Map market address to its details
    mapping(address => MarketDetails) public marketDetails;
    
    constructor(address _conditionalTokens) Ownable(msg.sender) {
        conditionalTokens = ConditionalTokens(_conditionalTokens);
    }
    
    function createAndSetupMarket(
        address collateralToken,
        address oracle,
        bytes32 questionId,
        uint outcomeCount,
        uint subsidy,
        string memory question,
        string[] memory outcomes
    ) external returns (address) {
        // First pull tokens from market creator
        IERC20(collateralToken).safeTransferFrom(
            msg.sender,    // from market creator
            address(this), // to factory first
            subsidy
        );

        // Create new market (factory is owner)
        LsLMSR market = new LsLMSR(
            address(conditionalTokens),
            collateralToken
        );

        // Transfer tokens to market - NO NEED FOR APPROVE
        IERC20(collateralToken).safeTransfer(
            address(market),
            subsidy
        );

        // Setup market
        market.setup(
            oracle,
            questionId,
            outcomeCount,
            subsidy
        );

        markets.push(market);
        
        // Store human-readable details
        marketDetails[address(market)] = MarketDetails({
            question: question,
            outcomes: outcomes,
            market: address(market),
            exists: true
        });
        
        emit MarketCreated(address(market), msg.sender);
        emit MarketSetup(address(market), questionId, outcomeCount);
        
        return address(market);
    }
    
    function getMarket(uint index) external view returns (address) {
        return address(markets[index]);
    }
    
    function getMarketCount() external view returns (uint) {
        return markets.length;
    }
    
    function addOracle(address oracle) external onlyOwner {
        isOracle[oracle] = true;
    }
    
    function resolveMarket(
        address market,
        uint[] calldata payouts
    ) external {
        require(isOracle[msg.sender], "Not authorized");
        LsLMSR(market).resolveMarket(payouts);
    }
    
    // Getter for market details
    function getMarketDetails(address market) 
        external 
        view 
        returns (
            string memory question,
            string[] memory outcomes
        ) 
    {
        require(marketDetails[market].exists, "Market not found");
        return (
            marketDetails[market].question,
            marketDetails[market].outcomes
        );
    }
} 