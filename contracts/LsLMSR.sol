// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title An implementation for liquidity-sensitive LMSR market maker in Solidity
/// @author Abdulla Al-Kamil
/// @dev Feel free to make any adjustments to the code

import "./ConditionalTokens.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./NewMath.sol";
import "./FakeDai.sol";

/**
 * @title LsLMSR Market Maker
 * @notice This contract implements a Liquidity-Sensitive LMSR market maker that works with the
 * Conditional Tokens framework.
 * 
 * @dev This contract operates on two layers:
 * 1. Protocol Layer (Conditional Tokens):
 *    - Questions are identified by bytes32 questionId
 *    - Outcomes are represented as bit arrays (powers of 2)
 *    - Example: For 4 outcomes, valid indices are 1,2,4,8 (2^0, 2^1, 2^2, 2^3)
 * 
 * 2. Metadata Layer (Factory):
 *    - Human-readable questions stored in LsLMSRFactory
 *    - Human-readable outcomes mapped to protocol indices
 *    - Example: "Chiefs" = 1, "Ravens" = 2, etc.
 * 
 * When users interact with buy(), they must use the protocol layer indices.
 * For example:
 * - To bet on Chiefs (first outcome): market.buy(1, amount)  // 1 = 2^0
 * - To bet on Ravens (second outcome): market.buy(2, amount)  // 2 = 2^1
 */
