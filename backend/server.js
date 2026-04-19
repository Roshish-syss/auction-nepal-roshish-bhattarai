const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const { connectDB } = require('./db');
const app = require('./app');

const server = http.createServer(app);

const socketAllowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (socketAllowedOrigins.length === 0) return callback(null, true);
      if (socketAllowedOrigins.includes(origin)) return callback(null, true);
      if (process.env.RENDER === 'true' && /\.onrender\.com$/i.test(origin)) {
        return callback(null, true);
      }
      callback(null, false);
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const socketAuth = require('./middleware/socketAuth');
const { handleAuctionSocket } = require('./socket/auctionHandler');
const handleChatSocket = require('./socket/chatHandler');
const { setNotificationIo } = require('./socket/notificationSocketHub');

io.use(socketAuth);

app.set('io', io);
setNotificationIo(io);

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id} (User: ${socket.userId})`);

  handleAuctionSocket(io, socket);
  handleChatSocket(io, socket);
});

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB();
  } catch (e) {
    console.error('MongoDB connection error:', e.message);
  }

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Socket.IO server is ready`);
    console.log(`Make sure MongoDB is connected to use full functionality`);
  });
})();
