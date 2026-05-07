const { readConfig, startAlgoInternal } = require("../controllers/algoController");
const storeLog = require("../logger");

/**
 * Reads config and auto-starts enabled strategies not yet running
 */
async function autoStartEnabledStrategies() {
  const config = readConfig();
  const strategies = ["NIFTY", "SENSEX"];

  if (!global.cronJobs) global.cronJobs = {};

  for (const strategyName of strategies) {
    const enabled = config.algoRunning?.[strategyName];
    const alreadyRunning = global.cronJobs[strategyName];

    if (enabled && !alreadyRunning) {
      storeLog(`[${strategyName}] Auto-starting algo...`);

      try {
        await startAlgoInternal(strategyName);
        storeLog(`[${strategyName}] Algo started successfully.`);
      } catch (err) {
        storeLog(`[${strategyName}] Failed to start algo: ${err.message}`);
      }
    } else if (enabled && alreadyRunning) {
      storeLog(`[${strategyName}] Algo already running, skipping.`);
    } else {
      storeLog(`[${strategyName}] Disabled in config, skipping.`);
    }
  }
}

module.exports = { autoStartEnabledStrategies };
