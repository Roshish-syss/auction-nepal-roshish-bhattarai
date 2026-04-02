const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root — browser hits http://localhost:5000/ (no /api); API lives under /api/*
app.get('/', (req, res) => {
  res.json({
    name: 'Auction Nepal API',
    message: 'Server is running. This URL is the REST + Socket.IO backend, not the React app.',
    health: '/api/health',
    hint: 'Open the frontend at http://localhost:3000 (or your REACT_APP URL).'
  });
});

// Routes
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// MongoDB Connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    // Set connection options
    const options = {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    };

    const conn = await mongoose.connect(mongoURI, options);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    console.error('Please check your MONGODB_URI in .env file');
    // Don't exit immediately, let the server start but log the error
  }
};

// Handle connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// Connect to database
connectDB();

// Socket.IO Authentication Middleware
const socketAuth = require('./middleware/socketAuth');
io.use(socketAuth);

// Socket.IO Event Handlers
const { handleAuctionSocket } = require('./socket/auctionHandler');
const handleChatSocket = require('./socket/chatHandler');
const { setNotificationIo } = require('./socket/notificationSocketHub');

// Make io available to routes
app.set('io', io);
setNotificationIo(io);

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id} (User: ${socket.userId})`);

  // Initialize auction handlers
  handleAuctionSocket(io, socket);

  // Initialize chat handlers
  handleChatSocket(io, socket);
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Socket.IO server is ready`);
  console.log(`Make sure MongoDB is connected to use full functionality`);
});

