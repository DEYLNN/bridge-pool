// Wait for balance in new wallet (ETH & WETH)
async function waitForBalance(provider, address, wethAddress, minEth, minWeth, maxTry = 20) {
    const getBalances = require("./getBalances");
    let count = 0;
    while (count < maxTry) {
      const b = await getBalances(provider, address, wethAddress);
      if (parseFloat(b.eth) >= parseFloat(minEth) && parseFloat(b.weth) >= parseFloat(minWeth)) {
        return b;
      }
      await new Promise(r => setTimeout(r, 5000));
      count++;
    }
    throw new Error(`Balance tidak masuk ke wallet baru setelah ${maxTry * 5} detik!`);
  }
  
  module.exports = waitForBalance;
  