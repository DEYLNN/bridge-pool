const { ethers } = require("ethers");
const logger = require("./logger");
const { ABI_MACH_BRIDGE } = require("../utils/abi.js");
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

module.exports = async function sendTx(orderData, signer) {
  const {
    order_direction,
    order_funding,
    order_expiration,
    target_address,
    filler_address
  } = orderData;

  const {
    src_token_address,
    dst_token_address,
    dst_lzc
  } = order_direction;

  const {
    src_amount_in,
    dst_amount_out,
    bond_fee,
    bond_token_address,
    bond_amount
  } = order_funding;

  const {
    timestamp,
    challenge_offset,
    challenge_window
  } = order_expiration;

  const expiration = {
    timestamp,
    challengeOffset: challenge_offset,
    challengeWindow: challenge_window
  };

  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI_MACH_BRIDGE, signer);

  const direction = {
    srcAsset: src_token_address,
    dstAsset: ethers.utils.hexZeroPad(dst_token_address, 32),
    dstLzc: dst_lzc
  };

  const funding = {
    srcQuantity: ethers.BigNumber.from(src_amount_in),
    dstQuantity: ethers.BigNumber.from(dst_amount_out),
    bondFee: Number(bond_fee),
    bondAsset: bond_token_address,
    bondAmount: ethers.BigNumber.from(bond_amount)
  };

  try {
    const tx = await contract.placeOrder(
      direction,
      funding,
      expiration,
      ethers.utils.hexZeroPad(target_address, 32),
      filler_address
    );
    logger.info("⏱️  TX Sent: " + tx.hash);
    await tx.wait();
    logger.info("✅  TX Confirmed!");
    return tx.hash;
  } catch (err) {
    logger.error("❌  TX Failed: " + (err.reason || err.message));
    logger.error("OrderData used in sendTx:\n" + JSON.stringify(orderData, null, 2));
    throw err;
  }
};
