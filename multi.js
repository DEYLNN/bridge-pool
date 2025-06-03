require("dotenv").config();
const fs = require("fs");
const { ethers } = require("ethers");
const WalletPool = require("./walletPool");
const logger = require("./services/logger.js");

const generateWallet = require("./src/generateWallet");
const transferETH = require("./src/transferETH");
const transferWETH = require("./src/transferWETH");
const waitForBalance = require("./src/waitForBalance");
const approveWETH = require("./src/approveWETH");
const getQuote = require("./services/getQuote");
const sendTx = require("./services/sendTx");
const placeOrderOnApi = require("./services/placeOrderApi");
const monitorWETHExecuted = require("./src/monitorWETHExecuted");

// ---- Konfigurasi tambahan ----
const {
  PRIVATE_KEY,
  RPC_URL,
  DISCORD_WEBHOOK_URL,
} = process.env;

const MONAD_RPC_URL =  "https://testnet-rpc.monad.xyz" // tambahkan di .env misal MONAD_RPC_URL=https://testnet-rpc.monad.xyz
const DEV_WMON_ADDRESS = "0x048761E51c68F2Bd45edB82CCc70D6a465E541f7" // tambahkan di .env, address dev di Monad
const WMON_ADDRESS = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701"    // tambahkan di .env, contract token WMON di Monad

const WETH_ADDRESS = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";
const BRIDGE_SPENDER = "0xAf51EBE4C721909A8Aa40Cb4B1c4656b04cbc6B4";
const ETH_AMOUNT = "0.001";
const WETH_AMOUNT = "0.03125";
const MIN_ETH_ADMIN = 0.1;
const MIN_WETH_ADMIN = 0.03;
const MIN_WMON = 0.1; // threshold minimal WMON agar worker lanjut

const adminKeys = [PRIVATE_KEY, ...JSON.parse(fs.readFileSync("./wallets_admin.json"))];
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const pool = new WalletPool(adminKeys, provider, WETH_ADDRESS);

// Utility: delay
async function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// Utility: get ERC20 balance
async function getTokenBalance(provider, tokenAddress, userAddress) {
  const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)"
  ];
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const balance = await token.balanceOf(userAddress);
  const decimals = await token.decimals();
  return ethers.utils.formatUnits(balance, decimals);
}

// (Opsional) Emergency fee handler untuk kirim ETH saat walletBaru fee kurang
async function emergencySendFee(toAddress, minAmountEth) {
  const pk = await pool.acquireEmergencyFee(parseFloat(minAmountEth));
  if (!pk) {
    logger.warn(`[EMERGENCY] Tidak ada admin wallet idle dengan saldo cukup untuk emergency fee.`);
    return false;
  }
  const feeWallet = new ethers.Wallet(pk, provider);
  await transferETH(feeWallet, toAddress, minAmountEth.toString());
  logger.info(`[EMERGENCY] Kirim fee sukses dari wallet ${feeWallet.address} ke ${toAddress}`);
  return true;
}

