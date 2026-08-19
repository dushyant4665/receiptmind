const express = require('express');
const fileController = require('../controllers/fileController');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/:id', fileController.getFile);

module.exports = router;
