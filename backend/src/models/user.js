const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, unique: true, index: true },
  username: { type: String, unique: true, sparse: true, trim: true, minlength: 3, maxlength: 32 },
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
