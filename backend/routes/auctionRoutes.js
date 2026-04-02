const express = require('express');
const router = express.Router();
const Auction = require('../models/Auction');
const Property = require('../models/Property');
const Bid = require('../models/Bid');
const authMiddleware = require('../middleware/authMiddleware');
const { findApprovedDepositForAuction } = require('../utils/depositEligibility');
const { syncAuctionTimelinesFromDb, getIoOrNoop } = require('../utils/auctionLifecycleSync');
const { stripAuctionSecrets } = require('../utils/sanitizeAuctionPublic');

// @route   GET /api/auctions/property/:propertyId
// @desc    Get auction by property ID
// @access  Public
router.get('/property/:propertyId', async (req, res) => {
  try {
    await syncAuctionTimelinesFromDb(getIoOrNoop(req));
    const auction = await Auction.findOne({ propertyId: req.params.propertyId })
      .populate('propertyId', 'title basePrice depositAmount photos location specifications')
      .populate('highestBidder', 'fullName email')
      .populate('winner.userId', 'fullName email')
      .lean();

    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found for this property'
      });
    }

    // Get bid count
    const bidCount = await Bid.countDocuments({ auctionId: auction._id });

    res.json({
      success: true,
      auction: {
        ...stripAuctionSecrets(auction),
        bidCount
      }
    });
  } catch (error) {
    console.error('Get auction by property error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching auction',
      error: error.message
    });
  }
});

// @route   GET /api/auctions/property/:propertyId/bid-timeline
// @desc    Public bid history for transparency (amounts over time; no bidder identities)
// @access  Public
router.get('/property/:propertyId/bid-timeline', async (req, res) => {
  try {
    await syncAuctionTimelinesFromDb(getIoOrNoop(req));
    const propertyId = req.params.propertyId;
    const property = await Property.findById(propertyId).select('title auctionTime status').lean();
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const auction = await Auction.findOne({ propertyId })
      .populate('winner.userId', 'fullName')
      .lean();

    if (!auction) {
      return res.json({
        success: true,
        property: { id: property._id, title: property.title, status: property.status },
        auction: null,
        timeline: [],
        message: 'No auction record for this listing yet'
      });
    }

    const bids = await Bid.find({ auctionId: auction._id })
      .sort({ timestamp: 1 })
      .select('bidAmount previousBid timestamp status isWinningBid')
      .lean();

    const winnerUser = auction.winner?.userId;
    const winnerDisplay =
      auction.status === 'completed' && winnerUser
        ? {
            fullName:
              typeof winnerUser === 'object' && winnerUser.fullName
                ? winnerUser.fullName
                : 'Winner',
            winningBid: auction.winner.winningBid ?? auction.currentBid ?? null
          }
        : null;

    res.json({
      success: true,
      property: {
        id: property._id,
        title: property.title,
        status: property.status
      },
      auction: {
        id: auction._id,
        status: auction.status,
        startTime: auction.startTime,
        endTime: auction.endTime,
        actualEndTime: auction.actualEndTime,
        startingBid: auction.startingBid,
        bidIncrement: auction.bidIncrement,
        currentBid: auction.currentBid,
        totalBids: auction.totalBids,
        winner: winnerDisplay
      },
      timeline: bids.map((b, index) => ({
        sequence: index + 1,
        bidAmount: b.bidAmount,
        previousBid: b.previousBid,
        timestamp: b.timestamp,
        status: b.status,
        isWinningBid: b.isWinningBid
      }))
    });
  } catch (error) {
    console.error('Bid timeline error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching auction bid timeline',
      error: error.message
    });
  }
});

// @route   GET /api/auctions/property/:propertyId/eligibility
// @desc    Deposit-approved users get auction access code for this listing
// @access  Private
router.get('/property/:propertyId/eligibility', authMiddleware, async (req, res) => {
  try {
    await syncAuctionTimelinesFromDb(getIoOrNoop(req));
    const auction = await Auction.findOne({ propertyId: req.params.propertyId });

    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found for this property'
      });
    }

    const deposit = await findApprovedDepositForAuction(
      req.user._id,
      auction._id,
      auction.propertyId
    );

    const hasDeposit = !!deposit;

    res.json({
      success: true,
      canJoin: hasDeposit,
      hasDeposit,
      deposit: deposit || null,
      auctionId: auction._id,
      auction: {
        status: auction.status
      }
    });
  } catch (error) {
    console.error('Property eligibility error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking eligibility',
      error: error.message
    });
  }
});

// @route   GET /api/auctions/:auctionId
// @desc    Get auction by ID
// @access  Public
router.get('/:auctionId', async (req, res) => {
  try {
    await syncAuctionTimelinesFromDb(getIoOrNoop(req));
    const auction = await Auction.findById(req.params.auctionId)
      .populate('propertyId', 'title basePrice depositAmount photos location specifications')
      .populate('highestBidder', 'fullName email')
      .populate('winner.userId', 'fullName email')
      .lean();

    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    // Get bid count
    const bidCount = await Bid.countDocuments({ auctionId: auction._id });

    res.json({
      success: true,
      auction: {
        ...stripAuctionSecrets(auction),
        bidCount
      }
    });
  } catch (error) {
    console.error('Get auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching auction',
      error: error.message
    });
  }
});

// @route   GET /api/auctions/:auctionId/eligibility
// @desc    Check if user can join auction
// @access  Private
router.get('/:auctionId/eligibility', authMiddleware, async (req, res) => {
  try {
    await syncAuctionTimelinesFromDb(getIoOrNoop(req));
    const auction = await Auction.findById(req.params.auctionId);

    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    const deposit = await findApprovedDepositForAuction(
      req.user._id,
      auction._id,
      auction.propertyId
    );

    const hasDeposit = !!deposit;

    res.json({
      success: true,
      canJoin: hasDeposit,
      hasDeposit,
      deposit: deposit || null,
      auction: {
        status: auction.status
      }
    });
  } catch (error) {
    console.error('Check eligibility error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking eligibility',
      error: error.message
    });
  }
});

module.exports = router;

