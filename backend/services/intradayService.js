const { KiteTicker, KiteConnect } = require("kiteconnect");
const { calculateSupertrend, calculateRSI } = require("../utils/indicators");
const storeLog = require("../logger");
const fs = require("fs");
const path = require("path");

const ALGO_CONFIG_FILE = path.join(__dirname, "../data/algoConfig.json");

/**
 * Global state for intraday data
 * { token: { closed_candles: [], current_candle: null, ltp: 0, symbol: '', exchange: '' } }
 */
let instrumentData = {};
let tickerInstance = null;
let tickerConnected = false;
let tickerConfig = {
    apiKey: '',
    accessToken: '',
    tokens: [],
    tokenSymbolMap: {}
};
let historicalLoaded = new Set();

const CANDLE_INTERVAL = 1; // 1-minute candles
const MAX_CANDLES = 500;

function floorMinute(date, interval = 1) {
    const ms = 1000 * 60 * interval;
    return new Date(Math.floor(date.getTime() / ms) * ms);
}

function formatDate(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Handle incoming ticks
 */
function onTicks(ticks) {
    const now = new Date();
    const minute = floorMinute(now, CANDLE_INTERVAL);
    const minuteStr = formatDate(minute);

    ticks.forEach(tick => {
        const token = tick.instrument_token;
        const price = tick.last_price;

        if (!token || price === undefined) return;

        if (!instrumentData[token]) {
            instrumentData[token] = {
                closed_candles: [],
                current_candle: null,
                ltp: 0,
                symbol: tickerConfig.tokenSymbolMap[token]?.symbol || '',
                exchange: tickerConfig.tokenSymbolMap[token]?.exchange || ''
            };
        }

        const data = instrumentData[token];
        data.ltp = price;

        if (!data.current_candle) {
            data.current_candle = {
                time: minuteStr,
                open: price,
                high: price,
                low: price,
                close: price
            };
            return;
        }

        const currentCandle = data.current_candle;
        
        if (currentCandle.time === minuteStr) {
            // Update current candle
            currentCandle.high = Math.max(currentCandle.high, price);
            currentCandle.low = Math.min(currentCandle.low, price);
            currentCandle.close = price;
        } else {
            // Candle closed
            data.closed_candles.push({ ...currentCandle });
            
            // Limit memory
            if (data.closed_candles.length > MAX_CANDLES) {
                data.closed_candles = data.closed_candles.slice(-MAX_CANDLES);
            }

            // Start new candle
            data.current_candle = {
                time: minuteStr,
                open: price,
                high: price,
                low: price,
                close: price
            };
        }
    });
}

/**
 * Load historical data to seed indicators
 */
async function loadHistoricalCandles(apiKey, accessToken, token, daysBack = 2) {
    try {
        const kc = new KiteConnect({ api_key: apiKey });
        kc.setAccessToken(accessToken);

        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setDate(toDate.getDate() - daysBack);

        // Zerodha format: YYYY-MM-DD HH:MM:SS
        const formatKiteDate = (d) => d.toISOString().replace('T', ' ').split('.')[0];

        const data = await kc.getHistoricalData(
            token,
            "minute",
            formatKiteDate(fromDate),
            formatKiteDate(toDate)
        );

        return data.map(d => ({
            time: formatDate(new Date(d.date)),
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close
        }));
    } catch (err) {
        storeLog(`[INTRADAY] Error loading historical for ${token}: ${err.message}`);
        return [];
    }
}

/**
 * Start Ticker
 */
async function startTicker(apiKey, accessToken, tokens, tokenSymbolMap = {}) {
    tickerConfig = { apiKey, accessToken, tokens, tokenSymbolMap };

    // Initialize instrument data structures
    tokens.forEach(token => {
        if (!instrumentData[token]) {
            instrumentData[token] = {
                closed_candles: [],
                current_candle: null,
                ltp: 0,
                symbol: tokenSymbolMap[token]?.symbol || '',
                exchange: tokenSymbolMap[token]?.exchange || ''
            };
        }
    });

    if (tickerInstance) {
        try { tickerInstance.disconnect(); } catch (e) {}
    }

    tickerInstance = new KiteTicker({
        api_key: apiKey,
        access_token: accessToken
    });

    // Enable automatic reconnection (5 retries, 5s interval)
    tickerInstance.autoReconnect(true, 5, 5);

    tickerInstance.on("connect", () => {
        tickerConnected = true;
        storeLog("[INTRADAY] Ticker connected");
        if (tokens.length > 0) {
            tickerInstance.subscribe(tokens);
            tickerInstance.setMode(tickerInstance.modeLTP, tokens);
        }
    });

    tickerInstance.on("ticks", onTicks);
    
    tickerInstance.on("close", () => {
        tickerConnected = false;
        storeLog("[INTRADAY] Ticker closed");
    });

    tickerInstance.on("error", (err) => {
        storeLog(`[INTRADAY] Ticker error: ${err.message}`);
    });

    tickerInstance.connect();

    // Background: Load historical data if not already loaded
    for (const token of tokens) {
        if (!historicalLoaded.has(token)) {
            storeLog(`[INTRADAY] Loading historical for ${token}...`);
            const hist = await loadHistoricalCandles(apiKey, accessToken, token);
            if (hist.length > 0) {
                instrumentData[token].closed_candles = hist;
                historicalLoaded.add(token);
                storeLog(`[INTRADAY] Loaded ${hist.length} candles for ${token}`);
            }
            // Avoid rate limit
            await new Promise(r => setTimeout(r, 500));
        }
    }

    return true;
}

/**
 * Stop Ticker
 */
function stopTicker() {
    if (tickerInstance) {
        tickerInstance.disconnect();
        tickerInstance = null;
        tickerConnected = false;
        storeLog("[INTRADAY] Ticker stopped manually");
        return true;
    }
    return false;
}

/**
 * Calculate effective multiplier based on whipsaws if adaptive mode is ON
 */
function getMarketStatus() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const day = now.getDay(); 

    if (day === 0 || day === 6) return { canTrade: false, shouldSquareOff: false, status: "CLOSED", reason: "Market Closed (Weekend)" };

    const currentTimeInMinutes = hours * 60 + minutes;
    const startMinutes = 9 * 60 + 20; 
    const stopMinutes = 15 * 60 + 19; 
    const marketCloseMinutes = 15 * 60 + 30; 

    if (currentTimeInMinutes < startMinutes) {
        return { canTrade: false, shouldSquareOff: false, status: "WAITING", reason: "Waiting for Strategy Start (09:20)" };
    }
    
    if (currentTimeInMinutes > stopMinutes) {
        if (currentTimeInMinutes <= marketCloseMinutes) {
            return { canTrade: false, shouldSquareOff: true, status: "SQUARING_OFF", reason: "Strategy Stop Reached (15:19). Squaring off..." };
        }
        return { canTrade: false, shouldSquareOff: false, status: "CLOSED", reason: "Market Closed (Post 15:30)" };
    }

    return { canTrade: true, shouldSquareOff: false, status: "ACTIVE", reason: "Active" };
}

