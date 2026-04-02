const mongoose = require('mongoose');
const Auction = require('../models/Auction');
const AuctionRoomMessage = require('../models/AuctionRoomMessage');
const Bid = require('../models/Bid');
const Property = require('../models/Property');
const { findApprovedDepositForAuction } = require('../utils/depositEligibility');

/** Normalize id from socket payload (string, ObjectId, or rare object shapes). */
const normalizeObjectIdInput = (raw) => {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'string') {
    const t = raw.trim();
    return t || null;
  }
  if (typeof raw === 'object') {
    if (raw._id != null) return normalizeObjectIdInput(raw._id);
    if (typeof raw.toString === 'function') {
      const s = String(raw);
      if (s && s !== '[object Object]') return s.trim() || null;
    }
  }
  const s = String(raw).trim();
  return s || null;
};

/** Resolve auction Mongo document by auction id and/or property id (handles wrong id from client). */
const resolveAuctionDocument = async (auctionId, propertyId) => {
  const aid = normalizeObjectIdInput(auctionId);
  const pid = normalizeObjectIdInput(propertyId);

  if (aid && mongoose.Types.ObjectId.isValid(aid)) {
    const byId = await Auction.findById(aid);
    if (byId) return byId;
  }
  if (pid && mongoose.Types.ObjectId.isValid(pid)) {
    const byProp = await Auction.findOne({ propertyId: pid });
    if (byProp) return byProp;
  }
  return null;
};

/** If auction is scheduled but its window has started, promote to live so bidding works. */
const promoteScheduledToLiveIfDue = async (auction) => {
  if (!auction || auction.status !== 'scheduled') return auction;
  const now = new Date();
  if (now >= auction.startTime && now <= auction.endTime) {
    auction.status = 'live';
    await auction.save();
  }
  return auction;
};

// Auction room management
const auctionRooms = new Map(); // Map<auctionId, Set<socketId>>
const auctionTimers = new Map(); // auctionId -> setInterval id OR { kind: 'timeout', id: setTimeout id }

function clearAuctionEndTimer(auctionId) {
  const entry = auctionTimers.get(auctionId);
  if (entry == null) return;
  if (typeof entry === 'object' && entry.kind === 'timeout') {
    clearTimeout(entry.id);
  } else {
    clearInterval(entry);
  }
  auctionTimers.delete(auctionId);
}

