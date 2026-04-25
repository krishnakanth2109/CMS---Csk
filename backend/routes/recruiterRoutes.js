import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  getRecruiters,
  createRecruiter,
  updateRecruiter,
  deleteRecruiter,
  toggleRecruiterStatus,
  getUsersByRole,          // ✅ NEW
} from '../controllers/recruiterController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();  

router.use(protect);

// ── Must be defined BEFORE /:id routes to avoid route conflicts ──────────────
router.get('/profile',  getUserProfile);
router.put('/profile',  updateUserProfile);

// ✅ NEW: Get users by role for messaging recipient dropdowns
// GET /api/recruiters/by-role?role=manager   → returns Navya, Sanjay
// GET /api/recruiters/by-role?role=recruiter → returns Varun, Lahitya, Akhila, Hema
router.get('/by-role',  getUsersByRole);

// ── Main recruiter CRUD ───────────────────────────────────────────────────────
router.route('/')
  .get(getRecruiters)
  .post(createRecruiter);

router.route('/:id')
  .put(updateRecruiter)
  .delete(deleteRecruiter);

router.patch('/:id/status', toggleRecruiterStatus);

export default router;
