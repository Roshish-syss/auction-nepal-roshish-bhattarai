const Notification = require('../models/Notification');

/**
 * Create a notification for a user
 * @param {Object} notificationData - Notification data
 * @param {String} notificationData.userId - User ID
 * @param {String} notificationData.type - Notification type (bid, deposit, kyc, auction, wallet, system)
 * @param {String} notificationData.title - Notification title
 * @param {String} notificationData.message - Notification message
 * @param {String} notificationData.relatedId - Related entity ID (optional)
 * @param {String} notificationData.relatedType - Related entity type (optional)
 * @param {String} notificationData.link - Link to related page (optional)
 * @param {Object} notificationData.metadata - Additional metadata (optional)
 * @returns {Promise<Object>} Created notification
 */
const createNotification = async (notificationData) => {
  try {
    const notification = new Notification({
      userId: notificationData.userId,
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      relatedId: notificationData.relatedId || null,
      relatedType: notificationData.relatedType || null,
      link: notificationData.link || null,
      metadata: notificationData.metadata || {},
      read: false
    });

    await notification.save();

    try {
      const { emitNotificationNew } = require('../socket/notificationSocketHub');
      await emitNotificationNew(notificationData.userId, notification);
    } catch (emitErr) {
      console.error('Notification socket emit:', emitErr);
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * Create notification for deposit approval
 */
const createDepositApprovedNotification = async (userId, depositId, propertyTitle, amount) => {
  return createNotification({
    userId,
    type: 'deposit',
    title: 'Deposit Approved',
    message: `Your deposit of ${amount} NPR for "${propertyTitle}" has been approved. You can now participate in the auction.`,
    relatedId: depositId,
    relatedType: 'deposit',
    link: `/deposits`,
    metadata: { amount, propertyTitle }
  });
};

/**
 * Create notification for deposit rejection
 */
const createDepositRejectedNotification = async (userId, depositId, propertyTitle, amount, reason) => {
  return createNotification({
    userId,
    type: 'deposit',
    title: 'Deposit Rejected',
    message: `Your deposit of ${amount} NPR for "${propertyTitle}" has been rejected. Reason: ${reason || 'Not specified'}`,
    relatedId: depositId,
    relatedType: 'deposit',
    link: `/deposits`,
    metadata: { amount, propertyTitle, reason }
  });
};

/**
 * Create notification for bid outbid
 */
const createBidOutbidNotification = async (userId, bidId, propertyTitle, newBidAmount) => {
  return createNotification({
    userId,
    type: 'bid',
    title: 'You Were Outbid',
    message: `Someone placed a higher bid of ${newBidAmount} NPR on "${propertyTitle}". Place a new bid to stay in the auction.`,
    relatedId: bidId,
    relatedType: 'bid',
    link: `/my-bids`,
    metadata: { propertyTitle, newBidAmount }
  });
};

/**
 * Create notification for KYC approval
 */
const createKYCApprovedNotification = async (userId, kycId) => {
  return createNotification({
    userId,
    type: 'kyc',
    title: 'KYC Verification Approved',
    message: 'Your KYC verification has been approved. You can now participate in auctions and access all platform features.',
    relatedId: kycId,
    relatedType: 'kyc',
    link: `/profile?tab=kyc`,
    metadata: {}
  });
};

/**
 * Create notification for KYC rejection
 */
const createKYCRejectedNotification = async (userId, kycId, reason) => {
  return createNotification({
    userId,
    type: 'kyc',
    title: 'KYC Verification Rejected',
    message: `Your KYC verification has been rejected. Reason: ${reason || 'Not specified'}. Please resubmit your documents.`,
    relatedId: kycId,
    relatedType: 'kyc',
    link: `/kyc-verification`,
    metadata: { reason }
  });
};

/**
 * Create notification for auction started
 */
const createAuctionStartedNotification = async (userId, auctionId, propertyTitle, propertyId) => {
  const pid = propertyId || auctionId;
  return createNotification({
    userId,
    type: 'auction',
    title: 'Auction Started',
    message: `The auction for "${propertyTitle}" has started. Join now to place your bids!`,
    relatedId: auctionId,
    relatedType: 'auction',
    link: `/auctions/${pid}`,
    metadata: { propertyTitle }
  });
};

/**
 * Create notification for wallet top-up approval
 */
const createWalletTopUpApprovedNotification = async (userId, transactionId, amount) => {
  return createNotification({
    userId,
    type: 'wallet',
    title: 'Wallet Top-up Approved',
    message: `Your wallet top-up of ${amount} NPR has been approved. The amount has been added to your wallet balance.`,
    relatedId: transactionId,
    relatedType: null,
    link: `/wallet`,
    metadata: { amount }
  });
};

const createWalletTopUpSubmittedNotification = async (userId, amount) => {
  return createNotification({
    userId,
    type: 'wallet',
    title: 'Top-up Submitted',
    message: `Your wallet top-up of ${amount} NPR was received and is pending admin review.`,
    relatedType: null,
    link: `/wallet`,
    metadata: { amount }
  });
};

const createWalletTopUpRejectedNotification = async (userId, amount, reason) => {
  return createNotification({
    userId,
    type: 'wallet',
    title: 'Top-up Rejected',
    message: `Your wallet top-up of ${amount} NPR was rejected.${reason ? ` Reason: ${reason}` : ''}`,
    relatedType: null,
    link: `/wallet`,
    metadata: { amount, reason }
  });
};

const createDepositSubmittedNotification = async (userId, propertyTitle, amount) => {
  return createNotification({
    userId,
    type: 'deposit',
    title: 'Deposit Submitted',
    message: `Your deposit of ${amount} NPR for "${propertyTitle}" was submitted and is pending verification.`,
    relatedType: 'deposit',
    link: `/deposits`,
    metadata: { amount, propertyTitle }
  });
};

const createDepositWalletPaidNotification = async (userId, propertyTitle, amount) => {
  return createNotification({
    userId,
    type: 'deposit',
    title: 'Deposit Paid',
    message: `Your deposit of ${amount} NPR for "${propertyTitle}" was paid from wallet and approved.`,
    relatedType: 'deposit',
    link: `/deposits`,
    metadata: { amount, propertyTitle }
  });
};

const createBidPlacedNotification = async (userId, bidId, propertyTitle, amountFormatted, propertyId) => {
  const link = propertyId ? `/auction/${propertyId}/live` : '/my-bids';
  return createNotification({
    userId,
    type: 'bid',
    title: 'Bid Placed',
    message: `Your bid of ${amountFormatted} on "${propertyTitle}" was placed successfully.`,
    relatedId: bidId,
    relatedType: 'bid',
    link,
    metadata: { propertyTitle, amountFormatted }
  });
};

/** @param {string} propertyId - listing id for /auctions/:id */
const createAuctionWonNotification = async (userId, auctionId, propertyTitle, winningBidFormatted, propertyId) => {
  const pid = propertyId || auctionId;
  return createNotification({
    userId,
    type: 'auction',
    title: 'You Won the Auction',
    message: `You won the auction for "${propertyTitle}" with a bid of ${winningBidFormatted} NPR.`,
    relatedId: auctionId,
    relatedType: 'auction',
    link: `/auctions/${pid}`,
    metadata: { propertyTitle, winningBidFormatted }
  });
};

const createAuctionEndedLoserNotification = async (userId, auctionId, propertyTitle, propertyId) => {
  const pid = propertyId || auctionId;
  return createNotification({
    userId,
    type: 'auction',
    title: 'Auction Ended',
    message: `The auction for "${propertyTitle}" has ended. Another bidder had the highest bid.`,
    relatedId: auctionId,
    relatedType: 'auction',
    link: `/auctions/${pid}`,
    metadata: { propertyTitle }
  });
};

const createAuctionEndedNoWinnerNotification = async (userId, propertyTitle, propertyId, auctionId) => {
  return createNotification({
    userId,
    type: 'auction',
    title: 'Auction Ended',
    message: `The auction for "${propertyTitle}" ended with no winning bid.`,
    relatedId: auctionId || null,
    relatedType: 'auction',
    link: propertyId ? `/auctions/${propertyId}` : '/auctions',
    metadata: { propertyTitle }
  });
};

const createKycDocumentUploadedNotification = async (userId, kycId) => {
  return createNotification({
    userId,
    type: 'kyc',
    title: 'KYC Document Received',
    message: 'Your citizenship document was uploaded. Complete email verification if needed; we will review your KYC.',
    relatedId: kycId,
    relatedType: 'kyc',
    link: `/kyc-verification`,
    metadata: {}
  });
};

const createWelcomeNotification = async (userId) => {
  return createNotification({
    userId,
    type: 'system',
    title: 'Welcome to Auction Nepal',
    message: 'Your account is ready. Complete KYC, browse auctions, and join live rooms when you are verified.',
    relatedType: null,
    link: `/auctions`,
    metadata: {}
  });
};

module.exports = {
  createNotification,
  createDepositApprovedNotification,
  createDepositRejectedNotification,
  createBidOutbidNotification,
  createKYCApprovedNotification,
  createKYCRejectedNotification,
  createAuctionStartedNotification,
  createAuctionWonNotification,
  createWalletTopUpApprovedNotification,
  createWalletTopUpSubmittedNotification,
  createWalletTopUpRejectedNotification,
  createDepositSubmittedNotification,
  createDepositWalletPaidNotification,
  createBidPlacedNotification,
  createAuctionEndedLoserNotification,
  createAuctionEndedNoWinnerNotification,
  createKycDocumentUploadedNotification,
  createWelcomeNotification
};

