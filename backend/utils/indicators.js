/**
 * Calculate Average True Range using Wilder's smoothing (RMA).
 */
function calculateATR(candles, period = 10) {
    if (candles.length < period) return Array(candles.length).fill(null);

    const trList = candles.map((c, i) => {
        if (i === 0) return c.high - c.low;
        const prevClose = candles[i - 1].close;
        return Math.max(
            c.high - c.low,
            Math.abs(c.high - prevClose),
            Math.abs(c.low - prevClose)
        );
    });

    const atrList = Array(candles.length).fill(null);
    
    // First ATR is the simple average
    let sumTR = 0;
    for (let i = 0; i < period; i++) sumTR += trList[i];
    atrList[period - 1] = sumTR / period;

    // Subsequent values use Wilder's smoothing
    for (let i = period; i < candles.length; i++) {
        atrList[i] = (atrList[i - 1] * (period - 1) + trList[i]) / period;
    }

    return atrList;
}

/**
 * Calculate Supertrend Indicator
 * Matches Zerodha Kite's logic exactly.
 */
function calculateSupertrend(candles, period = 10, multiplier = 3) {
    if (candles.length < period) return [];

    const atrList = calculateATR(candles, period);
    const n = candles.length;
    
    const upperbands = Array(n).fill(null);
    const lowerbands = Array(n).fill(null);
    const supertrend = Array(n).fill(null);
    const trend = Array(n).fill(null); // 1 for UP, -1 for DOWN

    for (let i = 0; i < n; i++) {
        if (i < period - 1 || atrList[i] === null) continue;

        const hl2 = (candles[i].high + candles[i].low) / 2;
        const basicUpper = hl2 + multiplier * atrList[i];
        const basicLower = hl2 - multiplier * atrList[i];

        if (i === period - 1) {
            upperbands[i] = basicUpper;
            lowerbands[i] = basicLower;
            supertrend[i] = basicUpper;
            trend[i] = -1;
        } else {
            // Upperband logic
            if (basicUpper < upperbands[i - 1] || candles[i - 1].close > upperbands[i - 1]) {
                upperbands[i] = basicUpper;
            } else {
                upperbands[i] = upperbands[i - 1];
            }

            // Lowerband logic
            if (basicLower > lowerbands[i - 1] || candles[i - 1].close < lowerbands[i - 1]) {
                lowerbands[i] = basicLower;
            } else {
                lowerbands[i] = lowerbands[i - 1];
            }

            // Supertrend logic
            const prevSt = supertrend[i - 1];
            if (prevSt === upperbands[i - 1]) {
                if (candles[i].close > upperbands[i]) {
                    supertrend[i] = lowerbands[i];
                    trend[i] = 1;
                } else {
                    supertrend[i] = upperbands[i];
                    trend[i] = -1;
                }
            } else {
                if (candles[i].close < lowerbands[i]) {
                    supertrend[i] = upperbands[i];
                    trend[i] = -1;
                } else {
                    supertrend[i] = lowerbands[i];
                    trend[i] = 1;
                }
            }
        }
    }

    return candles.map((c, i) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        supertrend: supertrend[i] ? parseFloat(supertrend[i].toFixed(2)) : null,
        trend: trend[i] === 1 ? 'UP' : (trend[i] === -1 ? 'DOWN' : null)
    }));
}

module.exports = { calculateSupertrend };
