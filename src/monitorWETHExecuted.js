const getBalances = require("./getBalances");
const transferWETH = require("./transferWETH");

async function monitorWETHExecuted(provider, wallet, wethAddress, walletUtamaAddress, maxTry = 20) {
  let retry = 0;
  while (retry < maxTry) {
    const b = await getBalances(provider, wallet.address, wethAddress);
    if (parseFloat(b.weth) === 0) {
      return true;
    }
    await new Promise(r => setTimeout(r, 10000));
    retry++;
  }
  // Jika sampai di sini, artinya WETH belum 0, force kirim balik ke wallet utama!
  await transferWETH(wallet, wethAddress, walletUtamaAddress, b.weth);
  return false;
}

module.exports = monitorWETHExecuted;
