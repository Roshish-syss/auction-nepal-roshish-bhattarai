const express = require('express');
const router = express.Router();
const Bid = require('../models/Bid');
const Auction = require('../models/Auction');
const authMiddleware = require('../middleware/authMiddleware');

// @route   GET /api/bids/my-bids
// @desc    Get current user's bids
// @access  Private
router.get('/my-bids', authMiddleware, async (req, res) => {
  try {
    const { status, auctionId } = req.query;
    const query = { userId: req.user._id };
    
    if (status) {
      query.status = status;
    }
    
    if (auctionId) {
      query.auctionId = auctionId;
    }

    const bids = await Bid.find(query)
      .populate('auctionId', 'status startTime endTime')
      .populate('propertyId', 'title basePrice depositAmount photos')
      .sort({ timestamp: -1 })
      .lean();

    // Get auction details for each bid
    const bidsWithAuction = await Promise.all(
      bids.map(async (bid) => {
        const auction = await Auction.findById(bid.auctionId?._id)
          .populate('highestBidder', 'fullName')
          .lean();
        
        return {
          ...bid,
          auction: auction || null,
          isHighest: auction?.highestBidder?._id?.toString() === req.user._id.toString()
        };
      })
    );

    res.json({
      success: true,
      bids: bidsWithAuction
    });
  } catch (error) {
    console.error('Get my bids error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bids',
      error: error.message
    });
  }
});

// @route   GET /api/bids/auction-history
// @desc    Get user's auction participation history
// @access  Private
router.get('/auction-history', authMiddleware, async (req, res) => {
  try {
    // Get all unique auctions user has bid on
    const bids = await Bid.find({ userId: req.user._id })
      .select('auctionId')
      .lean();

    const auctionIds = [...new Set(bids.map(bid => bid.auctionId.toString()))];

    // Get auction details
    const auctions = await Auction.find({ _id: { $in: auctionIds } })
      .populate('propertyId', 'title photos basePrice depositAmount')
      .populate('highestBidder', 'fullName email')
      .sort({ startTime: -1 })
      .lean();

    // Get user's bids for each auction
    const auctionHistory = await Promise.all(
      auctions.map(async (auction) => {
        const userBids = await Bid.find({
          userId: req.user._id,
          auctionId: auction._id
        })
          .sort({ timestamp: -1 })
          .lean();

        const highestUserBid = userBids.length > 0 
          ? Math.max(...userBids.map(b => b.bidAmount))
          : 0;

        const isWinner = auction.winner?.userId?.toString() === req.user._id.toString();

        return {
          auction: {
            ...auction,
            userBidCount: userBids.length,
            highestUserBid: highestUserBid,
            isWinner: isWinner
          },
          bids: userBids
        };
      })
    );

    res.json({
      success: true,
      auctions: auctionHistory
    });
  } catch (error) {
    console.error('Get auction history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching auction history',
      error: error.message
    });
  }
});

module.exports = router;

