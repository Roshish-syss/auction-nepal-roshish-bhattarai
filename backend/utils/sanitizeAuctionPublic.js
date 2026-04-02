/**
 * Remove fields that must not appear on unauthenticated / public auction payloads.
 * Keeps `requiresSecretCode` so clients know to collect a code (without revealing it).
 */
function stripAuctionSecrets(auction) {
  if (!auction || typeof auction !== 'object') return auction;
  const { secretCode, ...rest } = auction;
  return {
    ...rest,
    requiresSecretCode: Boolean(secretCode)
  };
}

module.exports = { stripAuctionSecrets };
