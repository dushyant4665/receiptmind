const express = require('express');
const userController = require('../controllers/userController');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/me', userController.getMe);
router.put('/me', userController.updateMe);

module.exports = router;
