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

// --- 1. Multer Setup (Disk Storage) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and Docx allowed.'));
    }
  }
});

// Apply Authentication
router.use(protect);

// --- ROUTES ---

// Parse Resume
router.post('/parse-resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const parsedResult = await parseResume(fileBuffer, req.file.mimetype);

    try { fs.unlinkSync(req.file.path); } catch (err) { console.error("Failed to delete temp file:", err); }

    if (parsedResult.success) {
      res.json({
        success: true,
        data: {
          name: parsedResult.data.name || '',
          email: parsedResult.data.email || '',
          contact: parsedResult.data.contact || '',
          skills: parsedResult.data.skills || '',
          totalExperience: parsedResult.data.totalExperience || '',
          position: parsedResult.data.position || '',
        }
      });
    } else {
      res.json({ success: false, message: 'Could not parse resume', data: {} });
    }
  } catch (error) {
    console.error("Resume parsing error:", error);
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (err) {}
    }
    res.status(500).json({ success: false, message: 'Error parsing resume', error: error.message });
  }
});

// GET ALL
router.get('/', async (req, res) => {
  try {
    let query = {};
    // Allow Managers to see all candidates (bypass recruiter lock)
    if (req.user && req.user.role !== 'admin' && req.user.role !== 'manager') {
      query.recruiterId = req.user._id;
    }
    
    // 🔴 FIXED: Populating firstName, lastName, and email to pass to the frontend table
    const candidates = await Candidate.find(query)
      .populate('recruiterId', 'name firstName lastName email')
      .sort({ createdAt: -1 });
      
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper to fix data types from FormData (Multer converts everything to strings)
const sanitizeBody = (body) => {
  const data = { ...body };
  
  if (typeof data.skills === 'string') {
    data.skills = data.skills.split(',').map(s => s.trim());
  }
  
  // Convert "true"/"false" strings to Booleans
  if (data.offersInHand === 'true') data.offersInHand = true;
  if (data.offersInHand === 'false') data.offersInHand = false;
  
  if (data.servingNoticePeriod === 'true') data.servingNoticePeriod = true;
  if (data.servingNoticePeriod === 'false') data.servingNoticePeriod = false;

  return data;
};

// CREATE CANDIDATE
router.post('/', upload.single('resume'), async (req, res) => {
  try {
    // Sanitize the body (fix booleans and skills array)
    let candidateData = sanitizeBody(req.body);

    // Handle File
    if (req.file) {
      candidateData.resumeUrl = `/uploads/${req.file.filename}`;
      candidateData.resumeOriginalName = req.file.originalname;
    }

    // ✅ FIX: User schema has no .name field — build name from firstName + lastName + username fallback
    const resolveUserName = (u) => {
      if (!u) return 'Unknown';
      const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
      return full || u.username || u.email || 'Unknown';
    };

    // Handle Recruiter Assignment
    let targetRecruiterId = req.user._id;
    let targetRecruiterName = resolveUserName(req.user);

    // Allow Admins/Managers to assign candidates to any user
    if ((req.user.role === 'admin' || req.user.role === 'manager') && candidateData.recruiterId) {
      const assignedRecruiter = await User.findById(candidateData.recruiterId);
      if (assignedRecruiter) {
        targetRecruiterId = assignedRecruiter._id;
        targetRecruiterName = resolveUserName(assignedRecruiter);
      }
    }

    candidateData.recruiterId = targetRecruiterId;
    candidateData.recruiterName = targetRecruiterName;

    const newCandidate = new Candidate(candidateData);
    await newCandidate.save();
    
    res.status(201).json(newCandidate);
  } catch (error) {
    console.error("Create Error:", error);
    res.status(400).json({ message: error.message });
  }
});

// BULK ASSIGN — assign multiple candidates to any user (admin/manager only)
// POST /api/candidates/bulk-assign
router.put('/bulk-assign', async (req, res) => {
  try {
    // Only admin and manager can bulk-assign
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

    // ✅ Resolve the target user's display name (no .name field in User schema)
    const targetUser = await User.findById(recruiterId);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found' });
    }
    const resolveUserName = (u) => {
      const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
      return full || u.username || u.email || 'Unknown';
    };
    const recruiterName = resolveUserName(targetUser);

    // Bulk update all candidates in the list
    const result = await Candidate.updateMany(
      { _id: { $in: candidateIds } },
      { $set: { recruiterId: targetUser._id, recruiterName } }
    );

    res.json({
      message: `Successfully assigned ${result.modifiedCount} candidate(s) to ${recruiterName}`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Bulk assign error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET SINGLE
router.get('/:id', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id).populate('recruiterId', 'name firstName lastName email');
    if (!candidate) return res.status(404).json({ message: 'Candidate not found' });

    // Managers bypass ownership check
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && candidate.recruiterId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this candidate' });
    }

    res.json(candidate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Specialized status/remarks/inline update routes
router.put('/:id/status', updateCandidateStatus);
router.put('/:id/remarks', updateCandidateRemarks);
router.put('/:id/inline-update', inlineUpdateCandidate);

// UPDATE CANDIDATE
router.put('/:id', upload.single('resume'), async (req, res) => {
  try {
    // Sanitize the body
    let updateData = sanitizeBody(req.body);

    // ✅ FIX: Always strip dateAdded and createdAt so they are NEVER overwritten on edit
    delete updateData.dateAdded;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // ✅ FIX: findByIdAndUpdate bypasses Mongoose pre-save hooks so the `name`
    // field is never auto-recomputed. Rebuild it explicitly here so the table
    // always shows the correct full name after an edit.
    if (updateData.firstName || updateData.lastName) {
      updateData.name = `${updateData.firstName || ''} ${updateData.lastName || ''}`.trim();
    }

    const existingCandidate = await Candidate.findById(req.params.id);
    if (!existingCandidate) return res.status(404).json({ message: 'Candidate not found' });

    // Managers bypass ownership check
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && existingCandidate.recruiterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (req.file) {
      updateData.resumeUrl = `/uploads/${req.file.filename}`;
      updateData.resumeOriginalName = req.file.originalname;
    }

    // ✅ FIX: When admin/manager reassigns recruiter on edit, sync recruiterName too
    if ((req.user.role === 'admin' || req.user.role === 'manager') && updateData.recruiterId) {
      const resolveUserName = (u) => {
        if (!u) return 'Unknown';
        const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
        return full || u.username || u.email || 'Unknown';
      };
      const assignedRecruiter = await User.findById(updateData.recruiterId);
      if (assignedRecruiter) {
        updateData.recruiterName = resolveUserName(assignedRecruiter);
      }
    }

    const updatedCandidate = await Candidate.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true });
    res.json(updatedCandidate);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE CANDIDATE
router.delete('/:id', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ message: 'Candidate not found' });

    // Managers bypass ownership check
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && candidate.recruiterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (candidate.resumeUrl) {
      const filePath = path.join(process.cwd(), candidate.resumeUrl);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) { console.error("File delete error:", e); }
      }
    }

    await Candidate.findByIdAndDelete(req.params.id);
    res.json({ message: 'Candidate deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;