// Helper function to end auction and determine winner
const endAuction = async (io, auctionId, endedBy = 'system') => {
  try {
    const auction = await Auction.findById(auctionId)
      .populate('highestBidder', 'fullName email')
      .populate('propertyId', 'title')
      .lean();

    if (!auction || auction.status === 'completed' || auction.status === 'cancelled') {
      return;
    }

    // Determine winner (highest bidder)
    let winner = null;
    if (auction.highestBidder) {
      // Get the winning bid
      const winningBid = await Bid.findOne({
        auctionId: auctionId,
        userId: auction.highestBidder._id,
        status: { $in: ['accepted', 'winning'] }
      })
        .sort({ bidAmount: -1 })
        .lean();

      if (winningBid) {
        winner = {
          userId: auction.highestBidder._id,
          winningBid: winningBid.bidAmount,
          finalizedAt: new Date()
        };
      }
    }

    // Update auction status (single $set — do not mix `winner` with `$set['winner.x']` or MongoDB errors)
    const updatedAuction = await Auction.findByIdAndUpdate(
      auctionId,
      {
        $set: {
          status: 'completed',
          actualEndTime: new Date(),
          winner: winner
        }
      },
      { new: true }
    )
      .populate('highestBidder', 'fullName email')
      .populate('propertyId', 'title')
      .lean();

    // Mark all winning bids as completed
    if (winner) {
      await Bid.updateMany(
        {
          auctionId: auctionId,
          userId: winner.userId,
          status: { $in: ['accepted', 'winning'] }
        },
        { status: 'winning', isWinningBid: true }
      );

      // Mark all other bids as lost
      await Bid.updateMany(
        {
          auctionId: auctionId,
          userId: { $ne: winner.userId },
          status: { $ne: 'outbid' }
        },
        { status: 'lost' }
      );
    } else {
      // No winner - mark all bids as cancelled
      await Bid.updateMany(
        { auctionId: auctionId },
        { status: 'cancelled' }
      );
    }

    const propId = auction.propertyId?._id || auction.propertyId;
    const propertyTitle = auction.propertyId?.title || 'Property';
    const propIdStr = propId ? String(propId) : null;
    const formatPriceNpr = (n) =>
      new Intl.NumberFormat('en-NP', {
        style: 'currency',
        currency: 'NPR',
        minimumFractionDigits: 0
      }).format(Number(n));

    try {
      const {
        createAuctionWonNotification,
        createAuctionEndedLoserNotification,
        createAuctionEndedNoWinnerNotification
      } = require('../utils/notificationService');
      if (winner && winner.userId) {
        await createAuctionWonNotification(
          winner.userId.toString(),
          auctionId,
          propertyTitle,
          formatPriceNpr(winner.winningBid),
          propIdStr
        );
        const loserIds = await Bid.distinct('userId', {
          auctionId,
          userId: { $ne: winner.userId }
        });
        for (const uid of loserIds) {
          await createAuctionEndedLoserNotification(String(uid), auctionId, propertyTitle, propIdStr);
        }
      } else {
        const bidderIds = await Bid.distinct('userId', { auctionId });
        for (const uid of bidderIds) {
          await createAuctionEndedNoWinnerNotification(String(uid), propertyTitle, propIdStr, auctionId);
        }
      }
    } catch (notifErr) {
      console.error('End-auction notifications:', notifErr);
    }

    if (propId) {
      await Property.updateOne(
        { _id: propId, status: { $nin: ['cancelled', 'draft'] } },
        { $set: { status: 'completed' } }
      );
    }

    // Broadcast winner announcement to all users in auction room
    const roomName = `auction_${auctionId}`;
    io.to(roomName).emit('auction_ended', {
      auction: updatedAuction,
      winner: winner,
      endedBy: endedBy,
      message: winner 
        ? `🎉 Auction ended! Winner: ${auction.highestBidder?.fullName || 'Unknown'} with bid of ${winner.winningBid} NPR`
        : 'Auction ended with no winner'
    });

    clearAuctionEndTimer(auctionId);

    console.log(`Auction ${auctionId} ended. Winner: ${winner ? winner.userId : 'None'}`);
  } catch (error) {
    console.error('End auction error:', error);
  }
};

// End auction exactly at endTime (single timeout, not polling)
const startAuctionTimer = (io, auctionId, endTime) => {
  clearAuctionEndTimer(auctionId);
  const endMs = new Date(endTime).getTime();
  const delay = Math.max(0, endMs - Date.now());
  const timeoutId = setTimeout(async () => {
    auctionTimers.delete(auctionId);
    await endAuction(io, auctionId, 'system');
  }, delay);
  auctionTimers.set(auctionId, { kind: 'timeout', id: timeoutId });
};

