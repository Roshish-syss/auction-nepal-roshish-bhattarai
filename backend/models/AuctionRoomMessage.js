const mongoose = require('mongoose');

const auctionRoomMessageSchema = new mongoose.Schema(
  {
    auctionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Auction',
      required: true,
      index: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters']
    }
  },
  { timestamps: true }
);

auctionRoomMessageSchema.index({ auctionId: 1, createdAt: -1 });

module.exports = mongoose.model('AuctionRoomMessage', auctionRoomMessageSchema);
