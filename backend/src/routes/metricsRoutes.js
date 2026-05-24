const express = require('express');
const metricsController = require('../controllers/metricsController');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/processing-times', metricsController.getProcessingTimes);
router.get('/summary', metricsController.getSummary);

module.exports = router;
