const express = require('express');
const receiptController = require('../controllers/receiptController');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/', receiptController.listExpenses);

module.exports = router;
