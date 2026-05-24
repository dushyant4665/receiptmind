const app = require('./app');
const { connectRedis } = require('./config/redis');
const runMigrations = require('./db/migrations');
const startWorker = require('./workers/receiptWorker');
require('dotenv').config();

const PORT = process.env.PORT || 3001;

const start = async () => {
  try {
    // Run Database Migrations
    await runMigrations();
    console.log('Database migrations completed');

    // Connect to Redis
    await connectRedis();
    console.log('Connected to Redis');

    // Start Worker
    startWorker();
    console.log('Receipt processing worker started');

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
