require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
  console.log('PostgreSQL client connected');
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

// Clean query helper with error logging and slow query detection
const query = async (text, params = []) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 2000) {
      console.warn(`Slow Query (${duration}ms):`, text);
    }
    return result;
  } catch (error) {
    console.error('DB Query Error:', error.message, '| Query:', text);
    throw error;
  }
};

const getClient = () => pool.connect();

module.exports = {
  query,
  getClient,
  pool,
};