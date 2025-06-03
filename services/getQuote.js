const axios = require("axios");
const logger = require("./logger");
const QUOTES_API = 'https://testnet-api.mach.exchange/v1/quotes';
const WETHContract = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";
const receiverAddress = ["0x68f3c80abd25a7d60060d29a44be31528480f21c", "0xe178763c41b2a8f2c55b7d1e49941537e9ebc641","0x88b59365a6e03c049856c78266e8d5daf908a684", "0x218dc3f972dd931ce8e0046c7b5367352b899268"]
const randomIndex = Math.floor(Math.random() * receiverAddress.length)
const randomReceiver = receiverAddress[randomIndex];
module.exports = async function getQuote(amount, wallet) {
  try {
    const res = await axios.post(QUOTES_API, {
      wallet_address: wallet,
      src_chain: "sepolia",
      dst_chain: "monadtestnet",
      src_asset_address: WETHContract,
      dst_asset_address: "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701",
      src_amount: amount,
      target_address: randomReceiver
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
