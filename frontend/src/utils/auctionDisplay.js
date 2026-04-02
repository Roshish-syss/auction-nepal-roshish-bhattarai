/**
 * Derive auction timing from property + optional auction record (list/detail API).
 */
export function getAuctionEndDate(property) {
  if (!property?.auctionTime) return null;
  if (property.auction?.endTime) return new Date(property.auction.endTime);
  if (property.auctionEndTime) return new Date(property.auctionEndTime);
  const start = new Date(property.auctionTime);
  const mins = property.auctionDuration != null ? Number(property.auctionDuration) : 60;
  return new Date(start.getTime() + mins * 60 * 1000);
}

export function getAuctionStartDate(property) {
  if (!property?.auctionTime) return null;
  if (property.auction?.startTime) return new Date(property.auction.startTime);
  if (property.auctionStartTime) return new Date(property.auctionStartTime);
  return new Date(property.auctionTime);
}

export function getAuctionRecordStatus(property) {
  return property?.auction?.status || property?.auctionRecordStatus || null;
}

/** True when the listing no longer accepts new deposits (completed, cancelled, or past end time). */
export function isAuctionClosedForDeposits(property) {
  if (!property) return true;
  if (['completed', 'cancelled', 'draft'].includes(property.status)) return true;
  const recordStatus = getAuctionRecordStatus(property);
  if (recordStatus === 'completed' || recordStatus === 'cancelled') return true;
  const end = getAuctionEndDate(property);
  if (end && new Date() > end) return true;
  return false;
}
