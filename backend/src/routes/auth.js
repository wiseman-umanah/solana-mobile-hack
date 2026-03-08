const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const verifySignature = require('../utils/verifySignature');
const Nonce = require('../models/nonce');
const RefreshToken = require('../models/refreshToken');
const User = require('../models/user');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL_DAYS = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '30', 10);

router.get('/nonce', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'missing wallet query param' });

  try {
    const nonce = Math.random().toString(36).substring(2) + Date.now();
    const saved = await Nonce.findOneAndUpdate({ walletAddress: wallet }, { nonce, createdAt: new Date() }, { upsert: true, new: true });
    res.json({ nonce: saved.nonce });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
});

router.post('/verify', async (req, res) => {
  const { walletAddress, signature } = req.body;
  if (!walletAddress || !signature) return res.status(400).json({ error: 'missing fields' });

  try {
    const record = await Nonce.findOne({ walletAddress });
    if (!record) return res.status(400).json({ error: 'nonce not found' });

    const ok = verifySignature(walletAddress, signature, record.nonce);
    if (!ok) return res.status(401).json({ error: 'invalid signature' });

  const token = jwt.sign({ walletAddress }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
  await Nonce.deleteOne({ walletAddress });

  await User.findOneAndUpdate(
    { walletAddress },
    { walletAddress },
    { upsert: true, setDefaultsOnInsert: true }
  );

  // Rotate existing refresh tokens for this wallet (single-session approach)
  await RefreshToken.deleteMany({ walletAddress });
  const refreshRaw = crypto.randomBytes(48).toString('hex');
  const refreshHash = crypto.createHash('sha256').update(refreshRaw).digest('hex');
  const refreshExpires = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await RefreshToken.create({
    walletAddress,
    tokenHash: refreshHash,
    expiresAt: refreshExpires,
  });

  res.json({
    success: true,
    token,
    expiresIn: ACCESS_TOKEN_TTL,
    refreshToken: refreshRaw,
    refreshExpiresAt: refreshExpires.toISOString(),
  });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
});

router.post('/refresh', async (req, res) => {
  const { walletAddress, refreshToken } = req.body;
  if (!walletAddress || !refreshToken) {
    return res.status(400).json({ error: 'missing walletAddress or refreshToken' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const record = await RefreshToken.findOne({ walletAddress, tokenHash });
    if (!record) {
      return res.status(401).json({ error: 'invalid refresh token' });
    }
    if (record.expiresAt <= new Date()) {
      await RefreshToken.deleteOne({ _id: record._id });
      return res.status(401).json({ error: 'refresh token expired' });
    }

    const newAccessToken = jwt.sign({ walletAddress }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });

    // rotate refresh token
    const newRefreshRaw = crypto.randomBytes(48).toString('hex');
    const newRefreshHash = crypto.createHash('sha256').update(newRefreshRaw).digest('hex');
    const newRefreshExpires = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    record.tokenHash = newRefreshHash;
    record.expiresAt = newRefreshExpires;
    record.lastUsedAt = new Date();
    await record.save();

    res.json({
      success: true,
      token: newAccessToken,
      expiresIn: ACCESS_TOKEN_TTL,
      refreshToken: newRefreshRaw,
      refreshExpiresAt: newRefreshExpires.toISOString(),
    });
  } catch (err) {
    console.error('refresh token error', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.post('/logout', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) return res.status(400).json({ error: 'missing walletAddress' });
  try {
    await RefreshToken.deleteMany({ walletAddress });
    res.json({ success: true });
  } catch (err) {
    console.error('logout error', err);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
