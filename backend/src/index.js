require('dotenv').config();
const app = require('./app');
const db = require('./config/db');
const runMigrations = require('./db/migrations');

const PORT = process.env.PORT || 3001;

// Start server after ensuring DB migrations are run
const startServer = async () => {
  try {
    if (process.env.DATABASE_URL) {
      console.log('Running database migrations...');
      await runMigrations();
    } else {
      console.warn('DATABASE_URL not configured. Skipping migrations.');
    }
  } catch (err) {
    console.error('Migration notice:', err.message);
  }

  const server = app.listen(PORT, () => {
    console.log(`=====================================`);
    console.log(`🚀 ReceiptMind Backend running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`=====================================`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      try {
        await db.pool.end();
        console.log('Database pool closed. Exit complete.');
        process.exit(0);
      } catch {
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer();