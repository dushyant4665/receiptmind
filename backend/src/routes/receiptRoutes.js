const express = require('express');
const receiptController = require('../controllers/receiptController');
const exportController = require('../controllers/exportController');
const authenticate = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const { upload } = require('../middleware/uploadMiddleware');
const { editReceiptSchema, bulkDeleteSchema, bulkExportSchema } = require('../validators/receiptValidators');

const router = express.Router();

// Require auth for all receipt endpoints
router.use(authenticate);

// Receipt upload
router.post('/upload', upload.single('file'), receiptController.upload);

// Bulk operations
router.post('/bulk/export', validateRequest(bulkExportSchema), receiptController.bulkExportReceipts);
router.delete('/bulk', validateRequest(bulkDeleteSchema), receiptController.bulkDeleteReceipts);

// Export shortcuts
router.get('/export/csv', exportController.exportCSV);
router.get('/exports/history', exportController.getHistory);

// CRUD
router.get('/', receiptController.listReceipts);
router.get('/:id', receiptController.getReceipt);
router.patch('/:id', validateRequest(editReceiptSchema), receiptController.editReceipt);
router.delete('/:id', receiptController.deleteReceipt);

module.exports = router;