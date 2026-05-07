const fs = require('fs');
const path = require('path');
const storeLog = require('../logger');

const PAPER_TRADES_FILE = path.join(__dirname, '../data/paperTrades.json');

function readPaperData() {
    if (!fs.existsSync(PAPER_TRADES_FILE)) {
        return { balance: 1000000, trades: [], positions: [] };
    }
    return JSON.parse(fs.readFileSync(PAPER_TRADES_FILE, 'utf8'));
}

function writePaperData(data) {
    fs.writeFileSync(PAPER_TRADES_FILE, JSON.stringify(data, null, 2));
}

exports.getPaperStatus = (req, res) => {
    try {
        const data = readPaperData();
        
        // Calculate used margin (assuming 5x leverage for paper trading)
        let usedMargin = 0;
        data.positions.forEach(pos => {
            usedMargin += (Math.abs(pos.quantity) * pos.avgPrice) / 5;
        });

        res.json({
            ...data,
            usedMargin,
            availableMargin: data.balance - usedMargin
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.placePaperOrder = (req, res) => {
    try {
        const { symbol, exchange, type, quantity, price, reason } = req.body;
        const data = readPaperData();
        
        const timestamp = new Date().toISOString();
        const trade = {
            symbol,
            type,
            quantity,
            price,
            reason: reason || "Manual trade",
            timestamp
        };

        // Update positions
        let position = data.positions.find(p => p.symbol === symbol);
        const signedQty = type === 'BUY' ? quantity : -quantity;

        if (!position) {
            position = {
                symbol,
                exchange,
                quantity: signedQty,
                avgPrice: price,
                entryTime: timestamp,
                reason: reason || "Manual Entry"
            };
            data.positions.push(position);
        } else {
            // Update existing position
            const oldQty = position.quantity;
            const newQty = oldQty + signedQty;

            if (newQty === 0) {
                // Position closed - calculate profit
                const profit = (price - position.avgPrice) * oldQty;
                data.balance += profit;
                trade.profit = profit;
                trade.entryPrice = position.avgPrice;
                trade.exitPrice = price;
                
                data.positions = data.positions.filter(p => p.symbol !== symbol);
            } else if ((oldQty > 0 && newQty < 0) || (oldQty < 0 && newQty > 0)) {
                // Position flipped (e.g. from Long to Short)
                // This is a bit complex, let's just treat it as close + new open
                const profit = (price - position.avgPrice) * oldQty;
                data.balance += profit;
                
                position.avgPrice = price;
                position.quantity = newQty;
                position.entryTime = timestamp;
            } else {
                // Averaging up/down (same side)
                if (Math.abs(newQty) > Math.abs(oldQty)) {
                    // Adding to position - update avg price
                    position.avgPrice = ((position.avgPrice * oldQty) + (price * signedQty)) / newQty;
                }
                // Reducing position - no change to avg price, but update balance with profit of closed part
                else {
                    const closedQty = signedQty;
                    const profit = (price - position.avgPrice) * (-closedQty);
                    data.balance += profit;
                }
                position.quantity = newQty;
            }
        }

        data.trades.push(trade);
        writePaperData(data);
        
        storeLog(`[PAPER] ${type} ${quantity} ${symbol} @ ${price}`);
        res.json({ success: true, data });
    } catch (err) {
        storeLog(`[PAPER] Order failed: ${err.message}`);
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.resetPaper = (req, res) => {
    try {
        const data = {
            balance: 1000000,
            trades: [],
            positions: []
        };
        writePaperData(data);
        storeLog("[PAPER] Trading data reset to ₹10,00,000");
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
