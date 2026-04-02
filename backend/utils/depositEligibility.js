const mongoose = require('mongoose');
const Deposit = require('../models/Deposit');

const APPROVED_STATUSES = ['approved', 'verified'];

/**
 * Property field may be ObjectId, populated { _id }, or string.
 */
function extractPropertyId(propertyField) {
  if (propertyField == null) return null;
  if (typeof propertyField === 'object' && propertyField._id != null) {
    return propertyField._id;
  }
  return propertyField;
}

/**
 * Find an approved/verified deposit for this user for the auction.
 * Tries auctionId first, then propertyId (one auction per property — fixes bad auctionId on old records).
 */
async function findApprovedDepositForAuction(userId, auctionId, propertyIdField) {
  const uid = userId != null ? String(userId) : null;
  const aid = auctionId != null ? String(auctionId) : null;
  const pidRaw = extractPropertyId(propertyIdField);
  const pid = pidRaw != null ? String(pidRaw) : null;

  if (!uid) return null;

  if (aid && mongoose.Types.ObjectId.isValid(aid)) {
    const byAuction = await Deposit.findOne({
      userId: uid,
      auctionId: aid,
      status: { $in: APPROVED_STATUSES }
    });
    if (byAuction) return byAuction;
  }

  if (pid && mongoose.Types.ObjectId.isValid(pid)) {
    const byProperty = await Deposit.findOne({
      userId: uid,
      propertyId: pid,
      status: { $in: APPROVED_STATUSES }
    });
    if (byProperty) return byProperty;
  }

  return null;
}

module.exports = {
  findApprovedDepositForAuction,
  extractPropertyId,
  APPROVED_STATUSES
};
