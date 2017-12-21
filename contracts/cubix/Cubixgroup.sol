pragma solidity ^0.4.11;

import '../token/Token.sol';


/**
 Cubixgroup Token based on OpenZeppelin token contract
 */
contract Cubixgroup is Token {

  string public constant name = "Cubixgroup";
  string public constant symbol = "CUB";
  uint8 public constant decimals = 18;
  uint256 public constant INITIAL_SUPPLY = 8000000 * (10 ** uint256(decimals));

  function Cubixgroup(address _dataCentreAddr)
    Token(_dataCentreAddr)
  {

  }

}
