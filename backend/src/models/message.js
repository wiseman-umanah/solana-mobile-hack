const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  message: String,
  tempId: String, // client-side temp id to match optimistic messages
  offering_id: { type: String, default: null },
  delivered: { type: Boolean, default: false },
  read: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Message', messageSchema);
