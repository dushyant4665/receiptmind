const Queue = require('bull');
require('dotenv').config();

let receiptQueue = null;

if (process.env.REDIS_URL) {
  receiptQueue = new Queue('receipt-processing', process.env.REDIS_URL);
}

const enqueueReceipt = async (receiptId, filePath, orgId, priority = 'normal') => {
  if (!receiptQueue) {
    console.log('Redis not available, skipping queueing receipt');
    return;
  }
  
  const priorityValue = priority === 'high' ? 1 : 10;
  await receiptQueue.add(
    { receiptId, filePath, orgId },
    { priority: priorityValue, jobId: `receipt:${receiptId}` }
  );
};

module.exports = {
  receiptQueue,
  enqueueReceipt,
  isQueueAvailable: () => !!process.env.REDIS_URL,
};
