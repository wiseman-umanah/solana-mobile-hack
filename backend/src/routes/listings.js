const express = require('express');
const router = express.Router();
const ListingActivity = require('../models/listingActivity');

const VALID_ACTIVITY_TYPES = ['CREATE', 'PURCHASE', 'DISCOUNT_PURCHASE', 'DISCOUNT_CANCELLED'];

const normaliseAddress = (addr) => {
  if (!addr || typeof addr !== 'string') return null;
  return addr.trim().toLowerCase();
};

router.post('/activity', async (req, res) => {
  try {
    const wallet = req.user && req.user.walletAddress;
    const { listingAddress, txHash, type } = req.body;

    if (!wallet) return res.status(401).json({ error: 'unauthorized' });
    if (!listingAddress || !txHash || !type) {
      return res.status(400).json({ error: 'listingAddress, txHash, and type are required' });
    }

    const normalisedListing = normaliseAddress(listingAddress);
    if (!normalisedListing) return res.status(400).json({ error: 'invalid listingAddress' });

    const activityType = type.toUpperCase();
    if (!VALID_ACTIVITY_TYPES.includes(activityType)) {
      return res.status(400).json({ error: `type must be one of ${VALID_ACTIVITY_TYPES.join(', ')}` });
    }

    const occurredAt = req.body.occurredAt ? new Date(req.body.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      return res.status(400).json({ error: 'invalid occurredAt' });
    }

    const record = await ListingActivity.create({
      walletAddress: wallet,
      listingAddress: normalisedListing,
      txHash: txHash.trim(),
      type: activityType,
      occurredAt,
    });

    res.json({ success: true, activity: record });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'transaction already recorded' });
    }
    console.error('listing activity error', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.get('/activity', async (req, res) => {
  try {
    const wallet = req.user && req.user.walletAddress;
    if (!wallet) return res.status(401).json({ error: 'unauthorized' });

    const query = { walletAddress: wallet };
    if (req.query.type) {
      const type = req.query.type.toUpperCase();
      if (VALID_ACTIVITY_TYPES.includes(type)) {
        query.type = type;
      }
    }

    const activities = await ListingActivity.find(query)
      .sort({ occurredAt: -1 })
      .limit(100)
      .lean();

    res.json({ success: true, activities });
  } catch (err) {
    console.error('listing activity fetch error', err);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
