const express = require('express');
const multer = require('multer');
const receiptController = require('../controllers/receiptController');
const exportController = require('../controllers/exportController');
const authenticate = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate);

router.post('/upload', upload.single('file'), receiptController.upload);
router.post('/bulk/export', receiptController.bulkExportReceipts);
router.delete('/bulk', receiptController.bulkDeleteReceipts);
router.get('/export/csv', exportController.exportCSV);
router.get('/exports/history', exportController.getHistory);
router.get('/:id', receiptController.getReceipt);
router.get('/', receiptController.listReceipts);
router.patch('/:id', receiptController.editReceipt);
router.delete('/:id', receiptController.deleteReceipt);

module.exports = router;

