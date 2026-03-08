const express = require('express');
const router = express.Router();
const User = require('../models/user');

const validateUsername = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 32) return false;
  // allow letters, numbers, underscores, hyphen, dot
  return /^[a-zA-Z0-9_.-]+$/.test(trimmed);
};

router.get('/me', async (req, res) => {
  try {
    const walletAddress = req.user?.walletAddress;
    if (!walletAddress) return res.status(401).json({ error: 'unauthorized' });

    const user = await User.findOne({ walletAddress }).lean();
    res.json({
      success: true,
      profile: {
        walletAddress,
        username: user?.username ?? null,
      },
    });
  } catch (err) {
    console.error('profile get error', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.put('/me', async (req, res) => {
  try {
    const walletAddress = req.user?.walletAddress;
    if (!walletAddress) return res.status(401).json({ error: 'unauthorized' });

    const { username } = req.body;
    if (!validateUsername(username)) {
      return res.status(400).json({ error: 'username must be 3-32 characters (letters, numbers, underscore, dot, hyphen)' });
    }
    const formatted = username.trim();

    // ensure username uniqueness by checking existing record for this wallet to allow reusing same value
    const existing = await User.findOne({ walletAddress });
    if (existing && existing.username === formatted) {
      return res.json({ success: true, profile: { walletAddress, username: formatted } });
    }

    const collision = await User.findOne({ username: formatted });
    if (collision && collision.walletAddress !== walletAddress) {
      return res.status(409).json({ error: 'username already in use' });
    }

    const updated = await User.findOneAndUpdate(
      { walletAddress },
      { walletAddress, username: formatted },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      profile: {
        walletAddress: updated.walletAddress,
        username: updated.username,
      },
    });
  } catch (err) {
    console.error('profile update error', err);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
