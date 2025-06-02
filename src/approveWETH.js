const { ethers } = require("ethers");

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function decimals() view returns (uint8)"
];

async function approveWETH(wallet, wethAddress, spender, amount) {
  const weth = new ethers.Contract(wethAddress, ERC20_ABI, wallet);
  let amountWei;
  if (typeof amount === "string" && amount.length > 12) {
    amountWei = amount;
  } else {
    const decimals = await weth.decimals();
    amountWei = ethers.utils.parseUnits(amount.toString(), decimals);
  }
  const tx = await weth.approve(spender, amountWei);
  await tx.wait();
  return tx.hash;
}

module.exports = approveWETH;
