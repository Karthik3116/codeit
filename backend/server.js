import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { nanoid } from 'nanoid';

// Middleware and Routes
import { protect } from './middleware/authMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import contestRoutes from './routes/contestRoutes.js';
import codeRoutes from './routes/codeRoutes.js';

// Models for seeding
import Problem from './models/problemModel.js';
import Contest from './models/contestModel.js';

dotenv.config();

// --- Database Connection & Seeding ---
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    // You can comment out the seeder after the first run if you want
    await seedProblems();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const seedProblems = async () => {
    try {
        const count = await Problem.countDocuments();
        if (count > 0) return;
        
        console.log("Seeding problems...");
        const problems = [
             {
                title: "Two Sum",
                description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`. You may assume that each input would have exactly one solution, and you may not use the same element twice.",
                testCases: [
                    { input: JSON.stringify([[2, 7, 11, 15], 9]), output: JSON.stringify([0, 1]) },
                    { input: JSON.stringify([[3, 2, 4], 6]), output: JSON.stringify([1, 2]) },
                ],
                starterCode: [
                    { language: 'javascript', code: 'function twoSum(nums, target) {\n  // Write your code here\n}' },
                    { language: 'python', code: 'def two_sum(nums, target):\n  # Write your code here\n  pass' },
                    { language: 'java', code: 'import java.util.*;\n\nclass Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your code here\n        return new int[]{};\n    }\n}' },
                ]
            },
            {
                title: "Palindrome Number",
                description: "Given an integer `x`, return `true` if `x` is a palindrome, and `false` otherwise. An integer is a palindrome when it reads the same backward as forward.",
                testCases: [ { input: "121", output: "true" }, { input: "-121", output: "false" }, ],
                starterCode: [
                     { language: 'javascript', code: 'function isPalindrome(x) {\n  // Write your code here\n}' },
                     { language: 'python', code: 'def is_palindrome(x):\n  # Write your code here\n  pass' },
                     { language: 'java', code: 'class Solution {\n    public boolean isPalindrome(int x) {\n        // Write your code here\n        return false;\n    }\n}' },
                ]
            },
            {
                title: "Fibonacci Number",
                description: "The Fibonacci numbers, commonly denoted `F(n)`, form a sequence, such that each number is the sum of the two preceding ones, starting from 0 and 1. Given `n`, calculate `F(n)`.",
                testCases: [ { input: "4", output: "3" }, { input: "10", output: "55" } ],
                 starterCode: [
                     { language: 'javascript', code: 'function fib(n) {\n  // Write your code here\n}' },
                     { language: 'python', code: 'def fib(n):\n  # Write your code here\n  pass' },
                     { language: 'java', code: 'class Solution {\n    public int fib(int n) {\n        // Write your code here\n        return 0;\n    }\n}' },
                ]
            }
        ];
        await Problem.insertMany(problems);
        console.log("Problems seeded successfully!");
    } catch (error) {
        console.error("Error seeding problems:", error);
    }
};

connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// This middleware attaches the `io` instance to every request.
app.use((req, res, next) => {
    req.io = io;
    next();
});

// --- API Routes ---
app.get('/', (req, res) => res.send('API is running...'));
app.use('/api/auth', authRoutes);
app.use('/api/contest', protect, contestRoutes);
app.use('/api/code', protect, codeRoutes);

// --- Socket.IO Connection Handling ---
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));