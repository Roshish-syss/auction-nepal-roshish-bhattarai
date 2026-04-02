// Export all models from a central location
const User = require('./User');
const Property = require('./Property');
const Auction = require('./Auction');
const Bid = require('./Bid');
const Deposit = require('./Deposit');
const KYC = require('./KYC');
const Chat = require('./Chat');
const Rental = require('./Rental');
const Notification = require('./Notification');

module.exports = {
  User,
  Property,
  Auction,
  Bid,
  Deposit,
  KYC,
  Chat,
  Rental,
  Notification
};

