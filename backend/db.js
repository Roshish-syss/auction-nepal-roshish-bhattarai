const mongoose = require('mongoose');

// Safer for serverless cold starts — set before routes/models load (via app → db)
mongoose.set('bufferCommands', false);

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const options = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoURI) {
    throw new Error('MONGODB_URI or MONGO_URI must be set');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(mongoURI, options).then((m) => {
      console.log(`MongoDB Connected: ${m.connection.host}`);
      console.log(`Database: ${m.connection.name}`);
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    console.error('MongoDB connection error:', error.message);
    throw error;
  }

  return cached.conn;
}

module.exports = { connectDB };
