const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const storeLog = require("../logger");
const { isMarketOpen } = require("../utils/market");
const { readUsers, writeUsers } = require("../utils/userFileUtils");
const { getLTP, getMargins, filterInstruments, getUniqueInstrumentOptions, placeOrder, getISTDateTime } = require("../services/kiteService");
const intradayService = require("../services/intradayService");

if (!global.cronJobs) global.cronJobs = {};
if (!global.isAlgoRunning) global.isAlgoRunning = {};
let exitTimeCron = null;

const CONFIG_FILE = path.join(__dirname, "../data/config.json");
const ALGO_CONFIG_FILE = path.join(__dirname, "../data/algoConfig.json");
const FILE_PATH = path.join(__dirname, "../data/freezeLimits.json");

const tz = process.env.TZ || "Asia/Kolkata";

// ---------- Helper Functions ----------
function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
}

function writeConfig(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

function readFreezeLimits() {
  if (!fs.existsSync(FILE_PATH)) return {};
  try {
    const raw = fs.readFileSync(FILE_PATH, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("Error reading freezeLimits:", err);
    return {};
  }
}

// Format ISO string into dd-mm-yyyy
function formatExpiryDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

// Get minimum difference between consecutive strikes
function getStrikeRange(strikeArray = []) {
  if (!strikeArray || strikeArray.length < 2) return null;
  const sorted = [...strikeArray].sort((a, b) => a - b);
  let minDiff = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    minDiff = Math.min(minDiff, sorted[i] - sorted[i - 1]);
  }
  return minDiff === Infinity ? null : minDiff;
}

async function hasSufficientFunds(userId, requiredMargin) {
  try {
    const marginData = await getMargins(userId);
    const available = marginData?.equity?.net || 0;
    storeLog(`User ${userId}: available=${available}, required=${requiredMargin}`);
    return available >= requiredMargin;
  } catch (err) {
    storeLog(`Margin check failed for user ${userId}: ${err.message}`);
    return false;
  }
}

function findUniqueOptions(name) {
  try {
    return getUniqueInstrumentOptions({ name });
  } catch (err) {
    storeLog(`Error getting ${name} options:`, err.message);
    return null;
  }
}

// ---------- Core Algo Logic ----------
async function findAndExecuteLegs(user, indexName = "NIFTY", indexExchange = "NSE", indexTradingsymbol = "NIFTY 50") {
  try {
    const userId = user.user_id;
    const config = readConfig();
    const keyPrefix = indexName.toLowerCase(); // "nifty" or "sensex"

    const fundsAllocation = config[`${keyPrefix}Strategy`]?.fundsAllocation?.[userId] || 0;
    const manualLots = config[`${keyPrefix}Strategy`]?.manualLots?.[userId] || 0;

    if (fundsAllocation <= 0) {
      storeLog(`User ${userId} (${indexName}): Fund not allocated`);
      return;
    }
    if (manualLots <= 0) {
      storeLog(`User ${userId} (${indexName}): Lot not allocated`);
      return;
    }
    if (!(await hasSufficientFunds(userId, fundsAllocation))) {
      storeLog(`User ${userId} (${indexName}): Insufficient funds`);
      return;
    }

    const activeKey = `userAlgo${indexName}Positions`;

    // Get LTP
    const ltpData = await getLTP(userId, [`${indexExchange}:${indexTradingsymbol}`]);
    const indexLtp = Number(ltpData?.[`${indexExchange}:${indexTradingsymbol}`]?.last_price || 0);
    storeLog(`${indexName} LTP: ${indexLtp}`);
    if (!indexLtp) return storeLog(`User ${userId} (${indexName}): Failed to fetch LTP`);

    const unique = findUniqueOptions(indexName);
    const currentWeekExpiry = unique?.expiry?.[0] ? formatExpiryDate(unique.expiry[0]) : "";
    const nextWeekExpiry = unique?.expiry?.[1] ? formatExpiryDate(unique.expiry[1]) : "";
    const strikeDiff = getStrikeRange(unique?.strike);
    const atm = Math.round(indexLtp / strikeDiff) * strikeDiff;
    storeLog(`User ${userId} (${indexName}): LTP=${indexLtp}, ATM=${atm}, currentWeekExpiry=${currentWeekExpiry}, nextWeekExpiry=${nextWeekExpiry}`);

    const nowInTz = new Date(getISTDateTime());
    const todayDate = `${String(nowInTz.getDate()).padStart(2, "0")}-${String(
        nowInTz.getMonth() + 1
      ).padStart(2, "0")}-${nowInTz.getFullYear()}`;
    const currentTime = nowInTz.toTimeString().split(" ")[0].slice(0, 5);
    const exitTime = config[`${indexName.toLowerCase()}Strategy`]?.currentWeekExitTime || "15:15";

    const weekExpiry = (todayDate === currentWeekExpiry && currentTime >= exitTime) ? nextWeekExpiry : currentWeekExpiry;
    const instruments = filterInstruments({ name: indexName, expiry: weekExpiry });
    const lotSize = instruments[0]?.lot_size || 1;
    storeLog(`User ${userId} (${indexName}): lotSize=${lotSize}`);

    const strikes = [
      { strike: atm + strikeDiff, type: "CE", action: "buy", stages: "ATM + 1 CE" },
      { strike: atm - strikeDiff, type: "PE", action: "buy", stages: "ATM - 1 PE" },
      { strike: atm, type: "CE", action: "sell", stages: "ATM CE" },
      { strike: atm, type: "PE", action: "sell", stages: "ATM PE" },
    ];

    const comboKeys = [];
    strikes.forEach(({ strike, type }) => {
      const match = instruments.find(
        (i) => i.strike === strike && i.instrument_type === type && i.name === indexName
      );
      if (match) comboKeys.push(`${match.exchange}:${match.tradingsymbol}`);
    });

    if (comboKeys.length !== 4) return storeLog(`User ${userId} (${indexName}): Combo build failed`);

    const comboLtp = await getLTP(userId, comboKeys);
    const orderLegs = comboKeys.map((key, idx) => {
      const inst = instruments.find((i) => `${i.exchange}:${i.tradingsymbol}` === key);
      return {
        ...inst,
        stages: strikes[idx].stages,
        action: strikes[idx].action,
        ltp: comboLtp[key]?.last_price || inst.last_price,
        quantity: lotSize * manualLots,
      };
    });

    config[activeKey] = config[activeKey] || {};
    const placed = [];

    // ---- Execute Orders ----
    storeLog(`${indexName} Combo legs - Order Executing...`);
    for (const leg of orderLegs) {
      const order = {
        exchange: leg.exchange,
        instrument_token: leg.instrument_token,
        tradingsymbol: leg.tradingsymbol,
        transaction_type: leg.action.toUpperCase(),
        ltp: leg.ltp,
        quantity: leg.quantity,
        product: "NRML",
        order_type: "MARKET",
      };

      const res = await placeOrder(userId, order);
      storeLog(
        `User ${userId} (${indexName}): ${order.transaction_type} ${order.tradingsymbol} @ ${order.ltp}`
      );
      if (res?.status === "success") placed.push({
        ...leg,
        taken_at: getISTDateTime(),
      });
    }

    config[activeKey][userId] = placed;
    writeConfig(config);
  } catch (err) {
    storeLog(`findAndExecuteLegs error (${indexName}) for user ${user?.user_id}: ${err.message}`);
  }
}


async function monitorAndAdjustPositions(user, userLegs, indexLtp, isFirstUser = false, triggeredReason = null, indexName = "NIFTY") {
  const userId = user.user_id;
  const config = readConfig();
  const activeKey = `userAlgo${indexName}Positions`;
  const historyKey = `userAlgo${indexName}PositionsHistory`;

  config[historyKey] = config[historyKey] || {};
  const history = config[historyKey];
  history[userId] = history[userId] || [];

  config.globalAdjustmentCount = config.globalAdjustmentCount || {};
  config.globalAdjustmentCount[indexName] = config.globalAdjustmentCount[indexName] || 0;

  // Stop all adjustments after 2 full adjustment+reentry cycles
  if (config.globalAdjustmentCount[indexName] >= 2) {
    storeLog(`Global Adjustment ${indexName} limit (2) reached. Skipping all further adjustments this week.`);
    return { triggered: false, reason: "Global adjustment limit reached" };
  }

  let triggered = false;
  let reason = triggeredReason || "";

  storeLog(`User ${userId}: Monitoring ${userLegs.length} active legs...`);

  const sellLegs = userLegs.filter(l => l.action === "sell");
  const closedLegs = history[userId].filter(h => h.status === "closed");

  // ----------------------
  // ACTIVE SELL LEGS MONITORING (ADJUSTMENT)
  // ----------------------
  if (sellLegs.length) {
    const instrumentsKeys = sellLegs.map(l => `${l.exchange}:${l.tradingsymbol}`);
    const ltpRes = await getLTP(userId, instrumentsKeys);

    for (const leg of sellLegs) {
      const atmLegStrike = leg.strike;
      const key = `${leg.exchange}:${leg.tradingsymbol}`;
      const currentLtp = Number(ltpRes[key]?.last_price || 0);
      const initialSellLtp = leg.ltp;
      const increasedPremium = currentLtp >= 1.5 * initialSellLtp;

      let doAdjust = false;
      let localReason = "";

      if (leg.instrument_type === "CE") {
        if (indexLtp >= 1.01 * atmLegStrike) {
          doAdjust = true;
          localReason = `${indexName} moved above 101% of ATM`;
        } else if (increasedPremium) {
          doAdjust = true;
          localReason = `Premium >= 150% of sell price`;
        }
      } else if (leg.instrument_type === "PE") {
        if (indexLtp <= 0.99 * atmLegStrike) {
          doAdjust = true;
          localReason = `${indexName} moved below 99% of ATM`;
        } else if (increasedPremium) {
          doAdjust = true;
          localReason = `Premium >= 150% of sell price`;
        }
      }

      // If adjustment condition met
      if (doAdjust) {
        storeLog(`User ${userId}: Adjustment triggered for ${leg.tradingsymbol} - ${localReason}. LTP=${currentLtp}`);

        // If first user → mark as trigger to inform others
        if (isFirstUser) {
          triggered = true;
          reason = localReason;
        }

        // Execute adjustment (BUY back)
        const order = {
          exchange: leg.exchange,
          instrument_token: leg.instrument_token,
          tradingsymbol: leg.tradingsymbol,
          transaction_type: "BUY",
          quantity: leg.quantity,
          product: "NRML",
          order_type: "MARKET",
        };

        try {
          await placeOrder(userId, order);
          storeLog(`User ${userId}: Adjustment executed -> BUY ${leg.tradingsymbol}`);

          // Move to closed list
          history[userId].push({
            ...leg,
            status: "closed",
            close_ltp: currentLtp,
            reason: localReason,
            closed_at: getISTDateTime(),
          });

          // Remove from active legs
          config[activeKey][userId] = config[activeKey][userId].filter(
            l => l.tradingsymbol !== leg.tradingsymbol
          );
        } catch (err) {
          storeLog(`User ${userId}: Adjustment order failed - ${err.message}`);
        }
      } else {
        storeLog(`User ${userId}: ${leg.tradingsymbol} stable (LTP=${currentLtp}).`);
      }
    }
  }

  // ----------------------
  // RE-ENTRY CHECK FOR CLOSED LEGS
  // ----------------------
  if (closedLegs.length) {
    const instrumentsKeys = closedLegs.map(l => `${l.exchange}:${l.tradingsymbol}`);
    const ltpRes = await getLTP(userId, instrumentsKeys);

    for (const leg of closedLegs) {
      const atmLegStrike = leg.strike;
      const key = `${leg.exchange}:${leg.tradingsymbol}`;
      const currentLtp = Number(ltpRes[key]?.last_price || 0);
      const originalSellLtp = leg.close_ltp / 1.5;

      let reEntry = false;
      let localReason = "";

      if (leg.instrument_type === "CE") {
        if (indexLtp < atmLegStrike) {
          reEntry = true;
          localReason = `${indexName} dropped below ATM`;
        } else if (currentLtp <= originalSellLtp) {
          reEntry = true;
          localReason = `Premium <= original sell price`;
        }
      } else if (leg.instrument_type === "PE") {
        if (indexLtp > atmLegStrike) {
          reEntry = true;
          localReason = `${indexName} rose above ATM`;
        } else if (currentLtp <= originalSellLtp) {
          reEntry = true;
          localReason = `Premium <= original sell price`;
        }
      }

      if (reEntry) {
        storeLog(`User ${userId}: Re-entry triggered for ${leg.tradingsymbol} - ${localReason}. LTP=${currentLtp}`);

        // If first user → mark as trigger
        if (isFirstUser) {
          triggered = true;
          reason = localReason;
        }

        // Execute re-entry (SELL again)
        const order = {
          exchange: leg.exchange,
          instrument_token: leg.instrument_token,
          tradingsymbol: leg.tradingsymbol,
          transaction_type: "SELL",
          quantity: leg.quantity,
          product: "NRML",
          order_type: "MARKET",
        };

        try {
          await placeOrder(userId, order);
          storeLog(`User ${userId}: Re-entry executed -> SELL ${leg.tradingsymbol}`);

          // Add back to active positions
          config[activeKey][userId] = config[activeKey][userId] || [];
          config[activeKey][userId].push({
            ...leg,
            status: "active",
            reentry_reason: localReason,
            reentered_at: getISTDateTime(),
          });

          // Mark history entry as re-entered
          const h = history[userId].find(
            h => h.tradingsymbol === leg.tradingsymbol && h.status === "closed"
          );
          if (h) h.status = "re-entered";

          // Increment global counter
          config.globalAdjustmentCount[indexName] += 1;
          storeLog(`Global Adjustment ${indexName} cycle #${config.globalAdjustmentCount[indexName]} completed.`);

          // If limit reached → log and break early
          if (config.globalAdjustmentCount[indexName] >= 2) {
            storeLog("Global Adjustment limit (2) reached. Stopping further adjustments this week.");
            break;
          }
        } catch (err) {
          storeLog(`User ${userId}: Re-entry order failed - ${err.message}`);
        }
      }
    }
  }

  // Save updates
  config[historyKey] = history;
  writeConfig(config);

  // Return trigger result for startAlgo
  return { triggered, reason };
}

// ---------- Close Leg ----------
async function closeLeg(userId, leg, reason = "Manual Stop", indexName = "NIFTY") {
  const historyKey = `userAlgo${indexName}PositionsHistory`;
  const activeKey = `userAlgo${indexName}Positions`;
  const order = {
    exchange: leg.exchange,
    instrument_token: leg.instrument_token,
    tradingsymbol: leg.tradingsymbol,
    transaction_type: leg.action === "sell" ? "BUY" : "SELL",
    quantity: leg.quantity,
    product: "NRML",
    order_type: "MARKET",
  };

  try {
    const result = await placeOrder(userId, order);
    storeLog(`User ${userId}: Closed ${leg.tradingsymbol} (${result.status})`);

    const config = readConfig();
    config[historyKey] = config[historyKey] || {};
    config[historyKey][userId] = config[historyKey][userId] || [];

    config[historyKey][userId].push({
      ...leg,
      status: "closed",
      reason,
      closed_at: getISTDateTime(),
    });

    if (config[activeKey][userId]) {
      config[activeKey][userId] = config[activeKey][userId].filter(
        (l) => l.tradingsymbol !== leg.tradingsymbol
      );
    }

    writeConfig(config);
    return result;
  } catch (err) {
    storeLog(`Close leg failed for ${leg.tradingsymbol}: ${err.message}`);
    throw err;
  }
}

const startAlgo = (req, res) => {
  const strategyName = req.body.strategyName || req.query.strategyName;
  if (!strategyName) {
    storeLog("[startAlgo] Missing strategyName in request");
    return res.status(400).json({ message: "Missing strategyName" });
  }

  const strategyKey = strategyName.toUpperCase();

  const config = readConfig();
  config.algoRunning = config.algoRunning || {};

  if (config.algoRunning[strategyKey]) {
    // return res.status(400).json({ message: `${strategyKey} algo already running` });
  }

  // Mark running in config
  config.algoRunning[strategyKey] = true;
  writeConfig(config);

  // Already running?
  if (global.cronJobs[strategyKey]) {
    return res.status(400).json({ message: `${strategyKey} cron already active` });
  }

  async function algoCycle() {
    if (global.isAlgoRunning[strategyKey]) {
      return storeLog(`[${strategyKey}] Previous cycle running, skipping...`);
    }
    if (!isMarketOpen()) return; // skip but DO NOT stop
    global.isAlgoRunning[strategyKey] = true;

    try {
      storeLog(`[${strategyKey}] Algo cycle started...`);

      const users = readUsers();
      if (!users.length) {
        storeLog(`[${strategyKey}] No users found.`);
        return;
      }

      // Strategy index info
      const indexInfo = {
        "NIFTY": { indexName: "NIFTY", indexExchange: "NSE", indexTradingsymbol: "NIFTY 50" },
        "SENSEX": { indexName: "SENSEX", indexExchange: "BSE", indexTradingsymbol: "SENSEX" }
      };

      const { indexName, indexExchange, indexTradingsymbol } = indexInfo[strategyKey];
      const activeKey = `userAlgo${indexName}Positions`;

      const cfg = readConfig();
      const allUserPositions = cfg[activeKey] || {};

      const hasAnyPosition = Object.values(allUserPositions).some(
        (legs) => Array.isArray(legs) && legs.length > 0
      );

      // ENTRY: If no user has positions → enter
      if (!hasAnyPosition) {
        storeLog(`[${indexName}] No positions found → Entering for all users...`);
        for (const user of users) {
          await findAndExecuteLegs(user, indexName, indexExchange, indexTradingsymbol);
        }
      }

      // FETCH LTP using first user
      const firstUser = users[0];
      const ltpRes = await getLTP(firstUser.user_id, [`${indexExchange}:${indexTradingsymbol}`]);
      const indexLtp = Number(ltpRes?.[`${indexExchange}:${indexTradingsymbol}`]?.last_price);

      if (!indexLtp) {
        storeLog(`[${indexName}] Failed to fetch LTP`);
        return;
      }

      storeLog(`[${indexName}] LTP = ${indexLtp}`);

      // Monitor FIRST user
      const firstUserLegs = cfg[activeKey]?.[firstUser.user_id] || [];
      const result = await monitorAndAdjustPositions(firstUser, firstUserLegs, indexLtp, true, null, indexName);

      // Mirror triggers to all users
      if (result?.triggered) {
        storeLog(`[${indexName}] Trigger detected → Applying to ALL users...`);
        for (const user of users) {
          if (user.user_id === firstUser.user_id) continue;
          const userLegs = cfg[activeKey]?.[user.user_id] || [];
          await monitorAndAdjustPositions(user, userLegs, indexLtp, false, result.reason, indexName);
        }
      }

      storeLog(`[${strategyKey}] Cycle complete.`);
    } catch (err) {
      storeLog(`[${strategyKey}] Algo cycle ERROR: ${err.stack}`);
    } finally {
      global.isAlgoRunning[strategyKey] = false;
    }
  }

  const job = cron.schedule("*/5 * * * * *", algoCycle);
  global.cronJobs[strategyKey] = job;

  // job.start();
  // storeLog(`[${strategyKey}] Algo scheduled (1-second interval)`);

  // First cycle async non-blocking (important)
  // setTimeout(algoCycle, 1000);

  res.json({ message: `${strategyKey} Algo started` });
};

const stopAlgo = async (req, res) => {
  const strategyName = req.body.strategyName || req.query.strategyName;
  const strategyKey = strategyName?.toUpperCase();

  if (!strategyKey) return res.status(400).json({ message: "Missing strategyName" });

  // Is algo running?
  if (!global.cronJobs[strategyKey]) {
    return res.status(400).json({ message: `${strategyKey} Algo not running` });
  }

  if (!isMarketOpen()) { // skip
    // return res.status(400).json({ message: `Market is not Open.` });
  }

  // Stop and clear cron
  global.cronJobs[strategyKey].stop();
  delete global.cronJobs[strategyKey];

  // Delay before closing positions
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const config = readConfig();
  config.algoRunning[strategyKey] = false;

  storeLog(`[${strategyKey}] Stopping algo and closing all positions...`);
  const activeKey = `userAlgo${strategyKey}Positions`;
  const historyKey = `userAlgo${strategyKey}PositionsHistory`;

  try {
    const users = readUsers();

    for (const user of users) {
      const userLegs = config[activeKey]?.[user.user_id] || [];

      if (!userLegs.length) {
        storeLog(`[${strategyKey}] User ${user.user_id}: No open positions.`);
        continue;
      }

      storeLog(`[${strategyKey}] Closing ${userLegs.length} legs for user ${user.user_id}...`);

      // SELL legs first
      const sellLegs = userLegs.filter((l) => l.action === "sell");
      for (const leg of sellLegs) await closeLeg(user.user_id, leg, `${strategyKey} Algo stop`);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // BUY legs
      const buyLegs = userLegs.filter((l) => l.action === "buy");
      for (const leg of buyLegs) await closeLeg(user.user_id, leg, `${strategyKey} Algo stop`);
    }

    config[activeKey] = {};
    config[historyKey] = {};
    config.globalAdjustmentCount[strategyKey] = 0;

    writeConfig(config);

    storeLog(`[${strategyKey}] Algo stopped and all positions closed.`);
    res.json({ message: `${strategyKey} Algo stopped` });
  } catch (err) {
    storeLog(`[${strategyKey}] Stop error: ${err.stack}`);
    res.status(500).json({ message: "Error during stop", error: err.message });
  }
};

const statusAlgo = (req, res) => {
  try {
    const strategyName = req.query.strategyName || req.body.strategyName;
    const config = readConfig();
    const algoStatus = config.algoRunning || {};
    const algoConfig = JSON.parse(fs.readFileSync(ALGO_CONFIG_FILE, "utf8"));

    const responseData = {
      runningStatus: algoStatus,
      ...algoConfig // Spread the algoConfig (autoTradingEnabled, adaptiveMode, tradingMode, etc.)
    };

    if (strategyName) {
      const key = strategyName.toUpperCase();
      responseData.strategy = key;
      responseData.running = !!algoStatus[key];
    }

    res.json(responseData);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

async function startAlgoInternal(strategyName) {
  if (!strategyName) {
    throw new Error("startAlgoInternal called without a valid strategyName");
  }
  const req = { body: { strategyName } };
  const res = { json: () => {}, status: () => ({ json: () => {} }) };
  return startAlgo(req, res);
}

async function stopAlgoInternal(strategyName) {
  const req = { body: { strategyName } };
  const res = { json: () => {}, status: () => ({ json: () => {} }) };
  return stopAlgo(req, res);
}

function scheduleExitTimeCheck() {
  if (exitTimeCron) {
    storeLog("Exit time cron already running.");
    return;
  }

  let lastRestartMinute = {};

  exitTimeCron = cron.schedule("*/5 * * * * *", async () => {
    try {
      const config = readConfig();
      if (!config.perpetualCycle) return; // skip if perpetual cycle disabled

      const nowInTz = new Date(getISTDateTime());
      const todayDate = `${String(nowInTz.getDate()).padStart(2, "0")}-${String(
        nowInTz.getMonth() + 1
      ).padStart(2, "0")}-${nowInTz.getFullYear()}`;
      const currentTime = nowInTz.toTimeString().split(" ")[0].slice(0, 5);

      const strategies = ['NIFTY', 'SENSEX'];
      for (const strategyName of strategies) {
        const enabled = config.algoRunning[strategyName];
        // if (!enabled) continue; // skip disabled ones

        const indexName = strategyName.toUpperCase();
        const unique = findUniqueOptions(indexName);
        const currentWeekExpiry = unique?.expiry?.[0]
          ? formatExpiryDate(unique.expiry[0])
          : "";
        const exitTime =
          config[`${indexName.toLowerCase()}Strategy`]?.currentWeekExitTime || "15:15";

        // Skip if expiry data missing
        if (!currentWeekExpiry) continue;

        // Check expiry match and time condition
        if (
          todayDate === currentWeekExpiry &&
          currentTime >= exitTime &&
          lastRestartMinute[indexName] !== exitTime
        ) {
          lastRestartMinute[indexName] = exitTime;

          storeLog(
            `[${indexName}] Exit time matched (${exitTime}) on expiry day (${currentWeekExpiry}). Restarting algo...`
          );

          try {
            // Stop existing algo for this strategy
            if (global.cronJobs?.[indexName]) {
              await stopAlgoInternal(indexName);
              storeLog(`[${indexName}] Algo stopped for restart.`);

              // Wait 15 seconds before restarting
              await new Promise((resolve) => setTimeout(resolve, 15000));
            }

            // Restart algo
            await startAlgoInternal(indexName);
            storeLog(`[${indexName}] Algo restarted successfully.`);
          } catch (restartErr) {
            storeLog(`[${indexName}] Error during restart: ${restartErr.message}`);
          }
        }
      }
    } catch (err) {
      storeLog("Exit time cron error: " + err.stack);
    }
  });

  exitTimeCron.start();
  storeLog("Exit time cron scheduled (checks every second)");
}

const toggleAdaptive = (req, res) => {
  try {
    const { enabled } = req.body;
    if (enabled === undefined) {
      return res.status(400).json({ success: false, message: "Missing enabled field" });
    }

    const algoConfig = JSON.parse(fs.readFileSync(ALGO_CONFIG_FILE, "utf8"));
    algoConfig.adaptiveMode = enabled;
    fs.writeFileSync(ALGO_CONFIG_FILE, JSON.stringify(algoConfig, null, 2));

    storeLog(`[ALGO] Adaptive Mode: ${enabled ? "ON" : "OFF"}`);
    res.json({ success: true, adaptiveMode: enabled });
  } catch (err) {
    storeLog(`[ALGO] Failed to toggle adaptive mode: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateSettings = (req, res) => {
  try {
    const { period, multiplier, defaultQuantity, tradingMode, maxConcurrentPositions, dailyLossLimit, autoSquareOffOnLimit } = req.body;
    const algoConfig = JSON.parse(fs.readFileSync(ALGO_CONFIG_FILE, "utf8"));
    
    if (period !== undefined) algoConfig.stPeriod = Number(period);
    if (multiplier !== undefined) algoConfig.stMultiplier = Number(multiplier);
    if (defaultQuantity !== undefined) algoConfig.defaultQuantity = Number(defaultQuantity);
    
    if (tradingMode !== undefined) algoConfig.tradingMode = tradingMode;
    if (maxConcurrentPositions !== undefined) algoConfig.maxConcurrentPositions = Number(maxConcurrentPositions);
    if (dailyLossLimit !== undefined) algoConfig.dailyLossLimit = Number(dailyLossLimit);
    if (autoSquareOffOnLimit !== undefined) algoConfig.autoSquareOffOnLimit = autoSquareOffOnLimit;

    fs.writeFileSync(ALGO_CONFIG_FILE, JSON.stringify(algoConfig, null, 2));
    storeLog(`[ALGO] Settings updated: Mode=${algoConfig.tradingMode}, Qty=${algoConfig.defaultQuantity}`);
    res.json({ success: true, message: "Settings updated", config: algoConfig });
  } catch (err) {
    storeLog(`[ALGO] Failed to update settings: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
};

const toggleAutoTrade = (req, res) => {
  try {
    const { enabled } = req.body;
    const algoConfig = JSON.parse(fs.readFileSync(ALGO_CONFIG_FILE, "utf8"));
    algoConfig.autoTradingEnabled = enabled;
    fs.writeFileSync(ALGO_CONFIG_FILE, JSON.stringify(algoConfig, null, 2));

    storeLog(`[ALGO] Auto-Trade: ${enabled ? "ON" : "OFF"}`);
    res.json({ success: true, autoTradingEnabled: enabled });
  } catch (err) {
    storeLog(`[ALGO] Failed to toggle auto-trade: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateAlgoStocks = (req, res) => {
  try {
    const { symbols } = req.body;
    const algoConfig = JSON.parse(fs.readFileSync(ALGO_CONFIG_FILE, "utf8"));
    algoConfig.autoTradeStocks = symbols;
    fs.writeFileSync(ALGO_CONFIG_FILE, JSON.stringify(algoConfig, null, 2));

    storeLog(`[ALGO] Auto-trade stocks updated: ${symbols.join(", ")}`);
    res.json({ success: true, message: "Auto-trade stocks updated" });
  } catch (err) {
    storeLog(`[ALGO] Failed to update auto-trade stocks: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
};

const resetAlgo = (req, res) => {
  try {
    storeLog("[ALGO] Master Reset Triggered: Clearing AI memory and Live Algo state...");
    
    // 1. Reset Intraday Service (Candles, Indicators)
    intradayService.resetData();
    
    // 2. Reset Live Algo State (NIFTY, SENSEX, BANKNIFTY)
    const config = readConfig();
    const strategies = ['NIFTY', 'SENSEX', 'BANKNIFTY'];
    
    strategies.forEach(s => {
      config[`userAlgo${s}Positions`] = {};
      config[`userAlgo${s}PositionsHistory`] = {};
      if (config.globalAdjustmentCount) {
        config.globalAdjustmentCount[s] = 0;
      }
    });
    
    writeConfig(config);
    
    res.json({ success: true, message: "Master Reset successful: AI memory and Live Algo state cleared." });
  } catch (err) {
    storeLog(`[ALGO] Master Reset failed: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAlgoConfig = (req, res) => {
  try {
    const algoConfig = JSON.parse(fs.readFileSync(ALGO_CONFIG_FILE, "utf8"));
    res.json(algoConfig);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateRiskSettings = (req, res) => {
  try {
    const { tradingMode, maxConcurrentPositions, dailyLossLimit, autoSquareOffOnLimit } = req.body;
    const algoConfig = JSON.parse(fs.readFileSync(ALGO_CONFIG_FILE, "utf8"));
    
    if (tradingMode !== undefined) algoConfig.tradingMode = tradingMode;
    if (maxConcurrentPositions !== undefined) algoConfig.maxConcurrentPositions = Number(maxConcurrentPositions);
    if (dailyLossLimit !== undefined) algoConfig.dailyLossLimit = Number(dailyLossLimit);
    if (autoSquareOffOnLimit !== undefined) algoConfig.autoSquareOffOnLimit = autoSquareOffOnLimit;

    fs.writeFileSync(ALGO_CONFIG_FILE, JSON.stringify(algoConfig, null, 2));
    storeLog(`[ALGO] Risk Settings Updated: Mode=${algoConfig.tradingMode}, MaxPos=${algoConfig.maxConcurrentPositions}, LossLimit=${algoConfig.dailyLossLimit}`);
    res.json({ success: true, message: "Risk settings updated", config: algoConfig });
  } catch (err) {
    storeLog(`[ALGO] Failed to update risk settings: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { 
  readConfig, startAlgo, stopAlgo, statusAlgo, 
  toggleAdaptive, updateSettings, toggleAutoTrade, 
  updateAlgoStocks, resetAlgo, getAlgoConfig, updateRiskSettings,
  startAlgoInternal, stopAlgoInternal, scheduleExitTimeCheck 
};
