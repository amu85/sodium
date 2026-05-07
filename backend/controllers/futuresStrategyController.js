const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const storeLog = require('../logger');

const MONITORING_FILE = path.join(__dirname, '../data/monitoring.json');
let futuresCron = null;
let isRunning = false;

// Helper: safely read monitoring
function readMonitoring() {
  if (!fs.existsSync(MONITORING_FILE)) return { monitoringRunning: false };
  try {
    const raw = fs.readFileSync(MONITORING_FILE, 'utf8');
    const data = raw ? JSON.parse(raw) : {};
    if (data.monitoringRunning === undefined) data.monitoringRunning = false;
    return data;
  } catch (err) {
    console.error('Error reading monitoring:', err);
    return { monitoringRunning: false };
  }
}

// Helper: write back monitoring
function writeMonitoring(data) {
  try {
    fs.writeFileSync(MONITORING_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing monitoring file:', err);
  }
}

// Core Futures Logic
async function runFuturesLogic() {
  console.log('Futures Strategy cycle started...');
  const data = readMonitoring();
  const midcap = data["NIFTY MID SELECT"];

  if (!midcap) {
    console.log('MIDCPNIFTY instrument not found in monitoring.json');
    return;
  }

  console.log(`Running logic for ${midcap.name} (${midcap.tradingsymbol})`);
  console.log(`LTP: ${midcap.last_price}, Expiry: ${midcap.expiry}`);

  // await new Promise((resolve) => setTimeout(resolve, 1500));

  console.log('Futures logic completed for this cycle.');
}

// Manual Trigger Endpoint
exports.runFuturesStrategy = async (req, res) => {
  try {
    const monitoringData = readMonitoring();

    if (!monitoringData.monitoringRunning) {
      return res.status(403).json({
        success: false,
        message: 'Monitoring is OFF. Enable monitoringRunning to continue.',
      });
    }

    console.log('Manual Futures Strategy run triggered...');
    await runFuturesLogic();

    res.json({
      success: true,
      message: 'Futures Strategy executed successfully (manual).',
    });
  } catch (error) {
    console.error('Error running Futures Strategy:', error);
    res.status(500).json({ success: false, message: 'Failed to run Futures Strategy logic' });
  }
};

// Status Endpoint
exports.getFuturesStrategyStatus = (req, res) => {
  try {
    const monitoringData = readMonitoring();
    res.json({
      success: true,
      monitoringRunning: !!monitoringData.monitoringRunning,
      cronActive: !!futuresCron,
      instruments: Object.keys(monitoringData).filter((k) => k !== 'monitoringRunning'),
    });
  } catch (error) {
    console.error('Error fetching Futures status:', error);
    res.status(500).json({ success: false, message: 'Failed to get status' });
  }
};

// Auto Start Futures Monitoring Loop
exports.startAutoFuturesStrategy = (req, res) => {
  if (futuresCron) {
    console.log('Futures Strategy auto-cron already running.');
    return;
  }

  console.log('Starting Futures Strategy auto-monitor...');
  const monitoringData = readMonitoring();
  monitoringData.monitoringRunning = true;
  writeMonitoring(monitoringData);

  async function futuresCycle() {
    if (isRunning) return console.log("Previous cycle still running, skipping...");
    // if (!isMarketOpen()) return; // skip but DO NOT stop
    isRunning = true;

    try {
      console.log("cycle started...");
      await runFuturesLogic();

      console.log("Cycle complete.");
    } catch (err) {
      console.error('Error in Futures auto logic:', err);
    } finally {
      isRunning = false;
    }
  }

  futuresCycle();
  futuresCron = cron.schedule("*/1 * * * * *", futuresCycle);
  futuresCron.start();
  res.json({ message: "Monitoring started" });
};

// Stop Auto Loop
exports.stopAutoFuturesStrategy = (req, res) => {
  if (futuresCron) {
    futuresCron.stop();
    futuresCron = null;

    const monitoringData = readMonitoring();
    monitoringData.monitoringRunning = false;
    writeMonitoring(monitoringData);
    console.log('Futures Strategy auto-monitor stopped.');
  }
  res.json({ message: "Monitoring stopped." });
};
