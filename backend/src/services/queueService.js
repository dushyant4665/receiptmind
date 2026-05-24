const Queue = require('bull');
require('dotenv').config();

const receiptQueue = new Queue('receipt-processing', process.env.REDIS_URL);

const enqueueReceipt = async (receiptId, filePath, orgId, priority = 'normal') => {
  const priorityValue = priority === 'high' ? 1 : 10;
  await receiptQueue.add(
    { receiptId, filePath, orgId },
    { priority: priorityValue, jobId: `receipt:${receiptId}` }
  );
};

module.exports = {
  receiptQueue,
  enqueueReceipt,
};
