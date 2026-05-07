const express = require('express');
const router = express.Router();
const freezeLimitsController = require('../controllers/freezeLimitsController');

router.get('/', freezeLimitsController.getfreezeLimits);
router.put('/', freezeLimitsController.updatefreezeLimits);

module.exports = router;
