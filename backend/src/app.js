require('dotenv').config();

require('express-async-errors');

const express =
  require('express');

const cors =
  require('cors');

const helmet =
  require('helmet');

const compression =
  require('compression');

const rateLimit =
  require('express-rate-limit');

const morgan =
  require('morgan');

const path =
  require('path');

/*
  =====================================
  ROUTES
  =====================================
*/

const authRoutes =
  require('./routes/authRoutes');

const receiptRoutes =
  require('./routes/receiptRoutes');

/*
  =====================================
  MIDDLEWARE
  =====================================
*/

const errorHandler =
  require('./middleware/errorHandler');

/*
  =====================================
  APP
  =====================================
*/

const app =
  express();

/*
  =====================================
  SECURITY
  =====================================
*/

app.use(
  helmet()
);

/*
  =====================================
  COMPRESSION
  =====================================
*/

app.use(
  compression()
);

/*
  =====================================
  REQUEST LOGGER
  =====================================
*/

app.use(
  morgan('dev')
);

/*
  =====================================
  CORS
  =====================================
*/

app.use(
  cors({

    origin:
      process.env.ALLOWED_ORIGINS
        ?.split(',')

      || [
        'http://localhost:3000',
      ],

    credentials: true,
  })
);

/*
  =====================================
  RATE LIMIT
  =====================================
*/

const limiter =
  rateLimit({

    windowMs:
      15 * 60 * 1000,

    max: 200,

    standardHeaders: true,

    legacyHeaders: false,
  });

app.use(limiter);

/*
  =====================================
  BODY PARSER
  =====================================
*/

app.use(
  express.json({
    limit: '10mb',
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  })
);

/*
  =====================================
  STATIC STORAGE
  =====================================
*/

app.use(

  '/uploads',

  express.static(
    path.join(
      __dirname,
      '../storage'
    )
  )
);

/*
  =====================================
  HEALTH CHECK
  =====================================
*/

app.get(
  '/health',
  (req, res) => {

    res.status(200).json({

      success: true,

      message:
        'ReceiptMind API healthy',
    });
  }
);

/*
  =====================================
  API ROUTES
  =====================================
*/

app.use(
  '/api/auth',
  authRoutes
);

app.use(
  '/api/receipts',
  receiptRoutes
);

/*
  =====================================
  404 HANDLER
  =====================================
*/

app.use(
  '*',
  (req, res) => {

    res.status(404).json({

      success: false,

      error: {

        message:
          'Route not found',
      },
    });
  }
);

/*
  =====================================
  GLOBAL ERROR HANDLER
  =====================================
*/

app.use(
  errorHandler
);

module.exports =
  app;