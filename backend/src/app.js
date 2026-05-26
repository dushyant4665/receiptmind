const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const receiptRoutes = require('./routes/receiptRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const ruleRoutes = require('./routes/ruleRoutes');
const userRoutes = require('./routes/userRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const exceptionRoutes = require('./routes/exceptionRoutes');
const metricsRoutes = require('./routes/metricsRoutes');
const exportRoutes = require('./routes/exportRoutes');
const fileController = require('./controllers/fileController');
const authenticate = require('./middleware/auth');

const app = express();

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:3000', 'http://localhost:3002'],
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many requests, please try again later' },
});

// Static files - serves files from backend/uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/auth', authLimiter, authRoutes);
app.use('/receipts', receiptRoutes);
app.use('/expenses', expenseRoutes);
app.use('/exceptions', exceptionRoutes);
app.use('/metrics', metricsRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/rules', ruleRoutes);
app.use('/users', userRoutes);
app.use('/exports', exportRoutes);

// File serving endpoint
app.get('/api/files/:id', authenticate, fileController.getFile);
// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Something went wrong!',
  });
});

module.exports = app;
