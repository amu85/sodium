const express = require('express');
const router = express.Router();
const futuresController = require('../controllers/futuresStrategyController');

router.get('/run', futuresController.runFuturesStrategy);
router.post('/start', futuresController.startAutoFuturesStrategy);
router.post('/stop', futuresController.stopAutoFuturesStrategy);
router.get('/status', futuresController.getFuturesStrategyStatus);

module.exports = router;