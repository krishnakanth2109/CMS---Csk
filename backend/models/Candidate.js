// --- START OF FILE Candidate.js ---
import mongoose from 'mongoose';

const candidateSchema = mongoose.Schema({
  candidateId: { type: String, unique: true, sparse: true },

  // --- Personal Info ---
  firstName: { type: String, required: true },
  lastName:  { type: String, required: true },
  name:      { type: String },

  email:             { type: String, required: true },
  contact:           { type: String, required: true },
  alternateNumber:   { type: String },
  currentLocation:   { type: String },
  preferredLocation: { type: String },
  dateOfBirth:       { type: Date },
  gender:            { type: String },
  linkedin:          { type: String },

  // --- Professional Info ---
  position:           { type: String, default: '' },
  client:             { type: String, default: '' },
  currentCompany:     { type: String },
  industry:           { type: String },
  totalExperience:    { type: String },
  relevantExperience: { type: String },
  reasonForChange:    { type: String },
  education:          { type: String },
  skills:             { type: [String] },

  // --- Financial ---
  ctc:              { type: String },
  currentTakeHome:  { type: String },
  ectc:             { type: String },
  expectedTakeHome: { type: String },

  // --- Availability & Offers ---
  noticePeriod:        { type: String },
  servingNoticePeriod: { type: Boolean, default: false },
  lwd:                 { type: Date },
  offersInHand:        { type: Boolean, default: false },
  offerPackage:        { type: String },

  // --- Recruitment ---
  source:        { type: String, default: 'Portal' },
  recruiterId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recruiterName: { type: String },
  remarks:       { type: String },
  notes:         { type: String },
  rating:        { type: Number, default: 0 },

  // --- Status ---
  status: {
    type: [String],
    enum: [
      'Submitted', 'Shared Profiles', 'Yet to attend', 'Turnups',
      'No Show', 'Selected', 'Joined', 'Rejected', 'Hold', 'Backout', 'Pipeline'
    ],
    default: ['Submitted']
  },

  // --- System ---
  active:             { type: Boolean, default: true },
  dateAdded:          { type: Date, default: () => new Date(), immutable: true },
  resumeUrl:          { type: String },
  resumeOriginalName: { type: String },
}, {
  timestamps: true,
});

// Minimal counter schema (stored in 'counters' collection)
const counterSchema = new mongoose.Schema({
  _id:  { type: String, required: true },
  seq:  { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

// A local flag so we only do the "sync" query once per server startup, preventing performance drops
let isCounterSynced = false;

candidateSchema.pre('save', async function (next) {
  // Always sync name from firstName + lastName
  if (this.firstName || this.lastName) {
    this.name = `${this.firstName || ''} ${this.lastName || ''}`.trim();
  }

  // Only auto-generate candidateId for brand-new records without one
  if (!this.isNew || this.candidateId) return next();

  try {
    // 1. Auto-healing step: Sync the counter with the highest existing ID
    if (!isCounterSynced) {
      // Find the currently highest candidateId starting with "VTS"
      const highestCandidate = await this.constructor
        .findOne({ candidateId: { $regex: /^VTS/ } }, { candidateId: 1 })
        .sort({ candidateId: -1 });

      let maxSeq = 0;
      if (highestCandidate && highestCandidate.candidateId) {
        // Extract the number part: "VTS0000044" -> 44
        const match = highestCandidate.candidateId.match(/^VTS0*(\d+)$/);
        if (match) {
          maxSeq = parseInt(match[1], 10);
        }
      }

      // $max atomically sets the counter to maxSeq ONLY if maxSeq is greater than the current seq
      await Counter.updateOne(
        { _id: 'candidate' },
        { $max: { seq: maxSeq } },
        { upsert: true }
      );

      isCounterSynced = true; // Don't run this check again while the server stays alive
    }

    // 2. Atomic increment — guaranteed unique, race-condition-proof
    const counter = await Counter.findOneAndUpdate(
      { _id: 'candidate' },
      { $inc: { seq: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    this.candidateId = `VTS${counter.seq.toString().padStart(7, '0')}`;
    next();
  } catch (error) {
    console.error('Error generating Candidate ID:', error);
    next(error);
  }
});

const Candidate = mongoose.models.Candidate || mongoose.model('Candidate', candidateSchema);
export default Candidate;