const { Pool } =
  require('pg');

require('dotenv').config();

/*
  =====================================
  POSTGRES CONNECTION POOL
  =====================================
*/

const pool =
  new Pool({

    connectionString:
      process.env.DATABASE_URL,

    ssl:
      process.env.NODE_ENV ===
      'production'
        ? {
            rejectUnauthorized: false,
          }
        : false,

    /*
      =================================
      POOL CONFIG
      =================================
    */

    max: 20,

    idleTimeoutMillis:
      30000,

    connectionTimeoutMillis:
      10000,
  });

/*
  =====================================
  DATABASE EVENTS
  =====================================
*/

pool.on(
  'connect',
  () => {

    console.log(
      'PostgreSQL connected'
    );
  }
);

pool.on(
  'error',
  (err) => {

    console.error(
      'PostgreSQL Pool Error:',
      err.message
    );
  }
);

/*
  =====================================
  SAFE QUERY WRAPPER
  =====================================
*/

const query = async (
  text,
  params = []
) => {

  const start =
    Date.now();

  try {

    const result =
      await pool.query(
        text,
        params
      );

    const duration =
      Date.now() - start;

    /*
      Slow Query Logging
    */

    if (duration > 2000) {

      console.warn(
        `Slow Query (${duration}ms):`,
        text
      );
    }

    return result;

  } catch (error) {

    console.error(
      'Database Query Error:',
      error.message
    );

    console.error(
      'Failed Query:',
      text
    );

    throw error;
  }
};

/*
  =====================================
  TRANSACTION HELPER
  =====================================
*/

const getClient =
  async () => {

    return await pool.connect();
  };

module.exports = {
  query,
  getClient,
  pool,
};