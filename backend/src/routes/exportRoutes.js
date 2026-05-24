const express = require('express');
const exportController = require('../controllers/exportController');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/csv', exportController.exportCSV);
router.get('/history', exportController.getHistory);

module.exports = router;
