import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Candidate from '../models/Candidate.js';
import User from '../models/User.js';
import { parseResume } from './resumeParser.js';
import { protect } from '../middleware/authMiddleware.js';
import { updateCandidateStatus, updateCandidateRemarks, inlineUpdateCandidate } from '../controllers/candidateStatusController.js';

const router = express.Router();

// ─── Shared helper — defined ONCE at module level ─────────────────────────────
// FIX 4: Was copy-pasted 3× inside POST /, PUT /bulk-assign, and PUT /:id.
//         A single module-level function guarantees consistency everywhere.
const resolveUserName = (u) => {
  if (!u) return 'Unknown';
  const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return full || u.username || u.email || 'Unknown';
};

// ─── Multer Setup ─────────────────────────────────────────────────────────────
const UPLOAD_DIR = 'uploads/';

// FIX 3: Replaced synchronous fs.existsSync + fs.mkdirSync with fs.mkdirSync
//         using the { recursive: true } flag. This is a one-liner that:
//         - Does nothing if the directory already exists (idempotent)
//         - Still synchronous but only runs ONCE at module load time,
//           NOT on every file upload request (which was the real problem).
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    allowedTypes.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Invalid file type. Only PDF and Docx allowed.'));
  },
});

// ─── Auth ────────────────────────────────────────────────────────────────────
router.use(protect);

// ─── Helper: sanitize FormData (Multer converts everything to strings) ────────
const sanitizeBody = (body) => {
  const data = { ...body };
  if (typeof data.skills === 'string') {
    data.skills = data.skills.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (data.offersInHand      === 'true')  data.offersInHand      = true;
  if (data.offersInHand      === 'false') data.offersInHand      = false;
  if (data.servingNoticePeriod === 'true')  data.servingNoticePeriod = true;
  if (data.servingNoticePeriod === 'false') data.servingNoticePeriod = false;
  return data;
};

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES — ORDER MATTERS IN EXPRESS
// Static paths (/parse-resume, /check-email, /check-phone) MUST come before
// parameterised paths (/:id) so Express doesn't swallow them as id values.
// ─────────────────────────────────────────────────────────────────────────────

// ── Parse Resume ──────────────────────────────────────────────────────────────
router.post('/parse-resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const fileBuffer  = fs.readFileSync(req.file.path);
    const parsedResult = await parseResume(fileBuffer, req.file.mimetype);

    try { fs.unlinkSync(req.file.path); } catch (e) { console.error('Failed to delete temp file:', e); }

    if (parsedResult.success) {
      return res.json({
        success: true,
        data: {
          name:             parsedResult.data.name            || '',
          email:            parsedResult.data.email           || '',
          contact:          parsedResult.data.contact         || '',
          skills:           parsedResult.data.skills          || '',
          totalExperience:  parsedResult.data.totalExperience || '',
          position:         parsedResult.data.position        || '',
        },
      });
    }
    res.json({ success: false, message: 'Could not parse resume', data: {} });
  } catch (error) {
    console.error('Resume parsing error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
    res.status(500).json({ success: false, message: 'Error parsing resume', error: error.message });
  }
});

