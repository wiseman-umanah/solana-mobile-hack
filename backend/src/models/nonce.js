const mongoose = require('mongoose');

const nonceSchema = new mongoose.Schema({
  walletAddress: { type: String, unique: true },
  nonce: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Nonce', nonceSchema);
