require("dotenv").config();
const { ethers } = require("ethers");
const logger = require("./services/logger.js");

// Modular
const generateWallet = require("./src/generateWallet");
const getBalances = require("./src/getBalances");
const wrapWETH = require("./src/wrapWETH");
const transferETH = require("./src/transferETH");
const transferWETH = require("./src/transferWETH");
const waitForBalance = require("./src/waitForBalance");
const approveWETH = require("./src/approveWETH");
const getQuote = require("./services/getQuote");
const sendTx = require("./services/sendTx");
const placeOrderOnApi = require("./services/placeOrderApi");
const monitorWETHExecuted = require("./src/monitorWETHExecuted");

const {
    PRIVATE_KEY,
    RPC_URL,
    DISCORD_WEBHOOK_URL,
  } = process.env;
  
const WETH_ADDRESS = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";
const adminKeys = [PRIVATE_KEY, ...JSON.parse(fs.readFileSync("./wallets_admin.json"))];
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const pool = new WalletPool(adminKeys, provider, WETH_ADDRESS);
const BRIDGE_SPENDER = "0xAf51EBE4C721909A8Aa40Cb4B1c4656b04cbc6B4";
const ETH_AMOUNT = "0.001";
const WETH_AMOUNT = "0.0125";


async function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

(async () => {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const walletUtama = new ethers.Wallet(PRIVATE_KEY, provider);

  while (true) {
    try {
      logger.info("==== Mulai flow baru ====");

      // 1. Generate wallet baru + save ke wallets.json
      const pkBaru = generateWallet();
      const walletBaru = new ethers.Wallet(pkBaru, provider);
      logger.info(`[WALLET] New wallet generated: ${walletBaru.address}`);

      // 2. Cek ETH balance utama
      let { eth: ethUtama } = await getBalances(provider, walletUtama.address, WETH_ADDRESS, DISCORD_WEBHOOK_URL);
      while (parseFloat(ethUtama) < 0.1) {
        logger.warn(`[CHECK] ETH utama kurang dari 0.1 (${ethUtama}). Loop...`);
        await delay(15000);
        ({ eth: ethUtama } = await getBalances(provider, walletUtama.address, WETH_ADDRESS, DISCORD_WEBHOOK_URL));
      }

      // 3. Cek WETH balance utama, wrap jika kurang dari 1
      let { weth: wethUtama } = await getBalances(provider, walletUtama.address, WETH_ADDRESS, DISCORD_WEBHOOK_URL);
      if (parseFloat(wethUtama) < 0.03) {
        logger.info(`[CHECK] WETH utama kurang dari 0.03 (${wethUtama}), wrap WETH...`);
        await wrapWETH(walletUtama, WETH_ADDRESS, "1");
        await delay(5000);
        ({ weth: wethUtama } = await getBalances(provider, walletUtama.address, WETH_ADDRESS, DISCORD_WEBHOOK_URL));
      }

      // 4. Transfer ETH & WETH ke wallet baru
      logger.info(`[TRANSFER] Kirim ETH ke wallet baru...`);
      await transferETH(walletUtama, walletBaru.address, ETH_AMOUNT);
      logger.info(`[TRANSFER] Kirim WETH ke wallet baru...`);
      await transferWETH(walletUtama, WETH_ADDRESS, walletBaru.address, WETH_AMOUNT);

      // 5. Tunggu saldo masuk di wallet baru
      logger.info(`[WAIT] Tunggu ETH & WETH masuk di wallet baru...`);
      await waitForBalance(provider, walletBaru.address, WETH_ADDRESS, ETH_AMOUNT, WETH_AMOUNT, 20);
      logger.info(`[OK] Balance masuk.`);

      // 6. Approve WETH ke contract bridge
      logger.info(`[APPROVE] Approve WETH ke contract bridge...`);
      await approveWETH(walletBaru, WETH_ADDRESS, BRIDGE_SPENDER, "12500000000000000"); // 1 WETH (18 desimal)

      // 7. Minta quote bridge
      logger.info(`[QUOTE] Minta quote bridging...`);
      const orderData = await getQuote("12500000000000000", walletBaru.address);

      // 8. Kirim bridge tx (handle gas fee low retry)
      logger.info(`[BRIDGE] Kirim TX bridge...`);
      let txHash;
      try {
        txHash = await sendTx(orderData, walletBaru);
      } catch (err) {
        if (err.message?.toLowerCase().includes("insufficient") || err.message?.toLowerCase().includes("fee")) {
          logger.warn("[FEE] Bridge gagal karena gas, minta ETH tambahan dari utama dan retry...");
          await transferETH(walletUtama, walletBaru.address, "0.001");
          txHash = await sendTx(orderData, walletBaru);
        } else {
          throw err;
        }
      }

      // 9. Submit order ke API Mach
      logger.info(`[MACH API] Submit order...`);
      await placeOrderOnApi(txHash, walletBaru);

      // 10. Monitor saldo WETH di walletBaru, jika max retry belum 0 → kirim ulang ke utama
      logger.info(`[MONITOR] Pantau WETH di wallet baru...`);
      const execOk = await monitorWETHExecuted(provider, walletBaru, WETH_ADDRESS, walletUtama.address, 20);

      if (execOk) {
        logger.info(`[SUCCESS] Flow selesai sukses. Next loop...`);
      } else {
        logger.warn(`[WARN] WETH belum dieksekusi, sudah dikirim balik ke wallet utama. Next loop...`);
      }

      logger.info("==== Flow selesai ====\n");
      await delay(10000);

    } catch (e) {
      logger.error("[FATAL] " + (e.stack || e));
      if (DISCORD_WEBHOOK_URL) {
        await logger.flushToDiscord(DISCORD_WEBHOOK_URL, `❌ Main flow error: ${e.message || e}`);
      }
      await delay(10000); // biar tidak tight-loop jika error
    }
  }
})();
