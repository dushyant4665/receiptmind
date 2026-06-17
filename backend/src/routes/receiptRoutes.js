const express =
  require('express');

const receiptController =
  require('../controllers/receiptController');

const exportController =
  require('../controllers/exportController');

const authenticate =
  require('../middleware/auth');

const validateRequest =
  require('../middleware/validateRequest');

const {
  upload,
} = require('../middleware/uploadMiddleware');

const {

  editReceiptSchema,

  bulkDeleteSchema,

  bulkExportSchema,

} = require('../validators/receiptValidators');

const router =
  express.Router();

/*
  =====================================
  AUTH
  =====================================
*/

router.use(authenticate);

/*
  =====================================
  RECEIPT UPLOAD
  =====================================
*/

router.post(

  '/upload',

  upload.single('file'),

  receiptController.upload
);

/*
  =====================================
  BULK EXPORT
  =====================================
*/

router.post(

  '/bulk/export',

  validateRequest(
    bulkExportSchema
  ),

  receiptController.bulkExportReceipts
);

/*
  =====================================
  BULK DELETE
  =====================================
*/

router.delete(

  '/bulk',

  validateRequest(
    bulkDeleteSchema
  ),

  receiptController.bulkDeleteReceipts
);

/*
  =====================================
  EXPORT HISTORY
  =====================================
*/

router.get(

  '/exports/history',

  exportController.getHistory
);

/*
  =====================================
  CSV EXPORT
  =====================================
*/

router.get(

  '/export/csv',

  exportController.exportCSV
);

/*
  =====================================
  LIST RECEIPTS
  =====================================
*/

router.get(

  '/',

  receiptController.listReceipts
);

/*
  =====================================
  GET SINGLE RECEIPT
  =====================================
*/

router.get(

  '/:id',

  receiptController.getReceipt
);

/*
  =====================================
  EDIT RECEIPT
  =====================================
*/

router.patch(

  '/:id',

  validateRequest(
    editReceiptSchema
  ),

  receiptController.editReceipt
);

/*
  =====================================
  DELETE RECEIPT
  =====================================
*/

router.delete(

  '/:id',

  receiptController.deleteReceipt
);

module.exports =
  router;