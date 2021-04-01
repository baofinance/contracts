const MockERC20 = artifacts.require("MockERC20");
const MockERC677 = artifacts.require("MockERC677");
const BaoSwap = artifacts.require("BaoSwap");

module.exports = function(deployer, network) {
	if (network == "development") {
		let erc20, erc677;
		deployer.deploy(MockERC20).then(instance => erc20 = instance).then(() => 
			deployer.deploy(MockERC677).then(instance => erc677 = instance)).then(() =>
			deployer.deploy(BaoSwap, erc20.address, erc677.address));
	}
};
