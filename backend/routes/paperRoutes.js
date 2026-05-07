const express = require('express');
const router = express.Router();
const paperController = require('../controllers/paperController');

router.get('/status', paperController.getPaperStatus);
router.post('/order', paperController.placePaperOrder);
router.post('/reset', paperController.resetPaper);

module.exports = router;
