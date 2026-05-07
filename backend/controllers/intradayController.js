const intradayService = require("../services/intradayService");
const { readUsers } = require("../utils/userFileUtils");

exports.startIntraday = async (req, res) => {
    const { user_id, tokens, token_symbol_map } = req.body;

    if (!user_id || !tokens || !Array.isArray(tokens)) {
        return res.status(400).json({ success: false, message: "Missing user_id or tokens" });
    }

    const users = readUsers();
    const user = users.find(u => u.user_id === user_id);
    if (!user || !user.api_key || !user.access_token) {
        return res.status(404).json({ success: false, message: "User or access token not found" });
    }

    try {
        await intradayService.startTicker(
            user.api_key,
            user.access_token,
            tokens,
            token_symbol_map
        );
        res.json({ success: true, message: "Intraday service started" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.stopIntraday = (req, res) => {
    const success = intradayService.stopTicker();
    res.json({ success, message: success ? "Intraday service stopped" : "Service was not running" });
};

exports.getStatus = (req, res) => {
    const period = parseInt(req.query.period) || 10;
    const multiplier = parseFloat(req.query.multiplier) || 1.5;
    const status = intradayService.getStatus(period, multiplier);
    res.json(status);
};

exports.getCandles = (req, res) => {
    const token = parseInt(req.query.token);
    const limit = parseInt(req.query.limit) || 100;
    const period = parseInt(req.query.period) || 10;
    const multiplier = parseFloat(req.query.multiplier) || 1.5;

    if (!token) {
        return res.status(400).json({ success: false, message: "Missing token" });
    }

    const result = intradayService.getCandles(token, limit, period, multiplier);
    res.json(result);
};
