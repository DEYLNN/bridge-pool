const { ethers } = require("ethers");

async function transferETH(senderWallet, toAddress, amountEth) {
  const tx = await senderWallet.sendTransaction({
    to: toAddress,
    value: ethers.utils.parseEther(amountEth.toString())
  });
  await tx.wait();
  return tx.hash;
}

module.exports = transferETH;
