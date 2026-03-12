import Candidate from '../models/Candidate.js';

// @desc    Update candidate status with interview level and outcome
// @route   PUT /api/candidates/:id/status
// @access  Private
export const updateCandidateStatus = async (req, res) => {
  try {
    const { status, level, outcome } = req.body;

    // Validate candidate exists
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    // Check authorization
    if (req.user.role !== 'admin' && candidate.recruiterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this candidate' });
    }

    // Format status if level and outcome provided
    let newStatus = status;
    if (level && outcome) {
      newStatus = `${level} - ${outcome}`;
    }

    // Validate status format
    const validStatuses = [
      'Submitted', 'Shared Profiles', 'Yet to attend', 'Turnups', 'No Show',
      'Selected', 'Joined', 'Rejected', 'Hold', 'Backout'
    ];

    // Check if status is valid (either direct or from level-outcome format)
    const statusToCheck = level && outcome ? `${level} - ${outcome}` : status;
    if (!statusToCheck || !/^(L\d|Submitted|Shared Profiles|Yet to attend|Turnups|No Show|Selected|Joined|Rejected|Hold|Backout|L\d - (SELECT|REJECT|HOLD))/.test(statusToCheck)) {
      // Allow any format with L1-L5 and SELECT/REJECT/HOLD
      if (!/^L[1-5]\s*-\s*(SELECT|REJECT|HOLD)$/.test(statusToCheck) && !validStatuses.includes(statusToCheck)) {
        return res.status(400).json({ message: 'Invalid status format' });
      }
    }

    // Update candidate
    const updatedCandidate = await Candidate.findByIdAndUpdate(
      req.params.id,
      { $set: { status: newStatus, updatedBy: req.user._id } },
      { new: true, runValidators: false } // Disable schema validation for custom status format
    );

    res.json({
      message: 'Candidate status updated successfully',
      candidate: updatedCandidate
    });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update candidate remarks
// @route   PUT /api/candidates/:id/remarks
// @access  Private
export const updateCandidateRemarks = async (req, res) => {
  try {
    const { remarks } = req.body;

    // Validate candidate exists
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    // Check authorization
    if (req.user.role !== 'admin' && candidate.recruiterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this candidate' });
    }

    // Update candidate remarks
    const updatedCandidate = await Candidate.findByIdAndUpdate(
      req.params.id,
      { $set: { remarks: remarks || '', updatedBy: req.user._id } },
      { new: true }
    );

    res.json({
      message: 'Candidate remarks updated successfully',
      candidate: updatedCandidate
    });
  } catch (error) {
    console.error('Remarks update error:', error);
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update candidate status and remarks together
// @route   PUT /api/candidates/:id/inline-update
// @access  Private
export const inlineUpdateCandidate = async (req, res) => {
  try {
    const { status, remarks, level, outcome } = req.body;

    // Validate candidate exists
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    // Check authorization
    if (req.user.role !== 'admin' && candidate.recruiterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this candidate' });
    }

    // Build update object
    const updateData = {
      updatedBy: req.user._id,
    };

    // Add status if provided
    if (status) {
      updateData.status = status;
    } else if (level && outcome) {
      updateData.status = `${level} - ${outcome}`;
    }

    // Add remarks if provided (can be empty string)
    if (remarks !== undefined) {
      updateData.remarks = remarks;
    }

    // Update candidate
    const updatedCandidate = await Candidate.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: false }
    );

    res.json({
      message: 'Candidate updated successfully',
      candidate: updatedCandidate
    });
  } catch (error) {
    console.error('Inline update error:', error);
    res.status(400).json({ message: error.message });
  }
};