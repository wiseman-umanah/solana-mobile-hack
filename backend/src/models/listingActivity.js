const mongoose = require('mongoose');

const ACTIVITY_TYPES = ['CREATE', 'PURCHASE', 'DISCOUNT_PURCHASE', 'DISCOUNT_CANCELLED'];

const listingActivitySchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, index: true },
  listingAddress: { type: String, required: true, index: true },
  txHash: { type: String, required: true, unique: true },
  type: { type: String, enum: ACTIVITY_TYPES, required: true },
  occurredAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

module.exports = mongoose.model('ListingActivity', listingActivitySchema);
