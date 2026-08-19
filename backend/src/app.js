require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

// Routes
const authRoutes = require('./routes/authRoutes');
const receiptRoutes = require('./routes/receiptRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const exceptionRoutes = require('./routes/exceptionRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const ruleRoutes = require('./routes/ruleRoutes');
const metricsRoutes = require('./routes/metricsRoutes');
const userRoutes = require('./routes/userRoutes');
const exportRoutes = require('./routes/exportRoutes');
const fileRoutes = require('./routes/fileRoutes');

// Middleware
const errorHandler = require('./middleware/errorHandler');
const { STORAGE_ROOT } = require('./services/storageService');

const app = express();

// Security & utilities
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// CORS setup
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001').split(',');
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(null, true); // Permissive for local/dev
      }
    },
    credentials: true,
  })
);

// Body Parsers
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Static receipt file uploads directory
app.use('/uploads', express.static(STORAGE_ROOT));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'ReceiptMind API healthy' });
});

// Mount routes (Both with /api prefix and root for full frontend compatibility)
const routeMap = [
  ['/auth', authRoutes],
  ['/receipts', receiptRoutes],
  ['/dashboard', dashboardRoutes],
  ['/exceptions', exceptionRoutes],
  ['/expenses', expenseRoutes],
  ['/rules', ruleRoutes],
  ['/metrics', metricsRoutes],
  ['/users', userRoutes],
  ['/exports', exportRoutes],
  ['/files', fileRoutes],
];

for (const [routePath, router] of routeMap) {
  app.use(`/api${routePath}`, router);
  app.use(routePath, router);
}

// 404 Route handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: { message: `Route not found: ${req.originalUrl}` } });
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;