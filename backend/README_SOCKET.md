# Socket.IO Implementation Guide

## Overview
Socket.IO has been integrated for real-time communication in the AuctionNepal platform. This enables:
- Real-time bidding in live auctions
- Real-time chat/messaging between users
- Live participant tracking
- Real-time notifications

## Backend Setup

### Server Configuration
The Socket.IO server is integrated into `backend/server.js`:
- Uses HTTP server (required for Socket.IO)
- Configured with CORS for frontend connection
- Authentication middleware attached

### Authentication
Socket.IO connections are authenticated using JWT tokens:
- Token is sent in `socket.handshake.auth.token`
- Token is verified using the same JWT_SECRET
- User data is attached to socket for easy access

### Auction Socket Events

#### Client → Server:
- `join_auction`: Join an auction room
  ```javascript
  { auctionId, propertyId?, secretCode? }
  ```
- `leave_auction`: Leave an auction room
  ```javascript
  { auctionId }
  ```
- `place_bid`: Place a bid
  ```javascript
  { auctionId, propertyId, bidAmount }
  ```
- `get_auction_status`: Get current auction status
  ```javascript
  { auctionId }
  ```
- `end_auction`: End auction manually (Admin only)
  ```javascript
  { auctionId }
  ```

#### Server → Client:
- `auction_joined`: Confirmation of joining auction
- `auction_error`: Error message
- `new_bid`: New bid placed by any user
- `bid_error`: Error placing bid
- `participant_joined`: New participant joined
- `participant_left`: Participant left
- `auction_status`: Current auction status
- `auction_ended`: Auction ended with winner announcement
  ```javascript
  {
    auction: {...},
    winner: { userId, winningBid, finalizedAt },
    endedBy: 'system' | 'admin_name',
    message: 'Winner announcement message'
  }
  ```
- `auction_end_success`: Confirmation of manual auction end (admin only)

### Chat Socket Events

#### Client → Server:
- `send_message`: Send a message
  ```javascript
  { receiverId, message, conversationId? }
  ```
- `get_messages`: Get conversation messages
  ```javascript
  { userId }
  ```
- `get_conversations`: Get all conversations
- `mark_read`: Mark messages as read
  ```javascript
  { userId }
  ```

#### Server → Client:
- `new_message`: New message received
- `message_sent`: Confirmation of message sent
- `messages_list`: List of messages
- `conversations_list`: List of conversations
- `messages_read`: Confirmation of messages marked as read
- `message_error`: Error with message
- `user_online`: User came online
- `user_offline`: User went offline

## Frontend Setup

### Socket Service
`frontend/src/services/socketService.js` provides a singleton service:
```javascript
import socketService from '../services/socketService';

// Connect (automatically uses auth token)
socketService.connect();

// Join auction
socketService.joinAuction(auctionId, secretCode, propertyId);

// Place bid
socketService.placeBid(auctionId, propertyId, bidAmount);

// Send message
socketService.sendMessage(receiverId, message, conversationId);

// Disconnect
socketService.disconnect();
```

### Environment Variables
Add to `frontend/.env`:
```
REACT_APP_SOCKET_URL=http://localhost:5000
REACT_APP_API_URL=http://localhost:5000/api
```

### Usage in Components

#### Live Auction Page
```javascript
import socketService from '../services/socketService';

useEffect(() => {
  const socket = socketService.connect();
  
  socket.on('new_bid', (data) => {
    // Handle new bid
  });
  
  socket.on('auction_joined', (data) => {
    // Handle successful join
  });
  
  return () => {
    socketService.leaveAuction(auctionId);
  };
}, []);
```

#### Chat Page
```javascript
import socketService from '../services/socketService';

useEffect(() => {
  const socket = socketService.connect();
  
  socket.on('new_message', (data) => {
    // Handle new message
  });
  
  socket.on('conversations_list', (data) => {
    // Update conversations
  });
  
  return () => {
    socketService.disconnect();
  };
}, []);
```

## Features Implemented

### Auction Features
✅ Real-time bid submission and broadcasting
✅ Bid validation (minimum increment, deposit check)
✅ Participant tracking
✅ Auction room management (join/leave)
✅ Secret code access control
✅ Live countdown timer (frontend)
✅ Highest bidder display
✅ Bid history in real-time
✅ Automatic auction ending when time expires
✅ Winner determination and announcement
✅ Admin manual auction end
✅ Real-time winner broadcast to all participants

### Chat Features
✅ Real-time messaging
✅ Conversation list
✅ Message history
✅ Online/offline status
✅ Read receipts
✅ User-to-user messaging

## Testing

1. Start backend server:
```bash
cd backend
npm run dev
```

2. Start frontend:
```bash
cd frontend
npm start
```

3. Test live auction:
   - Create a property with auction
   - Pay deposit
   - Join auction room
   - Place bids and see real-time updates

4. Test chat:
   - Open chat page
   - Select a conversation
   - Send messages and see real-time delivery

## Auction End Logic

The auction end logic has been fully implemented:

### Automatic Ending
- Auctions automatically end when `endTime` is reached
- System monitors all live auctions and ends them when time expires
- Winner is determined automatically (highest bidder)
- All participants receive real-time winner announcement

### Manual Ending (Admin)
- Admins can manually end auctions via Socket.IO `end_auction` event
- Also available via REST API: `POST /api/admin/auctions/:auctionId/end`
- Manual ending triggers same winner determination logic

### Winner Determination
1. Finds highest bidder from auction record
2. Retrieves winning bid amount
3. Updates all bid statuses:
   - Winner's bid: `status: 'winning'`
   - Other bids: `status: 'lost'` or `'outbid'`
4. Updates auction with winner information
5. Broadcasts winner announcement to all participants

### Winner Announcement Format
```javascript
{
  auction: { /* updated auction data */ },
  winner: {
    userId: ObjectId,
    winningBid: Number,
    finalizedAt: Date
  },
  endedBy: 'system' | 'admin_name',
  message: '🎉 Auction ended! Winner: [Name] with bid of [Amount] NPR'
}
```

## Future Enhancements

- [ ] Bid confirmation UI improvements
- [ ] Network latency optimization
- [ ] Reconnect handling improvements
- [ ] File sharing in chat
- [ ] Typing indicators
- [ ] Message delivery receipts
- [ ] Winner payment processing integration

