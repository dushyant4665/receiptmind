require('dotenv').config();
const { Worker } = require('bullmq');
const receiptProcessingService = require('../services/receiptProcessingService');

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.log('BullMQ worker disabled (REDIS_URL not set). Queue will run in-process.');
  module.exports = null;
} else {
  const IORedis = require('ioredis');
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  // Log Redis connection errors so they don't silently kill the worker
  connection.on('error', (err) => {
    console.error('[Worker] Redis connection error:', err.message);
  });

  const worker = new Worker(
    'receipt-processing',
    async (job) => {
      const { receiptId, filePath, organizationId } = job.data;
      console.log(`[Worker] Processing job ${job.id} for receipt: ${receiptId}`);
      await receiptProcessingService.processReceipt(receiptId, filePath, organizationId);
    },
    { connection, concurrency: 5 }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  // If Redis drops while worker is running — log and don't crash the process
  worker.on('error', (err) => {
    console.error('[Worker] Unexpected worker error:', err.message);
  });

  console.log('BullMQ Receipt Worker started (concurrency: 5)');
  module.exports = worker;
}