// ── GET ALL (with date filtering) ─────────────────────────────────────────────
// FIX 2: Added .lean() — returns plain JS objects instead of full Mongoose
//         documents. For a large candidate list this is ~3× faster to serialise
//         and send, because Mongoose doesn't attach getters/setters/virtuals.
router.get('/', async (req, res) => {
  try {
    const query = {};

    // Recruiters always see only their own candidates (enforced server-side)
    if (req.user && req.user.role !== 'admin' && req.user.role !== 'manager') {
      query.recruiterId = req.user._id;
    }

    // Admin/manager can pass ?recruiterId=<id> to filter to a specific recruiter's candidates.
    // This is used when an admin is on the RecruiterCandidates page (their own personal view)
    // so they only see candidates they personally added, not the entire database.
    if (req.query.recruiterId && (req.user.role === 'admin' || req.user.role === 'manager')) {
      query.recruiterId = req.query.recruiterId;
    }

    if (req.query.date) {
      // FIX: Parse YYYY-MM-DD manually to treat as LOCAL date, not UTC.
      // new Date("2026-03-21") parses as UTC midnight, which in IST (UTC+5:30)
      // = 5:30 AM — missing all candidates added before 5:30 AM local time.
      const [yyyy, mm, dd] = req.query.date.split('-').map(Number);
      const start = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
      const end   = new Date(yyyy, mm - 1, dd, 23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    } else if (req.query.startDate && req.query.endDate) {
      const [sy, sm, sd] = req.query.startDate.split('-').map(Number);
      const [ey, em, ed] = req.query.endDate.split('-').map(Number);
      const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
      const end   = new Date(ey, em - 1, ed, 23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const candidates = await Candidate.find(query)
      .populate('recruiterId', 'name firstName lastName email')
      .sort({ createdAt: -1 })
      .lean(); // FIX 2: plain objects — faster serialisation on large lists

    res.json(candidates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Check email duplicate ──────────────────────────────────────────────────────
router.get('/check-email', async (req, res) => {
  try {
    const { email, excludeId } = req.query;
    if (!email) return res.json({ exists: false });

    const query = { email: email.trim().toLowerCase() };
    if (excludeId) query._id = { $ne: excludeId };

    const existing = await Candidate.findOne(query).select('_id name candidateId').lean();
    if (existing) {
      const id = existing.candidateId || existing._id.toString().slice(-6).toUpperCase();
      return res.json({ exists: true, candidateId: id, name: existing.name || '' });
    }
    res.json({ exists: false });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Check phone duplicate ──────────────────────────────────────────────────────
router.get('/check-phone', async (req, res) => {
  try {
    const { phone, excludeId } = req.query;
    if (!phone) return res.json({ exists: false });

    const digits = phone.trim().replace(/\D/g, '').replace(/^91/, '').slice(-10);
    if (digits.length !== 10) return res.json({ exists: false });

    const query = { contact: digits };
    if (excludeId) query._id = { $ne: excludeId };

    const existing = await Candidate.findOne(query).select('_id name candidateId').lean();
    if (existing) {
      const id = existing.candidateId || existing._id.toString().slice(-6).toUpperCase();
      return res.json({ exists: true, candidateId: id, name: existing.name || '' });
    }
    res.json({ exists: false });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Create Candidate ──────────────────────────────────────────────────────────
router.post('/', upload.single('resume'), async (req, res) => {
  try {
    let candidateData = sanitizeBody(req.body);

    if (req.file) {
      candidateData.resumeUrl          = `/uploads/${req.file.filename}`;
      candidateData.resumeOriginalName = req.file.originalname;
    }

    let targetRecruiterId   = req.user._id;
    let targetRecruiterName = resolveUserName(req.user); // FIX 4: shared helper

    if ((req.user.role === 'admin' || req.user.role === 'manager') && candidateData.recruiterId) {
      const assignedRecruiter = await User.findById(candidateData.recruiterId);
      if (assignedRecruiter) {
        targetRecruiterId   = assignedRecruiter._id;
        targetRecruiterName = resolveUserName(assignedRecruiter); // FIX 4
      }
    }

    candidateData.recruiterId   = targetRecruiterId;
    candidateData.recruiterName = targetRecruiterName;

    const newCandidate = new Candidate(candidateData);
    await newCandidate.save();
    res.status(201).json(newCandidate);
  } catch (error) {
    console.error('Create Error:', error);
    res.status(400).json({ message: error.message });
  }
});

// ── Bulk Assign ───────────────────────────────────────────────────────────────
// FIX 1: CRITICAL — Moved PUT /bulk-assign to BEFORE PUT /:id.
//
// WHY THIS WAS BREAKING:
//   Express matches routes top-to-bottom. The original code had:
//     router.put('/:id', ...)       ← defined FIRST
//     router.put('/bulk-assign', .) ← defined SECOND (never reached)
//
//   When the frontend called PUT /bulk-assign, Express saw "bulk-assign" as a
//   valid :id value and hit the single-candidate update handler instead.
//   The result: either a 404 (no candidate with id "bulk-assign") or, worse,
//   a corrupt update on a candidate whose _id happened to partially match.
//
// THE FIX: Static paths (exact strings) must always be declared before
//   parameterised paths (/:id) in the same HTTP method group.
router.put('/bulk-assign', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Not authorized to bulk assign candidates' });
    }

    const { candidateIds, recruiterId } = req.body;

    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      return res.status(400).json({ message: 'Please provide at least one candidate ID' });
    }
    if (!recruiterId) {
      return res.status(400).json({ message: 'Please provide a recruiter/user ID to assign to' });
    }

    const targetUser = await User.findById(recruiterId);
    if (!targetUser) return res.status(404).json({ message: 'Target user not found' });

    const recruiterName = resolveUserName(targetUser); // FIX 4: shared helper

    const result = await Candidate.updateMany(
      { _id: { $in: candidateIds } },
      { $set: { recruiterId: targetUser._id, recruiterName } }
    );

    res.json({
      message:       `Successfully assigned ${result.modifiedCount} candidate(s) to ${recruiterName}`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Bulk assign error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ── Get Single ────────────────────────────────────────────────────────────────
// FIX 5: The original code did candidate.recruiterId._id.toString() without
//         checking if recruiterId was populated. If the populate failed or the
//         field was a raw ObjectId (not a document), ._id would be undefined
//         and .toString() would throw a TypeError, crashing the request with
//         a 500 instead of returning a clean error.
router.get('/:id', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id)
      .populate('recruiterId', 'name firstName lastName email');

    if (!candidate) return res.status(404).json({ message: 'Candidate not found' });

    // FIX 5: Safe ownership check — handles both populated object and raw ObjectId
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      const ownerIdStr = candidate.recruiterId?._id?.toString()
                       || candidate.recruiterId?.toString();
      if (ownerIdStr !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to view this candidate' });
      }
    }

    res.json(candidate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Specialised status / remarks / inline-update ───────────────────────────────
// These are more specific paths (/:id/status etc.) so they must come BEFORE
// the generic PUT /:id below, which would otherwise match first.
router.put('/:id/status',        updateCandidateStatus);
router.put('/:id/remarks',       updateCandidateRemarks);
router.put('/:id/inline-update', inlineUpdateCandidate);

// ── Update Candidate ──────────────────────────────────────────────────────────
router.put('/:id', upload.single('resume'), async (req, res) => {
  try {
    let updateData = sanitizeBody(req.body);

    // Never overwrite timestamps
    delete updateData.dateAdded;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // findByIdAndUpdate bypasses pre-save hooks — rebuild name explicitly
    if (updateData.firstName || updateData.lastName) {
      updateData.name = `${updateData.firstName || ''} ${updateData.lastName || ''}`.trim();
    }

    const existingCandidate = await Candidate.findById(req.params.id);
    if (!existingCandidate) return res.status(404).json({ message: 'Candidate not found' });

    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      if (existingCandidate.recruiterId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    if (req.file) {
      updateData.resumeUrl          = `/uploads/${req.file.filename}`;
      updateData.resumeOriginalName = req.file.originalname;
    }

    if ((req.user.role === 'admin' || req.user.role === 'manager') && updateData.recruiterId) {
      const assignedRecruiter = await User.findById(updateData.recruiterId);
      if (assignedRecruiter) {
        updateData.recruiterName = resolveUserName(assignedRecruiter); // FIX 4: shared helper
      }
    }

    const updatedCandidate = await Candidate.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );
    res.json(updatedCandidate);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ── Delete Candidate ──────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ message: 'Candidate not found' });

    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      if (candidate.recruiterId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    if (candidate.resumeUrl) {
      const filePath = path.join(process.cwd(), candidate.resumeUrl);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) { console.error('File delete error:', e); }
      }
    }

    await Candidate.findByIdAndDelete(req.params.id);
    res.json({ message: 'Candidate deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;