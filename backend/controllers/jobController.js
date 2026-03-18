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

    const jobs = await Job.find(query).sort({ createdAt: -1 }).lean();
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

    // Prevent Mongoose CastError if frontend sends an empty string for date
    if (jobData.tatTime === "") {
      jobData.tatTime = null;
    }

    // AUTO-GENERATE JOB CODE — find only the highest existing REQ number (not all jobs)
    const lastJob = await Job.findOne(
      { jobCode: { $regex: /^REQ\d+$/ } },
      { jobCode: 1 }
    ).sort({ jobCode: -1 }).lean();

    const maxNum = lastJob?.jobCode
      ? parseInt(lastJob.jobCode.replace('REQ', ''), 10)
      : 0;
    jobData.jobCode = `REQ${String(maxNum + 1).padStart(4, '0')}`;

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

    const updateData = { ...req.body };
    
    // Prevent Mongoose CastError if frontend sends an empty string for date
    if (updateData.tatTime === "") {
      updateData.tatTime = null;
    }

    const updatedJob = await Job.findByIdAndUpdate(req.params.id, updateData, { new: true }).lean();
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