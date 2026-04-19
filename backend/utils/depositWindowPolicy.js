/**
 * Deposits must stop when the auction is within 10 minutes of start (and after start).
 */
const TEN_MINUTES_MS = 10 * 60 * 1000;

function resolveAuctionStart(auction, property) {
  if (auction?.startTime) return new Date(auction.startTime);
  if (property?.auctionTime) return new Date(property.auctionTime);
  return null;
}

/**
 * @param {object|null} auction - Auction doc or lean object (optional)
 * @param {object|null} property - Property doc or lean (for fallback start time)
 * @returns {{ allowed: boolean, reason?: string, message?: string, auctionStart?: Date }}
 */
function evaluateDepositWindow(auction, property) {
  const start = resolveAuctionStart(auction, property);
  if (!start || Number.isNaN(start.getTime())) {
    return { allowed: true };
  }

  const now = Date.now();
  if (now >= start.getTime()) {
    return {
      allowed: false,
      reason: 'auction_started',
      message: 'The auction has already started. Deposits are no longer accepted.',
      auctionStart: start
    };
  }

  const cutoff = start.getTime() - TEN_MINUTES_MS;
  if (now >= cutoff) {
    return {
      allowed: false,
      reason: 'deposit_cutoff',
      message:
        'Deposits are closed: new submissions are not accepted during the final 10 minutes before the auction start time.',
      auctionStart: start
    };
  }

  return { allowed: true, auctionStart: start };
}

module.exports = {
  TEN_MINUTES_MS,
  evaluateDepositWindow
};
