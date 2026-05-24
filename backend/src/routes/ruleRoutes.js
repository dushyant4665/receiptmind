const express = require('express');
const ruleController = require('../controllers/ruleController');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.post('/', ruleController.createRule);
router.get('/', ruleController.listRules);

module.exports = router;
