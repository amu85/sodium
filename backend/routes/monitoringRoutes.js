const express = require('express');
const router = express.Router();
const monitoringController = require('../controllers/monitoringController');

router.get('/', monitoringController.getMonitoring);
router.put('/', monitoringController.updateMonitoring);
router.delete('/', monitoringController.deleteMonitoring);
router.post('/status', monitoringController.updateMonitoringStatus);
router.get('/status', monitoringController.getMonitoringStatus);

module.exports = router;
