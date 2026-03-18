import mongoose from 'mongoose';

const clientSchema = mongoose.Schema({
  clientId: {
    type: String,
    unique: true,
  },
  companyName: {
    type: String,
    required: true,
  },
  contactPerson: {
    type: String,
  },
  email: {
    type: String,
  },
  phone: {
    type: String,
  },
  website: {
    type: String,
  },
  address: {
    type: String,
  },
  // New Field
  clientLocation: {
    type: String,
  },
  industry: {
    type: String,
  },
  gstNumber: {
    type: String,
  },
  notes: {
    type: String,
  },
  percentage: {
    type: String, // Commission %
  },
  candidatePeriod: {
    type: String,
  },
  replacementPeriod: {
    type: String,
  },
  // New Field
  lockingPeriod: {
    type: String,
  },
  // New Field
  paymentMode: {
    type: String,
  },
  terms: {
    type: String,
  },
  active: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// ── Indexes for fast queries ──────────────────────────────────────────────────
clientSchema.index({ companyName: 1 });   // search by company name
clientSchema.index({ active: 1 });         // status filter
clientSchema.index({ industry: 1 });       // industry filter
clientSchema.index({ createdAt: -1 });     // default sort newest first

const Client = mongoose.model('Client', clientSchema);

export default Client;