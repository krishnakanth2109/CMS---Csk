import mongoose from 'mongoose';

const interviewSchema = mongoose.Schema({
  interviewId: { type: String, unique: true }, // e.g., INT-1699999999
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
  recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' }, 
  
  interviewDate: { type: Date, required: true },
  duration: { type: Number, default: 60 },
  type: { 
    type: String, 
    enum: ['Virtual', 'In-person', 'Phone'], 
    default: 'Virtual' 
  },
  location: { type: String, default: 'Remote' },
  meetingLink: { type: String },
  
  // Updated Status Enum
  status: {
    type: String,
    enum: [
      'Scheduled', 
      'Completed', 
      'Cancelled', 
      'No Show', 
      'Shortlisted', 
      'Rejected', 
      'Submitted', 
      'Hold'
    ],
    default: 'Scheduled'
  },

  // Updated Round Enum
  round: {
    type: String,
    enum: [
      'L1 Interview', 
      'L2 Interview', 
      'L3 Interview', 
      'L4 Interview', 
      'L5 Interview', 
      'Technical Round', 
      'HR Round'
    ],
    default: 'L1 Interview'
  },

  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  notes: { type: String },
  feedback: { type: String },
  rating: { type: Number },

}, {
  timestamps: true,
});

// Use timestamp + random string to ensure uniqueness
interviewSchema.pre('save', function (next) {
  if (!this.isNew) return next();
  
  // Generates ID like: INT-1701234567890-AB12
  const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  this.interviewId = `INT-${uniqueSuffix}`;
  
  next();
});

// ── Indexes for fast queries ──────────────────────────────────────────────────
interviewSchema.index({ recruiterId: 1, interviewDate: 1 }); // recruiter's interviews sorted by date
interviewSchema.index({ candidateId: 1 });                    // lookup interviews by candidate
interviewSchema.index({ interviewDate: 1 });                  // date-based sorts/filters
interviewSchema.index({ status: 1 });                         // status filter

const Interview = mongoose.model('Interview', interviewSchema);
export default Interview;