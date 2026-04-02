const express = require('express');
const router = express.Router();
const Property = require('../models/Property');
const Auction = require('../models/Auction');
const { syncAuctionTimelinesFromDb, getIoOrNoop } = require('../utils/auctionLifecycleSync');
const { stripAuctionSecrets } = require('../utils/sanitizeAuctionPublic');

// @route   GET /api/properties
// @desc    Get all properties with filtering, search, sorting, and pagination
// @access  Public
router.get('/', async (req, res) => {
  try {
    await syncAuctionTimelinesFromDb(getIoOrNoop(req));
    const {
      page = 1,
      limit = 12,
      search,
      location,
      city,
      district,
      type,
      minPrice,
      maxPrice,
      status,
      sort = 'auctionTime' // default sort by auction time
    } = req.query;

    // Build query
    const query = {};

    // Status filter (exclude draft and cancelled)
    if (status) {
      query.status = status;
    } else {
      query.status = { $in: ['upcoming', 'live', 'completed'] };
    }

    // Search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'location.address': { $regex: search, $options: 'i' } },
        { 'location.city': { $regex: search, $options: 'i' } }
      ];
    }

    // Location filters
    if (city) {
      query['location.city'] = { $regex: city, $options: 'i' };
    }
    if (district) {
      query['location.district'] = { $regex: district, $options: 'i' };
    }
    if (location) {
      query.$or = [
        { 'location.city': { $regex: location, $options: 'i' } },
        { 'location.district': { $regex: location, $options: 'i' } },
        { 'location.address': { $regex: location, $options: 'i' } }
      ];
    }

    // Property type filter
    if (type) {
      query.type = type;
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.basePrice = {};
      if (minPrice) query.basePrice.$gte = Number(minPrice);
      if (maxPrice) query.basePrice.$lte = Number(maxPrice);
    }

    // Build sort object
    let sortObj = {};
    switch (sort) {
      case 'price-asc':
        sortObj = { basePrice: 1 };
        break;
      case 'price-desc':
        sortObj = { basePrice: -1 };
        break;
      case 'date-asc':
        sortObj = { auctionTime: 1 };
        break;
      case 'date-desc':
        sortObj = { auctionTime: -1 };
        break;
      case 'popularity':
        sortObj = { views: -1, createdAt: -1 };
        break;
      default:
        sortObj = { auctionTime: 1 }; // upcoming auctions first
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const properties = await Property.find(query)
      .populate('ownerId', 'fullName')
      .populate('listedBy', 'fullName')
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count for pagination
    const total = await Property.countDocuments(query);

    // Get auction data for each property
    const propertiesWithAuction = await Promise.all(
      properties.map(async (property) => {
        const auction = await Auction.findOne({ propertyId: property._id })
          .sort({ createdAt: -1 })
          .lean();
        
        return {
          ...property,
          currentBid: auction?.currentBid || property.basePrice,
          bidCount: auction?.bidCount || 0,
          highestBidder: auction?.highestBidder || null,
          auctionEndTime: auction?.endTime || null,
          auctionStartTime: auction?.startTime || null,
          auctionRecordStatus: auction?.status || null
        };
      })
    );

    res.json({
      success: true,
      properties: propertiesWithAuction,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalProperties: total,
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching properties',
      error: error.message
    });
  }
});

// @route   GET /api/properties/:id
// @desc    Get single property by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    await syncAuctionTimelinesFromDb(getIoOrNoop(req));
    const property = await Property.findById(req.params.id)
      .populate('ownerId', 'fullName email phoneNumber')
      .populate('listedBy', 'fullName')
      .populate('createdBy', 'fullName')
      .lean();

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Get auction data
    const auction = await Auction.findOne({ propertyId: property._id })
      .populate('highestBidder', 'fullName')
      .populate('winner.userId', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();

    // Increment views
    await Property.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

    res.json({
      success: true,
      property: {
        ...property,
        currentBid: auction?.currentBid || property.basePrice,
        bidCount: auction?.bidCount || 0,
        highestBidder: auction?.highestBidder || null,
        auction: auction ? stripAuctionSecrets(auction) : null
      }
    });
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching property',
      error: error.message
    });
  }
});

// @route   GET /api/properties/filters/options
// @desc    Get filter options (cities, districts, types, price ranges)
// @access  Public
router.get('/filters/options', async (req, res) => {
  try {
    const properties = await Property.find({
      status: { $in: ['upcoming', 'live', 'completed'] }
    }).lean();

    // Extract unique cities
    const cities = [...new Set(properties.map(p => p.location.city).filter(Boolean))];

    // Extract unique districts
    const districts = [...new Set(properties.map(p => p.location.district).filter(Boolean))];

    // Extract unique types
    const types = [...new Set(properties.map(p => p.type))];

    // Calculate price range
    const prices = properties.map(p => p.basePrice);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    res.json({
      success: true,
      filters: {
        cities: cities.sort(),
        districts: districts.sort(),
        types: types.sort(),
        priceRange: {
          min: minPrice || 0,
          max: maxPrice || 0
        }
      }
    });
  } catch (error) {
    console.error('Get filter options error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching filter options',
      error: error.message
    });
  }
});

module.exports = router;

