const fs = require("fs");
const path = require("path");
const { getISTDateTime } = require("./services/kiteService");

const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Append log messages with date-based rotation.
 * Automatically removes logs older than 7 days.
 */
function storeLog(message) {
  try {
    const now = new Date();
    const timestamp = getISTDateTime();

    const fileName = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.log`;
    const logFilePath = path.join(logsDir, fileName);

    fs.appendFileSync(logFilePath, `[${timestamp}] ${message}\n`);

    // Optional cleanup: delete logs older than 7 days
    // const files = fs.readdirSync(logsDir);
    // const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    // for (const f of files) {
    //   const fullPath = path.join(logsDir, f);
    //   const stats = fs.statSync(fullPath);
    //   if (stats.mtimeMs < cutoff) fs.unlinkSync(fullPath);
    // }
  } catch (err) {
    console.error("Log write failed:", err.message);
  }
}

module.exports = storeLog;
