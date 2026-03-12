import Candidate from '../models/Candidate.js';
import User from '../models/User.js';

// @desc    Get all candidates
// @route   GET /api/candidates
export const getCandidates = async (req, res) => {
  try {
    let query = {};
    // Allow Admins and Managers to see everything, Recruiters see only theirs
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      query.recruiterId = req.user._id;
    }
    
    // 🔴 FIXED: Added username and firstName to populate so frontend shows firstName only
    const candidates = await Candidate.find(query)
      .populate('recruiterId', 'name firstName lastName username email')
      .sort({ createdAt: -1 });
      
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a candidate
// @route   POST /api/candidates
export const createCandidate = async (req, res) => {
  try {
    const body = { ...req.body };
    body.name = `${body.firstName || ''} ${body.lastName || ''}`.trim();

    if (typeof body.skills === 'string') {
      body.skills = body.skills.split(',').map(s => s.trim()).filter(Boolean);
    }

    // ✅ FIX: Centralized name resolver — handles firstName+lastName, username, and email fallback
    const resolveUserName = (u) => {
      if (!u) return 'Unknown';
      const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
      return full || u.username || u.email || 'Unknown';
    };

    let targetRecruiterId = req.user._id;
    let targetRecruiterName = resolveUserName(req.user);

    if ((req.user.role === 'admin' || req.user.role === 'manager') && body.recruiterId) {
      const assignedRecruiter = await User.findById(body.recruiterId);
      if (assignedRecruiter) {
        targetRecruiterId = assignedRecruiter._id;
        targetRecruiterName = resolveUserName(assignedRecruiter);
      }
    }

    body.recruiterId = targetRecruiterId;
    body.recruiterName = targetRecruiterName;

    const candidate = await Candidate.create(body);
    res.status(201).json(candidate);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update candidate
export const updateCandidate = async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ message: 'Candidate not found' });

    if (req.user.role !== 'admin' && req.user.role !== 'manager' && candidate.recruiterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const body = { ...req.body };
    body.name = `${body.firstName || ''} ${body.lastName || ''}`.trim();

    // ✅ FIX: Always strip dateAdded and timestamps so they are NEVER overwritten on edit
    delete body.dateAdded;
    delete body.createdAt;
    delete body.updatedAt;

    if (typeof body.skills === 'string') {
      body.skills = body.skills.split(',').map(s => s.trim()).filter(Boolean);
    }

    // ✅ FIX: Wrap in $set so only provided fields are updated — without it Mongoose
    // replaces the entire document, wiping fields like candidateId and resumeUrl.
    const updatedCandidate = await Candidate.findByIdAndUpdate(req.params.id, { $set: body }, { new: true });
    res.json(updatedCandidate);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete candidate
export const deleteCandidate = async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ message: 'Candidate not found' });

    if (req.user.role !== 'admin' && req.user.role !== 'manager' && candidate.recruiterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await candidate.deleteOne();
    res.json({ message: 'Candidate removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};