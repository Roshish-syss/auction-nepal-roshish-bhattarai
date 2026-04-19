import io from 'socket.io-client';
import { getAuthToken } from './authService';

/** Same host as REST API but without `/api` (Socket.IO on Render shares the web service origin). */
function resolveSocketUrl() {
  if (process.env.REACT_APP_SOCKET_URL) {
    return process.env.REACT_APP_SOCKET_URL.replace(/\/$/, '');
  }
  const api = process.env.REACT_APP_API_URL?.replace(/\/$/, '');
  if (api) {
    if (api.endsWith('/api')) {
      return api.slice(0, -4) || api;
    }
    return api;
  }
  return process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';
}

const SOCKET_URL = resolveSocketUrl();

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this._handlersAttached = false;
  }

  connect() {
    if (this.socket?.connected) {
      return this.socket;
    }

    const token = getAuthToken();

    if (!token) {
      console.error('No auth token available for Socket.IO connection');
      return null;
    }

    if (!SOCKET_URL) {
      return null;
    }

    // Reuse the same client while Socket.IO is reconnecting (avoid duplicate io() instances).
    if (this.socket && !this.socket.connected) {
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 400,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 25
    });

    if (!this._handlersAttached) {
      this._handlersAttached = true;
      this.socket.on('connect', () => {
        this.isConnected = true;
        if (process.env.NODE_ENV === 'development') {
          const sid = this.socket?.id;
          if (sid) console.log('Socket.IO connected:', sid);
        }
      });

      this.socket.on('disconnect', (reason) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('Socket.IO disconnected:', reason);
        }
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
        this.isConnected = false;
      });
    }

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.off('connect');
      this.socket.off('disconnect');
      this.socket.off('connect_error');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this._handlersAttached = false;
    }
  }

  getSocket() {
    if (!this.socket) {
      return this.connect();
    }
    if (!this.socket.connected) {
      // Let the existing client reconnect; do not create a second io() instance.
      return this.socket;
    }
    return this.socket;
  }

  // Auction events
  joinAuction(auctionId, secretCode = null, propertyId = null) {
    const socket = this.getSocket();
    if (socket) {
      socket.emit('join_auction', { auctionId, propertyId, secretCode });
    }
  }

  leaveAuction(auctionId) {
    const socket = this.getSocket();
    if (socket) {
      socket.emit('leave_auction', { auctionId });
    }
  }

  placeBid(auctionId, propertyId, bidAmount) {
    const socket = this.getSocket();
    if (socket) {
      socket.emit('place_bid', { auctionId, propertyId, bidAmount });
    }
  }

  getAuctionStatus(auctionId, propertyId = null) {
    const socket = this.getSocket();
    if (socket) {
      socket.emit('get_auction_status', { auctionId, propertyId });
    }
  }

  endAuction(auctionId) {
    const socket = this.getSocket();
    if (socket) {
      socket.emit('end_auction', { auctionId });
    }
  }

  pauseAuction(auctionId) {
    const socket = this.getSocket();
    if (socket) {
      socket.emit('pause_auction', { auctionId });
    }
  }

  resumeAuction(auctionId) {
    const socket = this.getSocket();
    if (socket) {
      socket.emit('resume_auction', { auctionId });
    }
  }

  /** Public auction room chat (same room as join_auction). */
  sendAuctionChatMessage(auctionId, message) {
    const socket = this.getSocket();
    if (socket) {
      socket.emit('send_auction_chat', { auctionId, message });
    }
  }

  // Chat events
  sendMessage(receiverId, message, conversationId = null) {
    const socket = this.getSocket();
    if (socket) {
      socket.emit('send_message', { receiverId, message, conversationId });
    }
  }

  getMessages(userId) {
    const socket = this.getSocket();
    if (socket) {
      socket.emit('get_messages', { userId });
    }
  }

  getConversations() {
    const socket = this.getSocket();
    if (socket) {
      socket.emit('get_conversations');
    }
  }

  markMessagesRead(userId) {
    const socket = this.getSocket();
    if (socket) {
      socket.emit('mark_read', { userId });
    }
  }
}

const socketService = new SocketService();
export default socketService;

