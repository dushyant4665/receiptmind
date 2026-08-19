const receiptProcessingService = require('../services/receiptProcessingService');

// In-process background processing queue (Zero Redis, Zero BullMQ)
const addReceiptJob = async (jobName, data) => {
  setImmediate(() => {
    receiptProcessingService
      .processReceipt(data.receiptId, data.filePath, data.organizationId)
      .catch((err) => console.error(`[Receipt Processing Error] Receipt ${data.receiptId}:`, err.message));
  });

  return { id: `job-${Date.now()}` };
};

module.exports = {
  add: addReceiptJob,
};