contract LsLMSR is IERC1155Receiver, Ownable {

  /**
   * Please note: the contract utilitises the NewMath library to allow for
   * mathematical functions such as logarithms and exponents. As such, all the
   * state variables are stored as int128(signed 64.64 bit fixed point number).
   */

  using SafeERC20 for IERC20;
  using NewMath for int128;

  // State variables that CAN be immutable (known at construction)
  address public immutable token;
  ConditionalTokens public immutable conditionalTokens;

  // State variables that CANNOT be immutable (set during setup)
  uint public numOutcomes;
  bytes32 public condition;
  bytes32 public marketId;
  bool public isResolved;
  address public oracle;

  int128[] private q;
  int128 private b;
  int128 private alpha;
  int128 private current_cost;
  int128 private total_shares;

  bool public init;

  event MarketResolved(bytes32 indexed condition, uint[] payouts);

  /**
   * @notice Constructor function for the market maker
   * @param _ct The address for the deployed conditional tokens contract
   * @param _token Which ERC-20 token will be used to purchase and redeem
      outcome tokens for this condition
   */
  constructor(
    address _ct,
    address _token
  ) Ownable(msg.sender) {  // Pass factory as initial owner
    conditionalTokens = ConditionalTokens(_ct);
    token = _token;
    numOutcomes = 0; // This should be set in the setup function
    condition = bytes32(0); // This should be set in the setup function
    marketId = bytes32(0); // This should be set in the setup function
    isResolved = false;
  }

  /**
   * @notice Set up some of the variables for the market maker
   * @param _oracle The address for the EOA/contract which will act as the
      oracle for this condition
   * @param _questionId The question ID (needs to be unique)
   * @param _numOutcomes The number of different outcomes available
   * _subsidyToken Which ERC-20 token will be used to purchase and redeem
      outcome tokens for this condition
   * @param _subsidy How much initial funding is used to seed the market maker.
   * @param _overround How much 'profit' does the AMM claim? Note that this is
   * represented in bips. Therefore inputting 300 represents 0.30%
   */
  function setup(
    address _oracle,
    bytes32 _questionId,
    uint _numOutcomes,
    uint _subsidy,
    uint _overround
  ) public onlyOwner() {
    require(init == false, 'Already init');
    require(_overround > 0, 'Cannot have 0 overround');
    
    // Verify we actually have the subsidy amount
    require(
        IERC20(token).balanceOf(address(this)) >= _subsidy,
        "Insufficient subsidy balance"
    );

    // Prepare the condition
    conditionalTokens.prepareCondition(_oracle, _questionId, _numOutcomes);
    condition = conditionalTokens.getConditionId(_oracle, _questionId, _numOutcomes);

    // Initialize market parameters
    numOutcomes = _numOutcomes;
    int128 n = NewMath.fromUInt(_numOutcomes);
    int128 initial_subsidy = getTokenEth(token, _subsidy);

    int128 overround = NewMath.divu(_overround, 10000);
    alpha = NewMath.div(overround, NewMath.mul(n, NewMath.ln(n)));
    b = NewMath.mul(NewMath.mul(initial_subsidy, n), alpha);

    // Initialize outcome token quantities
    for(uint i = 0; i < _numOutcomes; i++) {
        q.push(initial_subsidy);
    }

    total_shares = NewMath.mul(initial_subsidy, n);
    current_cost = cost();
    init = true;
    oracle = _oracle;  // Store oracle address
  }

  /**
   * @notice This function is used to buy outcome tokens.
   * @param _outcome The outcome(s) which a user is buying tokens for.
      Note: This is the integer representation for the bit array.
   * @param _amount This is the number of outcome tokens purchased
   * @return _price The cost to purchase _amount number of tokens
   */
  function buy(
    uint256 _outcome,
    int128 _amount
  ) public onlyAfterInit() returns (int128 _price){
    int128 sum_total;
    require(_outcome > 0);
    require(conditionalTokens.payoutDenominator(condition) == 0, 'Market already resolved');

    for(uint j=0; j<numOutcomes; j++) {
      if((_outcome & (1<<j)) != 0) {
        q[j] = NewMath.add(q[j], _amount);
        total_shares = NewMath.add(total_shares, _amount);
      }
    }

    b = NewMath.mul(total_shares, alpha);

    for(uint i=0; i< numOutcomes; i++) {
      sum_total = NewMath.add(sum_total,
        NewMath.exp(
          NewMath.div(q[i], b)
          ));
    }

    int128 new_cost = NewMath.mul(b,NewMath.ln(sum_total));
    _price = NewMath.sub(new_cost,current_cost);
    current_cost = new_cost;

    uint token_cost = getTokenWei(token, _price);
    uint n_outcome_tokens = getTokenWei(token, _amount);
    uint pos = conditionalTokens.getPositionId(IERC20(token),
      conditionalTokens.getCollectionId(bytes32(0), condition, _outcome));

    require(IERC20(token).transferFrom(msg.sender, address(this), token_cost),
      'Error transferring tokens');

    if(conditionalTokens.balanceOf(address(this), pos) < n_outcome_tokens) {
      IERC20(token).approve(address(conditionalTokens), getTokenWei(token, _amount));
      conditionalTokens.splitPosition(IERC20(token), bytes32(0), condition,
        getPositionAndDustPositions(_outcome), n_outcome_tokens);
      }
    conditionalTokens.safeTransferFrom(address(this), msg.sender,
      pos, n_outcome_tokens, '');
  }

  function withdraw() public onlyAfterInit() onlyOwner() {
    require(conditionalTokens.payoutDenominator(condition) != 0, 'Market needs to be resolved');
    uint[] memory dust = new uint256[](numOutcomes);
    uint p = 0;
    for (uint i=0; i<numOutcomes; i++) {
      dust[i] = 1<<i;
    }
    conditionalTokens.redeemPositions(IERC20(token), bytes32(0), condition, dust);
    IERC20(token).safeTransfer(msg.sender, IERC20(token).balanceOf(address(this)));
  }

  function getOnes(uint n) internal pure returns (uint count) {
    while(n!=0) {
      n = n&(n-1);
      count++;
    }
  }

  function getPositionAndDustPositions(
    uint _outcome
  ) public view returns (uint256[] memory){
    uint index = (1<<numOutcomes)-1;
    uint inv = _outcome^index;
    uint[] memory partx = new uint256[](getOnes(inv)+1);
    uint n = 1;
    partx[0] = _outcome;
    for(uint i=0; i<numOutcomes; i++) {
      if((inv & 1<<i) != 0) {
        partx[n] = 1<<i;
        n++;
      }
    }
    return partx;
  }

  /**
   * @notice View function returning the cost function.
   *  This function returns the cost for this inventory state. It will be able
      to tell you the total amount of collateral spent within the market maker.
      For example, if a pool was seeded with 100 DAI and then a further 20 DAI
      has been spent, this function will return 120 DAI.
   */
  function cost() public view returns (int128) {
    // If not initialized, return 0
    if (!init) return 0;

    int128 sum_total;
    for(uint i=0; i< numOutcomes; i++) {
        sum_total = NewMath.add(sum_total, NewMath.exp(NewMath.div(q[i], b)));
    }
    return NewMath.mul(b, NewMath.ln(sum_total));
  }

  /**
   *  This function will tell you the cost (similar to above) after a proposed
      transaction.
   */
  function cost_after_buy(
    uint256 _outcome,
    int128 _amount
  ) public view returns (int128) {
    int128 sum_total;
    int128[] memory newq = new int128[](q.length);
    int128 TB = total_shares;

    for(uint j=0; j< numOutcomes; j++) {
      if((_outcome & (1<<j)) != 0) {
        newq[j] = NewMath.add(q[j], _amount);
        TB = NewMath.add(TB, _amount);
      } else {
        newq[j] = q[j];
      }
    }

    int128 _b = NewMath.mul(TB, alpha);

    for(uint i=0; i< numOutcomes; i++) {
      sum_total = NewMath.add(sum_total,
        NewMath.exp(
          NewMath.div(newq[i], _b)
          ));
    }

    return NewMath.mul(_b, NewMath.ln(sum_total));
  }

  /**
   *  This function tells you how much it will cost to make a particular trade.
      It does this by calculating the difference between the current cost and
      the cost after the transaction.
   */
  function price(
    uint256 _outcome,
    int128 _amount
  ) public view returns (int128) {
    return cost_after_buy(_outcome, _amount) - current_cost;
  }

  function getTokenWei(
    address _token,
    int128 _amount
  ) public view returns (uint) {
    uint d = ERC20(_token).decimals();
    return NewMath.mulu(_amount, 10 ** d);
  }

  function getTokenEth(
    address _token,
    uint _amount
  ) public view returns (int128) {
    uint d = ERC20(_token).decimals();
    return NewMath.divu(_amount, 10 ** d);
  }

  function onERC1155Received(
    address /* operator */,
    address /* from */,
    uint256 /* id */,
    uint256 /* value */,
    bytes calldata /* data */
  ) external pure override returns(bytes4) {
    return this.onERC1155Received.selector;
  }

  function onERC1155BatchReceived(
    address operator,
    address from,
    uint256[] calldata ids,
    uint256[] calldata values,
    bytes calldata data
  ) external override returns(bytes4) {
    return this.onERC1155BatchReceived.selector;
  }

   function supportsInterface(
     bytes4 interfaceId
  ) external override view returns (bool) {}

    modifier onlyAfterInit {
      require(init == true);
      _;
    }

  function resolveMarket(uint[] calldata payouts) external {
    require(msg.sender == owner(), "Only owner can resolve");
    require(!isResolved, "Market already resolved");
    require(payouts.length == numOutcomes, "Invalid payouts length");
    
    // Report payouts to ConditionalTokens contract
    conditionalTokens.reportPayouts(condition, payouts);
    
    isResolved = true;
    emit MarketResolved(condition, payouts);
  }

  // Optional: Prevent trading after resolution
  modifier notResolved() {
    require(!isResolved, "Market is resolved");
    _;
  }

  function isInitialized() public view returns (bool) {
    return init;
  }
}
