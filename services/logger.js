const fs = require("fs");
const path = require("path");
const LOG_FILE = path.join(__dirname, "..", "logs.txt");

function logToFile(level, msg) {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

function info(msg) {
  console.log(`[INFO]  ${msg}`);
  logToFile("INFO", msg);
}
function warn(msg) {
  console.warn(`[WARN]  ${msg}`);
  logToFile("WARN", msg);
}
function error(msg) {
  console.error(`[ERR!]  ${msg}`);
  logToFile("ERR!", msg);
}
async function flushToDiscord(webhookUrl, content) {
  const axios = require("axios");
  try {
    await axios.post(webhookUrl, { content });
  } catch (e) {
    error("Gagal kirim Discord: " + (e.message || e));
  }
}
module.exports = { info, warn, error, flushToDiscord };
