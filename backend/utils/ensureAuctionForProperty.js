const crypto = require('crypto');
const Auction = require('../models/Auction');
const Property = require('../models/Property');
const { endAuction, resyncAuctionEndTimer, clearAuctionEndTimer } = require('../socket/auctionHandler');

function computeAuctionWindow(propertyLike) {
  const startTime = new Date(propertyLike.auctionTime);
  const durationMin =
    propertyLike.auctionDuration != null && propertyLike.auctionDuration !== ''
      ? Number(propertyLike.auctionDuration)
      : 60;
  const endTime = new Date(startTime.getTime() + durationMin * 60 * 1000);
  return { startTime, endTime };
}

async function generateUniqueSecretCode() {
  for (let i = 0; i < 12; i++) {
    const code = crypto.randomBytes(6).toString('hex');
    const taken = await Auction.exists({ secretCode: code });
    if (!taken) return code;
  }
  return `${Date.now().toString(36)}${crypto.randomBytes(6).toString('hex')}`;
}

/**
 * Create auction row for a property (one per property, unique index).
 * @param {object} propertyLike — needs _id, basePrice, auctionTime, auctionDuration
 */
async function createAuctionForProperty(propertyLike) {
  const { startTime, endTime } = computeAuctionWindow(propertyLike);
  const base = Number(propertyLike.basePrice) || 0;
  const secretCode = await generateUniqueSecretCode();
  const auction = new Auction({
    propertyId: propertyLike._id,
    startingBid: base,
    currentBid: base,
    bidIncrement: 1000,
    status: 'scheduled',
    startTime,
    endTime,
    secretCode
  });
  await auction.save();
  return auction;
}

async function ensureAuctionForProperty(propertyLike) {
  const existing = await Auction.findOne({ propertyId: propertyLike._id });
  if (existing) return existing;
  return createAuctionForProperty(propertyLike);
}

/** Backfill: upcoming listings without an auction row (legacy data). */
async function ensureAuctionsForOrphanUpcomingProperties() {
  const props = await Property.find({ status: 'upcoming' })
    .select('_id basePrice auctionTime auctionDuration')
    .lean();

  for (const p of props) {
    const exists = await Auction.exists({ propertyId: p._id });
    if (!exists) {
      await createAuctionForProperty(p);
    }
  }
}

function emptyWinner() {
  return {
    userId: null,
    winningBid: null,
    finalizedAt: null,
    paymentStatus: null
  };
}

function resetAuctionSessionFields(auction, basePrice) {
  const base = Number(basePrice) || 0;
  auction.startingBid = base;
  auction.currentBid = base;
  auction.highestBidder = null;
  auction.totalBids = 0;
  auction.winner = emptyWinner();
  auction.actualEndTime = null;
}

/**
 * Align property listing status with auction document (draft/cancelled untouched).
 */
function syncPropertyStatusFromAuction(propertyDoc, auction, now) {
  if (propertyDoc.status === 'draft' || propertyDoc.status === 'cancelled') {
    return;
  }
  if (auction.status === 'completed') {
    propertyDoc.status = 'completed';
    return;
  }
  if (auction.status === 'cancelled') {
    propertyDoc.status = 'cancelled';
    return;
  }
  // live, paused, scheduled → listing shows as upcoming (same convention as auctionLifecycleSync)
  propertyDoc.status = 'upcoming';
}

/**
 * When admin edits auctionTime / auctionDuration: keep Auction row in sync, fix statuses,
 * reopen completed/cancelled auctions if moved to the future, reset live session if moved forward.
 *
 * @param {import('mongoose').Document} propertyDoc — saved property
 * @param {*} io — Socket.IO (or noop) for timers / endAuction
 */
