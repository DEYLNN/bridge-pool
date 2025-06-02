const axios = require("axios");
const logger = require("./logger");
const transferETH = require("../src/transferETH");
const transferWETH = require("../src/transferWETH");
const ORDERS_API = 'https://testnet-api.mach.exchange/v1/orders';
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const WETH_ADDRESS = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";
const MAIN_ADDRESS = process.env.WALLET_UTAMA_ADDRESS;
const delay = (ms) => new Promise(res => setTimeout(res, ms));

module.exports = async function placeOrderOnApi(txHash, walletSigner) {
  const maxRetries = 5;
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
      const msg = err?.response?.data?.detail || err.message;
      logger.warn(`❌ Order API error (attempt ${retry + 1}): ${msg}`);

      if (msg.includes("Too many requests")) {
        logger.info("⏳  Rate limited. Waiting 30s...");
        await delay(30000);
      } else {
        if (WEBHOOK_URL) {
          await axios.post(WEBHOOK_URL, {
            content: `❌ placeOrder API error: ${msg}\nMengembalikan ETH & WETH ke wallet utama...`
          }).catch(e => logger.error('Discord Error: ' + e.message));
        }
        // Force send back all WETH & ETH to main wallet
        try {
          // Kirim semua ETH (sisakan gas) & semua WETH
          const balance = await walletSigner.getBalance();
          const gasPrice = await walletSigner.provider.getGasPrice();
          const gasLimit = 21000;
          const fee = gasPrice.mul(gasLimit);
          if (balance.gt(fee)) {
            const ethSend = balance.sub(fee);
            await transferETH(walletSigner, MAIN_ADDRESS, ethers.utils.formatEther(ethSend));
          }

          // Transfer all WETH (jika masih ada)
          const ERC20_ABI = [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)"
          ];
          const { ethers } = require("ethers");
          const weth = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, walletSigner);
          const wethBal = await weth.balanceOf(walletSigner.address);
          if (wethBal.gt(0)) {
            const decimals = await weth.decimals();
            const amount = ethers.utils.formatUnits(wethBal, decimals);
            await transferWETH(walletSigner, WETH_ADDRESS, MAIN_ADDRESS, amount);
          }
          logger.info("✅ Sisa ETH dan WETH sudah dikembalikan ke wallet utama.");
        } catch (e2) {
          logger.error("❌ Gagal send back ETH/WETH: " + (e2.message || e2));
        }

        throw err;
      }
    }
  }
  throw new Error("❌ Max retries for placeOrderOnApi reached.");
};
