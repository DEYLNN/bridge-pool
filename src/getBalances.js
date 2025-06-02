const { ethers } = require("ethers");
const axios = require("axios");

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

/**
 * Cek balance ETH & WETH di wallet, alert Discord jika kurang threshold.
 * @param {ethers.providers.Provider} provider
 * @param {string} walletAddress
 * @param {string} wethAddress
 * @param {string} webhookUrl (optional)
 * @returns {Promise<{eth: string, weth: string}>}
 */
async function getBalances(provider, walletAddress, wethAddress, webhookUrl = null) {
  const ethRaw = await provider.getBalance(walletAddress);
  const eth = ethers.utils.formatEther(ethRaw);

  const token = new ethers.Contract(wethAddress, ERC20_ABI, provider);
  const wethRaw = await token.balanceOf(walletAddress);
  const decimals = await token.decimals();
  const weth = ethers.utils.formatUnits(wethRaw, decimals);

  // Discord alert opsional
  if (webhookUrl) {
    if (parseFloat(eth) < 0.1) {
      await axios.post(webhookUrl, { content: `⚠️ ETH balance utama < 0.1 (${eth})` }).catch(() => {});
    }
    if (parseFloat(weth) < 0.03) {
      await axios.post(webhookUrl, { content: `⚠️ WETH balance utama < 0.03 (${weth})` }).catch(() => {});
    }
  }

  return { eth, weth };
}

module.exports = getBalances;