// Main worker loop
async function workerLoop(workerId) {
  // Jeda random antara 0–10 detik di awal
  const startDelay = Math.floor(Math.random() * 60_000);
  logger.info(`[Worker${workerId}] Mulai dengan jeda awal ${startDelay / 1000}s`);
  await delay(startDelay);

  while (true) {
    let pk = null;
    try {
      logger.info(`\n==== [Worker${workerId}] Menunggu WMON di dev address Monad siap... ====`);
      // 0. Cek saldo WMON di dev address di Monad sebelum proses lain
      while (true) {
        const monadProvider = new ethers.providers.JsonRpcProvider(MONAD_RPC_URL);
        const wmonBalance = await getTokenBalance(monadProvider, WMON_ADDRESS, DEV_WMON_ADDRESS);
        logger.info(`[Worker${workerId}] [CHECK] WMON balance di dev address Monad: ${wmonBalance}`);
        if (parseFloat(wmonBalance) < MIN_WMON) {
          logger.warn(`[Worker${workerId}] [WAIT] WMON dev di Monad (${DEV_WMON_ADDRESS}) kurang dari minimum (${wmonBalance} < ${MIN_WMON}). Idle 10 menit.`);
          if (DISCORD_WEBHOOK_URL) {
            await require("axios").post(DISCORD_WEBHOOK_URL, {
              content: `[Worker${workerId}] [ALERT] Saldo WMON dev (${DEV_WMON_ADDRESS}) di Monad masih kurang: ${wmonBalance} WMON. Worker idle 10 menit, mohon isi stok.`
            }).catch(() => {});
          }
          await delay(600_000); // 10 menit
        } else {
          logger.info(`[Worker${workerId}] [OK] WMON dev balance ready. Lanjut proses...`);
          break;
        }
      }

      logger.info(`==== [Worker${workerId}] Menunggu wallet pool tersedia... ====`);
      // 1. Acquire wallet dari pool, retry jika belum ada wallet siap
      while (!pk) {
        try {
          pk = await pool.acquire(workerId, MIN_ETH_ADMIN, MIN_WETH_ADMIN);
        } catch (e) {
          if (e.message === "NO_WALLET_READY") {
            logger.warn(`[Worker${workerId}] [WAIT] Tidak ada wallet pool yang ready. Worker antri 2 detik.`);
            await delay(2000);
            continue;
          }
          throw e;
        }
      }
      const walletUtama = new ethers.Wallet(pk, provider);
      logger.info(`[Worker${workerId}] [POOL] Wallet dipilih: ${walletUtama.address}`);

      // 2. Generate wallet baru + save ke wallets.json
      const pkBaru = generateWallet();
      const walletBaru = new ethers.Wallet(pkBaru, provider);
      logger.info(`[Worker${workerId}] [WALLET] New wallet generated: ${walletBaru.address}`);

      // 3. Transfer ETH & WETH ke wallet baru
      logger.info(`[Worker${workerId}] [TRANSFER] Kirim ETH ke wallet baru...`);
      await transferETH(walletUtama, walletBaru.address, ETH_AMOUNT);
      logger.info(`[Worker${workerId}] [TRANSFER] Kirim WETH ke wallet baru...`);
      await transferWETH(walletUtama, WETH_ADDRESS, walletBaru.address, WETH_AMOUNT);

      // 4. Tunggu balance masuk
      logger.info(`[Worker${workerId}] [WAIT] Menunggu ETH & WETH masuk ke wallet baru...`);
      await waitForBalance(provider, walletBaru.address, WETH_ADDRESS, ETH_AMOUNT, WETH_AMOUNT, 20);

      // 5. Approve
      logger.info(`[Worker${workerId}] [APPROVE] Approve WETH ke bridge spender...`);
      await approveWETH(walletBaru, WETH_ADDRESS, BRIDGE_SPENDER, "12500000000000000");

      // 6. Get quote & bridge TX
      logger.info(`[Worker${workerId}] [QUOTE] Get quote bridging...`);
      const orderData = await getQuote("12500000000000000", walletBaru.address);

      logger.info(`[Worker${workerId}] [BRIDGE] Kirim TX bridge...`);
      let txHash;
      try {
        txHash = await sendTx(orderData, walletBaru);
      } catch (err) {
        if (err.message?.toLowerCase().includes("insufficient") || err.message?.toLowerCase().includes("fee")) {
          logger.warn(`[Worker${workerId}] [EMERGENCY] Gagal bridge tx, emergency fee request...`);
          await emergencySendFee(walletBaru.address, "0.001");
          txHash = await sendTx(orderData, walletBaru);
        } else throw err;
      }

      // 7. Submit ke API Mach
      logger.info(`[Worker${workerId}] [API] Submit order ke Mach API...`);
      await placeOrderOnApi(txHash, walletBaru);

      // 8. Monitor WETH, auto return ke funding wallet jika gagal
      logger.info(`[Worker${workerId}] [MONITOR] Pantau WETH...`);
      const execOk = await monitorWETHExecuted(provider, walletBaru, WETH_ADDRESS, walletUtama.address, 20);

      if (execOk) {
        logger.info(`[Worker${workerId}] [SUCCESS] Bridge flow selesai, ready untuk next loop...`);
      } else {
        logger.warn(`[Worker${workerId}] [FAIL] WETH gagal dieksekusi, sudah dikembalikan ke funding wallet. Next loop...`);
      }

      logger.info(`==== [Worker${workerId}] Flow selesai, release wallet ====\n`);
      pool.release(pk);
      await delay(10000);
    } catch (e) {
      logger.error(`[Worker${workerId}] [FATAL] ERROR: ` + (e.stack || e));
      if (pk) pool.release(pk);
      if (DISCORD_WEBHOOK_URL) {
        await logger.flushToDiscord(DISCORD_WEBHOOK_URL, `❌ [Worker${workerId}] Fatal error: ${e.message || e}`);
      }
      await delay(10000);
    }
  }
}

// Jalankan worker paralel (misal 2, bisa dinaikkan sesuai pool)
const NUM_WORKER = 1;

(async () => {
  await Promise.all(
    Array.from({ length: NUM_WORKER }, (_, i) => workerLoop(i + 1))
  );
})();