const express = require('express');
const router = express.Router();
const Message = require('../models/message');

// get conversations
router.get('/conversations', async (req, res) => {
  const wallet = req.user && req.user.walletAddress;
  if (!wallet) return res.status(401).json({ error: 'unauthorized' });

  try {
    const pipeline = [
      { $match: { $or: [{ sender: wallet }, { receiver: wallet }] } },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: {
            $cond: [{ $eq: ['$sender', wallet] }, '$receiver', '$sender']
          },
          lastMessage: { $first: '$message' },
          timestamp: { $first: '$timestamp' },
          unread: { $sum: { $cond: [{ $and: [{ $eq: ['$receiver', wallet] }, { $eq: ['$read', false] }] }, 1, 0] } }
        }
      }
    ];

  const results = await Message.aggregate(pipeline);
  const conversations = results.map(r => ({ peer: r._id, lastMessage: r.lastMessage, timestamp: r.timestamp, unreadCount: r.unread }));
  res.json({ success: true, conversations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
});

// get messages with a peer
router.get('/messages', async (req, res) => {
  const wallet = req.user && req.user.walletAddress;
  const { peer } = req.query;
  if (!wallet) return res.status(401).json({ error: 'unauthorized' });
  if (!peer) return res.status(400).json({ error: 'missing peer' });

  try {
  const messages = await Message.find({ $or: [{ sender: wallet, receiver: peer }, { sender: peer, receiver: wallet }] }).sort({ timestamp: 1 });
  res.json({ success: true, messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
});

// send a message (non-socket fallback used by mobile)
router.post('/messages', async (req, res) => {
  const wallet = req.user && req.user.walletAddress;
  const { receiver, message, tempId, offering_id = null } = req.body || {};

  if (!wallet) return res.status(401).json({ error: 'unauthorized' });
  if (!receiver || typeof receiver !== 'string') {
    return res.status(400).json({ error: 'receiver is required' });
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const saved = await Message.create({
      sender: wallet,
      receiver: receiver.trim(),
      message: message.trim(),
      tempId: typeof tempId === 'string' ? tempId : undefined,
      offering_id: offering_id ? String(offering_id) : null,
      delivered: false,
      read: false,
      timestamp: new Date(),
    });

    return res.json({ success: true, message: saved });
  } catch (err) {
    console.error('message send error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// mark inbound messages from a peer as read for this wallet
router.post('/messages/read', async (req, res) => {
  const wallet = req.user && req.user.walletAddress;
  const { peer } = req.body || {};
  if (!wallet) return res.status(401).json({ error: 'unauthorized' });
  if (!peer || typeof peer !== 'string') return res.status(400).json({ error: 'peer is required' });

  try {
    const result = await Message.updateMany(
      { sender: peer, receiver: wallet, read: false },
      { $set: { read: true } },
    );
    return res.json({ success: true, updated: result.modifiedCount ?? 0 });
  } catch (err) {
    console.error('message read update error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
