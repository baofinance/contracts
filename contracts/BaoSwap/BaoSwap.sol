// SPDX-License-Identifier: Unlicensed

pragma solidity ^0.6.11;

import "../utils/Ownable.sol";
import "../utils/Pausable.sol";
import "../utils/ERC20.sol";
import "../utils/SafeMath.sol";

contract BaoSwap is Ownable, Pausable {
    using SafeMath for uint;
    
	address private _token1;
	address private _token2;
	
	uint8 private _fee;
	
	struct Balance {
		uint256 balance1;
		uint256 balance2;
		address depositedToken;
		uint256 pendingBlock;
	}
	
	mapping (address => Balance) private _pendingBalances;
	
	constructor(address token1, address token2) Ownable() public {
		_token1 = token1;
		_token2 = token2;
	}
	
	modifier onlySupportedToken(address token) {
		require(token == _token1 || token == _token2, "Unsupported token");
		_;
	}
	
	modifier noDeposit(address account) {
		require(_pendingBalances[account].depositedToken == address(0), "Deposit already open");
		_;
	}
	
	function token1() public view returns (address) {
		return _token1;
	}
	
	function token2() public view returns (address) {
		return _token2;
	}
	
	function balance1() public view returns (uint256) {
	    return ERC20(_token1).balanceOf(address(this));
	} 
	
	function balance2() public view returns (uint256) {
	    return ERC20(_token2).balanceOf(address(this));
	}
	
	function fee() public view returns (uint8) {
		return _fee;
	}
	
	function depositedToken(address account) public view returns (address) {
		return _pendingBalances[account].depositedToken;
	}
	
	function pendingBlock(address account) public view returns (uint256) {
		return _pendingBalances[account].pendingBlock;
	}
	
	function pendingBalance(address account, address token) onlySupportedToken(token) public view returns (uint256) {
		if (token == _pendingBalances[account].depositedToken) {
			return _pendingBalances[account].balance1;
		}
		return _pendingBalances[account].balance2;
	}
	
	function canWithdraw(address account) public view returns (bool) {
	    return _pendingBalances[account].pendingBlock <= block.number && _pendingBalances[account].balance1 > 0;
	}
	
	function withdrawableBalance(address account, address token) onlySupportedToken(token) public view returns (uint256) {
		if (_pendingBalances[account].pendingBlock > block.number) {
			return 0;
		}
		if (token == _pendingBalances[account].depositedToken) {
			return _pendingBalances[account].balance1;
		}
		return _pendingBalances[account].balance2;
	}
	
	function swap(address fromToken, uint256 amount) private view returns (uint256) {
		ERC20 erc1 = ERC20(fromToken);
		ERC20 erc2 = fromToken == _token1 ? ERC20(_token2) : ERC20(_token1);
		return amount.mul(10**uint256(erc2.decimals())).div(10**uint256(erc1.decimals()));
	}
	
	function applyFee(uint256 amount) private view returns (uint256) {
	    if (_fee == 0) {
	        return amount;
	    }
	    return amount.mul(100-_fee).div(100);
	}
	
	function swapWithFee(address fromToken, uint256 amount) public view returns (uint256) {
	    return applyFee(swap(fromToken, amount));
	}
	
	function deposit(address token, uint256 amount) whenNotPaused() onlySupportedToken(token) noDeposit(msg.sender) public {
		require(amount > 0, "Zero amount");
		ERC20 erc = ERC20(token);
		uint256 balance = erc.balanceOf(address(this));
		require(erc.transferFrom(msg.sender, address(this), amount), "Token transfer failed");
		uint256 newBalance = erc.balanceOf(address(this));
		require(newBalance > balance, "No tokens were received");
		uint256 received = newBalance - balance;               //this can't underflow
		uint256 _balance2 = swapWithFee(token, received);
		require(_balance2 > 0, "Amount too low");
		_pendingBalances[msg.sender] = Balance(applyFee(received), _balance2, token, block.number+1);
	}
	
	function withdraw(address token) whenNotPaused() onlySupportedToken(token) public {
		uint256 balance = withdrawableBalance(msg.sender, token);
		require (balance > 0, "No withdrawable balance");
		_pendingBalances[msg.sender] = Balance(0, 0, address(0), 0);
		ERC20 erc = ERC20(token);
		require(erc.transfer(msg.sender, balance), "Token transfer failed");
	}
	
	function setFee(uint8 __fee) onlyOwner() public {
		require(__fee < 100, "Fee can't be 100 or higher");
		_fee = __fee;
	}
	
	function pause() onlyOwner() public {
		_pause();
	}
	
	function unpause() onlyOwner() public {
		_unpause();
	}
	
	function withdrawOnlyAdmin(address token, uint256 amount) onlyOwner() public {
		ERC20(token).transfer(msg.sender, amount);
	}
}