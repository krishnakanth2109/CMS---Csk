// --- START OF FILE jobController.js ---
import Job from '../models/Job.js';

// @desc    Get jobs (All for Admin, Assigned only for Recruiter)
// @route   GET /api/jobs
export const getJobs = async (req, res) => {
  try {
    let query = {};

    // ── FILTERING LOGIC ─────────────────────────────────────────────
    if (req.user && req.user.role === 'recruiter') {
      const possibleNames = [
        (req.user.firstName && req.user.lastName) ? `${req.user.firstName} ${req.user.lastName}` : null,
        req.user.name,
        req.user.fullName,
        req.user.username,
        req.user.firstName,
        req.user.email
      ].filter(Boolean);

      query = {
        $or: [
          { primaryRecruiter: { $in: possibleNames } },
          { secondaryRecruiter: { $in: possibleNames } }
        ]
      };
    }
    // ────────────────────────────────────────────────────────────────

    const jobs = await Job.find(query).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create job
// @route   POST /api/jobs
export const createJob = async (req, res) => {
  try {
    const jobData = {
      ...req.body,
      createdBy: req.user._id
    };

    // --- AUTO-GENERATE JOB CODE (REQ0001 format) ---
    // Fetch all jobs that match the REQ + numbers pattern
    const allReqJobs = await Job.find({ jobCode: /^REQ\d+$/ }, 'jobCode');
    
    let maxNum = 0;
    allReqJobs.forEach(job => {
      const num = parseInt(job.jobCode.replace('REQ', ''), 10);
      if (num > maxNum) maxNum = num;
    });
    
    // Increment the highest found sequence
    const nextSequence = maxNum + 1;
    jobData.jobCode = `REQ${String(nextSequence).padStart(4, '0')}`;
    // ----------------------------------------------

    const job = await Job.create(jobData);
    res.status(201).json(job);
  } catch (error) {
    console.error("Create Job Error:", error); 
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update job
// @route   PUT /api/jobs/:id
export const updateJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    const updatedJob = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedJob);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
                 
// @desc    Delete job
// @route   DELETE /api/jobs/:id
export const deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    
    await job.deleteOne();
    res.json({ message: 'Job removed'});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};