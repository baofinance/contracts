const BaoSwap = artifacts.require("BaoSwap");
const MockERC20 = artifacts.require("MockERC20");
const MockERC677 = artifacts.require("MockERC677");

contract("BaoSwap", accounts => {
	const decimals1 = 8;
	const decimals2 = 18;
	let token1;
	let token2;
	let baoSwap;
	
	function minePendingTransactions(time) {
		return new Promise((resolve, reject) => {
			web3.currentProvider.send({
				jsonrpc: '2.0',
				method: 'evm_mine',
				params: [time],
				id: new Date().getTime(),
			}, (err, result) => {
				if (err) reject(err)
				resolve(result)
			})
		})
	}
	
	function stopMining() {
		return new Promise((resolve, reject) => {
			web3.currentProvider.send({
				jsonrpc: '2.0',
				method: 'miner_stop',
				params: [],
				id: new Date().getTime(),
			}, (err, result) => {
				if (err) reject(err)
				resolve(result)
			})
		})
	}

	function startMining() {
		return new Promise((resolve, reject) => {
			web3.currentProvider.send({
				jsonrpc: '2.0',
				method: 'miner_start',
				params: [],
				id: new Date().getTime(),
			}, (err, result) => {
				if (err) reject(err)
				resolve(result)
			})
		})
	}
	
	function token1Amount(a) {			//don't use with deep fractions
		if (decimals1 <= 10) {
			return a * 10**decimals1;
		}
		return a == 0 ? 0 : (a * 10**10).toString() + "0".repeat(decimals1-10);
    }
	
	function token2Amount(a) {			//don't use with deep fractions
		if (decimals2 <= 10) {
			return a * 10**decimals2;
		}
		return a == 0 ? 0 : (a * 10**10).toString() + "0".repeat(decimals2-10);
    }
	
	async function assertBalance(token, account, balance) {
		await token.balanceOf.call(account)
			.then(b => {
				assert.equal(
					b,
					(token == token1 ? token1Amount(balance) : token2Amount(balance)),
					`should have ${balance} of ${token.address}`
				);
			});
	}
	
	async function assertBalanceString(token, account, balance) {
		await token.balanceOf.call(account)
			.then(b => {
				assert.equal(
					b,
					balance,
					`should have ${balance} of ${token.address}`
				);
			});
	}
	
	async function assertPendingBalance(token, account, balance) {
		await baoSwap.pendingBalance(account, token.address)
			.then(b => {
				assert.equal(
					b,
					(token == token1 ? token1Amount(balance) : token2Amount(balance)),
					`should have ${balance} pendingBalance of ${token.address}`
				);
			});
	}
	
	async function assertPendingBalanceString(token, account, balance) {
		await baoSwap.pendingBalance(account, token.address)
			.then(b => {
				assert.equal(
					b,
					balance,
					`should have ${balance} pendingBalance of ${token.address}`
				);
			});
	}
	
	async function assertWithdrawableBalance(token, account, balance) {
		await baoSwap.withdrawableBalance(account, token.address)
			.then(b => {
				assert.equal(
					b,
					(token == token1 ? token1Amount(balance) : token2Amount(balance)),
					`should have ${balance} withdrawableBalance of ${token.address}`
				);
			});
	}
	
	async function assertWithdrawableBalanceString(token, account, balance) {
		await baoSwap.withdrawableBalance(account, token.address)
			.then(b => {
				assert.equal(
					b,
					balance,
					`should have ${balance} withdrawableBalance of ${token.address}`
				);
			});
	}
	
	it('contracts deployed, accounts[0] is owner, accounts[1] and accounts[2] have 100 of token1 and token2', async () => {
		await MockERC20.deployed()																//deploying erc20, checking balance
			.then(instance => {
				token1 = instance;
				instance.balanceOf.call(accounts[0])
					.then(balance => {
						assert.equal(
							balance,
							token1Amount(100000),
							"didn't find 100000 of token1"
						);
					});
			});
		await MockERC677.deployed()																//deploying erc677, checking balance
			.then(instance => {
				token2 = instance;
				instance.balanceOf.call(accounts[0])
					.then(balance => {
						assert.equal(
							balance,
							token2Amount(100000),
							"didn't find 100000 of token2"
						);
					});
			});
		await token1.transfer(accounts[1], (100*10**decimals1).toString())						//transferring 100 of token1 to accounts[1]
			.then(result => {
				assertBalance(token1, accounts[1], 100)
			});
		await token2.transfer(accounts[1], (100*10**decimals2).toString())						//transferring 100 of token2 to accounts[1]
			.then(result => {
				assertBalance(token1, accounts[1], 100)
			});
		await token1.transfer(accounts[2], (100*10**decimals1).toString())						//transferring 100 of token1 to accounts[2]
			.then(result => {
				assertBalance(token1, accounts[2], 100)
			});
		await token2.transfer(accounts[2], (100*10**decimals2).toString())						//transferring 100 of token2 to accounts[2]
			.then(result => {
				assertBalance(token1, accounts[2], 100)
			});
		await BaoSwap.deployed()
			.then(instance => {
				baoSwap = instance;
				instance.owner.call()															//comparing owner		
					.then(owner => {
						assert.equal(
							owner,
							accounts[0],
							"accounts[0] is not owner"
						);
					});
			});
		await baoSwap.token1.call()
			.then(r => {
				assert.equal(
					r,
					token1.address,
					"tokens should be equal"
				);
			});
		await baoSwap.token2.call()
			.then(r => {
				assert.equal(
					r,
					token2.address,
					"tokens should be equal"
				);
			});
			
		await token1.approve(baoSwap.address, token1Amount(1000), {from: accounts[1], gas: 80000});	//approve
		await token2.approve(baoSwap.address, token2Amount(1000), {from: accounts[1], gas: 80000});
		await token1.approve(baoSwap.address, token1Amount(1000), {from: accounts[2], gas: 80000});
		await token2.approve(baoSwap.address, token2Amount(1000), {from: accounts[2], gas: 80000});
	});
	
	it('accounts[1] deposits 100 of token1', async () => {
		await minePendingTransactions(1);
		await stopMining();																		//stopping mining to stop advancing blocks	
		baoSwap.deposit(token1.address, token1Amount(100), {from: accounts[1], gas: 300000});	//deposit
	});
	it("accounts[1] fails to withdraw in the same block, fast-forwarding one block", async () => {
		baoSwap.withdraw(token1.address, {from: accounts[1], gas: 300000}).catch((er) => { });	//immidiate withdraw to test block lock
		await minePendingTransactions(1);														//advance block
		await startMining();																	//resume mining
		
		await assertPendingBalance(token1, accounts[1], 100);									//100 should be pending (deposit successful, withdraw unsuccessful)
		await assertPendingBalance(token2, accounts[1], 100);
		
		await assertWithdrawableBalance(token1, accounts[1], 0);								//withdrawable should be 0 because it's still the same block
		await assertWithdrawableBalance(token2, accounts[1], 0);
		
		await minePendingTransactions(1);														//advance block
		
		await assertWithdrawableBalance(token1, accounts[1], 100);								//withdrawable should be 100 now
		await assertWithdrawableBalance(token2, accounts[1], 100);
		
		await assertBalance(token1, accounts[1], 0);											//balance should be 0 after deposit
	});
	it("accounts[1] withdraws 100 of token1", async () => {
		await baoSwap.withdraw(token1.address, {from: accounts[1]});
		
		await assertBalance(token1, accounts[1], 100);											//balance should be 100 after withdraw
		
		await assertPendingBalance(token1, accounts[1], 0);										//pending and withdrawable should be 0
		await assertPendingBalance(token2, accounts[1], 0);
		await assertWithdrawableBalance(token1, accounts[1], 0);
		await assertWithdrawableBalance(token2, accounts[1], 0);
		
	});
	it("accounts[0] supplies 1000 of token1 and token2", async () => {
		await token1.transfer(baoSwap.address, token1Amount(1000));
		await token2.transfer(baoSwap.address, token2Amount(1000));
		
		await assertBalance(token1, baoSwap.address, 1000);
		await assertBalance(token2, baoSwap.address, 1000);
		
		await baoSwap.balance1.call().then(balance => assert.equal(balance, token1Amount(1000), "baoSwap doesn't return correct token1 balance"));
		await baoSwap.balance2.call().then(balance => assert.equal(balance, token2Amount(1000), "baoSwap doesn't return correct token2 balance"));
	});
	it("accounts[1] deposits 100 of token1", async () => {
		await baoSwap.deposit(token1.address, token1Amount(100), {from: accounts[1], gas: 300000});
		
		await assertBalance(token1, accounts[1], 0);
		
		await assertPendingBalance(token1, accounts[1], 100);
		await assertPendingBalance(token2, accounts[1], 100);
		
		await assertWithdrawableBalance(token1, accounts[1], 0);
		await assertWithdrawableBalance(token2, accounts[1], 0);
		
		let block = await web3.eth.getBlock("latest");
		await baoSwap.pendingBlock.call(accounts[1]).then(b => assert.equal(b, block.number+1, "pendingBlock should be next block"));
		await baoSwap.depositedToken.call(accounts[1]).then(token => assert.equal(token, token1.address, "depositedToken should be token1"));
		await baoSwap.swapWithFee.call(token1.address, token1Amount(100)).then(r => assert.equal(r, token2Amount(100), "should calculate swap amount correctly"));
		await baoSwap.swapWithFee.call(token2.address, token2Amount(100)).then(r => assert.equal(r, token1Amount(100), "should calculate swap amount correctly"));
		await baoSwap.canWithdraw.call(accounts[1]).then(r => assert.isFalse(r, "should not be able to withdraw"));
		
		await baoSwap.balance1.call().then(balance => assert.equal(balance, token1Amount(1100), "baoSwap doesn't return correct token1 balance"));
		
		await minePendingTransactions(1);
		
		await assertWithdrawableBalance(token1, accounts[1], 100);
		await assertWithdrawableBalance(token2, accounts[1], 100);
		
		await baoSwap.canWithdraw.call(accounts[1]).then(r => assert.isTrue(r, "should be able to withdraw"));
	});
	it('accounts[1] fails to deposit again', async () => {
		try {
			await baoSwap.deposit(token1.address, token1Amount(100), {from: accounts[1], gas: 300000});
			assert.fail("shouldn't be able to deposit again");
		} catch (er) {
			assert.include(er.message, "revert", "deposit should revert");
		}
		try {
			await baoSwap.deposit(token2.address, token2Amount(100), {from: accounts[1], gas: 300000});
			assert.fail("shouldn't be able to deposit again");
		} catch (er) {
			assert.include(er.message, "revert", "deposit should revert");
		}
	});
	it("accounts[2] can't withdraw token1 or token2", async () => {								//account[2] can't withdraw someone else's deposit	
		try {
			await baoSwap.withdraw(token1.address, {from: accounts[2]});
			assert.fail("token1 withdraw should fail for account[2]");
		} catch (er) {
			assert.include(er.message, "revert", "token1 withdraw should revert");
		}
		try {
			await baoSwap.withdraw(token2.address, {from: accounts[2]});
			assert.fail("token2 withdraw should fail for account[2]");
		} catch (er) {
			assert.include(er.message, "revert", "token2 withdraw should revert");
		}
	});
	it("accounts[1] withdraws 100 of token2", async () => {
		await baoSwap.withdraw(token2.address, {from: accounts[1]});
		
		await assertBalance(token2, accounts[1], 200);
		
		await assertPendingBalance(token1, accounts[1], 0);
		await assertPendingBalance(token2, accounts[1], 0);
		
		await assertWithdrawableBalance(token1, accounts[1], 0);
		await assertWithdrawableBalance(token2, accounts[1], 0);
	});
	it("accounts[1] can't withdraw twice", async () => {
		try {
			await baoSwap.withdraw(token2.address, {from: accounts[1]});
			assert.fail("token2 withdraw should fail");
		} catch (er) {
			assert.include(er.message, "revert", "token2 withdraw should revert");
		}
		try {
			await baoSwap.withdraw(token1.address, {from: accounts[1]});
			assert.fail("token1 withdraw should fail");
		} catch (er) {
			assert.include(er.message, "revert", "token1 withdraw should revert");
		}		
	});
	it("accounts[1] deposits 100 of token2 and withdraws 100 of token1", async () => {
		await baoSwap.deposit(token2.address, token2Amount(100), {from: accounts[1], gas: 300000});
		
		await assertBalance(token2, accounts[1], 100);
		await assertBalance(token1, baoSwap.address, 1100);
		
		await assertPendingBalance(token1, accounts[1], 100);
		await assertPendingBalance(token2, accounts[1], 100);
		
		await assertWithdrawableBalance(token2, accounts[1], 0);
		await assertWithdrawableBalance(token1, accounts[1], 0);
		
		await minePendingTransactions(1);
		
		await assertWithdrawableBalance(token2, accounts[1], 100);
		await assertWithdrawableBalance(token1, accounts[1], 100);
		
		await baoSwap.withdraw(token1.address, {from: accounts[1]});						
		
		await assertBalance(token1, accounts[1], 100);
		await assertPendingBalance(token1, accounts[1], 0);
		await assertPendingBalance(token2, accounts[1], 0);
		await assertWithdrawableBalance(token1, accounts[1], 0);
		await assertWithdrawableBalance(token2, accounts[1], 0);
	});
	it("accounts[0] sets a 1% fee", async () => {
		await baoSwap.fee.call().then(fee => assert.equal(fee, 0, "fee should be 0"));
		await baoSwap.setFee(1);
		await baoSwap.fee.call().then(fee => assert.equal(fee, 1, "fee should be 1"));
	});
	it("accounts[1] deposits 100 of token1", async () => {
		await baoSwap.deposit(token1.address, token1Amount(100), {from: accounts[1], gas: 300000});
		
		await assertBalance(token1, accounts[1], 0);
		
		await assertPendingBalance(token1, accounts[1], 99);
		await assertPendingBalance(token2, accounts[1], 99);
		
		await minePendingTransactions(1);
		
		await assertWithdrawableBalance(token2, accounts[1], 99);
		await assertWithdrawableBalance(token1, accounts[1], 99);
	});
	it("accounts[2] deposits 100 of token2", async () => {
		await baoSwap.deposit(token2.address, token2Amount(100), {from: accounts[2], gas: 300000});
		
		await assertBalance(token2, accounts[2], 0);
		
		await assertPendingBalance(token1, accounts[2], 99);
		await assertPendingBalance(token2, accounts[2], 99);
		
		await minePendingTransactions(1);
		
		await assertWithdrawableBalance(token2, accounts[2], 99);
		await assertWithdrawableBalance(token1, accounts[2], 99);
	});
	it("accounts[1] withdraws 99 of token1", async() => {
		await baoSwap.withdraw(token1.address, {from: accounts[1]});						
		await assertBalance(token1, accounts[1], 99);
	});
	it("accounts[0] transfers ownership to accounts[3]", async () => {
		await baoSwap.transferOwnership(accounts[3]).then(() => {
			baoSwap.owner.call()															//comparing owner		
					.then(owner => {
						assert.equal(
							owner,
							accounts[3],
							"accounts[3] is not owner"
						);
					});
		});
	});
	it("accounts[0] can't call onlyOwner functions", async () => {
		try {
			await baoSwap.transferOwnership(accounts[4]);
			assert.fail("shouldn't be able to transfer ownership");
		} catch (er) {
			assert.include(er.message, "revert", "transferOwnership should revert");
		}
		try {
			await baoSwap.renounceOwnership();
			assert.fail("shouldn't be able to renounce ownership");
		} catch (er) {
			assert.include(er.message, "revert", "renounceOwnership should revert");
		}
		try {
			await baoSwap.setFee(5);
			assert.fail("shouldn't be able to set fee");
		} catch (er) {
			assert.include(er.message, "revert", "setFee should revert");
		}
		try {
			await baoSwap.pause();
			assert.fail("shouldn't be able to pause");
		} catch (er) {
			assert.include(er.message, "revert", "pause should revert");
		}
		
		await baoSwap.pause({from:accounts[3]});
		
		try {
			await baoSwap.unpause();
			assert.fail("shouldn't be able to unpause");
		} catch (er) {
			assert.include(er.message, "revert", "unpause should revert");
		}
		
		await baoSwap.unpause({from:accounts[3]});
		
		try {
			await baoSwap.withdrawOnlyAdmin(token1.address, 1);
			assert.fail("shouldn't be able to withdraw supply");
		} catch (er) {
			assert.include(er.message, "revert", "withdrawOnlyAdmin should revert");
		}
	});
	it("accounts[3] pauses the contract", async () => {
		await baoSwap.pause({from:accounts[3]});
		await baoSwap.paused().then(p => assert.isTrue(p, "contract should be paused"));
	});
	it("accounts[2] can't withdraw tokens", async () => {
		try {
			await baoSwap.withdraw(token2.address, {from: accounts[2]});
			assert.fail("shouldn't be able to withdraw tokens");
		} catch (er) {
			assert.include(er.message, "paused", "withdraw should revert");
		}
	});
	it("accounts[1] can't deposit tokens", async () => {
		try {
			await baoSwap.deposit(token1.address, token1Amount(20), {from: accounts[1]});
			assert.fail("shouldn't be able to deposit tokens");
		} catch (er) {
			assert.include(er.message, "paused", "deposit should revert");
		}
	});
	it("accounts[3] unpauses the contract", async () => {
		await baoSwap.unpause({from:accounts[3]});
		await baoSwap.paused().then(p => assert.isFalse(p, "contract should be unpaused"));
	});
	it("accounts[2] withdraws 99 of token2", async () => {
		await baoSwap.withdraw(token2.address, {from: accounts[2]});						
		await assertBalance(token2, accounts[2], 99);
	});
	it("accounts[3] sets fee to 3%", async () => {
		await baoSwap.fee.call().then(fee => assert.equal(fee, 1, "fee should be 1"));
		await baoSwap.setFee(3, {from:accounts[3]});
		await baoSwap.fee.call().then(fee => assert.equal(fee, 3, "fee should be 3"));
	});
	it("accounts[1] deposits 50 of token1", async () => {
		await baoSwap.deposit(token1.address, token1Amount(50), {from: accounts[1], gas: 300000});
		
		await assertBalance(token1, accounts[1], 49);
		
		await assertPendingBalance(token1, accounts[1], 48.5);
		await assertPendingBalance(token2, accounts[1], 48.5);
		
		await minePendingTransactions(1);
		
		await assertWithdrawableBalance(token2, accounts[1], 48.5);
		await assertWithdrawableBalance(token1, accounts[1], 48.5);
	});
	it("accounts[1] withdraws 48.5 of token2", async() => {
		await baoSwap.withdraw(token2.address, {from: accounts[1]});						
		await assertBalance(token2, accounts[1], 148.5);
	});
	it("accounts[2] deposits 20.123458769283746574 of token2", async () => {
		await baoSwap.deposit(token2.address, "20123458769283746574", {from: accounts[2], gas: 300000});
		
		await assertPendingBalanceString(token1, accounts[2], "1951975499");						// 20.123458769283746574 -> 20.12345876 * 97 / 100 = 19.5197549972 (should cut off 72)
		await assertPendingBalanceString(token2, accounts[2], "19519755006205234176");				// 20.123458769283746574 * 97 / 100 = 1951975500620523417678 (should cut off 78)
		
		await minePendingTransactions(1);
		
		await assertWithdrawableBalanceString(token1, accounts[2], "1951975499");
		await assertWithdrawableBalanceString(token2, accounts[2], "19519755006205234176");
	});
	it("accounts[2] withdraws 48.5 of token1", async() => {
		await baoSwap.withdraw(token1.address, {from: accounts[2]});						
		await assertBalanceString(token1, accounts[2], "11951975499");								//100 + 19.51975499
	});
	it("accounts[3] withdraws all supply", async () => {
		let balance1 = await baoSwap.balance1.call();
		let balance2 = await baoSwap.balance2.call();
		await baoSwap.withdrawOnlyAdmin(token1.address, balance1, {from:accounts[3]});
		await baoSwap.withdrawOnlyAdmin(token2.address, balance2, {from:accounts[3]});
		await assertBalance(token1, baoSwap.address, 0);
		await assertBalance(token2, baoSwap.address, 0);
		await assertBalanceString(token1, accounts[3], balance1.toString());
		await assertBalanceString(token2, accounts[3], balance2.toString());
	});
});