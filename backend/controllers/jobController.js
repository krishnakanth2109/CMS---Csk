import Job from '../models/Job.js';

export const getJobs = async (req, res) => {
  try {
    let query = {};
    if (req.user && req.user.role === 'recruiter') {
      const possibleNames = [
        (req.user.firstName && req.user.lastName) ? `${req.user.firstName} ${req.user.lastName}` : null,
        req.user.name, req.user.fullName, req.user.username, req.user.email
      ].filter(Boolean);

      query = {
        $or: [
          { primaryRecruiter: { $in: possibleNames } },
          { secondaryRecruiter: { $in: possibleNames } }
        ]
      };
    }
    const jobs = await Job.find(query).sort({ createdAt: -1 }).lean();
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createJob = async (req, res) => {
  try {
    const jobData = { ...req.body, createdBy: req.user._id };

    if (!jobData.tatTime || jobData.tatTime === "") {
      jobData.tatTime = null;
    }

    // ROBUST AUTO-INCREMENT LOGIC
    // 1. Get all jobs that start with REQ
    const allJobs = await Job.find({ jobCode: /^REQ/ }, { jobCode: 1 }).lean();
    
    let maxNum = 0;
    if (allJobs.length > 0) {
      // 2. Extract numeric parts and find the absolute maximum
      const nums = allJobs.map(j => {
        const match = j.jobCode.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      });
      maxNum = Math.max(...nums);
    }

    // 3. Set new job code (e.g., REQ0005)
    jobData.jobCode = `REQ${String(maxNum + 1).padStart(4, '0')}`;

    const job = await Job.create(jobData);
    res.status(201).json(job);
  } catch (error) {
    console.error("Create Job Error:", error); 
    res.status(400).json({ message: error.code === 11000 ? "Job Code collision. Try again." : error.message });
  }
};

export const updateJob = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.tatTime === "") updateData.tatTime = null;

    const updatedJob = await Job.findByIdAndUpdate(req.params.id, updateData, { new: true }).lean();
    if (!updatedJob) return res.status(404).json({ message: 'Job not found' });
    res.json(updatedJob);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

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