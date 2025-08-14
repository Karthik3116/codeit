

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import aiRoutes from './routes/aiRoutes.js'; // <-- ADD THIS IMPORT
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

// Middleware and Routes
import { protect } from './middleware/authMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import contestRoutes from './routes/contestRoutes.js';
import codeRoutes from './routes/codeRoutes.js';



// The global Problem model is no longer needed
// import Problem from './models/problemModel.js'; 
import Contest from './models/contestModel.js';

dotenv.config();

// --- Database Connection ---
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    // The seeder function is removed as problems are now user-generated
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

connectDB();

const app = express();
const server = http.createServer(app);

const corsOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: corsOrigin }));
// Increase payload size limit to accept user-generated problems
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
    req.io = io;
    next();
});

// --- API Routes ---
app.get('/', (req, res) => res.send('API is running...'));
app.use('/api/auth', authRoutes);
app.use('/api/contest', protect, contestRoutes);
app.use('/api/code', protect, codeRoutes);
app.use('/api/ai', protect, aiRoutes); // <-- ADD THIS LINE


// --- Socket.IO Connection Handling ---
// io.on('connection', (socket) => {
//   console.log('A user connected:', socket.id);
//   socket.on('joinRoom', (roomId) => {
//     socket.join(roomId);
//     console.log(`User ${socket.id} joined room ${roomId}`);
//   });
//   socket.on('disconnect', () => {
//     console.log('User disconnected:', socket.id);
//   });
// });

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('chat:message', (data) => {
    const { roomId, message, user } = data;
    io.to(roomId).emit('chat:message', {
        id: nanoid(8), // Give each message a unique ID
        user,
        text: message,
        timestamp: new Date(),
        seenBy: [{ userId: user.id || user._id, userName: user.name }], // Sender has seen it by default
    });
  });

  // --- NEW: Event handler for when a user sees messages ---
  socket.on('chat:seen', (data) => {
    const { roomId, messageIds, user } = data;
    // Broadcast to the room that this user has seen these messages
    io.to(roomId).emit('chat:seenUpdate', { messageIds, user });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));