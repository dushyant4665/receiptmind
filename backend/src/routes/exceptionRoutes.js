const express = require('express');
const exceptionController = require('../controllers/exceptionController');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', exceptionController.listExceptions);
router.post('/:id/resolve', exceptionController.resolveException);

module.exports = router;
