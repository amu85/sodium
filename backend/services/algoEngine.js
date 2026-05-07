const fs = require('fs');
const path = require('path');
const storeLog = require('../logger');
const intradayService = require('./intradayService');
const paperController = require('../controllers/paperController');

const ALGO_CONFIG_FILE = path.join(__dirname, '../data/algoConfig.json');
let engineInterval = null;

function readAlgoConfig() {
    if (!fs.existsSync(ALGO_CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(ALGO_CONFIG_FILE, 'utf8'));
}

async function runEngineCycle() {
    try {
        const config = readAlgoConfig();
        if (!config.autoTradingEnabled) return;

        const period = config.stPeriod || 10;
        const multiplier = config.stMultiplier || 1.5;
        const defaultQty = config.defaultQuantity || 1;

        // Get status for all instruments
        const status = intradayService.getStatus(period, multiplier);
        if (!status.success || !status.instruments) return;

        // If no stocks are manually selected, we treat ALL stocks as candidates (Global Mode)
        const symbols = (config.autoTradeStocks && config.autoTradeStocks.length > 0) 
            ? config.autoTradeStocks 
            : status.instruments.map(i => i.symbol);

        // Get current paper positions and calculate existing used margin
        const paperData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/paperTrades.json'), 'utf8'));
        let currentUsedMargin = 0;
        paperData.positions.forEach(pos => {
            currentUsedMargin += (Math.abs(pos.quantity) * pos.avgPrice) / 5;
        });
        
        let availableMargin = paperData.balance - currentUsedMargin;

        for (const symbol of symbols) {
            const inst = status.instruments.find(i => i.symbol === symbol);
            if (!inst || !inst.trend || !inst.ltp) continue;

            const position = paperData.positions.find(p => p.symbol === symbol);
            const currentTrend = inst.trend;
            
            let action = null;
            let reason = `Auto-Trade: Global Mode Trend ${currentTrend}`;

            if (!position) {
                // SMARTER ENTRY: Use RSI to avoid buying at peaks or selling at bottoms
                const rsi = inst.rsi || 50;
                if (currentTrend === 'UP' && rsi > 70) {
                    // storeLog(`[ENGINE] Skipping BUY for ${symbol} as RSI (${rsi}) is overbought`);
                    continue;
                }
                if (currentTrend === 'DOWN' && rsi < 30) {
                    // storeLog(`[ENGINE] Skipping SELL for ${symbol} as RSI (${rsi}) is oversold`);
                    continue;
                }

                // MARGIN CHECK: Only enter if we have enough virtual funds (assuming 5x leverage)
                const requiredMargin = (inst.ltp * defaultQty) / 5;
                if (availableMargin < requiredMargin) {
                    continue;
                }
                action = currentTrend === 'UP' ? 'BUY' : 'SELL';
                availableMargin -= requiredMargin;
            } else {
                const isLong = position.quantity > 0;
                if (currentTrend === 'UP' && !isLong) {
                    action = 'BUY'; 
                    reason = `Auto-Trade: Closing Short & Reversing to Long`;
                } else if (currentTrend === 'DOWN' && isLong) {
                    action = 'SELL';
                    reason = `Auto-Trade: Closing Long & Reversing to Short`;
                }
            }

            if (action) {
                storeLog(`[ENGINE] Signal for ${symbol}: ${currentTrend}. Executing ${action} ${defaultQty}`);
                
                // Call placePaperOrder logic
                // We'll use a simplified internal version of placePaperOrder to avoid HTTP overhead
                executePaperOrder(symbol, inst.exchange, action, defaultQty, inst.ltp, reason);
                
                // Refresh paperData for next symbol in same cycle
                paperData.positions = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/paperTrades.json'), 'utf8')).positions;
                paperData.balance = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/paperTrades.json'), 'utf8')).balance;
            }
        }
    } catch (err) {
        storeLog(`[ENGINE] Error in cycle: ${err.message}`);
    }
}

function executePaperOrder(symbol, exchange, type, quantity, price, reason) {
    // Re-using the logic from paperController but internally
    const PAPER_TRADES_FILE = path.join(__dirname, '../data/paperTrades.json');
    const data = JSON.parse(fs.readFileSync(PAPER_TRADES_FILE, 'utf8'));
    
    const timestamp = new Date().toISOString();
    const trade = { symbol, type, quantity, price, reason, timestamp };

    let position = data.positions.find(p => p.symbol === symbol);
    const signedQty = type === 'BUY' ? quantity : -quantity;

    if (!position) {
        position = { symbol, exchange, quantity: signedQty, avgPrice: price, entryTime: timestamp, reason };
        data.positions.push(position);
    } else {
        const oldQty = position.quantity;
        const newQty = oldQty + signedQty;

        if (newQty === 0) {
            const profit = (price - position.avgPrice) * oldQty;
            data.balance += profit;
            trade.profit = profit;
            trade.entryPrice = position.avgPrice;
            trade.exitPrice = price;
            data.positions = data.positions.filter(p => p.symbol !== symbol);
        } else {
            // Simplification: if reversing, we just update. Full logic in paperController is more robust.
            // For the engine, we just follow the trend.
            position.avgPrice = price;
            position.quantity = newQty;
            position.entryTime = timestamp;
        }
    }

    data.trades.push(trade);
    fs.writeFileSync(PAPER_TRADES_FILE, JSON.stringify(data, null, 2));
}

function startEngine() {
    if (engineInterval) return;
    storeLog("[ENGINE] Starting Intraday Auto-Trade Engine...");
    engineInterval = setInterval(runEngineCycle, 5000); // Check every 5 seconds
}

function stopEngine() {
    if (engineInterval) {
        clearInterval(engineInterval);
        engineInterval = null;
        storeLog("[ENGINE] Stopped.");
    }
}

module.exports = { startEngine, stopEngine };
