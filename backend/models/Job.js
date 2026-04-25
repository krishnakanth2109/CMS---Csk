import mongoose from 'mongoose';

const jobSchema = mongoose.Schema({
  jobCode: { type: String, required: true, unique: true, trim: true },
  clientName: { type: String, required: true, trim: true },
  position: { type: String, required: true, trim: true },
  location: { type: String, default: '' },
  experience: { type: String, default: '' },
  relevantExperience: { type: String, default: '' },
  qualification: { type: String, default: '' },
  salaryBudget: { type: String, default: '' }, 
  monthlySalary: { type: String, default: '' }, 
  gender: { type: String, enum: ['Any', 'Male', 'Female'], default: 'Any' },
  noticePeriod: { type: String, default: '' },
  tatTime: { type: Date }, 
  primaryRecruiter: { type: String, default: '' },
  secondaryRecruiter: { type: String, default: '' },
  skills: { type: String, default: '' },
  jdLink: { type: String, default: '' },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});

// Indexes
jobSchema.index({ jobCode: 1 });
jobSchema.index({ clientName: 1 });
jobSchema.index({ position: 1 });

const Job = mongoose.model('Job', jobSchema);
export default Job;