const express = require('express');
const router = express.Router();
const kiteController = require('../controllers/kiteController');

// Zerodha Login
router.get('/login', kiteController.autoLoginAndFetchToken);

router.get('/get-instruments-from-kite', kiteController.getInstrumentsFromKite);
router.get('/instruments', kiteController.instruments);
router.get('/unique-instrument-options', kiteController.getUniqueInstrumentOptions);
router.get('/user-instrument-options', kiteController.getUserInstrumentOptions);
router.get('/get-user-funds', kiteController.getUserFunds);
router.post('/get-ltp-from-kite', kiteController.getLTPFromKite);
router.post('/get-quote-from-kite', kiteController.getQuoteFromKite);
router.post('/execute-order', kiteController.executeOrder);
router.post('/close-existing-order', kiteController.closeExistingOrder);
router.get('/get-orders', kiteController.getOrders);
router.get('/get-order-history', kiteController.getOrderHistory);
router.post('/cancel-regular-order', kiteController.cancelRegularOrder);
router.post('/modify-regular-order', kiteController.modifyRegularOrder);

router.post("/start-ticker", kiteController.startTicker);
router.get("/ticks-stream", kiteController.ticksStream);

module.exports = router;
