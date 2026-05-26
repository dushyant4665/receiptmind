require('dotenv').config({ override: true });
const app = require('./app');
const runMigrations = require('./db/migrations');

const PORT = process.env.PORT || 3001;

const start = async () => {
  try {
    console.log(`[BOOT DEBUG] pid=${process.pid} port=${PORT}`);
    // Run Database Migrations
    await runMigrations();
    console.log('Database migrations completed');

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
