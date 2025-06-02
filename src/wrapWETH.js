const { ethers } = require("ethers");

const WETH_ABI = [
  "function deposit() payable",
  "function balanceOf(address owner) view returns (uint256)"
];

async function wrapWETH(wallet, wethAddress, amountEth) {
  const weth = new ethers.Contract(wethAddress, WETH_ABI, wallet);
  const tx = await weth.deposit({ value: ethers.utils.parseEther(amountEth) });
  await tx.wait();
  return tx.hash;
}

module.exports = wrapWETH;
