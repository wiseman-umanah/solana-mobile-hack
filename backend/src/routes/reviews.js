const express = require('express');
const router = express.Router();
const Review = require('../models/review');
const authMiddleware = require('../middleware/authMiddleware');

const normaliseAddress = (address) => (address || '').trim();

const verifySignature = require('../utils/verifySignature');

const MAX_TIMESTAMP_DRIFT_MS = 1000 * 60 * 5; // 5 minutes

router.get('/:listingAddress', async (req, res) => {
  try {
    const listingAddress = normaliseAddress(req.params.listingAddress);
    if (!listingAddress) {
      return res.status(400).json({ success: false, error: 'missing listing address' });
    }

    const reviews = await Review.find({ listingAddress }).sort({ createdAt: -1 }).limit(100).lean();
    const count = await Review.countDocuments({ listingAddress });
    const aggregate = await Review.aggregate([
      { $match: { listingAddress } },
      { $group: { _id: null, averageRating: { $avg: '$rating' } } },
    ]);
    const averageRating = aggregate.length > 0 ? aggregate[0].averageRating : null;

    res.json({
      success: true,
      reviews,
      stats: { averageRating, count },
    });
  } catch (err) {
    console.error('reviews GET error', err);
    res.status(500).json({ success: false, error: 'internal' });
  }
});

router.post('/:listingAddress', authMiddleware, async (req, res) => {
  try {
    const listingAddress = normaliseAddress(req.params.listingAddress);
    if (!listingAddress) {
      return res.status(400).json({ success: false, error: 'missing listing address' });
    }
    const reviewer = req.user?.walletAddress;
    if (!reviewer) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }

    const { rating, comment } = req.body || {};
    const numericRating = Number(rating);
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ success: false, error: 'rating must be between 1 and 5' });
    }
    const trimmedComment = (comment || '').toString().trim();
    if (!trimmedComment) {
      return res.status(400).json({ success: false, error: 'comment is required' });
    }
    if (trimmedComment.length > 2000) {
      return res.status(400).json({ success: false, error: 'comment too long' });
    }

    try {
      const review = await Review.findOneAndUpdate(
        { listingAddress, reviewer },
        {
          $set: {
            rating: numericRating,
            comment: trimmedComment,
          },
          $setOnInsert: {
            listingAddress,
            reviewer,
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true },
      );
      res.json({ success: true, review });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ success: false, error: 'review already exists' });
      }
      throw err;
    }
  } catch (err) {
    console.error('reviews POST error', err);
    res.status(500).json({ success: false, error: 'internal' });
  }
});

// Allow submitting a signed review without prior JWT auth. Clients should sign a JSON message
// containing { listingAddress, rating, comment, ts } with their wallet private key and include
// the signature (base64) and the original message in the request body.
router.post('/:listingAddress/signed', async (req, res) => {
  try {
    const listingAddress = normaliseAddress(req.params.listingAddress);
    if (!listingAddress) {
      return res.status(400).json({ success: false, error: 'missing listing address' });
    }

    const { walletAddress, signature, message } = req.body || {};
    if (!walletAddress || !signature || !message) {
      return res.status(400).json({ success: false, error: 'missing signature payload' });
    }

    // parse message (should be JSON)
    let parsed;
    try {
      parsed = typeof message === 'string' ? JSON.parse(message) : message;
    } catch (err) {
      return res.status(400).json({ success: false, error: 'invalid message format' });
    }

    // verify listingAddress matches
    if (normaliseAddress(parsed.listingAddress) !== listingAddress) {
      return res.status(400).json({ success: false, error: 'listingAddress mismatch in signed message' });
    }

    const numericRating = Number(parsed.rating);
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ success: false, error: 'rating must be between 1 and 5' });
    }

    const trimmedComment = (parsed.comment || '').toString().trim();
    if (!trimmedComment) {
      return res.status(400).json({ success: false, error: 'comment is required in signed message' });
    }
    if (trimmedComment.length > 2000) {
      return res.status(400).json({ success: false, error: 'comment too long' });
    }

    const ts = Number(parsed.ts || 0);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_TIMESTAMP_DRIFT_MS) {
      return res.status(400).json({ success: false, error: 'timestamp out of range' });
    }

    // verify signature
    const ok = verifySignature(walletAddress, signature, typeof message === 'string' ? message : JSON.stringify(message));
    if (!ok) return res.status(401).json({ success: false, error: 'invalid signature' });

    const reviewer = walletAddress;

    try {
      const review = await Review.findOneAndUpdate(
        { listingAddress, reviewer },
        {
          $set: {
            rating: numericRating,
            comment: trimmedComment,
          },
          $setOnInsert: {
            listingAddress,
            reviewer,
            createdAt: new Date(ts),
          },
        },
        { upsert: true, new: true },
      );
      return res.json({ success: true, review });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ success: false, error: 'review already exists' });
      }
      throw err;
    }
  } catch (err) {
    console.error('reviews SIGNED POST error', err);
    res.status(500).json({ success: false, error: 'internal' });
  }
});

module.exports = router;
