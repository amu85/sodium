const fs = require("fs");
const path = require("path");
const storeLog = require("../logger");

const CONFIG_FILE = path.join(__dirname, "../data/config.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch (err) {
    storeLog(`Failed to read config.json: ${err.message}`);
    return {};
  }
}

/**
 * Check if the market is open based on configured times.
 * - Skips weekends
 * - Reads times from config.json
 */
function isMarketOpen() {
  const config = readConfig();
  const now = new Date();

  const day = now.getDay();
  if (day === 0 || day === 6) {
    storeLog("Market closed (Weekend).");
    return false;
  }

  const toMinutes = (timeStr) => {
    const [h, m] = (timeStr || "00:00").split(":").map(Number);
    return h * 60 + m;
  };

  const current = now.getHours() * 60 + now.getMinutes();
  const open = toMinutes(config.openingTime);
  const close = toMinutes(config.closingTime);
  const pre = toMinutes(config.preOpeningTime);
  const post = toMinutes(config.postClosingTime);

  // Between open & close → market open
  if (current >= open && current <= close) return true;

  // Optional logging during valid day hours
  if (current >= pre && current <= post) {
    storeLog("Market not yet open or already closed — waiting...");
  }

  return false;
}

module.exports = { isMarketOpen };
