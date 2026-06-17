const {
  Queue,
} = require('bullmq');

const redis =
  require('../config/redis');

const receiptQueue =
  new Queue(
    'receipt-processing',
    {
      connection: redis,
    }
  );

module.exports = receiptQueue;