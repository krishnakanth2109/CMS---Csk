import Job from '../models/Job.js';

// @desc    Get jobs (All for Admin, Assigned only for Recruiter)
// @route   GET /api/jobs
export const getJobs = async (req, res) => {
  try {
    let query = {};

    // ── FILTERING LOGIC ─────────────────────────────────────────────
    // If the logged-in user is a Recruiter, restrict results
    if (req.user && req.user.role === 'recruiter') {
      
      // Generate all possible variations of the recruiter's name 
      // to ensure we catch the exact string saved by the Admin.
      const possibleNames = [
        (req.user.firstName && req.user.lastName) ? `${req.user.firstName} ${req.user.lastName}` : null,
        req.user.name,
        req.user.fullName,
        req.user.username,
        req.user.firstName,
        req.user.email
      ].filter(Boolean); // Removes nulls and undefined values

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

    // Optional: Prevent recruiters from editing jobs they aren't assigned to
    // (Uncomment if strict security is needed)
    /*
    if (req.user.role === 'recruiter') {
       const rName = req.user.name || `${req.user.firstName} ${req.user.lastName}`;
       if (job.primaryRecruiter !== rName && job.secondaryRecruiter !== rName) {
         return res.status(403).json({ message: 'Not authorized to edit this job' });
       }
    }
    */

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
    
    // Only Admins should delete (usually), but if you allow recruiters:
    await job.deleteOne();
    res.json({ message: 'Job removed'});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};