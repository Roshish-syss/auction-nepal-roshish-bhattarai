const Bid = require('../models/Bid');

/**
 * Detect suspicious bidding patterns
 * @param {String} auctionId - Auction ID
 * @returns {Object} Suspicious activities detected
 */
const detectSuspiciousBids = async (auctionId) => {
  try {
    const bids = await Bid.find({ auctionId: auctionId })
      .populate('userId', 'fullName email')
      .sort({ timestamp: 1 })
      .lean();

    if (!bids || bids.length === 0) {
      return {
        suspicious: false,
        patterns: []
      };
    }

    const patterns = [];
    const userBidMap = new Map(); // userId -> bids array
    const ipBidMap = new Map(); // ipAddress -> bids array

    // Group bids by user and IP
    bids.forEach(bid => {
      // By user
      if (!userBidMap.has(bid.userId._id.toString())) {
        userBidMap.set(bid.userId._id.toString(), []);
      }
      userBidMap.get(bid.userId._id.toString()).push(bid);

      // By IP
      if (bid.ipAddress) {
        if (!ipBidMap.has(bid.ipAddress)) {
          ipBidMap.set(bid.ipAddress, []);
        }
        ipBidMap.get(bid.ipAddress).push(bid);
      }
    });

    // Pattern 1: Rapid successive bids from same user (more than 3 bids in 10 seconds)
    userBidMap.forEach((userBids, userId) => {
      for (let i = 0; i < userBids.length - 2; i++) {
        const timeDiff = new Date(userBids[i + 2].timestamp) - new Date(userBids[i].timestamp);
        if (timeDiff < 10000) { // Less than 10 seconds
          patterns.push({
            type: 'rapid_bidding',
            severity: 'medium',
            description: `User ${userBids[0].userId.fullName} placed 3+ bids within 10 seconds`,
            userId: userId,
            userName: userBids[0].userId.fullName,
            bidIds: userBids.slice(i, i + 3).map(b => b._id.toString()),
            timestamp: userBids[i + 2].timestamp
          });
        }
      }
    });

    // Pattern 2: Unusual bid increments (too small or too large)
    for (let i = 1; i < bids.length; i++) {
      const increment = bids[i].bidAmount - bids[i - 1].bidAmount;
      const previousBid = bids[i - 1].bidAmount;
      const percentageIncrease = (increment / previousBid) * 100;

      // Less than 0.1% or more than 50% increase is suspicious
      if (percentageIncrease < 0.1 && increment > 0) {
        patterns.push({
          type: 'suspicious_increment',
          severity: 'low',
          description: `Bid #${i + 1} has unusually small increment (${increment} NPR, ${percentageIncrease.toFixed(2)}%)`,
          bidId: bids[i]._id.toString(),
          userId: bids[i].userId._id.toString(),
          userName: bids[i].userId.fullName,
          increment: increment,
          percentage: percentageIncrease,
          timestamp: bids[i].timestamp
        });
      } else if (percentageIncrease > 50) {
        patterns.push({
          type: 'excessive_increment',
          severity: 'medium',
          description: `Bid #${i + 1} has unusually large increment (${increment} NPR, ${percentageIncrease.toFixed(2)}%)`,
          bidId: bids[i]._id.toString(),
          userId: bids[i].userId._id.toString(),
          userName: bids[i].userId.fullName,
          increment: increment,
          percentage: percentageIncrease,
          timestamp: bids[i].timestamp
        });
      }
    }

    // Pattern 3: Multiple users bidding from same IP
    ipBidMap.forEach((ipBids, ipAddress) => {
      const uniqueUsers = new Set(ipBids.map(b => b.userId._id.toString()));
      if (uniqueUsers.size > 1 && ipBids.length >= 3) {
        patterns.push({
          type: 'same_ip_multiple_users',
          severity: 'high',
          description: `${uniqueUsers.size} different users bid from same IP address (${ipAddress})`,
          ipAddress: ipAddress,
          users: Array.from(uniqueUsers).map(userId => {
            const bid = ipBids.find(b => b.userId._id.toString() === userId);
            return {
              userId: userId,
              userName: bid.userId.fullName,
              bidCount: ipBids.filter(b => b.userId._id.toString() === userId).length
            };
          }),
          bidIds: ipBids.map(b => b._id.toString()),
          timestamp: ipBids[ipBids.length - 1].timestamp
        });
      }
    });

    // Pattern 4: User outbidding themselves repeatedly
    userBidMap.forEach((userBids, userId) => {
      if (userBids.length >= 3) {
        // Check if user is consistently outbidding themselves
        let selfOutbidCount = 0;
        for (let i = 1; i < userBids.length; i++) {
          const prevBid = userBids[i - 1];
          const currBid = userBids[i];
          
          // Check if there's another bid between these two from a different user
          const betweenBids = bids.filter(b => 
            new Date(b.timestamp) > new Date(prevBid.timestamp) &&
            new Date(b.timestamp) < new Date(currBid.timestamp) &&
            b.userId._id.toString() !== userId
          );
          
          if (betweenBids.length === 0) {
            selfOutbidCount++;
          }
        }

        if (selfOutbidCount >= 2) {
          patterns.push({
            type: 'self_outbidding',
            severity: 'medium',
            description: `User ${userBids[0].userId.fullName} outbid themselves ${selfOutbidCount} times`,
            userId: userId,
            userName: userBids[0].userId.fullName,
            selfOutbidCount: selfOutbidCount,
            bidIds: userBids.map(b => b._id.toString()),
            timestamp: userBids[userBids.length - 1].timestamp
          });
        }
      }
    });

    // Pattern 5: Bid timing patterns (all bids from one user in quick succession)
    userBidMap.forEach((userBids, userId) => {
      if (userBids.length >= 5) {
        // Check if all bids are within a short time span
        const timeSpan = new Date(userBids[userBids.length - 1].timestamp) - new Date(userBids[0].timestamp);
        if (timeSpan < 60000) { // Less than 1 minute
          patterns.push({
            type: 'bidding_bot_pattern',
            severity: 'high',
            description: `User ${userBids[0].userId.fullName} placed ${userBids.length} bids within ${(timeSpan / 1000).toFixed(0)} seconds`,
            userId: userId,
            userName: userBids[0].userId.fullName,
            bidCount: userBids.length,
            timeSpan: timeSpan,
            bidIds: userBids.map(b => b._id.toString()),
            timestamp: userBids[userBids.length - 1].timestamp
          });
        }
      }
    });

    // Flag bids based on patterns
    if (patterns.length > 0) {
      const bidIdsToFlag = new Set();
      patterns.forEach(pattern => {
        if (pattern.bidIds) {
          pattern.bidIds.forEach(bidId => bidIdsToFlag.add(bidId));
        }
        if (pattern.bidId) {
          bidIdsToFlag.add(pattern.bidId);
        }
      });

      // Update flagged status
      if (bidIdsToFlag.size > 0) {
        const mongoose = require('mongoose');
        await Bid.updateMany(
          { _id: { $in: Array.from(bidIdsToFlag).map(id => new mongoose.Types.ObjectId(id)) } },
          { 
            $set: {
              flagged: true,
              flagReason: 'Suspicious bidding pattern detected'
            }
          }
        );
      }
    }

    return {
      suspicious: patterns.length > 0,
      patternCount: patterns.length,
      patterns: patterns
    };
  } catch (error) {
    console.error('Error detecting suspicious bids:', error);
    throw error;
  }
};

module.exports = { detectSuspiciousBids };

