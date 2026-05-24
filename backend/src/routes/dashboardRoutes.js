const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/', dashboardController.getStats);

module.exports = router;
