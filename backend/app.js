require('dotenv').config();
const { assertJwtEnv } = require('./config/jwtSecrets');
assertJwtEnv();

const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db');

const app = express();

// Comma-separated FRONTEND_URL values, e.g. https://your-frontend.onrender.com,http://localhost:3000
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Same Render account: allow other *.onrender.com origins if FRONTEND_URL omits them (prefer explicit FRONTEND_URL in production)
      if (process.env.RENDER === 'true' && /\.onrender\.com$/i.test(origin)) {
        return callback(null, true);
      }
      callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('connectDB:', err);
    res.status(503).json({
      success: false,
      message: 'Database unavailable',
    });
  }
});

app.get('/', (req, res) => {
  res.json({
    name: 'Auction Nepal API',
    message: 'Server is running. API routes are under /api/*.',
    health: '/api/health',
  });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/kyc', require('./routes/kycRoutes'));
app.use('/api/properties', require('./routes/propertyRoutes'));
app.use('/api/deposits', require('./routes/depositRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/bids', require('./routes/bidRoutes'));
app.use('/api/auctions', require('./routes/auctionRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

module.exports = app;
