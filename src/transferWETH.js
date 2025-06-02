const { ethers } = require("ethers");

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

async function transferWETH(senderWallet, wethAddress, toAddress, amount) {
  const token = new ethers.Contract(wethAddress, ERC20_ABI, senderWallet);
  const decimals = await token.decimals();
  const amountWei = ethers.utils.parseUnits(amount.toString(), decimals);
  const tx = await token.transfer(toAddress, amountWei);
  await tx.wait();
  return tx.hash;
}

module.exports = transferWETH;