function getEffectiveMultiplier(candles, basePeriod, baseMultiplier) {
    try {
        if (!fs.existsSync(ALGO_CONFIG_FILE)) return baseMultiplier;
        const config = JSON.parse(fs.readFileSync(ALGO_CONFIG_FILE, "utf8"));
        if (!config.adaptiveMode) return baseMultiplier;

        // Calculate Supertrend with base settings to detect whipsaws
        const stResults = calculateSupertrend(candles, basePeriod, baseMultiplier);
        if (stResults.length < 20) return baseMultiplier;

        // Count trend changes in last 20 candles
        const recent = stResults.slice(-20);
        let whipsaws = 0;
        for (let i = 1; i < recent.length; i++) {
            if (recent[i].trend !== recent[i - 1].trend) whipsaws++;
        }

        // Adaptive logic: If more than 3 trend changes in 20 minutes, it's a whipsaw zone
        if (whipsaws > 3) {
            const extra = whipsaws - 3;
            const adaptiveMultiplier = baseMultiplier + (extra * 0.5);
            const cappedMultiplier = Math.min(adaptiveMultiplier, 5.0); // Cap at 5.0
            
            // Only log if multiplier changed significantly
            // storeLog(`[ALGO] High Whipsaw Detected (${whipsaws}). Adaptive Multiplier increased to ${cappedMultiplier.toFixed(1)}`);
            return cappedMultiplier;
        }

        return baseMultiplier;
    } catch (err) {
        return baseMultiplier;
    }
}

/**
 * Get Status for all tracked instruments
 */
function getStatus(period = 10, multiplier = 1.5) {
    const instruments = Object.keys(instrumentData).map(token => {
        const data = instrumentData[token];
        const allCandles = [...data.closed_candles];
        if (data.current_candle) allCandles.push(data.current_candle);

        const effectiveMult = getEffectiveMultiplier(allCandles, period, multiplier);
        const stResults = calculateSupertrend(allCandles, period, effectiveMult);
        const latest = stResults.length > 0 ? stResults[stResults.length - 1] : null;

        return {
            token: parseInt(token),
            symbol: data.symbol,
            exchange: data.exchange,
            ltp: data.ltp,
            candle_count: allCandles.length,
            supertrend: latest ? latest.supertrend : null,
            trend: latest ? latest.trend : null,
            rsi: calculateRSI(allCandles, 14).slice(-1)[0],
            effectiveMultiplier: effectiveMult,
            current_candle: data.current_candle
        };
    });

    return {
        success: true,
        ticker_connected: tickerConnected,
        market_status: getMarketStatus(),
        instruments,
        timestamp: formatDate(new Date())
    };
}

/**
 * Get Candles with Supertrend for a token
 */
function getCandles(token, limit = 100, period = 10, multiplier = 1.5) {
    const data = instrumentData[token];
    if (!data) return { success: false, message: "Token not tracked" };

    const allCandles = [...data.closed_candles];
    if (data.current_candle) allCandles.push(data.current_candle);

    const effectiveMult = getEffectiveMultiplier(allCandles, period, multiplier);
    const stResults = calculateSupertrend(allCandles, period, effectiveMult);
    const enriched = stResults.slice(-limit);

    return {
        success: true,
        symbol: data.symbol,
        ltp: data.ltp,
        total_candles: allCandles.length,
        effectiveMultiplier: effectiveMult,
        candles: enriched
    };
}

function resetData() {
    instrumentData = {};
    historicalLoaded.clear();
    storeLog("[INTRADAY] All instrument data and historical flags have been reset.");
    return true;
}

module.exports = {
    startTicker,
    stopTicker,
    getStatus,
    getCandles,
    getMarketStatus,
    resetData,
    tickerConnected: () => tickerConnected
};
