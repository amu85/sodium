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

        const marketStatus = intradayService.getMarketStatus();
        
        if (marketStatus.shouldSquareOff) {
            const paperDataFile = path.join(__dirname, '../data/paperTrades.json');
            const paperData = JSON.parse(fs.readFileSync(paperDataFile, 'utf8'));
            
            if (paperData.positions.length > 0) {
                storeLog(`[ENGINE] ${marketStatus.reason}`);
                const status = intradayService.getStatus();
                
                for (const pos of [...paperData.positions]) {
                    const inst = status.instruments?.find(i => i.symbol === pos.symbol);
                    const exitPrice = inst ? inst.ltp : pos.avgPrice;
                    const action = pos.quantity > 0 ? 'SELL' : 'BUY';
                    storeLog(`[ENGINE] Automatic Square-off for ${pos.symbol} at ${exitPrice}`);
                    executePaperOrder(pos.symbol, pos.exchange, action, Math.abs(pos.quantity), exitPrice, "Auto-Trade: Market Close Square-off");
                }
            }
            return;
        }

        if (!marketStatus.canTrade) return;

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

        // ---------------------------------------------------------
        // NEW: RISK MANAGEMENT (SAFE PRO MODE)
        // ---------------------------------------------------------
        const isSafeMode = config.tradingMode === 'PRO_SAFE';

        if (isSafeMode) {
            // Calculate Current Daily P&L (Realized + Unrealized)
            const realizedPnL = paperData.trades.filter(t => {
                const tradeDate = new Date(t.timestamp).toDateString();
                const today = new Date().toDateString();
                return tradeDate === today && t.profit !== undefined;
            }).reduce((acc, t) => acc + t.profit, 0);

            const unrealizedPnL = paperData.positions.reduce((acc, p) => {
                const inst = status.instruments.find(i => i.symbol === p.symbol);
                const ltp = inst ? inst.ltp : p.avgPrice;
                return acc + (ltp - p.avgPrice) * p.quantity;
            }, 0);

            const totalDailyPnL = realizedPnL + unrealizedPnL;
            const lossLimit = config.dailyLossLimit || 10000;

            if (totalDailyPnL <= -lossLimit) {
                storeLog(`[ENGINE] [SAFE PRO] Trading Halted: Daily Loss Limit Reached (₹${totalDailyPnL.toFixed(2)})`);
                
                if (config.autoSquareOffOnLimit && paperData.positions.length > 0) {
                    storeLog(`[ENGINE] [SAFE PRO] Emergency Square-off triggered.`);
                    for (const pos of [...paperData.positions]) {
                        const inst = status.instruments.find(i => i.symbol === pos.symbol);
                        const exitPrice = inst ? inst.ltp : pos.avgPrice;
                        const action = pos.quantity > 0 ? 'SELL' : 'BUY';
                        executePaperOrder(pos.symbol, pos.exchange, action, Math.abs(pos.quantity), exitPrice, "SAFE PRO: Daily Loss Limit Square-off");
                    }
                }
                return; 
            }
        }

        for (const symbol of symbols) {
            const inst = status.instruments.find(i => i.symbol === symbol);
            if (!inst || !inst.trend || !inst.ltp) continue;

            const position = paperData.positions.find(p => p.symbol === symbol);
            const currentTrend = inst.trend;
            
            let action = null;
            let reason = `Auto-Trade: Mode=${config.tradingMode || 'STANDARD'} Trend ${currentTrend}`;

            if (!position) {
                // SAFE PRO: Max Concurrent Positions Check
                if (isSafeMode && paperData.positions.length >= (config.maxConcurrentPositions || 5)) {
                    continue;
                }

                const rsi = inst.rsi || 50;
                if (currentTrend === 'UP' && rsi > 70) continue;
                if (currentTrend === 'DOWN' && rsi < 30) continue;

                const requiredMargin = (inst.ltp * defaultQty) / 5;
                if (availableMargin < requiredMargin) continue;
                
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
                executePaperOrder(symbol, inst.exchange, action, defaultQty, inst.ltp, reason);
                
                const freshData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/paperTrades.json'), 'utf8'));
                paperData.positions = freshData.positions;
                paperData.balance = freshData.balance;
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
