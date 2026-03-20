import 'dotenv/config'; // CRITICAL: Loads .env BEFORE any other imports

import express        from 'express';
import cors           from 'cors';
import mongoose       from 'mongoose';
import { createServer } from 'http';
import { Server }    from 'socket.io';
import path          from 'path';
import { fileURLToPath } from 'url';
import fs            from 'fs';

import { protect, authorize } from './middleware/authMiddleware.js';
import Candidate from './models/Candidate.js';
import User      from './models/User.js';

// ── Route modules ─────────────────────────────────────────────────────────────
import authRoutes      from './routes/authRoutes.js';
import recruiterRoutes from './routes/recruiterRoutes.js';
import candidateRoutes from './routes/candidateRoutes.js';
import clientRoutes    from './routes/clientRoutes.js';
import jobRoutes       from './routes/jobRoutes.js';
import interviewRoutes from './routes/interviewRoutes.js';
import messageRoutes   from './routes/messageRoutes.js';
import channelRoutes  from './routes/channelRoutes.js';

// ── __dirname shim for ES Modules ─────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const app        = express();
const httpServer = createServer(app);

// ─────────────────────────────────────────────────────────────────────────────
// FIX: Added 'vagarious-cms.netlify.app' to CORS allowed origins.
// ─────────────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://vagarious-cms.netlify.app',
  'https://cms-vagarious.netlify.app',
  'http://localhost:5173',
  'http://localhost:5000',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

// ── Socket.IO ──────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin:      ALLOWED_ORIGINS,
    methods:     ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// ── CORS ───────────────────────────────────────────────────────────────────────
