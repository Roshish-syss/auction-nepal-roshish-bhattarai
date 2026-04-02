const Auction = require('../models/Auction');
const Property = require('../models/Property');
const { endAuction } = require('../socket/auctionHandler');

function getIoOrNoop(req) {
  const io = req && req.app ? req.app.get('io') : null;
  if (io && typeof io.to === 'function') return io;
  return { to: () => ({ emit: () => {} }) };
}

/**
 * Align auction documents with wall clock.
 * - Completes expired scheduled/live/paused auctions via endAuction (winner + bids).
 * - Promotes scheduled → live when now is within [startTime, endTime].
 * - Property listings stay upcoming during a live auction; normalize legacy rows where property was set to live.
 */
async function syncAuctionTimelinesFromDb(io) {
  const ioSafe = io && typeof io.to === 'function' ? io : { to: () => ({ emit: () => {} }) };
  const now = new Date();

  const expired = await Auction.find({
    status: { $in: ['scheduled', 'live', 'paused'] },
    endTime: { $lt: now }
  })
    .select('_id')
    .lean();

  for (const row of expired) {
    await endAuction(ioSafe, row._id.toString(), 'system');
  }

  const toPromote = await Auction.find({
    status: 'scheduled',
    startTime: { $lte: now },
    endTime: { $gte: now }
  })
    .select('_id')
    .lean();

  if (toPromote.length > 0) {
    const ids = toPromote.map((a) => a._id);
    await Auction.updateMany({ _id: { $in: ids } }, { $set: { status: 'live' } });
  }

  const activePropIds = await Auction.distinct('propertyId', {
    status: { $in: ['live', 'paused', 'scheduled'] },
    endTime: { $gte: now }
  });
  if (activePropIds.length) {
    await Property.updateMany(
      { _id: { $in: activePropIds }, status: 'live' },
      { $set: { status: 'upcoming' } }
    );
  }
}

module.exports = { syncAuctionTimelinesFromDb, getIoOrNoop };
