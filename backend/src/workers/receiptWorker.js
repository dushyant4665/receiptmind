const {
  Worker,
} = require('bullmq');

const redis =
  require('../config/redis');

const receiptProcessingService =
  require('../services/receiptProcessingService');

const worker =
  new Worker(

    'receipt-processing',

    async (job) => {

      const {
        receiptId,
        filePath,
        organizationId,
      } = job.data;

      console.log(
        `Worker processing ${receiptId}`
      );

      await receiptProcessingService.processReceipt(
        receiptId,
        filePath,
        organizationId
      );
    },

    {
      connection: redis,

      concurrency: 5,
    }
  );

worker.on(
  'completed',
  (job) => {

    console.log(
      `Job ${job.id} completed`
    );
  }
);

worker.on(
  'failed',
  (job, err) => {

    console.error(
      `Job ${job.id} failed`,
      err.message
    );
  }
);

module.exports = worker;