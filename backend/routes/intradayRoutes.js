const express = require('express');
const router = express.Router();
const intradayController = require('../controllers/intradayController');

router.post('/start', intradayController.startIntraday);
router.post('/stop', intradayController.stopIntraday);
router.get('/status', intradayController.getStatus);
router.get('/candles', intradayController.getCandles);

module.exports = router;
