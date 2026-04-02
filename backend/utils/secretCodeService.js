const crypto = require('crypto');

// Generate unique secret code for auction access
exports.generateSecretCode = () => {
  // Generate a random 8-character alphanumeric code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing characters (0, O, I, 1)
  let code = '';
  
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(crypto.randomInt(0, chars.length));
  }
  
  return code;
};

// Generate auction group link (you can customize this)
exports.generateAuctionGroupLink = (auctionId, secretCode) => {
  // This could be a WhatsApp group link, Telegram link, or custom platform link
  // For now, return a placeholder - you can customize based on your platform
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/auction/${auctionId}/join?code=${secretCode}`;
};

