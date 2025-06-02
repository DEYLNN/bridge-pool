const axios = require("axios");
const logger = require("./logger");
const QUOTES_API = 'https://testnet-api.mach.exchange/v1/quotes';
const WETHContract = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";
const MAIN_ADDRESS = process.env.WALLET_UTAMA_ADDRESS;

module.exports = async function getQuote(amount, wallet) {
  try {
    const res = await axios.post(QUOTES_API, {
      wallet_address: wallet,
      src_chain: "sepolia",
      dst_chain: "monadtestnet",
      src_asset_address: WETHContract,
      dst_asset_address: "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701",
      src_amount: amount,
      target_address: MAIN_ADDRESS
    });
    logger.info("✅  Quote received.");
    const orderData = res.data.order_data;
    if (!orderData || !orderData.order_funding ||
        !orderData.order_funding.src_amount_in ||
        !orderData.order_funding.dst_amount_out ||
        !orderData.order_funding.bond_amount) {
      logger.error("❌  Quote missing required fields:");
      logger.error(JSON.stringify(orderData, null, 2));
      throw new Error("Invalid quote: missing funding fields");
    }
    return orderData;
  } catch (error) {
    logger.error("❌  Error getting quote: " + (error.response?.data || error.message));
    throw error;
  }
};
