# AuctionNepal Backend

Express.js backend API for the AuctionNepal platform.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the backend directory:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/auctionnepal
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
NODE_ENV=development
EMAIL_USER=saskritjapan@gmail.com
EMAIL_APP_PASSWORD=gmbl jiko gagz twwx
FRONTEND_URL=http://localhost:3000
```

3. Make sure MongoDB is running (local or MongoDB Atlas)

4. Start the server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will run on http://localhost:5000

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user (returns accessToken and refreshToken)
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/forgot-password` - Request password reset email
- `POST /api/auth/reset-password` - Reset password with token
- `GET /api/health` - Health check

### User Profile
- `GET /api/users/profile` - Get current user profile (Protected)
- `PUT /api/users/profile` - Update user profile (Protected)
- `PUT /api/users/change-password` - Change password (Protected)

