require('dotenv').config();
const { Queue } = require('bullmq');
const receiptProcessingService = require('../services/receiptProcessingService');

let bullQueue = null;
const redisUrl = process.env.REDIS_URL;

if (redisUrl) {
  try {
    const IORedis = require('ioredis');
    const connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });

    connection.connect().then(() => {
      console.log('Connected to Redis for receipt queue');
      bullQueue = new Queue('receipt-processing', { connection });
    }).catch(() => {
      console.warn('Redis unavailable. Using in-process background worker.');
      bullQueue = null;
    });
  } catch (err) {
    console.warn('IORedis/BullMQ initialization skipped:', err.message);
  }
}

// Adds job to queue or runs in-process asynchronously
const addReceiptJob = async (jobName, data) => {
  if (bullQueue) {
    try {
      return await bullQueue.add(jobName, data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      });
    } catch (err) {
      console.warn('BullMQ add failed, falling back to direct async execution:', err.message);
    }
  }

  // Fallback: Run in background without blocking HTTP response
  // Using .catch() so async errors are always logged (no silent failures)
  setImmediate(() => {
    receiptProcessingService
      .processReceipt(data.receiptId, data.filePath, data.organizationId)
      .catch((err) => console.error(`[In-Process Queue] Receipt ${data.receiptId} failed:`, err.message));
  });

  return { id: `in-proc-${Date.now()}` };
};

module.exports = {
  add: addReceiptJob,
};
