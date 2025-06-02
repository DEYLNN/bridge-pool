const axios = require("axios");
const logger = require("./logger");
const transferETH = require("../src/transferETH");
const transferWETH = require("../src/transferWETH");
const ORDERS_API = 'https://testnet-api.mach.exchange/v1/orders';
const WETH_ADDRESS = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";
const MAIN_ADDRESS = process.env.WALLET_UTAMA_ADDRESS;
const delay = (ms) => new Promise(res => setTimeout(res, ms));

module.exports = async function placeOrderOnApi(txHash, walletSigner) {
  const maxRetries = 5;
  let lastErr = null;
  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      const res = await axios.post(ORDERS_API, {
        chain: "sepolia",
        place_taker_tx: txHash,
        referral_code: ""
      });
      logger.info("📩 Order API success: " + JSON.stringify(res.data));
      return res.data;
    } catch (err) {
      lastErr = err;
      const msg = err?.response?.data?.detail || err.message;
      logger.warn(`❌ Order API error (attempt ${retry + 1}): ${msg}`);

      if (msg.includes("Too many requests")) {
        logger.info("⏳  Rate limited. Waiting 30s...");
        await delay(30000);
      } else {
        await sendBackAll(walletSigner);
        throw err;
      }
    }
  }
  // Jika sudah 5x tapi selalu "Too many requests" atau error lain, baru kirim balik saldo di sini
  await sendBackAll(walletSigner);
  throw new Error("❌ Max retries for placeOrderOnApi reached. ETH/WETH sent back.");
};

// Helper untuk send back saldo
async function sendBackAll(walletSigner) {
  const { ethers } = require("ethers");
  try {
    // --- 1. Transfer all WETH dulu ---
    const ERC20_ABI = [
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ];
    const weth = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, walletSigner);
    const wethBal = await weth.balanceOf(walletSigner.address);
    if (wethBal.gt(0)) {
      const decimals = await weth.decimals();
      const amount = ethers.utils.formatUnits(wethBal, decimals);
      logger.info(`🔄 Kirim balik WETH (${amount}) ke wallet utama...`);
      await transferWETH(walletSigner, WETH_ADDRESS, MAIN_ADDRESS, amount);
    } else {
      logger.info("⏩ Tidak ada saldo WETH untuk dikembalikan.");
    }

    // --- 2. Transfer all ETH sisa, setelah pastikan cukup fee ---
    let balance = await walletSigner.getBalance();
    const gasPrice = await walletSigner.provider.getGasPrice();
    const gasLimit = 21000;
    const fee = gasPrice.mul(gasLimit);

    // Jika ETH < fee, mintalah topup dulu dari admin pool!
    if (balance.lte(fee)) {
      logger.warn("⚠️ Saldo ETH kurang untuk fee. Meminta fee ke funding wallet...");
      // emergencySendFee harus sudah tersedia dan async
      const feeSent = await emergencySendFee(walletSigner.address, ethers.utils.formatEther(fee.sub(balance).add(ethers.utils.parseEther("0.001")))); // bisa ditambah dikit biar ga pas-pasan
      if (!feeSent) {
        throw new Error("Gagal request fee untuk send back ETH.");
      }
      // Ambil saldo terbaru
      balance = await walletSigner.getBalance();
    }

    if (balance.gt(fee)) {
      const ethSend = balance.sub(fee);
      logger.info(`🔄 Kirim balik ETH (${ethers.utils.formatEther(ethSend)}) ke wallet utama...`);
      await transferETH(walletSigner, MAIN_ADDRESS, ethers.utils.formatEther(ethSend));
    } else {
      logger.warn("⏩ Tidak ada saldo ETH yang bisa dikembalikan setelah fee.");
    }

    logger.info("✅ Sisa ETH dan WETH sudah dikembalikan ke wallet utama.");
  } catch (e2) {
    logger.error("❌ Gagal send back ETH/WETH: " + (e2.message || e2));
  }
}
