const getBalances = require("./getBalances");
const transferWETH = require("./transferWETH");

async function monitorWETHExecuted(provider, wallet, wethAddress, walletUtamaAddress, maxTry = 20) {
  let retry = 0;
  let b = { weth: 0 }; // Initial value biar gak error kalau getBalances fail
  while (retry < maxTry) {
    b = await getBalances(provider, wallet.address, wethAddress);
    if (parseFloat(b.weth) === 0) {
      return true;
    }
    await new Promise(r => setTimeout(r, 10000));
    retry++;
  }
  // Sampai sini, b.weth udah pasti ada (hasil getBalances terakhir)
  await transferWETH(wallet, wethAddress, walletUtamaAddress, b.weth);
  return false;
}

module.exports = monitorWETHExecuted;

//