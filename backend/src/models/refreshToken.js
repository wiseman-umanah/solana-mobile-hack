const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  userAgent: { type: String },
  lastUsedAt: { type: Date },
}, {
  timestamps: true,
});

refreshTokenSchema.index({ walletAddress: 1, expiresAt: 1 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
