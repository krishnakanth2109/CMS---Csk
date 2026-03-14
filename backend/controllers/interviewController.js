import Interview from '../models/Interview.js';
import Candidate from '../models/Candidate.js';

// @desc    Get interviews (Admin & Manager: All, Recruiter: Own)
// @route   GET /api/interviews
export const getInterviews = async (req, res) => {
  try {
    let query = {};
    
    // Allow both Admin and Manager to fetch all interviews
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      query.recruiterId = req.user._id;
    }

    const interviews = await Interview.find(query)
      .populate('candidateId', 'name email phone position')
      .populate('recruiterId', 'name firstName lastName email')
      .sort({ interviewDate: 1 });

    res.json(interviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Schedule a new interview
// @route   POST /api/interviews
export const createInterview = async (req, res) => {
  try {
    const { 
      candidateId, interviewDate, interviewTime, type, location, 
      duration, notes, priority, round, meetingLink 
    } = req.body;

    const dateTime = new Date(`${interviewDate}T${interviewTime}`);

    const interview = await Interview.create({
      candidateId,
      recruiterId: req.user._id,
      interviewDate: dateTime,
      duration: parseInt(duration) || 60,
      type,
      location,
      meetingLink,
      notes,
      priority,
      round
    });

    await Candidate.findByIdAndUpdate(candidateId, { status: round });

    res.status(201).json(interview);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update interview details & Candidate status (Full Edit Support)
// @route   PUT /api/interviews/:id
export const updateInterview = async (req, res) => {
  try {
    const { status, round, interviewDate, interviewTime, meetingLink, notes } = req.body;
    const interview = await Interview.findById(req.params.id);
    
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    // Update Status/Round
    if (status) interview.status = status;
    if (round) interview.round = round;

    // Update extended details from full edit
    if (meetingLink !== undefined) interview.meetingLink = meetingLink;
    if (notes !== undefined) interview.notes = notes;

    if (interviewDate && interviewTime) {
        interview.interviewDate = new Date(`${interviewDate}T${interviewTime}`);
    } else if (interviewDate) {
        // Fallback if only date was provided (preserves old time)
        const datePart = new Date(interviewDate);
        const currentDateTime = new Date(interview.interviewDate);
        datePart.setHours(currentDateTime.getHours(), currentDateTime.getMinutes(), currentDateTime.getSeconds());
        interview.interviewDate = datePart;
    }

    await interview.save();

    // Sync Candidate status effectively
    if (status || round) {
      const candidateStatus = (status && status !== 'Scheduled') ? status : round;
      await Candidate.findByIdAndUpdate(interview.candidateId, { status: candidateStatus });
    }

    res.json(interview);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete interview
// @route   DELETE /api/interviews/:id
export const deleteInterview = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ message: 'Not found' });
    
    await interview.deleteOne();
    res.json({ message: 'Interview removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};