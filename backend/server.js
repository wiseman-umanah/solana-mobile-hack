const path = require('path');
// Load .env from the backend folder (use __dirname so running from repo root still loads backend/.env)
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server: SocketServer } = require('socket.io');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { appConfig } = require('./src/config/appConfig');
const { applyCors, handlePreflight } = require('./src/middleware/cors');

const Message = require('./src/models/message');
const authRouter = require('./src/routes/auth');
const messagesRouter = require('./src/routes/messages');
const reviewsRouter = require('./src/routes/reviews');
const listingsRouter = require('./src/routes/listings');
const usersRouter = require('./src/routes/users');
const authMiddleware = require('./src/middleware/authMiddleware');

// Express setup
const app = express();
const server = http.createServer(app);

app.use((req, res, next) => {
  applyCors(req, res);
  if (handlePreflight(req, res)) {
    return;
  }
  next();
});

// Configure socket.io with CORS so polling transport is allowed from the frontend origin
const socketCorsOrigin = appConfig.allowedOrigins.includes('*')
  ? '*'
  : appConfig.allowedOrigins;

const io = new SocketServer(server, {
  cors: {
    origin: socketCorsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});


// Connect to MongoDB (support either DB_URI or MONGO_URI env var)
const mongoUri = process.env.DB_URI || process.env.MONGO_URI;

if (!mongoUri) console.warn('Warning: no MongoDB URI found in environment (DB_URI or MONGO_URI)');

mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("Failed to connect to MongoDB", err));

app.use(express.json());

// REST auth middleware is provided by ./src/middleware/authMiddleware.js and mounted on /api

// mount auth and API routes
app.use('/auth', authRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/listings', authMiddleware, listingsRouter);
app.use('/api/users', authMiddleware, usersRouter);
app.use('/api', authMiddleware, messagesRouter);


app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(
    '<!doctype html><html><head><meta charset="utf-8"><title>OTC Backend</title></head><body style="font-family: system-ui, sans-serif; padding: 2rem;"><h1>OTC Backend</h1><p>Hello, world! The backend is up and running.</p></body></html>',
  );
});


// Socket auth middleware: expect client to send { auth: { token } }
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(); // allow anonymous for now, but won't join rooms

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    socket.user = decoded; // { walletAddress }
    return next();
  } catch (err) {
    console.error('Socket auth error', err);
    return next();
  }
});

// WebSocket logic for real-time chat
io.on('connection', (socket) => {
  console.log('A user connected', socket.user ? socket.user.walletAddress : 'anonymous');

  // if authenticated, join a room named after the wallet address so we can emit to it
  if (socket.user && socket.user.walletAddress) {
    const me = socket.user.walletAddress;
    socket.join(me);
    // broadcast presence to others
    io.emit('presence', { wallet: me, online: true });
  }

  socket.on('sendMessage', async (messageData) => {
    // Use authenticated sender when available, otherwise fall back to messageData.sender
    const sender = socket.user && socket.user.walletAddress ? socket.user.walletAddress : messageData.sender;
    const { receiver, message, tempId, offering_id = null } = messageData;

    // Store the message in MongoDB
    const newMessage = new Message({ sender, receiver, message, tempId, offering_id });
    const saved = await newMessage.save();

    // Emit the message to the receiver room
    io.to(receiver).emit('newMessage', saved);

    // Echo back to sender with server-ack (so client can replace optimistic message)
    io.to(sender).emit('messageSent', saved);

    // If receiver is online (room has members), mark delivered and notify sender
    const room = io.sockets.adapter.rooms.get(receiver);
    if (room && room.size > 0) {
      saved.delivered = true;
      await saved.save();
      io.to(sender).emit('messageDelivered', { messageId: saved._id.toString(), receiver });
    }
  });

  // Client notifies server that messages are read
  socket.on('messageRead', async (payload) => {
    // payload: { messageIds: string[] }
    try {
      const { messageIds } = payload;
      if (!messageIds || !Array.isArray(messageIds)) return;
      const me = socket.user && socket.user.walletAddress;
      // mark messages as read
      await Message.updateMany({ _id: { $in: messageIds } }, { $set: { read: true } });
      // notify original senders that messages were read
      const msgs = await Message.find({ _id: { $in: messageIds } }).lean();
      for (const m of msgs) {
        io.to(m.sender).emit('messageRead', { messageId: m._id.toString(), reader: me });
      }
    } catch (err) {
      console.error('messageRead handler error', err);
    }
  });

  socket.on('disconnect', () => {
    if (socket.user && socket.user.walletAddress) {
      const me = socket.user.walletAddress;
      // broadcast presence offline
      io.emit('presence', { wallet: me, online: false });
    }
    console.log('A user disconnected');
  });
});

// Start the server
server.listen(appConfig.port, () => {
  console.log(`Server running on port ${appConfig.port}`);
});
