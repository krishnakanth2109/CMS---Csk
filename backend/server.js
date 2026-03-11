import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { protect, authorize } from './middleware/authMiddleware.js';
import Candidate from './models/Candidate.js';
import User from './models/User.js';

import authRoutes from './routes/authRoutes.js';
import recruiterRoutes from './routes/recruiterRoutes.js';
import candidateRoutes from './routes/candidateRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import interviewRoutes from './routes/interviewRoutes.js';
import messageRoutes from './routes/messageRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const app = express();
const httpServer = createServer(app);


// ─────────────────────────────────────────
// CORS FIX (Netlify + Render)
// ─────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://vagarious-cms.netlify.app',
  'https://cms-vagarious.netlify.app',
  'http://localhost:5173',
  'http://localhost:5000',
  'http://localhost:8080'
];

app.use(cors({
  origin: function(origin, callback) {

    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // allow temporarily
    }

  },
  credentials: true
}));

app.options('*', cors());


// ─────────────────────────────────────────
// BODY PARSER
// ─────────────────────────────────────────

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// ─────────────────────────────────────────
// STATIC FILES
// ─────────────────────────────────────────

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// ─────────────────────────────────────────
// SOCKET.IO
// ─────────────────────────────────────────

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {

  console.log(`⚡ Socket Connected: ${socket.id}`);

  socket.on('join_room', (userId) => {
    if (userId) {
      socket.join(userId);
      console.log(`User joined room: ${userId}`);
    }
  });

  socket.on('send_message', (data) => {

    if (data.to === "all") {
      socket.broadcast.emit('receive_message', data);
    } else {
      socket.to(data.to).emit('receive_message', data);
    }

  });

  socket.on('disconnect', () => {
    console.log("Socket disconnected");
  });

});


// ─────────────────────────────────────────
// DATABASE
// ─────────────────────────────────────────

const connectDB = async () => {

  try {

    await mongoose.connect(process.env.MONGO_URL);

    console.log("MongoDB Connected");

  } catch (error) {

    console.error("Database connection error:", error.message);
    process.exit(1);

  }

};

connectDB();


// ─────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/recruiters', recruiterRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/messages', messageRoutes);


// fallback routes

app.use('/auth', authRoutes);
app.use('/recruiters', recruiterRoutes);
app.use('/candidates', candidateRoutes);
app.use('/clients', clientRoutes);
app.use('/jobs', jobRoutes);
app.use('/interviews', interviewRoutes);
app.use('/messages', messageRoutes);


// ─────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    message: "CMS API running successfully 🚀"
  });
});


// ─────────────────────────────────────────
// ADMIN / MANAGER REPORTS
// ─────────────────────────────────────────

app.get('/api/reports', protect, authorize('admin', 'manager'), async (req, res) => {

  try {

    const candidates = await Candidate.find();

    const totalCandidates = candidates.length;

    const selected = candidates.filter(c => c.status === "Offer").length;
    const joined = candidates.filter(c => c.status === "Joined").length;

    const conversionRate =
      selected > 0 ? Math.round((joined / selected) * 100) : 0;

    const activeRecruiters = await User.countDocuments({
      role: "recruiter",
      active: true
    });

    res.json({
      overview: {
        totalCandidates,
        activeRecruiters,
        conversionRate: conversionRate + "%"
      }
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

});


// ─────────────────────────────────────────
// RECRUITER REPORTS
// ─────────────────────────────────────────

app.get('/api/reports/recruiter', protect, async (req, res) => {

  try {

    const recruiterId = req.user._id;

    const candidates = await Candidate.find({
      recruiterId
    });

    const submissions = candidates.length;
    const joined = candidates.filter(c => c.status === "Joined").length;
    const rejected = candidates.filter(c => c.status === "Rejected").length;

    const successRate =
      submissions > 0
        ? Math.round((joined / submissions) * 100)
        : 0;

    res.json({
      stats: {
        submissions,
        joined,
        rejected,
        successRate
      }
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

});


// ─────────────────────────────────────────
// GLOBAL ERROR HANDLER
// ─────────────────────────────────────────

app.use((err, req, res, next) => {

  console.error("Server Error:", err.stack);

  res.status(500).json({
    error: "Internal Server Error",
    details: err.message
  });

});


// ─────────────────────────────────────────
// SERVER START
// ─────────────────────────────────────────

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {

  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.IO initialized`);

});