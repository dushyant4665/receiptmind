const app = require('./app');
const runMigrations = require('./db/migrations');
require('dotenv').config();

const PORT = process.env.PORT || 3001;

const start = async () => {
  try {
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