const handleAuctionSocket = (io, socket) => {
  console.log(`User ${socket.userId} connected to auction socket`);

  // Join auction room
  socket.on('join_auction', async ({ auctionId, propertyId, secretCode }) => {
    try {
      const doc = await resolveAuctionDocument(auctionId, propertyId);
      if (!doc) {
        socket.emit('auction_error', { message: 'Auction not found' });
        return;
      }

      await promoteScheduledToLiveIfDue(doc);

      let auction = await Auction.findById(doc._id)
        .populate('propertyId', 'title depositAmount')
        .lean();

      auctionId = auction._id.toString();

      // Check if auction has ended
      const now = new Date();
      if (auction.status === 'completed' || auction.status === 'cancelled') {
        socket.emit('auction_error', { message: 'Auction has ended' });
        return;
      }

      // If auction is live or scheduled, start monitoring timer if not already started
      if ((auction.status === 'live' || auction.status === 'scheduled') && !auctionTimers.has(auctionId)) {
        startAuctionTimer(io, auctionId, auction.endTime);
      }

      // Check if auction time has passed but status not updated
      if (now >= auction.endTime && auction.status !== 'completed') {
        await endAuction(io, auctionId, 'system');
        socket.emit('auction_error', { message: 'Auction has ended' });
        return;
      }

      if (auction.status !== 'live' && auction.status !== 'scheduled') {
        socket.emit('auction_error', { message: 'Auction is not active' });
        return;
      }

      if (auction.status === 'scheduled') {
        const nowCheck = new Date();
        if (nowCheck > auction.endTime) {
          socket.emit('auction_error', { message: 'Auction has ended' });
          return;
        }
        // Before startTime: allow join as a waiting room (bidding still blocked until live).
      }

      const isAdmin = socket.user?.role === 'admin';

      if (!isAdmin) {
        const deposit = await findApprovedDepositForAuction(
          socket.userId,
          auctionId,
          auction.propertyId
        );
        const hasDeposit = !!deposit;
        const trimmedProvided = secretCode != null ? String(secretCode).trim() : '';
        const stored = auction.secretCode != null ? String(auction.secretCode).trim() : '';
        const codeMatches = Boolean(stored && trimmedProvided && stored === trimmedProvided);

        if (!hasDeposit && !codeMatches) {
          socket.emit('auction_error', {
            message:
              'Use the auction key on the property page, or pay a deposit and wait for approval to join this room.'
          });
          return;
        }
      }

      // Join room
      const roomName = `auction_${auctionId}`;
      socket.join(roomName);

      // Track user in auction room
      if (!auctionRooms.has(auctionId)) {
        auctionRooms.set(auctionId, new Set());
      }
      auctionRooms.get(auctionId).add(socket.id);

      // Send current auction state
      const bids = await Bid.find({ auctionId: auctionId })
        .populate('userId', 'fullName')
        .sort({ timestamp: -1 })
        .limit(50)
        .lean();

      const participantCount = auctionRooms.get(auctionId).size;

      socket.emit('auction_joined', {
        auction: {
          ...auction,
          currentBid: auction.currentBid || auction.startingBid,
          participantCount
        },
        bids: bids,
        message: 'Successfully joined auction room'
      });

      // Notify others
      socket.to(roomName).emit('participant_joined', {
        participantCount,
        userId: socket.userId,
        userName: socket.user.fullName
      });

      try {
        const chatMsgs = await AuctionRoomMessage.find({ auctionId })
          .sort({ createdAt: -1 })
          .limit(50)
          .populate('senderId', 'fullName')
          .lean();
        const history = chatMsgs.reverse().map((m) => ({
          _id: m._id,
          auctionId: String(m.auctionId),
          message: m.message,
          createdAt: m.createdAt,
          senderId: m.senderId?._id ? String(m.senderId._id) : String(m.senderId),
          senderName: m.senderId?.fullName || 'User'
        }));
        socket.emit('auction_chat_history', { messages: history });
      } catch (chatHistErr) {
        console.error('Auction chat history:', chatHistErr);
        socket.emit('auction_chat_history', { messages: [] });
      }

      console.log(`User ${socket.userId} joined auction ${auctionId}`);
    } catch (error) {
      console.error('Join auction error:', error);
      socket.emit('auction_error', { message: 'Error joining auction' });
    }
  });

  // Leave auction room
  socket.on('leave_auction', ({ auctionId }) => {
    const roomName = `auction_${auctionId}`;
    socket.leave(roomName);

    if (auctionRooms.has(auctionId)) {
      auctionRooms.get(auctionId).delete(socket.id);
      if (auctionRooms.get(auctionId).size === 0) {
        auctionRooms.delete(auctionId);
      }
    }

    socket.to(roomName).emit('participant_left', {
      participantCount: auctionRooms.get(auctionId)?.size || 0,
      userId: socket.userId
    });
  });

  // Room chat (only sockets in auction_<id> can send; messages broadcast to the room)
  socket.on('send_auction_chat', async ({ auctionId: rawAuctionId, message }) => {
    try {
      const aid = normalizeObjectIdInput(rawAuctionId);
      if (!aid || !mongoose.Types.ObjectId.isValid(aid)) {
        socket.emit('auction_chat_error', { message: 'Invalid auction' });
        return;
      }
      const roomName = `auction_${aid}`;
      if (!socket.rooms.has(roomName)) {
        socket.emit('auction_chat_error', { message: 'Join the auction room to chat' });
        return;
      }
      const text = typeof message === 'string' ? message.trim() : '';
      if (!text) {
        socket.emit('auction_chat_error', { message: 'Message cannot be empty' });
        return;
      }
      if (text.length > 500) {
        socket.emit('auction_chat_error', { message: 'Message too long (500 characters max)' });
        return;
      }
      const auctionDoc = await Auction.findById(aid).select('status').lean();
      if (!auctionDoc || auctionDoc.status === 'completed' || auctionDoc.status === 'cancelled') {
        socket.emit('auction_chat_error', { message: 'Auction is not active' });
        return;
      }
      const doc = await AuctionRoomMessage.create({
        auctionId: aid,
        senderId: socket.userId,
        message: text
      });
      const populated = await AuctionRoomMessage.findById(doc._id)
        .populate('senderId', 'fullName')
        .lean();
      const senderName =
        populated.senderId?.fullName || socket.user?.fullName || 'User';
      const payload = {
        _id: populated._id,
        auctionId: String(populated.auctionId),
        message: populated.message,
        createdAt: populated.createdAt,
        senderId: populated.senderId?._id
          ? String(populated.senderId._id)
          : String(socket.userId),
        senderName
      };
      io.to(roomName).emit('auction_chat_message', payload);
    } catch (err) {
      console.error('send_auction_chat error:', err);
      socket.emit('auction_chat_error', { message: 'Could not send message' });
    }
  });

  // Place bid
  socket.on('place_bid', async ({ auctionId, propertyId, bidAmount }) => {
    try {
      const amount = Number(bidAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        socket.emit('bid_error', { message: 'Invalid bid amount' });
        return;
      }

      let auction = await resolveAuctionDocument(auctionId, propertyId);

      if (!auction) {
        socket.emit('bid_error', { message: 'Auction not found' });
        return;
      }

      await promoteScheduledToLiveIfDue(auction);
      await auction.populate('propertyId', 'title');

      const resolvedAuctionId = auction._id.toString();

      // Check if auction is live (scheduled promoted above if in window)
      const now = new Date();
      if (auction.status !== 'live') {
        socket.emit('bid_error', { message: 'Auction is not live' });
        return;
      }

      if (now > auction.endTime) {
        await endAuction(io, resolvedAuctionId, 'system');
        socket.emit('bid_error', { message: 'Auction has ended' });
        return;
      }

      if (now < auction.startTime) {
        socket.emit('bid_error', { message: 'Auction has not started yet' });
        return;
      }

      // Validate bid amount
      const minBid = (auction.currentBid || auction.startingBid) + auction.bidIncrement;
      if (amount < minBid) {
        socket.emit('bid_error', { 
          message: `Minimum bid amount is ${minBid} NPR`,
          minBid 
        });
        return;
      }

      const deposit = await findApprovedDepositForAuction(
        socket.userId,
        resolvedAuctionId,
        auction.propertyId
      );

      if (!deposit) {
        socket.emit('bid_error', { message: 'Deposit required to place bid' });
        return;
      }

      const previousBids = await Bid.find({
        auctionId: resolvedAuctionId,
        userId: { $ne: socket.userId }, // Exclude current user's own bids
        status: { $in: ['accepted', 'pending', 'winning'] }
      }).populate('userId', 'fullName');

      // Update previous bids to "outbid"
      await Bid.updateMany(
        {
          auctionId: resolvedAuctionId,
          userId: { $ne: socket.userId },
          status: { $in: ['accepted', 'pending', 'winning'] }
        },
        { status: 'outbid' }
      );

      const propertyObjectId =
        propertyId && mongoose.Types.ObjectId.isValid(propertyId)
          ? propertyId
          : auction.propertyId?._id || auction.propertyId;

      // Create new bid
      const bid = new Bid({
        auctionId: resolvedAuctionId,
        propertyId: propertyObjectId,
        userId: socket.userId,
        bidAmount: amount,
        previousBid: auction.currentBid || auction.startingBid,
        status: 'accepted',
        isWinningBid: true,
        ipAddress: socket.handshake.address,
        timestamp: new Date()
      });

      await bid.save();

      // Update auction
      auction.currentBid = amount;
      auction.highestBidder = socket.userId;
      auction.totalBids = (auction.totalBids || 0) + 1;
      await auction.save();

      // Get populated bid data
      const bidData = await Bid.findById(bid._id)
        .populate('userId', 'fullName email')
        .lean();

      // Get property title for notifications
      const property = await Property.findById(propertyObjectId).lean();
      const propertyTitle = property?.title || 'Property';

      // Create notifications for outbid users
      if (previousBids.length > 0) {
        const { createBidOutbidNotification } = require('../utils/notificationService');
        const formatPrice = (price) => new Intl.NumberFormat('en-NP', {
          style: 'currency',
          currency: 'NPR',
          minimumFractionDigits: 0
        }).format(price);

        // Get unique user IDs to notify
        const userIdsToNotify = [...new Set(previousBids.map(b => b.userId._id.toString()))];
        
        // Create notifications for each outbid user
        for (const userId of userIdsToNotify) {
          try {
            await createBidOutbidNotification(
              userId,
              previousBids.find(b => b.userId._id.toString() === userId)?._id || resolvedAuctionId,
              propertyTitle,
              formatPrice(amount)
            );
          } catch (notifError) {
            console.error(`Error creating outbid notification for user ${userId}:`, notifError);
            // Continue with other notifications even if one fails
          }
        }
      }

      try {
        const { createBidPlacedNotification } = require('../utils/notificationService');
        const formatPriceBid = (price) =>
          new Intl.NumberFormat('en-NP', {
            style: 'currency',
            currency: 'NPR',
            minimumFractionDigits: 0
          }).format(price);
        await createBidPlacedNotification(
          socket.userId.toString(),
          bid._id,
          propertyTitle,
          formatPriceBid(amount),
          propertyObjectId ? String(propertyObjectId) : null
        );
      } catch (notifPlacedErr) {
        console.error('Bid placed notification:', notifPlacedErr);
      }

      // Broadcast new bid to all users in auction room
      const roomName = `auction_${resolvedAuctionId}`;
      io.to(roomName).emit('new_bid', {
        bid: bidData,
        auction: {
          currentBid: auction.currentBid,
          highestBidder: {
            _id: socket.userId,
            fullName: socket.user.fullName
          },
          totalBids: auction.totalBids
        }
      });

      console.log(`New bid placed: ${amount} NPR by user ${socket.userId} in auction ${resolvedAuctionId}`);
    } catch (error) {
      console.error('Place bid error:', error);
      socket.emit('bid_error', { message: 'Error placing bid' });
    }
  });

  // Get auction status
  socket.on('get_auction_status', async ({ auctionId, propertyId }) => {
    try {
      const doc = await resolveAuctionDocument(auctionId, propertyId);
      if (!doc) {
        socket.emit('auction_error', { message: 'Auction not found' });
        return;
      }

      const resolvedId = doc._id.toString();
      const auctionDoc = await Auction.findById(resolvedId);
      if (auctionDoc) {
        await promoteScheduledToLiveIfDue(auctionDoc);
      }

      const auction = await Auction.findById(resolvedId)
        .populate('highestBidder', 'fullName')
        .lean();

      if (!auction) {
        socket.emit('auction_error', { message: 'Auction not found' });
        return;
      }

      const participantCount = auctionRooms.get(resolvedId)?.size || 0;

      socket.emit('auction_status', {
        auction: {
          ...auction,
          participantCount
        }
      });
    } catch (error) {
      console.error('Get auction status error:', error);
      socket.emit('auction_error', { message: 'Error fetching auction status' });
    }
  });

  // Pause auction (admin only)
  socket.on('pause_auction', async ({ auctionId }) => {
    try {
      // Check if user is admin
      if (socket.user.role !== 'admin') {
        socket.emit('auction_error', { message: 'Only admins can pause auctions' });
        return;
      }

      const auction = await Auction.findById(auctionId);
      if (!auction || auction.status !== 'live') {
        socket.emit('auction_error', { message: 'Only live auctions can be paused' });
        return;
      }

      auction.status = 'paused';
      await auction.save();

      const roomName = `auction_${auctionId}`;
      io.to(roomName).emit('auction_paused', {
        auctionId: auctionId,
        message: 'Auction has been paused by admin',
        pausedAt: new Date()
      });

      socket.emit('auction_pause_success', {
        message: 'Auction paused successfully',
        auctionId
      });
    } catch (error) {
      console.error('Pause auction error:', error);
      socket.emit('auction_error', { message: 'Error pausing auction' });
    }
  });

  // Resume auction (admin only)
  socket.on('resume_auction', async ({ auctionId }) => {
    try {
      // Check if user is admin
      if (socket.user.role !== 'admin') {
        socket.emit('auction_error', { message: 'Only admins can resume auctions' });
        return;
      }

      const auction = await Auction.findById(auctionId);
      if (!auction || auction.status !== 'paused') {
        socket.emit('auction_error', { message: 'Only paused auctions can be resumed' });
        return;
      }

      const now = new Date();
      if (now > auction.endTime) {
        socket.emit('auction_error', { message: 'Cannot resume auction. End time has passed.' });
        return;
      }

      auction.status = 'live';
      await auction.save();

      const roomName = `auction_${auctionId}`;
      io.to(roomName).emit('auction_resumed', {
        auctionId: auctionId,
        message: 'Auction has been resumed',
        resumedAt: new Date()
      });

      socket.emit('auction_resume_success', {
        message: 'Auction resumed successfully',
        auctionId
      });
    } catch (error) {
      console.error('Resume auction error:', error);
      socket.emit('auction_error', { message: 'Error resuming auction' });
    }
  });

  // End auction (admin or manual)
  socket.on('end_auction', async ({ auctionId }) => {
    try {
      // Check if user is admin
      if (socket.user.role !== 'admin') {
        socket.emit('auction_error', { message: 'Only admins can end auctions' });
        return;
      }

      await endAuction(io, auctionId, socket.user.fullName || socket.user.email);
      
      socket.emit('auction_end_success', {
        message: 'Auction ended successfully',
        auctionId
      });

      console.log(`Admin ${socket.userId} manually ended auction ${auctionId}`);
    } catch (error) {
      console.error('End auction error:', error);
      socket.emit('auction_error', { message: 'Error ending auction' });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    // Remove from all auction rooms
    auctionRooms.forEach((participants, auctionId) => {
      if (participants.has(socket.id)) {
        participants.delete(socket.id);
        const roomName = `auction_${auctionId}`;
        socket.to(roomName).emit('participant_left', {
          participantCount: participants.size,
          userId: socket.userId
        });
        if (participants.size === 0) {
          auctionRooms.delete(auctionId);
        }
      }
    });
    console.log(`User ${socket.userId} disconnected from auction socket`);
  });
};

/** Clear and re-arm the auto-end timer when admin changes end time (live or scheduled). */
function resyncAuctionEndTimer(io, auctionId, endTime, status) {
  const aid = auctionId && auctionId.toString ? auctionId.toString() : String(auctionId);
  clearAuctionEndTimer(aid);
  if (!io || typeof io.to !== 'function') return;
  const endMs = new Date(endTime).getTime();
  if (endMs <= Date.now()) return;
  if (status === 'live' || status === 'scheduled') {
    startAuctionTimer(io, aid, endTime);
  }
}

// Export endAuction function for use in routes
module.exports = {
  handleAuctionSocket,
  endAuction,
  startAuctionTimer,
  clearAuctionEndTimer,
  resyncAuctionEndTimer
};