async function syncAuctionWithPropertySchedule(propertyDoc, io) {
  const { startTime, endTime } = computeAuctionWindow(propertyDoc);
  const now = new Date();
  const base = Number(propertyDoc.basePrice) || 0;
  const skipStatusMutation =
    propertyDoc.status === 'draft' || propertyDoc.status === 'cancelled';

  let auction = await Auction.findOne({ propertyId: propertyDoc._id });
  if (!auction) {
    await ensureAuctionForProperty(propertyDoc);
    auction = await Auction.findOne({ propertyId: propertyDoc._id });
    if (!auction) return;
  }

  const auctionIdStr = auction._id.toString();

  const applyTimesAndBase = () => {
    auction.startTime = startTime;
    auction.endTime = endTime;
    auction.startingBid = base;
  };

  /** Times only — for draft/cancelled listings */
  if (skipStatusMutation) {
    applyTimesAndBase();
    if (auction.status === 'scheduled' && !auction.totalBids) {
      auction.currentBid = base;
    }
    await auction.save();
    return;
  }

  // Past window: end via normal pipeline (winner, property completed)
  if (now > endTime && ['scheduled', 'live', 'paused'].includes(auction.status)) {
    applyTimesAndBase();
    await auction.save();
    await endAuction(io, auctionIdStr, 'system');
    return;
  }

  // Completed auction: reopen if new schedule is entirely in the future
  if (auction.status === 'completed') {
    applyTimesAndBase();
    if (startTime > now) {
      auction.status = 'scheduled';
      resetAuctionSessionFields(auction, base);
      propertyDoc.status = 'upcoming';
    }
    await auction.save();
    await propertyDoc.save();
    clearAuctionEndTimer(auctionIdStr);
    if (auction.status === 'scheduled' && startTime > now) {
      resyncAuctionEndTimer(io, auctionIdStr, endTime, auction.status);
    }
    return;
  }

  if (auction.status === 'cancelled') {
    applyTimesAndBase();
    if (startTime > now) {
      auction.status = 'scheduled';
      resetAuctionSessionFields(auction, base);
      propertyDoc.status = 'upcoming';
    }
    await auction.save();
    await propertyDoc.save();
    clearAuctionEndTimer(auctionIdStr);
    if (auction.status === 'scheduled' && startTime > now) {
      resyncAuctionEndTimer(io, auctionIdStr, endTime, auction.status);
    }
    return;
  }

  // scheduled
  if (auction.status === 'scheduled') {
    applyTimesAndBase();
    if (!auction.totalBids) {
      auction.currentBid = base;
    }
    if (now >= startTime && now <= endTime) {
      auction.status = 'live';
    }
    await auction.save();
    syncPropertyStatusFromAuction(propertyDoc, auction, now);
    await propertyDoc.save();
    resyncAuctionEndTimer(io, auctionIdStr, endTime, auction.status);
    return;
  }

  // live or paused
  applyTimesAndBase();
  if (startTime > now) {
    auction.status = 'scheduled';
    resetAuctionSessionFields(auction, base);
    propertyDoc.status = 'upcoming';
    clearAuctionEndTimer(auctionIdStr);
    await auction.save();
    await propertyDoc.save();
    resyncAuctionEndTimer(io, auctionIdStr, endTime, 'scheduled');
    return;
  }

  if (now > endTime) {
    await auction.save();
    await endAuction(io, auctionIdStr, 'system');
    return;
  }

  // Still inside window
  if (!auction.totalBids) {
    auction.currentBid = base;
  }
  await auction.save();
  syncPropertyStatusFromAuction(propertyDoc, auction, now);
  await propertyDoc.save();
  resyncAuctionEndTimer(io, auctionIdStr, endTime, auction.status);
}

/** When admin edits price/duration without touching auctionTime: keep scheduled auction in sync. */
async function syncScheduledAuctionFromSavedProperty(propertyDoc) {
  const auction = await Auction.findOne({ propertyId: propertyDoc._id });
  if (!auction || auction.status !== 'scheduled') return;
  const { startTime, endTime } = computeAuctionWindow(propertyDoc);
  auction.startTime = startTime;
  auction.endTime = endTime;
  auction.startingBid = propertyDoc.basePrice;
  if (!auction.totalBids) {
    auction.currentBid = propertyDoc.basePrice;
  }
  await auction.save();
}

module.exports = {
  createAuctionForProperty,
  ensureAuctionForProperty,
  ensureAuctionsForOrphanUpcomingProperties,
  syncScheduledAuctionFromSavedProperty,
  syncAuctionWithPropertySchedule,
  computeAuctionWindow
};
