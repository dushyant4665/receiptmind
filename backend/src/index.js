require('dotenv').config();

/*
  =====================================
  APP
  =====================================
*/

const app =
  require('./app');

/*
  =====================================
  DATABASE
  =====================================
*/

const db =
  require('./config/db');

/*
  =====================================
  WORKER
  =====================================
*/

require('./workers/receiptWorker');

/*
  =====================================
  PORT
  =====================================
*/

const PORT =
  process.env.PORT || 5000;

/*
  =====================================
  START SERVER
  =====================================
*/

const server =
  app.listen(
    PORT,
    () => {

      console.log(`
=====================================
ReceiptMind Backend Running
=====================================

PORT: ${PORT}
ENV: ${process.env.NODE_ENV}

=====================================
`);
    }
  );

/*
  =====================================
  UNHANDLED REJECTION
  =====================================
*/

process.on(
  'unhandledRejection',
  (err) => {

    console.error(
      'Unhandled Rejection:',
      err
    );

    shutdown();
  }
);

/*
  =====================================
  UNCAUGHT EXCEPTION
  =====================================
*/

process.on(
  'uncaughtException',
  (err) => {

    console.error(
      'Uncaught Exception:',
      err
    );

    shutdown();
  }
);

/*
  =====================================
  GRACEFUL SHUTDOWN
  =====================================
*/

const shutdown =
  async () => {

    console.log(
      'Gracefully shutting down...'
    );

    try {

      /*
        =============================
        CLOSE HTTP SERVER
        =============================
      */

      server.close();

      /*
        =============================
        CLOSE DB POOL
        =============================
      */

      await db.pool.end();

      console.log(
        'Shutdown complete'
      );

      process.exit(1);

    } catch (error) {

      console.error(
        'Shutdown Error:',
        error.message
      );

      process.exit(1);
    }
  };

/*
  =====================================
  SIGTERM
  =====================================
*/

process.on(
  'SIGTERM',
  shutdown
);

/*
  =====================================
  SIGINT
  =====================================
*/

process.on(
  'SIGINT',
  shutdown
);