const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    listingAddress: { type: String, required: true, index: true },
    reviewer: { type: String, required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, maxlength: 2000 },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

reviewSchema.index({ listingAddress: 1, reviewer: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
