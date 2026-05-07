const express = require('express');
const router = express.Router();
const algoController = require('../controllers/algoController');

router.post("/start", algoController.startAlgo);
router.post("/stop", algoController.stopAlgo);
router.get("/status", algoController.statusAlgo);
router.post("/adaptive", algoController.toggleAdaptive);
router.post("/settings", algoController.updateSettings);
router.post("/toggle", algoController.toggleAutoTrade);
router.post("/stocks", algoController.updateAlgoStocks);
router.post("/config", algoController.updateSettings);
router.post("/reset", algoController.resetAlgo);

module.exports = router;