app.use(cors({
  origin:         ALLOWED_ORIGINS,
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Database ───────────────────────────────────────────────────────────────────
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};
connectDB();

// ── Socket.IO events ───────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`⚡ Socket Connected: ${socket.id}`);

  // Join any room: userId for DMs, 'channel_<id>' for channel rooms
  socket.on('join_room', (roomId) => {
    if (roomId) {
      socket.join(roomId);
      console.log(`👤 Socket joined room: ${roomId}`);
    }
  });

  socket.on('leave_room', (roomId) => {
    if (roomId) {
      socket.leave(roomId);
    }
  });

  // ── Legacy DM messages ──────────────────────────────────────────────────────
  socket.on('send_message', (data) => {
    if (data.to === 'all') {
      socket.broadcast.emit('receive_message', data);
    } else {
      socket.to(data.to).emit('receive_message', data);
    }
  });

  // ── Channel / Teams messages ────────────────────────────────────────────────
  // data.to = 'channel_<channelId>'
  // Broadcasts 'channel_message' to everyone in that channel room (except sender)
  socket.on('channel_message', (data) => {
    if (data.channelId) {
      socket.to(`channel_${data.channelId}`).emit('channel_message', data);
    }
  });

  // Broadcast channel lifecycle events to all connected clients
  socket.on('channel_created', (channel) => {
    socket.broadcast.emit('channel_created', channel);
  });

  socket.on('channel_updated', (channel) => {
    socket.broadcast.emit('channel_updated', channel);
  });

  socket.on('channel_deleted', (payload) => {
    socket.broadcast.emit('channel_deleted', payload);
  });

  socket.on('disconnect', () => {
    console.log(`⚡ Socket Disconnected: ${socket.id}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE MODULES
// ═══════════════════════════════════════════════════════════════════════════════
app.use('/api/auth',       authRoutes);
app.use('/api/recruiters', recruiterRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/clients',    clientRoutes);
app.use('/api/jobs',       jobRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/messages',   messageRoutes);
app.use('/api/channels',   channelRoutes);

// Fallback routes (legacy support)
app.use('/auth',       authRoutes);
app.use('/recruiters', recruiterRoutes);
app.use('/candidates', candidateRoutes);
app.use('/clients',    clientRoutes);
app.use('/jobs',       jobRoutes);
app.use('/interviews', interviewRoutes);
app.use('/messages',   messageRoutes);
app.use('/channels',   channelRoutes);

app.get('/', (_req, res) => {
  res.json({ message: 'API is running with Socket.IO & File Uploads...' });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/reports  — Admin (Nainika) & Manager (Sanjay/Krishna/Navya) dashboard
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/reports', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { filter = 'month' } = req.query;

    const now = new Date();
    let startDate = null;
    if (filter === 'day') {
      startDate = new Date(now); startDate.setHours(0, 0, 0, 0);
    } else if (filter === 'week') {
      startDate = new Date(now); startDate.setDate(now.getDate() - 7);
    } else if (filter === 'month') {
      startDate = new Date(now); startDate.setMonth(now.getMonth() - 1);
    }

    const dateQuery = startDate ? { createdAt: { $gte: startDate } } : {};

    const INTERVIEW_STAGES = [
      'L1 Interview', 'L2 Interview', 'Final Interview',
      'Technical Interview', 'HR Interview', 'Interview',
    ];

    const candidates = await Candidate.find(dateQuery)
      .select('status recruiterId recruiterName createdAt')
      .lean();

    const totalSelected    = candidates.filter(c => c.status === 'Offer').length;
    const totalJoined      = candidates.filter(c => c.status === 'Joined').length;
    const conversionNum    = totalSelected > 0 ? Math.round((totalJoined / totalSelected) * 100) : 0;
    const activeRecruiters = await User.countDocuments({ role: 'recruiter', active: true });

    const recruiterMap = new Map();
    for (const c of candidates) {
      const key  = c.recruiterId?.toString() || 'unassigned';
      const name = c.recruiterName || 'Unassigned';
      if (!recruiterMap.has(key)) {
        recruiterMap.set(key, { name, Submissions: 0, Turnups: 0, Selected: 0, Joined: 0 });
      }
      const row = recruiterMap.get(key);
      row.Submissions += 1;
      if (INTERVIEW_STAGES.includes(c.status)) row.Turnups  += 1;
      if (c.status === 'Offer')                row.Selected += 1;
      if (c.status === 'Joined')               row.Joined   += 1;
    }
    const recruiterPerformance = Array.from(recruiterMap.values())
      .sort((a, b) => b.Submissions - a.Submissions);

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthCands = await Candidate.find({ createdAt: { $gte: start, $lte: end } })
        .select('status').lean();
      monthlyData.push({
        month:      MONTHS[d.getMonth()],
        candidates: monthCands.length,
        joined:     monthCands.filter(c => c.status === 'Joined').length,
      });
    }

    res.json({
      overview: { totalCandidates: candidates.length, activeRecruiters, conversionRate: `${conversionNum}%` },
      recruiterPerformance,
      monthlyData,
    });
  } catch (error) {
    console.error('[Reports] /api/reports error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/reports/recruiter — Per-recruiter own stats
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/reports/recruiter', protect, async (req, res) => {
  try {
    const recruiterId = req.user._id;

    const INTERVIEW_STAGES = new Set([
      'L1 Interview', 'L2 Interview', 'Final Interview',
      'Technical Interview', 'HR Interview', 'Interview',
    ]);

    const all = await Candidate.find({ recruiterId })
      .select('status createdAt')
      .lean();

    const totalSubmissions         = all.length;
    const totalInterviewsScheduled = all.filter(c => INTERVIEW_STAGES.has(c.status)).length;
    const offers                   = all.filter(c => c.status === 'Offer').length;
    const joined                   = all.filter(c => c.status === 'Joined').length;
    const rejected                 = all.filter(c => c.status === 'Rejected').length;
    const successRate              = totalSubmissions > 0
      ? Math.round((joined / totalSubmissions) * 100)
      : 0;

    const statusCounts = {};
    for (const c of all) {
      const s = c.status || 'Unknown';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }
    const STATUS_COLORS = {
      'Submitted':           '#3b82f6',
      'Pending':             '#f59e0b',
      'L1 Interview':        '#8b5cf6',
      'L2 Interview':        '#a855f7',
      'Final Interview':     '#c084fc',
      'Technical Interview': '#7c3aed',
      'HR Interview':        '#6d28d9',
      'Interview':           '#9333ea',
      'Offer':               '#22c55e',
      'Joined':              '#16a34a',
      'Rejected':            '#ef4444',
    };
    const statusData = Object.entries(statusCounts).map(([name, value]) => ({
      name, value, color: STATUS_COLORS[name] || '#94a3b8',
    }));

    const now        = new Date();
    const weeklyData = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (i + 1) * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() - i * 7);
      weekEnd.setHours(23, 59, 59, 999);

      const weekCands = all.filter(c => {
        const d = new Date(c.createdAt);
        return d >= weekStart && d <= weekEnd;
      });

      weeklyData.push({
        week:       `W${4 - i}`,
        submitted:  weekCands.length,
        interviews: weekCands.filter(c => INTERVIEW_STAGES.has(c.status)).length,
        offers:     weekCands.filter(c => c.status === 'Offer').length,
        joined:     weekCands.filter(c => c.status === 'Joined').length,
      });
    }

    res.json({
      stats: {
        totalSubmissions,
        activeInterviews:         totalInterviewsScheduled,
        totalInterviewsScheduled,
        offers,
        joined,
        rejected,
        successRate,
      },
      statusData,
      weeklyData,
    });
  } catch (error) {
    console.error('[Reports] /api/reports/recruiter error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// ── Global error handler ───────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Server Error Log:', err.stack);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.IO initialized`);
});