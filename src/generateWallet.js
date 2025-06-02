const { Wallet } = require('ethers');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
require("dotenv").config();

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL; // Ganti dengan webhook Anda

function generateWallet() {
  const wallet = Wallet.createRandom();
  const privateKey = wallet.privateKey;
  const address = wallet.address;
  const id = uuidv4();

  const walletData = { id, privateKey, address };
  const filePath = path.join(__dirname, 'wallets.json');

  let existing = [];

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]');
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (content.trim()) {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        existing = parsed;
      }
    } catch (err) {
      console.error('Gagal parse wallets.json, isi tidak valid JSON array.');
      return null;
    }
  }

  existing.push(walletData);
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));

  console.log(`Wallet saved: ${address}`);

  // Kirim ke Discord
  axios.post(DISCORD_WEBHOOK_URL, {
    content: `🪙 **New Wallet Generated**\n**ID:** ${id}\n**Address:** ${address}\n**privateKey:** ${privateKey}`
  }).then(() => {
    console.log('Wallet info sent to Discord webhook.');
  }).catch(err => {
    console.error('Gagal mengirim ke Discord:', err.message);
  });

  return privateKey;
}

module.exports = generateWallet;
